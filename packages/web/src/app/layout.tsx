import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "mytool — Claude Code observability",
  description:
    "Track tool usage, token consumption and costs from your Claude Code sessions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
