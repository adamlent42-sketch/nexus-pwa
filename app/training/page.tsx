"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { GraduationCap, Check, X, ArrowRight, ArrowLeft, CheckCircle2, RotateCcw, Lightbulb } from "lucide-react";
import { Exercise } from "@/components/training/Exercises";

interface StaffOption { id: string; name: string }
interface ModuleRow {
  id: string; module: string; track: string | null; description: string; estMinutes: number | null;
  passThreshold: number; gradeable: number; status: string; score: number | null; total: number | null;
}
interface Block {
  id: string; title: string; content: string; questionType: string; question: string;
  options: string[]; correct: string; rationale: string; tips: string; imageUrl: string | null;
  exercise: string; exerciseData: string;
}

const STATUS_TONE: Record<string, string> = {
  Complete: "bg-status-success-bg text-status-success-fg",
  Incomplete: "bg-status-warn-bg text-status-warn-fg",
  "In Progress": "bg-status-info-bg text-status-info-fg",
  "Not started": "bg-surface-subtle text-ink-secondary"
};

export default function TrainingKiosk() {
  const [staff, setStaff] = useState<StaffOption | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-9 h-9 rounded bg-brand-deep text-white flex items-center justify-center font-display font-bold">K</div>
        <div>
          <p className="text-[17px] font-medium leading-tight flex items-center gap-1.5"><GraduationCap className="w-4 h-4 text-brand" /> Staff Training</p>
          <p className="text-[12px] text-ink-secondary">Kumon Wappingers Falls</p>
        </div>
        {staff && !activeModuleId && (
          <button onClick={() => setStaff(null)} className="btn ml-auto text-[12px]">Not {staff.name.split(" ")[0]}?</button>
        )}
      </div>

      {!staff ? (
        <StaffPicker onPick={setStaff} />
      ) : activeModuleId ? (
        <Player staff={staff} moduleId={activeModuleId} onExit={() => setActiveModuleId(null)} />
      ) : (
        <ModuleList staff={staff} onOpen={setActiveModuleId} />
      )}
    </div>
  );
}

function StaffPicker({ onPick }: { onPick: (s: StaffOption) => void }) {
  const q = useQuery({
    queryKey: ["staff", "list"],
    queryFn: async () => {
      const r = await fetch("/api/staff/list");
      const b = await r.json();
      if (!b.ok) throw new Error(b.error);
      return b.data as StaffOption[];
    }
  });
  return (
    <div className="card card-body max-w-2xl">
      <p className="text-[15px] font-medium mb-1">Who's training?</p>
      <p className="text-[13px] text-ink-secondary mb-3">Pick your name to see your modules.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {q.data?.map((s) => (
          <button key={s.id} onClick={() => onPick(s)} className="btn justify-start text-left">{s.name}</button>
        ))}
        {q.isPending && <p className="text-[12px] text-ink-tertiary">Loading…</p>}
      </div>
    </div>
  );
}

