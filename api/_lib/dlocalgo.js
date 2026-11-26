// Cliente mínimo de dLocal Go — https://docs.dlocalgo.com/integration-api
import { createHmac, timingSafeEqual } from "node:crypto";

const API_KEY = process.env.DLOCALGO_API_KEY || "";
const SECRET_KEY = process.env.DLOCALGO_SECRET_KEY || "";
const BASE = process.env.DLOCALGO_BASE_URL // sólo para pruebas con un servidor simulado
  || (process.env.DLOCALGO_ENV === "production" ? "https://api.dlocalgo.com" : "https://api-sbx.dlocalgo.com");

async function call(method, path, body) {
  if (!API_KEY || !SECRET_KEY) throw new Error("Faltan DLOCALGO_API_KEY / DLOCALGO_SECRET_KEY");
  const r = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}:${SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`dLocal Go ${r.status}: ${JSON.stringify(data)}`);
  return data;
}

export const createPayment = (body) => call("POST", "/v1/payments", body);
export const getPayment = (id) => call("GET", "/v1/payments/" + encodeURIComponent(id));

// Header: "V2-HMAC-SHA256, Signature: <hex>"  →  HMAC-SHA256(ApiKey + body, SecretKey)
export function firmaValida(rawBody, header) {
  const m = /Signature:\s*([0-9a-f]+)/i.exec(header || "");
  if (!m) return false;
  const esperada = createHmac("sha256", SECRET_KEY).update(API_KEY + rawBody).digest();
  const recibida = Buffer.from(m[1], "hex");
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}
