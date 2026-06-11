import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin the workspace root — a parent lockfile exists above this folder.
  turbopack: { root: projectRoot },
  // Server-only dependencies (import pipeline + report exports).
  serverExternalPackages: ["exceljs", "@react-pdf/renderer"],
  experimental: {
    // The Kyron workbook is ~0.8 MB; allow generous headroom for uploads.
    serverActions: { bodySizeLimit: "15mb" },
    // Serve just-visited dynamic pages from the client router cache so
    // tab-hopping and back-nav feel instant; server actions still bust it
    // via revalidatePath.
    staleTimes: { dynamic: 30, static: 180 },
  },
  // Security headers (M20). CSP is deliberately deferred: Next streams RSC
  // payloads as inline scripts, so anything stricter than 'unsafe-inline'
  // breaks hydration and 'unsafe-inline' adds ~nothing — see SECURITY.md.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
  // Resize/optimise event cover images (signed Supabase storage URLs).
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lzjxkfonvdsxkfzfmvph.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
    ],
  },
};

export default nextConfig;
