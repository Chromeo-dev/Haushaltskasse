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

const KATEGORIEN = [
  { id: "wohnen",       label: "Wohnen",       icon: "🏠", farbe: "#E8845C" },
  { id: "lebensmittel", label: "Lebensmittel", icon: "🛒", farbe: "#E8B45C" },
  { id: "transport",    label: "Transport",    icon: "🚗", farbe: "#5C84E8" },
  { id: "gesundheit",   label: "Gesundheit",   icon: "💊", farbe: "#5CC4E8" },
  { id: "freizeit",     label: "Freizeit",     icon: "🎬", farbe: "#A05CE8" },
  { id: "einnahme",     label: "Einnahme",     icon: "💰", farbe: "#5CE88A" },
  { id: "sonstiges",    label: "Sonstiges",    icon: "📦", farbe: "#999" },
];
const SPAR_KAT = { id: "sparen", label: "Sparen", icon: "🏦", farbe: "#5CE8D4" };
const ALLE_KAT = [...KATEGORIEN, SPAR_KAT];
const KAT_MAP = Object.fromEntries(ALLE_KAT.map(c => [c.id, c]));
const MONATE = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

function datumFmt(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
function heute() { return new Date().toISOString().slice(0, 10); }

const G = `
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
  body{background:#111;overflow-x:hidden}
  .noscroll{overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch}
  .noscroll::-webkit-scrollbar{display:none}
  select{-webkit-appearance:none;appearance:none}
`;

function FadeRow({ children }) {
  return (
    <div style={{ position: "relative" }}>
      <div className="noscroll" style={{ display: "flex", gap: 8, paddingBottom: 0 }}>
        {children}
      </div>
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 48, background: "linear-gradient(to right, transparent, #111)", pointerEvents: "none" }} />
    </div>
  );
}

function Chip({ active, color, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, padding: "9px 16px", borderRadius: 30, fontSize: 13,
      cursor: "pointer", border: "none", fontFamily: "inherit", fontWeight: active ? 600 : 400,
      background: active ? (color || "#E8845C") : "rgba(255,255,255,0.07)",
      color: active ? (color && color !== "#E8845C" ? "#111" : "#fff") : "#777",
      transition: "all 0.15s",
    }}>{children}</button>
  );
}

