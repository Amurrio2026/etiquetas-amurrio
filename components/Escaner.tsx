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
    if (!camaraActiva) inputRef.current?.focus();

    const reenfocar = (e: MouseEvent) => {
      if (camaraActiva) return;
      const target = e.target as HTMLElement | null;
      // No robar el foco si el clic fue sobre otro control interactivo
      // (los <select> de sucursal/formato, otros inputs, botones...): si no,
      // el desplegable se abre y se cierra solo porque el foco vuelve
      // inmediatamente al input del lector apenas se lo toca.
      if (target?.closest("select, input, textarea, button, a")) return;
      inputRef.current?.focus();
    };
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

  function activarCamara() {
    setErrorCamara(null);
    // Solo pide mostrar el contenedor; el arranque real de la camara
    // ocurre en el useEffect de abajo, una vez que el div ya esta
    // visible en pantalla (ver comentario ahi).
    setCamaraActiva(true);
  }

  function detenerCamara() {
    setCamaraActiva(false);
  }

  // Arranca/para la camara reaccionando a camaraActiva en vez de hacerlo
  // dentro del handler del boton. Esto es clave: html5-qrcode necesita que
  // el div #lector-camara ya este visible (no display:none) en el momento
  // de llamar a start(), porque calcula el tamano del recuadro de escaneo
  // en base al tamano del contenedor. Antes se llamaba a start() con el
  // div todavia oculto y recien despues se lo mostraba, lo que rompia el
  // calculo y la camara no llegaba a leer codigos (sobre todo en celulares).
  useEffect(() => {
    if (!camaraActiva) return;
    let cancelado = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelado) return;
        const instancia = new Html5Qrcode(ID_CAMARA);
        scannerRef.current = instancia;
        await instancia.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 140 } },
          (textoDecodificado: string) => emitirCodigo(textoDecodificado),
          () => {} // errores de lectura frame a frame, se ignoran (es normal mientras enfoca)
        );
        if (cancelado) {
          try {
            await instancia.stop();
          } catch {}
          try {
            instancia.clear();
          } catch {}
        }
      } catch (err) {
        console.error(err);
        if (!cancelado) {
          setErrorCamara("No se pudo abrir la cámara. Revisá los permisos del navegador.");
          setCamaraActiva(false);
        }
      }
    })();

    return () => {
      cancelado = true;
      scannerRef.current
        ?.stop()
        .catch(() => {})
        .finally(() => {
          try {
            scannerRef.current?.clear();
          } catch {}
        });
      setTimeout(() => inputRef.current?.focus(), 50);
    };
  }, [camaraActiva]);

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

      {/*
        min-height fijo: html5-qrcode mide el tamaño del contenedor apenas
        arranca, ANTES de insertar el video adentro. Si el div todavía no
        tiene alto (porque está vacío y depende del contenido para crecer),
        esa medición da 0 y en varios celulares (Samsung Internet, Chrome
        Android) la cámara queda "prendida" pero el video nunca se ve.
      */}
      <div
        id={ID_CAMARA}
        className={camaraActiva ? "mb-3 rounded-md overflow-hidden" : "hidden"}
        style={camaraActiva ? { minHeight: 280 } : undefined}
      />

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
