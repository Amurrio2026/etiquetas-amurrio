import { NextRequest, NextResponse } from "next/server";
import { cargarPlantillaPorMarca, buscarFormatoHoja } from "@/lib/config";
import { generarPdf } from "@/lib/pdf/generar-pdf";
import { resolverLineas, type LineaPedida } from "@/lib/pdf/resolver-lineas";
import { listarSucursalesActivas } from "@/lib/db/sucursales.repository";

interface CuerpoPedido {
  sucursalCodigo: number;
  formatoId: string;
  lineas: LineaPedida[];
}

export async function POST(req: NextRequest) {
  const cuerpo = (await req.json()) as CuerpoPedido;

  if (!cuerpo.lineas?.length) {
    return NextResponse.json({ error: "El listado de etiquetas está vacío" }, { status: 400 });
  }
  if (!cuerpo.sucursalCodigo) {
    return NextResponse.json({ error: "Falta elegir la sucursal" }, { status: 400 });
  }

  const sucursales = await listarSucursalesActivas();
  const sucursal = sucursales.find((s) => s.codigoSucursal === cuerpo.sucursalCodigo);
  if (!sucursal) {
    return NextResponse.json({ error: "La sucursal elegida no existe" }, { status: 400 });
  }

  const { lineas, faltantes, sinPrecio, precioParcial } = await resolverLineas(cuerpo.lineas, sucursal);
  if (lineas.length === 0) {
    return NextResponse.json(
      { error: "Ninguno de los artículos tiene algún precio cargado para generar la etiqueta", faltantes, sinPrecio },
      { status: 400 }
    );
  }

  try {
    const [plantilla, formato] = await Promise.all([
      cargarPlantillaPorMarca(sucursal.marca),
      buscarFormatoHoja(cuerpo.formatoId),
    ]);

    const pdfBytes = await generarPdf({ lineas, formato, plantilla });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="etiquetas.pdf"`,
        "X-Faltantes": encodeURIComponent(JSON.stringify(faltantes)),
        "X-Sin-Precio": encodeURIComponent(JSON.stringify(sinPrecio)),
        "X-Precio-Parcial": encodeURIComponent(JSON.stringify(precioParcial)),
      },
    });
  } catch (err) {
    console.error("Error generando PDF", err);
    return NextResponse.json({ error: "No se pudo generar el PDF. Probá de nuevo en un momento." }, { status: 500 });
  }
}
