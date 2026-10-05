import type { Articulo, Sucursal, TipoPrecio } from "@/types";
import sucursalesLista2 from "@/config/precios/sucursales-lista2.json";

// Se importa como modulo (no se lee con fs) por el mismo motivo que las
// plantillas de PDF (ver lib/config.ts): Vercel no empaqueta archivos leidos
// dinamicamente del disco en la funcion serverless.
const NOMBRES_LISTA2 = new Set<string>((sucursalesLista2 as { sucursales: string[] }).sucursales);

/**
 * Sucursales con "precio unico" (2026-10-05, pedido de Lucila): Rauch, Ayacucho y
 * Madariaga muestran SOLO el precio de lista 2 en la etiqueta, sin el precio
 * Efectivo (lista 6). Son las mismas sucursales de config/precios/sucursales-lista2.json.
 */
export function esPrecioUnico(sucursal: Sucursal): boolean {
  return NOMBRES_LISTA2.has(sucursal.nombre);
}

export type ListaPrecio = "lista2" | "lista3" | "lista6";

/**
 * Que columna de precio corresponde segun sucursal + tipo de precio.
 * Regla de negocio (confirmada con Lucila, 2026-09-04):
 * - Efectivo: siempre precio_lista6 (es la que se cobra en caja, ver
 *   DISENO_BBDD_AZURE §9.10) -- no depende de la sucursal.
 * - Lista: precio_lista2 en Ayacucho/Rauch/Madariaga (config/precios/
 *   sucursales-lista2.json), precio_lista3 en el resto.
 */
export function listaParaSucursal(sucursal: Sucursal, tipoPrecio: TipoPrecio): ListaPrecio {
  if (tipoPrecio === "efectivo") return "lista6";
  return NOMBRES_LISTA2.has(sucursal.nombre) ? "lista2" : "lista3";
}

/**
 * Devuelve el precio a mostrar en la etiqueta para este articulo, sucursal y
 * tipo de precio -- o `null` si esa lista todavia no tiene precio cargado
 * para este articulo (0 o ausente; en Zeus un precio 0 significa "sin
 * precio cargado", no un precio real de $0). No hay fallback automatico a
 * otra lista: decisión explícita de Lucila para no mostrar un precio
 * equivocado en una etiqueta física.
 */
export function resolverPrecio(articulo: Articulo, sucursal: Sucursal, tipoPrecio: TipoPrecio): number | null {
  const lista = listaParaSucursal(sucursal, tipoPrecio);
  const valor =
    lista === "lista2" ? articulo.precioLista2 : lista === "lista3" ? articulo.precioLista3 : articulo.precioLista6;
  return valor && valor > 0 ? valor : null;
}

/**
 * Resuelve los DOS precios que muestra la etiqueta a la vez (Efectivo y
 * Lista) -- no es una eleccion entre uno u otro, los dos van siempre juntos
 * en la misma etiqueta (ver plantillas casa-moda.json / grand-bazaar.json,
 * elementos "precio_efectivo" y "precio_lista").
 */
export function resolverPrecios(
  articulo: Articulo,
  sucursal: Sucursal
): { precioEfectivo: number | null; precioLista: number | null } {
  return {
    // En sucursales de precio unico no se muestra Efectivo: queda en null a proposito
    // (la plantilla lo oculta y resolver-lineas no lo cuenta como "precio en blanco").
    precioEfectivo: esPrecioUnico(sucursal) ? null : resolverPrecio(articulo, sucursal, "efectivo"),
    precioLista: resolverPrecio(articulo, sucursal, "lista"),
  };
}
