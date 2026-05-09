import { useState, useEffect, useMemo, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE CONFIG – trage hier deine Daten ein
// ─────────────────────────────────────────────────────────────────────────────
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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PIN AUTH – einfaches shared-secret, gehasht im Browser
// ─────────────────────────────────────────────────────────────────────────────
async function hashPin(pin) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("haushalt_" + pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// KONSTANTEN
// ─────────────────────────────────────────────────────────────────────────────
const KATEGORIEN = [
  { id: "wohnen",        label: "Wohnen",        icon: "🏠", farbe: "#e07b54" },
  { id: "lebensmittel", label: "Lebensmittel",   icon: "🛒", farbe: "#e0a854" },
  { id: "transport",    label: "Transport",      icon: "🚗", farbe: "#5488e0" },
  { id: "gesundheit",   label: "Gesundheit",     icon: "💊", farbe: "#54c4e0" },
  { id: "freizeit",     label: "Freizeit",       icon: "🎬", farbe: "#a054e0" },
  { id: "einnahme",     label: "Einnahme",       icon: "💰", farbe: "#54e08a" },
  { id: "sonstiges",    label: "Sonstiges",      icon: "📦", farbe: "#888" },
];
const SPAR_KAT = { id: "sparen", label: "Sparen", icon: "🏦", farbe: "#54e0d4" };
const KAT_MAP = Object.fromEntries([...KATEGORIEN, SPAR_KAT].map(c => [c.id, c]));
const MONATE = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

function euro(n, vorzeichen = true) {
  const abs = Math.abs(n).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (!vorzeichen) return `€${abs}`;
  return (n >= 0 ? "+" : "−") + `€${abs}`;
}
function datumFmt(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
function heute() {
  return new Date().toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function SparkLine({ data, breite = 300, hoehe = 72, farbe = "#e07b54" }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (breite - 16) + 8;
    const y = hoehe - 8 - ((v - min) / range) * (hoehe - 16);
    return [x, y];
  });
  const pathD = "M " + pts.map(p => p.join(",")).join(" L ");
  const areaD = `M ${pts[0].join(",")} L ${pts.map(p => p.join(",")).join(" L ")} L ${pts[pts.length-1][0]},${hoehe} L ${pts[0][0]},${hoehe} Z`;
  const gid = `g${farbe.replace("#","")}`;
  return (
    <svg viewBox={`0 0 ${breite} ${hoehe}`} style={{ width:"100%", height: hoehe }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={farbe} stopOpacity="0.3" />
          <stop offset="100%" stopColor={farbe} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gid})`} />
      <path d={pathD} fill="none" stroke={farbe} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill={farbe} />)}
    </svg>
  );
}

function Balkendiagramm({ daten, hoehe = 80 }) {
  if (!daten.length) return null;
  const max = Math.max(...daten.map(d => Math.abs(d.wert)), 1);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:4, height: hoehe, padding:"0 4px" }}>
      {daten.map((d, i) => (
        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <div style={{
            width:"100%", borderRadius:"3px 3px 0 0", opacity:0.85,
            background: d.wert >= 0 ? "#54e08a" : "#e07b54",
            height: `${Math.max(4, (Math.abs(d.wert) / max) * (hoehe - 18))}px`,
            transition:"height 0.4s ease",
          }} />
          <span style={{ fontSize:9, color:"#555" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function DonutDiagramm({ segmente, groesse = 130 }) {
  const gesamt = segmente.reduce((s, x) => s + x.wert, 0);
  if (!gesamt) return <div style={{ width:groesse, height:groesse, borderRadius:"50%", background:"#111118", margin:"auto" }} />;
  const r = 50, cx = 60, cy = 60, umfang = 2 * Math.PI * r;
  let offset = 0;
  const scheiben = segmente.map(seg => {
    const pct = seg.wert / gesamt;
    const dash = pct * umfang;
    const style = { strokeDasharray:`${dash} ${umfang-dash}`, strokeDashoffset: -offset * umfang, stroke: seg.farbe };
    offset += pct;
    return { ...seg, style };
  });
  return (
    <svg viewBox="0 0 120 120" style={{ width:groesse, height:groesse }}>
      {scheiben.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" strokeWidth="18"
          style={{ ...s.style, transition:"all 0.5s ease" }} transform="rotate(-90 60 60)" />
      ))}
      <circle cx={cx} cy={cy} r={r-14} fill="#111118" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HAUPTAPP
// ─────────────────────────────────────────────────────────────────────────────
export default function FinanzApp() {
  const auth = true;
  const [laden, setLaden] = useState(false);
  const [fehler, setFehler] = useState(null);

  const [einträge, setEinträge] = useState([]);
  const [wiederkehrend, setWiederkehrend] = useState([]);
  const [sparziele, setSparziele] = useState([]);
  const [dbLaden, setDbLaden] = useState(false);

  const [ansicht, setAnsicht] = useState("dashboard");
  const [diagrammTyp, setDiagrammTyp] = useState("linie");
  const [sparModus, setSparModus] = useState("ohne"); // ohne | mit | nur
  const [filterKat, setFilterKat] = useState("alle");
  const [filterMonat, setFilterMonat] = useState("alle");
  const [bearbeitenId, setBearbeitenId] = useState(null);
  const [importModal, setImportModal] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [neuesSparZiel, setNeuesSparZiel] = useState({ name:"", ziel:"", farbe:"#54e0d4" });

  const leerForm = { name:"", betrag:"", datum:heute(), kategorie:"lebensmittel", typ:"ausgabe", notiz:"", istWiederkehrend:false };
  const [form, setForm] = useState(leerForm);

  // ── Supabase Demo-Modus (ohne echte URL) ──
  const demoModus = SUPABASE_URL === "DEINE_SUPABASE_URL";

  // ── Lokaler Fallback wenn Demo ──
  const [lokalDaten, setLokalDaten] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fin_lokal") || "{}"); } catch { return {}; }
  });

  useEffect(() => {
    if (demoModus) localStorage.setItem("fin_lokal", JSON.stringify(lokalDaten));
  }, [lokalDaten, demoModus]);

  // ── Auth ──
  async function pinPrüfen(pin) {
    setLaden(true); setPinFehler(false);
    try {
      const hash = await hashPin(pin);
      if (demoModus) {
        const gespeichert = localStorage.getItem("fin_pin");
        if (!gespeichert) { setPinSetzen(true); setLaden(false); return; }
        if (gespeichert === hash) { sessionStorage.setItem("fin_auth", hash); setAuth(hash); }
        else setPinFehler(true);
      } else {
        const res = await sb("/haushalt_pin?select=hash&limit=1");
        if (!res || res.length === 0) { setPinSetzen(true); setLaden(false); return; }
        if (res[0].hash === hash) { sessionStorage.setItem("fin_auth", hash); setAuth(hash); }
        else setPinFehler(true);
      }
    } catch(e) { setFehler("Verbindungsfehler: " + e.message); }
    setLaden(false);
  }

  async function pinSpeichern(pin) {
    setLaden(true);
    const hash = await hashPin(pin);
    if (demoModus) { localStorage.setItem("fin_pin", hash); sessionStorage.setItem("fin_auth", hash); setAuth(hash); }
    else {
      await sb("/haushalt_pin", { method:"POST", body: JSON.stringify({ hash }) });
      sessionStorage.setItem("fin_auth", hash); setAuth(hash);
    }
    setLaden(false);
  }

  // ── Daten laden ──
  useEffect(() => {
    if (!auth) return;
    ladeDaten();
  }, [auth]);

  async function ladeDaten() {
    setDbLaden(true);
    try {
      if (demoModus) {
        setEinträge(lokalDaten.einträge || []);
        setWiederkehrend(lokalDaten.wiederkehrend || []);
        setSparziele(lokalDaten.sparziele || []);
      } else {
        const [tx, rec, sz] = await Promise.all([
          sb("/eintraege?select=*&order=datum.desc"),
          sb("/wiederkehrend?select=*"),
          sb("/sparziele?select=*"),
        ]);
        setEinträge(tx || []);
        setWiederkehrend(rec || []);
        setSparziele(sz || []);
      }
    } catch(e) { setFehler("Ladefehler: " + e.message); }
    setDbLaden(false);
  }

  // ── CRUD ──
  async function eintragSpeichern() {
    if (!form.name || !form.betrag) return;
    const eintrag = {
      name: form.name,
      betrag: parseFloat(form.betrag),
      datum: form.datum,
      kategorie: form.kategorie,
      typ: form.typ,
      notiz: form.notiz,
    };
    try {
      if (demoModus) {
        const neu = { ...eintrag, id: bearbeitenId || Date.now().toString() };
        const aktuell = bearbeitenId
          ? (lokalDaten.einträge || []).map(e => e.id === bearbeitenId ? neu : e)
          : [neu, ...(lokalDaten.einträge || [])];
        setLokalDaten(d => ({ ...d, einträge: aktuell }));
        setEinträge(aktuell);
        if (form.istWiederkehrend && !bearbeitenId) {
          const rec = [...(lokalDaten.wiederkehrend || []), { ...neu, id: "rec_" + Date.now() }];
          setLokalDaten(d => ({ ...d, wiederkehrend: rec }));
          setWiederkehrend(rec);
        }
      } else {
        if (bearbeitenId) {
          await sb(`/eintraege?id=eq.${bearbeitenId}`, { method:"PATCH", body: JSON.stringify(eintrag) });
        } else {
          await sb("/eintraege", { method:"POST", body: JSON.stringify(eintrag) });
          if (form.istWiederkehrend) await sb("/wiederkehrend", { method:"POST", body: JSON.stringify(eintrag) });
        }
        await ladeDaten();
      }
    } catch(e) { setFehler("Speicherfehler: " + e.message); }
    setBearbeitenId(null); setForm(leerForm); setAnsicht("dashboard");
  }

  async function eintragLöschen(id) {
    if (!confirm("Eintrag wirklich löschen?")) return;
    try {
      if (demoModus) {
        const aktuell = (lokalDaten.einträge || []).filter(e => e.id !== id);
        setLokalDaten(d => ({ ...d, einträge: aktuell }));
        setEinträge(aktuell);
      } else {
        await sb(`/eintraege?id=eq.${id}`, { method:"DELETE", prefer:"" });
        await ladeDaten();
      }
    } catch(e) { setFehler("Fehler: " + e.message); }
  }

  async function wiederkehrendBuchen(rec) {
    const eintrag = { name:rec.name, betrag:rec.betrag, datum:heute(), kategorie:rec.kategorie, typ:rec.typ, notiz:rec.notiz||"" };
    try {
      if (demoModus) {
        const neu = { ...eintrag, id: Date.now().toString() };
        const aktuell = [neu, ...(lokalDaten.einträge || [])];
        setLokalDaten(d => ({ ...d, einträge: aktuell }));
        setEinträge(aktuell);
      } else {
        await sb("/eintraege", { method:"POST", body: JSON.stringify(eintrag) });
        await ladeDaten();
      }
    } catch(e) { setFehler("Fehler: " + e.message); }
  }

  async function sparZielSpeichern() {
    if (!neuesSparZiel.name || !neuesSparZiel.ziel) return;
    const sz = { name: neuesSparZiel.name, ziel: parseFloat(neuesSparZiel.ziel), aktuell: 0, farbe: neuesSparZiel.farbe };
    try {
      if (demoModus) {
        const neu = { ...sz, id: Date.now().toString() };
        const aktuell = [...(lokalDaten.sparziele || []), neu];
        setLokalDaten(d => ({ ...d, sparziele: aktuell }));
        setSparziele(aktuell);
      } else {
        await sb("/sparziele", { method:"POST", body: JSON.stringify(sz) });
        await ladeDaten();
      }
    } catch(e) { setFehler("Fehler: " + e.message); }
    setNeuesSparZiel({ name:"", ziel:"", farbe:"#54e0d4" });
  }

  function eintragBearbeiten(e) {
    setForm({ name:e.name, betrag:String(e.betrag), datum:e.datum, kategorie:e.kategorie, typ:e.typ, notiz:e.notiz||"", istWiederkehrend:false });
    setBearbeitenId(e.id); setAnsicht("hinzufügen");
  }

  // ── Notion CSV Import ──
  function notionImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImportStatus("Lese Datei...");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const lines = ev.target.result.split("\n").filter(Boolean);
        const headers = lines[0].split(",").map(h => h.trim().replace(/"/g,"").toLowerCase());
        let importiert = 0;
        const neuEinträge = [];
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(",").map(v => v.trim().replace(/"/g,""));
          const row = Object.fromEntries(headers.map((h,j) => [h, vals[j]||""]));
          const name = row["name"] || row["titel"] || row["title"] || row["bezeichnung"] || "";
          const betragRaw = row["betrag"] || row["amount"] || row["summe"] || "0";
          const betrag = parseFloat(betragRaw.replace(",",".").replace(/[^0-9.-]/g,""));
          const datum = row["datum"] || row["date"] || heute();
          if (!name || isNaN(betrag)) continue;
          const eintrag = { name, betrag: Math.abs(betrag), datum: datum.slice(0,10), kategorie: "sonstiges", typ: betrag >= 0 ? "einnahme" : "ausgabe", notiz: "Notion Import" };
          neuEinträge.push(eintrag);
          importiert++;
        }
        if (demoModus) {
          const mitIds = neuEinträge.map(e => ({ ...e, id: Date.now().toString() + Math.random() }));
          const aktuell = [...mitIds, ...(lokalDaten.einträge || [])];
          setLokalDaten(d => ({ ...d, einträge: aktuell }));
          setEinträge(aktuell);
        } else {
          for (const e of neuEinträge) await sb("/eintraege", { method:"POST", body: JSON.stringify(e) });
          await ladeDaten();
        }
        setImportStatus(`✓ ${importiert} Einträge importiert`);
        setTimeout(() => { setImportModal(false); setImportStatus(""); }, 2000);
      } catch(err) { setImportStatus("Fehler beim Import: " + err.message); }
    };
    reader.readAsText(file);
  }

  // ── Statistiken ──
  const stats = useMemo(() => {
    const jetzt = new Date();
    const dieserMonat = einträge.filter(e => {
      const d = new Date(e.datum);
      return d.getMonth() === jetzt.getMonth() && d.getFullYear() === jetzt.getFullYear();
    });
    const ohneSparen = (liste) => liste.filter(e => e.kategorie !== "sparen");
    const nurSparen = (liste) => liste.filter(e => e.kategorie === "sparen");

    const einnahmen = dieserMonat.filter(e => e.typ === "einnahme" && e.kategorie !== "sparen").reduce((s,e) => s+e.betrag, 0);
    const ausgaben = dieserMonat.filter(e => e.typ === "ausgabe" && e.kategorie !== "sparen").reduce((s,e) => s+e.betrag, 0);
    const gesparterMonat = nurSparen(dieserMonat).reduce((s,e) => s+e.betrag, 0);

    const gesamtSaldo = einträge.reduce((s,e) => {
      if (e.kategorie === "sparen") return s;
      return s + (e.typ === "einnahme" ? e.betrag : -e.betrag);
    }, 0);

    const monatlData = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(jetzt.getFullYear(), jetzt.getMonth() - (5 - i), 1);
      const m = d.getMonth(), y = d.getFullYear();
      const txs = einträge.filter(e => { const td = new Date(e.datum); return td.getMonth()===m && td.getFullYear()===y; });
      const inc = txs.filter(e => e.typ==="einnahme" && e.kategorie!=="sparen").reduce((s,e) => s+e.betrag, 0);
      const exp = txs.filter(e => e.typ==="ausgabe" && e.kategorie!=="sparen").reduce((s,e) => s+e.betrag, 0);
      const spar = nurSparen(txs).reduce((s,e) => s+e.betrag, 0);
      return { label: MONATE[m], netto: inc - exp, einnahmen: inc, ausgaben: exp, sparen: spar };
    });

    const katBreakdown = KATEGORIEN.filter(k => k.id !== "einnahme").map(k => ({
      ...k, wert: dieserMonat.filter(e => e.kategorie===k.id && e.typ==="ausgabe").reduce((s,e) => s+e.betrag, 0)
    })).filter(k => k.wert > 0);

    const sparGesamt = einträge.filter(e => e.kategorie==="sparen").reduce((s,e) => s+e.betrag, 0);
    const sparVerlauf = monatlData.map(m => ({ label: m.label, wert: m.sparen }));

    return { einnahmen, ausgaben, gesparterMonat, gesamtSaldo, monatlData, katBreakdown, sparGesamt, sparVerlauf };
  }, [einträge]);

  const gefilterteEinträge = useMemo(() => {
    return einträge.filter(e => {
      const katOk = filterKat === "alle" || e.kategorie === filterKat;
      const mIdx = parseInt(e.datum?.split("-")[1]) - 1;
      const monatsOk = filterMonat === "alle" || MONATE[mIdx] === filterMonat;
      return katOk && monatsOk;
    }).sort((a,b) => b.datum.localeCompare(a.datum));
  }, [einträge, filterKat, filterMonat]);

  // ── Styles ──
  const s = {
    app: { minHeight:"100vh", background:"#09090f", color:"#ededf5", fontFamily:"'Syne', sans-serif", maxWidth:430, margin:"0 auto", position:"relative", paddingBottom:88, overflow:"hidden" },
    blob: (c, t, l, size) => ({ position:"fixed", borderRadius:"50%", filter:"blur(90px)", opacity:0.1, background:c, width:size, height:size, top:t, left:l, pointerEvents:"none", zIndex:0 }),
    glas: { background:"rgba(255,255,255,0.035)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:18, backdropFilter:"blur(10px)" },
    karte: { background:"linear-gradient(135deg, rgba(224,123,84,0.18), rgba(84,136,224,0.12))", border:"1px solid rgba(224,123,84,0.25)", borderRadius:22, padding:"22px 20px" },
    btn: (v="primär") => ({
      background: v==="primär" ? "linear-gradient(135deg,#e07b54,#e05480)" : v==="ghost" ? "transparent" : "rgba(255,255,255,0.05)",
      color: v==="ghost" ? "#555" : "#fff",
      border: v==="ghost" ? "1px solid rgba(255,255,255,0.08)" : "none",
      borderRadius:14, padding:"13px 20px", fontSize:15, fontWeight:600, cursor:"pointer", width:"100%",
      fontFamily:"'Syne',sans-serif", transition:"opacity 0.15s",
    }),
    pille: (aktiv, farbe) => ({
      padding:"5px 13px", borderRadius:30, fontSize:12, cursor:"pointer", whiteSpace:"nowrap",
      background: aktiv ? (farbe || "rgba(224,123,84,0.9)") : "rgba(255,255,255,0.05)",
      color: aktiv ? "#fff" : "#666",
      border: aktiv ? "none" : "1px solid rgba(255,255,255,0.07)",
      transition:"all 0.2s", fontFamily:"'Syne',sans-serif",
    }),
    input: { background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:12, padding:"13px 16px", color:"#ededf5", fontSize:15, width:"100%", outline:"none", fontFamily:"'Syne',sans-serif", boxSizing:"border-box" },
    label: { fontSize:11, color:"#555", marginBottom:6, display:"block", letterSpacing:"0.06em", textTransform:"uppercase" },
    sektion: { padding:"0 18px", marginBottom:18, position:"relative", zIndex:1 },
    nav: { position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:"rgba(9,9,15,0.97)", backdropFilter:"blur(20px)", borderTop:"1px solid rgba(255,255,255,0.05)", display:"flex", justifyContent:"space-around", padding:"10px 0 22px", zIndex:100 },
    navItem: (a) => ({ display:"flex", flexDirection:"column", alignItems:"center", gap:3, cursor:"pointer", padding:"4px 14px", color:a?"#e07b54":"#444", transition:"color 0.2s" }),
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HAUPTAPP
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={s.app}>
        <div style={s.blob("#e07b54",-60,-60,300)} />
        <div style={s.blob("#5488e0","35%","55%",260)} />
        <div style={s.blob("#a054e0","75%",-80,220)} />

        {/* Fehler-Toast */}
        {fehler && (
          <div onClick={() => setFehler(null)} style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", background:"#e05454", color:"#fff", padding:"10px 20px", borderRadius:12, fontSize:13, zIndex:999, cursor:"pointer", maxWidth:360, textAlign:"center" }}>
            {fehler} · Tippen zum Schließen
          </div>
        )}

        {/* Notion Import Modal */}
        {importModal && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
            <div style={{ ...s.glas, padding:24, width:"100%", maxWidth:360 }}>
              <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Notion Import</div>
              <div style={{ fontSize:13, color:"#666", marginBottom:20, lineHeight:1.6 }}>
                Exportiere deine Notion-Datenbank als CSV (··· → Export → CSV). Die Spalten <em>Name</em>, <em>Betrag</em> und <em>Datum</em> werden erkannt.
              </div>
              <label style={{ ...s.btn("sekundär"), display:"block", textAlign:"center", cursor:"pointer", marginBottom:12 }}>
                📂 CSV-Datei wählen
                <input type="file" accept=".csv" style={{ display:"none" }} onChange={notionImport} />
              </label>
              {importStatus && <div style={{ fontSize:13, color: importStatus.startsWith("✓") ? "#54e08a" : "#e07b54", textAlign:"center", marginBottom:10 }}>{importStatus}</div>}
              <button style={s.btn("ghost")} onClick={() => setImportModal(false)}>Abbrechen</button>
            </div>
          </div>
        )}

        {/* ── HEADER ── */}
        <div style={{ ...s.sektion, paddingTop:52, paddingBottom:0, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:11, color:"#555", letterSpacing:"0.1em", textTransform:"uppercase" }}>Haushaltskasse</div>
            <div style={{ fontSize:22, fontWeight:800, letterSpacing:"-0.02em" }}>
              {ansicht === "dashboard" ? "Übersicht" : ansicht === "hinzufügen" ? (bearbeitenId ? "Bearbeiten" : "Neu") : ansicht === "einträge" ? "Einträge" : ansicht === "sparen" ? "Sparen" : "Wiederkehrend"}
            </div>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <div onClick={() => setImportModal(true)} style={{ width:36, height:36, borderRadius:"50%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:16 }} title="Notion Import">📥</div>
            <div onClick={() => { setBearbeitenId(null); setForm(leerForm); setAnsicht("hinzufügen"); }} style={{ width:36, height:36, borderRadius:"50%", background:"linear-gradient(135deg,#e07b54,#e05480)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:20, fontWeight:300 }}>+</div>
          </div>
        </div>

        {/* ═══════════════════ DASHBOARD ═══════════════════ */}
        {ansicht === "dashboard" && (
          <>
            {/* Saldo-Karte */}
            <div style={{ ...s.sektion, marginTop:20 }}>
              <div style={s.karte}>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:4 }}>Gesamtsaldo</div>
                <div style={{ fontSize:36, fontWeight:800, letterSpacing:"-0.03em", fontFamily:"'DM Mono',monospace" }}>
                  {stats.gesamtSaldo >= 0 ? "+" : "−"}€{Math.abs(stats.gesamtSaldo).toLocaleString("de-DE",{minimumFractionDigits:2})}
                </div>
                <div style={{ display:"flex", gap:24, marginTop:14 }}>
                  <div>
                    <div style={{ fontSize:10, color:"#54e08a", letterSpacing:"0.06em" }}>↑ EINNAHMEN</div>
                    <div style={{ fontSize:15, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>€{stats.einnahmen.toLocaleString("de-DE",{minimumFractionDigits:2})}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:"#e07b54", letterSpacing:"0.06em" }}>↓ AUSGABEN</div>
                    <div style={{ fontSize:15, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>€{stats.ausgaben.toLocaleString("de-DE",{minimumFractionDigits:2})}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:"#54e0d4", letterSpacing:"0.06em" }}>⇢ GESPART</div>
                    <div style={{ fontSize:15, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>€{stats.gesparterMonat.toLocaleString("de-DE",{minimumFractionDigits:2})}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Diagramm */}
            <div style={s.sektion}>
              <div style={{ ...s.glas, padding:"18px 16px 14px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>6-Monats-Verlauf</div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {[["linie","〜"],["balken","▌"],["donut","◉"]].map(([t,ic]) => (
                      <button key={t} onClick={() => setDiagrammTyp(t)} style={{ ...s.pille(diagrammTyp===t), padding:"3px 9px", fontSize:11 }}>{ic} {t}</button>
                    ))}
                  </div>
                </div>
                {/* Spar-Toggle */}
                <div style={{ display:"flex", gap:6, marginBottom:12 }}>
                  {[["ohne","Ohne Sparen"],["mit","Mit Sparen"],["nur","Nur Sparen"]].map(([v,l]) => (
                    <button key={v} onClick={() => setSparModus(v)} style={{ ...s.pille(sparModus===v,"rgba(84,224,212,0.7)"), fontSize:10, padding:"3px 8px" }}>{l}</button>
                  ))}
                </div>

                {diagrammTyp === "linie" && (
                  <>
                    <SparkLine
                      data={sparModus === "nur" ? stats.sparVerlauf.map(m=>m.wert) : stats.monatlData.map(m => sparModus === "mit" ? m.netto - m.sparen : m.netto)}
                      farbe={sparModus === "nur" ? "#54e0d4" : "#e07b54"}
                    />
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                      {stats.monatlData.map(m => <span key={m.label} style={{ fontSize:9, color:"#444" }}>{m.label}</span>)}
                    </div>
                  </>
                )}
                {diagrammTyp === "balken" && (
                  <>
                    <Balkendiagramm daten={stats.monatlData.map(m => ({ label:m.label, wert: sparModus === "nur" ? m.sparen : sparModus === "mit" ? m.netto - m.sparen : m.netto }))} hoehe={90} />
                  </>
                )}
                {diagrammTyp === "donut" && (
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <DonutDiagramm segmente={sparModus === "nur"
                      ? [{ wert: stats.sparGesamt, farbe:"#54e0d4", label:"Gespart" }]
                      : stats.katBreakdown} groesse={110} />
                    <div style={{ flex:1 }}>
                      {(sparModus === "nur" ? [{ label:"Gespart", farbe:"#54e0d4", wert:stats.sparGesamt }] : stats.katBreakdown).slice(0,5).map(c => (
                        <div key={c.label} style={{ display:"flex", justifyContent:"space-between", marginBottom:5, alignItems:"center" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <div style={{ width:7, height:7, borderRadius:"50%", background:c.farbe || c.farbe }} />
                            <span style={{ fontSize:11, color:"#999" }}>{c.label}</span>
                          </div>
                          <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"#e07b54" }}>€{c.wert.toLocaleString("de-DE",{minimumFractionDigits:2})}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Wiederkehrende fällig */}
            {wiederkehrend.length > 0 && (
              <div style={s.sektion}>
                <div style={{ fontSize:11, color:"#555", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>Monatlich fällig</div>
                {wiederkehrend.map(r => (
                  <div key={r.id} style={{ ...s.glas, padding:"12px 16px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                      <span style={{ fontSize:20 }}>{KAT_MAP[r.kategorie]?.icon}</span>
                      <div>
                        <div style={{ fontSize:14, fontWeight:600 }}>{r.name}</div>
                        <div style={{ fontSize:11, color:"#555" }}>monatlich</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <span style={{ fontFamily:"'DM Mono',monospace", color:"#e07b54", fontSize:13 }}>€{r.betrag.toLocaleString("de-DE",{minimumFractionDigits:2})}</span>
                      <button onClick={() => wiederkehrendBuchen(r)} style={{ background:"rgba(84,224,138,0.12)", border:"1px solid rgba(84,224,138,0.25)", color:"#54e08a", borderRadius:8, padding:"4px 10px", fontSize:11, cursor:"pointer", fontFamily:"'Syne',sans-serif" }}>Buchen</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Letzte Einträge */}
            <div style={s.sektion}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:"0.06em" }}>Zuletzt</div>
                <button onClick={() => setAnsicht("einträge")} style={{ fontSize:11, color:"#e07b54", background:"none", border:"none", cursor:"pointer", fontFamily:"'Syne',sans-serif" }}>Alle →</button>
              </div>
              {dbLaden && <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:20 }}>Lade...</div>}
              {einträge.slice(0,5).map(e => (
                <div key={e.id} style={{ ...s.glas, padding:"12px 16px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:`${KAT_MAP[e.kategorie]?.farbe || "#888"}20`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
                      {KAT_MAP[e.kategorie]?.icon}
                    </div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600 }}>{e.name}</div>
                      <div style={{ fontSize:11, color:"#555" }}>{datumFmt(e.datum)}</div>
                    </div>
                  </div>
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:14, fontWeight:500, color: e.kategorie==="sparen" ? "#54e0d4" : e.typ==="einnahme" ? "#54e08a" : "#e07b54" }}>
                    {e.kategorie==="sparen" ? "⇢" : e.typ==="einnahme" ? "+" : "−"}€{e.betrag.toLocaleString("de-DE",{minimumFractionDigits:2})}
                  </span>
                </div>
              ))}
              {einträge.length === 0 && !dbLaden && <div style={{ textAlign:"center", color:"#333", padding:"30px 0", fontSize:13 }}>Noch keine Einträge. Tippe + um zu beginnen.</div>}
            </div>
          </>
        )}

        {/* ═══════════════════ HINZUFÜGEN / BEARBEITEN ═══════════════════ */}
        {ansicht === "hinzufügen" && (
          <div style={{ ...s.sektion, paddingTop:20 }}>
            {/* Typ */}
            <div style={{ display:"flex", gap:8, marginBottom:20 }}>
              {[["ausgabe","↓ Ausgabe"],["einnahme","↑ Einnahme"],["sparen","⇢ Sparen"]].map(([t,l]) => (
                <button key={t} onClick={() => setForm(f => ({...f, typ:t, kategorie: t==="sparen" ? "sparen" : t==="einnahme" ? "einnahme" : f.kategorie}))} style={{ ...s.pille(form.typ===t, t==="sparen"?"rgba(84,224,212,0.8)":t==="einnahme"?"rgba(84,224,138,0.8)":undefined), flex:1, textAlign:"center" }}>{l}</button>
              ))}
            </div>

            <div style={{ marginBottom:16 }}>
              <label style={s.label}>Name</label>
              <input style={s.input} placeholder="z.B. Netflix" value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={s.label}>Betrag (€)</label>
              <input style={s.input} placeholder="0,00" type="number" step="0.01" value={form.betrag} onChange={e => setForm(f => ({...f, betrag:e.target.value}))} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={s.label}>Datum</label>
              <input style={s.input} type="date" value={form.datum} onChange={e => setForm(f => ({...f, datum:e.target.value}))} />
            </div>

            {form.typ !== "sparen" && (
              <div style={{ marginBottom:16 }}>
                <label style={s.label}>Kategorie</label>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                  {KATEGORIEN.filter(k => form.typ === "einnahme" ? k.id==="einnahme" || k.id==="sonstiges" : k.id !== "einnahme").map(k => (
                    <div key={k.id} onClick={() => setForm(f => ({...f, kategorie:k.id}))} style={{ ...s.glas, padding:"10px 6px", textAlign:"center", cursor:"pointer", border:`1px solid ${form.kategorie===k.id ? k.farbe : "rgba(255,255,255,0.06)"}`, background: form.kategorie===k.id ? `${k.farbe}22` : "rgba(255,255,255,0.02)", transition:"all 0.15s" }}>
                      <div style={{ fontSize:20 }}>{k.icon}</div>
                      <div style={{ fontSize:10, color:"#777", marginTop:2 }}>{k.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom:16 }}>
              <label style={s.label}>Notiz (optional)</label>
              <input style={s.input} placeholder="..." value={form.notiz} onChange={e => setForm(f => ({...f, notiz:e.target.value}))} />
            </div>

            {!bearbeitenId && form.typ !== "sparen" && (
              <div style={{ marginBottom:20, display:"flex", alignItems:"center", gap:10 }}>
                <div onClick={() => setForm(f => ({...f, istWiederkehrend:!f.istWiederkehrend}))} style={{ width:40, height:22, borderRadius:11, cursor:"pointer", transition:"background 0.2s", position:"relative", background:form.istWiederkehrend?"#e07b54":"rgba(255,255,255,0.08)" }}>
                  <div style={{ position:"absolute", top:3, left:form.istWiederkehrend?20:3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }} />
                </div>
                <span style={{ fontSize:13, color:"#666" }}>Als monatlich wiederkehrend speichern</span>
              </div>
            )}

            <button style={s.btn()} onClick={eintragSpeichern}>{bearbeitenId ? "Änderungen speichern" : "Eintrag hinzufügen"}</button>
            <button onClick={() => { setAnsicht("dashboard"); setBearbeitenId(null); }} style={{ ...s.btn("ghost"), marginTop:10 }}>Abbrechen</button>
          </div>
        )}

        {/* ═══════════════════ ALLE EINTRÄGE ═══════════════════ */}
        {ansicht === "einträge" && (
          <div style={{ ...s.sektion, paddingTop:20 }}>
            {/* Kategorie-Filter */}
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, color:"#555", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em" }}>Kategorie</div>
              <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4 }}>
                <button onClick={() => setFilterKat("alle")} style={s.pille(filterKat==="alle")}>Alle</button>
                {[...KATEGORIEN, SPAR_KAT].map(k => (
                  <button key={k.id} onClick={() => setFilterKat(k.id)} style={s.pille(filterKat===k.id, filterKat===k.id ? `${k.farbe}cc` : undefined)}>{k.icon} {k.label}</button>
                ))}
              </div>
            </div>
            {/* Monat-Filter */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:"#555", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em" }}>Monat</div>
              <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4 }}>
                <button onClick={() => setFilterMonat("alle")} style={s.pille(filterMonat==="alle")}>Alle</button>
                {MONATE.map(m => <button key={m} onClick={() => setFilterMonat(m)} style={s.pille(filterMonat===m)}>{m}</button>)}
              </div>
            </div>
            <div style={{ fontSize:12, color:"#444", marginBottom:12 }}>
              {gefilterteEinträge.length} Einträge · Saldo: <span style={{ color:"#e07b54", fontFamily:"'DM Mono',monospace" }}>
                {euro(gefilterteEinträge.reduce((s,e) => s + (e.kategorie==="sparen" ? 0 : e.typ==="einnahme" ? e.betrag : -e.betrag), 0))}
              </span>
            </div>
            {gefilterteEinträge.map(e => (
              <div key={e.id} style={{ ...s.glas, padding:"12px 16px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", gap:12, alignItems:"center", flex:1, minWidth:0 }}>
                  <div style={{ width:36, height:36, flexShrink:0, borderRadius:10, background:`${KAT_MAP[e.kategorie]?.farbe||"#888"}20`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
                    {KAT_MAP[e.kategorie]?.icon}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.name}</div>
                    <div style={{ fontSize:11, color:"#555" }}>{datumFmt(e.datum)} · {KAT_MAP[e.kategorie]?.label}</div>
                    {e.notiz && <div style={{ fontSize:11, color:"#444", marginTop:1 }}>{e.notiz}</div>}
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, flexShrink:0 }}>
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:500, color: e.kategorie==="sparen" ? "#54e0d4" : e.typ==="einnahme" ? "#54e08a" : "#e07b54" }}>
                    {e.kategorie==="sparen" ? "⇢" : e.typ==="einnahme" ? "+" : "−"}€{e.betrag.toLocaleString("de-DE",{minimumFractionDigits:2})}
                  </span>
                  <div style={{ display:"flex", gap:5 }}>
                    <button onClick={() => eintragBearbeiten(e)} style={{ fontSize:11, background:"rgba(255,255,255,0.06)", border:"none", color:"#888", borderRadius:6, padding:"3px 8px", cursor:"pointer" }}>✏</button>
                    <button onClick={() => eintragLöschen(e.id)} style={{ fontSize:11, background:"rgba(224,84,84,0.1)", border:"none", color:"#e05454", borderRadius:6, padding:"3px 8px", cursor:"pointer" }}>✕</button>
                  </div>
                </div>
              </div>
            ))}
            {gefilterteEinträge.length === 0 && <div style={{ textAlign:"center", color:"#333", padding:"40px 0", fontSize:13 }}>Keine Einträge gefunden.</div>}
          </div>
        )}

        {/* ═══════════════════ SPAREN ═══════════════════ */}
        {ansicht === "sparen" && (
          <div style={{ ...s.sektion, paddingTop:20 }}>
            {/* Sparsumme gesamt */}
            <div style={{ ...s.karte, background:"linear-gradient(135deg, rgba(84,224,212,0.18), rgba(84,136,224,0.12))", border:"1px solid rgba(84,224,212,0.25)", marginBottom:20 }}>
              <div style={{ fontSize:11, color:"rgba(84,224,212,0.7)", marginBottom:4 }}>Gesamt gespart</div>
              <div style={{ fontSize:34, fontWeight:800, letterSpacing:"-0.03em", fontFamily:"'DM Mono',monospace", color:"#54e0d4" }}>
                €{stats.sparGesamt.toLocaleString("de-DE",{minimumFractionDigits:2})}
              </div>
              <div style={{ fontSize:12, color:"rgba(84,224,212,0.5)", marginTop:6 }}>Diesen Monat: €{stats.gesparterMonat.toLocaleString("de-DE",{minimumFractionDigits:2})}</div>
            </div>

            {/* Sparverlauf */}
            <div style={{ ...s.glas, padding:"16px", marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Sparverlauf</div>
              <SparkLine data={stats.sparVerlauf.map(m=>m.wert)} farbe="#54e0d4" />
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                {stats.sparVerlauf.map(m => <span key={m.label} style={{ fontSize:9, color:"#444" }}>{m.label}</span>)}
              </div>
            </div>

            {/* Sparziele */}
            <div style={{ fontSize:11, color:"#555", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>Sparziele</div>
            {sparziele.map(sz => {
              const pct = Math.min(100, (sz.aktuell / sz.ziel) * 100);
              return (
                <div key={sz.id} style={{ ...s.glas, padding:"16px", marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <div style={{ fontSize:14, fontWeight:600 }}>{sz.name}</div>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, color:"#54e0d4" }}>€{(sz.aktuell||0).toLocaleString("de-DE",{minimumFractionDigits:0})} / €{sz.ziel.toLocaleString("de-DE")}</span>
                  </div>
                  <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:6, height:6, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${pct}%`, background:sz.farbe||"#54e0d4", borderRadius:6, transition:"width 0.5s ease" }} />
                  </div>
                  <div style={{ fontSize:11, color:"#555", marginTop:4 }}>{Math.round(pct)}% erreicht</div>
                </div>
              );
            })}

            {/* Neues Sparziel */}
            <div style={{ ...s.glas, padding:"16px", marginTop:10 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Neues Sparziel</div>
              <div style={{ marginBottom:10 }}>
                <label style={s.label}>Name</label>
                <input style={s.input} placeholder="z.B. Urlaub" value={neuesSparZiel.name} onChange={e => setNeuesSparZiel(s => ({...s, name:e.target.value}))} />
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={s.label}>Zielbetrag (€)</label>
                <input style={s.input} placeholder="0,00" type="number" value={neuesSparZiel.ziel} onChange={e => setNeuesSparZiel(s => ({...s, ziel:e.target.value}))} />
              </div>
              <button style={s.btn()} onClick={sparZielSpeichern}>Sparziel anlegen</button>
            </div>

            {/* Alle Spar-Einträge */}
            <div style={{ fontSize:11, color:"#555", marginTop:20, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>Buchungen</div>
            {einträge.filter(e => e.kategorie === "sparen").slice(0,10).map(e => (
              <div key={e.id} style={{ ...s.glas, padding:"12px 16px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600 }}>{e.name}</div>
                  <div style={{ fontSize:11, color:"#555" }}>{datumFmt(e.datum)}</div>
                </div>
                <span style={{ fontFamily:"'DM Mono',monospace", color:"#54e0d4", fontSize:14 }}>⇢ €{e.betrag.toLocaleString("de-DE",{minimumFractionDigits:2})}</span>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════ WIEDERKEHREND ═══════════════════ */}
        {ansicht === "wiederkehrend" && (
          <div style={{ ...s.sektion, paddingTop:20 }}>
            <div style={{ fontSize:13, color:"#555", marginBottom:20, lineHeight:1.6 }}>Monatliche Vorlagen · "Buchen" fügt sie mit heutigem Datum ein.</div>
            {wiederkehrend.length === 0 && <div style={{ textAlign:"center", color:"#333", padding:"40px 0", fontSize:13 }}>Noch keine Vorlagen.<br/>Toggle "Monatlich" beim Erfassen aktivieren.</div>}
            {wiederkehrend.map(r => (
              <div key={r.id} style={{ ...s.glas, padding:"16px", marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                    <div style={{ width:38, height:38, borderRadius:10, background:`${KAT_MAP[r.kategorie]?.farbe||"#888"}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>
                      {KAT_MAP[r.kategorie]?.icon}
                    </div>
                    <div>
                      <div style={{ fontSize:15, fontWeight:600 }}>{r.name}</div>
                      <div style={{ fontSize:11, color:"#555" }}>{KAT_MAP[r.kategorie]?.label} · {r.typ}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
                    <span style={{ fontFamily:"'DM Mono',monospace", color:"#e07b54", fontSize:14 }}>€{r.betrag.toLocaleString("de-DE",{minimumFractionDigits:2})}</span>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={() => wiederkehrendBuchen(r)} style={{ background:"rgba(84,224,138,0.12)", border:"1px solid rgba(84,224,138,0.2)", color:"#54e08a", borderRadius:8, padding:"5px 12px", fontSize:12, cursor:"pointer", fontFamily:"'Syne',sans-serif" }}>Buchen</button>
                      <button onClick={async () => {
                        if (!confirm("Vorlage löschen?")) return;
                        if (demoModus) {
                          const aktuell = (lokalDaten.wiederkehrend||[]).filter(x => x.id !== r.id);
                          setLokalDaten(d => ({...d, wiederkehrend:aktuell}));
                          setWiederkehrend(aktuell);
                        } else {
                          await sb(`/wiederkehrend?id=eq.${r.id}`, { method:"DELETE", prefer:"" });
                          await ladeDaten();
                        }
                      }} style={{ background:"rgba(224,84,84,0.1)", border:"none", color:"#e05454", borderRadius:8, padding:"5px 10px", fontSize:12, cursor:"pointer" }}>✕</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── BOTTOM NAV ── */}
        <nav style={s.nav}>
          {[
            { id:"dashboard", icon:"⬡", label:"Übersicht" },
            { id:"einträge", icon:"↕", label:"Einträge" },
            { id:"sparen", icon:"🏦", label:"Sparen" },
            { id:"wiederkehrend", icon:"↺", label:"Monatlich" },
          ].map(n => (
            <div key={n.id} style={s.navItem(ansicht===n.id)} onClick={() => setAnsicht(n.id)}>
              <span style={{ fontSize:18 }}>{n.icon}</span>
              <span style={{ fontSize:9, fontWeight:600, letterSpacing:"0.03em" }}>{n.label}</span>
            </div>
          ))}
        </nav>
      </div>
    </>
  );
}
