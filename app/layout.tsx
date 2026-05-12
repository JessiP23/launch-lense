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
      <html lang="en" className="h-full antialiased">
        <body className="min-h-full flex flex-col bg-[#FAFAF8] text-[#111110]">
          <PosthogProvider>{children}</PosthogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
