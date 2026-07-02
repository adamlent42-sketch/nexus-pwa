"use client";

import { useState } from "react";
import { Check, X as XIcon, Lightbulb, ArrowRight } from "lucide-react";

type Done = (passed: boolean) => void;

// Safely merge Airtable JSON over code defaults (shallow — arrays replace whole).
function parse<T extends object>(raw: string, fallback: T): T {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? { ...fallback, ...v } : fallback;
  } catch {
    return fallback;
  }
}
const norm = (s: string) => s.trim().replace(/[—–]/g, "-");

// Shared little UI helpers --------------------------------------------------
function Tip({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="rounded-lg bg-tint-pos-bg border border-status-success-fg/20 px-4 py-3 my-3 flex gap-2.5">
      <Lightbulb className="w-5 h-5 text-status-success-fg shrink-0 mt-0.5" />
      <p className="text-[15px] font-medium leading-relaxed text-ink">{text}</p>
    </div>
  );
}
function DoneBanner({ text }: { text: string }) {
  return (
    <div className="rounded-lg bg-status-success-bg px-4 py-3 mt-3 flex gap-2.5">
      <Check className="w-5 h-5 text-status-success-fg shrink-0 mt-0.5" />
      <p className="text-[15px] font-medium leading-relaxed text-status-success-fg">{text}</p>
    </div>
  );
}

// Dispatcher ----------------------------------------------------------------
export function Exercise({ kind, data, imageUrl, onDone }: { kind: string; data: string; imageUrl: string | null; onDone: Done }) {
  if (kind === "summary") return <SummaryDrill data={data} onDone={onDone} />;
  if (kind === "mark-page") return <MarkPageDrill data={data} imageUrl={imageUrl} onDone={onDone} />;
  if (kind === "score-set") return <ScoreSetDrill data={data} imageUrl={imageUrl} onDone={onDone} />;
  if (kind === "corrections") return <CorrectionsDrill data={data} onDone={onDone} />;
  if (kind === "sort-bins") return <SortBinsDrill data={data} onDone={onDone} />;
  if (kind === "sequence") return <SequenceDrill data={data} onDone={onDone} />;
  return <p className="text-[13px] text-ink-tertiary">This exercise isn’t set up yet.</p>;
}

// Renders the real worksheet snip from the block's Image field, or a prompt to add one.
function ImageBlock({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="rounded-md border border-dashed border-line bg-surface-subtle px-3 py-4 mb-3 text-[13px] text-ink-tertiary">
        📎 Drop a worksheet snip into this block’s Image field (Airtable) to show the real page here.
      </div>
    );
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Worksheet" className="rounded-md border border-line max-w-full mb-3" />
    </>
  );
}

