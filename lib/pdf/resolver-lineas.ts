import { buscarArticuloPorSku } from "@/lib/db/articulos.repository";
import type { LineaEtiqueta } from "@/types";

export interface LineaPedida {
  sku: string;
  cantidad: number;
}

/**
 * Vuelve a buscar cada articulo en el servidor (nunca se confia en la
 * descripcion/precio que mande el navegador) y arma las lineas listas para
 * generar el PDF. Si algun sku ya no existe, lo informa en "faltantes" en
 * vez de romper todo el pedido.
 */
export async function resolverLineas(pedidas: LineaPedida[]): Promise<{ lineas: LineaEtiqueta[]; faltantes: string[] }> {
  const lineas: LineaEtiqueta[] = [];
  const faltantes: string[] = [];

  for (const p of pedidas) {
    if (!p.cantidad || p.cantidad <= 0) continue;
    const articulo = await buscarArticuloPorSku(p.sku);
    if (!articulo) {
      faltantes.push(p.sku);
      continue;
    }
    lineas.push({ articulo, cantidad: p.cantidad });
  }

  return { lineas, faltantes };
}
