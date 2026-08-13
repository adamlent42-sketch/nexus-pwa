import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OPS — Kumon of Wappingers Falls",
  robots: { index: false, follow: false },
};

// Full-screen layout — overrides the root layout's padded <main> wrapper
// so the sidebar + branded header can span the full viewport.
export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-[#f8fafc]">
      {children}
    </div>
  );
}
