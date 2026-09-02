import { NextResponse } from "next/server";
import { listarFormatosHoja } from "@/lib/config";

export async function GET() {
  const formatos = await listarFormatosHoja();
  return NextResponse.json(formatos);
}