// 1) Front-page summary -----------------------------------------------------
interface SummaryDay { label: string; note: string; code: string }
function SummaryDrill({ data, onDone }: { data: string; onDone: Done }) {
  const d = parse(data, {
    subject: "Math", level: "2A", pages: "41–50", studentName: "Maya R.",
    tip: "Don’t know whose work it is? Look up — the student is almost always watching you grade. Have them write their first name + last initial, and remind them to do it every time.",
    days: [
      { label: "Day 1", note: "0 errors · 100%", code: "-" },
      { label: "Day 2", note: "1 error · 90%", code: "9" },
      { label: "Day 3", note: "2 errors · 80%", code: "8" },
      { label: "Day 4", note: "0 errors · 100%", code: "-" },
      { label: "Day 5", note: "1 partial · 90%", code: "9" }
    ] as SummaryDay[],
    time: "11"
  });
  const [step, setStep] = useState(1);
  const [namePick, setNamePick] = useState<number | null>(null);
  const [codes, setCodes] = useState<string[]>(d.days.map(() => ""));
  const [time, setTime] = useState("");
  const [noted, setNoted] = useState(false);
  const [tried, setTried] = useState(false);
  const [done, setDone] = useState(false);

  const heading = (
    <div className="bg-surface border border-line rounded-lg px-4 py-3 mb-3">
      <p className="text-[11px] text-ink-tertiary tracking-wide uppercase">Kumon · {d.subject} · Level {d.level} · pages {d.pages}</p>
      <div className="flex gap-6 mt-2 text-[15px]">
        <span>Name:{" "}
          {namePick === 1
            ? <span className="font-medium">{d.studentName}</span>
            : <span className="text-status-danger-fg border-b-2 border-line px-6">&nbsp;(blank)</span>}
        </span>
        <span>Time: <span className="text-status-danger-fg border-b-2 border-line px-4">&nbsp;(blank)</span></span>
      </div>
    </div>
  );

  if (step === 1) {
    const opts = [
      "Write in the name of whoever you think it is",
      "Look up — the student is probably watching. Have them write their first name + last initial.",
      "Just grade it and sort the name out later"
    ];
    return (
      <div>
        <p className="text-[15px] mb-3">A student just handed you this set. <span className="font-medium">Before you grade a single page, check the heading.</span></p>
        {heading}
        <p className="text-[14px] text-ink-secondary mb-2">The name line is blank and you’re not sure whose set this is. What do you do?</p>
        <div className="space-y-2">
          {opts.map((o, idx) => {
            const picked = namePick === idx;
            const good = idx === 1;
            let cls = "border-line bg-surface hover:border-brand";
            if (picked && good) cls = "border-status-success-fg bg-status-success-bg";
            else if (picked && !good) cls = "border-status-danger-fg bg-status-danger-bg";
            return (
              <button key={idx} onClick={() => setNamePick(idx)} disabled={namePick === 1}
                className={`w-full text-left text-[15px] px-3 py-2.5 rounded-md border flex items-center gap-2 ${cls}`}>
                <span className="flex-1">{o}</span>
                {picked && good && <Check className="w-4 h-4 text-status-success-fg shrink-0" />}
                {picked && !good && <XIcon className="w-4 h-4 text-status-danger-fg shrink-0" />}
              </button>
            );
          })}
        </div>
        {namePick === 1 && (
          <>
            <Tip text={d.tip} />
            <div className="flex justify-end">
              <button onClick={() => setStep(2)} className="btn btn-primary">Next — write the summary <ArrowRight className="w-3.5 h-3.5" /></button>
            </div>
          </>
        )}
        {namePick !== null && namePick !== 1 && (
          <p className="text-[13px] text-status-danger-fg mt-2">Never guess or grade an unnamed set blind — it can end up in the wrong folder. Look up first.</p>
        )}
      </div>
    );
  }

  const check = () => {
    setTried(true);
    const codesOk = d.days.every((day, i) => norm(codes[i]) === norm(day.code));
    if (codesOk && time.trim() !== "" && noted) { setDone(true); onDone(true); }
  };

  return (
    <div>
      <p className="text-[15px] mb-3">Good. Now grade and <span className="font-medium">write the summary on the front page.</span> Convert each day’s score into its code and fill in the total time.</p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
        {d.days.map((day, i) => (
          <div key={i} className="bg-surface-subtle rounded-md p-2 text-center">
            <p className="text-[11px] text-ink-secondary">{day.label}</p>
            <p className="text-[13px] mt-0.5">{day.note}</p>
          </div>
        ))}
      </div>
      <div className="bg-surface border border-line rounded-lg px-4 py-3">
        <p className="text-[13px] text-ink-secondary mb-2">Front-page summary · key: <span className="font-medium">—</span>=100 <span className="font-medium ml-1">9</span>=90 <span className="font-medium ml-1">8</span>=80 <span className="font-medium ml-1">7</span>=70</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] text-ink-secondary">Time</span>
          <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="min"
            className="w-16 border border-line rounded-md px-2 py-1.5 text-[15px] bg-surface" />
          <span className="text-[14px] text-ink-secondary ml-2">Codes</span>
          {d.days.map((day, i) => {
            const filled = codes[i].trim() !== "";
            const ok = norm(codes[i]) === norm(day.code);
            const border = tried && filled ? (ok ? "border-status-success-fg" : "border-status-danger-fg") : "border-line";
            return (
              <input key={i} value={codes[i]} disabled={done}
                onChange={(e) => setCodes((c) => c.map((v, j) => (j === i ? e.target.value : v)))}
                className={`w-11 text-center border rounded-md px-1 py-1.5 text-[15px] bg-surface ${border}`} />
            );
          })}
        </div>
        <label className="flex items-center gap-2 mt-3 text-[14px]">
          <input type="checkbox" checked={noted} disabled={done} onChange={(e) => setNoted(e.target.checked)} />
          Make a note on the sheet that the heading (name + time) came in blank
        </label>
        {!done && <button onClick={check} className="btn btn-primary mt-3">Check my summary</button>}
        {tried && !done && <p className="text-[13px] text-status-warn-fg mt-2">Close — check the red boxes. — = 100, 9 = 90, 8 = 80. Fill the time and note the blank heading.</p>}
        {done && <DoneBanner text={`Summary complete: time + ${d.days.map((x) => x.code).join(" ")}, heading flagged. That front page is now the day’s record.`} />}
      </div>
    </div>
  );
}

