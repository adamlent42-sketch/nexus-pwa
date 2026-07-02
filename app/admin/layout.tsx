import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { FormsProvider } from "@/components/forms/FormsProvider";

export const metadata: Metadata = {
  title: "Owner operations · Kumon",
  robots: { index: false, follow: false }
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell>
      <FormsProvider>{children}</FormsProvider>
    </AdminShell>
  );
}
