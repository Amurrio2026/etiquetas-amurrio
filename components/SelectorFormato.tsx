"use client";

import type { FormatoHoja } from "@/types";

interface Props {
  formatos: FormatoHoja[];
  valor: string | null;
  onCambiar: (id: string) => void;
}

export default function SelectorFormato({ formatos, valor, onCambiar }: Props) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-700">Formato de hoja</span>
      <select
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        value={valor ?? ""}
        onChange={(e) => onCambiar(e.target.value)}
      >
        <option value="" disabled>
          Elegí un formato
        </option>
        {formatos.map((f) => (
          <option key={f.id} value={f.id}>
            {f.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
