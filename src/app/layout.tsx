import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import StoreProvider from "./StoreProvider";
import { Toaster } from "@/components/shared/Toaster";
import { siteConfig } from "@/config/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: { title: siteConfig.name, description: siteConfig.description },
};

export const viewport: Viewport = {
  themeColor: "#d71f26",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <StoreProvider>
          {children}
          <Toaster />
        </StoreProvider>
      </body>
    </html>
  );
}
