import type { Articulo } from "@/types";

/**
 * Datos de ejemplo para poder probar la app SIN conexion a la base real.
 * Se usan automaticamente cuando falta DATABASE_URL (ver lib/db/client.ts).
 * El formato de "sku" imita los codigos reales (9 a 13 digitos).
 */
export const ARTICULOS_MOCK: Articulo[] = [
  {
    sku: "092626528020",
    descripcion: "LAPICES COLOR FROZEN X 12",
    categoria: "ESCRITURA",
    marcaProducto: "LIBRERIA NAC",
    precioVenta: 2750,
  },
  {
    sku: "7798323772805",
    descripcion: "ALFOMBRA DE BAÑO CON BORDE LISA 40*60",
    categoria: "ALFOMBRAS DE BANIO",
    marcaProducto: "TEXTIL NAC",
    precioVenta: 7600,
  },
  {
    sku: "7798363446087",
    descripcion: "ALFOMBRA MICROFIBRA 40*60 BLANCA",
    categoria: "ALFOMBRAS",
    marcaProducto: "TEXTIL NAC",
    precioVenta: 11900,
  },
  {
    sku: "7782271073015",
    descripcion: "ORGANIZADOR DE HIERRO M:34*11*7.5CM",
    categoria: "ORGANIZADORES",
    marcaProducto: "COCINA - Surtido",
    precioVenta: 11700,
  },
  {
    sku: "6942138946529",
    descripcion: "MASCARA DE BUCEO",
    categoria: "JUEGOS DE AGUA Y PLAYA",
    marcaProducto: "JUGUETERIA",
    precioVenta: 7900,
  },
  {
    sku: "7792780610328",
    descripcion: "TORTERA ALTA 8CM N32",
    categoria: "HORNEADO",
    marcaProducto: "ALUMINIO",
    precioVenta: 5200,
  },
  {
    sku: "7797232006810",
    descripcion: "HERMETICO CUADRADO 2.7L",
    categoria: "CONTENEDORES Y RECIPIENTES HERMETICOS",
    marcaProducto: "COMPRAS NACIONALES",
    precioVenta: 4100,
  },
  {
    sku: "50502721379",
    descripcion: "LUZ LED X 100 7 MTS VERDE",
    categoria: "LUCES DE NAVIDAD",
    marcaProducto: "NAVIDAD",
    precioVenta: 3700,
  },
];

export function buscarArticuloMock(sku: string): Articulo | null {
  const limpio = sku.trim();
  return ARTICULOS_MOCK.find((a) => a.sku === limpio) ?? null;
}
