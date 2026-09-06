# EcoPulse 🌍🛰️
> **Global Environmental & Seismic Real-Time Monitor**

Plataforma de telemetría geoespacial que combina en tiempo real eventos sísmicos mundiales (USGS) e índices de calidad del aire urbano (OpenAQ) renderizados con WebGL acelerado por GPU a 60 FPS mediante MapLibre GL y OpenFreeMap.

---

## 🚀 Inicio Rápido (Local)

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables:**
   ```bash
   cp .env.example .env.local
   ```

3. **Ejecutar servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 🛠️ Stack Tecnológico
* **Framework:** Next.js 15 (App Router, React 19, TypeScript)
* **Motor de Mapa:** MapLibre GL JS (WebGL GPU acelerado)
* **Tilesets:** OpenFreeMap (Vector tiles oscuros gratuitos sin cuotas)
* **Estilos:** Tailwind CSS
* **Datos:** API USGS Earthquake en tiempo real + OpenAQ
* **Pipeline:** GitHub Actions Cron ($0 recurrente)
