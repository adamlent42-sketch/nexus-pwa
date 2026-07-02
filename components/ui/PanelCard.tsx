import { cn } from "@/lib/utils";

export type Tint = "alerts" | "notes" | "pos" | "purple" | "staff";

interface Props {
  title: React.ReactNode;
  icon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  headerAction?: React.ReactNode;   // small button next to the title (e.g. "+ Add")
  tint: Tint;
  className?: string;
  children: React.ReactNode;
}

const HEAD_BG: Record<Tint, string> = {
  alerts: "bg-tint-alerts-bg text-tint-alerts-fg",
  notes:  "bg-tint-notes-bg text-tint-notes-fg",
  pos:    "bg-tint-pos-bg text-tint-pos-fg",
  purple: "bg-tint-purple-bg text-tint-purple-fg",
  staff:  "bg-tint-staff-bg text-tint-staff-fg"
};

const SUB_COLOR: Record<Tint, string> = {
  alerts: "text-tint-alerts-sub",
  notes:  "text-tint-notes-sub",
  pos:    "text-tint-pos-sub",
  purple: "text-tint-purple-sub",
  staff:  "text-tint-staff-sub"
};

export function PanelCard({ title, icon, rightSlot, headerAction, tint, className, children }: Props) {
  return (
    <section className={cn("card", className)}>
      <div className={cn("panel-head", HEAD_BG[tint])}>
        <span className="flex items-center gap-1.5">
          {icon}
          {title}
        </span>
        <span className="flex items-center gap-2">
          {rightSlot && <span className={cn("text-[11px]", SUB_COLOR[tint])}>{rightSlot}</span>}
          {headerAction}
        </span>
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}
