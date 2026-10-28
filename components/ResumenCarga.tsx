"use client";

import type { ResultadoValidacion } from "./CargaMasiva";

interface Props {
  /** Ej: nombre del archivo subido, o "Contenedor BYM292". */
  titulo: string;
  resultado: ResultadoValidacion;
}

/**
 * Resumen de validación compartido entre "Carga masiva" (archivo) y "Por
 * contenedor" (número de contenedor) -- misma forma de datos
 * (ResultadoValidacion), mismo resumen para no duplicar esta UI dos veces.
 */
export default function ResumenCarga({ titulo, resultado }: Props) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2">
      <p className="text-sm font-semibold text-gray-800">Resumen de {titulo}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
        <Metrica etiqueta="Filas leídas" valor={resultado.resumen.totalFilasLeidas} />
        <Metrica etiqueta="Códigos únicos" valor={resultado.resumen.skusUnicos} />
        <Metrica etiqueta="Listos para generar" valor={resultado.resumen.encontrados} destacado="ok" />
        <Metrica
          etiqueta="No encontrados"
          valor={resultado.resumen.noEncontrados}
          destacado={resultado.resumen.noEncontrados > 0 ? "error" : undefined}
        />
        <Metrica
          etiqueta="Sin ningún precio"
          valor={resultado.resumen.sinPrecio}
          destacado={resultado.resumen.sinPrecio > 0 ? "error" : undefined}
        />
        <Metrica
          etiqueta="Con un precio en blanco"
          valor={resultado.resumen.precioParcial}
          destacado={resultado.resumen.precioParcial > 0 ? "aviso" : undefined}
        />
        {resultado.resumen.preciosIncompletos !== undefined && (
          <Metrica
            etiqueta="Con precio faltante en el archivo"
            valor={resultado.resumen.preciosIncompletos}
            destacado={resultado.resumen.preciosIncompletos > 0 ? "error" : undefined}
          />
        )}
        <Metrica etiqueta="Duplicados (sumados)" valor={resultado.resumen.duplicados} />
        <Metrica
          etiqueta="Inactivos/discontinuados"
          valor={resultado.resumen.inactivosODiscontinuados}
          destacado={resultado.resumen.inactivosODiscontinuados > 0 ? "aviso" : undefined}
        />
        <Metrica etiqueta="Total etiquetas" valor={resultado.resumen.totalEtiquetas} />
      </div>

      {(resultado.resumen.listasUsadasDelArchivo?.length ?? 0) > 0 && (
        <p className="text-xs text-green-700">
          Precios tomados del archivo: {resultado.resumen.listasUsadasDelArchivo?.join(", ")}.
        </p>
      )}
      {(resultado.resumen.listasIgnoradas?.length ?? 0) > 0 && (
        <p className="text-xs text-amber-600">
          Columnas ignoradas para esta sucursal: {resultado.resumen.listasIgnoradas?.join(", ")} (no las usa en su
          etiqueta).
        </p>
      )}
      <ListaDetalle titulo="Con un precio faltante en el archivo (no se generan)" skus={resultado.detalle.preciosIncompletos ?? []} />
      <ListaDetalle titulo="No encontrados" skus={resultado.detalle.noEncontrados} />
      <ListaDetalle titulo="Sin ningún precio cargado (no se generan)" skus={resultado.detalle.sinPrecio} />
      <ListaDetalle titulo="Con Efectivo o Lista en blanco (se generan igual, con '-')" skus={resultado.detalle.precioParcial} />
      <ListaDetalle titulo="Inactivos o discontinuados (se generan igual)" skus={resultado.detalle.inactivosODiscontinuados} />
      <ListaDetalle titulo="Duplicados en el archivo (cantidades sumadas)" skus={resultado.detalle.duplicados} />

      {resultado.resumen.encontrados === 0 && (
        <p className="text-sm text-red-600">Ningún código quedó listo para generar etiquetas.</p>
      )}
    </div>
  );
}

function Metrica({ etiqueta, valor, destacado }: { etiqueta: string; valor: number; destacado?: "ok" | "error" | "aviso" }) {
  const color =
    destacado === "ok"
      ? "text-green-700"
      : destacado === "error"
      ? "text-red-600"
      : destacado === "aviso"
      ? "text-amber-600"
      : "text-gray-900";
  return (
    <div>
      <div className={"font-semibold tabular-nums " + color}>{valor}</div>
      <div className="text-xs text-gray-500">{etiqueta}</div>
    </div>
  );
}

function ListaDetalle({ titulo, skus }: { titulo: string; skus: string[] }) {
  if (skus.length === 0) return null;
  // Los codigos se muestran directamente (sin tener que hacer click en
  // ningun lado) -- para listas largas, el contenedor scrollea en vez de
  // ocupar toda la pantalla.
  return (
    <div className="text-xs text-gray-600">
      <p className="font-medium text-gray-700">
        {titulo} ({skus.length})
      </p>
      <p className={"mt-1 font-mono break-words" + (skus.length > 12 ? " max-h-28 overflow-y-auto pr-1" : "")}>
        {skus.join(", ")}
      </p>
    </div>
  );
}
