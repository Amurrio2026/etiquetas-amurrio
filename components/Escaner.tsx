"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onScan: (codigo: string) => void;
}

const ID_CAMARA = "lector-camara";

/**
 * Un solo componente atiende las dos formas de "escanear" que pidio Lucila:
 * - Lector USB en PC: se comporta como un teclado, asi que alcanza con un
 *   input siempre enfocado que dispara onScan al apretar Enter.
 * - Camara en celular/tablet: boton para activarla, usa html5-qrcode.
 */
export default function Escaner({ onScan }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);
  const ultimoCodigoRef = useRef<{ codigo: string; ts: number }>({ codigo: "", ts: 0 });

  // Mantiene el foco en el input para que el lector USB siempre pueda "escribir" ahi.
  useEffect(() => {
    const reenfocar = () => {
      if (!camaraActiva) inputRef.current?.focus();
    };
    reenfocar();
    document.addEventListener("click", reenfocar);
    return () => document.removeEventListener("click", reenfocar);
  }, [camaraActiva]);

  function emitirCodigo(codigo: string) {
    const limpio = codigo.trim();
    if (!limpio) return;
    // Evita doble lectura del mismo codigo en menos de 1.5s (tipico si la
    // camara sigue enfocada sobre la misma etiqueta).
    const ahora = Date.now();
    if (ultimoCodigoRef.current.codigo === limpio && ahora - ultimoCodigoRef.current.ts < 1500) return;
    ultimoCodigoRef.current = { codigo: limpio, ts: ahora };
    onScan(limpio);
  }

  function alEnviarInput(e: React.FormEvent) {
    e.preventDefault();
    if (inputRef.current) {
      emitirCodigo(inputRef.current.value);
      inputRef.current.value = "";
    }
  }

  async function activarCamara() {
    setErrorCamara(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const instancia = new Html5Qrcode(ID_CAMARA);
      scannerRef.current = instancia;
      await instancia.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 140 } },
        (textoDecodificado: string) => emitirCodigo(textoDecodificado),
        () => {} // errores de lectura frame a frame, se ignoran (es normal mientras enfoca)
      );
      setCamaraActiva(true);
    } catch (err) {
      console.error(err);
      setErrorCamara("No se pudo abrir la cámara. Revisá los permisos del navegador.");
    }
  }

  async function detenerCamara() {
    try {
      await scannerRef.current?.stop();
      await scannerRef.current?.clear();
    } catch {
      // si ya estaba detenida, no pasa nada
    }
    setCamaraActiva(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-gray-700">Escanear artículo</h2>
        <button
          type="button"
          onClick={camaraActiva ? detenerCamara : activarCamara}
          className="text-xs font-medium px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-700"
        >
          {camaraActiva ? "Apagar cámara" : "Usar cámara"}
        </button>
      </div>

      {errorCamara && <p className="text-sm text-red-600 mb-2">{errorCamara}</p>}

      <div id={ID_CAMARA} className={camaraActiva ? "mb-3 rounded-md overflow-hidden" : "hidden"} />

      <form onSubmit={alEnviarInput}>
        <input
          ref={inputRef}
          autoFocus
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="Escaneá con el lector o escribí el código y apretá Enter"
        />
      </form>
      <p className="mt-2 text-xs text-gray-500">
        En PC: hacé clic en cualquier parte de la pantalla y usá el lector — no hace falta tocar nada más.
      </p>
    </div>
  );
}
