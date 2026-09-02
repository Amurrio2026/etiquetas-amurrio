import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Etiquetas Amurrio",
  description: "Generación de etiquetas de precio por sucursal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