function SparkLine({ data, labels, color = "#E8845C", height = 110 }) {
  if (!data || data.length < 2) return (
    <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontSize: 13 }}>Keine Daten</div>
  );
  const W = 320, H = height - 28;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * (W - 20) + 10,
    H - 8 - ((v - min) / range) * (H - 20)
  ]);
  const pathD = "M " + pts.map(p => p.join(",")).join(" L ");
  const areaD = `M ${pts[0].join(",")} L ${pts.map(p => p.join(",")).join(" L ")} L ${pts[pts.length-1][0]},${H+4} L ${pts[0][0]},${H+4} Z`;
  const gid = "g" + color.replace(/[^a-z0-9]/gi, "");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H+4}`} style={{ width: "100%", height: H }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gid})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill={color} stroke="#111" strokeWidth="2" />)}
      </svg>
      {labels && (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px 0" }}>
          {labels.map((l, i) => <span key={i} style={{ fontSize: 10, color: "#555" }}>{l}</span>)}
        </div>
      )}
    </div>
  );
}

function BarChart({ data, height = 100 }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data.map(d => Math.abs(d.val)), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ width: "100%", borderRadius: "4px 4px 0 0", background: d.val >= 0 ? "#5CE88A" : "#E8845C", opacity: 0.85, height: `${Math.max(4,(Math.abs(d.val)/max)*(height-22))}px`, transition: "height 0.4s" }} />
          <span style={{ fontSize: 9, color: "#555" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function Donut({ segs, size = 120 }) {
  const total = segs.reduce((s, x) => s + x.val, 0);
  if (!total) return <div style={{ width: size, height: size, borderRadius: "50%", background: "#1a1a1a", margin: "auto" }} />;
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
      <circle cx={cx} cy={cy} r={r-14} fill="#111" />
    </svg>
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
  const [savingsMode, setSavingsMode] = useState("ohne");
  const [catFilter, setCatFilter] = useState("alle");
  const [monthFilter, setMonthFilter] = useState("alle");
  const [editId, setEditId] = useState(null);
  const [importModal, setImportModal] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [newGoal, setNewGoal] = useState({ name: "", ziel: "", farbe: "#5CE8D4" });

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
      await sb("/sparziele", { method: "POST", body: JSON.stringify({ name: newGoal.name, ziel: parseFloat(newGoal.ziel), aktuell: 0, farbe: newGoal.farbe }) });
      await load();
    } catch(e) { setError(e.message); }
    setNewGoal({ name: "", ziel: "", farbe: "#5CE8D4" });
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
      { id: "heute",   label: "Heute" },
      { id: "monat",   label: "Dieser Monat" },
      { id: "3monate", label: "3 Monate" },
      { id: "jahr",    label: "Dieses Jahr" },
    ];
    years.forEach(y => { if (!opts.find(o => o.id === `jahr_${y}`)) opts.push({ id: `jahr_${y}`, label: `Jahr ${y}` }); });
    return opts;
  }, [entries]);

  const chartData = useMemo(() => {
    const now = new Date();
    let base = entries.filter(e => e.kategorie !== "sparen");
    const net = (list) => list.reduce((s,e) => s + (e.typ === "einnahme" ? e.betrag : -e.betrag), 0);

    if (period === "heute") {
      const v = net(base.filter(e => e.datum === heute()));
      return { pts: [0, v], labels: ["Start","Heute"], bars: [{ label:"Heute", val:v }] };
    }
    if (period === "monat") {
      const days = Array.from({length:7},(_,i)=>{ const d=new Date(now); d.setDate(now.getDate()-(6-i)); return d.toISOString().slice(0,10); });
      const pts = days.map(t => net(base.filter(e => e.datum === t)));
      return { pts, labels: days.map(t=>t.slice(8)), bars: days.map((t,i)=>({label:t.slice(8),val:pts[i]})) };
    }
    if (period === "3monate") {
      const months = Array.from({length:3},(_,i)=>{ const d=new Date(now.getFullYear(),now.getMonth()-(2-i),1); return {m:d.getMonth(),y:d.getFullYear(),label:MONATE[d.getMonth()]}; });
      const pts = months.map(({m,y}) => net(base.filter(e=>{ const d=new Date(e.datum); return d.getMonth()===m&&d.getFullYear()===y; })));
      return { pts, labels: months.map(m=>m.label), bars: months.map((m,i)=>({label:m.label,val:pts[i]})) };
    }
    if (period === "jahr" || period.startsWith("jahr_")) {
      const yr = period === "jahr" ? now.getFullYear() : parseInt(period.replace("jahr_",""));
      const pts = MONATE.map((_,m) => net(base.filter(e=>{ const d=new Date(e.datum); return d.getMonth()===m&&d.getFullYear()===yr; })));
      return { pts, labels: MONATE, bars: MONATE.map((l,i)=>({label:l,val:pts[i]})) };
    }
    return { pts:[], labels:[], bars:[] };
  }, [entries, period]);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = entries.filter(e=>{ const d=new Date(e.datum); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); });
    const einnahmen = thisMonth.filter(e=>e.typ==="einnahme"&&e.kategorie!=="sparen").reduce((s,e)=>s+e.betrag,0);
    const ausgaben  = thisMonth.filter(e=>e.typ==="ausgabe" &&e.kategorie!=="sparen").reduce((s,e)=>s+e.betrag,0);
    const gespart   = thisMonth.filter(e=>e.kategorie==="sparen").reduce((s,e)=>s+e.betrag,0);
    const saldo     = entries.reduce((s,e)=>s+(e.kategorie==="sparen"?0:e.typ==="einnahme"?e.betrag:-e.betrag),0);
    const sparGes   = entries.filter(e=>e.kategorie==="sparen").reduce((s,e)=>s+e.betrag,0);
    const katBreak  = KATEGORIEN.filter(k=>k.id!=="einnahme").map(k=>({ id:k.id, label:k.label, farbe:k.farbe, val:thisMonth.filter(e=>e.kategorie===k.id&&e.typ==="ausgabe").reduce((s,e)=>s+e.betrag,0) })).filter(k=>k.val>0);
    const sparVerlauf = Array.from({length:6},(_,i)=>{ const d=new Date(now.getFullYear(),now.getMonth()-(5-i),1); const m=d.getMonth(),y=d.getFullYear(); return { label:MONATE[m], val:entries.filter(e=>e.kategorie==="sparen"&&new Date(e.datum).getMonth()===m&&new Date(e.datum).getFullYear()===y).reduce((s,e)=>s+e.betrag,0) }; });
    return { einnahmen, ausgaben, gespart, saldo, sparGes, katBreak, sparVerlauf };
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      const catOk = catFilter === "alle" || e.kategorie === catFilter;
      const mIdx = parseInt(e.datum?.split("-")[1]) - 1;
      const mOk = monthFilter === "alle" || MONATE[mIdx] === monthFilter;
      return catOk && mOk;
    });
  }, [entries, catFilter, monthFilter]);

  const P = 20;
  const card = { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20 };
  const inp = { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:14, padding:"16px 18px", color:"#f0ede8", fontSize:17, width:"100%", outline:"none", fontFamily:"inherit" };
  const lbl = { fontSize:11, color:"#666", marginBottom:8, display:"block", textTransform:"uppercase", letterSpacing:"0.06em" };

  return (
    <>
      <style>{G}</style>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      <div style={{ minHeight:"100vh", background:"#111", color:"#f0ede8", fontFamily:"'Inter',sans-serif", maxWidth:480, margin:"0 auto", paddingBottom:90, position:"relative" }}>

        {/* Blobs */}
        <div style={{ position:"fixed", top:-80, left:"50%", transform:"translateX(-50%)", width:480, height:480, borderRadius:"50%", background:"radial-gradient(circle, rgba(200,100,50,0.22) 0%, transparent 70%)", pointerEvents:"none", zIndex:0 }} />
        <div style={{ position:"fixed", top:"35%", right:-80, width:280, height:280, borderRadius:"50%", background:"radial-gradient(circle, rgba(70,70,190,0.14) 0%, transparent 70%)", pointerEvents:"none", zIndex:0 }} />

        {/* Error */}
        {error && <div onClick={()=>setError(null)} style={{ position:"fixed", top:16, left:P, right:P, background:"#c0392b", color:"#fff", padding:"12px 16px", borderRadius:14, fontSize:14, zIndex:999, cursor:"pointer", textAlign:"center" }}>{error}</div>}

        {/* Import modal */}
        {importModal && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
            <div style={{ background:"#1c1c1c", border:"1px solid rgba(255,255,255,0.1)", borderRadius:24, padding:28, width:"100%", maxWidth:360 }}>
              <div style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>Notion Import</div>
              <div style={{ fontSize:14, color:"#777", marginBottom:24, lineHeight:1.6 }}>Exportiere deine Notion-Datenbank als CSV. Die Spalten Name, Betrag und Datum werden automatisch erkannt.</div>
              <label style={{ display:"block", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:14, padding:14, textAlign:"center", cursor:"pointer", fontSize:15, marginBottom:12 }}>
                📂 CSV-Datei wählen
                <input type="file" accept=".csv" style={{ display:"none" }} onChange={notionImport} />
              </label>
              {importMsg && <div style={{ fontSize:14, color:importMsg.startsWith("✓")?"#5CE88A":"#E8845C", textAlign:"center", marginBottom:12 }}>{importMsg}</div>}
              <button onClick={()=>setImportModal(false)} style={{ width:"100%", background:"transparent", border:"1px solid rgba(255,255,255,0.1)", borderRadius:14, padding:14, color:"#777", fontSize:15, cursor:"pointer", fontFamily:"inherit" }}>Abbrechen</button>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ padding:`54px ${P}px 0`, display:"flex", justifyContent:"space-between", alignItems:"flex-start", position:"relative", zIndex:1 }}>
          <div>
            <div style={{ fontSize:11, color:"#666", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>Haushaltskasse</div>
            <div style={{ fontSize:34, fontWeight:800, letterSpacing:"-0.04em", lineHeight:1 }}>
              {view==="dashboard"?"Übersicht":view==="hinzufügen"?(editId?"Bearbeiten":"Neu"):view==="einträge"?"Einträge":view==="sparen"?"Sparen":"Monatlich"}
            </div>
          </div>
          <div style={{ display:"flex", gap:10, marginTop:6 }}>
            <button onClick={()=>setImportModal(true)} style={{ width:44, height:44, borderRadius:"50%", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:18 }}>📥</button>
            <button onClick={()=>{ setEditId(null); setForm(emptyForm); setView("hinzufügen"); }} style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,#E8845C,#c04070)", border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:26, color:"#fff", lineHeight:1 }}>+</button>
          </div>
        </div>

        {/* ═══ DASHBOARD ═══ */}
        {view === "dashboard" && (
          <div style={{ position:"relative", zIndex:1, padding:`20px ${P}px 0` }}>

            {/* Saldo */}
            <div style={{ background:"linear-gradient(145deg, rgba(232,132,92,0.18), rgba(40,30,50,0.55))", border:"1px solid rgba(232,132,92,0.22)", borderRadius:24, padding:"26px 22px", marginBottom:14 }}>
              <div style={{ fontSize:13, color:"rgba(255,255,255,0.38)", marginBottom:6 }}>Gesamtsaldo</div>
              <div style={{ fontSize:50, fontWeight:800, letterSpacing:"-0.05em", lineHeight:1, color:stats.saldo>=0?"#f0ede8":"#E8845C", fontVariantNumeric:"tabular-nums" }}>
                {stats.saldo<0?"−":""}€{Math.abs(stats.saldo).toLocaleString("de-DE",{minimumFractionDigits:2})}
              </div>
              <div style={{ display:"flex", marginTop:20, paddingTop:16, borderTop:"1px solid rgba(255,255,255,0.07)" }}>
                {[["↑ EINNAHMEN",stats.einnahmen,"#5CE88A"],["↓ AUSGABEN",stats.ausgaben,"#E8845C"],["→ GESPART",stats.gespart,"#5CE8D4"]].map(([l,v,c],i)=>(
                  <div key={i} style={{ flex:1, borderRight:i<2?"1px solid rgba(255,255,255,0.07)":"none", paddingRight:10, paddingLeft:i>0?10:0 }}>
                    <div style={{ fontSize:10, color:c, letterSpacing:"0.06em", marginBottom:4 }}>{l}</div>
                    <div style={{ fontSize:14, fontWeight:700, fontVariantNumeric:"tabular-nums" }}>€{v.toLocaleString("de-DE",{minimumFractionDigits:2})}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart */}
            <div style={{ ...card, padding:"18px 16px", marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div style={{ display:"flex", gap:6 }}>
                  {[["linie","〜"],["balken","▌"],["donut","◉"]].map(([t,ic])=>(
                    <button key={t} onClick={()=>setChartType(t)} style={{ padding:"6px 12px", borderRadius:30, fontSize:12, cursor:"pointer", border:"none", fontFamily:"inherit", fontWeight:chartType===t?600:400, background:chartType===t?"rgba(232,132,92,0.9)":"rgba(255,255,255,0.06)", color:chartType===t?"#fff":"#777" }}>{ic} {t}</button>
                  ))}
                </div>
                <div style={{ position:"relative" }}>
                  <select value={period} onChange={e=>setPeriod(e.target.value)} style={{ background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"6px 26px 6px 10px", color:"#f0ede8", fontSize:12, cursor:"pointer", fontFamily:"inherit", outline:"none" }}>
                    {periodOptions.map(o=><option key={o.id} value={o.id} style={{background:"#1c1c1c"}}>{o.label}</option>)}
                  </select>
                  <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", color:"#777", fontSize:10, pointerEvents:"none" }}>▾</span>
                </div>
              </div>

              {chartType !== "donut" && (
                <FadeRow>
                  {[["ohne","Ohne Sparen"],["mit","Mit Sparen"],["nur","Nur Sparen"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setSavingsMode(v)} style={{ flexShrink:0, padding:"6px 12px", borderRadius:30, fontSize:11, cursor:"pointer", border:"none", fontFamily:"inherit", fontWeight:savingsMode===v?600:400, background:savingsMode===v?"rgba(92,232,212,0.8)":"rgba(255,255,255,0.05)", color:savingsMode===v?"#111":"#777", whiteSpace:"nowrap" }}>{l}</button>
                  ))}
                </FadeRow>
              )}

              <div style={{ marginTop:14 }}>
                {chartType==="linie" && <SparkLine data={chartData.pts} labels={chartData.labels} color="#E8845C" />}
                {chartType==="balken" && <BarChart data={chartData.bars} />}
                {chartType==="donut" && (
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <Donut segs={stats.katBreak.map(k=>({val:k.val,color:k.farbe}))} size={110} />
                    <div style={{ flex:1 }}>
                      {stats.katBreak.slice(0,5).map(k=>(
                        <div key={k.id} style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}><div style={{ width:8, height:8, borderRadius:"50%", background:k.farbe }} /><span style={{ fontSize:12, color:"#aaa" }}>{k.label}</span></div>
                          <span style={{ fontSize:12, color:"#E8845C", fontVariantNumeric:"tabular-nums" }}>€{k.val.toLocaleString("de-DE",{minimumFractionDigits:2})}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Wiederkehrend */}
            {recurring.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Monatlich fällig</div>
                {recurring.map(r=>(
                  <div key={r.id} style={{ ...card, padding:"14px 16px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                      <div style={{ width:42, height:42, borderRadius:13, background:`${KAT_MAP[r.kategorie]?.farbe||"#888"}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:19 }}>{KAT_MAP[r.kategorie]?.icon}</div>
                      <div><div style={{ fontSize:15, fontWeight:600 }}>{r.name}</div><div style={{ fontSize:12, color:"#666" }}>monatlich</div></div>
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <span style={{ fontSize:15, fontWeight:700, color:"#E8845C", fontVariantNumeric:"tabular-nums" }}>€{r.betrag.toLocaleString("de-DE",{minimumFractionDigits:2})}</span>
                      <button onClick={()=>bookRec(r)} style={{ background:"rgba(92,232,138,0.12)", border:"1px solid rgba(92,232,138,0.22)", color:"#5CE88A", borderRadius:9, padding:"5px 11px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Buchen</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Letzte Einträge */}
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:"0.08em" }}>Zuletzt</div>
                <button onClick={()=>setView("einträge")} style={{ fontSize:13, color:"#E8845C", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}>Alle →</button>
              </div>
              {loading && <div style={{ color:"#444", textAlign:"center", padding:30, fontSize:14 }}>Lädt...</div>}
              {entries.slice(0,6).map(e=>(
                <div key={e.id} style={{ ...card, padding:"14px 16px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", gap:12, alignItems:"center", minWidth:0 }}>
                    <div style={{ width:42, height:42, flexShrink:0, borderRadius:13, background:`${KAT_MAP[e.kategorie]?.farbe||"#888"}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:19 }}>{KAT_MAP[e.kategorie]?.icon}</div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:15, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.name}</div>
                      <div style={{ fontSize:12, color:"#666" }}>{datumFmt(e.datum)}</div>
                    </div>
                  </div>
                  <span style={{ fontSize:15, fontWeight:700, flexShrink:0, marginLeft:10, fontVariantNumeric:"tabular-nums", color:e.kategorie==="sparen"?"#5CE8D4":e.typ==="einnahme"?"#5CE88A":"#E8845C" }}>
                    {e.kategorie==="sparen"?"→":e.typ==="einnahme"?"+":"−"}€{e.betrag.toLocaleString("de-DE",{minimumFractionDigits:2})}
                  </span>
                </div>
              ))}
              {!loading && entries.length===0 && <div style={{ textAlign:"center", color:"#444", padding:30, fontSize:14 }}>Noch keine Einträge. Tippe + um zu beginnen.</div>}
            </div>
          </div>
        )}

        {/* ═══ HINZUFÜGEN ═══ */}
        {view === "hinzufügen" && (
          <div style={{ padding:`22px ${P}px 0`, position:"relative", zIndex:1 }}>
            <div style={{ display:"flex", gap:8, marginBottom:22 }}>
              {[["ausgabe","↓ Ausgabe"],["einnahme","↑ Einnahme"],["sparen","→ Sparen"]].map(([t,l])=>(
                <button key={t} onClick={()=>setForm(f=>({...f,typ:t,kategorie:t==="sparen"?"sparen":t==="einnahme"?"einnahme":f.kategorie}))}
                  style={{ flex:1, padding:"13px 8px", borderRadius:14, fontSize:13, cursor:"pointer", border:"none", fontFamily:"inherit", fontWeight:600, background:form.typ===t?(t==="sparen"?"rgba(92,232,212,0.85)":t==="einnahme"?"rgba(92,232,138,0.85)":"rgba(232,132,92,0.9)"):"rgba(255,255,255,0.06)", color:form.typ===t?"#111":"#777" }}>{l}
                </button>
              ))}
            </div>
            {[{label:"Name",key:"name",placeholder:"z.B. Netflix",type:"text"},{label:"Betrag (€)",key:"betrag",placeholder:"0,00",type:"number"},{label:"Datum",key:"datum",placeholder:"",type:"date"}].map(f=>(
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={lbl}>{f.label}</label>
                <input style={inp} type={f.type} placeholder={f.placeholder} value={form[f.key]} onChange={e=>setForm(ff=>({...ff,[f.key]:e.target.value}))} step={f.key==="betrag"?"0.01":undefined} />
              </div>
            ))}
            {form.typ !== "sparen" && (
              <div style={{ marginBottom:14 }}>
                <label style={lbl}>Kategorie</label>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                  {KATEGORIEN.filter(k=>form.typ==="einnahme"?k.id==="einnahme"||k.id==="sonstiges":k.id!=="einnahme").map(k=>(
                    <div key={k.id} onClick={()=>setForm(f=>({...f,kategorie:k.id}))} style={{ background:form.kategorie===k.id?`${k.farbe}22`:"rgba(255,255,255,0.03)", border:`1px solid ${form.kategorie===k.id?k.farbe:"rgba(255,255,255,0.08)"}`, borderRadius:14, padding:"12px 6px", textAlign:"center", cursor:"pointer", transition:"all 0.15s" }}>
                      <div style={{ fontSize:22 }}>{k.icon}</div>
                      <div style={{ fontSize:10, color:"#888", marginTop:4 }}>{k.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginBottom:14 }}>
              <label style={lbl}>Notiz (optional)</label>
              <input style={inp} placeholder="..." value={form.notiz} onChange={e=>setForm(f=>({...f,notiz:e.target.value}))} />
            </div>
            {!editId && form.typ !== "sparen" && (
              <div style={{ marginBottom:22, display:"flex", alignItems:"center", gap:12 }}>
                <div onClick={()=>setForm(f=>({...f,wiederkehrend:!f.wiederkehrend}))} style={{ width:44, height:24, borderRadius:12, cursor:"pointer", position:"relative", background:form.wiederkehrend?"#E8845C":"rgba(255,255,255,0.1)", transition:"background 0.2s" }}>
                  <div style={{ position:"absolute", top:3, left:form.wiederkehrend?22:3, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }} />
                </div>
                <span style={{ fontSize:14, color:"#777" }}>Monatlich wiederkehrend</span>
              </div>
            )}
            <button onClick={save} style={{ width:"100%", background:"linear-gradient(135deg,#E8845C,#c04070)", border:"none", borderRadius:16, padding:17, fontSize:17, fontWeight:700, color:"#fff", cursor:"pointer", fontFamily:"inherit", marginBottom:10 }}>
              {editId?"Änderungen speichern":"Hinzufügen"}
            </button>
            <button onClick={()=>{ setView("dashboard"); setEditId(null); }} style={{ width:"100%", background:"transparent", border:"1px solid rgba(255,255,255,0.1)", borderRadius:16, padding:15, fontSize:15, color:"#666", cursor:"pointer", fontFamily:"inherit" }}>Abbrechen</button>
          </div>
        )}

        {/* ═══ EINTRÄGE ═══ */}
        {view === "einträge" && (
          <div style={{ padding:`22px ${P}px 0`, position:"relative", zIndex:1 }}>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Kategorie</div>
              <FadeRow>
                <Chip active={catFilter==="alle"} onClick={()=>setCatFilter("alle")}>Alle</Chip>
                {ALLE_KAT.map(k=><Chip key={k.id} active={catFilter===k.id} color={k.farbe} onClick={()=>setCatFilter(k.id)}>{k.icon} {k.label}</Chip>)}
              </FadeRow>
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Monat</div>
              <FadeRow>
                <Chip active={monthFilter==="alle"} onClick={()=>setMonthFilter("alle")}>Alle</Chip>
                {MONATE.map(m=><Chip key={m} active={monthFilter===m} onClick={()=>setMonthFilter(m)}>{m}</Chip>)}
              </FadeRow>
            </div>
            <div style={{ fontSize:13, color:"#555", marginBottom:14 }}>
              {filtered.length} Einträge · Saldo: <span style={{ color:"#E8845C" }}>{filtered.reduce((s,e)=>s+(e.kategorie==="sparen"?0:e.typ==="einnahme"?e.betrag:-e.betrag),0)<0?"−":"+"}€{Math.abs(filtered.reduce((s,e)=>s+(e.kategorie==="sparen"?0:e.typ==="einnahme"?e.betrag:-e.betrag),0)).toLocaleString("de-DE",{minimumFractionDigits:2})}</span>
            </div>
            {filtered.map(e=>(
              <div key={e.id} style={{ ...card, padding:"14px 16px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", gap:12, alignItems:"center", minWidth:0, flex:1 }}>
                  <div style={{ width:42, height:42, flexShrink:0, borderRadius:13, background:`${KAT_MAP[e.kategorie]?.farbe||"#888"}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:19 }}>{KAT_MAP[e.kategorie]?.icon}</div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.name}</div>
                    <div style={{ fontSize:12, color:"#666" }}>{datumFmt(e.datum)} · {KAT_MAP[e.kategorie]?.label}</div>
                    {e.notiz&&<div style={{ fontSize:12, color:"#555", marginTop:2 }}>{e.notiz}</div>}
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:7, flexShrink:0, marginLeft:10 }}>
                  <span style={{ fontSize:15, fontWeight:700, fontVariantNumeric:"tabular-nums", color:e.kategorie==="sparen"?"#5CE8D4":e.typ==="einnahme"?"#5CE88A":"#E8845C" }}>
                    {e.kategorie==="sparen"?"→":e.typ==="einnahme"?"+":"−"}€{e.betrag.toLocaleString("de-DE",{minimumFractionDigits:2})}
                  </span>
                  <div style={{ display:"flex", gap:5 }}>
                    <button onClick={()=>editEntry(e)} style={{ fontSize:12, background:"rgba(255,255,255,0.06)", border:"none", color:"#888", borderRadius:8, padding:"4px 9px", cursor:"pointer" }}>✏</button>
                    <button onClick={()=>del(e.id)} style={{ fontSize:12, background:"rgba(220,60,60,0.1)", border:"none", color:"#e05454", borderRadius:8, padding:"4px 9px", cursor:"pointer" }}>✕</button>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length===0 && <div style={{ textAlign:"center", color:"#444", padding:40, fontSize:14 }}>Keine Einträge gefunden.</div>}
          </div>
        )}

        {/* ═══ SPAREN ═══ */}
        {view === "sparen" && (
          <div style={{ padding:`22px ${P}px 0`, position:"relative", zIndex:1 }}>
            <div style={{ background:"linear-gradient(145deg,rgba(92,232,212,0.18),rgba(30,40,50,0.55))", border:"1px solid rgba(92,232,212,0.22)", borderRadius:24, padding:"26px 22px", marginBottom:14 }}>
              <div style={{ fontSize:13, color:"rgba(92,232,212,0.65)", marginBottom:6 }}>Gesamt gespart</div>
              <div style={{ fontSize:46, fontWeight:800, letterSpacing:"-0.04em", color:"#5CE8D4", fontVariantNumeric:"tabular-nums" }}>€{stats.sparGes.toLocaleString("de-DE",{minimumFractionDigits:2})}</div>
              <div style={{ fontSize:13, color:"rgba(92,232,212,0.45)", marginTop:6 }}>Diesen Monat: €{stats.gespart.toLocaleString("de-DE",{minimumFractionDigits:2})}</div>
            </div>
            <div style={{ ...card, padding:"18px 16px", marginBottom:14 }}>
              <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Sparverlauf</div>
              <SparkLine data={stats.sparVerlauf.map(m=>m.val)} labels={stats.sparVerlauf.map(m=>m.label)} color="#5CE8D4" />
            </div>
            {goals.length>0&&(
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Sparziele</div>
                {goals.map(g=>{
                  const pct=Math.min(100,((g.aktuell||0)/g.ziel)*100);
                  return(
                    <div key={g.id} style={{ ...card, padding:"16px", marginBottom:8 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                        <div style={{ fontSize:15, fontWeight:600 }}>{g.name}</div>
                        <span style={{ fontSize:13, color:"#5CE8D4", fontVariantNumeric:"tabular-nums" }}>€{(g.aktuell||0).toLocaleString("de-DE")} / €{g.ziel.toLocaleString("de-DE")}</span>
                      </div>
                      <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:6, height:6, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:g.farbe||"#5CE8D4", borderRadius:6, transition:"width 0.5s" }} />
                      </div>
                      <div style={{ fontSize:12, color:"#555", marginTop:5 }}>{Math.round(pct)}% erreicht</div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ ...card, padding:"18px 16px", marginBottom:14 }}>
              <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Neues Sparziel</div>
              {[{label:"Name",key:"name",placeholder:"z.B. Urlaub"},{label:"Zielbetrag (€)",key:"ziel",placeholder:"0,00"}].map(f=>(
                <div key={f.key} style={{ marginBottom:12 }}>
                  <label style={lbl}>{f.label}</label>
                  <input style={inp} placeholder={f.placeholder} value={newGoal[f.key]} onChange={e=>setNewGoal(s=>({...s,[f.key]:e.target.value}))} type={f.key==="ziel"?"number":"text"} />
                </div>
              ))}
              <button onClick={saveGoal} style={{ width:"100%", background:"linear-gradient(135deg,#5CE8D4,#5C84E8)", border:"none", borderRadius:14, padding:15, fontSize:16, fontWeight:700, color:"#111", cursor:"pointer", fontFamily:"inherit" }}>Sparziel anlegen</button>
            </div>
            <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Buchungen</div>
            {entries.filter(e=>e.kategorie==="sparen").slice(0,8).map(e=>(
              <div key={e.id} style={{ ...card, padding:"13px 16px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div><div style={{ fontSize:15, fontWeight:600 }}>{e.name}</div><div style={{ fontSize:12, color:"#666" }}>{datumFmt(e.datum)}</div></div>
                <span style={{ fontSize:15, fontWeight:700, color:"#5CE8D4", fontVariantNumeric:"tabular-nums" }}>→ €{e.betrag.toLocaleString("de-DE",{minimumFractionDigits:2})}</span>
              </div>
            ))}
          </div>
        )}

        {/* ═══ MONATLICH ═══ */}
        {view === "wiederkehrend" && (
          <div style={{ padding:`22px ${P}px 0`, position:"relative", zIndex:1 }}>
            <div style={{ fontSize:14, color:"#666", marginBottom:20, lineHeight:1.6 }}>Monatliche Vorlagen. "Buchen" fügt sie mit heutigem Datum ein.</div>
            {recurring.length===0&&<div style={{ textAlign:"center", color:"#444", padding:40, fontSize:14 }}>Noch keine Vorlagen.<br/>Aktiviere "Monatlich wiederkehrend" beim Erfassen.</div>}
            {recurring.map(r=>(
              <div key={r.id} style={{ ...card, padding:"16px", marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                    <div style={{ width:44, height:44, borderRadius:14, background:`${KAT_MAP[r.kategorie]?.farbe||"#888"}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:21 }}>{KAT_MAP[r.kategorie]?.icon}</div>
                    <div><div style={{ fontSize:15, fontWeight:600 }}>{r.name}</div><div style={{ fontSize:12, color:"#666" }}>{KAT_MAP[r.kategorie]?.label} · {r.typ}</div></div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
                    <span style={{ fontSize:15, fontWeight:700, color:"#E8845C", fontVariantNumeric:"tabular-nums" }}>€{r.betrag.toLocaleString("de-DE",{minimumFractionDigits:2})}</span>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={()=>bookRec(r)} style={{ background:"rgba(92,232,138,0.12)", border:"1px solid rgba(92,232,138,0.2)", color:"#5CE88A", borderRadius:9, padding:"5px 11px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Buchen</button>
                      <button onClick={async()=>{ if(!confirm("Vorlage löschen?"))return; try{await sb(`/wiederkehrend?id=eq.${r.id}`,{method:"DELETE",prefer:""});await load();}catch(e){setError(e.message);} }} style={{ background:"rgba(220,60,60,0.1)", border:"none", color:"#e05454", borderRadius:9, padding:"5px 9px", fontSize:12, cursor:"pointer" }}>✕</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
        <nav style={{ position:"fixed", bottom:0, left:0, right:0, background:"rgba(17,17,17,0.97)", backdropFilter:"blur(24px)", borderTop:"1px solid rgba(255,255,255,0.07)", display:"flex", padding:"12px 0 26px", zIndex:100 }}>
          {[{id:"dashboard",icon:"⬡",label:"Übersicht"},{id:"einträge",icon:"↕",label:"Einträge"},{id:"sparen",icon:"🏦",label:"Sparen"},{id:"wiederkehrend",icon:"↺",label:"Monatlich"}].map(n=>(
            <div key={n.id} onClick={()=>setView(n.id)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, cursor:"pointer", color:view===n.id?"#E8845C":"#555", transition:"color 0.2s" }}>
              <span style={{ fontSize:22 }}>{n.icon}</span>
              <span style={{ fontSize:11, fontWeight:600 }}>{n.label}</span>
            </div>
          ))}
        </nav>
      </div>
    </>
  );
}
