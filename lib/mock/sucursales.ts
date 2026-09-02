import type { Sucursal } from "@/types";

/**
 * Sucursales reales de Grand Bazaar (nombres tomados de bazar_analytics),
 * con emails de ejemplo -- mientras TEST_MODE=true nunca se usan de verdad,
 * asi que no hace falta que sean los reales todavia.
 */
export const SUCURSALES_MOCK: Sucursal[] = [
  { codigoSucursal: 18, nombre: "Ramos", marca: "Grand Bazaar", email: "ramos@grandbazaar.example" },
  { codigoSucursal: 19, nombre: "Cabildo", marca: "Grand Bazaar", email: "cabildo@grandbazaar.example" },
  { codigoSucursal: 20, nombre: "San Miguel", marca: "Grand Bazaar", email: "sanmiguel@grandbazaar.example" },
  { codigoSucursal: 21, nombre: "Moron", marca: "Grand Bazaar", email: "moron@grandbazaar.example" },
  { codigoSucursal: 23, nombre: "Quilmes", marca: "Grand Bazaar", email: "quilmes@grandbazaar.example" },
  { codigoSucursal: 24, nombre: "Sucursal Nueva", marca: "Grand Bazaar", email: "sucursalnueva@grandbazaar.example" },
];
