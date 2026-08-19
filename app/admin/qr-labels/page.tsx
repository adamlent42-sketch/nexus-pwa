"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer, Search } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { TextInput } from "@/components/ui/Field";

interface Student {
  id: string;
  student: string;
  firstName: string | null;
  subjects: string[];
  schedule: string[];
  workPickupDay: string | null;
  lifecycle: string | null;
}

// -- QR Image ----------------------------------------------------------------

function QrImage({ studentId, size = 120 }: { studentId: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/admin/qr?id=${encodeURIComponent(studentId)}&format=svg`}
      alt={`QR code for ${studentId}`}
      width={size}
      height={size}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

// -- Download helper ---------------------------------------------------------

async function downloadQrPng(studentId: string, studentName: string) {
  const res = await fetch(`/api/admin/qr?id=${encodeURIComponent(studentId)}&format=png`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `qr-${studentName.replace(/\s+/g, "-")}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

// -- Page --------------------------------------------------------------------

export default function QrLabelsPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showPrint, setShowPrint] = useState(false);

  const q = useQuery({
    queryKey: ["admin", "students-for-qr"],
    queryFn: () => adminFetch<Student[]>("/api/admin/students?lifecycle=active"),
    staleTime: 5 * 60_000
  });

  const students = q.data ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const lc = search.toLowerCase();
    return students.filter((s) =>
      s.student.toLowerCase().includes(lc)
    );
  }, [students, search]);

  const allSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  function toggleAll() {
    if (allSelected) {
      const next = new Set(selected);
      filtered.forEach((s) => next.delete(s.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((s) => next.add(s.id));
      setSelected(next);
    }
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  const selectedStudents = students.filter((s) => selected.has(s.id));

  if (showPrint) {
    return <PrintSheet students={selectedStudents} onBack={() => setShowPrint(false)} />;
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <p className="text-[13px] text-ink-secondary">
        QR codes encode each student&apos;s Airtable record ID. Scan with a USB barcode scanner at the check-in kiosk.
        Download individual PNGs to paste into your Dymo template, or select students and print a label sheet.
      </p>

      {/* Search + bulk actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-ink-tertiary shrink-0" />
          <TextInput
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
        </div>
        <button className="btn" onClick={toggleAll}>
          {allSelected ? "Deselect all" : "Select all"}
        </button>
        {selected.size > 0 && (
          <button
            className="btn btn-primary flex items-center gap-2"
            onClick={() => setShowPrint(true)}
          >
            <Printer className="w-4 h-4" />
            Print {selected.size} label{selected.size !== 1 ? "s" : ""}
          </button>
        )}
      </div>

      {q.isPending ? (
        <Skeleton rows={8} />
      ) : q.isError ? (
        <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      ) : filtered.length === 0 ? (
        <p className="text-ink-secondary text-[14px]">No students match your search.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div
              key={s.id}
              className={`card card-body flex items-center gap-4 cursor-pointer transition-colors ${selected.has(s.id) ? "ring-2 ring-brand" : ""}`}
              onClick={() => toggle(s.id)}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selected.has(s.id)}
                onChange={() => toggle(s.id)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 accent-brand shrink-0"
              />

              {/* QR preview */}
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <QrImage studentId={s.id} size={80} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium">{s.student}</p>
                <p className="meta mt-0.5">
                  {s.subjects.join(" + ")}
                  {s.schedule.length > 0 && ` · ${s.schedule.map((d) => d.slice(0, 3)).join("/")} `}
                  {s.workPickupDay && ` · Pickup: ${s.workPickupDay}`}
                </p>
                <p className="meta-sm text-ink-tertiary mt-0.5 font-mono">{s.id}</p>
              </div>

              {/* Download PNG */}
              <button
                className="btn shrink-0 flex items-center gap-1.5"
                title="Download PNG for Dymo template"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadQrPng(s.id, s.student);
                }}
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">PNG</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -- Print Sheet -------------------------------------------------------------
// Renders a printable grid of 2"x2" label cards (4-per-row).

function PrintSheet({ students, onBack }: { students: Student[]; onBack: () => void }) {
  return (
    <div>
      {/* Print controls -- hidden when printing */}
      <div className="print:hidden flex items-center gap-3 mb-6">
        <button className="btn" onClick={onBack}>Back</button>
        <button className="btn btn-primary flex items-center gap-2" onClick={() => window.print()}>
          <Printer className="w-4 h-4" />
          Print
        </button>
        <p className="text-[13px] text-ink-secondary">
          Tip: In print dialog, set margins to None for clean label edges.
        </p>
      </div>

      {/* Label grid */}
      <div className="grid gap-0" style={{ gridTemplateColumns: "repeat(4, 192px)" }}>
        {students.map((s) => (
          <div
            key={s.id}
            className="flex flex-col items-center p-2"
            style={{ width: 192, height: 192, boxSizing: "border-box", border: "0.5pt dashed #ccc" }}
          >
            <QrImage studentId={s.id} size={120} />
            <div style={{ fontSize: 11, fontWeight: 700, textAlign: "center", marginTop: 4, lineHeight: 1.2 }}>
              {s.student}
            </div>
            <div style={{ fontSize: 9, color: "#666", textAlign: "center", marginTop: 2 }}>
              {s.subjects.join(" + ")}
              {s.schedule.length > 0 && ` · ${s.schedule.map((d: string) => d.slice(0, 3)).join("/")} `}
            </div>
            {s.workPickupDay && (
              <div style={{ fontSize: 8, color: "#888", textAlign: "center", marginTop: 1 }}>
                Pickup: {s.workPickupDay}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          .grid, .grid * { visibility: visible; }
          .grid { position: fixed; top: 0; left: 0; }
        }
      `}</style>
    </div>
  );
}
