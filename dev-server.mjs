// Servidor local que imita a Vercel: sirve los archivos estáticos y corre las funciones de /api.
// Uso: npm run dev  →  http://localhost:4321   (las claves van en .env.local, ver .env.example)
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || process.argv[2] || 4321);
const ENV_FILE = join(ROOT, ".env.local");

// .env.local → process.env (antes de importar las funciones)
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};
const PRIVADO = /^\/(api\/_lib|\.|node_modules|dev-server)/;

async function api(req, res, nombre) {
  const file = join(ROOT, "api", nombre + ".js");
  if (!/^[a-z-]+$/.test(nombre) || !existsSync(file)) { res.writeHead(404).end("Not found"); return; }
  const mod = await import(pathToFileURL(file).href);
  const handler = mod[req.method];
  if (!handler) { res.writeHead(405).end("Method not allowed"); return; }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const request = new Request(new URL(req.url, `http://localhost:${PORT}`), {
    method: req.method,
    headers: req.headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
  });
  const r = await handler(request);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}

async function estatico(res, path) {
  if (path.endsWith("/")) path += "index.html";
  const file = normalize(join(ROOT, decodeURIComponent(path)));
  if (!file.startsWith(ROOT) || PRIVADO.test(path)) { res.writeHead(404).end("Not found"); return; }
  try {
    if (!(await stat(file)).isFile()) throw 0;
    res.writeHead(200, { "Content-Type": MIME[extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end("Not found");
  }
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://x");
  try {
    const m = /^\/api\/([^/]+)\/?$/.exec(pathname);
    if (m) await api(req, res, m[1]);
    else await estatico(res, pathname);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500);
    res.end("Error");
  }
}).listen(PORT, () => console.log(`La Finquita → http://localhost:${PORT}`));
