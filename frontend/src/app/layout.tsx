
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Main font for the DocuMind AI interface
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

// Monospace font for code and technical content
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Browser tab title and SEO metadata
export const metadata: Metadata = {
  title: "DocuMind AI | Intelligent Document Assistant",

  description:
    "Upload PDFs, ask questions, and discover insights with DocuMind AI. Powered by hybrid retrieval and generative AI.",

  applicationName: "DocuMind AI",

  keywords: [
    "DocuMind AI",
    "RAG",
    "Document AI",
    "PDF Chat",
    "Hybrid Retrieval",
    "Artificial Intelligence",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen bg-[#080B17] font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
