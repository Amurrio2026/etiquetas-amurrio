import { buscarArticuloPorSku, buscarArticulosPorSkus } from "@/lib/db/articulos.repository";
import { resolverPrecio } from "@/lib/precios/resolver-precio";
import type { LineaEtiqueta, Sucursal, TipoPrecio } from "@/types";

export interface LineaPedida {
  sku: string;
  cantidad: number;
}

export interface ResultadoResolverLineas {
  lineas: LineaEtiqueta[];
  /** SKUs que no existen en el maestro de articulos. */
  faltantes: string[];
  /** SKUs que existen pero no tienen precio cargado para la sucursal/tipo elegidos. */
  sinPrecio: string[];
}

/**
 * Vuelve a buscar cada articulo en el servidor (nunca se confia en la
 * descripcion/precio que mande el navegador) y arma las lineas listas para
 * generar el PDF, resolviendo el precio a mostrar segun la sucursal y el
 * tipo de precio (Efectivo/Lista) elegidos -- ver lib/precios/resolver-precio.ts.
 * Si un sku no existe se informa en "faltantes"; si existe pero no tiene
 * precio cargado para ese tipo, en "sinPrecio". Ninguno de los dos casos
 * rompe el resto del pedido.
 */
export async function resolverLineas(
  pedidas: LineaPedida[],
  sucursal: Sucursal,
  tipoPrecio: TipoPrecio
): Promise<ResultadoResolverLineas> {
  const lineas: LineaEtiqueta[] = [];
  const faltantes: string[] = [];
  const sinPrecio: string[] = [];

  for (const p of pedidas) {
    if (!p.cantidad || p.cantidad <= 0) continue;
    const articulo = await buscarArticuloPorSku(p.sku);
    if (!articulo) {
      faltantes.push(p.sku);
      continue;
    }
    const precioVenta = resolverPrecio(articulo, sucursal, tipoPrecio);
    if (precioVenta === null) {
      sinPrecio.push(p.sku);
      continue;
    }
    lineas.push({ articulo: { ...articulo, precioVenta }, cantidad: p.cantidad });
  }

  return { lineas, faltantes, sinPrecio };
}

/**
 * Igual que resolverLineas, pero para carga masiva: hace UNA sola busqueda
 * agrupada (buscarArticulosPorSkus) en vez de una por sku, y ademas separa
 * los articulos inactivos/discontinuados encontrados como aviso informativo
 * (no se excluyen, se generan igual -- mismo criterio que el escaneo
 * individual, ver lib/db/articulos.repository.ts).
 */
export async function resolverLineasMasivo(
  pedidas: LineaPedida[],
  sucursal: Sucursal,
  tipoPrecio: TipoPrecio
): Promise<ResultadoResolverLineas & { inactivosODiscontinuados: string[] }> {
  const skus = pedidas.map((p) => p.sku);
  const encontrados = await buscarArticulosPorSkus(skus);

  const lineas: LineaEtiqueta[] = [];
  const faltantes: string[] = [];
  const sinPrecio: string[] = [];
  const inactivosODiscontinuados: string[] = [];

  for (const p of pedidas) {
    if (!p.cantidad || p.cantidad <= 0) continue;
    const codigo = p.sku.trim();
    const articulo = encontrados.get(codigo);
    if (!articulo) {
      faltantes.push(p.sku);
      continue;
    }
    if (!articulo.activo || articulo.discontinuado) inactivosODiscontinuados.push(p.sku);

    const precioVenta = resolverPrecio(articulo, sucursal, tipoPrecio);
    if (precioVenta === null) {
      sinPrecio.push(p.sku);
      continue;
    }
    lineas.push({ articulo: { ...articulo, precioVenta }, cantidad: p.cantidad });
  }

  return { lineas, faltantes, sinPrecio, inactivosODiscontinuados };
}
