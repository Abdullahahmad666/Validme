import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";
import { BRAND_NAME, BRAND_TAGLINE, SITE_URL } from "@/lib/brand";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: BRAND_NAME, template: `%s · ${BRAND_NAME}` },
  description: BRAND_TAGLINE,
  applicationName: BRAND_NAME,
  formatDetection: { telephone: false, email: false, address: false },
  appleWebApp: { title: BRAND_NAME, capable: true, statusBarStyle: "default" },
};

// Browser chrome + Discord/Slack embed accent colour.
export const viewport: Viewport = {
  themeColor: "#172D4D",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
