import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { PriceAlertWatcher } from "@/components/dashboard/PriceAlertWatcher";
import { SelectedAssetProvider } from "@/components/providers/SelectedAssetContext";
import "./globals.css";

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crypto & Stocks Dashboard",
  description: "Real-time crypto and stock/ETF price dashboard with an AI assistant.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SelectedAssetProvider>
            <PriceAlertWatcher />
            {children}
          </SelectedAssetProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
