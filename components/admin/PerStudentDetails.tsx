"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { useToast } from "@/lib/toast";
import { TextInput } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { WEEKDAYS } from "@/lib/options";

interface PerStudent {
  id: string;
  name: string;
  grade: string | null;
  subjects: string[];
  mathLevel: string | null;
  readingLevel: string | null;
  schedule: string[];
}

interface Props {
  poId: string;
}

export function PerStudentDetails({ poId }: Props) {
  const qc = useQueryClient();
  const toast = useToast();

  const q = useQuery({
    queryKey: ["admin", "po-students", poId],
    queryFn: () => adminFetch<PerStudent[]>(`/api/admin/po-recaps/${poId}/students`)
  });

  const [rows, setRows] = useState<PerStudent[]>([]);
  useEffect(() => {
    if (q.data) setRows(q.data);
  }, [q.data]);

  const mutation = useMutation({
    mutationFn: (students: PerStudent[]) =>
      adminFetch<{ count: number }>(`/api/admin/po-recaps/${poId}/students`, {
        method: "PATCH",
        body: JSON.stringify({ students })
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "po-students", poId] });
      qc.invalidateQueries({ queryKey: ["instruction-notes"] });
    }
  });

  const update = (i: number, partial: Partial<PerStudent>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...partial } : r)));
  };

  const save = async () => {
    try {
      await mutation.mutateAsync(rows);
      toast.push(`Saved details for ${rows.length} student${rows.length === 1 ? "" : "s"}.`, "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to save", "error");
    }
  };

  if (q.isPending) return <Skeleton rows={3} />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  if (!q.data || q.data.length === 0) return null;

  return (
    <div className="card">
      <div className="panel-head bg-tint-purple-bg text-tint-purple-fg">
        <span><Users className="w-3.5 h-3.5 inline mr-1" />Per-student details</span>
        <span className="text-[12px]">{rows.length} linked student{rows.length === 1 ? "" : "s"}</span>
      </div>
      <div className="panel-body space-y-4">
        <p className="text-[12px] text-ink-secondary">
          Set each student's individual subjects, levels, and class days. These live on the Student record (not the PO).
        </p>
        {rows.map((s, i) => (
          <div key={s.id} className="border border-line rounded-md p-3">
            <p className="text-[14px] font-medium mb-3">
              {s.name}
              {s.grade && <span className="text-[12px] text-ink-secondary font-normal ml-2">Gr {s.grade}</span>}
            </p>

            <div className="mb-3">
              <label className="text-[11px] font-medium text-ink-secondary mb-1.5 block">Subjects</label>
              <ChipGroup multi value={s.subjects} onChange={(v) => update(i, { subjects: v })} options={["Math", "Reading"]} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[11px] font-medium text-ink-secondary mb-1.5 block">Math level</label>
                <TextInput value={s.mathLevel ?? ""} onChange={(e) => update(i, { mathLevel: e.target.value })} placeholder="e.g. 2A" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-ink-secondary mb-1.5 block">Reading level</label>
                <TextInput value={s.readingLevel ?? ""} onChange={(e) => update(i, { readingLevel: e.target.value })} placeholder="e.g. 3A" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-ink-secondary mb-1.5 block">Schedule</label>
              <ChipGroup multi value={s.schedule} onChange={(v) => update(i, { schedule: v })} options={WEEKDAYS} />
            </div>
          </div>
        ))}

        <div className="flex justify-end">
          <button onClick={save} disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? "Saving…" : `Save all (${rows.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
