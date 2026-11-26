// Cliente mínimo de PayPal (Orders API v2) — https://developer.paypal.com/docs/api/orders/v2/
// Para compradores de EE.UU., Europa y el resto del mundo (dLocal Go sólo cobra a Latinoamérica).
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "";
const SECRET = process.env.PAYPAL_CLIENT_SECRET || "";
const BASE = process.env.PAYPAL_BASE_URL // sólo para pruebas con un servidor simulado
  || (process.env.PAYPAL_ENV === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");

export const paypalConfigurado = () => Boolean(CLIENT_ID && SECRET);

let token = null;
async function accessToken() {
  if (token && token.vence > Date.now()) return token.valor;
  const r = await fetch(BASE + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`PayPal auth ${r.status}: ${JSON.stringify(j)}`);
  token = { valor: j.access_token, vence: Date.now() + (j.expires_in - 60) * 1000 };
  return token.valor;
}

async function call(method, path, body, headers = {}) {
  if (!paypalConfigurado()) throw new Error("Faltan PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET");
  const r = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`PayPal ${r.status}: ${JSON.stringify(data)}`);
  return data;
}

export async function crearOrdenPaypal({ id, monto, moneda, descripcion, returnUrl, cancelUrl }) {
  const o = await call("POST", "/v2/checkout/orders", {
    intent: "CAPTURE",
    purchase_units: [{
      reference_id: id,
      custom_id: id,
      description: descripcion,
      amount: { currency_code: moneda, value: monto.toFixed(2) },
    }],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "La Finquita 1920",
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      },
    },
  }, { "PayPal-Request-Id": "crear-" + id });
  const link = (o.links || []).find((l) => l.rel === "payer-action" || l.rel === "approve");
  if (!link) throw new Error("PayPal no devolvió link de pago: " + JSON.stringify(o));
  return { id: o.id, redirect: link.href };
}

export const getOrdenPaypal = (id) => call("GET", "/v2/checkout/orders/" + encodeURIComponent(id));

// Idempotente: si dos pestañas capturan a la vez, PayPal cobra una sola vez
export const capturarPaypal = (id) =>
  call("POST", `/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {}, { "PayPal-Request-Id": "capturar-" + id });
