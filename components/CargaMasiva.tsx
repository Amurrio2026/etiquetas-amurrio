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
  inactivosODiscontinuados: number;
  totalEtiquetas: number;
  /** Solo lo llena /api/etiquetas/validar-contenedor (carga "Por contenedor"). */
  codigoContenedor?: string;
}

export interface DetalleValidacion {
  duplicados: string[];
  noEncontrados: string[];
  sinPrecio: string[];
  precioParcial: string[];
  inactivosODiscontinuados: string[];
}

export interface ResultadoValidacion {
  resumen: ResumenValidacion;
  detalle: DetalleValidacion;
  lineasValidas: { sku: string; cantidad: number }[];
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
}

const ENCABEZADOS_SKU = new Set(["sku", "codigo", "código", "cod", "cod.", "ean"]);

/** Interpreta filas (array de arrays, como devuelven papaparse/xlsx) en {sku, cantidad}[],
 * salteando una eventual fila de encabezado ("sku", "cantidad", etc). */
function filasAItems(filas: unknown[][]): FilaCruda[] {
  if (filas.length === 0) return [];

  const primeraCelda = String(filas[0]?.[0] ?? "").trim().toLowerCase();
  const tieneEncabezado = ENCABEZADOS_SKU.has(primeraCelda);
  const datos = tieneEncabezado ? filas.slice(1) : filas;

  const items: FilaCruda[] = [];
  for (const fila of datos) {
    const sku = String(fila?.[0] ?? "").trim();
    if (!sku) continue;
    const crudo = fila?.[1];
    const cantidad = crudo !== undefined && crudo !== null && String(crudo).trim() !== "" ? Number(crudo) : undefined;
    items.push({ sku, cantidad: cantidad && cantidad > 0 ? Math.floor(cantidad) : undefined });
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
        Subí un Excel o CSV con una columna de códigos (y opcionalmente una segunda columna de
        cantidad — si no la incluís, se genera 1 etiqueta por código).
      </p>

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
