"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy, Car, CalendarPlus, UserCog, CalendarOff, Phone,
  ChevronDown, ClipboardCheck, CheckSquare, Square
} from "lucide-react";

import { FormsProvider, useForms } from "@/components/forms/FormsProvider";
import { ViewDateProvider } from "@/components/ViewDateContext";
import { ActiveAlerts } from "@/components/sections/ActiveAlerts";
import { TodaysPOs } from "@/components/sections/TodaysPOs";
import { TodaysInstructionNotes } from "@/components/sections/TodaysInstructionNotes";
import { Onboarding } from "@/components/sections/Onboarding";
import { RecentlyStarted } from "@/components/sections/RecentlyStarted";
import { TodaysStaff } from "@/components/sections/TodaysStaff";
import { StatCards } from "@/components/StatCards";
import { DateSelector } from "@/components/DateSelector";

// ── Types ────────────────────────────────────────────────────────────────────

type Mode = "before" | "during" | "closeout";

const MODES: { key: Mode; label: string; emoji: string }[] = [
  { key: "before",   label: "Before Class", emoji: "📋" },
  { key: "during",   label: "During Class", emoji: "🎯" },
  { key: "closeout", label: "Close Out",    emoji: "✅" },
];

const VIEWS = [
  { label: "OPS Dashboard", href: "/ops" },
  { label: "Classic Dashboard", href: "/" },
  { label: "Floor View", href: "/floor" },
  { label: "Kiosk", href: "/kiosk" },
];

// Close Out physical checklist — static reminder, not tracked in DB
const CLOSEOUT_CHECKLIST = [
  "All students checked out",
  "Payments collected & secured",
  "PO recaps submitted",
  "Doors locked",
  "Chairs up on tables",
  "Tables wiped down",
  "Lights off",
];

// ── View Switcher ─────────────────────────────────────────────────────────────

function ViewSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[12px] font-medium text-ink-secondary border border-line rounded-lg px-3 py-2 hover:bg-surface-subtle transition-colors"
      >
        View: <span className="text-ink font-semibold">OPS Dashboard</span>
        <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-line rounded-xl shadow-lg z-50 py-1 min-w-[180px]">
          {VIEWS.map((v) => (
            <a
              key={v.href}
              href={v.href}
              onClick={() => setOpen(false)}
              className={`block px-4 py-2.5 text-[13px] hover:bg-surface-subtle transition-colors ${
                v.href === "/ops" ? "font-semibold text-brand" : "text-ink"
              }`}
            >
              {v.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function OpsHeader({ mode, onModeChange }: { mode: Mode; onModeChange: (m: Mode) => void }) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const dayStr = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="-mx-4 sm:-mx-6 mb-5 sticky top-0 z-40 bg-white border-b border-line shadow-sm">
      {/* Branding + controls */}
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-white font-black text-[14px] shrink-0">
            K
          </div>
          <div>
            <div className="text-[16px] font-black text-ink leading-tight tracking-tight">
              KUMON
            </div>
            <div className="text-[11px] text-ink-secondary font-medium leading-none">
              of Wappingers Falls
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-[12px] font-medium text-ink-tertiary">
            {dayStr} · {timeStr}
          </span>
          <ViewSwitcher />
        </div>
      </div>

      {/* Mode tabs */}
      <div className="px-4 sm:px-6 flex gap-0 border-t border-line">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => onModeChange(m.key)}
            className={`py-2.5 px-4 text-[13px] font-semibold border-b-2 transition-colors ${
              mode === m.key
                ? "border-brand text-brand"
                : "border-transparent text-ink-secondary hover:text-ink"
            }`}
          >
            {m.emoji} {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Action Rows (mode-specific) ───────────────────────────────────────────────

function BeforeAndDuringActions() {
  const forms = useForms();
  const actions = [
    { key: "achievement", label: "Achievement",      icon: <Trophy className="w-4 h-4" />,     color: "text-tint-pos-sub",    onClick: () => forms.openAchievementTest() },
    { key: "po",          label: "Book PO",          icon: <CalendarPlus className="w-4 h-4" />, color: "text-tint-pos-sub",  onClick: forms.openCreatePO },
    { key: "student",     label: "Update student",   icon: <UserCog className="w-4 h-4" />,     color: "text-tint-notes-sub",  onClick: () => forms.openStudentUpdate() },
    { key: "timeoff",     label: "Time off",         icon: <CalendarOff className="w-4 h-4" />, color: "text-ink-secondary",   onClick: forms.openTimeOff },
    { key: "logconv",     label: "Log conversation", icon: <Phone className="w-4 h-4" />,       color: "text-tint-notes-sub",  onClick: forms.openLogConversation },
  ];
  return (
    <div className="grid grid-cols-5 gap-2 mb-4">
      {actions.map((a) => (
        <button
          key={a.key}
          onClick={a.onClick}
          className="flex flex-col sm:flex-row items-center justify-center gap-2 py-3 px-3 text-[13px] rounded border border-line bg-surface hover:bg-surface-muted transition-colors"
        >
          <span className={a.color}>{a.icon}</span>
          <span className="text-center leading-tight">{a.label}</span>
        </button>
      ))}
    </div>
  );
}

function CloseOutActions() {
  const forms = useForms();
  const actions = [
    { key: "achievement", label: "Achievement",      icon: <Trophy className="w-4 h-4" />,     color: "text-tint-pos-sub",    onClick: () => forms.openAchievementTest() },
    { key: "pickup",      label: "Pickup notice",    icon: <Car className="w-4 h-4" />,         color: "text-tint-purple-sub", onClick: forms.openPickup },
    { key: "student",     label: "Update student",   icon: <UserCog className="w-4 h-4" />,     color: "text-tint-notes-sub",  onClick: () => forms.openStudentUpdate() },
    { key: "timeoff",     label: "Time off",         icon: <CalendarOff className="w-4 h-4" />, color: "text-ink-secondary",   onClick: forms.openTimeOff },
    { key: "logconv",     label: "Log conversation", icon: <Phone className="w-4 h-4" />,       color: "text-tint-notes-sub",  onClick: forms.openLogConversation },
  ];
  return (
    <div className="grid grid-cols-5 gap-2 mb-4">
      {actions.map((a) => (
        <button
          key={a.key}
          onClick={a.onClick}
          className="flex flex-col sm:flex-row items-center justify-center gap-2 py-3 px-3 text-[13px] rounded border border-line bg-surface hover:bg-surface-muted transition-colors"
        >
          <span className={a.color}>{a.icon}</span>
          <span className="text-center leading-tight">{a.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Close Out Checklist Card ──────────────────────────────────────────────────

function CloseOutChecklist() {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const allDone = checked.size === CLOSEOUT_CHECKLIST.length;

  return (
    <div className={`card card-body ${allDone ? "border-status-success-fg bg-status-success-bg" : ""}`}>
      <div className="flex items-center gap-2 mb-3">
        <ClipboardCheck className={`w-4 h-4 ${allDone ? "text-status-success-fg" : "text-ink-secondary"}`} />
        <p className="text-[14px] font-semibold">
          {allDone ? "🎉 All done — ready to close!" : "Close Out Checklist"}
        </p>
        <span className="ml-auto text-[12px] text-ink-tertiary">
          {checked.size}/{CLOSEOUT_CHECKLIST.length}
        </span>
      </div>
      <div className="space-y-2">
        {CLOSEOUT_CHECKLIST.map((item, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            className="w-full flex items-center gap-3 text-left group"
          >
            {checked.has(i)
              ? <CheckSquare className="w-4 h-4 text-status-success-fg shrink-0" />
              : <Square className="w-4 h-4 text-ink-tertiary shrink-0 group-hover:text-ink-secondary" />
            }
            <span className={`text-[13px] ${checked.has(i) ? "line-through text-ink-tertiary" : "text-ink"}`}>
              {item}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Mode Views ────────────────────────────────────────────────────────────────

function BeforeClass() {
  return (
    <>
      <BeforeAndDuringActions />
      <StatCards />
      <DateSelector />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <div id="todays-pos"><TodaysPOs /></div>
        <div className="flex flex-col gap-3">
          <div id="onboarding"><Onboarding /></div>
          <TodaysInstructionNotes />
        </div>
        <div id="active-alerts"><ActiveAlerts /></div>
        <div id="todays-staff"><TodaysStaff /></div>
      </div>
    </>
  );
}

function DuringClass() {
  return (
    <>
      <BeforeAndDuringActions />
      <StatCards />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <div id="active-alerts"><ActiveAlerts /></div>
        <TodaysInstructionNotes />
        <div id="todays-pos"><TodaysPOs /></div>
        <div id="onboarding"><Onboarding /></div>
      </div>
    </>
  );
}

function CloseOut() {
  return (
    <>
      <CloseOutActions />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <div className="flex flex-col gap-3">
          <div id="active-alerts"><ActiveAlerts /></div>
          <div id="recently-started"><RecentlyStarted /></div>
        </div>
        <div className="flex flex-col gap-3">
          <div id="todays-pos"><TodaysPOs /></div>
          <CloseOutChecklist />
        </div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function OpsContent() {
  const [mode, setMode] = useState<Mode>("before");

  // Auto-select mode based on time of day; also restore from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("kumon-ops-mode") as Mode | null;
    if (saved && ["before", "during", "closeout"].includes(saved)) {
      setMode(saved);
      return;
    }
    // Default by time: before 4pm → before, 4-7pm → during, after 7pm → closeout
    const h = new Date().getHours();
    if (h < 16) setMode("before");
    else if (h < 19) setMode("during");
    else setMode("closeout");
  }, []);

  const handleModeChange = (m: Mode) => {
    setMode(m);
    localStorage.setItem("kumon-ops-mode", m);
  };

  return (
    <div>
      <OpsHeader mode={mode} onModeChange={handleModeChange} />
      {mode === "before"   && <BeforeClass />}
      {mode === "during"   && <DuringClass />}
      {mode === "closeout" && <CloseOut />}
    </div>
  );
}

export default function OpsPage() {
  return (
    <ViewDateProvider>
      <FormsProvider>
        <OpsContent />
      </FormsProvider>
    </ViewDateProvider>
  );
}
