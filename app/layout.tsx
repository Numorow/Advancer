import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Advancer — A Kyron System",
  description:
    "The event advancement command centre — budgets, suppliers, schedules and site operations in one controlled live project.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
