import { useState, useEffect, useMemo } from "react";

const SUPABASE_URL = "https://kzuxbedscghfiqvsdngz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6dXhiZWRzY2doZmlxdnNkbmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjE1NTgsImV4cCI6MjA5MzgzNzU1OH0.Mcw87G-CAbHf6gO8O2Z7McVM5jYujtmrD3TMAstWKT4";

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "Prefer": opts.prefer || "return=representation",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const ACCENT = "#E8855A";
const KATEGORIEN = [
  { id: "wohnen",       label: "Wohnen",       icon: "🏠", farbe: "#E8855A" },
  { id: "lebensmittel", label: "Lebensmittel", icon: "🛒", farbe: "#F0A500" },
  { id: "transport",    label: "Transport",    icon: "🚗", farbe: "#4A7CF6" },
  { id: "gesundheit",   label: "Gesundheit",   icon: "💊", farbe: "#30C4D8" },
  { id: "freizeit",     label: "Freizeit",     icon: "🎬", farbe: "#9B6EF3" },
  { id: "einnahme",     label: "Einnahme",     icon: "💰", farbe: "#2DBD6E" },
  { id: "sonstiges",    label: "Sonstiges",    icon: "📦", farbe: "#999" },
];
const SPAR_KAT = { id: "sparen", label: "Sparen", icon: "🏦", farbe: "#2DBD6E" };
const ALLE_KAT = [...KATEGORIEN, SPAR_KAT];
const KAT_MAP = Object.fromEntries(ALLE_KAT.map(c => [c.id, c]));
const MONATE = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

function datumFmt(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
function heute() { return new Date().toISOString().slice(0, 10); }
function tagZeit() {
  const h = new Date().getHours();
  if (h < 12) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  html, body { background: #F5F5F0; overflow-x: hidden; }
  .noscroll { overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; -webkit-overflow-scrolling: touch; }
  .noscroll::-webkit-scrollbar { display: none; }
  select { -webkit-appearance: none; appearance: none; }
  input, button, select { font-family: inherit; }
  input[type=date]::-webkit-calendar-picker-indicator { opacity: 0.4; }
`;

// ── Fade-scroll row ──
function FRow({ children, gap = 8 }) {
  return (
    <div style={{ position: "relative" }}>
      <div className="noscroll" style={{ display: "flex", gap, paddingBottom: 2 }}>
        {children}
      </div>
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 40, background: "linear-gradient(to right, transparent, #F5F5F0)", pointerEvents: "none" }} />
    </div>
  );
}

// ── Sparkline ──
function SparkLine({ data, labels, color = ACCENT, height = 120 }) {
  if (!data || data.length < 2) return (
    <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#bbb", fontSize: 13 }}>Keine Daten</div>
  );
  const W = 320, H = height - 30;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * (W - 24) + 12,
    H - 8 - ((v - min) / range) * (H - 20),
  ]);
  const pathD = "M " + pts.map(p => p.join(",")).join(" L ");
  const areaD = `M ${pts[0].join(",")} L ${pts.map(p => p.join(",")).join(" L ")} L ${pts[pts.length-1][0]},${H+4} L ${pts[0][0]},${H+4} Z`;
  const gid = "sg" + color.replace(/[^a-z0-9]/gi, "");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H+4}`} style={{ width: "100%", height: H }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gid})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill={color} stroke="white" strokeWidth="2" />)}
      </svg>
      {labels && (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px 0" }}>
          {labels.map((l, i) => <span key={i} style={{ fontSize: 10, color: "#aaa" }}>{l}</span>)}
        </div>
      )}
    </div>
  );
}

