import { getPool, tieneBaseReal } from "@/lib/db/client";
import { SUCURSALES_MOCK } from "@/lib/mock/sucursales";
import type { Sucursal } from "@/types";

/**
 * Marcas habilitadas en la app (2026-09-03: se suma Casa Moda al piloto,
 * que arrancó solo con Grand Bazaar). Agregar una marca nueva acá alcanza
 * para que aparezcan sus sucursales -- la plantilla correcta se resuelve
 * sola en base a "marca" (ver lib/config.ts).
 */
const MARCAS_ACTIVAS = ["Grand Bazaar", "Casa Moda"];

export async function listarSucursalesActivas(): Promise<Sucursal[]> {
  if (!tieneBaseReal()) {
    return SUCURSALES_MOCK.filter((s) => MARCAS_ACTIVAS.includes(s.marca));
  }

  const pool = getPool()!;
  const { rows } = await pool.query(
    `select codigo_sucursal, nombre, marca, email
       from maestros.sucursales
      where activo = true
        and marca = any($1)
      order by marca, nombre`,
    [MARCAS_ACTIVAS]
  );

  return rows.map((r) => ({
    codigoSucursal: r.codigo_sucursal,
    nombre: r.nombre,
    marca: r.marca,
    email: r.email,
  }));
}