// 2) Mark the page (anchored on a real worksheet snip) ----------------------
interface MarkProblem { n: number; shown?: string; mark: string }
function MarkPageDrill({ data, imageUrl, onDone }: { data: string; imageUrl: string | null; onDone: Done }) {
  const d = parse(data, {
    prompt: "Use the worksheet above. For each problem listed, choose the right mark — a correct answer gets no mark, a full error gets an X, a partial gets a △.",
    problems: [
      { n: 1, mark: "ok" },
      { n: 2, mark: "X" },
      { n: 3, mark: "ok" },
      { n: 4, mark: "△" }
    ] as MarkProblem[]
  });
  const [picks, setPicks] = useState<string[]>(d.problems.map(() => ""));
  const [done, setDone] = useState(false);
  const choices = [{ v: "ok", label: "Right" }, { v: "X", label: "X" }, { v: "△", label: "△" }];

  const set = (i: number, v: string) => {
    if (done) return;
    const nextPicks = picks.map((p, j) => (j === i ? v : p));
    setPicks(nextPicks);
    if (d.problems.every((p, j) => nextPicks[j] === p.mark)) { setDone(true); onDone(true); }
  };

  return (
    <div>
      <p className="text-[15px] mb-3">{d.prompt}</p>
      <ImageBlock url={imageUrl} />
      <div className="space-y-2">
        {d.problems.map((p, i) => {
          const picked = picks[i];
          const correct = picked === p.mark;
          return (
            <div key={i} className="bg-surface border border-line rounded-lg px-3 py-2.5 flex items-center gap-3 flex-wrap">
              <span className="text-[14px] font-medium min-w-[96px]">Problem {p.n}{p.shown ? `: ${p.shown}` : ""}</span>
              <div className="flex gap-1.5 ml-auto">
                {choices.map((c) => {
                  const sel = picked === c.v;
                  let cls = "border-line bg-surface hover:border-brand";
                  if (sel && correct) cls = "border-status-success-fg bg-status-success-bg text-status-success-fg";
                  else if (sel && !correct) cls = "border-status-danger-fg bg-status-danger-bg text-status-danger-fg";
                  return (
                    <button key={c.v} onClick={() => set(i, c.v)} disabled={done}
                      className={`min-w-[44px] text-[15px] px-2.5 py-1.5 rounded-md border ${cls}`}>{c.label}</button>
                  );
                })}
              </div>
              {picked && !correct && <span className="text-[12px] text-status-danger-fg w-full">Look again at the page — try another mark.</span>}
            </div>
          );
        })}
      </div>
      {done && <DoneBanner text="Marked correctly. Correct answers stay clean, X for a full error, △ for a partial. If the whole page were clean, you’d circle it." />}
    </div>
  );
}