// ── Bar chart ──
function BarChart({ data, height = 100 }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data.map(d => Math.abs(d.val)), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ width: "100%", borderRadius: "4px 4px 0 0", background: d.val >= 0 ? ACCENT : "#F04E4E", opacity: 0.85, height: `${Math.max(4, (Math.abs(d.val)/max) * (height - 22))}px`, transition: "height 0.4s" }} />
          <span style={{ fontSize: 9, color: "#aaa" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Donut ──
function Donut({ segs, size = 120 }) {
  const total = segs.reduce((s, x) => s + x.val, 0);
  if (!total) return <div style={{ width: size, height: size, borderRadius: "50%", background: "#eee", margin: "auto" }} />;
  const r = 46, cx = 60, cy = 60, circ = 2 * Math.PI * r;
  let off = 0;
  const slices = segs.map(s => {
    const pct = s.val / total;
    const style = { strokeDasharray: `${pct*circ} ${circ-pct*circ}`, strokeDashoffset: -off*circ, stroke: s.color };
    off += pct;
    return { ...s, style };
  });
  return (
    <svg viewBox="0 0 120 120" style={{ width: size, height: size }}>
      {slices.map((s, i) => <circle key={i} cx={cx} cy={cy} r={r} fill="none" strokeWidth="20" style={{ ...s.style, transition: "all 0.5s" }} transform="rotate(-90 60 60)" />)}
      <circle cx={cx} cy={cy} r={r-14} fill="white" />
    </svg>
  );
}

// ── Toggle ──
function Toggle({ on, onChange }) {
  return (
    <div onClick={() => onChange(!on)} style={{ width: 44, height: 26, borderRadius: 13, cursor: "pointer", position: "relative", background: on ? ACCENT : "#ddd", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
    </div>
  );
}

export default function App() {
  const [entries, setEntries] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("dashboard");
  const [chartType, setChartType] = useState("linie");
  const [period, setPeriod] = useState("monat");
  const [catFilter, setCatFilter] = useState("alle");
  const [monthFilter, setMonthFilter] = useState("alle");
  const [editId, setEditId] = useState(null);
  const [importModal, setImportModal] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [newGoal, setNewGoal] = useState({ name: "", ziel: "" });

  const emptyForm = { name: "", betrag: "", datum: heute(), kategorie: "lebensmittel", typ: "ausgabe", notiz: "", wiederkehrend: false };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [tx, rec, gz] = await Promise.all([
        sb("/eintraege?select=*&order=datum.desc"),
        sb("/wiederkehrend?select=*"),
        sb("/sparziele?select=*"),
      ]);
      setEntries(tx || []);
      setRecurring(rec || []);
      setGoals(gz || []);
    } catch(e) { setError("Ladefehler: " + e.message); }
    setLoading(false);
  }

  async function save() {
    if (!form.name || !form.betrag) return;
    const d = { name: form.name, betrag: parseFloat(form.betrag), datum: form.datum, kategorie: form.kategorie, typ: form.typ, notiz: form.notiz };
    try {
      if (editId) {
        await sb(`/eintraege?id=eq.${editId}`, { method: "PATCH", body: JSON.stringify(d) });
      } else {
        await sb("/eintraege", { method: "POST", body: JSON.stringify(d) });
        if (form.wiederkehrend) await sb("/wiederkehrend", { method: "POST", body: JSON.stringify(d) });
      }
      await load();
    } catch(e) { setError("Speicherfehler: " + e.message); }
    setEditId(null); setForm(emptyForm); setView("dashboard");
  }

  async function del(id) {
    if (!confirm("Eintrag löschen?")) return;
    try { await sb(`/eintraege?id=eq.${id}`, { method: "DELETE", prefer: "" }); await load(); }
    catch(e) { setError(e.message); }
  }

  async function bookRec(r) {
    try {
      await sb("/eintraege", { method: "POST", body: JSON.stringify({ name: r.name, betrag: r.betrag, datum: heute(), kategorie: r.kategorie, typ: r.typ, notiz: r.notiz || "" }) });
      await load();
    } catch(e) { setError(e.message); }
  }

  async function saveGoal() {
    if (!newGoal.name || !newGoal.ziel) return;
    try {
      await sb("/sparziele", { method: "POST", body: JSON.stringify({ name: newGoal.name, ziel: parseFloat(newGoal.ziel), aktuell: 0, farbe: ACCENT }) });
      await load();
    } catch(e) { setError(e.message); }
    setNewGoal({ name: "", ziel: "" });
  }

  function editEntry(e) {
    setForm({ name: e.name, betrag: String(e.betrag), datum: e.datum, kategorie: e.kategorie, typ: e.typ, notiz: e.notiz || "", wiederkehrend: false });
    setEditId(e.id); setView("hinzufügen");
  }

  function notionImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImportMsg("Lese Datei...");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const lines = ev.target.result.split("\n").filter(Boolean);
        const headers = lines[0].split(",").map(h => h.trim().replace(/"/g,"").toLowerCase());
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(",").map(v => v.trim().replace(/"/g,""));
          const row = Object.fromEntries(headers.map((h,j) => [h, vals[j]||""]));
          const name = row["name"]||row["titel"]||row["title"]||"";
          const raw = row["betrag"]||row["amount"]||"0";
          const betrag = parseFloat(raw.replace(",",".").replace(/[^0-9.-]/g,""));
          if (!name || isNaN(betrag)) continue;
          await sb("/eintraege", { method: "POST", body: JSON.stringify({ name, betrag: Math.abs(betrag), datum: (row["datum"]||heute()).slice(0,10), kategorie: "sonstiges", typ: betrag >= 0 ? "einnahme" : "ausgabe", notiz: "Notion Import" }) });
          count++;
        }
        await load();
        setImportMsg(`✓ ${count} Einträge importiert`);
        setTimeout(() => { setImportModal(false); setImportMsg(""); }, 2000);
      } catch(err) { setImportMsg("Fehler: " + err.message); }
    };
    reader.readAsText(file);
  }

  const periodOptions = useMemo(() => {
    const years = [...new Set(entries.map(e => e.datum?.slice(0,4)).filter(Boolean))].sort();
    const opts = [
      { id: "heute", label: "Heute" },
      { id: "monat", label: "Dieser Monat" },
      { id: "3monate", label: "3 Monate" },
      { id: "jahr", label: "Dieses Jahr" },
    ];
    years.forEach(y => { if (!opts.find(o => o.id === `jahr_${y}`)) opts.push({ id: `jahr_${y}`, label: `Jahr ${y}` }); });
    return opts;
  }, [entries]);

  const chartData = useMemo(() => {
    const now = new Date();
    const base = entries.filter(e => e.kategorie !== "sparen");
    const net = list => list.reduce((s,e) => s + (e.typ === "einnahme" ? e.betrag : -e.betrag), 0);
    if (period === "heute") {
      const v = net(base.filter(e => e.datum === heute()));
      return { pts: [0, v], labels: ["Start","Heute"], bars: [{ label:"Heute", val:v }] };
    }
    if (period === "monat") {
      const days = Array.from({length:7},(_,i) => { const d=new Date(now); d.setDate(now.getDate()-(6-i)); return d.toISOString().slice(0,10); });
      const pts = days.map(t => net(base.filter(e => e.datum === t)));
      return { pts, labels: days.map(t=>t.slice(8)), bars: days.map((t,i)=>({label:t.slice(8),val:pts[i]})) };
    }
    if (period === "3monate") {
      const months = Array.from({length:3},(_,i) => { const d=new Date(now.getFullYear(),now.getMonth()-(2-i),1); return {m:d.getMonth(),y:d.getFullYear(),label:MONATE[d.getMonth()]}; });
      const pts = months.map(({m,y}) => net(base.filter(e => { const d=new Date(e.datum); return d.getMonth()===m&&d.getFullYear()===y; })));
      return { pts, labels: months.map(m=>m.label), bars: months.map((m,i)=>({label:m.label,val:pts[i]})) };
    }
    const yr = period === "jahr" ? now.getFullYear() : parseInt(period.replace("jahr_",""));
    const pts = MONATE.map((_,m) => net(base.filter(e => { const d=new Date(e.datum); return d.getMonth()===m&&d.getFullYear()===yr; })));
    return { pts, labels: MONATE, bars: MONATE.map((l,i)=>({label:l,val:pts[i]})) };
  }, [entries, period]);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = entries.filter(e => { const d=new Date(e.datum); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); });
    const einnahmen = thisMonth.filter(e=>e.typ==="einnahme"&&e.kategorie!=="sparen").reduce((s,e)=>s+e.betrag,0);
    const ausgaben  = thisMonth.filter(e=>e.typ==="ausgabe" &&e.kategorie!=="sparen").reduce((s,e)=>s+e.betrag,0);
    const gespart   = thisMonth.filter(e=>e.kategorie==="sparen").reduce((s,e)=>s+e.betrag,0);
    const saldo     = entries.reduce((s,e)=>s+(e.kategorie==="sparen"?0:e.typ==="einnahme"?e.betrag:-e.betrag),0);
    const sparGes   = entries.filter(e=>e.kategorie==="sparen").reduce((s,e)=>s+e.betrag,0);
    const katBreak  = KATEGORIEN.filter(k=>k.id!=="einnahme").map(k=>({...k, val:thisMonth.filter(e=>e.kategorie===k.id&&e.typ==="ausgabe").reduce((s,e)=>s+e.betrag,0)})).filter(k=>k.val>0);
    const sparVerlauf = Array.from({length:6},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-(5-i),1);const m=d.getMonth(),y=d.getFullYear();return{label:MONATE[m],val:entries.filter(e=>e.kategorie==="sparen"&&new Date(e.datum).getMonth()===m&&new Date(e.datum).getFullYear()===y).reduce((s,e)=>s+e.betrag,0)};});
    return { einnahmen, ausgaben, gespart, saldo, sparGes, katBreak, sparVerlauf };
  }, [entries]);

  const filtered = useMemo(() => entries.filter(e => {
    const catOk = catFilter === "alle" || e.kategorie === catFilter;
    const mIdx = parseInt(e.datum?.split("-")[1]) - 1;
    return catOk && (monthFilter === "alle" || MONATE[mIdx] === monthFilter);
  }), [entries, catFilter, monthFilter]);

  // ── Design tokens ──
  const BG = "#F5F5F0";
  const CARD = { background: "white", borderRadius: 20, padding: "18px 20px" };
  const CARD_ACCENT = { background: ACCENT, borderRadius: 20, padding: "18px 20px" };
  const P = 20;
  const lbl = { fontSize: 11, color: "#aaa", marginBottom: 8, display: "block", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 };
  const inp = { background: "#F5F5F0", border: "none", borderRadius: 14, padding: "15px 18px", color: "#1a1a1a", fontSize: 16, width: "100%", outline: "none" };
  const fmtE = n => `€${Math.abs(n).toLocaleString("de-DE",{minimumFractionDigits:2})}`;

  return (
    <>
      <style>{CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      <div style={{ minHeight:"100vh", background:BG, color:"#1a1a1a", fontFamily:"'Inter',sans-serif", maxWidth:480, margin:"0 auto", paddingBottom:88 }}>

        {/* Error */}
        {error && <div onClick={()=>setError(null)} style={{ position:"fixed", top:16, left:P, right:P, background:"#E8534E", color:"white", padding:"13px 18px", borderRadius:14, fontSize:14, zIndex:999, cursor:"pointer", textAlign:"center", maxWidth:440, margin:"0 auto" }}>{error}</div>}

        {/* Import modal */}
        {importModal && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:16 }}>
            <div style={{ background:"white", borderRadius:24, padding:28, width:"100%", maxWidth:440 }}>
              <div style={{ fontSize:20, fontWeight:700, marginBottom:6 }}>Notion Import</div>
              <div style={{ fontSize:14, color:"#888", marginBottom:22, lineHeight:1.6 }}>Exportiere deine Notion-Datenbank als CSV. Die Spalten Name, Betrag und Datum werden erkannt.</div>
              <label style={{ display:"block", background:BG, borderRadius:14, padding:16, textAlign:"center", cursor:"pointer", fontSize:15, marginBottom:12, fontWeight:500 }}>
                📂 CSV-Datei wählen
                <input type="file" accept=".csv" style={{ display:"none" }} onChange={notionImport} />
              </label>
              {importMsg && <div style={{ fontSize:14, color:importMsg.startsWith("✓")?"#2DBD6E":"#E8534E", textAlign:"center", marginBottom:12 }}>{importMsg}</div>}
              <button onClick={()=>setImportModal(false)} style={{ width:"100%", background:BG, border:"none", borderRadius:14, padding:14, color:"#888", fontSize:15, cursor:"pointer" }}>Abbrechen</button>
            </div>
          </div>
        )}

        {/* ═══════════════ DASHBOARD ═══════════════ */}
        {view === "dashboard" && (
          <>
            {/* Header */}
            <div style={{ padding:`54px ${P}px 20px`, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:13, color:"#aaa", marginBottom:2 }}>Haushaltskasse</div>
                <div style={{ fontSize:30, fontWeight:800, letterSpacing:"-0.03em" }}>Übersicht</div>
              </div>
              <div style={{ display:"flex", gap:10, marginTop:4 }}>
                <button onClick={()=>setImportModal(true)} style={{ width:42, height:42, borderRadius:"50%", background:"white", border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:18, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>📥</button>
                <button onClick={()=>{ setEditId(null); setForm(emptyForm); setView("hinzufügen"); }} style={{ width:42, height:42, borderRadius:"50%", background:ACCENT, border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:26, color:"white", lineHeight:1, boxShadow:`0 4px 14px ${ACCENT}55` }}>+</button>
              </div>
            </div>

            <div style={{ padding:`0 ${P}px`, display:"flex", flexDirection:"column", gap:14 }}>

              {/* Saldo-Karte */}
              <div style={{ ...CARD_ACCENT, padding:"26px 24px" }}>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.65)", marginBottom:6 }}>Gesamtsaldo</div>
                <div style={{ fontSize:46, fontWeight:800, color:"white", letterSpacing:"-0.04em", lineHeight:1, fontVariantNumeric:"tabular-nums" }}>
                  {stats.saldo < 0 ? "−" : ""}€{Math.abs(stats.saldo).toLocaleString("de-DE",{minimumFractionDigits:2})}
                </div>
                <div style={{ display:"flex", marginTop:22, gap:0 }}>
                  {[["↑ EINNAHMEN",stats.einnahmen],["↓ AUSGABEN",stats.ausgaben],["→ GESPART",stats.gespart]].map(([l,v],i)=>(
                    <div key={i} style={{ flex:1, borderRight:i<2?"1px solid rgba(255,255,255,0.2)":"none", paddingRight:12, paddingLeft:i>0?12:0 }}>
                      <div style={{ fontSize:10, color:"rgba(255,255,255,0.6)", letterSpacing:"0.06em", marginBottom:4 }}>{l}</div>
                      <div style={{ fontSize:15, fontWeight:700, color:"white", fontVariantNumeric:"tabular-nums" }}>{fmtE(v)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart-Karte */}
              <div style={CARD}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <div style={{ display:"flex", gap:6 }}>
                    {[["linie","〜"],["balken","▌"],["donut","◉"]].map(([t,ic])=>(
                      <button key={t} onClick={()=>setChartType(t)} style={{ padding:"6px 12px", borderRadius:30, fontSize:12, cursor:"pointer", border:"none", fontWeight:chartType===t?600:400, background:chartType===t?ACCENT:"#F0F0EC", color:chartType===t?"white":"#888" }}>{ic} {t}</button>
                    ))}
                  </div>
                  <div style={{ position:"relative" }}>
                    <select value={period} onChange={e=>setPeriod(e.target.value)} style={{ background:"#F0F0EC", border:"none", borderRadius:10, padding:"7px 28px 7px 12px", color:"#1a1a1a", fontSize:12, cursor:"pointer", outline:"none", fontWeight:500 }}>
                      {periodOptions.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                    <span style={{ position:"absolute", right:9, top:"50%", transform:"translateY(-50%)", color:"#888", fontSize:10, pointerEvents:"none" }}>▾</span>
                  </div>
                </div>
                {chartType==="linie" && <SparkLine data={chartData.pts} labels={chartData.labels} />}
                {chartType==="balken" && <BarChart data={chartData.bars} />}
                {chartType==="donut" && (
                  <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                    <Donut segs={stats.katBreak.map(k=>({val:k.val,color:k.farbe}))} size={110} />
                    <div style={{ flex:1 }}>
                      {stats.katBreak.slice(0,5).map(k=>(
                        <div key={k.id} style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:7 }}><div style={{ width:8, height:8, borderRadius:"50%", background:k.farbe }} /><span style={{ fontSize:12, color:"#666" }}>{k.label}</span></div>
                          <span style={{ fontSize:12, fontWeight:600, color:"#1a1a1a", fontVariantNumeric:"tabular-nums" }}>{fmtE(k.val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Wiederkehrend fällig */}
              {recurring.length > 0 && (
                <div>
                  <div style={{ fontSize:12, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10, fontWeight:500 }}>Monatlich fällig</div>
                  {recurring.map(r=>(
                    <div key={r.id} style={{ ...CARD, marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px" }}>
                      <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                        <div style={{ width:42, height:42, borderRadius:13, background:`${KAT_MAP[r.kategorie]?.farbe||"#999"}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{KAT_MAP[r.kategorie]?.icon}</div>
                        <div>
                          <div style={{ fontSize:15, fontWeight:600 }}>{r.name}</div>
                          <div style={{ fontSize:12, color:"#aaa" }}>monatlich</div>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                        <span style={{ fontSize:15, fontWeight:700, color:ACCENT, fontVariantNumeric:"tabular-nums" }}>{fmtE(r.betrag)}</span>
                        <button onClick={()=>bookRec(r)} style={{ background:`${ACCENT}18`, border:"none", color:ACCENT, borderRadius:10, padding:"6px 12px", fontSize:12, cursor:"pointer", fontWeight:600 }}>Buchen</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Letzte Einträge */}
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ fontSize:12, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.07em", fontWeight:500 }}>Zuletzt</div>
                  <button onClick={()=>setView("einträge")} style={{ fontSize:13, color:ACCENT, background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>Alle →</button>
                </div>
                {loading && <div style={{ textAlign:"center", color:"#bbb", padding:30, fontSize:14 }}>Lädt...</div>}
                {entries.slice(0,6).map(e=>(
                  <div key={e.id} style={{ ...CARD, marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px" }}>
                    <div style={{ display:"flex", gap:12, alignItems:"center", minWidth:0 }}>
                      <div style={{ width:42, height:42, flexShrink:0, borderRadius:13, background:`${KAT_MAP[e.kategorie]?.farbe||"#999"}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{KAT_MAP[e.kategorie]?.icon}</div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:15, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.name}</div>
                        <div style={{ fontSize:12, color:"#aaa" }}>{datumFmt(e.datum)}</div>
                      </div>
                    </div>
                    <span style={{ fontSize:15, fontWeight:700, flexShrink:0, marginLeft:12, fontVariantNumeric:"tabular-nums", color:e.kategorie==="sparen"?"#2DBD6E":e.typ==="einnahme"?"#2DBD6E":"#E8534E" }}>
                      {e.kategorie==="sparen"?"→":e.typ==="einnahme"?"+":"−"}{fmtE(e.betrag)}
                    </span>
                  </div>
                ))}
                {!loading && entries.length===0 && <div style={{ textAlign:"center", color:"#bbb", padding:30, fontSize:14 }}>Noch keine Einträge. Tippe + um zu beginnen.</div>}
              </div>
            </div>
          </>
        )}

        {/* ═══════════════ HINZUFÜGEN ═══════════════ */}
        {view === "hinzufügen" && (
          <>
            <div style={{ padding:`54px ${P}px 20px`, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:13, color:"#aaa", marginBottom:2 }}>Haushaltskasse</div>
                <div style={{ fontSize:30, fontWeight:800, letterSpacing:"-0.03em" }}>{editId ? "Bearbeiten" : "Neu"}</div>
              </div>
            </div>
            <div style={{ padding:`0 ${P}px`, display:"flex", flexDirection:"column", gap:14 }}>
              {/* Typ */}
              <div style={{ display:"flex", gap:8 }}>
                {[["ausgabe","↓ Ausgabe"],["einnahme","↑ Einnahme"],["sparen","→ Sparen"]].map(([t,l])=>(
                  <button key={t} onClick={()=>setForm(f=>({...f,typ:t,kategorie:t==="sparen"?"sparen":t==="einnahme"?"einnahme":f.kategorie}))}
                    style={{ flex:1, padding:"13px 8px", borderRadius:14, fontSize:13, cursor:"pointer", border:"none", fontWeight:600, background:form.typ===t?ACCENT:"white", color:form.typ===t?"white":"#aaa" }}>{l}
                  </button>
                ))}
              </div>

              {/* Felder */}
              <div style={CARD}>
                {[{label:"Name",key:"name",placeholder:"z.B. Netflix",type:"text"},{label:"Betrag (€)",key:"betrag",placeholder:"0,00",type:"number"},{label:"Datum",key:"datum",type:"date"}].map((f,i)=>(
                  <div key={f.key} style={{ marginBottom:i<2?16:0 }}>
                    <label style={lbl}>{f.label}</label>
                    <input style={inp} type={f.type} placeholder={f.placeholder||""} value={form[f.key]} onChange={e=>setForm(ff=>({...ff,[f.key]:e.target.value}))} step={f.key==="betrag"?"0.01":undefined} />
                  </div>
                ))}
              </div>

              {/* Kategorien */}
              {form.typ !== "sparen" && (
                <div style={CARD}>
                  <label style={lbl}>Kategorie</label>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                    {KATEGORIEN.filter(k=>form.typ==="einnahme"?k.id==="einnahme"||k.id==="sonstiges":k.id!=="einnahme").map(k=>(
                      <div key={k.id} onClick={()=>setForm(f=>({...f,kategorie:k.id}))}
                        style={{ background:form.kategorie===k.id?`${k.farbe}18`:BG, border:`1.5px solid ${form.kategorie===k.id?k.farbe:"transparent"}`, borderRadius:14, padding:"12px 6px", textAlign:"center", cursor:"pointer", transition:"all 0.15s" }}>
                        <div style={{ fontSize:22 }}>{k.icon}</div>
                        <div style={{ fontSize:10, color:"#888", marginTop:4, fontWeight:500 }}>{k.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notiz */}
              <div style={CARD}>
                <label style={lbl}>Notiz (optional)</label>
                <input style={inp} placeholder="..." value={form.notiz} onChange={e=>setForm(f=>({...f,notiz:e.target.value}))} />
              </div>

              {/* Wiederkehrend toggle */}
              {!editId && form.typ !== "sparen" && (
                <div style={{ ...CARD, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:15, fontWeight:500 }}>Monatlich wiederkehrend</span>
                  <Toggle on={form.wiederkehrend} onChange={v=>setForm(f=>({...f,wiederkehrend:v}))} />
                </div>
              )}

              <button onClick={save} style={{ background:ACCENT, border:"none", borderRadius:16, padding:18, fontSize:17, fontWeight:700, color:"white", cursor:"pointer", boxShadow:`0 4px 16px ${ACCENT}44` }}>
                {editId ? "Änderungen speichern" : "Hinzufügen"}
              </button>
              <button onClick={()=>{ setView("dashboard"); setEditId(null); }} style={{ background:"white", border:"none", borderRadius:16, padding:15, fontSize:15, color:"#aaa", cursor:"pointer" }}>Abbrechen</button>
            </div>
          </>
        )}

        {/* ═══════════════ EINTRÄGE ═══════════════ */}
        {view === "einträge" && (
          <>
            <div style={{ padding:`54px ${P}px 20px`, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:13, color:"#aaa", marginBottom:2 }}>Haushaltskasse</div>
                <div style={{ fontSize:30, fontWeight:800, letterSpacing:"-0.03em" }}>Einträge</div>
              </div>
              <button onClick={()=>{ setEditId(null); setForm(emptyForm); setView("hinzufügen"); }} style={{ width:42, height:42, marginTop:4, borderRadius:"50%", background:ACCENT, border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:26, color:"white", lineHeight:1, boxShadow:`0 4px 14px ${ACCENT}55` }}>+</button>
            </div>
            <div style={{ padding:`0 ${P}px`, display:"flex", flexDirection:"column", gap:14 }}>
              <div style={CARD}>
                <label style={lbl}>Kategorie</label>
                <FRow>
                  <button onClick={()=>setCatFilter("alle")} style={{ flexShrink:0, padding:"8px 16px", borderRadius:30, fontSize:13, cursor:"pointer", border:"none", fontWeight:catFilter==="alle"?600:400, background:catFilter==="alle"?ACCENT:"#F0F0EC", color:catFilter==="alle"?"white":"#888" }}>Alle</button>
                  {ALLE_KAT.map(k=>(
                    <button key={k.id} onClick={()=>setCatFilter(k.id)} style={{ flexShrink:0, padding:"8px 16px", borderRadius:30, fontSize:13, cursor:"pointer", border:"none", fontWeight:catFilter===k.id?600:400, background:catFilter===k.id?k.farbe:"#F0F0EC", color:catFilter===k.id?"white":"#888", whiteSpace:"nowrap" }}>{k.icon} {k.label}</button>
                  ))}
                </FRow>
                <div style={{ marginTop:14 }}>
                  <label style={lbl}>Monat</label>
                  <FRow>
                    <button onClick={()=>setMonthFilter("alle")} style={{ flexShrink:0, padding:"8px 16px", borderRadius:30, fontSize:13, cursor:"pointer", border:"none", fontWeight:monthFilter==="alle"?600:400, background:monthFilter==="alle"?ACCENT:"#F0F0EC", color:monthFilter==="alle"?"white":"#888" }}>Alle</button>
                    {MONATE.map(m=>(
                      <button key={m} onClick={()=>setMonthFilter(m)} style={{ flexShrink:0, padding:"8px 16px", borderRadius:30, fontSize:13, cursor:"pointer", border:"none", fontWeight:monthFilter===m?600:400, background:monthFilter===m?ACCENT:"#F0F0EC", color:monthFilter===m?"white":"#888", whiteSpace:"nowrap" }}>{m}</button>
                    ))}
                  </FRow>
                </div>
              </div>

              <div style={{ fontSize:13, color:"#aaa" }}>
                {filtered.length} Einträge · Saldo: <span style={{ color:ACCENT, fontWeight:600 }}>
                  {filtered.reduce((s,e)=>s+(e.kategorie==="sparen"?0:e.typ==="einnahme"?e.betrag:-e.betrag),0)<0?"−":"+"}
                  {fmtE(Math.abs(filtered.reduce((s,e)=>s+(e.kategorie==="sparen"?0:e.typ==="einnahme"?e.betrag:-e.betrag),0)))}
                </span>
              </div>

              {filtered.map(e=>(
                <div key={e.id} style={{ ...CARD, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px" }}>
                  <div style={{ display:"flex", gap:12, alignItems:"center", minWidth:0, flex:1 }}>
                    <div style={{ width:42, height:42, flexShrink:0, borderRadius:13, background:`${KAT_MAP[e.kategorie]?.farbe||"#999"}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{KAT_MAP[e.kategorie]?.icon}</div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:15, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.name}</div>
                      <div style={{ fontSize:12, color:"#aaa" }}>{datumFmt(e.datum)} · {KAT_MAP[e.kategorie]?.label}</div>
                      {e.notiz&&<div style={{ fontSize:12, color:"#bbb", marginTop:2 }}>{e.notiz}</div>}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8, flexShrink:0, marginLeft:12 }}>
                    <span style={{ fontSize:15, fontWeight:700, fontVariantNumeric:"tabular-nums", color:e.kategorie==="sparen"?"#2DBD6E":e.typ==="einnahme"?"#2DBD6E":"#E8534E" }}>
                      {e.kategorie==="sparen"?"→":e.typ==="einnahme"?"+":"−"}{fmtE(e.betrag)}
                    </span>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={()=>editEntry(e)} style={{ fontSize:12, background:"#F0F0EC", border:"none", color:"#888", borderRadius:8, padding:"4px 10px", cursor:"pointer" }}>✏</button>
                      <button onClick={()=>del(e.id)} style={{ fontSize:12, background:"#FEE8E8", border:"none", color:"#E8534E", borderRadius:8, padding:"4px 10px", cursor:"pointer" }}>✕</button>
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length===0 && <div style={{ textAlign:"center", color:"#bbb", padding:40, fontSize:14 }}>Keine Einträge gefunden.</div>}
            </div>
          </>
        )}

        {/* ═══════════════ SPAREN ═══════════════ */}
        {view === "sparen" && (
          <>
            <div style={{ padding:`54px ${P}px 20px` }}>
              <div style={{ fontSize:13, color:"#aaa", marginBottom:2 }}>Haushaltskasse</div>
              <div style={{ fontSize:30, fontWeight:800, letterSpacing:"-0.03em" }}>Sparen</div>
            </div>
            <div style={{ padding:`0 ${P}px`, display:"flex", flexDirection:"column", gap:14 }}>
              {/* Spar-Saldo */}
              <div style={{ background:"#1a1a2e", borderRadius:20, padding:"26px 24px" }}>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", marginBottom:6 }}>Gesamt gespart</div>
                <div style={{ fontSize:44, fontWeight:800, color:"white", letterSpacing:"-0.04em", fontVariantNumeric:"tabular-nums" }}>
                  {fmtE(stats.sparGes)}
                </div>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)", marginTop:8 }}>Diesen Monat: {fmtE(stats.gespart)}</div>
              </div>

              {/* Sparverlauf */}
              <div style={CARD}>
                <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Verlauf</div>
                <SparkLine data={stats.sparVerlauf.map(m=>m.val)} labels={stats.sparVerlauf.map(m=>m.label)} color="#2DBD6E" />
              </div>

              {/* Sparziele */}
              {goals.length > 0 && (
                <div>
                  <div style={{ fontSize:12, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10, fontWeight:500 }}>Sparziele</div>
                  {goals.map(g=>{
                    const pct = Math.min(100,((g.aktuell||0)/g.ziel)*100);
                    return (
                      <div key={g.id} style={{ ...CARD, marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                          <div style={{ fontSize:15, fontWeight:600 }}>{g.name}</div>
                          <span style={{ fontSize:13, color:ACCENT, fontVariantNumeric:"tabular-nums", fontWeight:600 }}>{Math.round(pct)}%</span>
                        </div>
                        <div style={{ background:"#F0F0EC", borderRadius:6, height:8, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${pct}%`, background:ACCENT, borderRadius:6, transition:"width 0.5s" }} />
                        </div>
                        <div style={{ display:"flex", justifyContent:"space-between", marginTop:8 }}>
                          <span style={{ fontSize:12, color:"#aaa" }}>{fmtE(g.aktuell||0)} gespart</span>
                          <span style={{ fontSize:12, color:"#aaa" }}>Ziel: {fmtE(g.ziel)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Neues Ziel */}
              <div style={CARD}>
                <div style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>Neues Sparziel</div>
                <div style={{ marginBottom:12 }}>
                  <label style={lbl}>Name</label>
                  <input style={inp} placeholder="z.B. Urlaub" value={newGoal.name} onChange={e=>setNewGoal(s=>({...s,name:e.target.value}))} />
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={lbl}>Zielbetrag (€)</label>
                  <input style={inp} placeholder="0,00" type="number" value={newGoal.ziel} onChange={e=>setNewGoal(s=>({...s,ziel:e.target.value}))} />
                </div>
                <button onClick={saveGoal} style={{ width:"100%", background:ACCENT, border:"none", borderRadius:14, padding:15, fontSize:15, fontWeight:700, color:"white", cursor:"pointer" }}>Anlegen</button>
              </div>

              {/* Buchungen */}
              <div>
                <div style={{ fontSize:12, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10, fontWeight:500 }}>Buchungen</div>
                {entries.filter(e=>e.kategorie==="sparen").slice(0,8).map(e=>(
                  <div key={e.id} style={{ ...CARD, marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px" }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:600 }}>{e.name}</div>
                      <div style={{ fontSize:12, color:"#aaa" }}>{datumFmt(e.datum)}</div>
                    </div>
                    <span style={{ fontSize:15, fontWeight:700, color:"#2DBD6E", fontVariantNumeric:"tabular-nums" }}>→ {fmtE(e.betrag)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ═══════════════ MONATLICH ═══════════════ */}
        {view === "wiederkehrend" && (
          <>
            <div style={{ padding:`54px ${P}px 20px` }}>
              <div style={{ fontSize:13, color:"#aaa", marginBottom:2 }}>Haushaltskasse</div>
              <div style={{ fontSize:30, fontWeight:800, letterSpacing:"-0.03em" }}>Monatlich</div>
            </div>
            <div style={{ padding:`0 ${P}px`, display:"flex", flexDirection:"column", gap:10 }}>
              {recurring.length===0 && <div style={{ textAlign:"center", color:"#bbb", padding:40, fontSize:14 }}>Noch keine Vorlagen.<br/>Aktiviere "Monatlich wiederkehrend" beim Erfassen.</div>}
              {recurring.map(r=>(
                <div key={r.id} style={{ ...CARD, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 18px" }}>
                  <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                    <div style={{ width:44, height:44, borderRadius:14, background:`${KAT_MAP[r.kategorie]?.farbe||"#999"}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:21 }}>{KAT_MAP[r.kategorie]?.icon}</div>
                    <div>
                      <div style={{ fontSize:15, fontWeight:600 }}>{r.name}</div>
                      <div style={{ fontSize:12, color:"#aaa" }}>{KAT_MAP[r.kategorie]?.label} · {r.typ}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
                    <span style={{ fontSize:15, fontWeight:700, color:ACCENT, fontVariantNumeric:"tabular-nums" }}>{fmtE(r.betrag)}</span>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={()=>bookRec(r)} style={{ background:`${ACCENT}18`, border:"none", color:ACCENT, borderRadius:9, padding:"5px 12px", fontSize:12, cursor:"pointer", fontWeight:600 }}>Buchen</button>
                      <button onClick={async()=>{ if(!confirm("Löschen?"))return; try{await sb(`/wiederkehrend?id=eq.${r.id}`,{method:"DELETE",prefer:""});await load();}catch(e){setError(e.message);} }} style={{ background:"#FEE8E8", border:"none", color:"#E8534E", borderRadius:9, padding:"5px 10px", fontSize:12, cursor:"pointer" }}>✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ═══════════════ NAVIGATION ═══════════════ */}
        <nav style={{ position:"fixed", bottom:0, left:0, right:0, background:"white", borderTop:"1px solid #EBEBEB", display:"flex", padding:"10px 0 24px", zIndex:100, maxWidth:480, margin:"0 auto", boxShadow:"0 -4px 20px rgba(0,0,0,0.06)" }}>
          {[
            { id:"dashboard",    icon:"⬡", label:"Übersicht" },
            { id:"einträge",     icon:"↕", label:"Einträge"  },
            { id:"sparen",       icon:"🏦", label:"Sparen"    },
            { id:"wiederkehrend",icon:"↺", label:"Monatlich" },
          ].map(n=>(
            <div key={n.id} onClick={()=>setView(n.id)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, cursor:"pointer", color:view===n.id?ACCENT:"#bbb", transition:"color 0.2s" }}>
              <span style={{ fontSize:22 }}>{n.icon}</span>
              <span style={{ fontSize:11, fontWeight:600 }}>{n.label}</span>
            </div>
          ))}
        </nav>
      </div>
    </>
  );
}
