"use client";

import { useEffect, useState } from "react";
import ResumenCarga from "./ResumenCarga";
import type { ResultadoValidacion } from "./CargaMasiva";

interface Props {
  sucursalCodigo: number | null;
  resultado: ResultadoValidacion | null;
  onResultado: (resultado: ResultadoValidacion | null) => void;
  onError: (mensaje: string) => void;
}

type Modo = "contenedor" | "proveedor";

export default function PorContenedor({ sucursalCodigo, resultado, onResultado, onError }: Props) {
  const [modo, setModo] = useState<Modo>("contenedor");
  const [contenedor, setContenedor] = useState("");
  const [proveedores, setProveedores] = useState<string[]>([]);
  const [proveedor, setProveedor] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [buscando, setBuscando] = useState(false);

  // La lista de proveedores nacionales (valores de "familia" que no son un
  // código de contenedor) se carga una sola vez, recien cuando se elige el
  // modo "Proveedor nacional" -- no hace falta pedirla si nunca se usa esta opción.
  useEffect(() => {
    if (modo !== "proveedor" || proveedores.length > 0) return;
    fetch("/api/proveedores")
      .then((r) => r.json())
      .then((data) => setProveedores(Array.isArray(data) ? data : []))
      .catch(() => onError("No se pudo cargar la lista de proveedores nacionales."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  async function buscarPorContenedor() {
    const codigo = contenedor.trim();
    if (!codigo) {
      onError("Anotá el número de contenedor.");
      return;
    }
    setBuscando(true);
    onResultado(null);
    try {
      const res = await fetch("/api/etiquetas/validar-contenedor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sucursalCodigo, contenedor: codigo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo buscar el contenedor");
      onResultado(data as ResultadoValidacion);
    } catch (err: any) {
      onError(err.message || "No se pudo buscar el contenedor.");
    } finally {
      setBuscando(false);
    }
  }

  async function buscarPorProveedor() {
    if (!proveedor) {
      onError("Elegí el proveedor nacional.");
      return;
    }
    if ((fechaDesde && !fechaHasta) || (!fechaDesde && fechaHasta)) {
      onError('Completá las dos fechas ("desde" y "hasta"), o dejá las dos vacías para traer todo el catálogo del proveedor.');
      return;
    }
    setBuscando(true);
    onResultado(null);
    try {
      const res = await fetch("/api/etiquetas/validar-proveedor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sucursalCodigo,
          proveedor,
          fechaDesde: fechaDesde || undefined,
          fechaHasta: fechaHasta || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo buscar el proveedor");
      onResultado(data as ResultadoValidacion);
    } catch (err: any) {
      onError(err.message || "No se pudo buscar el proveedor.");
    } finally {
      setBuscando(false);
    }
  }

  function buscar() {
    if (!sucursalCodigo) {
      onError("Elegí primero la sucursal.");
      return;
    }
    if (modo === "contenedor") buscarPorContenedor();
    else buscarPorProveedor();
  }

  function limpiar() {
    setContenedor("");
    setProveedor("");
    setFechaDesde("");
    setFechaHasta("");
    onResultado(null);
  }

  function cambiarModo(nuevo: Modo) {
    setModo(nuevo);
    onResultado(null);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Etiquetas por contenedor / proveedor</h2>
        {resultado && (
          <button type="button" onClick={limpiar} className="text-xs text-gray-500 hover:text-gray-800">
            Limpiar
          </button>
        )}
      </div>

      <div className="flex gap-2 rounded-lg border border-gray-200 bg-gray-50 p-1 w-fit">
        <button
          type="button"
          onClick={() => cambiarModo("contenedor")}
          className={
            "rounded-md px-3 py-1.5 text-xs font-medium " +
            (modo === "contenedor" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100")
          }
        >
          Por contenedor
        </button>
        <button
          type="button"
          onClick={() => cambiarModo("proveedor")}
          className={
            "rounded-md px-3 py-1.5 text-xs font-medium " +
            (modo === "proveedor" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100")
          }
        >
          Proveedor nacional
        </button>
      </div>

      {modo === "contenedor" ? (
        <>
          <p className="text-xs text-gray-500">
            Anotá el número de contenedor (ej: 292 o BYM292) y se genera una etiqueta por cada artículo
            que llegó en ese contenedor.
          </p>
          <div className="flex gap-2">
            <input
              value={contenedor}
              onChange={(e) => setContenedor(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscar()}
              placeholder="Ej: 292"
              disabled={buscando}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={buscar}
              disabled={buscando}
              className="rounded-md bg-gray-900 text-white text-sm font-medium px-4 py-2 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {buscando ? "Buscando..." : "Buscar"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-gray-500">
            Elegí un proveedor nacional para generar una etiqueta por cada artículo suyo. Si el proveedor
            tiene muchos artículos, completá también un rango de fechas para traer solo los que
            tuvieron un cambio de precio en ese período (en vez de todo el catálogo).
          </p>
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">Proveedor</span>
            <select
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              disabled={buscando}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Elegí un proveedor</option>
              {proveedores.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <label className="flex-1 block">
              <span className="text-xs font-semibold text-gray-700">Precio modificado desde (opcional)</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                disabled={buscando}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex-1 block">
              <span className="text-xs font-semibold text-gray-700">Hasta (opcional)</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                disabled={buscando}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={buscar}
            disabled={buscando}
            className="rounded-md bg-gray-900 text-white text-sm font-medium px-4 py-2 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {buscando ? "Buscando..." : "Buscar"}
          </button>
        </>
      )}

      {resultado && !buscando && (
        <ResumenCarga
          titulo={
            resultado.resumen.codigoContenedor
              ? `Contenedor ${resultado.resumen.codigoContenedor}`
              : resultado.resumen.proveedor
              ? `Proveedor ${resultado.resumen.proveedor}`
              : "Resultado"
          }
          resultado={resultado}
        />
      )}
    </div>
  );
}
