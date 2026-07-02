import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";

export const dynamic = "force-dynamic";

// GET /api/students/[id]/email-context
// Returns the context the Update Email form auto-prefills based on the
// student's lifecycle. Different lifecycles need different prefill data:
//   - Did Not Enroll: most recent PO Staff Notes + recommended levels
//   - Discontinued / Long Lapsed / etc: current math/reading levels + last
//     3 Progress Events (achievement tests, etc.)
// The form decides which fields to use based on lifecycle; the API just
// returns everything it can find.

interface EmailContext {
  studentName: string | null;
  grade: string | null;
  lifecycle: string | null;
  mathLevel: string | null;
  readingLevel: string | null;
  lastPo: {
    id: string;
    date: string | null;
    outcome: string | null;
    staffNotes: string | null;
    recommendedMath: string | null;
    recommendedReading: string | null;
  } | null;
  recentAchievements: {
    id: string;
    title: string | null;
    date: string | null;
    eventType: string | null;
    subject: string | null;
    level: string | null;
  }[];
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const student = await airtable()(TABLE.Students).find(params.id);
    const linkedPOIds = ((student.get("POs") as string[] | undefined) ?? []) as string[];

    // Find the most recent PO Staff Notes — we want the PO they actually
    // attended (Outcome filled), preferring "Plan to Enroll" / "Undecided" /
    // "Not Interested" over an unattended scheduled PO.
    let lastPo: EmailContext["lastPo"] = null;
    if (linkedPOIds.length > 0) {
      const poRecs = await Promise.all(
        linkedPOIds.map((id) => airtable()(TABLE.POs).find(id).catch(() => null))
      );
      const valid = poRecs.filter(Boolean) as NonNullable<(typeof poRecs)[number]>[];
      valid.sort((a, b) => {
        const ad = (a.get("PO Date") as string | null) ?? "";
        const bd = (b.get("PO Date") as string | null) ?? "";
        return bd.localeCompare(ad);
      });
      const latest = valid[0];
      if (latest) {
        lastPo = {
          id: latest.id,
          date: (latest.get("PO Date") as string | null) ?? null,
          outcome: (latest.get("Outcome") as string | null) ?? null,
          staffNotes: (latest.get("Staff Notes ") as string | null) ?? (latest.get("Staff Notes") as string | null) ?? null,
          recommendedMath: (latest.get("Recommended Math Starting Level") as string | null) ?? null,
          recommendedReading: (latest.get("Recommended Reading Starting Level") as string | null) ?? null
        };
      }
    }

    // Recent achievements — most recent 3 Progress Events for this student.
    const progressRecs = await airtable()(TABLE.ProgressEvents)
      .select({
        filterByFormula: `FIND('${params.id}', ARRAYJOIN({Student}))`,
        sort: [{ field: "Date", direction: "desc" }],
        maxRecords: 6,
        fields: ["Event Title", "Date", "Event Type", "Subject", "Level"]
      })
      .all()
      .catch(() => []);

    const recentAchievements = progressRecs.slice(0, 3).map((r) => ({
      id: r.id,
      title: (r.get("Event Title") as string | null) ?? null,
      date: (r.get("Date") as string | null) ?? null,
      eventType: (r.get("Event Type") as string | null) ?? null,
      subject: (r.get("Subject") as string | null) ?? null,
      level: (r.get("Level") as string | null) ?? null
    }));

    const out: EmailContext = {
      studentName: (student.get("Student Name") as string | null) ?? null,
      grade: (student.get("Grade") as string | null) ?? null,
      lifecycle: (student.get("Lifecycle Stage") as string | null) ?? null,
      mathLevel: (student.get("Math Level") as string | null) ?? null,
      readingLevel: (student.get("Reading Level") as string | null) ?? null,
      lastPo,
      recentAchievements
    };

    return NextResponse.json({ ok: true, data: out });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
