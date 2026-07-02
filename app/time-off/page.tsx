"use client";

import { useState } from "react";
import { CalendarOff, CheckCircle2 } from "lucide-react";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { StaffSelect } from "@/components/ui/StaffSelect";
import { useCreateTimeOff } from "@/lib/mutations";
import { useToast } from "@/lib/toast";
import { TimeOffCreate } from "@/lib/schemas";
import { TIME_OFF_TYPES } from "@/lib/options";
import { todayInET } from "@/lib/time";

export default function TimeOffPage() {
  const [staffId, setStaffId] = useState<string | null>(null);
  const [type, setType] = useState<string | null>("Planned Absence");
  const [startDate, setStartDate] = useState(todayInET());
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mutation = useCreateTimeOff();
  const toast = useToast();

  const submit = async () => {
    setError(null);
    const payload = {
      staffId: staffId ?? "",
      type: (type ?? "Planned Absence") as "Planned Absence" | "Sick" | "Other",
      startDate,
      endDate: endDate || null,
      notes: notes.trim() || undefined
    };
    const parsed = TimeOffCreate.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join("; "));
      return;
    }
    try {
      await mutation.mutateAsync(parsed.data);
      setDone(true);
      toast.push("Submitted. Pending approval.", "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to submit", "error");
    }
  };

  const reset = () => {
    setStaffId(null);
    setType("Planned Absence");
    setStartDate(todayInET());
    setEndDate("");
    setNotes("");
    setError(null);
    setDone(false);
  };

  return (
    <div className="max-w-xl mx-auto py-6">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-line">
        <div className="w-10 h-10 rounded bg-brand text-white flex items-center justify-center font-display font-bold">
          K
        </div>
        <div>
          <p className="text-[18px] font-medium leading-tight">Submit time off</p>
          <p className="text-[13px] text-ink-secondary mt-0.5">Kumon Wappingers Falls</p>
        </div>
      </div>

      {done ? (
        <div className="card card-body text-center py-10">
          <CheckCircle2 className="w-12 h-12 text-status-success-fg mx-auto mb-3" />
          <p className="text-[18px] font-medium mb-1">Request submitted</p>
          <p className="text-[13px] text-ink-secondary mb-5">
            Pending Adam's approval. You'll get a confirmation email once it's reviewed.
          </p>
          <button onClick={reset} className="btn">Submit another</button>
        </div>
      ) : (
        <div className="card card-body">
          <p className="text-[14px] text-ink-secondary mb-5">
            Submit a time-off request. Adam reviews these in his admin dashboard and approves or follows up.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Staff" required>
              <StaffSelect value={staffId} onChange={setStaffId} placeholder="Pick yourself…" />
            </Field>
            <Field label="Type" required>
              <ChipGroup value={type} onChange={setType} options={TIME_OFF_TYPES} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Start date" required>
              <TextInput type="date" value={startDate} min={todayInET()} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="End date" hint="blank = single day">
              <TextInput type="date" value={endDate} min={startDate || todayInET()} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>

          <Field label="Notes" hint="optional">
            <TextArea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context helps Adam approve faster — let us know what's up."
            />
          </Field>

          {error && <p className="text-[12px] text-status-danger-fg mt-1 mb-3">{error}</p>}

          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={submit}
              disabled={mutation.isPending}
              className="btn btn-primary"
            >
              {mutation.isPending ? "Submitting…" : "Submit request"}
            </button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-ink-tertiary text-center mt-6">
        Internal use · Kumon Wappingers Falls
      </p>
    </div>
  );
}
