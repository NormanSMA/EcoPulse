import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EcoPulse — Global Environmental & Seismic Monitor",
  description: "Plataforma en tiempo real de monitoreo de sismos mundiales y calidad del aire.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased bg-ds-canvas text-ds-text-primary">
        <div className="ds-ambient-backdrop" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
