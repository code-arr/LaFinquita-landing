// POST /api/webhook → dLocal Go avisa que cambió el estado de un pago: { "payment_id": "DP-..." }
import { firmaValida, getPayment } from "./_lib/dlocalgo.js";
import { sincronizar } from "./_lib/orders.js";
import { json, origen } from "./_lib/http.js";

export async function POST(request) {
  const raw = await request.text();
  // El estado siempre se vuelve a consultar a la API de dLocal Go, así que una notificación
  // falsa no puede marcar nada como pagado. Igual dejamos registro si la firma no coincide.
  if (!firmaValida(raw, request.headers.get("authorization"))) console.warn("Webhook con firma inválida:", raw);

  try {
    const { payment_id } = JSON.parse(raw);
    const pago = await getPayment(payment_id);
    if (pago.order_id) await sincronizar(pago.order_id, origen(request));
    return json({ ok: true });
  } catch (e) {
    console.error("Webhook:", e);
    return json({ ok: false }, 500); // dLocal Go reintenta cada 10 minutos
  }
}
