import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cargarPlantillaPorMarca, buscarFormatoHoja } from "@/lib/config";
import { generarPdf } from "@/lib/pdf/generar-pdf";
import { totalEtiquetas } from "@/lib/pdf/paginar";
import { resolverLineas, type LineaPedida } from "@/lib/pdf/resolver-lineas";
import { listarSucursalesActivas } from "@/lib/db/sucursales.repository";
import { enviarEtiquetasPorEmail } from "@/lib/email/resend";
import { registrarPedido } from "@/lib/historial/registrar";

interface CuerpoEnvio {
  sucursalCodigo: number;
  formatoId: string;
  usuario: string;
  lineas: LineaPedida[];
}

function fechaHoraAr(): { fecha: string; hora: string } {
  const ahora = new Date();
  const fecha = ahora.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  const hora = ahora.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" });
  return { fecha, hora };
}

export async function POST(req: NextRequest) {
  const cuerpo = (await req.json()) as CuerpoEnvio;

  if (!cuerpo.lineas?.length) {
    return NextResponse.json({ error: "El listado de etiquetas está vacío" }, { status: 400 });
  }
  if (!cuerpo.sucursalCodigo) {
    return NextResponse.json({ error: "Falta elegir la sucursal" }, { status: 400 });
  }

  const sucursales = await listarSucursalesActivas();
  const sucursal = sucursales.find((s) => s.codigoSucursal === cuerpo.sucursalCodigo);
  if (!sucursal) {
    return NextResponse.json({ error: "La sucursal elegida no existe o no tiene mail configurado" }, { status: 400 });
  }
  if (!sucursal.email) {
    return NextResponse.json({ error: `${sucursal.nombre} no tiene un mail configurado todavía` }, { status: 400 });
  }

  const { lineas, faltantes } = await resolverLineas(cuerpo.lineas);
  if (lineas.length === 0) {
    return NextResponse.json({ error: "Ninguno de los artículos existe", faltantes }, { status: 400 });
  }

  try {
    const [plantilla, formato] = await Promise.all([
      cargarPlantillaPorMarca(sucursal.marca),
      buscarFormatoHoja(cuerpo.formatoId),
    ]);

    const pdfBytes = await generarPdf({ lineas, formato, plantilla });
    const { fecha, hora } = fechaHoraAr();
    const idPedido = randomUUID();
    const nombrePdf = `etiquetas_${sucursal.nombre.replace(/\s+/g, "")}_${fecha.replaceAll("/", "-")}_${idPedido.slice(0, 8)}.pdf`;
    const total = totalEtiquetas(lineas);
    const usuario = cuerpo.usuario || "sin especificar";

    const resultadoEnvio = await enviarEtiquetasPorEmail({
      sucursal,
      usuario,
      fecha,
      articulosDistintos: lineas.length,
      totalEtiquetas: total,
      pdfBytes,
      nombrePdf,
    });

    const destinoHistorial = await registrarPedido({
      idPedido,
      fecha,
      hora,
      usuario,
      sucursal: sucursal.nombre,
      marca: sucursal.marca,
      articulosDistintos: lineas.length,
      totalEtiquetas: total,
      detalle: lineas.map((l) => `${l.articulo.sku}:${l.cantidad}`).join(", "),
      formatoHoja: formato.nombre,
      nombrePdf,
      estadoEnvio: resultadoEnvio.prueba ? "prueba" : resultadoEnvio.enviado ? "enviado" : "error",
      fechaEnvio: `${fecha} ${hora}`,
    });

    return NextResponse.json({
      ok: true,
      idPedido,
      destinatario: resultadoEnvio.destinatario,
      modoPrueba: resultadoEnvio.prueba,
      totalEtiquetas: total,
      articulosDistintos: lineas.length,
      historialGuardadoEn: destinoHistorial.destino,
      faltantes,
    });
  } catch (err) {
    console.error("Error enviando etiquetas por email", err);
    return NextResponse.json({ error: "No se pudo generar o enviar el PDF. Probá de nuevo en un momento." }, { status: 500 });
  }
}