function ModuleList({ staff, onOpen }: { staff: StaffOption; onOpen: (id: string) => void }) {
  const q = useQuery({
    queryKey: ["training", "modules", staff.id],
    queryFn: async () => {
      const r = await fetch(`/api/training/modules?staffId=${staff.id}`);
      const b = await r.json();
      if (!b.ok) throw new Error(b.error);
      return b.data as ModuleRow[];
    }
  });
  return (
    <div className="max-w-2xl">
      <p className="text-[15px] font-medium mb-1">Hi {staff.name.split(" ")[0]} 👋</p>
      <p className="text-[13px] text-ink-secondary mb-4">Work through a module during downtime — read each card and answer to move on.</p>
      {q.isPending && <p className="text-[12px] text-ink-tertiary">Loading…</p>}
      <div className="space-y-2">
        {q.data?.map((m) => {
          const cta = m.status === "Complete" ? "Review" : m.status === "Incomplete" || m.status === "In Progress" ? "Redo" : "Start";
          return (
            <div key={m.id} className="card card-body">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium leading-tight">{m.module}</p>
                  <p className="text-[12px] text-ink-secondary mt-0.5">{m.description}</p>
                  <p className="text-[11px] text-ink-tertiary mt-1">
                    {m.gradeable} questions{m.estMinutes ? ` · ~${m.estMinutes} min` : ""}{m.status !== "Not started" && m.total ? ` · last score ${m.score}/${m.total}` : ""}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  <span className={`badge ${STATUS_TONE[m.status] ?? "bg-surface-subtle text-ink-secondary"}`}>{m.status}</span>
                  <button onClick={() => onOpen(m.id)} className="btn btn-primary text-[12px]">{cta}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Player({ staff, moduleId, onExit }: { staff: StaffOption; moduleId: string; onExit: () => void }) {
  const q = useQuery({
    queryKey: ["training", "module", moduleId],
    queryFn: async () => {
      const r = await fetch(`/api/training/modules/${moduleId}`);
      const b = await r.json();
      if (!b.ok) throw new Error(b.error);
      return b.data as { id: string; module: string; passThreshold: number; blocks: Block[] };
    }
  });

  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [reflection, setReflection] = useState("");
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [phase, setPhase] = useState<"blocks" | "wrapup" | "done">("blocks");
  const [agreed, setAgreed] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [result, setResult] = useState<{ status: string; score: number; total: number } | null>(null);

  const save = useMutation({
    mutationFn: async (payload: { status: string; score: number; total: number; answers: string; agreed: boolean; feedback: string }) => {
      const r = await fetch("/api/training/progress", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: staff.id, staffName: staff.name, moduleId, moduleName: q.data?.module, ...payload })
      });
      const b = await r.json();
      if (!b.ok) throw new Error(b.error);
      return b.data;
    }
  });

  // Resume state for this staff + module.
  const resume = useQuery({
    queryKey: ["training", "progress", staff.id, moduleId],
    queryFn: async () => {
      const r = await fetch(`/api/training/progress?staffId=${staff.id}&moduleId=${moduleId}`);
      const b = await r.json();
      if (!b.ok) throw new Error(b.error);
      return b.data as null | { status: string; currentBlock: number; score: number; total: number; answers: string };
    }
  });
  const initRef = useRef(false);
  const [reviewing, setReviewing] = useState(false);
  useEffect(() => {
    if (initRef.current || !q.data || resume.isPending) return;
    initRef.current = true;
    const r = resume.data;
    if (r && r.status === "Complete") { setReviewing(true); return; } // review pass — don't downgrade
    if (r && r.status === "In Progress" && r.currentBlock > 0 && r.currentBlock < q.data.blocks.length) {
      setI(r.currentBlock);
      setScore(r.score ?? 0);
      setAnswers(r.answers ? r.answers.split("\n") : []);
    }
  }, [q.data, resume.isPending, resume.data]);

  if (q.isPending || resume.isPending) return <p className="text-[12px] text-ink-tertiary">Loading…</p>;
  if (q.isError || !q.data) return <p className="text-[13px] text-status-danger-fg">Couldn't load this module.</p>;

  const blocks = q.data.blocks;
  const total = blocks.filter((b) => b.questionType !== "Reflection").length;
  const block = blocks[i];
  const isReflection = block.questionType === "Reflection";
  const isInteractive = block.questionType === "Interactive";
  const isLast = i === blocks.length - 1;

  // ---- DONE ----
  if (phase === "done" && result) {
    const passed = result.status === "Complete";
    return (
      <div className="card card-body text-center max-w-xl mx-auto">
        {passed ? <CheckCircle2 className="w-10 h-10 text-status-success-fg mx-auto" /> : <RotateCcw className="w-10 h-10 text-status-warn-fg mx-auto" />}
        <p className="text-[17px] font-medium mt-2">{passed ? "Module complete! 🎉" : "Almost there"}</p>
        <p className="text-[13px] text-ink-secondary mt-1">
          You got <span className="font-medium text-ink">{result.score} of {result.total}</span>.
          {passed ? " Nice work — this one's marked done." : " Give it another run when you have a minute — it'll count once you pass."}
        </p>
        <button onClick={onExit} className="btn btn-primary mt-4 mx-auto"><ArrowLeft className="w-3.5 h-3.5" /> Back to modules</button>
      </div>
    );
  }

  // ---- WRAP UP (agreement + feedback) ----
  if (phase === "wrapup") {
    const finalize = () => {
      const status = score >= q.data!.passThreshold ? "Complete" : "Incomplete";
      const finalAnswers = answers.join("\n");
      save.mutate({ status, score, total, answers: finalAnswers, agreed: true, feedback: feedback.trim() });
      setResult({ status, score, total });
      setPhase("done");
    };
    return (
      <div className="card card-body max-w-xl mx-auto">
        <p className="text-[16px] font-medium mb-1">Wrap up</p>
        <p className="text-[13px] text-ink-secondary mb-4">You answered <span className="font-medium text-ink">{score} of {total}</span> correctly.</p>

        <label className="flex items-start gap-2.5 cursor-pointer mb-4">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
          <span className="text-[13px]">I confirm I completed this training, understand it, and agree to follow it in the center.</span>
        </label>

        <div className="mb-4">
          <p className="text-[13px] font-medium mb-1">Feedback or questions <span className="text-ink-tertiary font-normal">(optional)</span></p>
          <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3}
            className="w-full border border-line rounded-md px-3 py-2 text-[14px] bg-surface" placeholder="Anything confusing? A question for Adam? Tell us here." />
        </div>

        <div className="flex justify-between">
          <button onClick={() => { setPhase("blocks"); }} className="btn"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
          <button onClick={finalize} disabled={!agreed || save.isPending} className="btn btn-primary">
            {save.isPending ? "Saving…" : "Submit & finish"}
          </button>
        </div>
      </div>
    );
  }

  // ---- BLOCKS ----
  const choose = (opt: string) => {
    if (revealed) return;
    setPicked(opt);
    setRevealed(true);
    if (opt === block.correct) setScore((s) => s + 1);
    setAnswers((a) => [...a, `${block.title}: ${opt}`]);
  };

  // Interactive exercises report completion; they gate "Next" like a revealed question.
  const onExerciseDone = (passed: boolean) => {
    if (revealed) return;
    setRevealed(true);
    if (passed) setScore((s) => s + 1);
    setAnswers((a) => [...a, `${block.title}: ${passed ? "completed" : "revealed"}`]);
  };

  const savePartial = (blockIdx: number) => {
    if (reviewing) return; // reviewing a completed module — don't downgrade status
    fetch("/api/training/progress", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staffId: staff.id, staffName: staff.name, moduleId, moduleName: q.data!.module,
        status: "In Progress", currentBlock: blockIdx, score, total, answers: answers.join("\n")
      })
    }).catch(() => {});
  };

  const exit = () => { savePartial(revealed && !isReflection ? i + 1 : i); onExit(); };

  const next = () => {
    if (isReflection) setAnswers((a) => [...a, `${block.title}: ${reflection.trim()}`]);
    if (isLast) { setPhase("wrapup"); return; }
    savePartial(i + 1);
    setI((n) => n + 1);
    setPicked(null);
    setRevealed(false);
  };

  // Rotate the tip placement screen-to-screen so it stays noticeable: 0 = right panel, 1 = mid banner, 2 = bottom banner.
  const tipSpot = block.tips ? i % 3 : -1;
  const tipBanner = (
    <div className="rounded-lg bg-tint-pos-bg border border-status-success-fg/20 px-4 py-3 my-4 flex gap-2.5">
      <Lightbulb className="w-5 h-5 text-status-success-fg shrink-0 mt-0.5" />
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-tint-pos-fg mb-0.5">Tip</p>
        <p className="text-[15px] font-medium leading-relaxed whitespace-pre-line text-ink">{block.tips}</p>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2 text-[12px] text-ink-secondary">
        <button onClick={exit} className="inline-flex items-center gap-1 hover:text-ink"><ArrowLeft className="w-3.5 h-3.5" /> Exit</button>
        <span>Block {i + 1} of {blocks.length}</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-subtle overflow-hidden mb-4">
        <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${((i + 1) / blocks.length) * 100}%` }} />
      </div>

      <div className={tipSpot === 0 ? "flex flex-col lg:flex-row gap-4 items-start" : ""}>
        <div className="card card-body flex-1 w-full">
          <p className="text-[15px] font-medium mb-2">{block.title}</p>
          <p className="text-[15px] leading-relaxed whitespace-pre-line mb-4">{block.content}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {block.imageUrl && !isInteractive && <img src={block.imageUrl} alt="" className="rounded-md border border-line max-w-full mb-4" />}
          {tipSpot === 1 && tipBanner}

          {isReflection ? (
            <>
              <p className="text-[14px] font-medium mb-1">{block.question}</p>
              <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} rows={3}
                className="w-full border border-line rounded-md px-3 py-2 text-[15px] bg-surface" placeholder="Your answer…" />
            </>
          ) : isInteractive ? (
            <Exercise kind={block.exercise} data={block.exerciseData} imageUrl={block.imageUrl} onDone={onExerciseDone} />
          ) : (
            <>
              <p className="text-[14px] font-medium mb-2">{block.question}</p>
              <div className="space-y-2">
                {block.options.map((opt) => {
                  const isCorrect = opt === block.correct;
                  const isPicked = opt === picked;
                  let cls = "border-line bg-surface hover:border-brand";
                  if (revealed && isCorrect) cls = "border-status-success-fg bg-status-success-bg";
                  else if (revealed && isPicked && !isCorrect) cls = "border-status-danger-fg bg-status-danger-bg";
                  return (
                    <button key={opt} onClick={() => choose(opt)} disabled={revealed}
                      className={`w-full text-left text-[15px] px-3 py-2.5 rounded-md border flex items-center gap-2 transition-colors ${cls}`}>
                      <span className="flex-1">{opt}</span>
                      {revealed && isCorrect && <Check className="w-4 h-4 text-status-success-fg shrink-0" />}
                      {revealed && isPicked && !isCorrect && <X className="w-4 h-4 text-status-danger-fg shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {revealed && block.rationale && (
                <p className="text-[13px] text-ink-secondary mt-3 px-3 py-2 rounded bg-surface-subtle">{block.rationale}</p>
              )}
            </>
          )}

          {tipSpot === 2 && tipBanner}

          <div className="flex justify-end mt-4">
            <button onClick={next} disabled={!isReflection && !revealed} className="btn btn-primary">
              {isLast ? "Finish" : "Next"} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {tipSpot === 0 && (
          <aside className="lg:w-72 w-full shrink-0 lg:sticky lg:top-4">
            <div className="card card-body bg-tint-pos-bg">
              <p className="text-[12px] font-semibold text-tint-pos-fg uppercase tracking-wide mb-1.5 flex items-center gap-1"><Lightbulb className="w-4 h-4" /> Tip</p>
              <p className="text-[15px] font-medium leading-relaxed whitespace-pre-line text-ink">{block.tips}</p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
