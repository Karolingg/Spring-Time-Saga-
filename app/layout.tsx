import type { Metadata } from "next";
import "../styles/globals.css";
import "../styles/components.css";
import "mapbox-gl/dist/mapbox-gl.css";
import { Providers } from "./providers";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "EVACSIM - Crowd Evacuation Simulator",
  description: "Agent-based crowd evacuation simulator with predictive congestion analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

