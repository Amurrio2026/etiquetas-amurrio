import { getPool, tieneBaseReal } from "@/lib/db/client";
import {
  ARTICULOS_MOCK,
  buscarArticuloMock,
  buscarArticulosMockPorContenedor,
  buscarArticulosMockPorProveedor,
  listarProveedoresNacionalesMock,
} from "@/lib/mock/articulos";
import type { Articulo } from "@/types";

const TTL_MS = 5 * 60 * 1000; // 5 minutos, ver arquitectura: "cache refrescada cada pocos minutos"

let cache: Map<string, Articulo> | null = null;
// codigo_barra -> sku (maestros.codigos_barra, tabla nueva del 05/10/2026: un
// SKU puede tener varios codigos de barra, y el que se escanea/tipea en el
// local a veces es ese y no el sku). Se refresca junto con "cache".
let cacheBarras: Map<string, string> = new Map();
let cacheCargadaEn = 0;
// sku -> codigo de barra elegido para imprimir en la etiqueta (ver elegirCodigoBarra)
let barraParaImprimir: Map<string, string> = new Map();
// SKU en mayusculas -> sku real: para que un lector que manda "bym109730" (o con otra
// capitalizacion) igual encuentre el articulo "BYM109730".
let skuPorMayuscula: Map<string, string> = new Map();

/**
 * Pedido de Lucila (2026-10-05): la etiqueta tiene que mostrar el CODIGO DE
 * BARRAS, no el sku interno (los "BYM...", "JU...", "L929", etc.).
 * - Si el sku ya es un numero de 8+ digitos, ES el codigo de barras: se deja.
 * - Si no (sku con letras o numero corto) se toma uno de maestros.codigos_barra,
 *   solo de los numericos, prefiriendo EAN-13, luego 12, 8 y el mas largo; si
 *   hay empate, el menor (para que sea siempre el mismo). Un sku puede tener
 *   hasta 14 codigos: no hay forma de saber cual es "el principal".
 * - Si no hay ninguno, se imprime el sku (mejor eso que dejarlo vacio).
 */
function elegirCodigoBarra(sku: string, barras: string[] | undefined): string {
  if (/^\d{8,}$/.test(sku)) return sku;
  const numericas = (barras ?? []).filter((b) => /^\d+$/.test(b));
  if (numericas.length === 0) return sku;
  const prioridad = (b: string) => (b.length === 13 ? 0 : b.length === 12 ? 1 : b.length === 8 ? 2 : 3);
  numericas.sort((a, b) => prioridad(a) - prioridad(b) || (prioridad(a) === 3 ? b.length - a.length : 0) || a.localeCompare(b));
  return numericas[0];
}

function conCodigoBarra(a: Articulo): Articulo {
  return { ...a, codigoBarra: barraParaImprimir.get(a.sku) ?? a.sku };
}

async function cargarCacheDesdeBaseReal(): Promise<Map<string, Articulo>> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL no configurada");

  // OJO: no se filtra por "activo". Se probó en producción (2026-09-03) y la
  // gran mayoria de los articulos reales (15.238 de ~20.000) figuran con
  // activo=false en la base aunque esten a la venta en el local -- ese campo
  // no refleja "esta en el local ahora", asi que filtrar por el dejaba sin
  // encontrar la mayoria de los codigos reales escaneados. Se trae igual
  // (junto con "discontinuado") para mostrarlo como aviso informativo, no
  // para excluir nada.
  //
  // 2026-09-04: la columna "precio_venta" de esta tabla se RENOMBRO a
  // "precio_lista2" al incorporarse las listas 3 y 6 (ver DISENO_BBDD_AZURE
  // §4.1 / §9.10) -- consultarla por su nombre viejo rompe con "column
  // precio_venta does not exist". Ahora se traen las 3 listas por separado;
  // cuál se muestra en la etiqueta se resuelve en lib/precios/resolver-precio.ts
  // según sucursal + tipo de precio elegido, no acá.
  const { rows } = await pool.query(
    `select sku, descripcion, categoria, marca, precio_lista2, precio_lista3, precio_lista6, activo, discontinuado
       from maestros.articulos
      where descripcion is not null`
  );

  const mapa = new Map<string, Articulo>();
  for (const r of rows) {
    mapa.set(r.sku, {
      sku: r.sku,
      descripcion: r.descripcion,
      categoria: r.categoria,
      marcaProducto: r.marca,
      precioLista2: r.precio_lista2 != null ? Number(r.precio_lista2) : null,
      precioLista3: r.precio_lista3 != null ? Number(r.precio_lista3) : null,
      precioLista6: r.precio_lista6 != null ? Number(r.precio_lista6) : null,
      activo: Boolean(r.activo),
      discontinuado: Boolean(r.discontinuado),
    });
  }
  return mapa;
}

