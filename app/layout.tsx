import type { Metadata } from "next";
import type { Viewport } from "next";
import { Inter } from "next/font/google";
import "../styles/globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import { Providers } from "./providers";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Self-hosted via next/font so every OS renders the same typeface instead
// of falling back to Segoe UI / system defaults. Exposed as --font-inter,
// which globals.css picks up in the body font stack.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "EVACSIM - Crowd Evacuation Simulator",
  description: "Agent-based crowd evacuation simulator with predictive congestion analysis",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}

