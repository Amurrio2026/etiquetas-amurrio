import { NextRequest, NextResponse } from "next/server";
import { cargarPlantillaPorMarca, buscarFormatoHoja } from "@/lib/config";
import { generarPdf } from "@/lib/pdf/generar-pdf";
import { resolverLineas, type LineaPedida } from "@/lib/pdf/resolver-lineas";

interface CuerpoPedido {
  marca: string; // "Grand Bazaar" (por ahora la unica activa en el piloto)
  formatoId: string;
  lineas: LineaPedida[];
}

export async function POST(req: NextRequest) {
  const cuerpo = (await req.json()) as CuerpoPedido;

  if (!cuerpo.lineas?.length) {
    return NextResponse.json({ error: "El listado de etiquetas está vacío" }, { status: 400 });
  }

  const { lineas, faltantes } = await resolverLineas(cuerpo.lineas);
  if (lineas.length === 0) {
    return NextResponse.json({ error: "Ninguno de los artículos existe", faltantes }, { status: 400 });
  }

  try {
    const [plantilla, formato] = await Promise.all([
      cargarPlantillaPorMarca(cuerpo.marca),
      buscarFormatoHoja(cuerpo.formatoId),
    ]);

    const pdfBytes = await generarPdf({ lineas, formato, plantilla });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="etiquetas.pdf"`,
        "X-Faltantes": encodeURIComponent(JSON.stringify(faltantes)),
      },
    });
  } catch (err) {
    console.error("Error generando PDF", err);
    return NextResponse.json({ error: "No se pudo generar el PDF. Probá de nuevo en un momento." }, { status: 500 });
  }
}
