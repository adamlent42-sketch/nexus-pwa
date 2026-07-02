"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Plus, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, TextInput } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { FamilySelect, type FamilyOption } from "@/components/ui/FamilySelect";
import { StudentSelect } from "@/components/ui/StudentSelect";
import { useToast } from "@/lib/toast";
import { todayInET } from "@/lib/time";

interface Props { open: boolean; onClose: () => void }

interface ExistingStudent { id: string; name: string; grade: string | null; status: string | null }

interface NewStudentDraft {
  mode: "new";
  firstName: string;
  lastName: string;
  grade: string;
  subjects: string[];
}

interface ExistingStudentDraft {
  mode: "existing";
  student: ExistingStudent | null;
}

type StudentDraft = NewStudentDraft | ExistingStudentDraft;

const BOOKING_SOURCES = ["Online Scheduler", "Kumon CEC", "Instructor", "Re-engagement", "Other"] as const;

function blankNew(): NewStudentDraft {
  return { mode: "new", firstName: "", lastName: "", grade: "", subjects: [] };
}
function blankExisting(): ExistingStudentDraft {
  return { mode: "existing", student: null };
}

export function CreatePOForm({ open, onClose }: Props) {
  // Family mode
  const [familyMode, setFamilyMode] = useState<"existing" | "new">("new");
  const [existingFamily, setExistingFamily] = useState<FamilyOption | null>(null);

  // New family fields
  const [familyName, setFamilyName] = useState("");
  const [motherFirst, setMotherFirst] = useState("");
  const [motherLast, setMotherLast] = useState("");
  const [motherEmail, setMotherEmail] = useState("");
  const [motherPhone, setMotherPhone] = useState("");
  const [fatherFirst, setFatherFirst] = useState("");
  const [fatherLast, setFatherLast] = useState("");
  const [fatherEmail, setFatherEmail] = useState("");
  const [fatherPhone, setFatherPhone] = useState("");

  // Students (supports siblings)
  const [students, setStudents] = useState<StudentDraft[]>([blankNew()]);

  // PO
  const [poDate, setPoDate] = useState(todayInET());
  const [poTime, setPoTime] = useState("");
  const [bookingSource, setBookingSource] = useState<string | null>("Online Scheduler");
  const [subjectInterest, setSubjectInterest] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toast = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) {
      setFamilyMode("new");
      setExistingFamily(null);
      setFamilyName(""); setMotherFirst(""); setMotherLast(""); setMotherEmail(""); setMotherPhone("");
      setFatherFirst(""); setFatherLast(""); setFatherEmail(""); setFatherPhone("");
      setStudents([blankNew()]);
      setPoDate(todayInET()); setPoTime(""); setBookingSource("Online Scheduler");
      setSubjectInterest([]); setError(null);
    }
  }, [open]);

  // Auto-fill family name from parent last name when in "new" mode.
  useEffect(() => {
    if (familyMode === "new" && !familyName) {
      const candidate = motherLast || fatherLast;
      if (candidate) setFamilyName(`${candidate} family`);
    }
  }, [motherLast, fatherLast, familyName, familyMode]);

  // When switching from existing to new family, reset existing pick (and vice versa).
  useEffect(() => {
    if (familyMode === "new") setExistingFamily(null);
  }, [familyMode]);

  const mutation = useMutation({
    mutationFn: async (body: unknown) => {
      const r = await fetch(`/api/pos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await r.json();
      if (!json.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos"] });
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["students-search"] });
      qc.invalidateQueries({ queryKey: ["families-search"] });
    }
  });

  const updateStudent = (idx: number, patch: Partial<StudentDraft>) => {
    setStudents((prev) =>
      prev.map((s, i) => (i === idx ? ({ ...s, ...patch } as StudentDraft) : s))
    );
  };

  const addNewStudent = () => setStudents((prev) => [...prev, blankNew()]);
  const addExistingStudent = () => setStudents((prev) => [...prev, blankExisting()]);
  const removeStudent = (idx: number) => setStudents((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    setError(null);

    // Family validation
    if (familyMode === "existing" && !existingFamily) {
      setError("Pick the existing family"); return;
    }
    if (familyMode === "new") {
      if (!familyName.trim()) { setError("Family name is required"); return; }
      if (!motherEmail.trim() && !fatherEmail.trim() && !motherPhone.trim() && !fatherPhone.trim()) {
        setError("At least one parent email or phone is required"); return;
      }
    }

    // Students validation
    const cleanedStudents = students.filter((s) => {
      if (s.mode === "new") return s.firstName.trim() && s.lastName.trim();
      return !!s.student;
    });
    if (cleanedStudents.length === 0) { setError("At least one student is required"); return; }

    if (!poTime.trim()) { setError("PO time is required"); return; }
    if (!bookingSource) { setError("Pick a booking source"); return; }

    // Build payload
    const payload: Record<string, unknown> = {
      poDate,
      poTime: poTime.trim(),
      bookingSource,
      subjectInterest,
      students: cleanedStudents.map((s) =>
        s.mode === "existing"
          ? { studentId: s.student!.id }
          : {
              newStudent: {
                firstName: s.firstName.trim(),
                lastName: s.lastName.trim(),
                grade: s.grade.trim() || undefined,
                subjects: s.subjects
              }
            }
      )
    };

    if (familyMode === "existing") {
      payload.familyId = existingFamily!.id;
      // Use the parent phone from existing family if available
      const ph = existingFamily!.motherPhone || existingFamily!.fatherPhone || "";
      if (ph) payload.parentPhone = ph;
    } else {
      payload.newFamily = {
        familyName: familyName.trim(),
        motherFirstName: motherFirst.trim() || undefined,
        motherLastName: motherLast.trim() || undefined,
        motherEmail: motherEmail.trim() || undefined,
        motherPhone: motherPhone.trim() || undefined,
        fatherFirstName: fatherFirst.trim() || undefined,
        fatherLastName: fatherLast.trim() || undefined,
        fatherEmail: fatherEmail.trim() || undefined,
        fatherPhone: fatherPhone.trim() || undefined
      };
      const ph = motherPhone.trim() || fatherPhone.trim();
      if (ph) payload.parentPhone = ph;
    }

    try {
      await mutation.mutateAsync(payload);
      const label = cleanedStudents.map((s) =>
        s.mode === "new" ? s.firstName : s.student!.name
      ).join(" + ");
      toast.push(`PO booked for ${label}.`, "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to create PO", "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Book a new PO"
      icon={<CalendarPlus className="w-4 h-4" />}
      tintClassName="bg-tint-pos-bg text-tint-pos-fg"
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? "Creating…" : "Book PO"}
          </button>
        </>
      }
    >
      <div className="bg-tint-pos-bg text-tint-pos-fg rounded p-2.5 mb-4 text-[12px]">
        Creates a Family + Student(s) + PO record in Airtable. Use existing family/student records when the family is already in the system to avoid duplicates.
      </div>

      {/* Family */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-medium text-ink">Family</p>
        <ChipGroup
          value={familyMode}
          onChange={(v) => setFamilyMode((v as "existing" | "new") ?? "new")}
          options={["existing", "new"]}
        />
      </div>

      {familyMode === "existing" ? (
        <>
          <Field label="Pick existing family" required>
            <FamilySelect value={existingFamily} onChange={setExistingFamily} autoFocus />
          </Field>
          {existingFamily && existingFamily.students.length > 0 && (
            <div className="bg-surface-subtle rounded p-2.5 mb-4 text-[12px] text-ink-secondary">
              <span className="font-medium text-ink">Kids on file:</span> {existingFamily.students.map((s) => s.name).join(", ")}
            </div>
          )}
        </>
      ) : (
        <>
          <Field label="Family name" required hint="auto-fills from parent last name">
            <TextInput value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="e.g. Patel family" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
            <div className="space-y-2">
              <Field label="Mother first name"><TextInput value={motherFirst} onChange={(e) => setMotherFirst(e.target.value)} /></Field>
              <Field label="Mother last name"><TextInput value={motherLast} onChange={(e) => setMotherLast(e.target.value)} /></Field>
              <Field label="Mother email"><TextInput type="email" value={motherEmail} onChange={(e) => setMotherEmail(e.target.value)} /></Field>
              <Field label="Mother phone"><TextInput type="tel" value={motherPhone} onChange={(e) => setMotherPhone(e.target.value)} /></Field>
            </div>
            <div className="space-y-2">
              <Field label="Father first name"><TextInput value={fatherFirst} onChange={(e) => setFatherFirst(e.target.value)} /></Field>
              <Field label="Father last name"><TextInput value={fatherLast} onChange={(e) => setFatherLast(e.target.value)} /></Field>
              <Field label="Father email"><TextInput type="email" value={fatherEmail} onChange={(e) => setFatherEmail(e.target.value)} /></Field>
              <Field label="Father phone"><TextInput type="tel" value={fatherPhone} onChange={(e) => setFatherPhone(e.target.value)} /></Field>
            </div>
          </div>
        </>
      )}

      {/* Students */}
      <div className="flex items-center justify-between mb-2 mt-4">
        <p className="text-[13px] font-medium text-ink">Student(s)</p>
        <div className="flex gap-1.5">
          <button onClick={addExistingStudent} className="btn text-[12px]" title="Pick a student already in the system">
            <Plus className="w-3.5 h-3.5" /> Existing
          </button>
          <button onClick={addNewStudent} className="btn text-[12px]" title="Create a new student record">
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>
      </div>
      {students.map((s, idx) => (
        <div key={idx} className="bg-surface-subtle rounded p-3 mb-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-medium text-ink-secondary">
              {s.mode === "existing" ? "Existing student" : "New student"} — #{idx + 1}
            </p>
            {students.length > 1 && (
              <button onClick={() => removeStudent(idx)} className="text-ink-tertiary hover:text-status-danger-fg" aria-label="Remove student">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {s.mode === "existing" ? (
            <Field label="Pick student" required>
              <StudentSelect
                value={s.student}
                onChange={(student) => updateStudent(idx, { student })}
              />
            </Field>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Field label="First name" required>
                  <TextInput value={s.firstName} onChange={(e) => updateStudent(idx, { firstName: e.target.value })} />
                </Field>
                <Field label="Last name" required>
                  <TextInput value={s.lastName} onChange={(e) => updateStudent(idx, { lastName: e.target.value })} />
                </Field>
                <Field label="Grade" hint="e.g. K, 1, 5">
                  <TextInput value={s.grade} onChange={(e) => updateStudent(idx, { grade: e.target.value })} />
                </Field>
              </div>
              <Field label="Subject interest">
                <ChipGroup multi value={s.subjects} onChange={(v) => updateStudent(idx, { subjects: v })} options={["Math", "Reading"]} />
              </Field>
            </>
          )}
        </div>
      ))}

      {/* PO */}
      <p className="text-[13px] font-medium text-ink mb-2 mt-4">PO details</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="PO date" required>
          <TextInput type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} />
        </Field>
        <Field label="PO time" required hint="e.g. 4:30 PM">
          <TextInput value={poTime} onChange={(e) => setPoTime(e.target.value)} placeholder="4:30 PM" />
        </Field>
      </div>
      <Field label="Booking source" required>
        <ChipGroup value={bookingSource} onChange={setBookingSource} options={BOOKING_SOURCES} />
      </Field>
      <Field label="Overall subject interest" hint="rolls up across siblings">
        <ChipGroup multi value={subjectInterest} onChange={setSubjectInterest} options={["Math", "Reading"]} />
      </Field>

      {error && <p className="text-[12px] text-status-danger-fg mt-1 mb-2">{error}</p>}
      <p className="text-[11px] text-ink-tertiary mt-2">
        Creates the PO and links to the Family + Student(s) you picked. New students are created with Lifecycle = "PO Booked".
      </p>
    </Modal>
  );
}
