/* Pure helpers for the live feeds. No DOM here, so the gates can run them in Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GripadLive = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DASH = "—";

  /* Equal-jitter exponential backoff: half the capped delay is fixed, half is random. */
  function nextDelay(base, max, fails, rand) {
    var cap = Math.min(max, base * Math.pow(2, fails));
    return Math.round(cap / 2 + rand() * (cap / 2));
  }

  /* One poller per feed. Timers and visibility are injected so tests can drive a fast clock. */
  function createPoller(o) {
    var fails = 0, timer = null, running = false, stopped = true, paused = false;
    function schedule() {
      if (stopped) return;
      timer = o.setTimer(run, nextDelay(o.base, o.max, Math.max(0, fails - 1), o.rand));
    }
    function run() {
      timer = null;
      if (stopped || running) return;
      if (o.isHidden()) { paused = true; return; }
      paused = false;
      running = true;
      Promise.resolve().then(o.task).then(function (v) {
        fails = 0;
        o.onResult(true, v, fails);
      }, function (e) {
        fails += 1;
        o.onResult(false, e, fails);
      }).then(function () {
        running = false;
        schedule();
      });
    }
    return {
      start: function () { stopped = false; run(); },
      stop: function () { stopped = true; if (timer !== null) { o.clearTimer(timer); timer = null; } },
      /* Called when the tab becomes visible again. */
      wake: function () {
        if (stopped || running) return;
        if (paused || timer === null) { if (timer !== null) { o.clearTimer(timer); timer = null; } run(); }
      },
      state: function () { return { fails: fails, paused: paused, running: running, hasTimer: timer !== null }; }
    };
  }

  function healthState(s) {
    if (!s.online) return "offline";
    if (s.fails >= 3) return "offline";
    if (!s.everOk) return "connecting";
    if (s.fails > 0) return "connecting";
    return "live";
  }

  function slugify(name) {
    return String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function parseSlot(json) {
    var n = json && json.result;
    if (typeof n !== "number" || !isFinite(n) || n < 0) throw new Error("bad slot");
    return n;
  }

  function parseTvl(chains) {
    if (!Array.isArray(chains)) throw new Error("bad chains");
    for (var i = 0; i < chains.length; i++) {
      if (slugify(chains[i].name) === "solana" && typeof chains[i].tvl === "number") return chains[i].tvl;
    }
    throw new Error("solana not listed");
  }

  function safeImg(u) {
    try {
      var url = new URL(u);
      return url.protocol === "https:" && /(^|\.)dexscreener\.com$/.test(url.hostname) ? url.href : "";
    } catch (e) { return ""; }
  }

  function parsePairs(json, limit) {
    var list = json && json.pairs;
    if (!Array.isArray(list)) throw new Error("bad pairs");
    var seen = {}, out = [];
    list.forEach(function (p) {
      if (!p || p.chainId !== "solana" || !p.pairAddress || seen[p.pairAddress]) return;
      var vol = p.volume && Number(p.volume.h24), price = Number(p.priceUsd);
      if (!isFinite(vol) || !isFinite(price) || !p.baseToken || !p.quoteToken) return;
      seen[p.pairAddress] = true;
      out.push({
        id: p.pairAddress,
        base: String(p.baseToken.symbol || "?").slice(0, 16),
        quote: String(p.quoteToken.symbol || "?").slice(0, 16),
        price: price,
        vol: vol,
        img: safeImg(p.info && p.info.imageUrl)
      });
    });
    out.sort(function (a, b) { return b.vol - a.vol; });
    return out.slice(0, limit || 8);
  }

  function compactUsd(n) {
    if (typeof n !== "number" || !isFinite(n)) return DASH;
    var a = Math.abs(n), u = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
    for (var i = 0; i < u.length; i++) if (a >= u[i][0]) return "$" + (n / u[i][0]).toFixed(2) + u[i][1];
    return "$" + n.toFixed(2);
  }

  function priceUsd(n) {
    if (typeof n !== "number" || !isFinite(n)) return DASH;
    if (n >= 1) return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
    if (n >= 0.01) return "$" + n.toFixed(4);
    return "$" + n.toPrecision(3);
  }

  function groupInt(n) {
    return typeof n === "number" && isFinite(n) ? Math.round(n).toLocaleString("en-US") : DASH;
  }

  return { DASH: DASH, nextDelay: nextDelay, createPoller: createPoller, healthState: healthState, slugify: slugify, parseSlot: parseSlot, parseTvl: parseTvl, parsePairs: parsePairs, compactUsd: compactUsd, priceUsd: priceUsd, groupInt: groupInt };
});
