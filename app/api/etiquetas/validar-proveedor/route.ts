import { NextRequest, NextResponse } from "next/server";
import { resolverLineasPorProveedor } from "@/lib/pdf/resolver-lineas";
import { listarSucursalesActivas } from "@/lib/db/sucursales.repository";

interface CuerpoValidarProveedor {
  sucursalCodigo: number;
  proveedor: string;
  /** dd/mm/aaaa o aaaa-mm-dd, opcionales -- si se pasan los dos, solo se
   * traen articulos cuyo precio fue modificado en ese rango (ver
   * lib/db/articulos.repository.ts). Si se omite alguno, se traen TODOS
   * los articulos del proveedor (igual que "Por contenedor"). */
  fechaDesde?: string;
  fechaHasta?: string;
}

export async function POST(req: NextRequest) {
  const cuerpo = (await req.json()) as CuerpoValidarProveedor;

  const proveedor = (cuerpo.proveedor ?? "").trim();
  if (!proveedor) {
    return NextResponse.json({ error: "Elegí el proveedor nacional." }, { status: 400 });
  }
  if (!cuerpo.sucursalCodigo) {
    return NextResponse.json({ error: "Falta elegir la sucursal" }, { status: 400 });
  }
  if ((cuerpo.fechaDesde && !cuerpo.fechaHasta) || (!cuerpo.fechaDesde && cuerpo.fechaHasta)) {
    return NextResponse.json({ error: "Completá las dos fechas (desde y hasta), o ninguna." }, { status: 400 });
  }
  if (cuerpo.fechaDesde && cuerpo.fechaHasta && cuerpo.fechaDesde > cuerpo.fechaHasta) {
    return NextResponse.json({ error: '"Fecha desde" no puede ser posterior a "Fecha hasta".' }, { status: 400 });
  }

  const sucursales = await listarSucursalesActivas();
  const sucursal = sucursales.find((s) => s.codigoSucursal === cuerpo.sucursalCodigo);
  if (!sucursal) {
    return NextResponse.json({ error: "La sucursal elegida no existe" }, { status: 400 });
  }

  const { lineas, sinPrecio, precioParcial, inactivosODiscontinuados } = await resolverLineasPorProveedor(
    proveedor,
    sucursal,
    cuerpo.fechaDesde,
    cuerpo.fechaHasta
  );

  const totalEncontrados = lineas.length + sinPrecio.length + precioParcial.length;
  if (totalEncontrados === 0) {
    const conFecha = cuerpo.fechaDesde && cuerpo.fechaHasta;
    return NextResponse.json(
      {
        error: conFecha
          ? `No se encontró ningún artículo de "${proveedor}" con precio modificado entre ${cuerpo.fechaDesde} y ${cuerpo.fechaHasta}.`
          : `No se encontró ningún artículo para el proveedor "${proveedor}".`,
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
      proveedor,
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
