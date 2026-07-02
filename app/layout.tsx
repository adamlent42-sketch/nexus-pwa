import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const montserratDisplay = Montserrat({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-display",
  display: "swap"
});

const montserratBody = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-body",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Kumon Operations",
  description: "Operations dashboard for Wappingers Falls Kumon",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png"
  },
  robots: { index: false, follow: false }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3F5AA8"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${montserratDisplay.variable} ${montserratBody.variable}`}>
      <body>
        <Providers>
          <main className="max-w-[1800px] mx-auto px-4 py-4 sm:px-6 sm:py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
