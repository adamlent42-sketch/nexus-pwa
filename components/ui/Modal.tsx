"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  tintClassName?: string; // e.g. "bg-tint-alerts-bg text-tint-alerts-fg"
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl"
};

export function Modal({ open, onClose, title, icon, tintClassName, size = "md", children, footer }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={cn("w-full bg-surface rounded-lg border border-line overflow-hidden", SIZE[size])}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn("px-4 py-3 flex items-center justify-between border-b border-line", tintClassName)}>
          <div className="flex items-center gap-2 text-[15px] font-medium">
            {icon}
            {title}
          </div>
          <button onClick={onClose} aria-label="Close" className="opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
        {footer && (
          <div className="px-4 py-3 bg-surface-muted border-t border-line flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