function cargarCacheMock(): Map<string, Articulo> {
  const mapa = new Map<string, Articulo>();
  for (const a of ARTICULOS_MOCK) mapa.set(a.sku, a);
  return mapa;
}

async function cargarBarrasDesdeBaseReal(): Promise<Map<string, string>> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL no configurada");
  const { rows } = await pool.query(`select codigo_barra, sku from maestros.codigos_barra`);
  const mapa = new Map<string, string>();
  for (const r of rows) mapa.set(String(r.codigo_barra).trim(), String(r.sku).trim());
  return mapa;
}

async function obtenerCache(): Promise<Map<string, Articulo>> {
  const vencida = !cache || Date.now() - cacheCargadaEn > TTL_MS;
  if (!vencida && cache) return cache;

  if (tieneBaseReal()) {
    cache = await cargarCacheDesdeBaseReal();
    // Si la tabla de codigos de barra fallara (ej. permisos), la app sigue
    // funcionando solo por sku como antes en vez de caerse entera.
    try {
      cacheBarras = await cargarBarrasDesdeBaseReal();
    } catch (err) {
      console.error("No se pudo cargar maestros.codigos_barra (se sigue solo por sku)", err);
      cacheBarras = new Map();
    }
    const porSku = new Map<string, string[]>();
    for (const [barra, sku] of cacheBarras) {
      const lista = porSku.get(sku);
      if (lista) lista.push(barra);
      else porSku.set(sku, [barra]);
    }
    skuPorMayuscula = new Map();
    // Solo se ignora mayusculas/minusculas. NO se ignoran guiones: "BYM1131-28" y "BYM1131280"
    // son articulos distintos y mezclarlos imprimiria un precio equivocado.
    for (const sku of cache.keys()) skuPorMayuscula.set(sku.toUpperCase(), sku);
    barraParaImprimir = new Map();
    for (const sku of cache.keys()) barraParaImprimir.set(sku, elegirCodigoBarra(sku, porSku.get(sku)));
    for (const [sku, a] of cache) cache.set(sku, conCodigoBarra(a));
  } else {
    cache = cargarCacheMock();
  }
  cacheCargadaEn = Date.now();
  return cache;
}

/**
 * Misma regla que maestros.buscar_articulo(codigo) en la base: primero match
 * directo por sku; SOLO si no hay, se busca como codigo de barra (asi un sku
 * que casualmente coincide con el codigo de barra de OTRO articulo no pierde).
 */
function resolverCodigo(mapa: Map<string, Articulo>, codigo: string): Articulo | null {
  const directo = mapa.get(codigo);
  if (directo) return directo;
  const sku = cacheBarras.get(codigo);
  if (sku) return mapa.get(sku) ?? null;
  // Ultimo recurso: ignorar mayusculas/minusculas (solo para codigos con letras).
  if (/^[0-9]+$/.test(codigo)) return null;
  const real = skuPorMayuscula.get(codigo.toUpperCase());
  return real ? mapa.get(real) ?? null : null;
}

/**
 * Algunos lectores anteponen un "identificador de simbologia" AIM al codigo leido:
 * "]" + una letra + un caracter (ej. "]C1" = Code 128, "]E0" = EAN-13, "]A0" = Code 39).
 * Caso real (2026-10-05): al escanear BYM1131280 llegaba "]C1BYM1131280" y no se encontraba.
 * Tambien se sacan caracteres de control y espacios de los costados.
 */
export function limpiarCodigoEscaneado(crudo: string): string {
  return crudo
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(/^\][A-Za-z][0-9A-Za-z]/, "")
    .trim();
}

/**
 * Busca un articulo por el codigo escaneado/tipeado: sku o, si no matchea,
 * codigo de barra (ver resolverCodigo). Devuelve null si no existe.
 */
export async function buscarArticuloPorSku(sku: string): Promise<Articulo | null> {
  const codigo = limpiarCodigoEscaneado(sku);
  if (!codigo) return null;

  if (!tieneBaseReal()) return buscarArticuloMock(codigo);

  const mapa = await obtenerCache();
  return resolverCodigo(mapa, codigo);
}

