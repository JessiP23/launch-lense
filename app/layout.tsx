import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LaunchLense — Kill Bad Startup Ideas in 48h",
  description: "Ad account insurance for venture studios. Compress 8-week validation to 48 hours.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#FAFAF8] text-[#111110]">{children}</body>
    </html>
  );
}
