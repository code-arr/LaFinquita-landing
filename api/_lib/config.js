/* =============================================================
   🌎  VENTA PARA EXTRANJEROS (dLocal Go) — configuración
   Las fechas tienen que coincidir con la lista EVENTOS de index.html.
   Cada fecha puede pisar el precio o el cupo por defecto:
     "2027-01-01": { precio: 60, cupo: 20 }
   Si una fecha no está acá, NO se vende por este canal (sólo por Venti).
============================================================= */

export const MONEDA = "USD";          // dLocal Go lo convierte a ARS en el checkout
export const PRECIO_DEFAULT = 25;     // USD · Sunset normal (incluye margen por comisión de PayPal)
export const COMIDA_EXTRA = 10;       // USD que se suma por la opción "Sunset + comida" (focaccia)
export const CUPO_DEFAULT = 30;       // entradas reservadas para extranjeros por fecha
export const MAX_POR_COMPRA = 6;
export const ZONA_HORARIA = "America/Argentina/Mendoza";

// País del comprador → medio de pago.
// Cobramos TODO por PayPal (desde cualquier país). dLocal quedó desactivado.
export const PAISES = {
  BR: { nombre: "Brazil", metodo: "paypal" },
  CL: { nombre: "Chile", metodo: "paypal" },
  UY: { nombre: "Uruguay", metodo: "paypal" },
  PY: { nombre: "Paraguay", metodo: "paypal" },
  BO: { nombre: "Bolivia", metodo: "paypal" },
  PE: { nombre: "Peru", metodo: "paypal" },
  CO: { nombre: "Colombia", metodo: "paypal" },
  EC: { nombre: "Ecuador", metodo: "paypal" },
  MX: { nombre: "Mexico", metodo: "paypal" },
  CR: { nombre: "Costa Rica", metodo: "paypal" },
  GT: { nombre: "Guatemala", metodo: "paypal" },
  PA: { nombre: "Panama", metodo: "paypal" },
  US: { nombre: "United States", metodo: "paypal" },
  CA: { nombre: "Canada", metodo: "paypal" },
  GB: { nombre: "United Kingdom", metodo: "paypal" },
  ES: { nombre: "Spain", metodo: "paypal" },
  FR: { nombre: "France", metodo: "paypal" },
  DE: { nombre: "Germany", metodo: "paypal" },
  IT: { nombre: "Italy", metodo: "paypal" },
  NL: { nombre: "Netherlands", metodo: "paypal" },
  AU: { nombre: "Australia", metodo: "paypal" },
  OTRO: { nombre: "Other country", metodo: "paypal" },
};

export const FECHAS = {
  "2026-10-31": {},
  "2026-11-07": {},
  "2026-11-14": {},
  "2026-11-21": { precio: 35 }, // Edición Especial
  "2026-11-22": { precio: 35 }, // Edición Especial
  "2026-11-28": {},
  "2026-12-05": { precio: 35 }, // Edición Especial
  "2026-12-06": { precio: 35 }, // Edición Especial
  "2026-12-07": { precio: 35 }, // Edición Especial
  "2026-12-12": {},
  "2026-12-19": {},
  "2026-12-26": {},
  "2027-01-01": { titulo: "New Year's Eve at La Finquita", precio: 50, comidaExtra: 30, labelBase: "New Year's Eve", comidaNombre: "dinner" }, // fiesta 50 · fiesta + cena 80
  "2027-01-09": {},
  "2027-01-16": {},
  "2027-01-23": {},
  "2027-01-30": {},
  "2027-02-06": { precio: 35 }, // Edición Especial
  "2027-02-07": { precio: 35 }, // Edición Especial
  "2027-02-08": { precio: 35 }, // Edición Especial
  "2027-02-13": {},
  "2027-02-20": {},
  "2027-02-27": {},
  "2027-03-06": {},
  "2027-03-13": {},
  "2027-03-20": {},
  "2027-03-25": { precio: 35 }, // Edición Especial
  "2027-03-26": {},
  "2027-04-02": { precio: 35 }, // Edición Especial
  "2027-04-03": {},
  "2027-04-10": {},
  "2027-04-17": {},
  "2027-04-24": {},
  "2027-05-01": { precio: 35 }, // Edición Especial
};

// Hoy en Mendoza como "YYYY-MM-DD" (se vende hasta el mismo día del evento)
export function hoy() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(new Date());
}

export function evento(fecha) {
  const cfg = FECHAS[fecha];
  if (!cfg) return null;
  return {
    fecha,
    titulo: cfg.titulo || "La Finquita Sunset",
    precio: cfg.precio ?? PRECIO_DEFAULT,
    cupo: cfg.cupo ?? CUPO_DEFAULT,
    comida: cfg.comida !== false,               // true salvo que la fecha lo desactive
    comidaExtra: cfg.comidaExtra ?? COMIDA_EXTRA, // cuánto suma la opción con comida (Año Nuevo: 30)
    labelBase: cfg.labelBase || "Sunset",        // nombre de la entrada base
    comidaNombre: cfg.comidaNombre || "food (focaccia)", // qué incluye la opción con comida
    abierto: fecha >= hoy(),
  };
}

export function eventos() {
  return Object.keys(FECHAS).sort().map(evento);
}
