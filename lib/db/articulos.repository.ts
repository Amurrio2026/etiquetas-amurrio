import { getPool, tieneBaseReal } from "@/lib/db/client";
import { ARTICULOS_MOCK, buscarArticuloMock } from "@/lib/mock/articulos";
import type { Articulo } from "@/types";

const TTL_MS = 5 * 60 * 1000; // 5 minutos, ver arquitectura: "cache refrescada cada pocos minutos"

let cache: Map<string, Articulo> | null = null;
let cacheCargadaEn = 0;

async function cargarCacheDesdeBaseReal(): Promise<Map<string, Articulo>> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL no configurada");

  const { rows } = await pool.query(
    `select sku, descripcion, categoria, marca, precio_venta
       from maestros.articulos
      where activo = true
        and descripcion is not null
        and precio_venta is not null`
  );

  const mapa = new Map<string, Articulo>();
  for (const r of rows) {
    mapa.set(r.sku, {
      sku: r.sku,
      descripcion: r.descripcion,
      categoria: r.categoria,
      marcaProducto: r.marca,
      precioVenta: Number(r.precio_venta),
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

export function usandoDatosDeEjemplo(): boolean {
  return !tieneBaseReal();
}
