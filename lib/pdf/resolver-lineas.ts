import { buscarArticuloPorSku, buscarArticulosPorSkus } from "@/lib/db/articulos.repository";
import { resolverPrecios } from "@/lib/precios/resolver-precio";
import type { LineaEtiqueta, Sucursal } from "@/types";

export interface LineaPedida {
  sku: string;
  cantidad: number;
}

export interface ResultadoResolverLineas {
  lineas: LineaEtiqueta[];
  /** SKUs que no existen en el maestro de articulos. */
  faltantes: string[];
  /** SKUs que existen pero no tienen NINGUNO de los dos precios cargado (no hay nada para imprimir). */
  sinPrecio: string[];
  /** SKUs que se imprimen igual pero con uno de los dos precios en blanco ("-"): informativo. */
  precioParcial: string[];
}

/**
 * Vuelve a buscar cada articulo en el servidor (nunca se confia en la
 * descripcion/precio que mande el navegador) y arma las lineas listas para
 * generar el PDF, resolviendo los DOS precios de la etiqueta (Efectivo y
 * Lista) segun la sucursal -- ver lib/precios/resolver-precio.ts. Si un sku
 * no existe se informa en "faltantes"; si existe pero no tiene NINGUN
 * precio cargado, en "sinPrecio" (no hay nada que imprimir, se excluye). Si
 * le falta uno solo de los dos, se incluye igual (el que falta se imprime
 * como "-") y se informa en "precioParcial". Ninguno de estos casos rompe
 * el resto del pedido.
 */
export async function resolverLineas(pedidas: LineaPedida[], sucursal: Sucursal): Promise<ResultadoResolverLineas> {
  const lineas: LineaEtiqueta[] = [];
  const faltantes: string[] = [];
  const sinPrecio: string[] = [];
  const precioParcial: string[] = [];

  for (const p of pedidas) {
    if (!p.cantidad || p.cantidad <= 0) continue;
    const articulo = await buscarArticuloPorSku(p.sku);
    if (!articulo) {
      faltantes.push(p.sku);
      continue;
    }
    const { precioEfectivo, precioLista } = resolverPrecios(articulo, sucursal);
    if (precioEfectivo === null && precioLista === null) {
      sinPrecio.push(p.sku);
      continue;
    }
    if (precioEfectivo === null || precioLista === null) precioParcial.push(p.sku);
    lineas.push({ articulo: { ...articulo, precioEfectivo, precioLista }, cantidad: p.cantidad });
  }

  return { lineas, faltantes, sinPrecio, precioParcial };
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
  sucursal: Sucursal
): Promise<ResultadoResolverLineas & { inactivosODiscontinuados: string[] }> {
  const skus = pedidas.map((p) => p.sku);
  const encontrados = await buscarArticulosPorSkus(skus);

  const lineas: LineaEtiqueta[] = [];
  const faltantes: string[] = [];
  const sinPrecio: string[] = [];
  const precioParcial: string[] = [];
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

    const { precioEfectivo, precioLista } = resolverPrecios(articulo, sucursal);
    if (precioEfectivo === null && precioLista === null) {
      sinPrecio.push(p.sku);
      continue;
    }
    if (precioEfectivo === null || precioLista === null) precioParcial.push(p.sku);
    lineas.push({ articulo: { ...articulo, precioEfectivo, precioLista }, cantidad: p.cantidad });
  }

  return { lineas, faltantes, sinPrecio, precioParcial, inactivosODiscontinuados };
}
