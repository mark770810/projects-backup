import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// 使用 Inter 字体替代 Geist
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "AI Knowledge Base",
  description: "Powered by Next.js + Supabase + OpenAI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
