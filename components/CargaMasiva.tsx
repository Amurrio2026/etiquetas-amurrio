"use client";

import { useRef, useState } from "react";
import ResumenCarga from "./ResumenCarga";

export interface ResumenValidacion {
  totalFilasLeidas: number;
  skusUnicos: number;
  duplicados: number;
  encontrados: number;
  noEncontrados: number;
  sinPrecio: number;
  precioParcial: number;
  /** Solo carga masiva con precios en el archivo: articulos con una lista necesaria vacia (no se generan). */
  preciosIncompletos?: number;
  inactivosODiscontinuados: number;
  totalEtiquetas: number;
  /** Carga masiva: listas del archivo que se usaron / que se ignoraron para esta sucursal. */
  listasUsadasDelArchivo?: string[];
  listasIgnoradas?: string[];
  /** Solo lo llena /api/etiquetas/validar-contenedor (carga "Por contenedor"). */
  codigoContenedor?: string;
  /** Solo lo llena /api/etiquetas/validar-proveedor (carga "Por contenedor" -> proveedor nacional). */
  proveedor?: string;
}

export interface DetalleValidacion {
  duplicados: string[];
  noEncontrados: string[];
  sinPrecio: string[];
  precioParcial: string[];
  preciosIncompletos?: string[];
  inactivosODiscontinuados: string[];
}

export interface ResultadoValidacion {
  resumen: ResumenValidacion;
  detalle: DetalleValidacion;
  lineasValidas: {
    sku: string;
    cantidad: number;
    precios?: { lista2?: number | null; lista3?: number | null; lista6?: number | null };
  }[];
}

interface Props {
  sucursalCodigo: number | null;
  resultado: ResultadoValidacion | null;
  onResultado: (resultado: ResultadoValidacion | null) => void;
  onError: (mensaje: string) => void;
}

interface FilaCruda {
  sku: string;
  cantidad?: number;
  // Precios del archivo: undefined = esa columna no existe en el archivo;
  // null = la columna existe pero la celda esta vacia o no es un numero.
  lista2?: number | null;
  lista3?: number | null;
  lista6?: number | null;
}

const ENCABEZADOS_SKU = new Set(["sku", "codigo", "código", "cod", "cod.", "ean"]);

