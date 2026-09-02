import { NextResponse } from "next/server";
import { listarSucursalesActivas } from "@/lib/db/sucursales.repository";

export async function GET() {
  const sucursales = await listarSucursalesActivas();
  return NextResponse.json(sucursales);
}