/**
 * Busca muchos SKUs de una sola vez (carga masiva). Como el maestro completo
 * ya vive en memoria (ver obtenerCache/TTL de 5 min), esto NO dispara una
 * query nueva ni una query por SKU -- son lookups en un Map, instantaneos
 * incluso con miles de codigos.
 */
export async function buscarArticulosPorSkus(skus: string[]): Promise<Map<string, Articulo>> {
  const mapa = tieneBaseReal() ? await obtenerCache() : cargarCacheMock();
  const resultado = new Map<string, Articulo>();
  for (const skuCrudo of skus) {
    const codigo = limpiarCodigoEscaneado(skuCrudo);
    if (!codigo) continue;
    const articulo = resolverCodigo(mapa, codigo);
    if (articulo) resultado.set(codigo, articulo);
  }
  return resultado;
}

/**
 * Normaliza lo que Lucila anota como "número de contenedor" para poder
 * buscarlo: mayúsculas, solo letras/números, y le agrega el prefijo "BYM"
 * si no lo puso (así "292" y "BYM292" buscan lo mismo -- todos los
 * contenedores de Amurrio usan ese prefijo, ver comex.contenedor). Devuelve
 * "" si no queda nada útil.
 */
export function normalizarCodigoContenedor(input: string): string {
  const limpio = input.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!limpio) return "";
  return limpio.startsWith("BYM") ? limpio : `BYM${limpio}`;
}

/**
 * Busca todos los articulos de un contenedor, vía el campo "familia" del
 * maestro (maestros.articulos.familia -- "es el contenedor en el que arriba
 * la mercadería", ver DISENO_BBDD_AZURE §4.1). Se probó contra la base real
 * (2026-09-09): el campo NO tiene un formato 100% consistente ("BYM292 -
 * AGOSTO 2026", "BYM130-JUNIO2022", a veces solo "BYM"), así que se
 * matchea por el código al PRINCIPIO del valor seguido de un caracter que
 * no sea alfanumérico (o el final del texto) -- para que "292" no matchee
 * "2920" ni el "29" de "BYM29X", pero sí encuentre cualquier variante de
 * sufijo/fecha que seguía al código real.
 *
 * OJO: se probó también cruzar por comex.pedido_contenedor (el seguimiento
 * de contenedores en tránsito), pero esa tabla vive en un schema aparte que
 * la documentación de la base marca como "en construcción, tratar con
 * cautela", y su código de línea (ej. "BYM1552-01") NO matchea directo con
 * el sku de maestros.articulos -- requeriría el mismo backfill manual que
 * usa Ana, nada confiable para algo que termina impreso en una etiqueta de
 * precio. "familia" vive en la tabla de artículos de siempre, sin cruces.
 */
export async function buscarArticulosPorContenedor(codigoContenedorCrudo: string): Promise<Articulo[]> {
  const codigo = normalizarCodigoContenedor(codigoContenedorCrudo);
  if (!codigo) return [];

  if (!tieneBaseReal()) return buscarArticulosMockPorContenedor(codigo);

  const pool = getPool()!;
  const patron = `^${codigo}([^0-9A-Za-z]|$)`;
  const { rows } = await pool.query(
    `select sku, descripcion, categoria, marca, precio_lista2, precio_lista3, precio_lista6, activo, discontinuado
       from maestros.articulos
      where descripcion is not null
        and familia ~* $1`,
    [patron]
  );

  await obtenerCache(); // asegura barraParaImprimir cargado
  return rows.map((r) =>
    conCodigoBarra({
      sku: r.sku,
      descripcion: r.descripcion,
      categoria: r.categoria,
      marcaProducto: r.marca,
      precioLista2: r.precio_lista2 != null ? Number(r.precio_lista2) : null,
      precioLista3: r.precio_lista3 != null ? Number(r.precio_lista3) : null,
      precioLista6: r.precio_lista6 != null ? Number(r.precio_lista6) : null,
      activo: Boolean(r.activo),
      discontinuado: Boolean(r.discontinuado),
    })
  );
}

/**
 * Lista los nombres de proveedores nacionales disponibles para el selector
 * de la pestaña "Por contenedor" -- son los valores de "familia" que NO son
 * un código de contenedor (esos siempre empiezan con "BYM", ver
 * normalizarCodigoContenedor). Se devuelven tal cual están cargados (sin
 * agrupar variantes como "SOIFER (2012)" con "SOIFER"): agrupar a ciegas
 * podría mezclar proveedores distintos que casualmente comparten el
 * prefijo, así que se prefiere mostrar la lista real para elegir con
 * precisión.
 */
