# Etiquetas Amurrio — piloto

App para escanear artículos en sucursal, armar un listado de etiquetas con cantidades, generar el PDF listo para imprimir y enviarlo por mail. Piloto acotado a **Grand Bazaar** (Casa Moda ya tiene su plantilla lista pero no está conectada a sucursales/email todavía).

## Cómo probarla ahora mismo (sin credenciales)

La app corre igual sin ninguna configuración: usa datos de ejemplo (artículos y sucursales simulados) y guarda el historial en un archivo local en vez de Google Sheets.

```
cd etiquetas-amurrio
npm install
npm run dev
```

Abrir `http://localhost:3000`. Se puede escanear con cámara, con un lector USB (funciona como teclado), o tipear el código a mano.

**Modo prueba de email:** todos los mails salen a tu casilla (`operaciones@amurrio.com.ar`), sin importar qué sucursal elijas, hasta que lo desactivemos a propósito. Cada mail de prueba lleva el prefijo `[PRUEBA]` en el asunto.

## Qué es real y qué es simulado hoy

| Parte | Estado |
|---|---|
| Búsqueda de artículos por código | Simulado (10 artículos de ejemplo). Para conectar a la base real: `DATABASE_URL` |
| Sucursales | Simulado (las 6 de Grand Bazaar, con mails `.example`). Se reemplaza solo al configurar `DATABASE_URL` |
| Generación de PDF | **Real**, ya probado con las dos plantillas |
| Envío de email | Simulado si falta `RESEND_API_KEY` (queda en modo prueba igual) |
| Historial de pedidos | Se guarda en un archivo local (`lib/historial/historial.local.json`) si falta `GOOGLE_SHEETS_ID` / credenciales de Google |

## Variables de entorno (`.env.local`)

Copiar `.env.example` a `.env.local` y completar lo que corresponda. Todo es opcional — lo que falta, cae en modo simulado automáticamente:

- `DATABASE_URL`: para conectar a la base real de artículos y sucursales.
- `RESEND_API_KEY` / `RESEND_FROM`: para que los mails salgan de verdad (via Resend).
- `TEST_MODE`: por defecto `true`. Ponerlo en `false` recién cuando estemos seguros de que todo funciona bien, para que los mails empiecen a ir a las sucursales reales.
- `TEST_EMAIL_TO`: a dónde van los mails mientras estemos en modo prueba (por defecto tu mail).
- `GOOGLE_SHEETS_ID` / `GOOGLE_SERVICE_ACCOUNT_JSON`: para que el historial se guarde en la planilla "APP DE ETIQUETAS" en vez del archivo local. El ID de la planilla ya está precargado en `.env.example`.

## Pendientes para pasar a producción

1. **Tipografía Gilroy de Grand Bazaar**: los archivos `.ttf` que están en esta misma carpeta (`Gilroy-*.ttf`) no se pueden usar — el `License.txt` que los acompaña es la licencia genérica de Fontspring/Font Squirrel, sin comprobante de compra a nombre de Amurrio, y ese tipo de licencia además excluye expresamente el uso en software. Mientras tanto, la etiqueta de Grand Bazaar usa **Baloo 2** (fuente libre de Google, visualmente similar) como reemplazo. Para pasar a la tipografía real hacen falta los archivos `.ttf` de Gilroy con licencia de uso en aplicaciones/software, ubicados en `assets/fonts/`. Casa Moda no tiene este problema (usa Arial/Helvetica, sin restricciones).
2. **Base de datos real**: pasar `DATABASE_URL` para que la búsqueda de artículos y el listado de sucursales sean los reales.
3. **Envío de mail real**: pasar `RESEND_API_KEY` y, cuando esté todo probado, `TEST_MODE=false` para que cada sucursal reciba en su propio mail.
4. **Historial en Google Sheets**: pasar las credenciales de Google para que quede todo registrado ahí en vez de en el archivo local.
5. **Casa Moda**: la plantilla ya está lista y probada (ver `config/plantillas/casa-moda.json`), pero falta habilitarla para sucursales reales — hoy el piloto sólo trabaja con Grand Bazaar a propósito.

## Estructura

- `config/plantillas/`: diseño de cada etiqueta (tamaños, textos, colores) — se edita sin tocar código.
- `config/formatos-hoja.json`: cómo se acomodan las etiquetas en la hoja A4 (columnas, filas, márgenes).
- `lib/pdf/`: generación del PDF.
- `lib/db/`: conexión a la base de artículos y sucursales (con datos de ejemplo si no hay `DATABASE_URL`).
- `lib/email/`: envío de mail (modo prueba por defecto).
- `lib/historial/`: registro de cada pedido.
- `app/`: pantallas y endpoints de la aplicación.
