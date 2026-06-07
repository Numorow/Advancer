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
  },
};

export default nextConfig;
