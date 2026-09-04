export type TipoPrecio = "efectivo" | "lista";

/**
 * Datos "crudos" del articulo tal cual estan en el maestro (maestros.articulos):
 * las 3 listas de precio por separado, sin resolver todavia cual mostrar.
 * (2026-09-04: antes esto era un unico "precioVenta" -- la base le cambio el
 * nombre a la columna vieja "precio_venta" -> "precio_lista2" y sumo lista3 y
 * lista6, asi que pasamos a guardar las 3 y resolver la que corresponde segun
 * sucursal + tipo de precio en lib/precios/resolver-precio.ts).
 *
 * precioLista2/3/6 son `null` cuando el articulo todavia no tiene precio
 * cargado en esa lista (0 en Zeus = "sin precio", no un precio de $0).
 */
export interface Articulo {
  sku: string;
  descripcion: string;
  categoria: string | null;
  marcaProducto: string | null;
  precioLista2: number | null;
  precioLista3: number | null;
  precioLista6: number | null;
  /** Informativo, no se usa para filtrar (ver lib/db/articulos.repository.ts). */
  activo: boolean;
  discontinuado: boolean;
}

/**
 * Un articulo con los DOS precios ya resueltos para una sucursal puntual --
 * la etiqueta siempre muestra los dos juntos (pill "Precio Efectivo" +
 * pill "Precio de Lista"), no es una eleccion de uno u otro. `null` cuando
 * esa lista todavia no tiene precio cargado para este articulo -- se
 * imprime como "-" en vez de un precio inventado (ver lib/pdf/generar-pdf.ts).
 * Si AMBOS son null, la linea se excluye del pedido (no hay nada que
 * imprimir) -- ver lib/pdf/resolver-lineas.ts.
 */
export interface ArticuloConPrecio extends Articulo {
  precioEfectivo: number | null; // precio_lista6, siempre
  precioLista: number | null; // precio_lista2 o precio_lista3 segun sucursal
}

export interface Sucursal {
  codigoSucursal: number;
  nombre: string;
  marca: string; // banner de la sucursal: "Grand Bazaar" | "Casa Moda"
  email: string;
}

export interface LineaEtiqueta {
  articulo: ArticuloConPrecio;
  cantidad: number;
}

export interface FormatoHoja {
  id: string;
  nombre: string;
  hojaAnchoMm: number;
  hojaAltoMm: number;
  columnas: number;
  filas: number;
  margenXMm: number;
  margenYMm: number;
  espacioXMm: number;
  espacioYMm: number;
}

export interface PlantillaElemento {
  id: string;
  type: "rect" | "text" | "pill" | "rule_con_puntas" | "image";
  [key: string]: unknown;
}

export interface Plantilla {
  id: string;
  marca: string;
  label: { width_mm: number; height_mm: number; background: string };
  palette: Record<string, string>;
  fonts: Record<string, { family: string; weight?: number }>;
  elements: PlantillaElemento[];
}

export interface PedidoHistorial {
  idPedido: string;
  fecha: string;
  hora: string;
  usuario: string;
  sucursal: string;
  marca: string;
  articulosDistintos: number;
  totalEtiquetas: number;
  detalle: string; // "sku:cantidad, sku:cantidad, ..."
  formatoHoja: string;
  nombrePdf: string;
  estadoEnvio: "enviado" | "error" | "prueba";
  fechaEnvio: string;
}
