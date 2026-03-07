import type { Metadata } from "next";
import "./globals.css";

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
      <body className="bg-zinc-950 text-zinc-50 antialiased">{children}</body>
    </html>
  );
}
