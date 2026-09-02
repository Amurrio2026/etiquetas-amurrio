export interface Articulo {
  sku: string;
  descripcion: string;
  categoria: string | null;
  marcaProducto: string | null;
  precioVenta: number;
}

export interface Sucursal {
  codigoSucursal: number;
  nombre: string;
  marca: string; // banner de la sucursal: "Grand Bazaar" | "Casa Moda"
  email: string;
}

export interface LineaEtiqueta {
  articulo: Articulo;
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
