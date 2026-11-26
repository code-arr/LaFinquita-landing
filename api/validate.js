// POST /api/validate { pin, codigo } → valida el QR en la puerta (lo usa validar.html)
import { validar } from "./_lib/orders.js";
import { json, error, pinValido } from "./_lib/http.js";

export async function POST(request) {
  const { pin, codigo } = await request.json().catch(() => ({}));
  if (!pinValido(pin, process.env.STAFF_PIN)) return error("PIN incorrecto", 401);
  if (!codigo) return json({ ok: true, soloPin: true }); // usado para chequear el PIN al entrar
  try {
    return json(await validar(codigo));
  } catch (e) {
    console.error(e);
    return error("Error del servidor", 500);
  }
}
