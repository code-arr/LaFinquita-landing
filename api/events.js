// GET /api/events → fechas a la venta para extranjeros, con precio, disponibilidad y países
import { MONEDA, MAX_POR_COMPRA, PAISES, eventos } from "./_lib/config.js";
import { disponibles } from "./_lib/orders.js";
import { paypalConfigurado } from "./_lib/paypal.js";
import { json, error } from "./_lib/http.js";

export async function GET() {
  try {
    const abiertos = eventos().filter((e) => e.abierto);
    const lista = await Promise.all(abiertos.map(async (e) => ({
      fecha: e.fecha, titulo: e.titulo, precio: e.precio, disponibles: await disponibles(e),
    })));
    // Si PayPal todavía no está configurado, sólo se ofrecen los países de dLocal Go
    const paises = Object.entries(PAISES)
      .filter(([, p]) => p.metodo !== "paypal" || paypalConfigurado())
      .map(([codigo, p]) => ({ codigo, nombre: p.nombre, metodo: p.metodo }));
    return json({ moneda: MONEDA, max: MAX_POR_COMPRA, eventos: lista, paises });
  } catch (e) {
    console.error(e);
    return error("Server error", 500);
  }
}
