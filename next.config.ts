import type { NextConfig } from "next";

// 'unsafe-eval' solo se añade en desarrollo (React y HMR lo piden). Los
// 'unsafe-inline' los requieren los scripts inline de hidratación de Next al
// no usar nonces. Sin WebAssembly: no se permite 'wasm-unsafe-eval'.
const scriptSrc = ["'self'", "'unsafe-inline'", ...(process.env.NODE_ENV === "production" ? [] : ["'unsafe-eval'"])].join(" ");

const cspHeader = `
    default-src 'self';
    script-src ${scriptSrc};
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https://tiles.openfreemap.org https://tilecache.rainviewer.com https://server.arcgisonline.com;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' https://tiles.openfreemap.org https://api.rainviewer.com https://tilecache.rainviewer.com https://*.supabase.co https://server.arcgisonline.com;
    worker-src 'self' blob:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    block-all-mixed-content;
    upgrade-insecure-requests;
`.replace(/\s{2,}/g, ' ').trim();

const nextConfig: NextConfig = {
  // Standalone solo para empaquetar en contenedor (Vercel no lo usa). En Windows
  // con pnpm falla al crear enlaces simbólicos sin modo desarrollador.
  output: process.env.BUILD_STANDALONE ? "standalone" : undefined,
  reactStrictMode: true,
  poweredByHeader: false,
  // Algunos navegadores piden /favicon.ico aunque el HTML declare otro icono.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icons/icon-192.png" }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
