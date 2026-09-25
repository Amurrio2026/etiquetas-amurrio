import { NextResponse } from "next/server";
import { listarProveedoresNacionales } from "@/lib/db/articulos.repository";

/** Lista de proveedores nacionales para el selector de "Por contenedor" (ver PorContenedor.tsx). */
export async function GET() {
  const proveedores = await listarProveedoresNacionales();
  return NextResponse.json(proveedores);
}
