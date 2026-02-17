import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "🐾 CommandMate — Mission Control",
  description: "AI Agent Management Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
