// GET /api/admin (header x-pin) → ventas por fecha para admin.html
import { eventos } from "./_lib/config.js";
import { ordenesDe } from "./_lib/orders.js";
import { get } from "./_lib/store.js";
import { json, error, pinValido } from "./_lib/http.js";

export async function GET(request) {
  if (!pinValido(request.headers.get("x-pin"), process.env.ADMIN_PIN)) return error("PIN incorrecto", 401);
  try {
    const fechas = await Promise.all(eventos().map(async (ev) => {
      const ordenes = await ordenesDe(ev.fecha);
      const pagadas = ordenes.filter((o) => o.estado === "PAGADA");
      const conIngreso = await Promise.all(pagadas.map(async (o) => ({ ...o, ingreso: await get(`usada:${o.id}`) })));
      return {
        ...ev,
        vendidas: pagadas.reduce((n, o) => n + o.cantidad, 0),
        total: pagadas.reduce((n, o) => n + o.monto, 0),
        pendientes: ordenes.filter((o) => o.estado === "PENDIENTE").length,
        ordenes: conIngreso,
      };
    }));
    return json({ comisionPct: Number(process.env.COMISION_PCT || 0), fechas });
  } catch (e) {
    console.error(e);
    return error("Error del servidor", 500);
  }
}
