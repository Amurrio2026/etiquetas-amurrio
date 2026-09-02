import fs from "node:fs/promises";
import path from "node:path";
import type { FormatoHoja, Plantilla } from "@/types";

const MARCA_A_ARCHIVO: Record<string, string> = {
  "Grand Bazaar": "grand-bazaar.json",
  "Casa Moda": "casa-moda.json",
};

/** Lee la plantilla de etiqueta (JSON) de la marca de la sucursal elegida. */
export async function cargarPlantillaPorMarca(marca: string): Promise<Plantilla> {
  const archivo = MARCA_A_ARCHIVO[marca];
  if (!archivo) throw new Error(`No hay plantilla configurada para la marca "${marca}"`);
  const contenido = await fs.readFile(path.join(process.cwd(), "config", "plantillas", archivo), "utf-8");
  return JSON.parse(contenido);
}

export async function listarFormatosHoja(): Promise<FormatoHoja[]> {
  const contenido = await fs.readFile(path.join(process.cwd(), "config", "formatos-hoja.json"), "utf-8");
  return JSON.parse(contenido);
}

export async function buscarFormatoHoja(id: string): Promise<FormatoHoja> {
  const formatos = await listarFormatosHoja();
  const formato = formatos.find((f) => f.id === id);
  if (!formato) throw new Error(`Formato de hoja "${id}" no existe`);
  return formato;
}
