import type { FormatoHoja, Plantilla } from "@/types";
// Se importan como modulos (no se leen con fs en tiempo de ejecucion) para
// que Vercel los incluya siempre en la funcion serverless. Leerlos con
// fs.readFile funcionaba en local pero fallaba una vez desplegado: Next
// solo empaqueta en la funcion los archivos que puede "ver" en el codigo
// (imports), no los que se leen del disco de forma dinamica.
import grandBazaar from "@/config/plantillas/grand-bazaar.json";
import casaModa from "@/config/plantillas/casa-moda.json";
import formatosHoja from "@/config/formatos-hoja.json";

const MARCA_A_PLANTILLA: Record<string, Plantilla> = {
  "Grand Bazaar": grandBazaar as unknown as Plantilla,
  "Casa Moda": casaModa as unknown as Plantilla,
};

/** Devuelve la plantilla de etiqueta (JSON) de la marca de la sucursal elegida. */
export async function cargarPlantillaPorMarca(marca: string): Promise<Plantilla> {
  const plantilla = MARCA_A_PLANTILLA[marca];
  if (!plantilla) throw new Error(`No hay plantilla configurada para la marca "${marca}"`);
  return plantilla;
}

export async function listarFormatosHoja(): Promise<FormatoHoja[]> {
  return formatosHoja as unknown as FormatoHoja[];
}

export async function buscarFormatoHoja(id: string): Promise<FormatoHoja> {
  const formatos = await listarFormatosHoja();
  const formato = formatos.find((f) => f.id === id);
  if (!formato) throw new Error(`Formato de hoja "${id}" no existe`);
  return formato;
}
