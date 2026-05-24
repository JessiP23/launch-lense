import type { Metadata } from "next";
import "./globals.css";
import { PosthogProvider } from "@/components/posthog-provider";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "LaunchLense",
  description:
    "Genome: free go/no-go preview. Validate with $500 tests on Google, Meta, LinkedIn, or TikTok. Healthgate™ protects your budget.",
  icons: {
    icon: "/logo.png"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/canvas"
      signUpFallbackRedirectUrl="/canvas"
      afterSignOutUrl="/"
    >
      <html lang="en" className="h-full antialiased scroll-smooth">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600&family=Sora:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        </head>
        <body className="min-h-full flex flex-col bg-[#ffffff] text-[#1a1a1a]">
          <PosthogProvider>{children}</PosthogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
