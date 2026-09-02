import { Pool } from "pg";

let pool: Pool | null = null;

/**
 * Devuelve el pool de conexion a la base real (bazar_analytics), o null si
 * todavia no se configuro DATABASE_URL -- en ese caso el resto de la app
 * usa los datos de ejemplo (ver lib/mock) sin romperse.
 */
export function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 5,
      ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export function tieneBaseReal(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
