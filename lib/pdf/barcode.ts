import bwipjs from "bwip-js/node";

/**
 * Genera la imagen (PNG) de un codigo de barras. No se usa en la plantilla
 * actual de Grand Bazaar (esa etiqueta solo muestra el codigo como texto),
 * pero queda lista para el dia que una plantilla (por ejemplo Casa Moda, u
 * otra mas adelante) incluya un codigo de barras real para escanear.
 */
export async function generarCodigoBarras(codigo: string, alturaMm: number): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: "code128", // sirve para codigos de 9 a 13 digitos, no solo EAN-13
    text: codigo,
    scale: 4,
    height: Math.max(alturaMm, 8),
    includetext: false,
    backgroundcolor: "FFFFFF",
  });
}
