import { NextRequest, NextResponse } from "next/server";
import { buscarArticuloPorSku } from "@/lib/db/articulos.repository";
import { listarSucursalesActivas } from "@/lib/db/sucursales.repository";
import { resolverPrecios } from "@/lib/precios/resolver-precio";

export async function GET(req: NextRequest) {
  const sku = req.nextUrl.searchParams.get("sku");
  const sucursalCodigo = req.nextUrl.searchParams.get("sucursalCodigo");

  if (!sku) {
    return NextResponse.json({ error: "Falta el parámetro sku" }, { status: 400 });
  }
  if (!sucursalCodigo) {
    return NextResponse.json({ error: "Falta elegir la sucursal antes de escanear" }, { status: 400 });
  }

  const sucursales = await listarSucursalesActivas();
  const sucursal = sucursales.find((s) => s.codigoSucursal === Number(sucursalCodigo));
  if (!sucursal) {
    return NextResponse.json({ error: "La sucursal elegida no existe" }, { status: 400 });
  }

  const articulo = await buscarArticuloPorSku(sku);
  if (!articulo) {
    return NextResponse.json({ error: "No se encontró ningún artículo con ese código" }, { status: 404 });
  }

  const { precioEfectivo, precioLista } = resolverPrecios(articulo, sucursal);
  return NextResponse.json({ ...articulo, precioEfectivo, precioLista });
}
