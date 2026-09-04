import { NextRequest, NextResponse } from "next/server";
import { resolverLineasMasivo, type LineaPedida } from "@/lib/pdf/resolver-lineas";
import { listarSucursalesActivas } from "@/lib/db/sucursales.repository";

interface CuerpoValidar {
  sucursalCodigo: number;
  items: { sku: string; cantidad?: number }[];
}

const MAX_ITEMS = 10000;

export async function POST(req: NextRequest) {
  const cuerpo = (await req.json()) as CuerpoValidar;

  if (!cuerpo.items?.length) {
    return NextResponse.json({ error: "El archivo no tiene ningún código para procesar" }, { status: 400 });
  }
  if (cuerpo.items.length > MAX_ITEMS) {
    return NextResponse.json({ error: `El archivo tiene demasiadas filas (máximo ${MAX_ITEMS}).` }, { status: 400 });
  }
  if (!cuerpo.sucursalCodigo) {
    return NextResponse.json({ error: "Falta elegir la sucursal" }, { status: 400 });
  }

  const sucursales = await listarSucursalesActivas();
  const sucursal = sucursales.find((s) => s.codigoSucursal === cuerpo.sucursalCodigo);
  if (!sucursal) {
    return NextResponse.json({ error: "La sucursal elegida no existe" }, { status: 400 });
  }

  // Suma cantidades de SKUs repetidos en el archivo (decisión de Lucila,
  // 2026-09-04) y deja registro de cuáles estaban duplicados para el resumen.
  const totalFilasLeidas = cuerpo.items.length;
  const cantidadPorSku = new Map<string, number>();
  const duplicados = new Set<string>();
  for (const item of cuerpo.items) {
    const codigo = (item.sku ?? "").trim();
    if (!codigo) continue;
    const cantidad = item.cantidad && item.cantidad > 0 ? Math.floor(item.cantidad) : 1;
    if (cantidadPorSku.has(codigo)) duplicados.add(codigo);
    cantidadPorSku.set(codigo, (cantidadPorSku.get(codigo) ?? 0) + cantidad);
  }

  const pedidas: LineaPedida[] = Array.from(cantidadPorSku.entries()).map(([sku, cantidad]) => ({ sku, cantidad }));
  const { lineas, faltantes, sinPrecio, precioParcial, inactivosODiscontinuados } = await resolverLineasMasivo(
    pedidas,
    sucursal
  );

  return NextResponse.json({
    resumen: {
      totalFilasLeidas,
      skusUnicos: pedidas.length,
      duplicados: duplicados.size,
      encontrados: lineas.length,
      noEncontrados: faltantes.length,
      sinPrecio: sinPrecio.length,
      precioParcial: precioParcial.length,
      inactivosODiscontinuados: inactivosODiscontinuados.length,
      totalEtiquetas: lineas.reduce((acc, l) => acc + l.cantidad, 0),
    },
    detalle: {
      duplicados: Array.from(duplicados),
      noEncontrados: faltantes,
      sinPrecio,
      precioParcial,
      inactivosODiscontinuados,
    },
    // Listo para mandar tal cual a /api/etiquetas/pdf o /api/envios/email.
    lineasValidas: lineas.map((l) => ({ sku: l.articulo.sku, cantidad: l.cantidad })),
  });
}
