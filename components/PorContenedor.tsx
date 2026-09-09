"use client";

import { useState } from "react";
import ResumenCarga from "./ResumenCarga";
import type { ResultadoValidacion } from "./CargaMasiva";

interface Props {
  sucursalCodigo: number | null;
  resultado: ResultadoValidacion | null;
  onResultado: (resultado: ResultadoValidacion | null) => void;
  onError: (mensaje: string) => void;
}

export default function PorContenedor({ sucursalCodigo, resultado, onResultado, onError }: Props) {
  const [contenedor, setContenedor] = useState("");
  const [buscando, setBuscando] = useState(false);

  async function buscar() {
    const codigo = contenedor.trim();
    if (!sucursalCodigo) {
      onError("Elegí primero la sucursal.");
      return;
    }
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

  function limpiar() {
    setContenedor("");
    onResultado(null);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Etiquetas por contenedor</h2>
        {resultado && (
          <button type="button" onClick={limpiar} className="text-xs text-gray-500 hover:text-gray-800">
            Limpiar
          </button>
        )}
      </div>

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

      {resultado && !buscando && (
        <ResumenCarga
          titulo={resultado.resumen.codigoContenedor ? `Contenedor ${resultado.resumen.codigoContenedor}` : "Contenedor"}
          resultado={resultado}
        />
      )}
    </div>
  );
}
