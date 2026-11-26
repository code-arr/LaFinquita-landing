// GET /api/order?id=FQ... → estado de la orden para la página del ticket (con el QR si está paga)
import { sincronizar, codigoQR } from "./_lib/orders.js";
import { json, error, origen } from "./_lib/http.js";

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id") || "";
  if (!/^FQ[\w-]{6,20}$/.test(id)) return error("Order not found", 404);
  try {
    // cancel=1: el comprador volvió desde "Cancelar" en PayPal → liberamos el cupo
    const o = await sincronizar(id, origen(request), { cancelado: params.get("cancel") === "1" });
    if (!o) return error("Order not found", 404);
    return json({
      id: o.id, estado: o.estado, fecha: o.fecha, titulo: o.titulo,
      cantidad: o.cantidad, nombre: o.nombre, monto: o.monto, moneda: o.moneda,
      qr: o.estado === "PAGADA" ? codigoQR(o.id) : null,
    });
  } catch (e) {
    console.error(e);
    return error("Server error", 500);
  }
}
