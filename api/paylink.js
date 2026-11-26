// POST /api/paylink (header x-pin) → la encargada crea un link de pago con precio personalizado
import { crearLinkPago, ErrorUsuario } from "./_lib/orders.js";
import { json, error, origen, pinValido } from "./_lib/http.js";

export async function POST(request) {
  if (!pinValido(request.headers.get("x-pin"), process.env.ADMIN_PIN)) return error("PIN incorrecto", 401);
  try {
    const datos = await request.json().catch(() => ({}));
    const { id, pagar } = await crearLinkPago(datos, origen(request));
    return json({ id, pagar });
  } catch (e) {
    if (e instanceof ErrorUsuario) return error(e.message, 400);
    console.error(e);
    return error("No se pudo crear el link de pago. Probá de nuevo.", 502);
  }
}