function normalizar(t: unknown): string {
  return String(t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Que significa un encabezado de columna: codigo, cantidad o precio de lista 2/3/6. */
function tipoEncabezado(celda: unknown): "sku" | "cantidad" | "lista2" | "lista3" | "lista6" | null {
  const t = normalizar(celda);
  if (!t) return null;
  if (ENCABEZADOS_SKU.has(t) || t.startsWith("codigo") || t.startsWith("cod ")) return "sku";
  if (t.startsWith("cant")) return "cantidad";
  const m = t.match(/lista\s*([236])\b/) || t.match(/^l\s*([236])$/) || t.match(/precio\D*([236])$/);
  if (m) return ("lista" + m[1]) as "lista2" | "lista3" | "lista6";
  return null;
}

/** Interpreta un precio escrito a la argentina ("$ 14.900", "14.900,50", "14900") o numerico. */
function parsearPrecio(crudo: unknown): number | null {
  if (crudo === undefined || crudo === null) return null;
  if (typeof crudo === "number") return Number.isFinite(crudo) && crudo > 0 ? crudo : null;
  let t = String(crudo).replace(/[$\s]/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Interpreta filas (array de arrays, como devuelven papaparse/xlsx) en items {sku, cantidad, precios},
 * detectando la fila de encabezado: reconoce columnas de codigo, cantidad y "Lista 6/3/2". Sin encabezados
 * (o solo con codigo/cantidad) funciona como siempre: columna 1 = codigo, columna 2 = cantidad. */
function filasAItems(filas: unknown[][]): FilaCruda[] {
  if (filas.length === 0) return [];

  const primera = filas[0] ?? [];
  const tipos = primera.map((c) => tipoEncabezado(c));
  const tieneEncabezado = tipos.some((t) => t !== null);
  const datos = tieneEncabezado ? filas.slice(1) : filas;

  let colSku = 0;
  let colCantidad: number | undefined = 1;
  const colPrecio: Partial<Record<"lista2" | "lista3" | "lista6", number>> = {};
  if (tieneEncabezado) {
    const iSku = tipos.indexOf("sku");
    colSku = iSku >= 0 ? iSku : 0;
    const iCant = tipos.indexOf("cantidad");
    const iL2 = tipos.indexOf("lista2");
    const iL3 = tipos.indexOf("lista3");
    const iL6 = tipos.indexOf("lista6");
    if (iL2 >= 0) colPrecio.lista2 = iL2;
    if (iL3 >= 0) colPrecio.lista3 = iL3;
    if (iL6 >= 0) colPrecio.lista6 = iL6;
    const hayPrecios = Object.keys(colPrecio).length > 0;
    // Con encabezado de cantidad se usa esa columna; sin encabezados de precio se mantiene el
    // comportamiento de siempre (segunda columna = cantidad).
    colCantidad = iCant >= 0 ? iCant : hayPrecios ? undefined : 1;
  }

  const items: FilaCruda[] = [];
  for (const fila of datos) {
    const sku = String(fila?.[colSku] ?? "").trim();
    if (!sku) continue;
    const crudo = colCantidad === undefined ? undefined : fila?.[colCantidad];
    const cantidad = crudo !== undefined && crudo !== null && String(crudo).trim() !== "" ? Number(crudo) : undefined;
    const item: FilaCruda = { sku, cantidad: cantidad && cantidad > 0 ? Math.floor(cantidad) : undefined };
    for (const lista of ["lista2", "lista3", "lista6"] as const) {
      const col = colPrecio[lista];
      if (col !== undefined) item[lista] = parsearPrecio(fila?.[col]);
    }
    items.push(item);
  }
  return items;
}

async function parsearArchivo(file: File): Promise<FilaCruda[]> {
  const nombre = file.name.toLowerCase();

  if (nombre.endsWith(".csv")) {
    const Papa = (await import("papaparse")).default;
    const texto = await file.text();
    const resultado = Papa.parse<string[]>(texto, { skipEmptyLines: true });
    return filasAItems(resultado.data as unknown[][]);
  }

  if (nombre.endsWith(".xlsx") || nombre.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const libro = XLSX.read(buffer, { type: "array" });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: "" });
    return filasAItems(filas);
  }

  throw new Error("Formato no soportado. Subí un archivo .csv, .xlsx o .xls");
}

function descargarPlantilla() {
  const csv = "\uFEFFCódigo;Cantidad;Lista 6;Lista 3;Lista 2\r\n7790000000001;10;14900;18625;16539\r\n7790000000002;5;9900;12400;11000\r\n";
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "ejemplo-carga-masiva.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function CargaMasiva({ sucursalCodigo, resultado, onResultado, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  async function alElegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!sucursalCodigo) {
      onError("Elegí primero la sucursal.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setNombreArchivo(file.name);
    setProcesando(true);
    onResultado(null);
    try {
      const items = await parsearArchivo(file);
      if (items.length === 0) {
        onError("No se encontró ningún código en el archivo.");
        return;
      }

      const res = await fetch("/api/etiquetas/validar-masivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sucursalCodigo, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo validar el archivo");
      onResultado(data as ResultadoValidacion);
    } catch (err: any) {
      onError(err.message || "No se pudo leer el archivo.");
    } finally {
      setProcesando(false);
    }
  }

  function limpiar() {
    setNombreArchivo(null);
    onResultado(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Carga masiva de códigos</h2>
        {nombreArchivo && (
          <button type="button" onClick={limpiar} className="text-xs text-gray-500 hover:text-gray-800">
            Quitar archivo
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Subí un Excel o CSV con una columna de códigos (y opcionalmente una columna de cantidad — si no la
        incluís, se genera 1 etiqueta por código). También podés sumar columnas con los precios{" "}
        <span className="font-medium">Lista 6, Lista 3 y Lista 2</span> (con ese encabezado en la primera fila): la
        etiqueta usa los precios del archivo y respeta las listas de cada sucursal (Rauch, Ayacucho y Madariaga usan
        solo Lista 2; el resto Lista 6 y Lista 3). Si una lista que la sucursal necesita viene vacía, esa etiqueta no
        se genera y se avisa.
      </p>
      <button
        type="button"
        onClick={descargarPlantilla}
        className="text-xs font-medium text-gray-700 underline hover:text-gray-900"
      >
        Descargar archivo de ejemplo (CSV)
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={alElegirArchivo}
        disabled={procesando}
        className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-gray-700"
      />

      {procesando && <p className="text-sm text-gray-500">Procesando {nombreArchivo}...</p>}

      {resultado && !procesando && <ResumenCarga titulo={nombreArchivo ?? ""} resultado={resultado} />}
    </div>
  );
}
