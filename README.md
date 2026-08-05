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
