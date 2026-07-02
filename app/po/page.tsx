"use client";

import { useState, useEffect } from "react";
import { MATH, READING, projectionFrom, ladder, type Subject } from "@/lib/curriculum";
import { kisPosition } from "@/lib/kis";

// Kumon palette (this is a parent-facing kiosk screen — fixed brand colors, not theme tokens).
const C = {
  blue: "#3F5AA8", blueDark: "#3D346C", orange: "#F16C4B", ink: "#2b2f45",
  muted: "#5b6577", soft: "#f3f6fc", line: "#dbe4f5", band: "#e9eef9", white: "#ffffff"
};

const VIDEO_URL = "https://www.kumon.com/how-kumon-works";
// The intake (eSign) link is location-wide — the same for every family at this center.
const INTAKE_URL = "https://us.esign.kumon.com/eSign/USA/Consent.aspx?cd=RMB21W0KC5Q8";
const TF = ["Now", "~6 weeks", "~3 months"]; // projection cadence — tunable (could be SCT-driven later)
const POLICY_URL = "/enrollment-policy.pdf";

type Stage = "setup" | "parentInfo" | "parentMedia" | "place" | "review" | "close" | "done";

export default function POToolPage() {
  const [stage, setStage] = useState<Stage>("setup");
  const [usePO, setUsePO] = useState(false);
  const [form, setForm] = useState({ parent: "", email: "", child: "", grade: "" });
  const [subject, setSubject] = useState<Subject | "both">("math");
  const [mStart, setMStart] = useState("A");
  const [rStart, setRStart] = useState("AI");
  const [view, setView] = useState<Subject>("math");
  const [sel, setSel] = useState(0);
  const [days, setDays] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [classTime, setClassTime] = useState("4:00 PM");
  const [poList, setPoList] = useState<{ id: string; name: string; grade: string; subjects: string[]; poDate: string; email: string }[]>([]);
  const [poId, setPoId] = useState<string | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [showKis, setShowKis] = useState(false);
  const [famId, setFamId] = useState<string | null>(null);
  const [famName, setFamName] = useState("");
  const [famQuery, setFamQuery] = useState("");
  const [famResults, setFamResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [walkinCreated, setWalkinCreated] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/po-tool/upcoming").then((r) => r.json()).then((b) => { if (b.ok) setPoList(b.data); }).catch(() => {});
  }, []);

  const childName = (form.child || "your child").trim();
  const activeView: Subject = subject === "both" ? view : subject;
  const startCode = activeView === "reading" ? rStart : mStart;
  const proj = projectionFrom(activeView, startCode, 3);

  const toggleDay = (d: string) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  const searchFams = (q: string) => {
    if (q.trim().length < 2) { setFamResults([]); return; }
    fetch(`/api/po-tool/families?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((b) => { if (b.ok) setFamResults(b.data); }).catch(() => {});
  };

  // ---- shared styles ----
  const page: React.CSSProperties = { minHeight: "100vh", background: C.band, display: "flex", justifyContent: "center", padding: "16px", fontFamily: "Arial, Helvetica, sans-serif", color: C.ink };
  const card: React.CSSProperties = { width: "100%", maxWidth: 760, background: C.white, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.06)" };
  const header: React.CSSProperties = { background: C.blue, color: "#fff", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" };
  const body: React.CSSProperties = { padding: "22px 22px 26px" };
  const btnPrimary: React.CSSProperties = { width: "100%", background: C.blue, color: "#fff", border: "none", borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 800, cursor: "pointer" };
  const btnOrange: React.CSSProperties = { ...btnPrimary, background: C.orange };
  const btnGhost: React.CSSProperties = { ...btnPrimary, background: "#fff", color: C.blue, border: `2px solid ${C.blue}` };
  const back: React.CSSProperties = { background: "none", border: "none", color: C.muted, fontWeight: 700, cursor: "pointer", fontSize: 13, padding: "6px 0", marginBottom: 6 };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: C.muted, margin: "0 0 6px" };
  const input: React.CSSProperties = { width: "100%", padding: "10px 11px", border: `1px solid #c7d0e4`, borderRadius: 9, color: C.ink, fontSize: 14, marginBottom: 12, background: "#fff" };

  function Brand() {
    return (
      <div style={header}>
        <div style={{ fontWeight: 800, fontSize: 17 }}>KUMON <span style={{ opacity: .85, fontWeight: 600, fontSize: 12 }}>of Wappingers Falls</span></div>
        <div style={{ fontSize: 12, opacity: .9 }}>Assessment Plan</div>
      </div>
    );
  }

  // ---- STAGE: setup (instructor, before handoff) ----
  if (stage === "setup") {
    return (
      <div style={page}><div style={card}><Brand /><div style={body}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.muted, margin: "0 0 4px" }}>BEFORE YOU HAND OVER THE iPAD</p>
        <p style={{ fontSize: 20, fontWeight: 800, margin: "0 0 16px" }}>Who's this for?</p>

        <p style={label}>Start from a booked PO</p>
        <select style={input} value={poId ?? ""} onChange={(e) => {
          const po = poList.find((p) => p.id === e.target.value);
          if (po) {
            setPoId(po.id); setUsePO(true);
            setForm({ parent: "", email: po.email, child: po.name, grade: po.grade });
            if (po.subjects.length === 1) setSubject(po.subjects[0].toLowerCase() === "reading" ? "reading" : "math");
            else if (po.subjects.length > 1) setSubject("both");
          } else { setPoId(null); setUsePO(false); }
        }}>
          <option value="">{poList.length ? "Choose a PO…" : "Loading upcoming POs…"}</option>
          {poList.map((p) => <option key={p.id} value={p.id}>{p.name}{p.grade ? ` — Grade ${p.grade}` : ""}{p.poDate ? ` — ${p.poDate}` : ""}</option>)}
        </select>
        <button style={{ ...btnPrimary, marginBottom: 14 }} onClick={() => setStage("parentMedia")} disabled={!usePO}>
          Use this PO →
        </button>

        <div style={{ textAlign: "center", color: C.muted, fontSize: 12, margin: "4px 0 12px" }}>— or —</div>
        <p style={label}>Walk-in / new — link to a family (optional)</p>
        {famId ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "#eef6ee", border: "1px solid #bfe0c2", borderRadius: 9, padding: "10px 12px", marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: "#1b5e2b" }}>Linked to <b>{famName}</b></span>
            <button onClick={() => { setFamId(null); setFamName(""); setFamQuery(""); setFamResults([]); }} style={{ border: "none", background: "none", color: C.blue, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>change</button>
          </div>
        ) : (
          <>
            <input style={{ ...input, marginBottom: famResults.length ? 6 : 6 }} placeholder="Search an existing family by name…" value={famQuery} onChange={(e) => { setFamQuery(e.target.value); searchFams(e.target.value); }} />
            {famResults.length > 0 && (
              <div style={{ border: `1px solid ${C.line}`, borderRadius: 9, overflow: "hidden", marginBottom: 10 }}>
                {famResults.map((f) => (
                  <button key={f.id} onClick={() => { setFamId(f.id); setFamName(f.name); setFamResults([]); }} style={{ display: "block", width: "100%", textAlign: "left", border: "none", borderBottom: `1px solid ${C.line}`, background: "#fff", padding: "10px 12px", cursor: "pointer", fontSize: 14, color: C.ink }}>
                    {f.name}{f.email ? <span style={{ color: C.muted, fontSize: 12 }}> — {f.email}</span> : null}
                  </button>
                ))}
              </div>
            )}
            <p style={{ fontSize: 11, color: C.muted, margin: "0 0 12px", lineHeight: 1.5 }}>No match? Leave this blank — a new family is created from the info the parent enters.</p>
          </>
        )}
        <button style={btnGhost} onClick={() => { setUsePO(false); setStage("parentInfo"); }}>
          New / walk-in — hand to parent to enter their info
        </button>
      </div></div></div>
    );
  }

  // ---- STAGE: parentInfo (parent enters details) ----
  if (stage === "parentInfo") {
    return (
      <div style={page}><div style={card}><Brand /><div style={body}>
        <button style={back} onClick={() => setStage("setup")}>← Back</button>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.muted, margin: "0 0 4px" }}>WELCOME — A FEW QUICK DETAILS</p>
        <p style={{ fontSize: 20, fontWeight: 800, margin: "0 0 16px" }}>Tell us about your family</p>
        <p style={label}>Your name</p>
        <input style={input} value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })} placeholder="Parent name" />
        <p style={label}>Your email</p>
        <input style={input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" />
        <p style={label}>Child's name</p>
        <input style={input} value={form.child} onChange={(e) => setForm({ ...form, child: e.target.value })} placeholder="Child's name" />
        <p style={label}>Child's grade</p>
        <input style={input} value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="e.g. 2" />
        <button style={btnPrimary} onClick={() => setStage("parentMedia")}>Continue →</button>
      </div></div></div>
    );
  }

  // ---- STAGE: parentMedia (video + intake form) ----
  if (stage === "parentMedia") {
    return (
      <div style={page}><div style={card}><Brand /><div style={body}>
        <button style={back} onClick={() => setStage(usePO ? "setup" : "parentInfo")}>← Back</button>
        <p style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px" }}>Welcome{form.parent ? `, ${form.parent}` : ""}!</p>
        <p style={{ fontSize: 13, color: C.muted, margin: "0 0 16px", lineHeight: 1.6 }}>While we sit with {childName} for a short assessment, please take a few minutes with these steps. Each opens on its own — just tap <b>Done</b> (or the back arrow) to come right back here.</p>

        <a href={VIDEO_URL} target="_blank" rel="noopener" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", background: C.soft, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
          <span style={{ width: 38, height: 38, borderRadius: "50%", background: C.orange, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>▶</span>
          <span><span style={{ display: "block", fontWeight: 700, color: C.ink }}>Step 1 · Watch &ldquo;How Kumon Works&rdquo;</span><span style={{ fontSize: 12, color: C.muted }}>A short video for parents</span></span>
        </a>
        <button onClick={() => setPolicyOpen(true)} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", width: "100%", cursor: "pointer", background: C.soft, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
          <span style={{ width: 38, height: 38, borderRadius: "50%", background: C.blueDark, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>📄</span>
          <span><span style={{ display: "block", fontWeight: 700, color: C.ink }}>Step 2 · Review our enrollment policy</span><span style={{ fontSize: 12, color: C.muted }}>Our fees, schedule, and what to expect — opens right here</span></span>
        </button>
        <a href={INTAKE_URL} target="_blank" rel="noopener" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", background: C.soft, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 18 }}>
          <span style={{ width: 38, height: 38, borderRadius: "50%", background: C.blue, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>✎</span>
          <span><span style={{ display: "block", fontWeight: 700, color: C.ink }}>Step 3 · Complete your intake form</span><span style={{ fontSize: 12, color: C.muted }}>Quick details to get set up</span></span>
        </a>
        <button style={btnGhost} onClick={() => setStage("place")}>Done — hand back to instructor →</button>
      </div></div>
      {policyOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", flexDirection: "column", zIndex: 50 }}>
          <div style={{ background: C.blue, color: "#fff", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Enrollment Policy</span>
            <button onClick={() => setPolicyOpen(false)} style={{ background: "#fff", color: C.blue, border: "none", borderRadius: 8, padding: "7px 18px", fontWeight: 700, cursor: "pointer" }}>Done</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", background: "#525659", padding: 14, textAlign: "center" }}>
            <img src="/policy-page-1.png" alt="Enrollment policy page 1" style={{ width: "100%", maxWidth: 800, marginBottom: 14, borderRadius: 4, boxShadow: "0 2px 10px rgba(0,0,0,.4)" }} />
            <img src="/policy-page-2.png" alt="Enrollment policy page 2" style={{ width: "100%", maxWidth: 800, borderRadius: 4, boxShadow: "0 2px 10px rgba(0,0,0,.4)" }} />
            <div style={{ height: 8 }} />
            <a href={POLICY_URL} target="_blank" rel="noopener" style={{ display: "inline-block", margin: "6px 0 4px", color: "#fff", fontSize: 13, textDecoration: "underline" }}>Download a copy (PDF)</a>
          </div>
        </div>
      )}
      </div>
    );
  }

  // ---- STAGE: place (instructor sets starting point) ----
  if (stage === "place") {
    const subjBtn = (s: Subject | "both", text: string) => (
      <button onClick={() => { setSubject(s); setView(s === "reading" ? "reading" : "math"); }}
        style={{ border: "none", padding: "6px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", background: subject === s ? C.blue : "#fff", color: subject === s ? "#fff" : C.blue }}>{text}</button>
    );
    return (
      <div style={page}><div style={card}><Brand /><div style={body}>
        <button style={back} onClick={() => setStage("parentMedia")}>← Back</button>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.muted, margin: "0 0 10px" }}>SET THE STARTING POINT</p>
        <p style={{ ...label, marginBottom: 8 }}>SUBJECT</p>
        <div style={{ display: "inline-flex", border: `1px solid #c7d0e4`, borderRadius: 999, overflow: "hidden", marginBottom: 16 }}>
          {subjBtn("math", "Math")}{subjBtn("reading", "Reading")}{subjBtn("both", "Both")}
        </div>
        {subject !== "reading" && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}><span style={label}>Math starting level</span><span style={{ fontWeight: 700, color: C.blue }}>{mStart}</span></div>
            <input type="range" min={0} max={MATH.length - 1} value={MATH.findIndex((l) => l.code === mStart)} step={1} style={{ width: "100%", accentColor: C.blue }} onChange={(e) => setMStart(MATH[+e.target.value].code)} />
          </div>
        )}
        {subject !== "math" && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}><span style={label}>Reading starting level</span><span style={{ fontWeight: 700, color: C.blue }}>{rStart}</span></div>
            <input type="range" min={0} max={READING.length - 1} value={READING.findIndex((l) => l.code === rStart)} step={1} style={{ width: "100%", accentColor: C.blue }} onChange={(e) => setRStart(READING[+e.target.value].code)} />
          </div>
        )}
        <button style={btnPrimary} onClick={() => { setSel(0); setStage("review"); }}>Build the projection →</button>
      </div></div></div>
    );
  }

  // ---- STAGE: review (projection) ----
  if (stage === "review") {
    const ys = [118, 80, 38];
    const xs = [70, 280, 510];
    const pts = proj.map((_, i) => `${xs[i]},${ys[i]}`).join(" ");
    // Grade-level (KIS) overlay — positioned on the same vertical scale as the path.
    const lad = ladder(activeView);
    const li0 = Math.max(0, lad.findIndex((l) => l.code === proj[0].code));
    const li2 = Math.max(li0, lad.findIndex((l) => l.code === proj[2].code));
    const pxPer = li2 > li0 ? (ys[0] - ys[2]) / (li2 - li0) : 40;
    const yForIdx = (idx: number) => ys[0] - (idx - li0) * pxPer;
    const clampY = (y: number) => Math.max(18, Math.min(150, y));
    const kisNow = kisPosition(activeView, form.grade);
    let kis: null | { y0: number; y2: number; cross: { x: number; y: number } | null; ahead: boolean; wedge: string } = null;
    if (kisNow != null) {
      const y0 = yForIdx(kisNow), y2 = y0;
      const kisAt = (x: number) => y0 + (y2 - y0) * (x - xs[0]) / (xs[2] - xs[0]);
      let cross: { x: number; y: number } | null = null;
      for (let s = 0; s < xs.length - 1; s++) {
        const da = ys[s] - kisAt(xs[s]), db = ys[s + 1] - kisAt(xs[s + 1]);
        if ((da > 0 && db <= 0) || (da < 0 && db >= 0)) {
          const t = da / (da - db);
          cross = { x: xs[s] + t * (xs[s + 1] - xs[s]), y: ys[s] + t * (ys[s + 1] - ys[s]) };
          break;
        }
      }
      const ahead = ys[0] < y0;
      let wedge = "";
      if (cross) {
        const after = xs.map((x, i) => `${x},${ys[i]}`).filter((_, i) => xs[i] > cross!.x);
        wedge = `${cross.x},${cross.y} ${after.join(" ")} ${xs[2]},${clampY(y2)} ${cross.x},${cross.y}`;
      } else if (ahead) {
        wedge = `${pts} ${xs[2]},${clampY(y2)} ${xs[0]},${clampY(y0)}`;
      }
      kis = { y0, y2, cross, ahead, wedge };
    }
    return (
      <div style={page}><div style={card}><Brand /><div style={body}>
        <button style={back} onClick={() => setStage("place")}>← Back</button>
        {subject === "both" && (
          <div style={{ display: "inline-flex", border: `1px solid #c7d0e4`, borderRadius: 999, overflow: "hidden", marginBottom: 12, float: "right" }}>
            {(["math", "reading"] as Subject[]).map((v) => (
              <button key={v} onClick={() => { setView(v); setSel(0); }} style={{ border: "none", padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: view === v ? C.blue : "#fff", color: view === v ? "#fff" : C.blue, textTransform: "capitalize" }}>{v}</button>
            ))}
          </div>
        )}
        <p style={{ fontSize: 14, fontWeight: 800, margin: "0 0 2px" }}>{childName}&apos;s projected growth</p>
        <p style={{ fontSize: 12, color: C.muted, margin: "0 0 6px" }}>Where steady practice takes {childName} over the next few months.</p>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "#e7f6ee", border: "1px solid #b6e2cb", borderRadius: 12, padding: "14px 16px", margin: "4px 0 16px" }}>
          <span style={{ width: 34, height: 34, borderRadius: "50%", background: "#1b7a4b", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flex: "0 0 auto" }}>✓</span>
          {activeView === "reading" ? (
            <div style={{ fontSize: 15, color: "#155e3b", lineHeight: 1.5 }}><span style={{ fontSize: 18, fontWeight: 800 }}>Reading powers every subject.</span> Kumon builds the comprehension, vocabulary, and confidence to read <b>above grade level</b> — and a lasting love of reading.</div>
          ) : (
            <div style={{ fontSize: 15, color: "#155e3b", lineHeight: 1.5 }}><span style={{ fontSize: 18, fontWeight: 800 }}>Over 40%</span> of our math students at Wappingers Falls work a <b>full year or more above grade level</b> — and the average student advances about <b>four levels a year</b>.</div>
          )}
        </div>
        <div style={{ position: "relative" }}>
          {kisNow != null && (
            <button onClick={() => setShowKis((v) => !v)} aria-label="view options" style={{ position: "absolute", top: 0, right: 0, width: 26, height: 26, padding: 0, border: "none", background: "transparent", cursor: "pointer", color: showKis ? "#BA7517" : "#dbe1ec", fontSize: 10, lineHeight: 1 }}>●</button>
          )}
          <svg viewBox="0 0 620 168" width="100%" role="img" aria-label="Upward growth line rising over the coming months">
            <polygon points={`${pts} ${xs[2]},138 ${xs[0]},138`} fill={C.blue} fillOpacity="0.10" />
            {showKis && kis && (
              <g>
                {kis.wedge && <polygon points={kis.wedge} fill="#1b7a4b" fillOpacity="0.13" />}
                <line x1={xs[0]} y1={clampY(kis.y0)} x2={xs[2]} y2={clampY(kis.y2)} stroke="#BA7517" strokeWidth="2" strokeDasharray="6 5" />
                <text x={xs[2]} y={clampY(kis.y2) - 6} textAnchor="end" fontSize="11" fontWeight="700" fill="#9a6a12">grade level</text>
                {kis.cross && (<g><circle cx={kis.cross.x} cy={kis.cross.y} r="5.5" fill="#1b7a4b" /><text x={kis.cross.x} y={kis.cross.y + 19} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1b7a4b">catches up here</text></g>)}
                {!kis.cross && kis.ahead && <text x={xs[0]} y={clampY(kis.y0) + 16} fontSize="11" fontWeight="700" fill="#1b7a4b">already ahead</text>}
              </g>
            )}
            <polyline points={pts} fill="none" stroke={C.blue} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {proj.map((l, i) => (<g key={l.code}><circle cx={xs[i]} cy={ys[i]} r="5" fill={C.orange} /><text x={xs[i]} y={ys[i] - 10} textAnchor="middle" fontSize="12" fontWeight="700" fill={C.blueDark}>{l.code}</text></g>))}
            {TF.map((t, i) => (<text key={t} x={xs[i]} y="156" textAnchor="middle" fontSize="11" fill="#8b96ac">{t}</text>))}
          </svg>
        </div>
        {showKis && kis && (
          <p style={{ fontSize: 11, color: C.muted, margin: "2px 0 0", lineHeight: 1.5 }}>The dashed line is grade level for {childName}&apos;s grade — each Kumon level climbs further above it.</p>
        )}
        <p style={{ fontSize: 12, color: C.muted, margin: "10px 0 6px" }}>Tap a level to see what {childName} will work on.</p>
        <div style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
          {proj.map((l, i) => (
            <button key={l.code} onClick={() => setSel(i)} style={{ flex: 1, cursor: "pointer", textAlign: "center", border: sel === i ? `2px solid ${C.blue}` : `1px solid ${C.line}`, background: sel === i ? "#fff" : C.soft, borderRadius: 12, padding: "10px 6px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: sel === i ? C.blue : C.muted, marginBottom: 5 }}>{TF[i]}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: sel === i ? C.blue : C.ink, lineHeight: 1 }}>{l.code}</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 5, lineHeight: 1.25 }}>{l.title}</div>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 14, borderTop: `1px solid #e2e9f5`, paddingTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>{TF[sel]}</div>
          <p style={{ fontSize: 19, fontWeight: 800, margin: "0 0 8px", color: C.blueDark }}>Level {proj[sel].code} — {proj[sel].title}</p>
          <p style={{ fontSize: 15, color: C.ink, margin: "0 0 12px", lineHeight: 1.6 }}>{proj[sel].desc}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {proj[sel].bullets.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 15, color: C.ink, lineHeight: 1.45 }}>
                <span style={{ color: "#1b7a4b", fontSize: 18, flex: "0 0 auto", lineHeight: 1.2 }}>✓</span><span>{b}</span>
              </div>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 11, color: C.muted, margin: "14px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>This is an illustration of what&apos;s possible with consistent daily practice — not a guarantee. Every child&apos;s pace is different and depends on daily practice, repetition, and workload.</p>
        <button style={{ ...btnOrange, marginTop: 12 }} onClick={() => setStage("close")}>Let&apos;s enroll {childName} →</button>
      </div></div></div>
    );
  }

  // ---- STAGE: close (schedule + start date) ----
  if (stage === "close") {
    return (
      <div style={page}><div style={card}><Brand /><div style={body}>
        <button style={back} onClick={() => setStage("review")}>← Back</button>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.muted, margin: "0 0 4px" }}>FINISH · PICK A SCHEDULE</p>
        <p style={{ fontSize: 18, fontWeight: 800, margin: "0 0 14px" }}>Choose {childName}&apos;s class days &amp; start date</p>
        <p style={label}>ENROLLING IN</p>
        <div style={{ display: "inline-flex", border: `1px solid #c7d0e4`, borderRadius: 999, overflow: "hidden", marginBottom: 16 }}>
          {(["math", "reading", "both"] as (Subject | "both")[]).map((s) => (
            <button key={s} onClick={() => { setSubject(s); setView(s === "reading" ? "reading" : "math"); }} style={{ border: "none", padding: "6px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", background: subject === s ? C.blue : "#fff", color: subject === s ? "#fff" : C.blue, textTransform: "capitalize" }}>{s}</button>
          ))}
        </div>
        <p style={label}>Class days</p>
        <p style={{ fontSize: 12, color: C.muted, margin: "0 0 8px" }}>We typically pair <b>Mon + Thu</b> or <b>Tue + Sat</b> — but you can mix.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {([["Mon", "Thu"], ["Tue", "Sat"]] as [string, string][]).map((pair) => {
            const on = days.length === 2 && pair.every((d) => days.includes(d));
            return <button key={pair.join()} onClick={() => setDays([...pair])} style={{ border: `2px solid ${C.blue}`, background: on ? C.blue : "#fff", color: on ? "#fff" : C.blue, borderRadius: 999, padding: "9px 18px", fontWeight: 700, cursor: "pointer" }}>{pair.join(" + ")}</button>;
          })}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {["Mon", "Tue", "Thu", "Sat"].map((d) => {
            const on = days.includes(d); const pairA = d === "Mon" || d === "Thu";
            return <button key={d} onClick={() => toggleDay(d)} style={{ border: on ? `1px solid ${C.blue}` : `1px solid ${pairA ? "#cdd9f0" : "#f1c9bb"}`, background: on ? C.blue : (pairA ? "#eef2fb" : "#fdeee9"), color: on ? "#fff" : C.ink, borderRadius: 999, padding: "9px 18px", fontWeight: 700, cursor: "pointer" }}>{d}</button>;
          })}
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
          <div><p style={label}>Start date</p><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: 9, border: "1px solid #c7d0e4", borderRadius: 8, color: C.ink }} /></div>
          <div><p style={label}>Class time</p><select value={classTime} onChange={(e) => setClassTime(e.target.value)} style={{ padding: 10, border: "1px solid #c7d0e4", borderRadius: 8, background: "#fff", color: C.ink }}>{["4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM"].map((t) => <option key={t}>{t}</option>)}</select></div>
        </div>
        <button style={btnOrange} onClick={async () => {
          try {
            if (poId) {
              await fetch("/api/po-tool/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
                poId,
                mathLevel: subject !== "reading" ? mStart : undefined,
                readingLevel: subject !== "math" ? rStart : undefined,
                schedule: days,
                startDate: startDate || undefined,
                classTime
              }) });
            } else {
              const r = await fetch("/api/po-tool/create-walkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
                famId: famId ?? undefined,
                parent: form.parent || undefined,
                email: form.email || undefined,
                child: form.child,
                grade: form.grade || undefined,
                subject,
                mathLevel: subject !== "reading" ? mStart : undefined,
                readingLevel: subject !== "math" ? rStart : undefined,
                schedule: days,
                startDate: startDate || undefined,
                classTime
              }) });
              const b = await r.json().catch(() => null);
              setWalkinCreated(!!(b && b.ok && b.data && b.data.poId));
            }
          } catch { setWalkinCreated(false); }
          setStage("done");
        }}>Complete enrollment</button>
      </div></div></div>
    );
  }

  // ---- STAGE: done ----
  const walkinBody = [
    "Walk-in enrollment captured at the PO table — use this to create the PO and recap:",
    "",
    `Child: ${childName}`,
    form.grade ? `Grade: ${form.grade}` : "",
    form.parent ? `Parent: ${form.parent}` : "",
    form.email ? `Parent email: ${form.email}` : "",
    "",
    `Subjects: ${subject === "both" ? "Math & Reading" : subject === "reading" ? "Reading" : "Math"}`,
    subject !== "reading" ? `Math start: Level ${mStart}` : "",
    subject !== "math" ? `Reading start: Level ${rStart}` : "",
    `Class days: ${days.length ? days.join(", ") : "—"}`,
    `Class time: ${classTime}`,
    `Start date: ${startDate || "—"}`
  ].filter(Boolean).join("\n");
  const walkinMailto = `mailto:adamlent@ikumon.com?subject=${encodeURIComponent("New walk-in enrollment: " + childName)}&body=${encodeURIComponent(walkinBody)}`;
  return (
    <div style={page}><div style={card}><Brand /><div style={body}>
      <div style={{ textAlign: "center", padding: "10px 0 4px" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e7f6ee", color: "#1b7a4b", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 10 }}>✓</div>
        <p style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px" }}>{childName} is all set!</p>
      </div>
      <div style={{ background: C.soft, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, fontSize: 14, lineHeight: 1.8, color: C.ink }}>
        <div><b>Subjects:</b> {subject === "both" ? "Math & Reading" : subject === "reading" ? "Reading" : "Math"}</div>
        {subject !== "reading" && <div><b>Math start:</b> Level {mStart}</div>}
        {subject !== "math" && <div><b>Reading start:</b> Level {rStart}</div>}
        <div><b>Class days:</b> {days.length ? days.join(", ") : "—"} at {classTime}</div>
        <div><b>Start date:</b> {startDate || "—"}</div>
      </div>
      {poId ? (
        <p style={{ fontSize: 12, color: C.muted, margin: "14px 0", lineHeight: 1.6 }}>This pre-fills the PO recap and kicks off onboarding (welcome email, folder, KSIS). Review and finalize the recap in Owner Operations.</p>
      ) : (
        <>
          {walkinCreated === true && (
            <div style={{ background: "#eef6ee", border: "1px solid #bfe0c2", borderRadius: 10, padding: "12px 14px", margin: "14px 0 10px", fontSize: 13, color: "#1b5e2b", lineHeight: 1.55 }}>Saved to Airtable — a PO and student record were created{famId ? "" : " under a new family"}. Finish the recap in Owner Operations.</div>
          )}
          {walkinCreated === false && (
            <div style={{ background: "#fdeee9", border: "1px solid #f1c9bb", borderRadius: 10, padding: "12px 14px", margin: "14px 0 10px", fontSize: 13, color: "#8a3b1e", lineHeight: 1.55 }}>Couldn&apos;t save to Airtable. Email yourself the details below so nothing is lost, then enter the PO by hand.</div>
          )}
          <a href={walkinMailto} style={{ ...btnGhost, display: "block", textAlign: "center", textDecoration: "none", marginTop: 4 }}>Email me a copy</a>
        </>
      )}
      <button style={btnGhost} onClick={() => { setStage("setup"); setUsePO(false); setPoId(null); setForm({ parent: "", email: "", child: "", grade: "" }); setSubject("math"); setMStart("A"); setRStart("AI"); setDays([]); setStartDate(""); setShowKis(false); setFamId(null); setFamName(""); setFamQuery(""); setFamResults([]); setWalkinCreated(null); }}>Start a new assessment</button>
    </div></div></div>
  );
}
