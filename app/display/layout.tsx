import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kumon Center -- Who's Here",
  robots: { index: false, follow: false }
};

// Full-screen TV display layout -- bypasses the root layout's padded content wrapper.
export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#1A1A2E]">
      {children}
    </div>
  );
}
