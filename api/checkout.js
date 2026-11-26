// POST /api/checkout → crea la orden y devuelve el link de pago de dLocal Go
import { crearOrden, ErrorUsuario } from "./_lib/orders.js";
import { json, error, origen } from "./_lib/http.js";

export async function POST(request) {
  try {
    const datos = await request.json().catch(() => ({}));
    const { id, redirect } = await crearOrden(datos, origen(request));
    return json({ id, redirect });
  } catch (e) {
    if (e instanceof ErrorUsuario) return error(e.message, 400);
    console.error(e);
    return error("We couldn't start the payment. Please try again in a few minutes.", 502);
  }
}
