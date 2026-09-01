/**
 * netguard — counts every outbound network attempt the page makes.
 *
 * This is a demo instrument, not a security boundary. Its job is to make the
 * central claim *visible*: after load, ReviewGate makes zero network requests,
 * so the manuscript cannot have left the browser.
 *
 * Loaded before the app so it wraps the primitives first.
 */
const counters = { fetch: 0, xhr: 0, beacon: 0, ws: 0 };
const listeners = new Set();

const bump = (kind, detail) => {
  counters[kind]++;
  const total = Object.values(counters).reduce((a, b) => a + b, 0);
  listeners.forEach((fn) => fn({ ...counters, total, last: detail }));
  console.warn(`[netguard] outbound ${kind}:`, detail);
};

const _fetch = window.fetch;
window.fetch = function (...args) {
  bump('fetch', String(args[0]));
  return _fetch.apply(this, args);
};

const _open = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url, ...rest) {
  bump('xhr', `${method} ${url}`);
  return _open.call(this, method, url, ...rest);
};

if (navigator.sendBeacon) {
  const _beacon = navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon = (url, data) => { bump('beacon', String(url)); return _beacon(url, data); };
}

const _WS = window.WebSocket;
window.WebSocket = function (url, protocols) {
  bump('ws', String(url));
  return new _WS(url, protocols);
};
window.WebSocket.prototype = _WS.prototype;

window.__netguard = {
  get counts() {
    return { ...counters, total: Object.values(counters).reduce((a, b) => a + b, 0) };
  },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
