// KIS (Kumon International Standard = "on grade level") targets, transcribed from
// the WIG appendix KIS/ASHR benchmark chart (Reference Library/WIG). One unified
// chart serves both subjects; we map each target onto the Math or Reading ladder.
//
// Used only to draw the (toggle-able) grade-level reference line on the /po
// projection chart. Codes are level + worksheet (e.g. "AI100" = Level A, set I,
// worksheet 100). Periods are the four KNA reporting points across the school year.

import { MATH, READING, type Subject } from "./curriculum";

type Period = "nov" | "feb" | "may" | "aug";

const KIS: Record<string, Record<Period, string>> = {
  PK3: { nov: "5A50", feb: "5A100", may: "5A150", aug: "5A200" },
  PK2: { nov: "4A50", feb: "4A100", may: "4A150", aug: "4A200" },
  PK1: { nov: "3A50", feb: "3A100", may: "3A150", aug: "3A200" },
  K:   { nov: "2A50", feb: "2A100", may: "2A150", aug: "2A200" },
  "1": { nov: "AI100", feb: "AI200", may: "AII100", aug: "AII200" },
  "2": { nov: "BI100", feb: "BI200", may: "BII100", aug: "BII200" },
  "3": { nov: "CI100", feb: "CI200", may: "CII100", aug: "CII200" },
  "4": { nov: "DI100", feb: "DI200", may: "DII100", aug: "DII200" },
  "5": { nov: "EI100", feb: "EI200", may: "EII100", aug: "EII200" },
  "6": { nov: "FI100", feb: "FI200", may: "FII100", aug: "FII200" },
  "7": { nov: "GI100", feb: "GI200", may: "GII100", aug: "GII200" },
  "8": { nov: "HI100", feb: "HI200", may: "HII100", aug: "HII200" },
  "9": { nov: "II100", feb: "II200", may: "III100", aug: "III200" },
  "10": { nov: "J50", feb: "J100", may: "J150", aug: "J200" },
  "11": { nov: "K50", feb: "K100", may: "K150", aug: "K200" },
  "12": { nov: "L50", feb: "L100", may: "L150", aug: "L200" }
};

// Normalize free-text grade input ("2", "K", "Kindergarten", "Pre-K 1") to a KIS key.
function normGrade(s: string): string | null {
  if (!s) return null;
  const t = s.toString().trim().toLowerCase();
  if (/pre|pk/.test(t)) { const d = t.match(/\d/); return "PK" + (d ? d[0] : "1"); }
  if (/^k|kinder|kg/.test(t)) return "K";
  const m = t.match(/1[0-2]|[1-9]/);
  return m ? m[0] : null;
}

// Parse "AI100" / "AII200" / "5A50" / "J50" → { level, half(0|1|2), ws }.
function parseKis(code: string): { level: string; half: number; ws: number } | null {
  const m = code.match(/^(\d?A|[A-O])(I{1,2})?(\d+)$/);
  if (!m) return null;
  return { level: m[1], half: m[2] ? m[2].length : 0, ws: parseInt(m[3], 10) };
}

// The level (ladder index) that represents on-grade-level for a grade. KIS aligns one
// Kumon level to each school grade (K ≈ 2A, grade 1 ≈ A, grade 2 ≈ B, ...), so we anchor
// the grade-level line to that level on the subject's ladder.
function gradeLevelIndex(subject: Subject, code: string): number | null {
  const p = parseKis(code);
  if (!p) return null;
  if (subject === "reading") {
    const lc = p.half > 0 ? p.level + (p.half === 1 ? "I" : "II") : p.level;
    const i = READING.findIndex((l) => l.code === lc);
    return i < 0 ? null : i;
  }
  const i = MATH.findIndex((l) => l.code === p.level);
  return i < 0 ? null : i;
}

// Ladder position of on-grade-level for a grade (e.g. Kindergarten → Level 2A). Returns
// null if the grade can't be resolved (e.g. a walk-in with no grade entered).
export function kisPosition(subject: Subject, grade: string): number | null {
  const key = normGrade(grade);
  if (!key || !KIS[key]) return null;
  return gradeLevelIndex(subject, KIS[key].nov);
}
