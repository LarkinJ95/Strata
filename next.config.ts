import type { NextConfig } from "next";
if (process.env.NODE_ENV === "development") {
  // Loaded only for `next dev`; importing it during production builds can start
  // the local Cloudflare development bridge unnecessarily.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initOpenNextCloudflareForDev } = require("@opennextjs/cloudflare");
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", ".prisma/client", "bcryptjs", "pdfkit", "svg-to-pdfkit"],
  allowedDevOrigins: [
    "3000-iktntbmmo03x8m31nddfy.e2b.app",
    "*.e2b.app",
    "*.arena.ai",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  images: {
    remotePatterns: [],
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
