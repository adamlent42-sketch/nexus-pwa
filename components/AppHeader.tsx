"use client";

import Link from "next/link";
import { Lock, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatDate } from "@/lib/utils";

export function AppHeader() {
  const queryClient = useQueryClient();
  const [spinning, setSpinning] = useState(false);
  const today = new Date();

  const onRefresh = async () => {
    setSpinning(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setSpinning(false), 400);
  };

  return (
    <header className="flex items-center justify-between gap-3 pb-4 mb-5 border-b border-line">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded bg-brand text-white flex items-center justify-center font-display font-bold text-base">
          K
        </div>
        <div>
          <p className="text-[18px] font-medium leading-tight">Operations dashboard</p>
          <p className="text-[13px] text-ink-secondary mt-0.5">{formatDate(today, "long")}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 text-[13px] px-3 py-2 rounded border border-line bg-surface hover:bg-surface-muted"
          aria-label="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
        <Link
          href={"/admin" as const}
          className="inline-flex items-center gap-1.5 text-[13px] px-3 py-2 rounded border border-line bg-surface hover:bg-surface-muted"
          aria-label="Open admin"
        >
          <Lock className="w-4 h-4" />
          <span className="hidden sm:inline">Admin</span>
        </Link>
      </div>
    </header>
  );
}
