"use client";

import { useEffect, useState } from "react";

interface Props {
  valor: number;
  onCambiar: (cantidad: number) => void;
  onEnter?: () => void;
  className?: string;
  autoFocus?: boolean;
}

/**
 * Campo de cantidad que deja BORRAR y escribir (ej. borrar el 1 y poner 8).
 * Antes el campo forzaba "minimo 1" en cada tecla, asi que al borrar el numero
 * volvia a aparecer el 1 al instante y no se podia escribir otro. Ahora el
 * texto se edita libre; el valor numerico solo se actualiza cuando lo escrito
 * es un entero >= 1, y al salir del campo vacio vuelve al ultimo valor valido.
 */
export default function CampoCantidad({ valor, onCambiar, onEnter, className, autoFocus }: Props) {
  const [texto, setTexto] = useState(String(valor));

  // Si el valor cambia desde afuera (ej. se suma al agregar un articulo repetido), se refleja.
  useEffect(() => {
    setTexto(String(valor));
  }, [valor]);

  return (
    <input
      type="text"
      inputMode="numeric"
      autoFocus={autoFocus}
      value={texto}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const limpio = e.target.value.replace(/\D/g, "");
        setTexto(limpio);
        const n = parseInt(limpio, 10);
        if (Number.isFinite(n) && n >= 1) onCambiar(n);
      }}
      onBlur={() => {
        const n = parseInt(texto, 10);
        if (!Number.isFinite(n) || n < 1) setTexto(String(valor));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") onEnter?.();
      }}
      className={className}
    />
  );
}
