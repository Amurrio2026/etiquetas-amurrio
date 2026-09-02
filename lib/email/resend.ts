import { Resend } from "resend";
import type { Sucursal } from "@/types";

export interface DatosEnvioEtiquetas {
  sucursal: Sucursal;
  usuario: string;
  fecha: string; // dd/mm/aaaa
  articulosDistintos: number;
  totalEtiquetas: number;
  pdfBytes: Uint8Array;
  nombrePdf: string;
}

function esModoPrueba(): boolean {
  // Por defecto true a proposito: hay que decidir activamente pasar a
  // produccion (TEST_MODE=false), nunca al reves por descuido.
  return process.env.TEST_MODE !== "false";
}

function destinatarioReal(sucursal: Sucursal): { email: string; prueba: boolean } {
  if (esModoPrueba()) {
    const testEmail = process.env.TEST_EMAIL_TO || "operaciones@amurrio.com.ar";
    return { email: testEmail, prueba: true };
  }
  return { email: sucursal.email, prueba: false };
}

function armarAsunto(sucursal: Sucursal, fecha: string, prueba: boolean): string {
  const base = `Etiquetas de artículos - Sucursal ${sucursal.nombre} - ${fecha}`;
  return prueba ? `[PRUEBA] ${base}` : base;
}

function armarCuerpo(datos: DatosEnvioEtiquetas, prueba: boolean): string {
  const avisoPrueba = prueba
    ? `<p style="background:#fff3cd;padding:10px;border-radius:4px;color:#664d03">
         <strong>Modo prueba:</strong> este mail se redirigió acá en lugar de a
         ${datos.sucursal.nombre} (${datos.sucursal.email}) porque TEST_MODE está activo.
       </p>`
    : "";
  return `
    ${avisoPrueba}
    <p>Sucursal: <strong>${datos.sucursal.nombre}</strong></p>
    <p>Fecha: ${datos.fecha}</p>
    <p>Usuario: ${datos.usuario}</p>
    <p>Artículos distintos: ${datos.articulosDistintos}</p>
    <p>Cantidad total de etiquetas: ${datos.totalEtiquetas}</p>
  `;
}

/**
 * Envia el PDF de etiquetas por mail. Mientras TEST_MODE sea "true" (el
 * valor por defecto), TODO envio va a TEST_EMAIL_TO sin importar la
 * sucursal elegida -- para eso esta el modo prueba.
 *
 * Si todavia no se configuro RESEND_API_KEY, no falla: solo deja constancia
 * en el log del servidor de que "se hubiera enviado" tal mail, para poder
 * probar el resto del flujo (PDF, historial) sin depender de esa cuenta.
 */
export async function enviarEtiquetasPorEmail(datos: DatosEnvioEtiquetas): Promise<{ prueba: boolean; enviado: boolean; destinatario: string }> {
  const { email, prueba } = destinatarioReal(datos.sucursal);
  const asunto = armarAsunto(datos.sucursal, datos.fecha, prueba);
  const cuerpo = armarCuerpo(datos, prueba);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email simulado] para=${email} asunto="${asunto}"`);
    return { prueba, enviado: false, destinatario: email };
  }

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: process.env.RESEND_FROM || "Etiquetas Amurrio <etiquetas@amurrio.com.ar>",
    to: email,
    subject: asunto,
    html: cuerpo,
    attachments: [{ filename: datos.nombrePdf, content: Buffer.from(datos.pdfBytes) }],
  });

  return { prueba, enviado: true, destinatario: email };
}
