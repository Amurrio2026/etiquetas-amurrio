import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFFont, PDFPage, rgb, type RGB } from "pdf-lib";
import type { ArticuloConPrecio, FormatoHoja, Plantilla, PlantillaElemento } from "@/types";
import { cargarFuentesDePlantilla, type JuegoFuentes } from "@/lib/pdf/fonts";
import { paginarEtiquetas, type Hoja } from "@/lib/pdf/paginar";
import type { LineaEtiqueta } from "@/types";

const PT_POR_MM = 2.8346456693;
const mm = (v: number) => v * PT_POR_MM;

function hexAColor(hex: string): RGB {
  const limpio = hex.replace("#", "");
  const r = parseInt(limpio.slice(0, 2), 16) / 255;
  const g = parseInt(limpio.slice(2, 4), 16) / 255;
  const b = parseInt(limpio.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function colorDePaleta(plantilla: Plantilla, clave: string): RGB {
  const hex = plantilla.palette[clave];
  if (!hex) throw new Error(`Color "${clave}" no existe en la paleta de la plantilla "${plantilla.id}"`);
  return hexAColor(hex);
}

function fuentePorRol(fuentes: JuegoFuentes, rol: string): PDFFont {
  if (rol === "bold") return fuentes.bold;
  if (rol === "extrabold") return fuentes.extrabold;
  return fuentes.regular;
}

function formatearValor(valor: unknown, formato: string | undefined): string {
  if (formato === "moneda_ars_sin_decimales") {
    // null = todavia no hay precio cargado en esa lista para este articulo
    // (ver lib/precios/resolver-precio.ts) -- se imprime "-", nunca "$0"
    // (mostrar $0 en una etiqueta fisica seria un precio inventado).
    if (valor === null || valor === undefined) return "-";
    const n = Math.round(Number(valor) || 0);
    return "$" + n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  }
  return String(valor ?? "");
}

// Las plantillas nombran los campos como en la base ("precio_efectivo",
// "precio_lista") para que sea mas facil de leer/editar para alguien
// no-programador; aca se traduce al nombre real de la propiedad en el
// objeto ArticuloConPrecio (camelCase en TS). Estos dos son los precios YA
// RESUELTOS segun sucursal (ver lib/precios/resolver-precio.ts), no
// columnas de la base -- la etiqueta siempre muestra los dos juntos.
const ALIAS_CAMPO: Record<string, keyof ArticuloConPrecio> = {
  precio_efectivo: "precioEfectivo",
  precio_lista: "precioLista",
  sku: "sku",
  descripcion: "descripcion",
  categoria: "categoria",
  marca: "marcaProducto",
};

/** Reemplaza "articulo.campo" por el valor real del articulo. */
function resolverCampo(ruta: string, articulo: ArticuloConPrecio): unknown {
  const partes = ruta.split(".");
  if (partes[0] !== "articulo") return undefined;
  const clave = ALIAS_CAMPO[partes[1]];
  if (!clave) return undefined;
  return articulo[clave];
}

function resolverTemplateTexto(tpl: string, articulo: ArticuloConPrecio): string {
  return tpl.replace(/\{([^}]+)\}/g, (_match, ruta) => String(resolverCampo(ruta, articulo) ?? ""));
}

/** Dibuja texto con separacion entre letras (usado en "Codigo: xxxx"). */
function dibujarTextoConTracking(
  page: PDFPage,
  texto: string,
  xPt: number,
  yPt: number,
  font: PDFFont,
  sizePt: number,
  color: RGB,
  trackingPt: number
) {
  let cursor = xPt;
  for (const char of texto) {
    page.drawText(char, { x: cursor, y: yPt, size: sizePt, font, color });
    cursor += font.widthOfTextAtSize(char, sizePt) + trackingPt;
  }
}

/**
 * Ajusta un texto largo (la descripcion del articulo, que no tiene largo
 * maximo garantizado) para que entre en el ancho disponible, en vez de
 * sobresalir de la etiqueta como pasaba antes:
 * 1) intenta UNA linea, achicando la fuente hasta `sizeMinimo`.
 * 2) si ni asi entra, parte en HASTA 2 lineas al tamaño minimo.
 * 3) si la segunda linea sigue sin entrar, la corta con "…".
 */
function ajustarTextoACaja(
  font: PDFFont,
  texto: string,
  anchoDisponiblePt: number,
  sizeInicial: number,
  sizeMinimo: number
): { lineas: string[]; size: number } {
  let size = sizeInicial;
  while (size > sizeMinimo && font.widthOfTextAtSize(texto, size) > anchoDisponiblePt) size -= 0.25;
  if (font.widthOfTextAtSize(texto, size) <= anchoDisponiblePt) return { lineas: [texto], size };

  size = sizeMinimo;
  const palabras = texto.split(" ");
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (!actual || font.widthOfTextAtSize(prueba, size) <= anchoDisponiblePt) {
      actual = prueba;
    } else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);

  if (lineas.length > 2) {
    const resto = lineas.slice(1).join(" ");
    let segunda = resto;
    while (segunda.length > 1 && font.widthOfTextAtSize(`${segunda}…`, size) > anchoDisponiblePt) {
      segunda = segunda.slice(0, -1).trimEnd();
    }
    return { lineas: [lineas[0], `${segunda}…`], size };
  }
  return { lineas, size };
}

