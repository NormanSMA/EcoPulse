<div align="center">

# EcoPulse

**Monitor ambiental y sísmico global en tiempo real**

Sismos, incendios, calidad del aire, lluvia, ciclones, volcanes activos y la Estación Espacial Internacional en un solo mapa interactivo, en 2D y 3D.

![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)
![MapLibre](https://img.shields.io/badge/MapLibre_GL-5-396CB2?logo=maplibre&logoColor=white)
![Cesium](https://img.shields.io/badge/CesiumJS-3D-6CADDF?logo=cesium&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostGIS-3FCF8E?logo=supabase&logoColor=white)

</div>

---

## Sobre el proyecto

EcoPulse reúne en tiempo real datos de agencias científicas y fuentes abiertas (USGS, EMSC, NASA, GDACS, OpenAQ, Open-Meteo, RainViewer y el Smithsonian) y los muestra sobre un mapa acelerado por GPU.

La idea es sencilla: los datos ambientales públicos existen, pero están dispersos en decenas de APIs con formatos distintos. EcoPulse los normaliza, los guarda en una base geoespacial y los presenta en una interfaz clara. Así se puede ver de un vistazo qué está pasando en el planeta: un sismo en el Pacífico, un incendio activo en Australia o una alerta roja de ciclón en el Caribe.

### Qué puedes hacer

- **Explorar 10 capas de datos en vivo** sobre un mapa 2D (MapLibre) o un globo 3D con terreno real (CesiumJS). Ambas vistas muestran los mismos datos, con iconos propios por tipo de evento, agrupación de sismos, mapa de calor de incendios y marcadores que se desvanecen con la antigüedad. Al cambiar de 2D a 3D (o al revés) se conserva la región que estabas viendo.
- **Abrir el detalle de cualquier cosa**, sea un evento o un punto cualquiera del mapa, en un panel con datos y gráficos:
  - **Sismo:** magnitud y su tipo, profundidad (superficial, intermedio o profundo), personas que lo sintieron, alerta PAGER, aviso de tsunami y la sismicidad de la zona en los últimos 30 días.
  - **Volcán:** el reporte semanal de actividad.
  - **Estación de aire:** PM2.5 de las últimas 48 h frente a la guía de la OMS.
  - **Ciclón:** fase, alerta y viento máximo con su categoría Saffir-Simpson.
  - **Cualquier punto:** tiempo actual y pronóstico de 24 h.
- **Ver las placas tectónicas**: límites coloreados por tipo, velocidad relativa y la historia sísmica de cada límite (sismos M ≥ 7 desde 1900, por década, con los 5 mayores). Cada sismo indica el límite de placa más cercano.
- **Recibir alertas push en el navegador** (aunque la web esté cerrada): sismos desde la magnitud que elijas, nuevos ciclones, nuevas erupciones y desastres GDACS naranja o rojo. Se configuran desde la campana; al tocar la alerta se abre el evento en el mapa.
- **Widgets en el móvil**: widget para iPhone (Scriptable) y Android (KWGT) con el sismo más fuerte o el más cercano, ciclones, erupciones y alertas. Ver [widgets/](widgets/README.md).
- **Buscar lugares** (Ctrl+K) y volar hasta ellos para ver su tiempo, su aire y su actividad sísmica.
- **Seguir ciclones tropicales** con su trayectoria observada, pronóstico y cono de incertidumbre (GDACS / JTWC).
- **Ver la ISS en su órbita real**: trayectoria pasada y futura calculada desde las efemérides de NASA. Incluye la línea día/noche.
- **Revisar la actividad reciente** en una bandeja unificada de sismos, incendios, desastres, ciclones y volcanes:
  - Se puede filtrar por tipo o por texto.
  - Se ordena por importancia (magnitud, alertas oficiales, tsunami, recencia) o por fecha.
  - Al tocar un evento, el mapa vuela hasta él.
- **Viajar en el tiempo**: filtra por ventana (1 h, 6 h, 24 h, 7 días) y reproduce la actividad como una animación a lo largo de la ventana.
- **Buscar sismos cercanos** a tu ubicación con una consulta geoespacial (PostGIS) en un radio de 50 a 500 km.
- **Recibir alertas en Discord** cuando ocurre un sismo fuerte o la calidad del aire llega a un nivel peligroso.
- **Personalizar la vista**: tema claro u oscuro, mapa base oscuro, claro o satelital, e idioma español o inglés.

## Capas de datos

| Capa | Fuente | Actualización |
|---|---|---|
| Sismos | [USGS](https://earthquake.usgs.gov/) + [EMSC](https://www.seismicportal.eu/), fusionados sin duplicados (prioridad USGS) | Cada 2 min (24 h) · cada 15 min (7 días) |
| Volcanes activos | [Smithsonian GVP](https://volcano.si.edu/): reporte semanal de actividad volcánica | Semanal |
| Catálogo de volcanes | [Smithsonian GVP](https://volcano.si.edu/) (con respaldo de [NOAA NCEI](https://www.ngdc.noaa.gov/hazel/)) | Catálogo histórico |
| Calidad del aire | [OpenAQ v3](https://openaq.org/): ~7.600 estaciones PM2.5 de todo el mundo | Horaria |
| Placas tectónicas | [PB2002](https://doi.org/10.1029/2001GC000252) (Bird, 2003; GeoJSON de H. Ahlenius): 52 placas y límites por tipo (divergente, convergente, transformante) con velocidad relativa | Estático (`pnpm build:tectonics`) |
| Radar de lluvia | [RainViewer](https://www.rainviewer.com/) | Cada 10 min |
| Incendios activos | [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) (VIIRS) | Casi tiempo real |
| Desastres globales | [GDACS](https://www.gdacs.org/) (inundaciones, sequías, erupciones) | Por evento |
| Trayectorias de ciclones | [GDACS](https://www.gdacs.org/) (avisos JTWC / NOAA) | Por aviso |
| Estación Espacial (ISS) | NASA (efemérides OEM, interpolación de Hermite) | Cada 15 s |
| Día / noche | Cálculo solar en el cliente | Continuo |

Además, bajo demanda:

- **Tiempo y pronóstico de cualquier punto:** [Open-Meteo](https://open-meteo.com/).
- **PM2.5 modelado:** Open-Meteo Air Quality.
- **Nombres de lugares:** [Photon / OpenStreetMap](https://photon.komoot.io/) para la geocodificación inversa y el geocoder de Open-Meteo (GeoNames) para el buscador.
- **Historial sísmico de una zona:** USGS, 30 días.

Todas estas consultas pasan por rutas propias del servidor (`/api/point`, `/api/geocode`, `/api/quake-history`, `/api/air-quality/station`, `/api/boundary-history`).

## Arquitectura

```
                ┌──────────────────────────┐
  GitHub        │  Cron cada 30 min         │
  Actions ────▶ │  GET /api/ingest (Bearer)│
                └────────────┬─────────────┘
                             │  8 fuentes en paralelo
                             ▼
   USGS · FIRMS · OpenAQ · Open-Meteo · GDACS · GVP · NASA
                             │  normalización + deduplicado
                             ▼
                ┌──────────────────────────┐        ┌───────────────┐
                │ Supabase (Postgres +     │ ─────▶ │ Alertas       │
                │ PostGIS)                 │        │ Discord       │
                └────────────┬─────────────┘        └───────────────┘
                             │  RPC geoespacial (sismos cercanos)
                             ▼
                ┌──────────────────────────┐
  Navegador ◀── │ Next.js 15 (App Router)  │ ◀── /api/* con caché CDN
                │ MapLibre 2D · Cesium 3D  │
                └──────────────────────────┘
```

- **Ingesta:** un workflow de GitHub Actions llama a `/api/ingest` cada 30 minutos. Las 8 fuentes se consultan en paralelo, se normalizan a filas tipadas, se deduplican y se guardan en Supabase con upsert.
- **Lectura:** las rutas públicas `/api/*` consultan las fuentes externas directamente y devuelven GeoJSON con caché de CDN (`s-maxage` + `stale-while-revalidate`) para no gastar sus cuotas. Los errores nunca se cachean. Supabase guarda el histórico de la ingesta, dispara las alertas y resuelve la consulta geoespacial de sismos cercanos; el mapa no lee de Supabase.
- **Renderizado:** MapLibre GL dibuja las capas en WebGL. Al cambiar de estilo o de datos, las fuentes se actualizan sin recrear el mapa. El globo 3D usa CesiumJS con terreno e imágenes de Cesium Ion.

## Stack

| Área | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Mapas | MapLibre GL JS 5 · CesiumJS · OpenFreeMap · Esri World Imagery |
| UI | Tailwind CSS, sistema de diseño propio, Recharts, Lucide + Morphicons |
| Datos | Supabase (Postgres + PostGIS) |
| i18n | next-intl (español / inglés) |
| Automatización | GitHub Actions (cron) · webhooks de Discord |
| Calidad | Vitest · ESLint · TypeScript estricto |

## Diseño

La interfaz sigue un sistema de diseño propio (**Design System 4.0**), inspirado en Google DeepMind y Weather Lab, que aplica las pautas de Material 3.

- **El mapa como protagonista:** ocupa toda la pantalla y los controles flotan encima en paneles.
- **Tokens centralizados:** todos los colores viven en `src/design-system/tokens/colors.ts`. Una misma escala (magnitud, AQI, nivel de alerta, fase del ciclón, radar) se ve igual en el mapa 2D, el globo 3D, la leyenda, la bandeja de eventos y el panel de detalle.
- **Temas claro y oscuro** mediante variables CSS, con soporte de opacidad en Tailwind.
- **Diseño responsivo:** paneles laterales en escritorio y paneles deslizables desde abajo en móvil, con áreas táctiles de al menos 44 px (y tolerancia de toque ampliada sobre los marcadores del mapa y del globo) y respeto por `prefers-reduced-motion`.

## Puesta en marcha

### Requisitos

- Node.js 20 o superior y [pnpm](https://pnpm.io/) 11
- Un proyecto de [Supabase](https://supabase.com/) con PostGIS habilitado
- Claves gratuitas de [OpenAQ](https://openaq.org/), [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/api/map_key/) y [Cesium Ion](https://ion.cesium.com/)

### Instalación

```bash
git clone https://github.com/NormanSMA/EcoPulse.git
cd EcoPulse
pnpm install
cp .env.example .env.local   # completa las variables
pnpm dev
```

Luego abre [http://localhost:3000](http://localhost:3000).

### Variables de entorno

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (anon) de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio, solo en el servidor, para la ingesta |
| `OPENAQ_API_KEY` | API key de OpenAQ v3 |
| `NASA_FIRMS_MAP_KEY` | MAP_KEY de NASA FIRMS |
| `NEXT_PUBLIC_CESIUM_TOKEN` | Token de Cesium Ion (terreno e imágenes 3D) |
| `DISCORD_WEBHOOK_URL` | Webhook para las alertas (opcional) |
| `INGEST_SECRET` | Secreto Bearer que protege `/api/ingest` (**obligatorio en producción**) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Clave pública VAPID para las alertas push (`pnpm dlx web-push generate-vapid-keys`) |
| `VAPID_PRIVATE_KEY` | Clave privada VAPID, solo en el servidor |
| `VAPID_SUBJECT` | Contacto VAPID: URL pública de la app o `mailto:` |
| `APP_URL` | URL pública de la app. La usa el cron de GitHub Actions y genera los enlaces de las alertas de Discord |

### Scripts

| Comando | Acción |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción |
| `pnpm start` | Servir el build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Verificación de tipos |
| `pnpm test` | Tests unitarios (Vitest) |

### Ingesta automática

En el repositorio de GitHub, configura los secrets `APP_URL` e `INGEST_SECRET`. El workflow `.github/workflows/ingest.yml` se ejecuta cada 30 minutos y también se puede lanzar a mano desde la pestaña **Actions**.

## Estructura

```
src/
├── app/
│   ├── api/            # Rutas GeoJSON por capa + /api/ingest
│   ├── layout.tsx
│   └── page.tsx        # Layout principal (mapa + paneles flotantes)
├── components/
│   ├── map/            # MapContainer (MapLibre 2D) · GlobeContainer (Cesium 3D)
│   └── ui/             # Componentes del sistema de diseño
├── design-system/      # Tokens, tema, hooks, i18n
└── lib/                # Clientes de cada fuente, ingesta, selección compartida 2D/3D, formato, tipos
messages/               # Traducciones es / en
```

## Seguridad

- Content Security Policy con orígenes explícitos y cabeceras de seguridad (HSTS, `X-Frame-Options`, `Permissions-Policy`). `script-src` permite `unsafe-eval` y `unsafe-inline` porque CesiumJS evalúa código y compila WebAssembly en tiempo de ejecución.
- `/api/ingest` exige un token Bearer. En producción rechaza la llamada si falta `INGEST_SECRET`. En desarrollo, sin `INGEST_SECRET`, acepta llamadas sin token para facilitar las pruebas locales.
- Las claves privadas (service role, OpenAQ, FIRMS) nunca llegan al cliente.
- El texto de terceros (reportes de volcanes, nombres de lugares) se muestra siempre como texto, nunca como HTML.

## Autor

**Norman Martínez**: [@NormanSMA](https://github.com/NormanSMA)

## Créditos de datos

Datos de USGS, EMSC, NASA FIRMS, NASA (efemérides de la ISS), GDACS (Comisión Europea / ONU), OpenAQ, Open-Meteo, RainViewer, NOAA NCEI y el Global Volcanism Program del Smithsonian Institution. Nombres de lugares de Photon (Komoot) / OpenStreetMap y GeoNames. Placas tectónicas: Bird, P. (2003), *An updated digital model of plate boundaries*, G³ 4(3), datos PB2002 en GeoJSON de Hugo Ahlenius (ODC-By 1.0). Mapas de © OpenStreetMap contributors, OpenFreeMap, Esri y Cesium Ion.
