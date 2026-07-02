"use client";

import { Bell, NotebookPen, Mail, Trophy, Car, CalendarOff, UserCog, CalendarPlus, Phone } from "lucide-react";
import { useForms } from "@/components/forms/FormsProvider";

interface Action {
  key: string;
  label: string;
  icon: React.ReactNode;
  iconColor: string;
  onClick: () => void;
}

export function ActionRow() {
  const forms = useForms();
  const ACTIONS: Action[] = [
    { key: "alert",       label: "Staff alert",      icon: <Bell className="w-[18px] h-[18px]" />,         iconColor: "text-tint-alerts-sub", onClick: forms.openStaffAlert },
    { key: "note",        label: "Instruction note", icon: <NotebookPen className="w-[18px] h-[18px]" />,  iconColor: "text-brand",           onClick: () => forms.openInstructionNote() },
    { key: "email",       label: "Update email",     icon: <Mail className="w-[18px] h-[18px]" />,         iconColor: "text-brand",           onClick: () => forms.openUpdateEmail() },
    { key: "achievement", label: "Achievement",      icon: <Trophy className="w-[18px] h-[18px]" />,       iconColor: "text-tint-pos-sub",    onClick: () => forms.openAchievementTest() },
    { key: "pickup",      label: "Pickup notice",    icon: <Car className="w-[18px] h-[18px]" />,          iconColor: "text-tint-purple-sub", onClick: forms.openPickup },
    { key: "po",          label: "Book PO",          icon: <CalendarPlus className="w-[18px] h-[18px]" />, iconColor: "text-tint-pos-sub",    onClick: forms.openCreatePO },
    { key: "student",     label: "Update student",   icon: <UserCog className="w-[18px] h-[18px]" />,      iconColor: "text-tint-notes-sub",  onClick: () => forms.openStudentUpdate() },
    { key: "timeoff",     label: "Time off",         icon: <CalendarOff className="w-[18px] h-[18px]" />,  iconColor: "text-ink-secondary",   onClick: forms.openTimeOff },
    { key: "logconv",     label: "Log conversation", icon: <Phone className="w-[18px] h-[18px]" />,         iconColor: "text-tint-notes-sub",  onClick: forms.openLogConversation }
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-9 gap-2 mb-4">
      {ACTIONS.map((a) => (
        <button
          key={a.key}
          onClick={a.onClick}
          className="flex flex-col sm:flex-row items-center justify-center gap-2 py-3 px-3 text-[13px] rounded border border-line bg-surface hover:bg-surface-muted transition-colors"
        >
          <span className={a.iconColor}>{a.icon}</span>
          <span className="text-center">{a.label}</span>
        </button>
      ))}
    </div>
  );
}
