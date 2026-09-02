import { NextRequest, NextResponse } from "next/server";
import { buscarArticuloPorSku } from "@/lib/db/articulos.repository";

export async function GET(req: NextRequest) {
  const sku = req.nextUrl.searchParams.get("sku");
  if (!sku) {
    return NextResponse.json({ error: "Falta el parámetro sku" }, { status: 400 });
  }

  const articulo = await buscarArticuloPorSku(sku);
  if (!articulo) {
    return NextResponse.json({ error: "No se encontró ningún artículo con ese código" }, { status: 404 });
  }

  return NextResponse.json(articulo);
}
