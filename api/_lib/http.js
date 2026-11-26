import { timingSafeEqual } from "node:crypto";

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const error = (msg, status = 400) => json({ error: msg }, status);

// URL pública del sitio (para success_url / notification_url de dLocal Go)
export const origen = (request) => (process.env.SITE_URL || new URL(request.url).origin).replace(/\/$/, "");

export function pinValido(recibido, esperado) {
  if (!esperado || !recibido) return false;
  const a = Buffer.from(String(recibido)), b = Buffer.from(String(esperado));
  return a.length === b.length && timingSafeEqual(a, b);
}

export const escapeHTML = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
