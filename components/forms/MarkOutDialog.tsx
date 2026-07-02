"use client";

import { AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useMarkOut } from "@/lib/mutations";
import { useToast } from "@/lib/toast";

interface StaffPick { id: string; name: string }

interface Props {
  open: boolean;
  onClose: () => void;
  staff: StaffPick | null;
}

export function MarkOutDialog({ open, onClose, staff }: Props) {
  const mutation = useMarkOut();
  const toast = useToast();

  if (!staff) return null;

  const submit = async () => {
    try {
      await mutation.mutateAsync({ staffId: staff.id });
      toast.push(`${staff.name} marked out today.`, "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to mark out", "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mark out today"
      icon={<AlertCircle className="w-4 h-4" />}
      tintClassName="bg-status-warn-bg text-status-warn-fg"
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? "Marking…" : "Mark out"}
          </button>
        </>
      }
    >
      <p className="text-[14px] leading-snug">
        Mark <span className="font-bold">{staff.name}</span> out today?
      </p>
      <p className="text-[12px] text-ink-secondary mt-2">
        This logs a Same-Day Absence and the existing automation will send {staff.name.split(" ")[0]} a notification email.
      </p>
    </Modal>
  );
}
