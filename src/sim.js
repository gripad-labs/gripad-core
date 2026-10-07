/* Rule-drill logic: synthetic transfers, one verdict each. Pure, no DOM, no network. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GripadSim = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DURATION_MS = 90000;
  var CEILING = 5;          /* percent of supply */
  var COOLDOWN = 60;        /* seconds */
  var SLOT_GAP = 4;         /* slots */
  var ROSTER = ["Alder", "Cedar", "Maple"];
  var OUTSIDE = ["Birch", "Willow", "Spruce"];

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function int(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
  function pick(r, list) { return list[int(r, 0, list.length - 1)]; }
  function slots(n) { return n + (n === 1 ? " slot" : " slots"); }
  function tenth(n) { return Math.round(n * 10) / 10; }

  /* Ground truth for each rule. The cards are generated from these, and the gates test them directly. */
  var verdict = {
    ceiling: function (held, buy) { return tenth(held + buy) <= CEILING; },
    cooldown: function (elapsed) { return elapsed >= COOLDOWN; },
    venue: function (pool) { return ROSTER.indexOf(pool) !== -1; },
    spacing: function (gap) { return gap >= SLOT_GAP; }
  };

  var KINDS = ["ceiling", "cooldown", "venue", "spacing"];
  var RULE_TEXT = {
    ceiling: "Ceiling rule: no wallet may end a buy holding more than " + CEILING + "% of supply.",
    cooldown: "Cooldown rule: a wallet must wait " + COOLDOWN + " seconds between two sales.",
    venue: "Roster rule: the token may only move through " + ROSTER.join(", ") + ".",
    spacing: "Spacing rule: a wallet needs " + SLOT_GAP + " slots between two trades."
  };

  /* Draw the wanted verdict first, then build numbers that sit close to the line either way. */
  function card(r, kind, lands) {
    var held, buy, total, elapsed, pool, gap;
    if (kind === "ceiling") {
      held = tenth(int(r, 5, 40) / 10);
      if (lands) { buy = tenth(Math.max(0.1, CEILING - held - int(r, 0, 8) / 10)); }
      else { buy = tenth(CEILING - held + int(r, 1, 12) / 10); }
      total = tenth(held + buy);
      return { kind: kind, lands: verdict.ceiling(held, buy), prompt: "A wallet holds " + held.toFixed(1) + "% and buys " + buy.toFixed(1) + "% more.", why: "It would end at " + total.toFixed(1) + "% against a limit of " + CEILING + "%." };
    }
    if (kind === "cooldown") {
      elapsed = lands ? int(r, COOLDOWN, COOLDOWN + 50) : int(r, 4, COOLDOWN - 1);
      return { kind: kind, lands: verdict.cooldown(elapsed), prompt: "A wallet sold " + elapsed + " seconds ago and now sells again.", why: "The lane asks for " + COOLDOWN + " seconds; " + elapsed + " have passed." };
    }
    if (kind === "venue") {
      pool = lands ? pick(r, ROSTER) : pick(r, OUTSIDE);
      return { kind: kind, lands: verdict.venue(pool), prompt: "A swap is routed through the " + pool + " pool.", why: pool + (verdict.venue(pool) ? " is on the roster." : " is not on the roster.") };
    }
    gap = lands ? int(r, SLOT_GAP, SLOT_GAP + 9) : int(r, 0, SLOT_GAP - 1);
    return { kind: kind, lands: verdict.spacing(gap), prompt: "A wallet trades again " + slots(gap) + " after its last trade.", why: "The rule needs " + SLOT_GAP + "; this one left " + gap + "." };
  }

  function deck(seed) {
    var r = rng(seed), n = 0, last = "";
    return function next() {
      var kind = pick(r, KINDS);
      if (kind === last) kind = KINDS[(KINDS.indexOf(kind) + 1) % KINDS.length];
      last = kind;
      var c = card(r, kind, r() < 0.5);
      c.id = ++n;
      c.rule = RULE_TEXT[kind];
      return c;
    };
  }

  /* One 90-second run. The caller passes the clock, so tests can use a fast one. */
  function createGame(opts) {
    opts = opts || {};
    var dur = opts.durationMs || DURATION_MS;
    var next = deck(opts.seed == null ? 1 : opts.seed);
    var s = { running: false, finished: false, startedAt: 0, card: null, score: 0, streak: 0, best: 0, right: 0, wrong: 0, landed: 0, refused: 0, last: null };
    function remaining(now) { return Math.max(0, dur - (now - s.startedAt)); }
    function finishIfDue(now) {
      if (s.running && remaining(now) <= 0) { s.running = false; s.finished = true; s.card = null; }
    }
    return {
      start: function (now) {
        s.running = true; s.finished = false; s.startedAt = now;
        s.score = s.streak = s.best = s.right = s.wrong = s.landed = s.refused = 0; s.last = null;
        s.card = next();
        return s.card;
      },
      /* said: true for YES (lands), false for NO (refused). */
      answer: function (said, now) {
        finishIfDue(now);
        if (!s.running || !s.card) return null;
        var c = s.card, good = said === c.lands;
        if (c.lands) s.landed++; else s.refused++;
        if (good) { s.right++; s.streak++; s.best = Math.max(s.best, s.streak); s.score += 10 + Math.min(10, (s.streak - 1) * 2); }
        else { s.wrong++; s.streak = 0; }
        s.last = { correct: good, why: c.why, lands: c.lands };
        s.card = next();
        return s.last;
      },
      tick: function (now) { finishIfDue(now); return remaining(now); },
      remaining: remaining,
      state: function () { return s; },
      duration: dur
    };
  }

  function accuracy(s) { var n = s.right + s.wrong; return n ? Math.round((s.right / n) * 100) : 0; }

  function grade(s) {
    var n = s.right + s.wrong, a = accuracy(s);
    if (n < 5) return "Warm-up round. Run it again and go quicker.";
    if (a >= 90) return "Hook-grade reading. Few transfers would slip past you.";
    if (a >= 70) return "Solid grip. A few edge cases got through.";
    return "Slippery. Re-read the rule banner before each call.";
  }

  return { DURATION_MS: DURATION_MS, CEILING: CEILING, COOLDOWN: COOLDOWN, SLOT_GAP: SLOT_GAP, ROSTER: ROSTER, KINDS: KINDS, verdict: verdict, rng: rng, deck: deck, createGame: createGame, accuracy: accuracy, grade: grade };
});
