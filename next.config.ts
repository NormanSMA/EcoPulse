import type { NextConfig } from "next";
import CopyWebpackPlugin from "copy-webpack-plugin";

const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https://tiles.openfreemap.org https://*.cesium.com https://*.virtualearth.net https://server.arcgisonline.com;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' https://tiles.openfreemap.org https://earthquake.usgs.gov https://*.supabase.co https://api.openaq.org https://api.cesium.com https://assets.ion.cesium.com https://*.cesium.com https://*.virtualearth.net https://dev.virtualearth.net https://server.arcgisonline.com;
    worker-src 'self' blob:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    block-all-mixed-content;
    upgrade-insecure-requests;
`.replace(/\s{2,}/g, ' ').trim();

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // Cesium (Fase 3.3) necesita sus assets estáticos (Workers/Assets/Widgets)
  // servidos same-origin en /cesium/ — se copian de node_modules en cada build/dev.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.plugins.push(
        new CopyWebpackPlugin({
          patterns: [
            { from: "node_modules/cesium/Build/Cesium/Workers", to: "../public/cesium/Workers" },
            { from: "node_modules/cesium/Build/Cesium/ThirdParty", to: "../public/cesium/ThirdParty" },
            { from: "node_modules/cesium/Build/Cesium/Assets", to: "../public/cesium/Assets" },
            { from: "node_modules/cesium/Build/Cesium/Widgets", to: "../public/cesium/Widgets" },
          ],
        })
      );
    }
    return config;
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
