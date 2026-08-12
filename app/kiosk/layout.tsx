import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kumon Check-In",
  robots: { index: false, follow: false }
};

// Full-screen kiosk layout -- bypasses the root layout's padded content wrapper.
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-surface-page">
      {children}
    </div>
  );
}
