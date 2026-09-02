import fs from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, StandardFonts } from "pdf-lib";
import type { Plantilla } from "@/types";

export interface JuegoFuentes {
  regular: PDFFont;
  bold: PDFFont;
  extrabold: PDFFont;
}

const CARPETA_FUENTES = path.join(process.cwd(), "assets", "fonts");

// Familias que no necesitan archivo: ya vienen incluidas en cualquier lector de PDF.
const FAMILIAS_ESTANDAR: Record<string, StandardFonts> = {
  Helvetica: StandardFonts.Helvetica,
  "Helvetica-Bold": StandardFonts.HelveticaBold,
  Arial: StandardFonts.Helvetica, // Helvetica es la equivalencia estandar de Arial en PDF
  "Arial-Bold": StandardFonts.HelveticaBold,
};

async function intentarCargarArchivo(doc: PDFDocument, archivo: string): Promise<PDFFont | null> {
  try {
    const bytes = await fs.readFile(path.join(CARPETA_FUENTES, archivo));
    return await doc.embedFont(bytes);
  } catch {
    return null;
  }
}

async function embeberRol(
  doc: PDFDocument,
  familia: string,
  rol: "regular" | "bold" | "extrabold",
  fallback: PDFFont
): Promise<PDFFont> {
  if (FAMILIAS_ESTANDAR[familia]) {
    return doc.embedFont(FAMILIAS_ESTANDAR[familia]);
  }
  // Fuente propia: se espera un archivo "<Familia sin espacios>-<Rol>.ttf" en assets/fonts/
  const nombreArchivo = `${familia.replace(/\s+/g, "")}-${rol === "regular" ? "Medium" : rol === "bold" ? "Bold" : "ExtraBold"}.ttf`;
  const cargada = await intentarCargarArchivo(doc, nombreArchivo);
  return cargada ?? fallback;
}

/**
 * Carga las 3 fuentes (regular/bold/extrabold) que pide una plantilla.
 * - Si la familia es Helvetica/Arial, usa la fuente estandar del PDF (siempre
 *   disponible, sin archivos ni licencias).
 * - Si es una fuente propia (por ejemplo "Baloo 2"), busca el .ttf en
 *   assets/fonts/. Si todavia no esta, cae en Helvetica para que la
 *   generacion de PDF funcione igual mientras se consigue el archivo.
 */
export async function cargarFuentesDePlantilla(doc: PDFDocument, fonts: Plantilla["fonts"]): Promise<JuegoFuentes> {
  doc.registerFontkit(fontkit);

  const fallbackRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fallbackBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const regular = await embeberRol(doc, fonts.regular.family, "regular", fallbackRegular);
  const bold = await embeberRol(doc, fonts.bold.family, "bold", fallbackBold);
  const extrabold = await embeberRol(doc, fonts.extrabold.family, "extrabold", fallbackBold);

  return { regular, bold, extrabold };
}
