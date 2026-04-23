import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LaunchLense — Kill Bad Startup Ideas in 48h",
  description:
    "Genome: free go/no-go preview. Validate with $500 tests on Google, Meta, LinkedIn, or TikTok. Healthgate™ protects your budget.",
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
