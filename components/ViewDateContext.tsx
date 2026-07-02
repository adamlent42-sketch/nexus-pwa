"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { todayInET } from "@/lib/time";

interface Ctx {
  viewDate: string;            // YYYY-MM-DD in ET
  setViewDate: (d: string) => void;
  isToday: boolean;
}

const C = createContext<Ctx | null>(null);

export function useViewDate(): Ctx {
  const v = useContext(C);
  // Tolerate uses outside the provider (e.g., admin pages) by falling back
  // to actual today — keeps the components reusable.
  if (!v) {
    const today = todayInET();
    return { viewDate: today, setViewDate: () => {}, isToday: true };
  }
  return v;
}

export function ViewDateProvider({ children }: { children: ReactNode }) {
  const today = todayInET();
  const [viewDate, setViewDate] = useState(today);
  return (
    <C.Provider value={{ viewDate, setViewDate, isToday: viewDate === today }}>
      {children}
    </C.Provider>
  );
}
