import { NextRequest, NextResponse } from "next/server";
import { resolverLineasMasivo, type LineaPedida } from "@/lib/pdf/resolver-lineas";
import { listarSucursalesActivas } from "@/lib/db/sucursales.repository";
import { listasUsadasPorSucursal, type PreciosArchivo } from "@/lib/precios/resolver-precio";

interface ItemCuerpo {
  sku: string;
  cantidad?: number;
  // Precios del archivo (opcionales): undefined = esa columna no vino en el archivo,
  // null = la columna vino pero la celda de este articulo esta vacia / no es un numero.
  lista2?: number | null;
  lista3?: number | null;
  lista6?: number | null;
}

interface CuerpoValidar {
  sucursalCodigo: number;
  items: ItemCuerpo[];
}

const MAX_ITEMS = 10000;
const LISTAS = ["lista6", "lista3", "lista2"] as const;
const NOMBRE_LISTA: Record<(typeof LISTAS)[number], string> = {
  lista6: "Lista 6",
  lista3: "Lista 3",
  lista2: "Lista 2",
};

export async function POST(req: NextRequest) {
  const cuerpo = (await req.json()) as CuerpoValidar;

  if (!cuerpo.items?.length) {
    return NextResponse.json({ error: "El archivo no tiene ningún código para procesar" }, { status: 400 });
  }
  if (cuerpo.items.length > MAX_ITEMS) {
    return NextResponse.json({ error: `El archivo tiene demasiadas filas (máximo ${MAX_ITEMS}).` }, { status: 400 });
  }
  if (!cuerpo.sucursalCodigo) {
    return NextResponse.json({ error: "Falta elegir la sucursal" }, { status: 400 });
  }

  const sucursales = await listarSucursalesActivas();
  const sucursal = sucursales.find((s) => s.codigoSucursal === cuerpo.sucursalCodigo);
  if (!sucursal) {
    return NextResponse.json({ error: "La sucursal elegida no existe" }, { status: 400 });
  }

  // Que columnas de precio trajo el archivo (aparece la clave en al menos una fila).
  const columnasEnArchivo = new Set<(typeof LISTAS)[number]>();
  for (const item of cuerpo.items) {
    for (const lista of LISTAS) if (item[lista] !== undefined) columnasEnArchivo.add(lista);
  }
  const usadas = new Set(listasUsadasPorSucursal(sucursal));
  const listasUsadasDelArchivo = LISTAS.filter((l) => columnasEnArchivo.has(l) && usadas.has(l)).map((l) => NOMBRE_LISTA[l]);
  const listasIgnoradas = LISTAS.filter((l) => columnasEnArchivo.has(l) && !usadas.has(l)).map((l) => NOMBRE_LISTA[l]);

  // Suma cantidades de SKUs repetidos en el archivo (decisión de Lucila,
  // 2026-09-04) y deja registro de cuáles estaban duplicados para el resumen.
  // Si un SKU repetido trae precios, vale el de la ULTIMA fila.
  const totalFilasLeidas = cuerpo.items.length;
  const cantidadPorSku = new Map<string, number>();
  const preciosPorSku = new Map<string, PreciosArchivo>();
  const duplicados = new Set<string>();
  for (const item of cuerpo.items) {
    const codigo = (item.sku ?? "").trim();
    if (!codigo) continue;
    const cantidad = item.cantidad && item.cantidad > 0 ? Math.floor(item.cantidad) : 1;
    if (cantidadPorSku.has(codigo)) duplicados.add(codigo);
    cantidadPorSku.set(codigo, (cantidadPorSku.get(codigo) ?? 0) + cantidad);
    if (columnasEnArchivo.size > 0) {
      const precios: PreciosArchivo = {};
      for (const lista of LISTAS) if (columnasEnArchivo.has(lista)) precios[lista] = item[lista] ?? null;
      preciosPorSku.set(codigo, precios);
    }
  }

  const pedidas: LineaPedida[] = Array.from(cantidadPorSku.entries()).map(([sku, cantidad]) => ({
    sku,
    cantidad,
    precios: preciosPorSku.get(sku),
  }));
  const { lineas, faltantes, sinPrecio, precioParcial, preciosIncompletos, inactivosODiscontinuados } =
    await resolverLineasMasivo(pedidas, sucursal);
  const incompletos = preciosIncompletos ?? [];

  return NextResponse.json({
    resumen: {
      totalFilasLeidas,
      skusUnicos: pedidas.length,
      duplicados: duplicados.size,
      encontrados: lineas.length,
      noEncontrados: faltantes.length,
      sinPrecio: sinPrecio.length,
      precioParcial: precioParcial.length,
      preciosIncompletos: incompletos.length,
      inactivosODiscontinuados: inactivosODiscontinuados.length,
      totalEtiquetas: lineas.reduce((acc, l) => acc + l.cantidad, 0),
      listasUsadasDelArchivo,
      listasIgnoradas,
    },
    detalle: {
      duplicados: Array.from(duplicados),
      noEncontrados: faltantes,
      sinPrecio,
      precioParcial,
      preciosIncompletos: incompletos,
      inactivosODiscontinuados,
    },
    // Listo para mandar tal cual a /api/etiquetas/pdf o /api/envios/email. Si el archivo traia
    // precios, viajan con cada linea (solo las listas que usa la sucursal) y se vuelven a
    // validar en esas rutas.
    lineasValidas: lineas.map((l) => {
      const precios = l.precios;
      const usados: PreciosArchivo = {};
      if (precios) {
        for (const lista of listasUsadasPorSucursal(sucursal)) {
          if (precios[lista] !== undefined) usados[lista] = precios[lista];
        }
      }
      return {
        sku: l.articulo.sku,
        cantidad: l.cantidad,
        ...(Object.keys(usados).length > 0 ? { precios: usados } : {}),
      };
    }),
  });
}
