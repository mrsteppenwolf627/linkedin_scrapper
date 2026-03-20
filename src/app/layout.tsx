import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "LinkedIn Lead Scraper",
  description: "Busca y extrae perfiles de LinkedIn usando Google Search",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
