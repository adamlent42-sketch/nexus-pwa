import type { Metadata } from "next";
import type { ReactNode } from "react";

// Route-specific PWA metadata: points /po at its own manifest so "Add to Home
// Screen" pins /po (start_url=/po) instead of the app-wide dashboard start_url.
export const metadata: Metadata = {
  title: "Kumon PO Tool",
  manifest: "/po.webmanifest",
  appleWebApp: { capable: true, title: "Kumon PO", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" }
};

export default function POLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
