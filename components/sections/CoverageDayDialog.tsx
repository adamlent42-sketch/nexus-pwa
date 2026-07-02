"use client";

import { AlertCircle, CalendarDays } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { CoverageDay } from "@/types/kumon";
import { formatDate } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  day: CoverageDay | null;
}

export function CoverageDayDialog({ open, onClose, day }: Props) {
  if (!day) return null;
  const friendly = formatDate(day.date, "long");
  const highTierSet = new Set(day.highTierOutNames);
  const outSet = new Set(day.outStaffNames);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={friendly}
      icon={<CalendarDays className="w-4 h-4" />}
      tintClassName="bg-tint-staff-bg text-tint-staff-fg"
      size="sm"
    >
      <div className="text-[13px] text-ink-secondary mb-3">
        {day.isClosed
          ? "Closed"
          : `${day.scheduledCount} scheduled · ${day.outCount} out`}
      </div>

      {day.highTierOutNames.length > 0 && (
        <div className="bg-[#7A1414] text-white text-[12px] rounded px-3 py-2 mb-3 inline-flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Lead role out — Adam needs to action</span>
        </div>
      )}

      {day.isClosed ? (
        <p className="text-[14px] text-ink-secondary">No class — center closed.</p>
      ) : day.scheduledStaff.length === 0 ? (
        <p className="text-[14px] text-ink-secondary">No schedule data for this day.</p>
      ) : (
        <>
          <p className="text-[12px] font-medium text-ink-secondary uppercase tracking-wider mb-2">Scheduled</p>
          <ul className="space-y-1.5 mb-4">
            {day.scheduledStaff.map(({ name, roles }) => {
              const isOut = outSet.has(name);
              const isHigh = highTierSet.has(name);
              return (
                <li key={name} className="text-[14px] flex items-center gap-2">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                    isOut
                      ? isHigh ? "bg-[#7A1414]" : "bg-status-danger-fg"
                      : "bg-status-success-fg"
                  }`} />
                  <span className={isOut ? "line-through text-ink-tertiary" : isHigh ? "font-medium" : ""}>
                    {name}
                  </span>
                  {roles.length > 0 && (
                    <span className="text-[11px] text-ink-tertiary">{roles.join(" · ")}</span>
                  )}
                  {isOut && (
                    <span className={`text-[11px] font-medium ${isHigh ? "text-[#7A1414]" : "text-status-danger-fg"}`}>
                      {isHigh ? "OUT · Lead" : "OUT"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Anyone marked out who isn't on the regular schedule (sub, unknown) */}
          {day.outStaffNames.filter((n) => !day.scheduledStaff.find((s) => s.name === n)).length > 0 && (
            <>
              <p className="text-[12px] font-medium text-ink-secondary uppercase tracking-wider mb-2">Also out</p>
              <ul className="space-y-1.5">
                {day.outStaffNames
                  .filter((n) => !day.scheduledStaff.find((s) => s.name === n))
                  .map((name) => {
                    const isHigh = highTierSet.has(name);
                    return (
                      <li key={name} className="text-[14px] flex items-center gap-2">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${isHigh ? "bg-[#7A1414]" : "bg-status-danger-fg"}`} />
                        <span className={isHigh ? "font-medium" : ""}>{name}</span>
                        {isHigh && <span className="text-[11px] text-[#7A1414] font-medium uppercase tracking-wider">Lead</span>}
                      </li>
                    );
                  })}
              </ul>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
