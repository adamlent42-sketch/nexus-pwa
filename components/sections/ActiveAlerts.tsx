"use client";

import { Bell, Plus, Pencil } from "lucide-react";
import { PanelCard } from "@/components/ui/PanelCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useActiveAlerts } from "@/lib/queries";
import { useAcknowledgeAlert } from "@/lib/mutations";
import { useToast } from "@/lib/toast";
import { useForms } from "@/components/forms/FormsProvider";
import { relativeTime } from "@/lib/time";

export function ActiveAlerts() {
  const q = useActiveAlerts();
  const ack = useAcknowledgeAlert();
  const toast = useToast();
  const forms = useForms();

  const onAck = async (id: string) => {
    try {
      await ack.mutateAsync({ id });
      toast.push("Alert acknowledged.", "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to acknowledge", "error");
    }
  };

  return (
    <PanelCard
      tint="alerts"
      title="Active alerts"
      icon={<Bell className="w-4 h-4" />}
      rightSlot={q.data ? `${q.data.length} open` : undefined}
      headerAction={
        <button
          onClick={forms.openStaffAlert}
          className="inline-flex items-center gap-1 text-[12px] font-medium px-2 py-1 rounded border border-current opacity-80 hover:opacity-100"
          title="Add a new staff alert"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      }
    >
      {q.isPending && <Skeleton rows={3} />}
      {q.isError && <ErrorState message={q.error.message} onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && (
        <EmptyState icon={<Bell className="w-4 h-4" />} message="No active alerts." />
      )}
      {q.data && q.data.length > 0 && (
        <div>
          {q.data.map((a) => (
            <div key={a.id} className="row">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold leading-snug mb-0.5">
                  {a.studentName ?? "Staff alert"}
                </p>
                <p className="text-[14px] leading-snug">{a.alert}</p>
                <p className="meta mt-1.5 flex items-center gap-2">
                  {a.category && (
                    <span className="badge bg-tint-alerts-bg text-tint-alerts-fg">{a.category}</span>
                  )}
                  {a.createdBy && <span>{a.createdBy}</span>}
                  {a.createdAt && <span>· {relativeTime(a.createdAt)}</span>}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <button
                  onClick={() => forms.openAlertEdit(a)}
                  className="btn inline-flex items-center gap-1"
                  title="Edit this alert"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => onAck(a.id)}
                  disabled={ack.isPending && ack.variables?.id === a.id}
                  className="btn btn-primary"
                >
                  {ack.isPending && ack.variables?.id === a.id ? "Saving…" : "Acknowledge"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}
