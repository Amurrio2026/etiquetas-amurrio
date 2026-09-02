"use client";

import type { Sucursal } from "@/types";

interface Props {
  sucursales: Sucursal[];
  valor: number | null;
  onCambiar: (codigoSucursal: number) => void;
}

export default function SelectorSucursal({ sucursales, valor, onCambiar }: Props) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-700">Sucursal</span>
      <select
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        value={valor ?? ""}
        onChange={(e) => onCambiar(Number(e.target.value))}
      >
        <option value="" disabled>
          Elegí una sucursal
        </option>
        {sucursales.map((s) => (
          <option key={s.codigoSucursal} value={s.codigoSucursal}>
            {s.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
