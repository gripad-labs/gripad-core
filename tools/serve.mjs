import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./build.mjs";

const dist = path.join(ROOT, "dist");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".txt": "text/plain" };
const port = Number(process.env.PORT) || 4173;

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(dist, path.normalize(p));
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  const headers = { "content-type": types[path.extname(f)] || "application/octet-stream" };
  const h = fs.readFileSync(path.join(dist, "_headers"), "utf8").match(/Content-Security-Policy: (.*)/);
  if (h) headers["content-security-policy"] = h[1];
  res.writeHead(200, headers);
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log(`http://localhost:${port}`));
