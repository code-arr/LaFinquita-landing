# La Finquita 1920 — Sitio web

Landing estática de **La Finquita 1920** (bodega de garage · Cruz de Piedra, Maipú, Mendoza).
Es un sitio 100% estático: un solo `index.html` + la carpeta `assets/` (logos y fotos).
No necesita build ni framework.

## Estructura

```
index.html      → toda la página (HTML + CSS + JS en un solo archivo)
assets/         → logos y fotos
```

## Editar contenido

Todo se edita dentro de `index.html`:

- **Link de Venti general:** etiqueta `<meta name="venti-url">` (arriba de todo).
- **Eventos / fechas:** lista `EVENTOS` en el `<script>` del final. Cada objeto es una fecha
  (`titulo`, `fecha:"YYYY-MM-DD"`, `lugar`, `venti`, y opcionales `especial:true`, `cartel:"…"`).
- **Fotos del hero (slideshow):** lista `HERO_FOTOS`.
- **Galería:** el bloque `<div class="gal-grid">`.
- **Contacto / dirección / horarios:** secciones "Ubicación" y footer.

## Deploy en Vercel

Es un sitio estático, así que Vercel lo sirve sin configuración:

1. Subí esta carpeta a un repositorio de GitHub.
2. En Vercel: **Add New → Project → Import** el repo.
3. Framework Preset: **Other**. Root Directory: `/` (raíz). Build Command: *(vacío)*.
   Output Directory: *(vacío / raíz)*.
4. **Deploy.**

Para probar localmente, abrí `index.html` en el navegador (doble clic).

## ⚠️ Pendiente antes de publicar: comprimir las fotos

La carpeta `assets/` pesa ~47 MB (algunas fotos superan los 4–17 MB). Conviene
comprimirlas/redimensionarlas (ej. con https://squoosh.app) para que el sitio cargue rápido.
La más urgente es `assets/hero-3.jpg` (~17 MB).

## 🌎 Entradas para extranjeros (dLocal Go)

Sección `#international` del sitio: el turista elige fecha y país, paga y recibe un QR por email.
La venta local sigue por Venti. El medio de pago depende del país (`PAISES` en `api/_lib/config.js`):

- **Latinoamérica → dLocal Go.** El comprador pone el documento de su país (CPF, RUT…). dLocal Go
  **no cobra a EE.UU. ni Europa**, y cada país hay que activarlo en su panel.
- **EE.UU., Europa y resto del mundo → PayPal.** Sin claves de PayPal, esos países no aparecen en el formulario.
  La plata se retira desde PayPal a una cuenta bancaria argentina en pesos.

| Archivo | Qué es |
|---|---|
| `api/_lib/config.js` | **Fechas, precio (USD) y cupo** para extranjeros |
| `api/*.js` | Funciones de Vercel: checkout, webhook, estado de la orden, validación, admin |
| `ticket.html` | Página del ticket con el QR (a donde vuelve el comprador después de pagar) |
| `validar.html` | Para el staff en la puerta: escanea el QR con el celular (PIN `STAFF_PIN`) |
| `admin.html` | Ventas por fecha y comisión (PIN `ADMIN_PIN`) |
| `terms.html` | Términos y política de reembolsos (completar razón social y CUIT) |

### Probar en local

1. Copiá `.env.example` como `.env.local` y completá las claves **sandbox** de dLocal Go.
2. `npm run dev` → http://localhost:4321
3. Tarjeta de prueba aprobada: `4111 1111 1111 1111` (cualquier vencimiento futuro y CVV).
4. PayPal sandbox: developer.paypal.com → Apps & Credentials (Sandbox) da las claves, y en
   Sandbox → Accounts hay un comprador de prueba para pagar.

En local el webhook no llega (dLocal Go no ve tu compu), pero no hace falta: la página del ticket
consulta el estado del pago sola.

### Pasar a producción (Vercel)

1. Vercel → Storage → **Upstash Redis** → Connect al proyecto (crea `KV_REST_API_URL/TOKEN`).
2. Cargá las variables de `.env.example` en Settings → Environment Variables
   (`DLOCALGO_ENV=production` y las claves de producción cuando dLocal Go apruebe la cuenta).
3. Para el email: cuenta en resend.com, verificar el dominio y poner `RESEND_API_KEY`.
4. PayPal: cuenta **Business** de La Finquita → developer.paypal.com → Apps & Credentials (Live) →
   `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` y `PAYPAL_ENV=production`.
