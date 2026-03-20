import type { Metadata } from "next";
import "./globals.css";

import { SWRProvider } from "@/components/SWRProvider";

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
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-50 antialiased">
        <SWRProvider>{children}</SWRProvider>
      </body>
    </html>
  );
}