/** Rectangulo con puntas redondeadas ("pildora"), aproximado con 2 circulos + un rectangulo central. */
function dibujarPildora(page: PDFPage, xPt: number, yTopPt: number, wPt: number, hPt: number, color: RGB, pageHeightPt: number) {
  const yBottomPt = pageHeightPt - (yTopPt + hPt);
  const radio = hPt / 2;
  page.drawRectangle({ x: xPt + radio, y: yBottomPt, width: Math.max(wPt - 2 * radio, 0), height: hPt, color });
  page.drawEllipse({ x: xPt + radio, y: yBottomPt + radio, xScale: radio, yScale: radio, color });
  page.drawEllipse({ x: xPt + wPt - radio, y: yBottomPt + radio, xScale: radio, yScale: radio, color });
}

async function dibujarEtiqueta(
  page: PDFPage,
  pageHeightPt: number,
  offsetXMm: number,
  offsetYMm: number,
  plantilla: Plantilla,
  articulo: ArticuloConPrecio,
  fuentes: JuegoFuentes,
  logoImg: Awaited<ReturnType<PDFDocument["embedPng"]>> | null
) {
  for (const el of plantilla.elements as (PlantillaElemento & Record<string, any>)[]) {
    if (el.type === "rect") {
      const xPt = mm(offsetXMm + el.x);
      const yTopPt = mm(offsetYMm + el.y);
      const wPt = mm(el.w);
      const hPt = mm(el.h);
      page.drawRectangle({
        x: xPt,
        y: pageHeightPt - yTopPt - hPt,
        width: wPt,
        height: hPt,
        color: colorDePaleta(plantilla, el.fill),
      });
      continue;
    }

    if (el.type === "pill") {
      const xPt = mm(offsetXMm + el.x);
      const yTopPt = mm(offsetYMm + el.y);
      dibujarPildora(page, xPt, yTopPt, mm(el.w), mm(el.h), colorDePaleta(plantilla, el.fill), pageHeightPt);

      const label = el.label;
      const font = fuentePorRol(fuentes, label.font);
      const texto = label.text as string;
      // Ajusta el tamaño hacia abajo si la fuente de reemplazo (mientras no
      // esté la definitiva) es más ancha que la original y no entra en la píldora.
      const anchoDisponible = mm(el.w) - mm(1.5);
      let size = label.size_pt;
      while (size > 4.5 && font.widthOfTextAtSize(texto, size) > anchoDisponible) size -= 0.25;
      const anchoTexto = font.widthOfTextAtSize(texto, size);
      const xTextoPt = xPt + (mm(el.w) - anchoTexto) / 2;
      const yCentroPt = pageHeightPt - yTopPt - mm(el.h) / 2 - size * 0.35;
      page.drawText(texto, { x: xTextoPt, y: yCentroPt, size, font, color: colorDePaleta(plantilla, label.color) });
      continue;
    }

    if (el.type === "rule_con_puntas") {
      const yPt = mm(offsetYMm + el.y);
      const x0Pt = mm(offsetXMm + el.x0);
      const x1Pt = mm(offsetXMm + el.x1);
      const yLineaPt = pageHeightPt - yPt;
      const color = colorDePaleta(plantilla, el.color);
      page.drawLine({
        start: { x: x0Pt, y: yLineaPt },
        end: { x: x1Pt, y: yLineaPt },
        thickness: el.grosor_pt ?? 0.5,
        color,
      });
      const conPuntas = el.puntas !== false;
      if (conPuntas) {
        const radio = mm(el.diametro_punta_mm ?? 0.8) / 2;
        page.drawEllipse({ x: x0Pt, y: yLineaPt, xScale: radio, yScale: radio, color });
        page.drawEllipse({ x: x1Pt, y: yLineaPt, xScale: radio, yScale: radio, color });
      }
      continue;
    }

    if (el.type === "text") {
      const font = fuentePorRol(fuentes, el.font);
      const size = el.size_pt;
      const color = colorDePaleta(plantilla, el.color);

      let texto: string;
      if (el.template) texto = resolverTemplateTexto(el.template, articulo);
      else texto = formatearValor(resolverCampo(el.field, articulo), el.format);

      if (typeof el.baseline_y === "number") {
        // Texto de una linea con posicion de base ya calculada (precios, codigo).
        const xPt = mm(offsetXMm + el.x);
        const yPt = pageHeightPt - mm(offsetYMm + el.baseline_y);
        if (el.letter_spacing_mm) {
          dibujarTextoConTracking(page, texto, xPt, yPt, font, size, color, mm(el.letter_spacing_mm));
        } else {
          page.drawText(texto, { x: xPt, y: yPt, size, font, color });
        }
        continue;
      }

      // Texto dentro de una caja (titulo): se centra o alinea segun "align".
      // Si el texto (tipicamente la descripcion del articulo, que no tiene
      // largo maximo garantizado) no entra en el ancho de la caja, se achica
      // la fuente y, si aun asi no entra, se parte en hasta 2 lineas -- ver
      // ajustarTextoACaja(). Antes esto no se controlaba y el texto podia
      // salirse de la etiqueta.
      const boxXPt = mm(offsetXMm + el.x);
      const boxYTopPt = mm(offsetYMm + el.y);
      const boxWPt = mm(el.w);
      const boxHPt = mm(el.h ?? 0);
      const anchoDisponiblePt = boxWPt - mm(1); // un pelo de margen a cada lado

      const sizeMinimo = typeof el.min_size_pt === "number" ? el.min_size_pt : Math.max(5, size - 2.5);
      const { lineas: lineasTexto, size: sizeAjustado } = ajustarTextoACaja(font, texto, anchoDisponiblePt, size, sizeMinimo);

      const xParaLinea = (linea: string): number => {
        const anchoLinea = font.widthOfTextAtSize(linea, sizeAjustado);
        if (el.align === "center") return boxXPt + (boxWPt - anchoLinea) / 2;
        if (el.align === "right") return boxXPt + boxWPt - anchoLinea;
        return boxXPt;
      };

      if (lineasTexto.length === 1) {
        // Una sola linea: misma posicion vertical de siempre (no cambia nada
        // para el caso comun de una descripcion que ya entraba bien).
        const baselineOffsetPt = sizeAjustado * 0.78;
        const yTextoPt = pageHeightPt - boxYTopPt - baselineOffsetPt;
        page.drawText(lineasTexto[0], { x: xParaLinea(lineasTexto[0]), y: yTextoPt, size: sizeAjustado, font, color });
      } else {
        // Dos lineas: se acomodan centradas en el alto declarado de la caja
        // (o, si el bloque de texto es mas alto que la caja, arrancando
        // desde arriba para no invadir lo que esta por encima).
        const lineHeightPt = sizeAjustado * 1.15;
        const bloqueAltoPt = lineasTexto.length * lineHeightPt;
        const extraPt = Math.max(0, (boxHPt - bloqueAltoPt) / 2);
        let yCursorPt = pageHeightPt - boxYTopPt - extraPt - sizeAjustado * 0.78;
        for (const linea of lineasTexto) {
          page.drawText(linea, { x: xParaLinea(linea), y: yCursorPt, size: sizeAjustado, font, color });
          yCursorPt -= lineHeightPt;
        }
      }
      continue;
    }

    if (el.type === "image" && logoImg) {
      const wPt = mm(el.w);
      const hPt = mm(el.h);
      const labelWPt = mm(plantilla.label.width_mm);
      const labelHPt = mm(plantilla.label.height_mm);
      const xPt = mm(offsetXMm) + labelWPt - mm(el.align_right_margin_mm) - wPt;
      const yTopPt = mm(offsetYMm) + labelHPt - mm(el.align_bottom_margin_mm) - hPt;
      page.drawImage(logoImg, { x: xPt, y: pageHeightPt - yTopPt - hPt, width: wPt, height: hPt });
      continue;
    }
  }
}

