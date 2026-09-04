"use client";

import type { ArticuloConPrecio } from "@/types";

export interface LineaUI {
  articulo: ArticuloConPrecio;
  cantidad: number;
}

interface Props {
  lineas: LineaUI[];
  onCambiarCantidad: (sku: string, cantidad: number) => void;
  onEliminar: (sku: string) => void;
}

export default function ListadoEtiquetas({ lineas, onCambiarCantidad, onEliminar }: Props) {
  const totalDistintos = lineas.length;
  const totalEtiquetas = lineas.reduce((acc, l) => acc + l.cantidad, 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">Listado de etiquetas</h2>
        <div className="text-xs text-gray-500">
          <span className="font-medium text-gray-900">{totalDistintos}</span> artículos distintos ·{" "}
          <span className="font-medium text-gray-900">{totalEtiquetas}</span> etiquetas en total
        </div>
      </div>

      {lineas.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">Todavía no escaneaste ningún artículo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-200">
                <th className="py-2 pr-2">Artículo</th>
                <th className="py-2 pr-2">Código</th>
                <th className="py-2 pr-2">Precio</th>
                <th className="py-2 pr-2 w-24">Cantidad</th>
                <th className="py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => (
                <tr key={l.articulo.sku} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-2">{l.articulo.descripcion}</td>
                  <td className="py-2 pr-2 font-mono text-xs text-gray-500">{l.articulo.sku}</td>
                  <td className="py-2 pr-2 tabular-nums">
                    ${Math.round(l.articulo.precioVenta ?? 0).toLocaleString("es-AR")}
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={1}
                      value={l.cantidad}
                      onChange={(e) => onCambiarCantidad(l.articulo.sku, Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 rounded border border-gray-300 px-2 py-1 text-sm tabular-nums"
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onEliminar(l.articulo.sku)}
                      className="text-gray-400 hover:text-red-600 text-xs"
                      aria-label={`Eliminar ${l.articulo.descripcion}`}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
