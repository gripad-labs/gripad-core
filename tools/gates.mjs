import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { build, ROOT, BASE58, handleOf } from "./build.mjs";

const sandbox = { self: {}, URL };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "src", "live.js"), "utf8"), sandbox);
const Live = sandbox.self.GripadLive;
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");
const REG = path.join(SRC, "register.json");
const read = (f) => fs.readFileSync(f, "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gripad-gates-"));

/* Synthetic fixtures only. */
const FX = {
  ca44: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  ca32: "So11111111111111111111111111111112",
  ones32: "1".repeat(32),
  x: "https://x.com/gripadfixture",
  gh: "https://github.com/gripadfixture/site"
};

const gates = [];
const gate = (name, fn) => gates.push({ name, fn });
const ok = (c, msg) => { if (!c) throw new Error(msg || "assertion failed"); };

function mutantRegister(mutate, name) {
  const reg = JSON.parse(read(REG));
  mutate(reg.records);
  const file = path.join(tmp, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(reg));
  return file;
}
function buildTo(registerPath, name) {
  const outDir = path.join(tmp, name);
  build({ registerPath, outDir });
  return { dir: outDir, html: read(path.join(outDir, "index.html")) };
}
const flipTarget = { ca: FX.ca44, x: FX.x, github: FX.gh };
const visibleText = (html) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&rarr;/g, " ").replace(/\s+/g, " ");
const grams = (t) => { const w = t.toLowerCase().match(/[a-z0-9]+/g) || []; const s = new Set(); for (let i = 0; i < w.length - 1; i++) s.add(w[i] + " " + w[i + 1]); return s; };

const real = build({});
const html = read(path.join(DIST, "index.html"));
const css = read(path.join(DIST, "app.css"));
const appJs = read(path.join(SRC, "app.js"));
const reg = JSON.parse(read(REG)).records;

/* ---- register + structure ---- */
gate("register: five records, valid states, values only when stated", () => {
  for (const k of ["chain", "rpc", "ca", "x", "github"]) {
    ok(reg[k], k);
    ok(["stated", "absent", "unconfirmed"].includes(reg[k].state), k + " state");
    ok((reg[k].state === "stated") === Boolean(reg[k].value), k + " value/state mismatch");
  }
});
gate("dist: deploy files present", () => {
  for (const f of ["index.html", "app.css", "app.js", "live.js", "sim.js", "favicon.svg", "_headers", "robots.txt"]) ok(fs.existsSync(path.join(DIST, f)), f);
});
gate("repo: supporting docs present, no assistant files or attribution", () => {
  for (const f of ["README.md", "docs/whitepaper.md", "docs/tokenomics.md", "docs/roadmap.md", "docs/architecture.md", ".github/CONTRIBUTING.md", ".github/SECURITY.md", "LICENSE"]) ok(fs.existsSync(path.join(ROOT, f)), f);
  ok(!fs.existsSync(path.join(ROOT, "CLAUDE.md")) && !fs.existsSync(path.join(ROOT, ".claude")), "assistant files present");
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.name === "node_modules" || e.name === "reference" ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  for (const f of walk(ROOT)) {
    if (f.includes(`${path.sep}tools${path.sep}gates.mjs`)) continue;
    const t = read(f);
    ok(!/claude|anthropic|co-authored-by|generated (by|with) ai|ai-generated/i.test(t), "attribution text in " + path.relative(ROOT, f));
  }
});

