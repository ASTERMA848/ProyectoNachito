/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deshabilitar el header x-powered-by para no revelar la tecnología
  poweredByHeader: false,

  // En producción, deshabilitar source maps para no exponer el código fuente
  productionBrowserSourceMaps: false,

  // Configurar los orígenes permitidos para imágenes
  images: {
    remotePatterns: [],
  },

  // Headers de seguridad adicionales (refuerzo a los del middleware)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      // Cache-Control para archivos estáticos subidos
      {
        source: "/uploads/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
