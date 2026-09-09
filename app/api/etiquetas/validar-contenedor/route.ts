import { NextRequest, NextResponse } from "next/server";
import { resolverLineasPorContenedor } from "@/lib/pdf/resolver-lineas";
import { listarSucursalesActivas } from "@/lib/db/sucursales.repository";

interface CuerpoValidarContenedor {
  sucursalCodigo: number;
  contenedor: string;
}

export async function POST(req: NextRequest) {
  const cuerpo = (await req.json()) as CuerpoValidarContenedor;

  const contenedorCrudo = (cuerpo.contenedor ?? "").trim();
  if (!contenedorCrudo) {
    return NextResponse.json({ error: "Anotá el número de contenedor." }, { status: 400 });
  }
  if (!cuerpo.sucursalCodigo) {
    return NextResponse.json({ error: "Falta elegir la sucursal" }, { status: 400 });
  }

  const sucursales = await listarSucursalesActivas();
  const sucursal = sucursales.find((s) => s.codigoSucursal === cuerpo.sucursalCodigo);
  if (!sucursal) {
    return NextResponse.json({ error: "La sucursal elegida no existe" }, { status: 400 });
  }

  const { lineas, sinPrecio, precioParcial, inactivosODiscontinuados, codigoContenedor } =
    await resolverLineasPorContenedor(contenedorCrudo, sucursal);

  const totalEncontrados = lineas.length + sinPrecio.length + precioParcial.length;
  if (totalEncontrados === 0) {
    return NextResponse.json(
      {
        error: `No se encontró ningún artículo para el contenedor "${codigoContenedor}". Revisá el número e intentá de nuevo.`,
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    resumen: {
      totalFilasLeidas: totalEncontrados,
      skusUnicos: totalEncontrados,
      duplicados: 0,
      encontrados: lineas.length,
      noEncontrados: 0,
      sinPrecio: sinPrecio.length,
      precioParcial: precioParcial.length,
      inactivosODiscontinuados: inactivosODiscontinuados.length,
      totalEtiquetas: lineas.length,
      codigoContenedor,
    },
    detalle: {
      duplicados: [] as string[],
      noEncontrados: [] as string[],
      sinPrecio,
      precioParcial,
      inactivosODiscontinuados,
    },
    // Listo para mandar tal cual a /api/etiquetas/pdf o /api/envios/email.
    lineasValidas: lineas.map((l) => ({ sku: l.articulo.sku, cantidad: l.cantidad })),
  });
}