export async function listarProveedoresNacionales(): Promise<string[]> {
  if (!tieneBaseReal()) return listarProveedoresNacionalesMock();

  const pool = getPool()!;
  const { rows } = await pool.query(
    `select distinct familia
       from maestros.articulos
      where familia is not null
        and familia !~* '^\\s*BYM'
      order by familia`
  );
  return rows.map((r) => r.familia as string);
}

/**
 * Busca todos los articulos de un proveedor nacional (via "familia", igual
 * que buscarArticulosPorContenedor pero por NOMBRE exacto en vez de código
 * de contenedor -- ver listarProveedoresNacionales). Si se pasan fechas,
 * solo devuelve los articulos cuyo precio (en la lista que efectivamente se
 * imprime para esa sucursal: lista6 siempre + lista2 o lista3 segun
 * corresponda) fue MODIFICADO dentro de ese rango, segun
 * maestros.precios_historico.vigente_desde -- pedido de Lucila (2026-09-25)
 * para proveedores con muchos articulos, donde no tiene sentido reimprimir
 * TODO el catalogo cada vez.
 */
export async function buscarArticulosPorProveedor(
  nombreProveedor: string,
  listasAFiltrar: string[],
  fechaDesde?: string,
  fechaHasta?: string
): Promise<Articulo[]> {
  const nombre = nombreProveedor.trim();
  if (!nombre) return [];

  if (!tieneBaseReal()) return buscarArticulosMockPorProveedor(nombre);

  const pool = getPool()!;
  const hayRangoFechas = Boolean(fechaDesde && fechaHasta);

  const { rows } = await pool.query(
    `select sku, descripcion, categoria, marca, precio_lista2, precio_lista3, precio_lista6, activo, discontinuado
       from maestros.articulos a
      where descripcion is not null
        and familia = $1
        and (
          $2 = false
          or exists (
            select 1 from maestros.precios_historico h
             where h.sku = a.sku
               and h.lista = any($3::text[])
               and h.vigente_desde between $4::date and $5::date
          )
        )`,
    [nombre, hayRangoFechas, listasAFiltrar, fechaDesde ?? null, fechaHasta ?? null]
  );

  await obtenerCache(); // asegura barraParaImprimir cargado
  return rows.map((r) =>
    conCodigoBarra({
      sku: r.sku,
      descripcion: r.descripcion,
      categoria: r.categoria,
      marcaProducto: r.marca,
      precioLista2: r.precio_lista2 != null ? Number(r.precio_lista2) : null,
      precioLista3: r.precio_lista3 != null ? Number(r.precio_lista3) : null,
      precioLista6: r.precio_lista6 != null ? Number(r.precio_lista6) : null,
      activo: Boolean(r.activo),
      discontinuado: Boolean(r.discontinuado),
    })
  );
}

export function usandoDatosDeEjemplo(): boolean {
  return !tieneBaseReal();
}

/**
 * DIAGNOSTICO TEMPORAL (2026-10-05): para ver desde la app desplegada si puede
 * leer maestros.codigos_barra y si resuelve un codigo puntual. Se saca una vez
 * resuelto el problema de que escanear un codigo de barras no traia nada.
 */
export async function diagnosticarBarras(codigo: string) {
  const pool = getPool();
  if (!pool) return { baseReal: false };
  const salida: Record<string, unknown> = { baseReal: true, codigo };
  try {
    const u = await pool.query(`select current_user as usuario`);
    salida.usuarioDb = u.rows[0]?.usuario;
    const c = await pool.query(`select count(*)::int as filas from maestros.codigos_barra`);
    salida.filasCodigosBarra = c.rows[0]?.filas;
    const r = await pool.query(`select sku from maestros.codigos_barra where codigo_barra = $1`, [codigo]);
    salida.skuPorBarra = r.rows[0]?.sku ?? null;
    const a = await pool.query(`select sku, descripcion is not null as tiene_descripcion from maestros.articulos where sku = $1`, [r.rows[0]?.sku ?? "__ninguno__"]);
    salida.articulo = a.rows[0] ?? null;
  } catch (err: any) {
    salida.error = String(err?.message ?? err);
  }
  const mapa = await obtenerCache().catch(() => null);
  salida.enCache = { articulos: mapa?.size ?? null, barras: cacheBarras.size, resuelve: mapa ? Boolean(resolverCodigo(mapa, codigo)) : null };
  return salida;
}