export interface OpcionesGenerarPdf {
  lineas: LineaEtiqueta[];
  formato: FormatoHoja;
  plantilla: Plantilla;
}

/**
 * Genera el PDF completo: reparte las etiquetas en hojas segun el formato
 * elegido y dibuja cada una con la plantilla de la marca correspondiente.
 */
export async function generarPdf({ lineas, formato, plantilla }: OpcionesGenerarPdf): Promise<Uint8Array> {
  const hojas: Hoja[] = paginarEtiquetas(lineas, formato);
  if (hojas.length === 0) throw new Error("No hay etiquetas para generar");

  const doc = await PDFDocument.create();
  const fuentes = await cargarFuentesDePlantilla(doc, plantilla.fonts);

  let logoImg = null;
  const logoElemento = plantilla.elements.find((e) => e.type === "image") as (PlantillaElemento & { asset: string }) | undefined;
  if (logoElemento) {
    try {
      const bytes = await fs.readFile(path.join(process.cwd(), "public", logoElemento.asset));
      logoImg = await doc.embedPng(bytes);
    } catch {
      logoImg = null; // sin logo el PDF igual se genera, solo que sin la imagen
    }
  }

  const pageWidthPt = mm(formato.hojaAnchoMm);
  const pageHeightPt = mm(formato.hojaAltoMm);

  for (const hoja of hojas) {
    const page = doc.addPage([pageWidthPt, pageHeightPt]);
    for (const pos of hoja) {
      const offsetXMm = formato.margenXMm + pos.columna * (plantilla.label.width_mm + formato.espacioXMm);
      const offsetYMm = formato.margenYMm + pos.fila * (plantilla.label.height_mm + formato.espacioYMm);
      await dibujarEtiqueta(page, pageHeightPt, offsetXMm, offsetYMm, plantilla, pos.articulo, fuentes, logoImg);
    }
  }

  return doc.save();
}
