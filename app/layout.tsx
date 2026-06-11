import type { Metadata } from "next";
import { THEME_BOOT } from "@/lib/security/theme-boot";
import "./globals.css";

export const metadata: Metadata = {
  title: "Advancer — A Kyron System",
  description:
    "The event advancement command centre — budgets, suppliers, schedules and site operations in one controlled live project.",
};

// The CSP carries a per-request nonce (proxy.ts), so every page must render at
// request time — a statically prerendered page would ship build-time framework
// scripts with no nonce and 'strict-dynamic' would block them (no hydration).
// Pinning it here also stops any future page from silently going static.
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline so it runs before first paint — no dark-mode flash. The CSP
            authorises it by content hash (lib/security/theme-boot.ts), so it
            needs no nonce. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
