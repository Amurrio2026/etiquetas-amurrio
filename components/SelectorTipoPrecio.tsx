"use client";

import type { TipoPrecio } from "@/types";

interface Props {
  valor: TipoPrecio;
  onCambiar: (tipo: TipoPrecio) => void;
}

const OPCIONES: { valor: TipoPrecio; etiqueta: string; ayuda: string }[] = [
  { valor: "lista", etiqueta: "Lista", ayuda: "Precio de lista (2 o 3 según sucursal)" },
  { valor: "efectivo", etiqueta: "Efectivo", ayuda: "Precio de caja (lista 6)" },
];

export default function SelectorTipoPrecio({ valor, onCambiar }: Props) {
  return (
    <div className="block">
      <span className="text-xs font-semibold text-gray-700">Tipo de precio</span>
      <div className="mt-1 grid grid-cols-2 gap-2">
        {OPCIONES.map((op) => (
          <button
            key={op.valor}
            type="button"
            onClick={() => onCambiar(op.valor)}
            title={op.ayuda}
            className={
              "rounded-md border px-3 py-2 text-sm font-medium " +
              (valor === op.valor
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50")
            }
          >
            {op.etiqueta}
          </button>
        ))}
      </div>
    </div>
  );
}
