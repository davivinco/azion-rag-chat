export const runtime = "edge";

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Azion RAG Chat",
  description: "Interface inicial do assistente com RAG",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}