// Órdenes de entradas para extranjeros: crear → pagar (dLocal Go o PayPal) → emitir QR → validar en puerta.
//
// Claves en la base:
//   orden:<id>      → JSON de la orden
//   ordenes:<fecha> → lista de ids de esa fecha
//   cupo:<fecha>    → entradas tomadas (pagadas + pendientes de pago)
//   pagada:<id> / liberada:<id> / usada:<id> → candados para hacer cada cosa una sola vez
import { createHmac, randomBytes } from "node:crypto";
import { MONEDA, MAX_POR_COMPRA, COMIDA_EXTRA, PAISES, evento } from "./config.js";
import { createPayment, getPayment } from "./dlocalgo.js";
import { crearOrdenPaypal, getOrdenPaypal, capturarPaypal } from "./paypal.js";
import { avisarEncargada } from "./email.js";
import { get, getJSON, setJSON, setNX, incrBy, getNum, push, list } from "./store.js";

const TICKET_SECRET = process.env.TICKET_SECRET || "dev-secret-cambiar";
if (process.env.VERCEL && !process.env.TICKET_SECRET) console.warn("⚠️ Falta TICKET_SECRET");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN = 60 * 1000;
const VENCE_DLOCALGO = 30 * MIN;   // expiration_value que mandamos a dLocal Go
const VENCE_PAYPAL = 3 * 60 * MIN; // PayPal no avisa si el comprador abandona: liberamos a las 3 hs

export class ErrorUsuario extends Error {}

// Contenido del QR: "<id>.<firma>" → no se puede inventar un QR válido sin el secreto
const firma = (id) => createHmac("sha256", TICKET_SECRET).update(id).digest("base64url").slice(0, 16);
export const codigoQR = (id) => `${id}.${firma(id)}`;

export async function disponibles(ev) {
  return Math.max(0, ev.cupo - (await getNum(`cupo:${ev.fecha}`)));
}

export async function crearOrden(datos, origen) {
  const ev = evento(String(datos.fecha || ""));
  if (!ev || !ev.abierto) throw new ErrorUsuario("This date is not available.");

  const cantidad = Number(datos.cantidad);
  // Opción "Sunset + comida": sólo si la fecha la ofrece (Año Nuevo no)
  const comida = Boolean(datos.comida) && ev.comida;
  const precioUnit = ev.precio + (comida ? COMIDA_EXTRA : 0);
  const nombre = String(datos.nombre || "").trim().slice(0, 100);
  const email = String(datos.email || "").trim().toLowerCase().slice(0, 100);
  const documento = String(datos.documento || "").trim().slice(0, 30);
  const paisCodigo = String(datos.pais || "");
  const pais = PAISES[paisCodigo];
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_POR_COMPRA)
    throw new ErrorUsuario(`You can buy between 1 and ${MAX_POR_COMPRA} tickets.`);
  if (!pais) throw new ErrorUsuario("Please select your country.");
  if (nombre.length < 3) throw new ErrorUsuario("Please enter your full name.");
  if (!EMAIL_RE.test(email)) throw new ErrorUsuario("Please enter a valid email.");
  if (documento.length < 4) throw new ErrorUsuario("Please enter your passport or ID number.");

  // Liberamos pagos abandonados antes de mirar el cupo
  await barrerPendientes(ev.fecha, origen);

  // Reservamos el cupo antes de mandar a pagar (se libera si el pago no se completa)
  const tomadas = await incrBy(`cupo:${ev.fecha}`, cantidad);
  if (tomadas > ev.cupo) {
    await incrBy(`cupo:${ev.fecha}`, -cantidad);
    throw new ErrorUsuario("Sorry, there are not enough tickets left for this date.");
  }

  const id = "FQ" + randomBytes(9).toString("base64url");
  const orden = {
    id, fecha: ev.fecha, titulo: ev.titulo, cantidad, nombre, email, documento,
    pais: pais.nombre, paisCodigo, metodo: pais.metodo,
    comida, opcion: comida ? "Sunset + comida" : "Sunset",
    monto: precioUnit * cantidad, moneda: MONEDA,
    estado: "PENDIENTE", creada: new Date().toISOString(),
  };
  await setJSON(`orden:${id}`, orden);
  await push(`ordenes:${ev.fecha}`, id);

  const descripcion = `${ev.titulo} · ${orden.opcion} · ${ev.fecha} x${cantidad}`.slice(0, 100);
  const linkTicket = `${origen}/ticket.html?order=${id}`;
  try {
    let pago;
    if (orden.metodo === "paypal") {
      pago = await crearOrdenPaypal({
        id, monto: orden.monto, moneda: MONEDA, descripcion,
        returnUrl: linkTicket, cancelUrl: linkTicket + "&cancel=1",
      });
    } else {
      pago = await createPayment({
        currency: MONEDA,
        amount: orden.monto,
        // Con el país del comprador el checkout ya pide su documento local (ej. CPF en Brasil)
        country: paisCodigo,
        order_id: id,
        description: descripcion,
        payer: { name: nombre, email },
        success_url: linkTicket,
        back_url: `${origen}/#international`,
        notification_url: `${origen}/api/webhook`,
        expiration_type: "MINUTES",
        expiration_value: VENCE_DLOCALGO / MIN,
      });
    }
    orden.pagoId = pago.id;
    await setJSON(`orden:${id}`, orden);
    return { id, redirect: pago.redirect || pago.redirect_url };
  } catch (e) {
    await liberar(orden, "ERROR");
    throw e;
  }
}

