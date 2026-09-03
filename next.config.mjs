/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pg", "bwip-js", "pdf-lib"],
    // Los logos (public/logos/*.png) se leen con fs en tiempo de ejecucion
    // (lib/pdf/generar-pdf.ts) para incrustarlos en el PDF. Sin esto,
    // Vercel no los incluye en la funcion serverless y el PDF sale sin logo.
    outputFileTracingIncludes: {
      "/api/etiquetas/pdf": ["./public/logos/**/*", "./assets/fonts/**/*"],
      "/api/envios/email": ["./public/logos/**/*", "./assets/fonts/**/*"],
    },
  },
};

export default nextConfig;
