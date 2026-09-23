import type { Metadata, Viewport } from "next";
import { themes } from "@/design-system/tokens";
import "./globals.css";

export const metadata: Metadata = {
  title: "EcoPulse — Global Environmental & Seismic Monitor",
  description: "Plataforma en tiempo real de monitoreo de sismos mundiales y calidad del aire.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: themes.dark.canvas },
    { media: "(prefers-color-scheme: light)", color: themes.light.canvas },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- layout raíz del App Router, se carga una sola vez */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,300..700&display=swap"
        />
      </head>
      <body className="antialiased bg-ds-canvas text-ds-text-primary">{children}</body>
    </html>
  );
}
