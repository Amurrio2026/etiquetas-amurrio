import type { ArticuloConPrecio, FormatoHoja, LineaEtiqueta } from "@/types";

export interface EtiquetaPosicionada {
  articulo: ArticuloConPrecio;
  columna: number; // 0-based
  fila: number; // 0-based
}

export type Hoja = EtiquetaPosicionada[];

/**
 * Repite cada articulo segun su cantidad y reparte el total entre hojas,
 * respetando columnas x filas del formato elegido.
 *
 * Ejemplo (igual al del pedido original): A x10 + B x5 + C x20 = 35
 * etiquetas. Con un formato de 10 por hoja, da 4 hojas (10+10+10+5).
 */
export function paginarEtiquetas(lineas: LineaEtiqueta[], formato: FormatoHoja): Hoja[] {
  const porHoja = formato.columnas * formato.filas;
  if (porHoja <= 0) throw new Error("Formato de hoja invalido: columnas x filas debe ser mayor a 0");

  const instancias: ArticuloConPrecio[] = [];
  for (const linea of lineas) {
    for (let i = 0; i < linea.cantidad; i++) instancias.push(linea.articulo);
  }

  const hojas: Hoja[] = [];
  for (let i = 0; i < instancias.length; i += porHoja) {
    const grupo = instancias.slice(i, i + porHoja);
    const hoja: Hoja = grupo.map((articulo, idx) => ({
      articulo,
      columna: idx % formato.columnas,
      fila: Math.floor(idx / formato.columnas),
    }));
    hojas.push(hoja);
  }
  return hojas;
}

export function totalEtiquetas(lineas: LineaEtiqueta[]): number {
  return lineas.reduce((acc, l) => acc + l.cantidad, 0);
}