// 3) Score the set — read the marked page, circle the % on the scale --------
function ScoreSetDrill({ data, imageUrl, onDone }: { data: string; imageUrl: string | null; onDone: Done }) {
  const d = parse(data, {
    prompt: "Grade the page above. Count the errors, then circle the score on the scale — exactly like the grading scale printed at the top of the worksheet.",
    note: "In Math, a △ counts as a full error. Count every X and every △ on the page.",
    scale: [100, 90, 80, 70, 60] as number[],
    answerPct: 80
  });
  const [pick, setPick] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const choose = (p: number) => {
    if (done) return;
    setPick(p);
    if (p === d.answerPct) { setDone(true); onDone(true); }
  };

  return (
    <div>
      <p className="text-[15px] mb-3">{d.prompt}</p>
      <ImageBlock url={imageUrl} />
      <Tip text={d.note} />
      <p className="text-[14px] text-ink-secondary mb-2">Circle the score on the scale:</p>
      <div className="flex flex-wrap gap-2">
        {d.scale.map((o) => {
          const sel = pick === o;
          const correct = o === d.answerPct;
          let cls = "border-line bg-surface hover:border-brand";
          if (sel && correct) cls = "border-2 border-status-success-fg bg-status-success-bg text-status-success-fg";
          else if (sel && !correct) cls = "border-status-danger-fg bg-status-danger-bg text-status-danger-fg";
          return (
            <button key={o} onClick={() => choose(o)} disabled={done}
              className={`min-w-[56px] text-[15px] px-3 py-2 rounded-full border ${cls}`}>{o}</button>
          );
        })}
      </div>
      {pick !== null && pick !== d.answerPct && !done && (
        <p className="text-[13px] text-status-danger-fg mt-2">Not quite — count every X and △ on the page, then circle that score on the scale.</p>
      )}
      {done && <DoneBanner text={`Right — circle ${d.answerPct} on the scale. Count first, then circle, exactly like on the worksheet.`} />}
    </div>
  );
}

// 4) Corrections flow -------------------------------------------------------
interface CorrStep { q: string; options: string[]; answer: string }
function CorrectionsDrill({ data, onDone }: { data: string; onDone: Done }) {
  const d = parse(data, {
    intro: "A student brings back problem #5 that you’d marked X — now corrected.",
    steps: [
      { q: "How do you mark the now-correct item?", options: ["Erase the X", "Draw a small circle on the X", "Change it to a △", "Leave it blank"], answer: "Draw a small circle on the X" },
      { q: "On a different item, it’s still wrong after this second try. You mark it:", options: ["A circle", "XX", "Erase and retry", "Nothing"], answer: "XX" },
      { q: "What score goes in the record book for the day?", options: ["The corrected 100%", "The initial score", "90%", "Whatever’s highest"], answer: "The initial score" }
    ] as CorrStep[]
  });
  const [si, setSi] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const step = d.steps[si];

  const choose = (o: string) => {
    if (pick === step.answer) return;
    setPick(o);
    if (o === step.answer) {
      if (si + 1 < d.steps.length) { setTimeout(() => { setSi(si + 1); setPick(null); }, 450); }
      else { setDone(true); onDone(true); }
    }
  };

  return (
    <div>
      <p className="text-[15px] mb-1">{d.intro}</p>
      <p className="text-[12px] text-ink-tertiary mb-3">Step {si + 1} of {d.steps.length}</p>
      <p className="text-[14px] font-medium mb-2">{step.q}</p>
      <div className="space-y-2">
        {step.options.map((o) => {
          const sel = pick === o;
          const correct = o === step.answer;
          let cls = "border-line bg-surface hover:border-brand";
          if (sel && correct) cls = "border-status-success-fg bg-status-success-bg";
          else if (sel && !correct) cls = "border-status-danger-fg bg-status-danger-bg";
          return (
            <button key={o} onClick={() => choose(o)} disabled={pick === step.answer}
              className={`w-full text-left text-[15px] px-3 py-2.5 rounded-md border flex items-center gap-2 ${cls}`}>
              <span className="flex-1">{o}</span>
              {sel && correct && <Check className="w-4 h-4 text-status-success-fg shrink-0" />}
              {sel && !correct && <XIcon className="w-4 h-4 text-status-danger-fg shrink-0" />}
            </button>
          );
        })}
      </div>
      {pick && pick !== step.answer && <p className="text-[13px] text-status-danger-fg mt-2">Try again.</p>}
      {done && <DoneBanner text="That’s the corrections flow: a small circle when it’s fixed, XX if it’s still wrong, and the record always keeps the student’s initial score." />}
    </div>
  );
}

