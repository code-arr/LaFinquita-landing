// Emails con Resend (https://resend.com, plan gratis: 3000/mes).
// Opción B: NO mandamos QR. Al confirmarse el pago:
//   1) al cliente → aviso de que en breve recibe sus entradas
//   2) a la encargada → datos de la compra para cargarla en Venti y enviarle el QR de Venti
// Sin RESEND_API_KEY sólo se loguea (modo desarrollo).
import { escapeHTML } from "./http.js";

// Remitente compartido de Resend: NO requiere dominio verificado.
// (En test, Resend sólo deja enviar a la casilla con la que se creó la cuenta → usar la de la encargada.)
const FROM = process.env.EMAIL_FROM || "La Finquita 1920 <onboarding@resend.dev>";

function fechaLarga(f) {
  return new Date(f + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

async function enviar({ to, subject, html, replyTo }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email simulado] para ${to}: ${subject}`);
    return;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!r.ok) throw new Error("Resend " + r.status + ": " + (await r.text()));
}

// 1) Confirmación al cliente (sin QR: las entradas se envían manualmente)
export async function enviarConfirmacion(orden) {
  const fecha = fechaLarga(orden.fecha);
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
    <h2 style="margin-bottom:4px">Payment confirmed 🎉</h2>
    <p style="color:#555;margin-top:0">${escapeHTML(orden.titulo)} · ${escapeHTML(fecha)} · La Finquita 1920, Maipú, Mendoza</p>
    <p>Hi ${escapeHTML(orden.nombre)}, we received your payment. Thank you!</p>
    <p><b>${orden.cantidad} ${orden.cantidad === 1 ? "ticket" : "tickets"}</b> · Order ${escapeHTML(orden.id)}</p>
    <p><b>You'll receive your entry tickets (with QR) by email shortly</b>, sent to this address. Please keep an eye on your inbox.</p>
    <p style="color:#555;font-size:13px">Bring the passport or ID you used to buy. Gates open at 6 PM.<br>
    Address: Manuel Cruz Videla 450, Cruz de Piedra, Maipú, Mendoza.</p>
    <hr style="border:none;border-top:1px solid #ddd">
    <p style="color:#555;font-size:13px">Recibimos tu pago. En breve te enviamos tus entradas con el QR a este mismo correo.</p>
  </div>`;
  await enviar({
    to: orden.email,
    subject: `Payment confirmed · ${orden.titulo} · ${orden.fecha}`,
    html,
  });
}

// 2) Aviso a la encargada para que cargue la entrada en Venti y se la mande al cliente
export async function avisarEncargada(orden) {
  const destino = process.env.EMAIL_ENCARGADA;
  if (!destino) { console.warn("⚠️ Falta EMAIL_ENCARGADA: no se avisó la venta de", orden.id); return; }
  const fecha = fechaLarga(orden.fecha);
  const fila = (k, v) => `<tr><td style="padding:4px 10px 4px 0;color:#555">${k}</td><td style="padding:4px 0"><b>${v}</b></td></tr>`;
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111">
    <h2 style="margin-bottom:4px">Nueva venta de entradas (extranjeros)</h2>
    <p style="color:#555;margin-top:0">Hay que cargar esta entrada en Venti y enviarle el QR al cliente.</p>
    <table style="border-collapse:collapse;font-size:14px;margin:12px 0">
      ${fila("Evento", escapeHTML(orden.titulo))}
      ${fila("Fecha", escapeHTML(fecha))}
      ${fila("Cantidad", orden.cantidad + (orden.cantidad === 1 ? " entrada" : " entradas"))}
      ${fila("Cliente", escapeHTML(orden.nombre))}
      ${fila("✉️ Email del cliente", `<a href="mailto:${escapeHTML(orden.email)}">${escapeHTML(orden.email)}</a>`)}
      ${fila("Pasaporte / Documento", escapeHTML(orden.documento || "—"))}
      ${fila("País", escapeHTML(orden.pais || "—"))}
      ${fila("Pagó", `${escapeHTML(orden.moneda)} ${orden.monto}`)}
      ${fila("Orden", escapeHTML(orden.id))}
    </table>
    <p style="font-size:14px">👉 Cargá la entrada en <b>Venti</b> y enviale el QR a <b>${escapeHTML(orden.email)}</b>.</p>
  </div>`;
  await enviar({
    to: destino,
    subject: `Nueva venta · ${orden.titulo} · ${orden.fecha} · ${orden.cantidad} entrada(s)`,
    html,
    replyTo: orden.email, // responder le escribe directo al cliente
  });
}
