import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Google Drive Video Player",
  description: "Private Google Drive video player",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