/* ---- contract slot: both branches ---- */
gate("ca slot sits first in the sticky header and is always in the DOM", () => {
  ok(/<header class="top">[\s\S]*<div class="ca/.test(html), "ca inside header");
  ok(/\.top \{[^}]*position: sticky/.test(css), "header sticky");
  ok(/\.ca-v \{[^}]*font-size: clamp\(14px, 4\.4vw, 26px\)/.test(css), "large clamp font");
});
gate("branch as shipped: current ca state renders matching DOM", () => {
  const st = reg.ca.state;
  if (st === "stated") ok(html.includes(`data-copy="${reg.ca.value}"`) && html.includes(`>${reg.ca.value}</button>`), "stated markup");
  else ok(/class="ca is-off"/.test(html) && /class="ca-btn" type="button" disabled/.test(html) && !/data-copy=/.test(html), "inert markup");
});
gate("mutation: ca flips to the opposite branch (anchor read at runtime)", () => {
  const to = reg.ca.state === "stated" ? "absent" : "stated";
  const f = mutantRegister((r) => { r.ca.state = to; r.ca.value = to === "stated" ? FX.ca44 : null; }, "ca-flip");
  const m = buildTo(f, "ca-flip");
  if (to === "stated") ok(m.html.includes(`data-copy="${FX.ca44}"`) && m.html.includes(`>${FX.ca44}</button>`) && !/class="ca is-off"/.test(m.html), "stated branch");
  else ok(/class="ca is-off"/.test(m.html) && !/data-copy=/.test(m.html), "absent branch");
});
gate("gate warning: 32, 44 and unusual base58 strings are accepted", () => {
  for (const v of [FX.ca32, FX.ca44, FX.ones32, "z".repeat(44), "9".repeat(40)]) {
    ok(BASE58.test(v), "rejected valid " + v);
    const f = mutantRegister((r) => { r.ca.state = "stated"; r.ca.value = v; }, "ca-ok");
    ok(buildTo(f, "ca-ok").html.includes(`data-copy="${v}"`), "build dropped " + v);
  }
});
gate("gate: strings outside 32-44 base58 are refused at build", () => {
  for (const v of ["1".repeat(31), "1".repeat(45), "0".repeat(40), "O" + "1".repeat(39), "l" + "1".repeat(39), "0x" + "a".repeat(40)]) {
    const f = mutantRegister((r) => { r.ca.state = "stated"; r.ca.value = v; }, "ca-bad");
    let threw = false;
    try { buildTo(f, "ca-bad"); } catch { threw = true; }
    ok(threw, "accepted " + v);
  }
});

/* ---- socials ---- */
for (const [key, label, fixture] of [["x", "x", FX.x], ["github", "github", FX.gh]]) {
  gate(`mutation: ${label} icon flips between inert and linked, no href when unstated`, () => {
    const cur = reg[key].state;
    const hrefOf = (h) => (h.match(new RegExp(`<(?:a|span) class="soc[^"]*" data-soc="${label}"[^>]*>`)) || [""])[0];
    const asShipped = hrefOf(html);
    ok(asShipped, "icon missing");
    ok(cur === "stated" ? /href="https:/.test(asShipped) : !/href=/.test(asShipped) && /is-inert/.test(asShipped), "shipped branch");
    const to = cur === "stated" ? "absent" : "stated";
    const f = mutantRegister((r) => { r[key].state = to; r[key].value = to === "stated" ? fixture : null; }, `${label}-flip`);
    const m = hrefOf(buildTo(f, `${label}-flip`).html);
    ok(to === "stated" ? m.includes(`href="${fixture}"`) && m.includes(handleOf(fixture)) : !/href=/.test(m) && /is-inert/.test(m), "flipped branch");
  });
}
gate("socials: top-right of the header row, both icons, never hidden at any breakpoint, 44px", () => {
  const row = html.match(/<div class="top-row">([\s\S]*?)<\/div>\s*<div class="ca/)?.[1] || html.match(/<div class="socials"[\s\S]*?<\/div>/)[0];
  ok(/data-soc="x"/.test(row) && /data-soc="github"/.test(row), "both present");
  ok(html.indexOf('data-soc="github"') < html.indexOf('id="ca"'), "socials before ca");
  const socBlocks = [...css.matchAll(/([^{}]*\.soc[^{}]*)\{([^}]*)\}/g)];
  for (const [, sel, body] of socBlocks) ok(!/display:\s*none/.test(body), "hidden: " + sel.trim());
  ok(/\.socials \{[^}]*flex: none/.test(css) && /\.soc \{[^}]*width: 44px; height: 44px/.test(css), "44px, no shrink");
  ok(!/>\s*(X|GitHub)\s*</.test(html.match(/<div class="socials"[\s\S]*?<\/div>/)[0]), "no text labels");
});
gate("link rule: every external href comes from a stated record", () => {
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
  for (const h of hrefs) {
    ok(h !== "" && h !== "#", "empty href");
    if (/^https?:/.test(h)) ok(Object.values(reg).some((r) => r.state === "stated" && r.value === h), "unregistered " + h);
  }
});
gate("info tiles: only Chain, Contract, RPC", () => {
  const t = [...html.matchAll(/data-tile="(\w+)"/g)].map((m) => m[1]);
  ok(JSON.stringify(t) === JSON.stringify(["chain", "contract", "rpc"]), "tiles " + t);
});

/* ---- csp, palette, favicon, dates, units ---- */
gate("csp: meta + _headers cover every live origin, no inline or eval", () => {
  const meta = html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)[1];
  const hdr = read(path.join(DIST, "_headers"));
  for (const o of ["https://solana-rpc.publicnode.com", "https://api.llama.fi", "https://api.dexscreener.com", "https://cdn.dexscreener.com"]) ok(meta.includes(o) && hdr.includes(o), o);
  ok(!/unsafe-inline|unsafe-eval|\*/.test(meta.replace(/'self'/g, "")), "unsafe source");
  ok(/frame-ancestors 'none'/.test(hdr), "frame-ancestors");
  ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html) && !/<style/.test(html) && !/\sstyle="/.test(html) && !/\son\w+="/.test(html), "inline code or style");
});
gate("palette: tokens are oklch with chroma exactly 0", () => {
  const t = read(path.join(SRC, "tokens.css"));
  const all = [...t.matchAll(/oklch\(([^)]*)\)/g)];
  ok(all.length > 8, "tokens");
  for (const [, body] of all) {
    const p = body.trim().split(/\s+/);
    ok(p.length === 3 && p[1] === "0" && p[2] === "0", "chroma/hue not zero: " + body);
  }
  ok(!/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|\blab\(|\blch\(|oklab\(|color\(/i.test(t.replace(/\/\*[\s\S]*?\*\//g, "")), "non-oklch literal");
  for (const m of t.matchAll(/color-mix\(([^,]*),/g)) ok(/in oklch/.test(m[1]), "color-mix space " + m[1]);
});
gate("palette: no color literals outside tokens.css", () => {
  for (const f of ["styles.css", "app.js", "live.js", "sim.js", "index.html", "favicon.svg"]) {
    const t = read(path.join(SRC, f)).replace(/\{\{token:[\w-]+\}\}/g, "");
    const noAnchors = f === "index.html" ? t.replace(/href="#[^"]*"/g, "") : t;
    ok(!/#[0-9a-fA-F]{3,8}\b/.test(f === "styles.css" || f.endsWith(".js") || f.endsWith(".svg") ? t : noAnchors.replace(/&#\w+;/g, "")), "hex in " + f);
    ok(!/\b(rgba?|hsla?|oklch|oklab|lab|lch)\(/.test(t), "color function in " + f);
    ok(!/:\s*(white|black|gray|grey|red|green|blue|yellow|orange|purple|pink|silver)\b/.test(t), "named color in " + f);
  }
});
gate("favicon: 32x32 svg, achromatic, no comment with double hyphen, linked", () => {
  const s = read(path.join(DIST, "favicon.svg"));
  ok(/viewBox="0 0 32 32"/.test(s) && /width="32"/.test(s) && /height="32"/.test(s), "size");
  for (const m of s.matchAll(/<!--([\s\S]*?)-->/g)) ok(!m[1].includes("--"), "double hyphen in comment");
  ok(!/\{\{/.test(s), "placeholder left");
  for (const m of s.matchAll(/oklch\(([^)]*)\)/g)) ok(/^\S+ 0 0$/.test(m[1].trim()), "chroma " + m[1]);
  ok(html.includes('href="/favicon.svg"'), "link");
});
gate("no dates rendered on the page", () => {
  const t = visibleText(html);
  ok(!/\b(19|20)\d{2}\b/.test(t) && !/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\b\.?\s+\d{1,2}\b/i.test(t) && !/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/.test(t), "date-like text");
  ok(!/2026-\d\d-\d\d/.test(html), "iso date in markup");
});
gate("no ch units anywhere in shipped code", () => {
  for (const f of ["app.css", "app.js", "index.html"]) ok(!/\d(\.\d+)?ch\b/.test(read(path.join(DIST, f))), f);
});

/* ---- originality ---- */
gate("copy: zero shared two-word runs with the reference", () => {
  const refFile = path.join(ROOT, "reference", "ref-copy.txt");
  ok(fs.existsSync(refFile), "reference copy missing");
  const mine = grams(visibleText(html) + " " + (html.match(/<title>([^<]*)/)?.[1] || "") + " " + (html.match(/name="description" content="([^"]*)"/)?.[1] || ""));
  const ref = grams(read(refFile));
  const hits = [...mine].filter((g) => ref.has(g));
  ok(hits.length === 0, "shared: " + hits.join(" | "));
});

/* ---- motion, scroll, targets, skeletons ---- */
gate("motion: reduced-motion honored in css and js; reveals and parallax need no scroll math", () => {
  ok(/@media \(prefers-reduced-motion: reduce\)/.test(css) && /prefers-reduced-motion: reduce/.test(appJs), "reduced motion");
  const m = appJs.match(/addEventListener\("scroll", function \(\) \{([^}]*)\}, \{ passive: true \}\)/);
  ok(m && /^\s*root\.style\.setProperty\("--sy", window\.scrollY\);\s*$/.test(m[1]), "scroll handler must only publish scrollY");
  ok(/IntersectionObserver/.test(appJs) && /var\(--sy/.test(css) && /calc\(var\(--sy/.test(css), "io + css parallax");
  ok(/scaleX\(min\(1, calc\(var\(--sy/.test(css), "progress bar in css");
});
gate("tap targets: interactive classes declare at least 44px", () => {
  for (const sel of [".btn", ".soc", ".menu-btn", ".ca-btn", ".ca-v", ".stab", ".nav-a", ".menu-a", ".brand", ".tile"]) {
    const m = css.match(new RegExp("(?:^|\\n)" + sel.replace(".", "\\.") + " \\{([^}]*)\\}"));
    ok(m && (/min-height:\s*(4[4-9]|[5-9]\d|1\d\d)px/.test(m[1]) || /height:\s*44px/.test(m[1])), sel);
  }
});
gate("skeletons and health pill markup for every live value", () => {
  ok((html.match(/data-live="slot"><span class="skel/g) || []).length >= 2 && /data-live="tvl"><span class="skel/.test(html), "number skeletons");
  ok(/data-pairs/.test(html) && (html.match(/skel-row/g) || []).length >= 4, "pair skeletons");
  ok(/data-health data-state="connecting"/.test(html) && /health\[data-state="offline"\]/.test(css) && /@keyframes ping/.test(css), "health states");
});
gate("live wiring: slot rpc, defillama slug, dexscreener, visibility pause, flash on change", () => {
  ok(/getSlot/.test(appJs) && /api\.llama\.fi\/v2\/chains/.test(appJs) && /api\.dexscreener\.com\/latest\/dex\/search/.test(appJs), "endpoints");
  ok(/visibilitychange/.test(appJs) && /isHidden/.test(appJs) && /classList\.add\("flash"\)/.test(appJs), "pause + flash");
  ok(/data-rpc/.test(html) && html.includes(`data-rpc="${reg.rpc.value}"`), "rpc from register");
});

/* ---- live logic on a fast clock ---- */
gate("backoff: exponential, jittered within bounds, capped", () => {
  for (let f = 0; f < 8; f++) {
    const lo = Live.nextDelay(1000, 30000, f, () => 0), hi = Live.nextDelay(1000, 30000, f, () => 1);
    const cap = Math.min(30000, 1000 * 2 ** f);
    ok(lo === Math.round(cap / 2) && hi === cap, `bounds at ${f}`);
  }
  ok(Live.nextDelay(1000, 30000, 20, () => 1) === 30000, "cap");
});
gate("poller: failure backs off, success resets, hidden tab pauses, visible resumes (fake clock)", async () => {
  let t = 0, id = 0, hidden = false, calls = 0, fail = true;
  const timers = new Map(), delays = [], results = [];
  const p = Live.createPoller({
    base: 100, max: 800, rand: () => 1,
    task: () => { calls++; return fail ? Promise.reject(new Error("x")) : Promise.resolve(calls); },
    onResult: (okk, v, f) => results.push([okk, f]),
    isHidden: () => hidden,
    setTimer: (fn, ms) => { delays.push(ms); timers.set(++id, [t + ms, fn]); return id; },
    clearTimer: (i) => timers.delete(i)
  });
  const tick = async () => { await new Promise((r) => setImmediate(r)); const next = [...timers.entries()].sort((a, b) => a[1][0] - b[1][0])[0]; if (!next) return false; timers.delete(next[0]); t = next[1][0]; next[1][1](); await new Promise((r) => setImmediate(r)); return true; };
  p.start(); await new Promise((r) => setImmediate(r));
  for (let i = 0; i < 4; i++) await tick();
  ok(JSON.stringify(delays.slice(0, 5)) === JSON.stringify([100, 200, 400, 800, 800]), "delays " + delays);
  fail = false; await tick(); await new Promise((r) => setImmediate(r));
  ok(p.state().fails === 0 && delays.at(-1) === 100, "reset " + delays.at(-1));
  hidden = true; await tick();
  const before = calls;
  ok(p.state().paused && !p.state().hasTimer, "paused");
  await new Promise((r) => setImmediate(r));
  ok(calls === before, "ran while hidden");
  hidden = false; p.wake(); await new Promise((r) => setImmediate(r));
  ok(calls === before + 1, "resume");
  p.stop();
});
gate("feeds: parsers, slug match, dash fallback, health states", () => {
  ok(Live.parseSlot({ result: 5 }) === 5, "slot");
  let threw = 0; for (const bad of [{}, { result: -1 }, { result: "9" }]) try { Live.parseSlot(bad); } catch { threw++; }
  ok(threw === 3, "bad slot accepted");
  ok(Live.parseTvl([{ name: "Other", tvl: 1 }, { name: "Solana", tvl: 7e9 }]) === 7e9, "tvl slug");
  ok(Live.slugify("Solana") === "solana", "slug");
  const pairs = Live.parsePairs({ pairs: [
    { chainId: "base", pairAddress: "a", priceUsd: "1", volume: { h24: 9e9 }, baseToken: { symbol: "A" }, quoteToken: { symbol: "B" } },
    { chainId: "solana", pairAddress: "p1", priceUsd: "2", volume: { h24: 10 }, baseToken: { symbol: "AA" }, quoteToken: { symbol: "SOL" }, info: { imageUrl: "https://cdn.dexscreener.com/x.png" } },
    { chainId: "solana", pairAddress: "p1", priceUsd: "2", volume: { h24: 10 }, baseToken: { symbol: "AA" }, quoteToken: { symbol: "SOL" } },
    { chainId: "solana", pairAddress: "p2", priceUsd: "3", volume: { h24: 99 }, baseToken: { symbol: "BB" }, quoteToken: { symbol: "SOL" }, info: { imageUrl: "https://evil.example/x.png" } }
  ] }, 8);
  ok(pairs.length === 2 && pairs[0].id === "p2" && pairs[0].img === "" && pairs[1].img.startsWith("https://cdn.dexscreener.com"), "pairs");
  ok(Live.compactUsd(NaN) === Live.DASH && Live.priceUsd(undefined) === Live.DASH && Live.groupInt(null) === Live.DASH, "dash fallback");
  ok(Live.healthState({ online: true, everOk: false, fails: 0 }) === "connecting" && Live.healthState({ online: true, everOk: true, fails: 0 }) === "live" && Live.healthState({ online: true, everOk: true, fails: 3 }) === "offline" && Live.healthState({ online: false, everOk: true, fails: 0 }) === "offline", "health");
});

/* ---- 90-second drill ---- */
gate("drill: markup, 90s clock, verdict truth table, scoring, expiry on a fast clock", () => {
  for (const a of ["data-drill-start", "data-drill-yes", "data-drill-no", "data-drill-clock", "data-drill-again"]) ok(html.includes(a), a);
  ok(/animation: drain 90s linear/.test(css), "90s drain");
  const sbx = { self: {} };
  vm.runInNewContext(fs.readFileSync(path.join(SRC, "sim.js"), "utf8"), sbx);
  const S = sbx.self.GripadSim;
  ok(S.DURATION_MS === 90000, "duration");
  ok(S.verdict.ceiling(4, 1) && !S.verdict.ceiling(4, 1.1) && S.verdict.cooldown(60) && !S.verdict.cooldown(59) && S.verdict.venue("Alder") && !S.verdict.venue("Birch") && S.verdict.spacing(4) && !S.verdict.spacing(3), "truth table");
  const next = S.deck(7); let yes = 0, no = 0; const kinds = new Set();
  for (let i = 0; i < 400; i++) { const c = next(); c.lands ? yes++ : no++; kinds.add(c.kind); ok(c.prompt && c.rule && c.why, "card text"); }
  ok(yes > 120 && no > 120 && kinds.size === 4, `balance ${yes}/${no}`);
  const g = S.createGame({ seed: 3 });
  let t = 1000; g.start(t);
  const c1 = g.state().card; g.answer(c1.lands, t += 500); g.answer(g.state().card.lands, t += 500);
  ok(g.state().right === 2 && g.state().score === 10 + 12 && g.state().streak === 2, "scoring " + g.state().score);
  g.answer(!g.state().card.lands, t += 500);
  ok(g.state().wrong === 1 && g.state().streak === 0 && g.state().best === 2, "miss resets streak");
  ok(g.tick(t) > 0 && g.state().running, "still running");
  ok(g.tick(1000 + 90000) === 0 && g.state().finished && !g.state().running, "ends at 90s");
  ok(g.answer(true, 1000 + 90001) === null, "no answers after expiry");
  ok(S.accuracy(g.state()) === 67 && /Solid|Hook|Slippery|Warm/.test(S.grade(g.state())), "summary");
});

/* ---- run ---- */
ok(gates.length <= 30, "too many gates: " + gates.length);
let failed = 0;
const t0 = Date.now();
for (const g of gates) {
  try { await g.fn(); console.log("PASS  " + g.name); }
  catch (e) { failed++; console.log("FAIL  " + g.name + "\n      " + e.message); }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${gates.length - failed}/${gates.length} gates passed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(failed ? 1 : 0);
