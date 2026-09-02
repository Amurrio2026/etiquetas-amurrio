/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pg", "bwip-js", "pdf-lib"],
  },
};

export default nextConfig;
