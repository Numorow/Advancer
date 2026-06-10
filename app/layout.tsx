import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Advancer — A Kyron System",
  description:
    "The event advancement command centre — budgets, suppliers, schedules and site operations in one controlled live project.",
};

/* Applies the saved (or system) theme before first paint so dark mode never flashes. */
const THEME_BOOT = `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
