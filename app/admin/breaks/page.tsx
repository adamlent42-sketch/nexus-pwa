"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PauseCircle } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";

interface Hold {
  id: string; name: string; lifecycle: string | null;
  holdStart: string | null; plannedReturn: string | null; checkin: string | null;
  notes: string | null; invoiceAction: string | null;
}

function todayIso() { return new Date().toISOString().slice(0, 10); }

export default function BreaksPage() {
  const q = useQuery({ queryKey: ["admin", "breaks"], queryFn: () => adminFetch<Hold[]>("/api/admin/breaks") });

  if (q.isPending) return <Skeleton rows={4} />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  if (!q.data) return null;

  const today = todayIso();
  const onBreak = q.data.filter((h) => h.lifecycle === "Planned Break");
  const invoiceTodos = q.data.filter((h) => h.invoiceAction && h.invoiceAction !== "Done");

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-1">
        <PauseCircle className="w-5 h-5 text-brand" />
        <p className="text-[16px] font-medium">Breaks &amp; holds</p>
      </div>
      <p className="text-[13px] text-ink-secondary mb-4">Families on a planned break, sorted by check-in date. Red = check-in due. Click anyone to open their record and act.</p>

      {invoiceTodos.length > 0 && (
        <div className="card card-body mb-4">
          <p className="text-[13px] font-medium mb-2">Invoice Ninja to-dos ({invoiceTodos.length})</p>
          <div className="space-y-1">
            {invoiceTodos.map((h) => (
              <Link key={h.id} href={`/admin/students?id=${h.id}&name=${encodeURIComponent(h.name)}`} className="flex items-center justify-between gap-2 text-[13px] hover:bg-surface-muted rounded px-2 py-1">
                <span>{h.name}</span>
                <span className={`badge ${h.invoiceAction === "Cancel recurring" ? "bg-status-danger-bg text-status-danger-fg" : "bg-status-success-bg text-status-success-fg"}`}>{h.invoiceAction}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {onBreak.length === 0 ? (
        <EmptyState icon={<PauseCircle className="w-5 h-5" />} message="No families on a planned break." />
      ) : (
        <div className="space-y-1.5">
          {onBreak.map((h) => {
            const due = !!h.checkin && h.checkin <= today;
            return (
              <Link key={h.id} href={`/admin/students?id=${h.id}&name=${encodeURIComponent(h.name)}`} className="block card card-body hover:bg-surface-muted transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[15px] font-medium">{h.name}</p>
                  {h.checkin && <span className={`badge ${due ? "bg-status-danger-bg text-status-danger-fg" : "bg-surface-muted text-ink-secondary"}`}>check-in {h.checkin}{due ? " · due" : ""}</span>}
                </div>
                <p className="meta mt-1">{h.holdStart ?? "?"} → returns {h.plannedReturn ?? "?"}{h.notes ? ` · ${h.notes}` : ""}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
