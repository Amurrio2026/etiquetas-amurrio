import { NextRequest, NextResponse } from "next/server";
import { buscarArticuloPorSku } from "@/lib/db/articulos.repository";
import { listarSucursalesActivas } from "@/lib/db/sucursales.repository";
import { resolverPrecio } from "@/lib/precios/resolver-precio";
import type { TipoPrecio } from "@/types";

export async function GET(req: NextRequest) {
  const sku = req.nextUrl.searchParams.get("sku");
  const sucursalCodigo = req.nextUrl.searchParams.get("sucursalCodigo");
  const tipoPrecioParam = req.nextUrl.searchParams.get("tipoPrecio");

  if (!sku) {
    return NextResponse.json({ error: "Falta el parámetro sku" }, { status: 400 });
  }
  if (!sucursalCodigo) {
    return NextResponse.json({ error: "Falta elegir la sucursal antes de escanear" }, { status: 400 });
  }
  const tipoPrecio: TipoPrecio = tipoPrecioParam === "efectivo" ? "efectivo" : "lista";

  const sucursales = await listarSucursalesActivas();
  const sucursal = sucursales.find((s) => s.codigoSucursal === Number(sucursalCodigo));
  if (!sucursal) {
    return NextResponse.json({ error: "La sucursal elegida no existe" }, { status: 400 });
  }

  const articulo = await buscarArticuloPorSku(sku);
  if (!articulo) {
    return NextResponse.json({ error: "No se encontró ningún artículo con ese código" }, { status: 404 });
  }

  const precioVenta = resolverPrecio(articulo, sucursal, tipoPrecio);
  return NextResponse.json({ ...articulo, precioVenta });
}