// 5) Sort into bins (reusable: grading-flow sorting, EL "areas we develop") --
interface Bin { id: string; label: string }
interface SortItem { label: string; bin: string }
function SortBinsDrill({ data, onDone }: { data: string; onDone: Done }) {
  const d = parse(data, {
    prompt: "Sort each piece of work into the right pile.",
    bins: [
      { id: "file", label: "Done → data entry / file" },
      { id: "repeat", label: "Needs corrections / repeat" },
      { id: "oral", label: "Needs an oral check" }
    ] as Bin[],
    items: [
      { label: "A set that’s all correct", bin: "file" },
      { label: "A page with 2 uncorrected X’s", bin: "repeat" },
      { label: "An early-Reading 6A folder flagged for oral", bin: "oral" }
    ] as SortItem[]
  });
  const [assign, setAssign] = useState<(string | null)[]>(d.items.map(() => null));
  const [done, setDone] = useState(false);

  const set = (i: number, bin: string) => {
    if (done) return;
    const next = assign.map((a, j) => (j === i ? bin : a));
    setAssign(next);
    if (d.items.every((it, j) => next[j] === it.bin)) { setDone(true); onDone(true); }
  };

  return (
    <div>
      <p className="text-[15px] mb-3">{d.prompt}</p>
      <div className="space-y-2">
        {d.items.map((it, i) => {
          const a = assign[i];
          const correct = a === it.bin;
          return (
            <div key={i} className="bg-surface border border-line rounded-lg px-3 py-2.5">
              <p className="text-[15px] mb-2">{it.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {d.bins.map((b) => {
                  const sel = a === b.id;
                  let cls = "border-line bg-surface hover:border-brand";
                  if (sel && correct) cls = "border-status-success-fg bg-status-success-bg text-status-success-fg";
                  else if (sel && !correct) cls = "border-status-danger-fg bg-status-danger-bg text-status-danger-fg";
                  return (
                    <button key={b.id} onClick={() => set(i, b.id)} disabled={done}
                      className={`text-[14px] px-2.5 py-1.5 rounded-md border ${cls}`}>{b.label}</button>
                  );
                })}
              </div>
              {a && !correct && <p className="text-[12px] text-status-danger-fg mt-1.5">Not that pile — try again.</p>}
            </div>
          );
        })}
      </div>
      {done && <DoneBanner text="Sorted right. Keeping work in the right pile — and in order — is what keeps the center moving." />}
    </div>
  );
}

// 6) Put steps in order (reusable: flows, routines) -------------------------
interface SeqStep { label: string; order: number }
function SequenceDrill({ data, onDone }: { data: string; onDone: Done }) {
  const d = parse(data, {
    prompt: "Put the steps in the right order — click them one at a time.",
    steps: [
      { label: "Start at the last page", order: 1 },
      { label: "Grade the b-side before the a-side", order: 2 },
      { label: "Circle every clean page", order: 3 },
      { label: "Write the front-page summary", order: 4 }
    ] as SeqStep[]
  });
  const correctOrder = [...d.steps].sort((a, b) => a.order - b.order).map((s) => s.label);
  const [chosen, setChosen] = useState<string[]>([]);
  const [wrong, setWrong] = useState(false);
  const [done, setDone] = useState(false);
  const remaining = d.steps.filter((s) => !chosen.includes(s.label));

  const pick = (label: string) => {
    if (done) return;
    const idx = chosen.length;
    if (label !== correctOrder[idx]) { setWrong(true); return; }
    setWrong(false);
    const next = [...chosen, label];
    setChosen(next);
    if (next.length === correctOrder.length) { setDone(true); onDone(true); }
  };

  return (
    <div>
      <p className="text-[15px] mb-3">{d.prompt}</p>
      <ol className="space-y-1.5 mb-3">
        {chosen.map((c, i) => (
          <li key={i} className="text-[15px] bg-status-success-bg text-status-success-fg rounded-md px-3 py-2 flex gap-2">
            <span className="font-medium">{i + 1}.</span>{c}
          </li>
        ))}
      </ol>
      {!done && (
        <div className="flex flex-wrap gap-2">
          {remaining.map((s) => (
            <button key={s.label} onClick={() => pick(s.label)}
              className="text-[15px] px-3 py-2 rounded-md border border-line bg-surface hover:border-brand text-left">{s.label}</button>
          ))}
        </div>
      )}
      {wrong && !done && <p className="text-[13px] text-status-danger-fg mt-2">Not the next step — think about what comes first, then try another.</p>}
      {done && <DoneBanner text="That’s the order. Doing it the same way every time makes you fast and accurate." />}
    </div>
  );
}
