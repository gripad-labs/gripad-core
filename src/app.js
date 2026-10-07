(function () {
  "use strict";
  var L = window.GripadLive;
  var root = document.documentElement;
  root.classList.add("js");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cfg = { rpc: root.getAttribute("data-rpc") };

  /* ---------- scroll: variables only, the stylesheet does all the math ---------- */
  function sizes() {
    root.style.setProperty("--doc", root.scrollHeight);
    root.style.setProperty("--vh", window.innerHeight);
  }
  sizes();
  window.addEventListener("resize", sizes, { passive: true });
  window.addEventListener("load", sizes);
  window.addEventListener("scroll", function () { root.style.setProperty("--sy", window.scrollY); }, { passive: true });

  /* ---------- reveal ---------- */
  var revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* Hero never waits on the observer: if it has not fired shortly after load, show it. */
  setTimeout(function () {
    document.querySelectorAll("#top [data-reveal]").forEach(function (el) { el.classList.add("in"); });
  }, 900);

  /* ---------- contract copy ---------- */
  var caBtns = document.querySelectorAll("[data-copy]");
  caBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy");
      if (!text) return;
      var finish = function () {
        var bar = btn.closest(".ca");
        var old = bar.querySelector(".ca-tip");
        if (old) old.remove();
        var tip = document.createElement("span");
        tip.className = "ca-tip";
        tip.setAttribute("role", "status");
        tip.textContent = "Copied to clipboard";
        bar.appendChild(tip);
        var cb = bar.querySelector(".ca-btn");
        cb.classList.add("done");
        cb.textContent = "Copied";
        setTimeout(function () { tip.remove(); cb.classList.remove("done"); cb.textContent = "Copy"; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(finish, function () { legacyCopy(text) && finish(); });
      } else if (legacyCopy(text)) finish();
    });
  });
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.className = "sr-copy";
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  /* ---------- preset picker ---------- */
  var picker = document.querySelector("[data-picker]");
  if (picker) {
    var tabs = Array.prototype.slice.call(picker.querySelectorAll('[role="tab"]'));
    var pick = function (tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      var first = document.getElementById(tab.getAttribute("aria-controls")).querySelector(".tile");
      if (first) showDetail(first);
    };
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { pick(t); });
      t.addEventListener("keydown", function (e) {
        var n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
        if (n === null) return;
        e.preventDefault();
        var next = tabs[(n + tabs.length) % tabs.length];
        next.focus(); pick(next);
      });
    });
    var showDetail = function (tile) {
      picker.querySelectorAll(".tile").forEach(function (t) { t.setAttribute("aria-pressed", t === tile ? "true" : "false"); });
      picker.querySelectorAll(".dt").forEach(function (d) { d.hidden = d.id !== "dt-" + tile.getAttribute("data-detail"); });
    };
    picker.querySelectorAll(".tile").forEach(function (t) { t.addEventListener("click", function () { showDetail(t); }); });
  }

  document.addEventListener("click", function (e) {
    var m = document.querySelector(".menu[open]");
    if (m && (e.target.closest(".menu-a") || !e.target.closest(".menu"))) m.removeAttribute("open");
  });

  /* ---------- live values ---------- */
  var slotEls = document.querySelectorAll('[data-live="slot"]');
  var tvlEls = document.querySelectorAll('[data-live="tvl"]');
  var pairsEl = document.querySelector("[data-pairs]");
  var healthEls = document.querySelectorAll("[data-health]");
  var net = { everOk: false, fails: 0 };
  var shown = new WeakMap();

  function setText(el, text) { el.textContent = text; }
  function flash(el) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }

  function tween(el, to, fmt) {
    var from = shown.get(el);
    shown.set(el, to);
    if (typeof from !== "number" || reduce || from === to) {
      setText(el, fmt(to));
      if (typeof from === "number" && from !== to) flash(el);
      return;
    }
    var t0 = performance.now(), dur = 600;
    flash(el);
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      setText(el, fmt(from + (to - from) * e));
      if (k < 1) requestAnimationFrame(step); else setText(el, fmt(to));
    })(t0);
  }
  function showDash(els) { els.forEach(function (el) { shown.delete(el); setText(el, L.DASH); }); }

  function paintHealth() {
    var s = L.healthState({ online: navigator.onLine !== false, everOk: net.everOk, fails: net.fails });
    var label = { live: "Live", connecting: "Connecting", offline: "Offline" }[s];
    healthEls.forEach(function (h) { h.setAttribute("data-state", s); h.querySelector(".health-t").textContent = label; });
  }
  window.addEventListener("online", paintHealth);
  window.addEventListener("offline", paintHealth);

  function fetchJson(url, opts, ms) {
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, ms || 9000);
    opts = opts || {}; opts.signal = ctl.signal;
    return fetch(url, opts).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    }).finally(function () { clearTimeout(timer); });
  }

  function poller(task, base, max, onOk, onFail, tracksHealth) {
    var p = L.createPoller({
      task: task, base: base, max: max, rand: Math.random,
      setTimer: function (f, ms) { return setTimeout(f, ms); },
      clearTimer: clearTimeout,
      isHidden: function () { return document.hidden; },
      onResult: function (ok, v, fails) {
        if (ok) onOk(v); else onFail(v);
        if (tracksHealth) { net.fails = fails; if (ok) net.everOk = true; paintHealth(); }
      }
    });
    p.start();
    return p;
  }

  var pollers = [];
  pollers.push(poller(function () {
    return fetchJson(cfg.rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot", params: [{ commitment: "confirmed" }] }) }).then(L.parseSlot);
  }, 2000, 30000, function (slot) { slotEls.forEach(function (el) { tween(el, slot, L.groupInt); }); }, function () { showDash(slotEls); }, true));

  pollers.push(poller(function () {
    return fetchJson("https://api.llama.fi/v2/chains").then(L.parseTvl);
  }, 60000, 300000, function (v) { tvlEls.forEach(function (el) { tween(el, v, L.compactUsd); }); }, function () { showDash(tvlEls); }, false));

  function paintPairs(list) {
    pairsEl.textContent = "";
    list.forEach(function (p, i) {
      var li = document.createElement("li");
      li.className = "pair";
      li.style.animationDelay = i * 40 + "ms";
      var logo;
      if (p.img) {
        logo = document.createElement("img");
        logo.className = "logo"; logo.alt = ""; logo.width = 36; logo.height = 36; logo.loading = "lazy"; logo.decoding = "async";
        logo.referrerPolicy = "no-referrer";
        logo.src = p.img;
        logo.addEventListener("error", function () { var f = document.createElement("span"); f.className = "logo"; f.textContent = p.base.charAt(0); logo.replaceWith(f); });
      } else {
        logo = document.createElement("span"); logo.className = "logo"; logo.textContent = p.base.charAt(0);
      }
      var mid = document.createElement("div");
      var nm = document.createElement("div"); nm.className = "p-name"; nm.textContent = p.base;
      var q = document.createElement("small"); q.textContent = "/ " + p.quote; nm.appendChild(q);
      var pr = document.createElement("div"); pr.className = "p-price mono"; pr.textContent = L.priceUsd(p.price);
      mid.appendChild(nm); mid.appendChild(pr);
      var vol = document.createElement("div"); vol.className = "p-vol mono"; vol.textContent = L.compactUsd(p.vol);
      var vs = document.createElement("small"); vs.textContent = "24h"; vol.appendChild(vs);
      li.appendChild(logo); li.appendChild(mid); li.appendChild(vol);
      pairsEl.appendChild(li);
    });
  }
  function pairsDash() {
    if (pairsEl.querySelector(".skel-row") || !pairsEl.children.length) {
      pairsEl.textContent = "";
      var li = document.createElement("li"); li.className = "pair";
      var d = document.createElement("span"); d.className = "logo"; d.textContent = L.DASH;
      var m = document.createElement("div"); m.className = "p-name"; m.textContent = L.DASH;
      var v = document.createElement("div"); v.className = "p-vol mono"; v.textContent = L.DASH;
      li.appendChild(d); li.appendChild(m); li.appendChild(v); pairsEl.appendChild(li);
    }
  }
  if (pairsEl) {
    pollers.push(poller(function () {
      return fetchJson("https://api.dexscreener.com/latest/dex/search?q=solana").then(function (j) { return L.parsePairs(j, 8); });
    }, 30000, 240000, function (list) { if (list.length) paintPairs(list); else pairsDash(); }, pairsDash, false));
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) pollers.forEach(function (p) { p.wake(); });
  });

  /* ---------- 90-second drill ---------- */
  var drill = document.querySelector("[data-drill]");
  if (drill && window.GripadSim) {
    var S = window.GripadSim;
    var q = function (sel) { return drill.querySelector(sel); };
    var el = {
      idle: q("[data-drill-idle]"), play: q("[data-drill-play]"), end: q("[data-drill-end]"),
      clock: q("[data-drill-clock]"), rule: q("[data-drill-rule]"), card: q("[data-drill-card]"), note: q("[data-drill-note]"),
      final: q("[data-drill-final]"), grade: q("[data-drill-grade]")
    };
    var game = null, timer = 0, lastShown = {};
    var fmtClock = function (ms) { var s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60); };
    var paintStats = function () {
      var s = game.state();
      [["score", s.score], ["streak", s.streak], ["landed", s.landed], ["refused", s.refused]].forEach(function (p) {
        var d = q('[data-ds="' + p[0] + '"]');
        if (lastShown[p[0]] !== p[1]) { d.textContent = p[1]; if (lastShown[p[0]] !== undefined && !reduce) flash(d); lastShown[p[0]] = p[1]; }
      });
    };
    var paintCard = function () {
      var c = game.state().card;
      if (!c) return;
      el.rule.textContent = c.rule;
      el.card.textContent = c.prompt;
      el.card.style.animation = "none"; void el.card.offsetWidth; el.card.style.animation = "";
    };
    var setMode = function (m) {
      drill.setAttribute("data-state", m);
      el.idle.hidden = m !== "idle"; el.play.hidden = m !== "play"; el.end.hidden = m !== "end";
    };
    var finish = function () {
      clearInterval(timer); timer = 0;
      var s = game.state();
      el.clock.textContent = "0:00";
      el.final.textContent = s.score + " pts · " + S.accuracy(s) + "% right";
      el.grade.textContent = S.grade(s) + (s.best > 1 ? " Best streak: " + s.best + "." : "");
      drill.removeAttribute("data-low");
      setMode("end"); paintStats();
      var again = q("[data-drill-again]"); if (again) again.focus({ preventScroll: true });
    };
    var tickClock = function () {
      var left = game.tick(performance.now());
      el.clock.textContent = fmtClock(left);
      if (left <= 10000) drill.setAttribute("data-low", "1");
      if (!game.state().running) finish();
    };
    var begin = function () {
      game = S.createGame({ seed: (Date.now() & 0xffff) + 1 });
      lastShown = {};
      game.start(performance.now());
      el.note.textContent = " "; el.note.removeAttribute("data-ok");
      setMode("play"); paintCard(); paintStats(); tickClock();
      clearInterval(timer); timer = setInterval(tickClock, 250);
      var y = q("[data-drill-yes]"); if (y) y.focus({ preventScroll: true });
    };
    var say = function (v) {
      if (!game || !game.state().running) return;
      var r = game.answer(v, performance.now());
      if (!r) { tickClock(); return; }
      el.note.setAttribute("data-ok", r.correct ? "1" : "0");
      el.note.textContent = (r.correct ? "Right. " : "Missed. ") + r.why;
      paintCard(); paintStats();
    };
    q("[data-drill-start]").addEventListener("click", begin);
    q("[data-drill-again]").addEventListener("click", begin);
    q("[data-drill-yes]").addEventListener("click", function () { say(true); });
    q("[data-drill-no]").addEventListener("click", function () { say(false); });
    document.addEventListener("keydown", function (e) {
      if (!game || !game.state().running || e.metaKey || e.ctrlKey || e.altKey) return;
      var k = e.key.toLowerCase();
      if (k === "y") { e.preventDefault(); say(true); } else if (k === "n") { e.preventDefault(); say(false); }
    });
    document.addEventListener("visibilitychange", function () { if (game && game.state().running) tickClock(); });
  }

  /* ---------- hero field ---------- */
  var canvas = document.getElementById("field");
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext("2d");
    var cs = getComputedStyle(root);
    var inkA = cs.getPropertyValue("--c-9").trim(), inkB = cs.getPropertyValue("--c-5").trim();
    var W = 0, H = 0, dpr = 1, nodes = [], mouse = { x: -9999, y: -9999 }, raf = 0, visible = true;
    var build = function () {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.min(120, Math.round((W * H) / 9000));
      nodes = [];
      for (var i = 0; i < n; i++) {
        var z = Math.random();
        nodes.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .25 * (.4 + z), vy: (Math.random() - .5) * .25 * (.4 + z), z: z });
      }
      draw();
    };
    var LINK = 120;
    var draw = function () {
      ctx.clearRect(0, 0, W, H);
      var i, j, a, b, dx, dy, d;
      for (i = 0; i < nodes.length; i++) {
        a = nodes[i];
        if (!reduce) {
          dx = a.x - mouse.x; dy = a.y - mouse.y; d = dx * dx + dy * dy;
          if (d < 14400 && d > 1) { var f = (1 - d / 14400) * .9; a.x += dx / Math.sqrt(d) * f; a.y += dy / Math.sqrt(d) * f; }
          a.x += a.vx; a.y += a.vy;
          if (a.x < 0 || a.x > W) a.vx *= -1;
          if (a.y < 0 || a.y > H) a.vy *= -1;
        }
        for (j = i + 1; j < nodes.length; j++) {
          b = nodes[j]; dx = a.x - b.x; dy = a.y - b.y; d = dx * dx + dy * dy;
          if (d < LINK * LINK) {
            ctx.globalAlpha = (1 - Math.sqrt(d) / LINK) * .35 * (.4 + (a.z + b.z) / 2);
            ctx.strokeStyle = inkB; ctx.lineWidth = .8;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        ctx.globalAlpha = .35 + a.z * .65;
        ctx.fillStyle = inkA;
        var s = 1 + a.z * 2.2;
        ctx.fillRect(a.x - s / 2, a.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    };
    var loop = function () { draw(); raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0; };
    var kick = function () { if (!reduce && !raf && visible && !document.hidden) raf = requestAnimationFrame(loop); };
    build();
    if (!reduce) {
      window.addEventListener("pointermove", function (e) {
        var r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
      }, { passive: true });
      document.addEventListener("visibilitychange", kick);
      if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; kick(); }).observe(canvas);
      kick();
    }
    var rt = 0;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(build, 150); }, { passive: true });
  }
})();