// Link de pago manual (lo crea la encargada desde el panel, con un precio personalizado).
// Reserva cupo en la fecha y devuelve el link de PayPal para enviarle al cliente.
export async function crearLinkPago(datos, origen) {
  const ev = evento(String(datos.fecha || ""));
  if (!ev) throw new ErrorUsuario("Elegí una fecha válida.");
  const cantidad = Number(datos.cantidad) || 1;
  const monto = Math.round(Number(datos.monto) * 100) / 100;
  const nombre = String(datos.nombre || "").trim().slice(0, 100) || "A definir";
  const email = String(datos.email || "").trim().toLowerCase().slice(0, 100);
  const concepto = String(datos.concepto || "").trim().slice(0, 80);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_POR_COMPRA)
    throw new ErrorUsuario(`La cantidad tiene que ser entre 1 y ${MAX_POR_COMPRA}.`);
  if (!(monto > 0)) throw new ErrorUsuario("Ingresá un monto en USD mayor a 0.");

  const tomadas = await incrBy(`cupo:${ev.fecha}`, cantidad);
  if (tomadas > ev.cupo) {
    await incrBy(`cupo:${ev.fecha}`, -cantidad);
    throw new ErrorUsuario("No queda cupo suficiente para esa fecha.");
  }

  const id = "FQ" + randomBytes(9).toString("base64url");
  const orden = {
    id, fecha: ev.fecha, titulo: ev.titulo, cantidad, nombre, email, documento: "",
    pais: "—", paisCodigo: "", metodo: "paypal",
    comida: false, opcion: concepto || "Link de pago", linkManual: true,
    monto, moneda: MONEDA, estado: "PENDIENTE", creada: new Date().toISOString(),
  };
  await setJSON(`orden:${id}`, orden);
  await push(`ordenes:${ev.fecha}`, id);

  const descripcion = (concepto || `${ev.titulo} ${ev.fecha} x${cantidad}`).slice(0, 100);
  const linkTicket = `${origen}/ticket.html?order=${id}`;
  try {
    const pago = await crearOrdenPaypal({
      id, monto, moneda: MONEDA, descripcion,
      returnUrl: linkTicket, cancelUrl: linkTicket + "&cancel=1",
    });
    orden.pagoId = pago.id;
    await setJSON(`orden:${id}`, orden);
    return { id, pagar: pago.redirect };
  } catch (e) {
    await liberar(orden, "ERROR");
    throw e;
  }
}

async function liberar(orden, estado) {
  if (await setNX(`liberada:${orden.id}`, Date.now())) await incrBy(`cupo:${orden.fecha}`, -orden.cantidad);
  orden.estado = estado;
  await setJSON(`orden:${orden.id}`, orden);
}

async function marcarPagada(orden, origen, datosPago) {
  Object.assign(orden, { estado: "PAGADA", ...datosPago });
  await setJSON(`orden:${orden.id}`, orden);
  // Una sola vez por orden: avisamos a la encargada para que cargue la entrada en Venti y la envíe.
  // Al cliente NO le mandamos mail (ve la pantalla de confirmación con WhatsApp).
  if (await setNX(`pagada:${orden.id}`, Date.now())) {
    await avisarEncargada(orden).catch((e) => console.error("Email encargada:", e));
  }
}

