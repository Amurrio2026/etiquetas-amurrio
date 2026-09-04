import { getPool, tieneBaseReal } from "@/lib/db/client";
import { ARTICULOS_MOCK, buscarArticuloMock } from "@/lib/mock/articulos";
import type { Articulo } from "@/types";

const TTL_MS = 5 * 60 * 1000; // 5 minutos, ver arquitectura: "cache refrescada cada pocos minutos"

let cache: Map<string, Articulo> | null = null;
let cacheCargadaEn = 0;

async function cargarCacheDesdeBaseReal(): Promise<Map<string, Articulo>> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL no configurada");

  // OJO: no se filtra por "activo". Se probó en producción (2026-09-03) y la
  // gran mayoria de los articulos reales (15.238 de ~20.000) figuran con
  // activo=false en la base aunque esten a la venta en el local -- ese campo
  // no refleja "esta en el local ahora", asi que filtrar por el dejaba sin
  // encontrar la mayoria de los codigos reales escaneados. Se trae igual
  // (junto con "discontinuado") para mostrarlo como aviso informativo, no
  // para excluir nada.
  //
  // 2026-09-04: la columna "precio_venta" de esta tabla se RENOMBRO a
  // "precio_lista2" al incorporarse las listas 3 y 6 (ver DISENO_BBDD_AZURE
  // §4.1 / §9.10) -- consultarla por su nombre viejo rompe con "column
  // precio_venta does not exist". Ahora se traen las 3 listas por separado;
  // cuál se muestra en la etiqueta se resuelve en lib/precios/resolver-precio.ts
  // según sucursal + tipo de precio elegido, no acá.
  const { rows } = await pool.query(
    `select sku, descripcion, categoria, marca, precio_lista2, precio_lista3, precio_lista6, activo, discontinuado
       from maestros.articulos
      where descripcion is not null`
  );

  const mapa = new Map<string, Articulo>();
  for (const r of rows) {
    mapa.set(r.sku, {
      sku: r.sku,
      descripcion: r.descripcion,
      categoria: r.categoria,
      marcaProducto: r.marca,
      precioLista2: r.precio_lista2 != null ? Number(r.precio_lista2) : null,
      precioLista3: r.precio_lista3 != null ? Number(r.precio_lista3) : null,
      precioLista6: r.precio_lista6 != null ? Number(r.precio_lista6) : null,
      activo: Boolean(r.activo),
      discontinuado: Boolean(r.discontinuado),
    });
  }
  return mapa;
}

function cargarCacheMock(): Map<string, Articulo> {
  const mapa = new Map<string, Articulo>();
  for (const a of ARTICULOS_MOCK) mapa.set(a.sku, a);
  return mapa;
}

async function obtenerCache(): Promise<Map<string, Articulo>> {
  const vencida = !cache || Date.now() - cacheCargadaEn > TTL_MS;
  if (!vencida && cache) return cache;

  cache = tieneBaseReal() ? await cargarCacheDesdeBaseReal() : cargarCacheMock();
  cacheCargadaEn = Date.now();
  return cache;
}

/** Busca un articulo por su codigo de barras (sku). Devuelve null si no existe. */
export async function buscarArticuloPorSku(sku: string): Promise<Articulo | null> {
  const codigo = sku.trim();
  if (!codigo) return null;

  if (!tieneBaseReal()) return buscarArticuloMock(codigo);

  const mapa = await obtenerCache();
  return mapa.get(codigo) ?? null;
}

/**
 * Busca muchos SKUs de una sola vez (carga masiva). Como el maestro completo
 * ya vive en memoria (ver obtenerCache/TTL de 5 min), esto NO dispara una
 * query nueva ni una query por SKU -- son lookups en un Map, instantaneos
 * incluso con miles de codigos.
 */
export async function buscarArticulosPorSkus(skus: string[]): Promise<Map<string, Articulo>> {
  const mapa = tieneBaseReal() ? await obtenerCache() : cargarCacheMock();
  const resultado = new Map<string, Articulo>();
  for (const skuCrudo of skus) {
    const codigo = skuCrudo.trim();
    if (!codigo) continue;
    const articulo = mapa.get(codigo);
    if (articulo) resultado.set(codigo, articulo);
  }
  return resultado;
}

export function usandoDatosDeEjemplo(): boolean {
  return !tieneBaseReal();
}
