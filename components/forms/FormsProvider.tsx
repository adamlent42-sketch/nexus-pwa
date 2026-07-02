"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { StaffAlertForm } from "./StaffAlertForm";
import { InstructionNoteForm } from "./InstructionNoteForm";
import { NoteUpdateForm } from "./NoteUpdateForm";
import { NoteEditForm } from "./NoteEditForm";
import { SnoozeDialog } from "./SnoozeDialog";
import { PickupForm } from "./PickupForm";
import { TimeOffForm } from "./TimeOffForm";
import { UpdateEmailForm } from "./UpdateEmailForm";
import { AchievementTestForm } from "./AchievementTestForm";
import { PORecapForm } from "./PORecapForm";
import { RescheduleForm } from "./RescheduleForm";
import { ScheduleForm } from "./ScheduleForm";
import { StudentUpdateForm } from "./StudentUpdateForm";
import { CreatePOForm } from "./CreatePOForm";
import { StudentTimingForm } from "./StudentTimingForm";
import type { PORow, InstructionNoteRow, AlertRow } from "@/types/kumon";

interface PresetStudent { id: string; name: string; grade: string | null; status: string | null }
interface TimingTarget { id: string; name: string }

interface FormsCtx {
  openStaffAlert: () => void;
  openAlertEdit: (alert: AlertRow) => void;
  openInstructionNote: () => void;
  openUpdateEmail: (preset?: PresetStudent | null) => void;
  openAchievementTest: () => void;
  openPickup: () => void;
  openTimeOff: () => void;
  openSchedule: () => void;
  openStudentUpdate: (preset?: PresetStudent | null) => void;
  openCreatePO: () => void;
  openStudentTiming: (target: TimingTarget) => void;
  openPORecap: (po: PORow) => void;
  openReschedule: (po: PORow) => void;
  openNoteUpdate: (note: InstructionNoteRow) => void;
  openNoteEdit: (note: InstructionNoteRow) => void;
  openNoteSnooze: (note: InstructionNoteRow) => void;
}

const Ctx = createContext<FormsCtx | null>(null);

export function useForms() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useForms must be used inside <FormsProvider>");
  return v;
}

export function FormsProvider({ children }: { children: ReactNode }) {
  const [staffAlertOpen, setStaffAlertOpen] = useState(false);
  const [alertEdit, setAlertEdit] = useState<AlertRow | null>(null);
  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [timeOffOpen, setTimeOffOpen] = useState(false);
  const [updateEmailOpen, setUpdateEmailOpen] = useState(false);
  const [updateEmailPreset, setUpdateEmailPreset] = useState<PresetStudent | null>(null);
  const [achievementOpen, setAchievementOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [studentUpdateOpen, setStudentUpdateOpen] = useState(false);
  const [studentUpdatePreset, setStudentUpdatePreset] = useState<PresetStudent | null>(null);
  const [createPOOpen, setCreatePOOpen] = useState(false);
  const [timingTarget, setTimingTarget] = useState<TimingTarget | null>(null);
  const [poRecap, setPoRecap] = useState<PORow | null>(null);
  const [poReschedule, setPoReschedule] = useState<PORow | null>(null);
  const [noteUpdateNote, setNoteUpdateNote] = useState<InstructionNoteRow | null>(null);
  const [noteEditNote, setNoteEditNote] = useState<InstructionNoteRow | null>(null);
  const [noteSnoozeNote, setNoteSnoozeNote] = useState<InstructionNoteRow | null>(null);

  const value: FormsCtx = {
    openStaffAlert: () => setStaffAlertOpen(true),
    openAlertEdit: (alert) => setAlertEdit(alert),
    openInstructionNote: () => setNoteFormOpen(true),
    openUpdateEmail: (preset = null) => { setUpdateEmailPreset(preset ?? null); setUpdateEmailOpen(true); },
    openAchievementTest: () => setAchievementOpen(true),
    openPickup: () => setPickupOpen(true),
    openTimeOff: () => setTimeOffOpen(true),
    openSchedule: () => setScheduleOpen(true),
    openStudentUpdate: (preset = null) => { setStudentUpdatePreset(preset ?? null); setStudentUpdateOpen(true); },
    openCreatePO: () => setCreatePOOpen(true),
    openStudentTiming: (target) => setTimingTarget(target),
    openPORecap: (po) => setPoRecap(po),
    openReschedule: (po) => setPoReschedule(po),
    openNoteUpdate: (note) => setNoteUpdateNote(note),
    openNoteEdit: (note) => setNoteEditNote(note),
    openNoteSnooze: (note) => setNoteSnoozeNote(note)
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <StaffAlertForm open={staffAlertOpen} onClose={() => setStaffAlertOpen(false)} />
      <StaffAlertForm open={!!alertEdit} editing={alertEdit} onClose={() => setAlertEdit(null)} />
      <InstructionNoteForm open={noteFormOpen} onClose={() => setNoteFormOpen(false)} />
      <NoteUpdateForm open={!!noteUpdateNote} onClose={() => setNoteUpdateNote(null)} note={noteUpdateNote} />
      <NoteEditForm open={!!noteEditNote} onClose={() => setNoteEditNote(null)} note={noteEditNote} />
      <SnoozeDialog open={!!noteSnoozeNote} onClose={() => setNoteSnoozeNote(null)} note={noteSnoozeNote} />
      <PickupForm open={pickupOpen} onClose={() => setPickupOpen(false)} />
      <TimeOffForm open={timeOffOpen} onClose={() => setTimeOffOpen(false)} />
      <UpdateEmailForm
        open={updateEmailOpen}
        onClose={() => { setUpdateEmailOpen(false); setUpdateEmailPreset(null); }}
        presetStudent={updateEmailPreset}
      />
      <AchievementTestForm open={achievementOpen} onClose={() => setAchievementOpen(false)} />
      <PORecapForm open={!!poRecap} onClose={() => setPoRecap(null)} po={poRecap} />
      <RescheduleForm open={!!poReschedule} onClose={() => setPoReschedule(null)} po={poReschedule} />
      <ScheduleForm open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
      <StudentUpdateForm
        open={studentUpdateOpen}
        onClose={() => { setStudentUpdateOpen(false); setStudentUpdatePreset(null); }}
        presetStudent={studentUpdatePreset}
      />
      <CreatePOForm open={createPOOpen} onClose={() => setCreatePOOpen(false)} />
      <StudentTimingForm
        open={!!timingTarget}
        onClose={() => setTimingTarget(null)}
        studentId={timingTarget?.id ?? null}
        studentName={timingTarget?.name ?? null}
      />
    </Ctx.Provider>
  );
}