// Trae el estado real del pago y actualiza la orden. Lo llaman el webhook de dLocal Go,
// la página del ticket (que es a donde vuelve el comprador) y el barrido de pendientes.
export async function sincronizar(id, origen, { cancelado = false } = {}) {
  const orden = await getJSON(`orden:${id}`);
  if (!orden || !orden.pagoId || orden.estado !== "PENDIENTE") return orden;
  const edad = Date.now() - new Date(orden.creada).getTime();

  if (orden.metodo === "paypal") {
    let o = await getOrdenPaypal(orden.pagoId);
    // El comprador aprobó en PayPal: recién al capturar se cobra
    if (o.status === "APPROVED") {
      try {
        o = await capturarPaypal(orden.pagoId);
      } catch (e) {
        if (!/INSTRUMENT_DECLINED|PAYER_ACTION_REQUIRED/.test(e.message)) throw e;
        await liberar(orden, "RECHAZADA"); // la tarjeta del comprador fue rechazada al cobrar
        return orden;
      }
    }
    if (o.status === "COMPLETED") {
      const cap = o.purchase_units?.[0]?.payments?.captures?.[0];
      if (cap?.status === "COMPLETED") {
        const neto = cap.seller_receivable_breakdown;
        await marcarPagada(orden, origen, {
          pagada: cap.create_time || new Date().toISOString(),
          cobrado: neto && { monto: Number(neto.net_amount?.value), moneda: neto.net_amount?.currency_code, comision: Number(neto.paypal_fee?.value) },
        });
      } else if (cap?.status === "DECLINED") {
        await liberar(orden, "RECHAZADA");
      }
    } else if (o.status === "VOIDED") {
      await liberar(orden, "RECHAZADA");
    } else if (cancelado) {
      await liberar(orden, "CANCELADA");
    } else if (edad > VENCE_PAYPAL) {
      await liberar(orden, "VENCIDA");
    }
    return orden;
  }

  const pago = await getPayment(orden.pagoId);
  if (pago.status === "PAID") {
    await marcarPagada(orden, origen, {
      pagada: pago.approved_date || new Date().toISOString(),
      cobrado: { monto: pago.balance_amount, moneda: pago.balance_currency, comision: pago.balance_fee },
    });
  } else if (["REJECTED", "CANCELLED", "EXPIRED"].includes(pago.status)) {
    await liberar(orden, pago.status === "EXPIRED" ? "VENCIDA" : "RECHAZADA");
  }
  return orden;
}

// Revisa las órdenes pendientes viejas de una fecha (por si nunca volvieron del pago o se perdió un aviso)
async function barrerPendientes(fecha, origen) {
  const viejas = (await ordenesDe(fecha)).filter((o) =>
    o.estado === "PENDIENTE" && Date.now() - new Date(o.creada).getTime() > VENCE_DLOCALGO + 5 * MIN);
  for (const o of viejas) await sincronizar(o.id, origen).catch((e) => console.error("Barrido:", o.id, e.message));
}

// Valida un QR en la puerta. Marca la orden como usada (una sola vez).
export async function validar(codigo) {
  const [id, f] = String(codigo || "").trim().split(".");
  if (!id || !f || f !== firma(id)) return { ok: false, motivo: "QR inválido" };
  const orden = await getJSON(`orden:${id}`);
  if (!orden) return { ok: false, motivo: "Orden inexistente" };
  const datos = { id, nombre: orden.nombre, documento: orden.documento, pais: orden.pais, cantidad: orden.cantidad, fecha: orden.fecha };
  if (orden.estado !== "PAGADA") return { ok: false, motivo: "Orden no pagada (" + orden.estado + ")", ...datos };
  if (!(await setNX(`usada:${id}`, new Date().toISOString())))
    return { ok: false, motivo: "YA INGRESÓ", usada: await get(`usada:${id}`), ...datos };
  return { ok: true, ...datos };
}

export async function ordenesDe(fecha) {
  const ids = await list(`ordenes:${fecha}`);
  const ordenes = await Promise.all(ids.map((id) => getJSON(`orden:${id}`)));
  return ordenes.filter(Boolean);
}
