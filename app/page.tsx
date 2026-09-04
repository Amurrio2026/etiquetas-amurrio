"use client";

import { useEffect, useMemo, useState } from "react";
import Escaner from "@/components/Escaner";
import ListadoEtiquetas, { type LineaUI } from "@/components/ListadoEtiquetas";
import SelectorSucursal from "@/components/SelectorSucursal";
import SelectorFormato from "@/components/SelectorFormato";
import CargaMasiva, { type ResultadoValidacion } from "@/components/CargaMasiva";
import type { ArticuloConPrecio, FormatoHoja, Sucursal } from "@/types";

type Modo = "escaneo" | "masivo";

function formatearPrecio(v: number | null): string {
  return v === null ? "sin precio cargado" : `$${Math.round(v).toLocaleString("es-AR")}`;
}

export default function Home() {
  const [modo, setModo] = useState<Modo>("escaneo");

  const [lineas, setLineas] = useState<LineaUI[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [formatos, setFormatos] = useState<FormatoHoja[]>([]);
  const [sucursalCodigo, setSucursalCodigo] = useState<number | null>(null);
  const [formatoId, setFormatoId] = useState<string | null>(null);
  const [usuario, setUsuario] = useState("");

  const [articuloEncontrado, setArticuloEncontrado] = useState<ArticuloConPrecio | null>(null);
  const [cantidadPendiente, setCantidadPendiente] = useState(1);
  const [aviso, setAviso] = useState<{ tipo: "error" | "info" | "ok"; texto: string } | null>(null);

  const [resultadoMasivo, setResultadoMasivo] = useState<ResultadoValidacion | null>(null);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch("/api/sucursales")
      .then((r) => r.json())
      .then((data: Sucursal[]) => {
        setSucursales(data);
        if (data.length > 0) setSucursalCodigo(data[0].codigoSucursal);
      })
      .catch(() => setAviso({ tipo: "error", texto: "No se pudieron cargar las sucursales." }));

    fetch("/api/formatos")
      .then((r) => r.json())
      .then((data: FormatoHoja[]) => {
        setFormatos(data);
        if (data.length > 0) setFormatoId(data[0].id);
      })
      .catch(() => setAviso({ tipo: "error", texto: "No se pudieron cargar los formatos de hoja." }));
  }, []);

  const sucursalActual = useMemo(
    () => sucursales.find((s) => s.codigoSucursal === sucursalCodigo) ?? null,
    [sucursales, sucursalCodigo]
  );

  function cambiarModo(nuevo: Modo) {
    setModo(nuevo);
    setAviso(null);
    setPdfUrl(null);
  }

  async function alEscanear(codigo: string) {
    setAviso(null);
    setPdfUrl(null);
    if (!sucursalCodigo) {
      setAviso({ tipo: "error", texto: "Elegí primero la sucursal (el precio depende de ella)." });
      return;
    }
    try {
      const params = new URLSearchParams({ sku: codigo, sucursalCodigo: String(sucursalCodigo) });
      const res = await fetch(`/api/articulos/buscar?${params}`);
      if (res.status === 404) {
        setAviso({ tipo: "error", texto: `No se encontró ningún artículo con el código ${codigo}.` });
        setArticuloEncontrado(null);
        return;
      }
      if (!res.ok) throw new Error("error de conexión");
      const articulo: ArticuloConPrecio = await res.json();
      setArticuloEncontrado(articulo);
      setCantidadPendiente(1);
      if (articulo.precioEfectivo === null && articulo.precioLista === null) {
        setAviso({
          tipo: "error",
          texto: `${articulo.descripcion} todavía no tiene ningún precio cargado en esta sucursal.`,
        });
      }
    } catch {
      setAviso({ tipo: "error", texto: "No se pudo consultar la base de artículos. Probá de nuevo." });
    }
  }

  function agregarAlListado() {
    if (!articuloEncontrado) return;
    if (articuloEncontrado.precioEfectivo === null && articuloEncontrado.precioLista === null) return;
    setLineas((prev) => {
      const existe = prev.find((l) => l.articulo.sku === articuloEncontrado.sku);
      if (existe) {
        return prev.map((l) =>
          l.articulo.sku === articuloEncontrado.sku ? { ...l, cantidad: l.cantidad + cantidadPendiente } : l
        );
      }
      return [...prev, { articulo: articuloEncontrado, cantidad: cantidadPendiente }];
    });
    setArticuloEncontrado(null);
    setCantidadPendiente(1);
    setPdfUrl(null);
  }

  function cambiarCantidad(sku: string, cantidad: number) {
    setLineas((prev) => prev.map((l) => (l.articulo.sku === sku ? { ...l, cantidad } : l)));
    setPdfUrl(null);
  }

  function eliminarLinea(sku: string) {
    setLineas((prev) => prev.filter((l) => l.articulo.sku !== sku));
    setPdfUrl(null);
  }

  function lineasParaApi() {
    if (modo === "masivo") return resultadoMasivo?.lineasValidas ?? [];
    return lineas.map((l) => ({ sku: l.articulo.sku, cantidad: l.cantidad }));
  }

  function hayAlgoParaGenerar() {
    if (modo === "masivo") return (resultadoMasivo?.resumen.encontrados ?? 0) > 0;
    return lineas.length > 0;
  }

  function leerListaHeader(res: Response, header: string): string[] {
    try {
      const crudo = res.headers.get(header);
      return crudo ? (JSON.parse(decodeURIComponent(crudo)) as string[]) : [];
    } catch {
      return [];
    }
  }

  async function generarPdf() {
    if (!hayAlgoParaGenerar() || !formatoId || !sucursalCodigo) return;
    setGenerando(true);
    setAviso(null);
    try {
      const res = await fetch("/api/etiquetas/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sucursalCodigo, formatoId, lineas: lineasParaApi() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo generar el PDF");
      }
      const faltantes = leerListaHeader(res, "X-Faltantes");
      const sinPrecio = leerListaHeader(res, "X-Sin-Precio");
      const blob = await res.blob();
      setPdfUrl(URL.createObjectURL(blob));
      if (faltantes.length > 0 || sinPrecio.length > 0) {
        setAviso({
          tipo: "info",
          texto: `El PDF se generó, pero se dejaron afuera: ${faltantes.length} código(s) no encontrado(s), ${sinPrecio.length} sin ningún precio cargado.`,
        });
      }
    } catch (err: any) {
      setAviso({ tipo: "error", texto: err.message || "No se pudo generar el PDF." });
    } finally {
      setGenerando(false);
    }
  }

  async function enviarPorEmail() {
    if (!sucursalCodigo || !formatoId || !hayAlgoParaGenerar()) return;
    setEnviando(true);
    setAviso(null);
    try {
      const res = await fetch("/api/envios/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sucursalCodigo,
          formatoId,
          usuario: usuario || "sin especificar",
          origen: modo,
          lineas: lineasParaApi(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo enviar el mail");

      const avisoExtra =
        data.faltantes?.length || data.sinPrecio?.length
          ? ` (se dejaron afuera ${data.faltantes?.length ?? 0} no encontrado(s) y ${data.sinPrecio?.length ?? 0} sin ningún precio)`
          : "";

      setAviso({
        tipo: "ok",
        texto:
          (data.modoPrueba
            ? `Enviado en modo prueba a ${data.destinatario} (en vez de a ${sucursalActual?.nombre}).`
            : `Enviado a ${sucursalActual?.nombre} (${data.destinatario}).`) + avisoExtra,
      });
    } catch (err: any) {
      setAviso({ tipo: "error", texto: err.message || "No se pudo enviar el mail." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <h1 className="text-lg font-bold text-gray-900">Etiquetas Amurrio</h1>
          <p className="text-xs text-gray-500">Piloto: sucursales Grand Bazaar y Casa Moda</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {aviso && (
          <div
            className={
              "rounded-md px-4 py-3 text-sm " +
              (aviso.tipo === "error"
                ? "bg-red-50 text-red-700 border border-red-200"
                : aviso.tipo === "ok"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-gray-100 text-gray-700 border border-gray-200")
            }
          >
            {aviso.texto}
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Sucursal y formato</h2>
          <p className="text-xs text-gray-500">
            Cada etiqueta muestra los dos precios juntos: Efectivo (lista 6) y Lista (lista 2 o 3 según
            la sucursal) — no hay que elegir uno.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SelectorSucursal sucursales={sucursales} valor={sucursalCodigo} onCambiar={setSucursalCodigo} />
            <SelectorFormato formatos={formatos} valor={formatoId} onCambiar={setFormatoId} />
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">Tu nombre (para el historial)</span>
            <input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Ej: María"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex gap-2 rounded-lg border border-gray-200 bg-white p-1 shadow-sm w-fit">
          <button
            type="button"
            onClick={() => cambiarModo("escaneo")}
            className={
              "rounded-md px-4 py-1.5 text-sm font-medium " +
              (modo === "escaneo" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100")
            }
          >
            Escanear
          </button>
          <button
            type="button"
            onClick={() => cambiarModo("masivo")}
            className={
              "rounded-md px-4 py-1.5 text-sm font-medium " +
              (modo === "masivo" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100")
            }
          >
            Carga masiva
          </button>
        </div>

        {modo === "escaneo" ? (
          <>
            <Escaner onScan={alEscanear} />

            {articuloEncontrado && (
              <div className="rounded-lg border border-gray-900 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Artículo encontrado</p>
                <p className="font-semibold text-gray-900">{articuloEncontrado.descripcion}</p>
                <p className="text-sm text-gray-500 mb-3">
                  {articuloEncontrado.sku} · Efectivo {formatearPrecio(articuloEncontrado.precioEfectivo)} · Lista{" "}
                  {formatearPrecio(articuloEncontrado.precioLista)}
                </p>
                <div className="flex items-end gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-700">Cantidad de etiquetas</span>
                    <input
                      type="number"
                      min={1}
                      autoFocus
                      value={cantidadPendiente}
                      onChange={(e) => setCantidadPendiente(Math.max(1, Number(e.target.value) || 1))}
                      onKeyDown={(e) => e.key === "Enter" && agregarAlListado()}
                      className="mt-1 w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    onClick={agregarAlListado}
                    disabled={articuloEncontrado.precioEfectivo === null && articuloEncontrado.precioLista === null}
                    className="rounded-md bg-gray-900 text-white text-sm font-medium px-4 py-2 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Agregar
                  </button>
                  <button
                    onClick={() => setArticuloEncontrado(null)}
                    className="text-sm text-gray-500 px-2 py-2 hover:text-gray-800"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <ListadoEtiquetas lineas={lineas} onCambiarCantidad={cambiarCantidad} onEliminar={eliminarLinea} />
          </>
        ) : (
          <CargaMasiva
            sucursalCodigo={sucursalCodigo}
            resultado={resultadoMasivo}
            onResultado={setResultadoMasivo}
            onError={(texto) => setAviso({ tipo: "error", texto })}
          />
        )}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={generarPdf}
            disabled={!hayAlgoParaGenerar() || generando}
            className="rounded-md bg-gray-900 text-white text-sm font-medium px-5 py-2.5 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generando ? "Generando..." : "Generar PDF"}
          </button>
          <button
            onClick={enviarPorEmail}
            disabled={!pdfUrl || enviando}
            className="rounded-md bg-white border border-gray-900 text-gray-900 text-sm font-medium px-5 py-2.5 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enviando ? "Enviando..." : "Enviar por email"}
          </button>
        </div>

        {pdfUrl && (
          <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
            <iframe src={pdfUrl} className="w-full h-[70vh] rounded" title="Vista previa del PDF" />
          </div>
        )}
      </div>
    </main>
  );
}
