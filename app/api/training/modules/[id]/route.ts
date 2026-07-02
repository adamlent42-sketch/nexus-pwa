import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";

export const dynamic = "force-dynamic";

// GET /api/training/modules/[id] — the module + its ordered blocks, for the player.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const m = await airtable()(TABLE.TrainingModules).find(params.id);
    const allBlocks = await airtable()(TABLE.TrainingBlocks)
      .select({ fields: ["Block", "Module", "Order", "Content", "Question Type", "Question", "Options", "Correct Answer", "Rationale", "Tips", "Image", "Exercise", "Exercise Data"] })
      .all();

    const blocks = allBlocks
      .filter((b) => ((b.get("Module") as string[] | undefined) ?? []).includes(params.id))
      .map((b) => ({
        id: b.id,
        title: (b.get("Block") as string | null) ?? "",
        order: (b.get("Order") as number | null) ?? 999,
        content: (b.get("Content") as string | null) ?? "",
        questionType: (b.get("Question Type") as string | null) ?? "Multiple Choice",
        question: (b.get("Question") as string | null) ?? "",
        options: ((b.get("Options") as string | null) ?? "").split("\n").map((o) => o.trim()).filter(Boolean),
        correct: (b.get("Correct Answer") as string | null) ?? "",
        rationale: (b.get("Rationale") as string | null) ?? "",
        tips: (b.get("Tips") as string | null) ?? "",
        imageUrl: (((b.get("Image") as { url?: string }[] | undefined) ?? [])[0]?.url) ?? null,
        exercise: (b.get("Exercise") as string | null) ?? "",
        exerciseData: (b.get("Exercise Data") as string | null) ?? ""
      }))
      .sort((a, b) => a.order - b.order);

    return NextResponse.json({
      ok: true,
      data: {
        id: m.id,
        module: (m.get("Module") as string | null) ?? "(module)",
        passThreshold: (m.get("Pass Threshold") as number | null) ?? 0,
        blocks
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
