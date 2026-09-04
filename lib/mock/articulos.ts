import type { Articulo } from "@/types";

/**
 * Datos de ejemplo para poder probar la app SIN conexion a la base real.
 * Se usan automaticamente cuando falta DATABASE_URL (ver lib/db/client.ts).
 * El formato de "sku" imita los codigos reales (9 a 13 digitos).
 *
 * precioLista2/3/6 imitan la relacion real entre listas (ver DISENO_BBDD_AZURE
 * §9.10): lista6 (caja/Efectivo) = lista2 * 0.9046; lista3 = lista6 / 0.80.
 */
function conListas(precioLista2: number): Pick<Articulo, "precioLista2" | "precioLista3" | "precioLista6"> {
  const precioLista6 = Math.round(precioLista2 * 0.9046);
  const precioLista3 = Math.round(precioLista6 / 0.8);
  return { precioLista2, precioLista3, precioLista6 };
}

export const ARTICULOS_MOCK: Articulo[] = [
  {
    sku: "092626528020",
    descripcion: "LAPICES COLOR FROZEN X 12",
    categoria: "ESCRITURA",
    marcaProducto: "LIBRERIA NAC",
    ...conListas(2750),
    activo: true,
    discontinuado: false,
  },
  {
    sku: "7798323772805",
    descripcion: "ALFOMBRA DE BAÑO CON BORDE LISA 40*60",
    categoria: "ALFOMBRAS DE BANIO",
    marcaProducto: "TEXTIL NAC",
    ...conListas(7600),
    activo: true,
    discontinuado: false,
  },
  {
    sku: "7798363446087",
    descripcion: "ALFOMBRA MICROFIBRA 40*60 BLANCA",
    categoria: "ALFOMBRAS",
    marcaProducto: "TEXTIL NAC",
    ...conListas(11900),
    activo: false,
    discontinuado: false,
  },
  {
    sku: "7782271073015",
    descripcion: "ORGANIZADOR DE HIERRO M:34*11*7.5CM",
    categoria: "ORGANIZADORES",
    marcaProducto: "COCINA - Surtido",
    ...conListas(11700),
    activo: true,
    discontinuado: false,
  },
  {
    sku: "6942138946529",
    descripcion: "MASCARA DE BUCEO",
    categoria: "JUEGOS DE AGUA Y PLAYA",
    marcaProducto: "JUGUETERIA",
    ...conListas(7900),
    activo: true,
    discontinuado: false,
  },
  {
    sku: "7792780610328",
    descripcion: "TORTERA ALTA 8CM N32",
    categoria: "HORNEADO",
    marcaProducto: "ALUMINIO",
    ...conListas(5200),
    activo: true,
    discontinuado: false,
  },
  {
    sku: "7797232006810",
    descripcion: "HERMETICO CUADRADO 2.7L",
    categoria: "CONTENEDORES Y RECIPIENTES HERMETICOS",
    marcaProducto: "COMPRAS NACIONALES",
    ...conListas(4100),
    activo: true,
    discontinuado: true,
  },
  {
    sku: "50502721379",
    descripcion: "LUZ LED X 100 7 MTS VERDE",
    categoria: "LUCES DE NAVIDAD",
    marcaProducto: "NAVIDAD",
    ...conListas(3700),
    activo: true,
    discontinuado: false,
  },
];

export function buscarArticuloMock(sku: string): Articulo | null {
  const limpio = sku.trim();
  return ARTICULOS_MOCK.find((a) => a.sku === limpio) ?? null;
}
