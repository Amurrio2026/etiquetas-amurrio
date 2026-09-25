import type { FormatoHoja, Plantilla } from "@/types";
// Se importan como modulos (no se leen con fs en tiempo de ejecucion) para
// que Vercel los incluya siempre en la funcion serverless. Leerlos con
// fs.readFile funcionaba en local pero fallaba una vez desplegado: Next
// solo empaqueta en la funcion los archivos que puede "ver" en el codigo
// (imports), no los que se leen del disco de forma dinamica.
import grandBazaar from "@/config/plantillas/grand-bazaar.json";
import casaModa from "@/config/plantillas/casa-moda.json";
import grandBazaarBlister from "@/config/plantillas/grand-bazaar-blister.json";
import casaModaBlister from "@/config/plantillas/casa-moda-blister.json";
import formatosHoja from "@/config/formatos-hoja.json";

const MARCA_A_PLANTILLA: Record<string, Plantilla> = {
  "Grand Bazaar": grandBazaar as unknown as Plantilla,
  "Casa Moda": casaModa as unknown as Plantilla,
};

// Todas las plantillas disponibles, indexadas por su "id" (ver campo
// FormatoHoja.plantillaId) -- agregado 2026-09-25 para poder ofrecer MAS DE
// UN tamaño de etiqueta por marca (ej: la de siempre + el "Blister de
// pared" 3x5,5cm). Los formatos que YA EXISTIAN no tienen plantillaId, asi
// que siguen resolviendo por MARCA_A_PLANTILLA exactamente como antes.
const PLANTILLAS_POR_ID: Record<string, Plantilla> = {
  "grand-bazaar": grandBazaar as unknown as Plantilla,
  "casa-moda": casaModa as unknown as Plantilla,
  "grand-bazaar-blister": grandBazaarBlister as unknown as Plantilla,
  "casa-moda-blister": casaModaBlister as unknown as Plantilla,
};

/** Devuelve la plantilla de etiqueta (JSON) de la marca de la sucursal elegida. */
export async function cargarPlantillaPorMarca(marca: string): Promise<Plantilla> {
  const plantilla = MARCA_A_PLANTILLA[marca];
  if (!plantilla) throw new Error(`No hay plantilla configurada para la marca "${marca}"`);
  return plantilla;
}

/**
 * Devuelve la plantilla que corresponde a un formato de hoja puntual: si el
 * formato indica "plantillaId" (formatos nuevos, ej. Blister de pared), usa
 * esa; si no lo indica (todos los formatos que ya existian), cae en la
 * plantilla por defecto de la marca -- mismo resultado que antes, ningun
 * formato existente cambia de comportamiento.
 */
export async function cargarPlantillaParaFormato(marca: string, formato: FormatoHoja): Promise<Plantilla> {
  if (formato.plantillaId) {
    const plantilla = PLANTILLAS_POR_ID[formato.plantillaId];
    if (!plantilla) throw new Error(`No existe la plantilla "${formato.plantillaId}" (formato "${formato.id}")`);
    return plantilla;
  }
  return cargarPlantillaPorMarca(marca);
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
