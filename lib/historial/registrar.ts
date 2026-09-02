import fs from "node:fs/promises";
import path from "node:path";
import { google } from "googleapis";
import type { PedidoHistorial } from "@/types";

const RANGO_HOJA = "Historial!A:M";
const ARCHIVO_LOCAL = path.join(process.cwd(), "lib", "historial", "historial.local.json");

function filaDesdePedido(p: PedidoHistorial): (string | number)[] {
  return [
    p.idPedido,
    p.fecha,
    p.hora,
    p.usuario,
    p.sucursal,
    p.marca,
    p.articulosDistintos,
    p.totalEtiquetas,
    p.detalle,
    p.formatoHoja,
    p.nombrePdf,
    p.estadoEnvio,
    p.fechaEnvio,
  ];
}

async function registrarEnSheets(p: PedidoHistorial): Promise<void> {
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  const credencialesJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!sheetId || !credencialesJson) throw new Error("Google Sheets no configurado");

  const credenciales = JSON.parse(credencialesJson);
  const auth = new google.auth.GoogleAuth({
    credentials: credenciales,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: RANGO_HOJA,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [filaDesdePedido(p)] },
  });
}

async function registrarLocal(p: PedidoHistorial): Promise<void> {
  let existentes: PedidoHistorial[] = [];
  try {
    const contenido = await fs.readFile(ARCHIVO_LOCAL, "utf-8");
    existentes = JSON.parse(contenido);
  } catch {
    // todavia no existe el archivo, arranca vacio
  }
  existentes.push(p);
  await fs.writeFile(ARCHIVO_LOCAL, JSON.stringify(existentes, null, 2), "utf-8");
}

/**
 * Registra un pedido de etiquetas en el historial. Si Google Sheets esta
 * configurado (GOOGLE_SHEETS_ID + GOOGLE_SERVICE_ACCOUNT_JSON) escribe ahi;
 * si no, lo guarda en un archivo local para no perder el registro mientras
 * se termina de configurar.
 */
export async function registrarPedido(p: PedidoHistorial): Promise<{ destino: "sheets" | "local" }> {
  const configurado = Boolean(process.env.GOOGLE_SHEETS_ID && process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (configurado) {
    await registrarEnSheets(p);
    return { destino: "sheets" };
  }
  await registrarLocal(p);
  return { destino: "local" };
}
