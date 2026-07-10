import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My schedule · Kumon",
  description: "View your schedule and submit a change request",
  robots: { index: false, follow: false }
};

export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
  return <div className="px-4 sm:px-6">{children}</div>;
}
