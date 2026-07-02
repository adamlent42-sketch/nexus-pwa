import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submit time off · Kumon",
  description: "Internal staff time-off request",
  robots: { index: false, follow: false }  // not indexable
};

export default function TimeOffLayout({ children }: { children: React.ReactNode }) {
  return <div className="px-4 sm:px-6">{children}</div>;
}
