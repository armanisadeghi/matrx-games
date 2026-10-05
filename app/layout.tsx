import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { Toaster } from "sonner";
import { cookies, headers } from "next/headers";
import { ViewportHintProvider } from "@ai-matrx/kit/media-query";
import {
  VIEWPORT_HINT_COOKIE,
  viewportHintIsMobile,
} from "@ai-matrx/kit/viewport-hint";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Matrx Games",
  description: "Multiplayer party games - play together in real-time",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const isMobile = viewportHintIsMobile({
    cookie: cookieStore.get(VIEWPORT_HINT_COOKIE)?.value,
    chUaMobile: headerStore.get("sec-ch-ua-mobile"),
    userAgent: headerStore.get("user-agent"),
  });
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ViewportHintProvider isMobile={isMobile}>
            {children}
          </ViewportHintProvider>
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
