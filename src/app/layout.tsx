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

const THEME_SCRIPT = `(function(){try{var p=new URLSearchParams(location.search);var q=p.get('theme');var s=localStorage.getItem('vintage-theme');var t=q==='dark'||q==='light'?q:(s||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
