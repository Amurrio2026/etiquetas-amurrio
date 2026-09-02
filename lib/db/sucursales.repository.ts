import { getPool, tieneBaseReal } from "@/lib/db/client";
import { SUCURSALES_MOCK } from "@/lib/mock/sucursales";
import type { Sucursal } from "@/types";

/**
 * Por ahora la app solo trabaja con la marca "Grand Bazaar" (ver decision del
 * 2026-09-02: piloto arranca solo con esa marca). Cuando se sume Casa Moda,
 * esto pasa a recibir la marca como parametro en vez de estar fija.
 */
const MARCA_ACTIVA = "Grand Bazaar";

export async function listarSucursalesActivas(): Promise<Sucursal[]> {
  if (!tieneBaseReal()) {
    return SUCURSALES_MOCK.filter((s) => s.marca === MARCA_ACTIVA);
  }

  const pool = getPool()!;
  const { rows } = await pool.query(
    `select codigo_sucursal, nombre, marca, email
       from maestros.sucursales
      where activo = true
        and marca = $1
      order by nombre`,
    [MARCA_ACTIVA]
  );

  return rows.map((r) => ({
    codigoSucursal: r.codigo_sucursal,
    nombre: r.nombre,
    marca: r.marca,
    email: r.email,
  }));
}
