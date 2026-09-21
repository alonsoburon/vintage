import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "vintage · datos macro de Chile point-in-time",
  description:
    "Archivo de vintages de series macroeconómicas de Chile. Responde qué valor tenía una serie en una fecha, según lo publicado hasta ese día. API HTTP y servidor MCP.",
  openGraph: {
    title: "vintage · datos macro de Chile point-in-time",
    description:
      "Archivo de vintages de series macroeconómicas de Chile. API HTTP y servidor MCP para agentes.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
