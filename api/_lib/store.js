// Base de datos: Redis de Upstash (gratis, se conecta desde Vercel → Storage).
// Sin variables de Upstash y fuera de Vercel usa un JSON local (.data/dev-db.json) para desarrollo.
import { mkdir, readFile, writeFile } from "node:fs/promises";

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(...args) {
  if (KV_URL) {
    const r = await fetch(KV_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      body: JSON.stringify(args),
    });
    const j = await r.json();
    if (j.error) throw new Error("Redis: " + j.error);
    return j.result;
  }
  if (process.env.VERCEL) throw new Error("Falta conectar la base de datos (Upstash Redis) en Vercel");
  return local(args);
}

// --- Fallback local: sólo los comandos que usamos ---
const DEV_FILE = new URL("../../.data/dev-db.json", import.meta.url);
let mem = null;
let cola = Promise.resolve();

function local(args) {
  const run = async () => {
    if (!mem) mem = JSON.parse(await readFile(DEV_FILE, "utf8").catch(() => "{}"));
    const [cmd, key, ...rest] = args;
    let out;
    switch (cmd) {
      case "GET": out = mem[key] ?? null; break;
      case "SET":
        if (rest.includes("NX") && key in mem) { out = null; break; }
        mem[key] = rest[0]; out = "OK"; break;
      case "INCRBY": mem[key] = String(Number(mem[key] || 0) + Number(rest[0])); out = Number(mem[key]); break;
      case "RPUSH": mem[key] = [...(mem[key] || []), ...rest]; out = mem[key].length; break;
      case "LRANGE": out = mem[key] || []; break;
      default: throw new Error("Comando no soportado en modo local: " + cmd);
    }
    await mkdir(new URL(".", DEV_FILE), { recursive: true });
    await writeFile(DEV_FILE, JSON.stringify(mem, null, 2));
    return out;
  };
  return (cola = cola.then(run, run));
}

export async function getJSON(key) {
  const v = await redis("GET", key);
  return v ? JSON.parse(v) : null;
}
export const setJSON = (key, val) => redis("SET", key, JSON.stringify(val));
// true si la clave no existía (sirve como "candado" para hacer algo una sola vez)
export const setNX = async (key, val) => (await redis("SET", key, String(val), "NX")) === "OK";
export const incrBy = async (key, n) => Number(await redis("INCRBY", key, n));
export const get = (key) => redis("GET", key);
export const getNum = async (key) => Number((await redis("GET", key)) || 0);
export const push = (key, val) => redis("RPUSH", key, val);
export const list = (key) => redis("LRANGE", key, 0, -1);
