"use client";

import { useState, useEffect } from "react";
import {
  Trophy, Car, CalendarPlus, UserCog, CalendarOff, Phone,
  AlertTriangle, Eye, Pin, ChevronDown, Users, BookOpen,
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

type Mode = "before" | "during" | "closeout" | "checklists";

// ── Checklist data ────────────────────────────────────────────────────────────

const OPENING_CHECKLIST: Record<string, string[]> = {
  "Access & Entry": [
    "Unlock the brown door using the Allen key so staff can enter freely",
    "Unlock main classroom door",
    "Turn on lights",
    "Open blinds",
    "Set thermostat to class setting",
  ],
  "Facility & Room Setup": [
    "Open and turn on computers",
    "Check classroom for cleanliness",
    "Spot clean tables, chairs, and floors as needed",
    "Vacuum if required",
    "Empty and check the robot vacuum",
    "Empty trash as needed",
    "Take any large trash or boxes to the dumpster",
    "Straighten waiting area",
    "Place parent chairs outside the classroom",
    "Clean windows as needed",
    "Put away library books",
  ],
  "Student Materials & Folders": [
    "Bring any work left outside the classroom into the classroom",
    "Place that work back into the correct student folders",
    "Check manila folders for turned-in work",
    "Move any turned-in work from manila folders to the grading station",
    "Confirm plastic folders are organized and accessible",
    "Check pencils and erasers are available for students",
    "Sharpen pencils as needed",
  ],
  "Staff & Student Readiness": [
    "Place student folders/sleeves in arrival order",
    "Review New Student Alert(s), if any",
    "Review notes for students needing extra support",
  ],
};

const CLOSING_CHECKLIST: Record<string, string[]> = {
  "Academic Close-Out (Complete Before Reset)": [
    "Grade all classwork, achievement tests, and homework",
    "Complete all data entry",
    'Place student folders (data entry done) into "Data Entry Complete" bin',
    'Place folders requiring review into "Instructor Review" bin',
    "Place graded achievement tests into Instructor Review bin after data entry",
    "Place student notes in front pocket of folder; leave in Instructor Review bin",
    "Place any new student plastic folders into Instructor Review bin",
    "Update New Student green folders as needed",
    "Store New Student green folders in New Student file holder on main desk",
  ],
  "Absent Student Work Handling": [
    "Identify students absent who were scheduled to pick up work",
    "Place their work in a manila envelope, write student name clearly",
    "Place envelope in the bin outside the center door",
  ],
  "Materials & Stations Reset": [
    "Put away all answer book sets",
    "Organize grading station",
    "Return student folders to designated storage areas",
  ],
  "Room Reset & Cleaning": [
    "Clean all tables",
    "Spot clean floors as needed",
    "Place desks and stools on top of tables",
    "Stack parent chairs from outside and bring them inside the center",
    "Put away library books",
    "Straighten waiting area",
    "Empty trash if needed",
  ],
  "End-of-Day Close": [
    "Power down computers",
    "Turn off lights",
    "Confirm all doors are locked",
  ],
};

// ── Attendance tile ───────────────────────────────────────────────────────────

type ActiveSession = { studentName: string; checkInTime: string };

function AttendanceTile() {
  const [active, setActive] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/checkin/active");
        if (res.ok) {
          const data = await res.json();
          setActive(data.sessions ?? data ?? []);
        }
      } catch {
        // silently degrade — show 0
      } finally {
        setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const checkedIn = active.length;

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden mb-4 shadow-sm">
      <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center gap-3">
        <Users className="w-4 h-4 text-brand" />
        <span className="text-[13px] font-bold text-ink">Today's Attendance</span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-status-success-fg bg-status-success-bg px-2 py-0.5 rounded-full">
          ● Live
        </span>
        <span className="ml-auto text-[12px] text-ink-secondary">Updates as students scan in</span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-[#e2e8f0]">
        {/* Students */}
        <div className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-secondary mb-2">
            Students Checked In
          </p>
          {loading ? (
            <div className="h-10 bg-surface-muted rounded animate-pulse w-24" />
          ) : (
            <p className="text-[32px] font-black text-brand leading-none">{checkedIn}</p>
          )}
          <p className="text-[12px] text-ink-secondary mt-1">currently in session</p>
        </div>

        {/* Who's here */}
        <div className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-secondary mb-2">
            Currently Here
          </p>
          {loading ? (
            <div className="space-y-1.5">
              <div className="h-3 bg-surface-muted rounded animate-pulse w-32" />
              <div className="h-3 bg-surface-muted rounded animate-pulse w-24" />
            </div>
          ) : active.length === 0 ? (
            <p className="text-[13px] text-ink-secondary italic">No one checked in yet</p>
          ) : (
            <p className="text-[13px] text-ink-secondary leading-relaxed">
              {active.slice(0, 5).map((s) => s.studentName).join(", ")}
              {active.length > 5 && ` +${active.length - 5} more`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Checklist reference panel ─────────────────────────────────────────────────

function ChecklistPanel({
  title,
  icon,
  note,
  data,
}: {
  title: string;
  icon: React.ReactNode;
  note: string;
  data: Record<string, string[]>;
}) {
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center gap-2">
        {icon}
        <span className="text-[13px] font-bold text-ink">{title}</span>
        <span className="ml-auto text-[11px] text-ink-secondary italic">{note}</span>
      </div>
      {Object.entries(data).map(([section, items]) => (
        <div key={section}>
          <div className="px-4 py-2 bg-[#f8fafc] border-y border-[#e2e8f0] text-[10.5px] font-bold uppercase tracking-wider text-ink-secondary">
            {section}
          </div>
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 px-4 py-2.5 border-b border-[#f1f5f9] last:border-b-0 text-[12.5px] text-ink-secondary"
            >
              <div className="w-4 h-4 shrink-0 mt-0.5 rounded border border-[#cbd5e1] bg-white" />
              {item}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

const MODES: { key: Mode; label: string; emoji: string; time?: string }[] = [
  { key: "before",     label: "Before Class",  emoji: "☀️",  time: "– 11am" },
  { key: "during",     label: "During Class",  emoji: "📋", time: "11a – 7p" },
  { key: "closeout",   label: "Close Out",     emoji: "🌙", time: "7p +" },
  { key: "checklists", label: "Checklists",    emoji: "✅" },
];

const VIEWS = [
  { label: "OPS Dashboard",   href: "/ops" },
  { label: "Classic Dashboard", href: "/" },
  { label: "Floor View",      href: "/floor" },
  { label: "Kiosk",           href: "/kiosk" },
];

function Sidebar({ mode, onModeChange }: { mode: Mode; onModeChange: (m: Mode) => void }) {
  const forms = useForms();

  const ACTIONS = [
    { label: "Record Achievement", icon: <Trophy className="w-3.5 h-3.5" />,       onClick: () => forms.openAchievementTest() },
    { label: "Book PO",            icon: <CalendarPlus className="w-3.5 h-3.5" />, onClick: forms.openCreatePO },
    { label: "Update Student",     icon: <UserCog className="w-3.5 h-3.5" />,      onClick: () => forms.openStudentUpdate() },
    { label: "Pickup Notice",      icon: <Car className="w-3.5 h-3.5" />,          onClick: forms.openPickup },
    { label: "Log Time Off",       icon: <CalendarOff className="w-3.5 h-3.5" />,  onClick: forms.openTimeOff },
    { label: "Log Conversation",   icon: <Phone className="w-3.5 h-3.5" />,        onClick: forms.openLogConversation },
    { label: "Create Staff Alert", icon: <AlertTriangle className="w-3.5 h-3.5" />, onClick: () => {} },
    { label: "Log Observation",    icon: <Eye className="w-3.5 h-3.5" />,          onClick: () => {} },
    { label: "Instruction Alert",  icon: <Pin className="w-3.5 h-3.5" />,          onClick: () => {} },
  ];

  return (
    <aside className="w-[220px] shrink-0 bg-[#f1f5f9] border-r border-[#e2e8f0] flex flex-col overflow-y-auto">
      {/* Focus modes */}
      <div className="px-2.5 pt-3 pb-1">
        <p className="text-[10px] font-bold uppercase tracking-[.09em] text-[#94a3b8] px-1.5 mb-1.5">
          Focus Mode
        </p>
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => onModeChange(m.key)}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[13px] font-medium mb-0.5 transition-colors ${
              mode === m.key
                ? "bg-brand text-white"
                : "text-[#475569] hover:bg-[#e2e8f0]"
            }`}
          >
            <span className="text-[13px] w-4 text-center shrink-0">{m.emoji}</span>
            <span>{m.label}</span>
            {m.time && (
              <span className="ml-auto text-[10px] opacity-60">{m.time}</span>
            )}
          </button>
        ))}
      </div>

      <div className="h-px bg-[#e2e8f0] mx-2.5 my-2" />

      {/* Quick actions */}
      <div className="px-2.5 pb-1">
        <p className="text-[10px] font-bold uppercase tracking-[.09em] text-[#94a3b8] px-1.5 mb-1.5">
          Quick Actions
        </p>
        {ACTIONS.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[12.5px] font-medium text-[#475569] hover:bg-[#e2e8f0] transition-colors mb-0.5"
          >
            <span className="w-6 h-6 rounded-md bg-white border border-[#e2e8f0] flex items-center justify-center text-[#475569] shrink-0 shadow-sm">
              {a.icon}
            </span>
            {a.label}
          </button>
        ))}
      </div>

      <div className="h-px bg-[#e2e8f0] mx-2.5 my-2" />

      {/* View selector */}
      <div className="px-2.5 pb-4 mt-auto">
        <p className="text-[10px] font-bold uppercase tracking-[.09em] text-[#94a3b8] px-1.5 mb-1.5">
          View
        </p>
        <div className="relative">
          <select
            onChange={(e) => { window.location.href = e.target.value; }}
            defaultValue="/ops"
            className="w-full appearance-none bg-white border border-[#e2e8f0] rounded-md px-3 py-2 text-[12.5px] text-[#475569] cursor-pointer shadow-sm pr-8"
          >
            {VIEWS.map((v) => (
              <option key={v.href} value={v.href}>{v.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94a3b8] pointer-events-none" />
        </div>
      </div>
    </aside>
  );
}

// ── Mode views ────────────────────────────────────────────────────────────────

function BeforeClass() {
  return (
    <>
      <DateSelector />
      <StatCards />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
          <TodaysPOs />
          <TodaysStaff />
        </div>
        <div className="flex flex-col gap-3">
          <ActiveAlerts />
          <Onboarding />
        </div>
      </div>
    </>
  );
}

function DuringClass() {
  return (
    <>
      <StatCards />
      <AttendanceTile />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
          <ActiveAlerts />
          <TodaysInstructionNotes />
        </div>
        <div className="flex flex-col gap-3">
          <TodaysPOs />
          <Onboarding />
        </div>
      </div>
    </>
  );
}

function CloseOut() {
  return (
    <>
      <StatCards />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
          <TodaysPOs />
          <RecentlyStarted />
        </div>
        <div className="flex flex-col gap-3">
          <ActiveAlerts />
        </div>
      </div>
    </>
  );
}

function Checklists() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChecklistPanel
        title="Opening Checklist"
        icon={<span className="text-base">☀️</span>}
        note="Before Class reference"
        data={OPENING_CHECKLIST}
      />
      <ChecklistPanel
        title="Closing Checklist"
        icon={<span className="text-base">🌙</span>}
        note="Close Out reference — complete in order"
        data={CLOSING_CHECKLIST}
      />
    </div>
  );
}

// ── Mode bar (sticky strip under header) ─────────────────────────────────────

const MODE_META: Record<Mode, { label: string; badge: string; badgeCls: string }> = {
  before:     { label: "Before Class",  badge: "Opening",    badgeCls: "bg-brand-light text-brand-dark" },
  during:     { label: "During Class",  badge: "In Session", badgeCls: "bg-tint-alerts-bg text-tint-alerts-fg" },
  closeout:   { label: "Close Out",     badge: "End of Day", badgeCls: "bg-surface-muted text-ink-secondary" },
  checklists: { label: "Checklists",    badge: "Reference",  badgeCls: "bg-tint-pos-bg text-tint-pos-fg" },
};

function ModeBar({ mode }: { mode: Mode }) {
  const { label, badge, badgeCls } = MODE_META[mode];
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-[#e2e8f0] h-[44px] flex items-center px-5 gap-3 shadow-sm">
      <span className="text-[14px] font-bold text-ink">{label}</span>
      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${badgeCls}`}>
        {badge}
      </span>
    </div>
  );
}

// ── OPS inner app ─────────────────────────────────────────────────────────────

function OpsApp() {
  const [mode, setMode] = useState<Mode>("before");

  useEffect(() => {
    const saved = localStorage.getItem("kumon-ops-mode-v2") as Mode | null;
    if (saved && ["before", "during", "closeout", "checklists"].includes(saved)) {
      setMode(saved);
      return;
    }
    const h = new Date().getHours();
    if (h < 11) setMode("before");
    else if (h < 19) setMode("during");
    else setMode("closeout");
  }, []);

  const handleModeChange = (m: Mode) => {
    setMode(m);
    localStorage.setItem("kumon-ops-mode-v2", m);
  };

  return (
    <div className="h-full flex flex-col">

      {/* ── Branded header ── */}
      <header className="h-[52px] shrink-0 bg-[#1a2744] border-b-[3px] border-brand flex items-center px-5 z-50">
        <h1 className="font-display font-black text-[24px] tracking-wide leading-none text-white">
          KUMON{" "}
          <span className="text-blue-400">OF WAPPINGERS FALLS</span>
        </h1>
        <div className="ml-auto flex items-center gap-4 text-[12px] text-white/50 font-medium">
          <span>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <Clock />
        </div>
      </header>

      {/* ── Body: sidebar + content ── */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar mode={mode} onModeChange={handleModeChange} />

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          <ModeBar mode={mode} />
          <div className="p-5 pb-12">
            {mode === "before"     && <BeforeClass />}
            {mode === "during"     && <DuringClass />}
            {mode === "closeout"   && <CloseOut />}
            {mode === "checklists" && <Checklists />}
          </div>
        </div>
      </div>

    </div>
  );
}

// ── Clock ─────────────────────────────────────────────────────────────────────

function Clock() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  useEffect(() => {
    const fmtTime = () =>
      new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const fmtDate = () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      });
    setTime(fmtTime());
    setDate(fmtDate());
    const t = setInterval(() => setTime(fmtTime()), 15_000);
    return () => clearInterval(t);
  }, []);
  return <><span>{date}</span><span className="tabular-nums">{time}</span></>;
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function OpsPage() {
  return (
    <ViewDateProvider>
      <FormsProvider>
        <OpsApp />
      </FormsProvider>
    </ViewDateProvider>
  );
}
