import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..");
const SRC = path.join(ROOT, "src");

export const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const STATES = ["stated", "absent", "unconfirmed"];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function loadRegister(file) {
  const reg = JSON.parse(fs.readFileSync(file, "utf8"));
  const r = reg.records;
  for (const k of ["chain", "rpc", "ca", "x", "github"]) {
    if (!r[k]) throw new Error(`register: missing record ${k}`);
    if (!STATES.includes(r[k].state)) throw new Error(`register: ${k} has bad state ${r[k].state}`);
    if (r[k].state === "stated" && !r[k].value) throw new Error(`register: ${k} is stated without a value`);
    if (r[k].state !== "stated" && r[k].value) throw new Error(`register: ${k} has a value while ${r[k].state}`);
  }
  if (r.ca.state === "stated" && !BASE58.test(r.ca.value)) throw new Error("register: ca is not 32-44 base58 characters");
  if (r.rpc.state === "stated" && !/^https:\/\/[^\s"'<>]+$/.test(r.rpc.value)) throw new Error("register: rpc must be an https URL");
  for (const k of ["x", "github"]) {
    if (r[k].state === "stated") {
      let u;
      try { u = new URL(r[k].value); } catch { throw new Error(`register: ${k} is not a URL`); }
      if (u.protocol !== "https:") throw new Error(`register: ${k} must be https`);
    }
  }
  return reg;
}

/* Store URL, derive handle. */
export function handleOf(url) {
  try { return new URL(url).pathname.split("/").filter(Boolean)[0] || ""; } catch { return ""; }
}

const ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
const ICON_GH = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>';

function social(rec, name, icon, at) {
  if (rec.state === "stated") {
    const h = handleOf(rec.value);
    const label = h ? `${name}, ${at}${h}` : name;
    return `<a class="soc" data-soc="${name.toLowerCase()}" data-state="stated" href="${esc(rec.value)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(label)}">${icon}</a>`;
  }
  return `<span class="soc is-inert" data-soc="${name.toLowerCase()}" data-state="${rec.state}" role="img" aria-disabled="true" aria-label="${name}, link not published yet">${icon}</span>`;
}

function caBlock(rec) {
  if (rec.state === "stated") {
    return `<div class="ca" id="ca" data-state="stated"><span class="ca-k">Contract</span><button class="ca-v" type="button" data-copy="${esc(rec.value)}" aria-label="Copy contract address ${esc(rec.value)}">${esc(rec.value)}</button><button class="ca-btn" type="button" data-copy="${esc(rec.value)}">Copy</button></div>`;
  }
  return `<div class="ca is-off" id="ca" data-state="${rec.state}"><span class="ca-k">Contract</span><span class="ca-v" aria-disabled="true">Address not announced yet</span><button class="ca-btn" type="button" disabled aria-disabled="true">Copy</button></div>`;
}

function tiles(r) {
  const t = (k, v, pending) => `<div class="itile" data-tile="${k.toLowerCase()}"><span class="itile-k">${k}</span><span class="itile-v${pending ? " is-pending" : ""}">${v}</span></div>`;
  return [
    t("Chain", esc(r.chain.value.replace(/mainnet/i, "main network"))),
    r.ca.state === "stated" ? t("Contract", esc(r.ca.value)) : t("Contract", "Not announced yet", true),
    t("RPC", esc(new URL(r.rpc.value).host))
  ].join("");
}

export function cspFor(rpcOrigin) {
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: https://cdn.dexscreener.com https://dd.dexscreener.com",
    `connect-src 'self' ${rpcOrigin} https://api.llama.fi https://api.dexscreener.com`,
    "font-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'"
  ].join("; ");
}

export function build({ registerPath = path.join(SRC, "register.json"), outDir = path.join(ROOT, "dist") } = {}) {
  const reg = loadRegister(registerPath);
  const r = reg.records;
  const tokens = fs.readFileSync(path.join(SRC, "tokens.css"), "utf8");
  const tokenMap = {};
  for (const m of tokens.matchAll(/--([\w-]+):\s*(oklch\([^)]*\))\s*;/g)) tokenMap[m[1]] = m[2];
  const sub = (s) => s.replace(/\{\{token:([\w-]+)\}\}/g, (_, n) => {
    if (!tokenMap[n]) throw new Error(`unknown token ${n}`);
    return tokenMap[n];
  });

  const rpcOrigin = new URL(r.rpc.value).origin;
  const csp = cspFor(rpcOrigin);

  let html = sub(fs.readFileSync(path.join(SRC, "index.html"), "utf8"));
  html = html
    .replace("{{csp}}", esc(csp))
    .replace("{{rpc}}", esc(r.rpc.value))
    .replace("{{rpc_host}}", esc(new URL(r.rpc.value).host))
    .replace("{{socials}}", social(r.x, "X", ICON_X, "@") + social(r.github, "GitHub", ICON_GH, ""))
    .replace("{{ca}}", caBlock(r.ca))
    .replace("{{tiles}}", tiles(r));
  if (/\{\{/.test(html)) throw new Error("unresolved placeholder in html");

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  fs.writeFileSync(path.join(outDir, "app.css"), tokens + "\n" + fs.readFileSync(path.join(SRC, "styles.css"), "utf8"));
  fs.copyFileSync(path.join(SRC, "live.js"), path.join(outDir, "live.js"));
  fs.copyFileSync(path.join(SRC, "app.js"), path.join(outDir, "app.js"));
  fs.copyFileSync(path.join(SRC, "sim.js"), path.join(outDir, "sim.js"));
  fs.writeFileSync(path.join(outDir, "favicon.svg"), sub(fs.readFileSync(path.join(SRC, "favicon.svg"), "utf8")));
  fs.copyFileSync(path.join(SRC, "robots.txt"), path.join(outDir, "robots.txt"));
  fs.writeFileSync(path.join(outDir, "_headers"), [
    "/*",
    `  Content-Security-Policy: ${csp}; frame-ancestors 'none'`,
    "  X-Content-Type-Options: nosniff",
    "  X-Frame-Options: DENY",
    "  Referrer-Policy: strict-origin-when-cross-origin",
    "  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()",
    "  Strict-Transport-Security: max-age=31536000; includeSubDomains",
    "",
    "/*.js",
    "  Cache-Control: public, max-age=3600",
    ""
  ].join("\n"));
  return { outDir, csp };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { outDir } = build();
  console.log(`built -> ${path.relative(ROOT, outDir)}`);
}
