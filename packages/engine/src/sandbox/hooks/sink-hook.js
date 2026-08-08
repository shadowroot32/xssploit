/**
 * XSSPLOIT sink/source hook — injected into the target page via
 * Playwright's addInitScript (runs before any page script).
 *
 * Plain JavaScript (not TS) — this file is read as text and evaluated
 * inside the TARGET browser context.
 *
 * It records dangerous source→sink flows to window.__xssploit.events
 * and hooks window.alert/confirm/prompt so payload execution is provable
 * without disruptive modal dialogs.
 */
(function () {
  'use strict';
  if (window.__xssploit) return;

  var events = [];
  function record(kind, detail) {
    try {
      events.push({ kind: kind, detail: String(detail).slice(0, 500), ts: Date.now() });
      if (events.length > 500) events.shift();
    } catch (e) { /* never break the target page */ }
  }

  window.__xssploit = { events: events, record: record, alerted: false };

  // ── Dialog hooks: payload execution proof ─────────────────────────────
  ['alert', 'confirm', 'prompt'].forEach(function (fn) {
    var orig = window[fn];
    window[fn] = function (arg) {
      window.__xssploit.alerted = true;
      record('dialog:' + fn, arg);
      return fn === 'prompt' ? '' : true; // keep page logic running
    };
    try { window[fn].toString = function () { return orig.toString(); }; } catch (e) {}
  });

  // ── Sink hooks ─────────────────────────────────────────────────────────
  var scriptish = /<\s*(script|img|svg|iframe|body|input)[^>]*(\bon\w+\s*=|src\s*=)/i;

  function wrapSetter(obj, prop, kind) {
    var desc = Object.getOwnPropertyDescriptor(obj, prop);
    if (!desc || !desc.set) return;
    Object.defineProperty(obj, prop, {
      set: function (value) {
        try {
          if (typeof value === 'string' && scriptish.test(value)) {
            record(kind, value);
          }
        } catch (e) {}
        return desc.set.call(this, value);
      },
      get: desc.get,
      configurable: true,
    });
  }

  try { wrapSetter(Element.prototype, 'innerHTML', 'sink:innerHTML'); } catch (e) {}
  try { wrapSetter(Element.prototype, 'outerHTML', 'sink:outerHTML'); } catch (e) {}
  try { wrapSetter(Element.prototype, 'srcdoc', 'sink:srcdoc'); } catch (e) {}

  ['write', 'writeln'].forEach(function (fn) {
    var orig = document[fn];
    if (!orig) return;
    document[fn] = function (value) {
      try { if (scriptish.test(String(value))) record('sink:document.' + fn, value); } catch (e) {}
      return orig.apply(document, arguments);
    };
  });

  var origInsert = Element.prototype.insertAdjacentHTML;
  if (origInsert) {
    Element.prototype.insertAdjacentHTML = function (position, value) {
      try { if (scriptish.test(String(value))) record('sink:insertAdjacentHTML', value); } catch (e) {}
      return origInsert.call(this, position, value);
    };
  }

  // eval / Function string execution
  var origEval = window.eval;
  window.eval = function (code) {
    record('sink:eval', code);
    return origEval.call(window, code);
  };

  // postMessage listener observation: records messages carrying markup
  window.addEventListener('message', function (ev) {
    try {
      var data = typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data);
      if (data && scriptish.test(data)) record('source:postMessage', data);
    } catch (e) {}
  }, true);
})();
