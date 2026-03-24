import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { SWRProvider } from "@/components/SWRProvider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "GDrivePlayer",
  description: "Private Google Drive video player",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-zinc-950 font-sans text-zinc-50 antialiased">
        <SWRProvider>{children}</SWRProvider>
      </body>
    </html>
  );
}
