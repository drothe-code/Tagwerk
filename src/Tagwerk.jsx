import React, { useState, useEffect, useMemo, useRef } from "react";
import { load, save } from "./storage.js";
import { shareWeekReport } from "./report.js";
import { buildWeekCSV, shareCSV } from "./csv.js";
import { buildWeekPDFHTML } from "./weekpdf.js";

/* ---------- Tokens ---------- */
const C = {
  bg: "#E9EDEA",
  surface: "#FFFFFF",
  ink: "#131A18",
  muted: "#6B7A76",
  line: "#D3DAD6",
  pine: "#1F3D37",
  pineSoft: "#2E574F",
};

const DEFAULT_CATS = [
  { id: "leads", name: "Leads telefonieren", color: "#4338CA", asksNote: false, kind: "produktiv" },
  { id: "makler", name: "Makler-Akquise", color: "#0F766E", asksNote: false, kind: "produktiv" },
  { id: "fina", name: "Finanzierung bearbeiten", color: "#B45309", asksNote: true, kind: "produktiv" },
  { id: "termin", name: "Kundentermin", color: "#BE123C", asksNote: true, kind: "produktiv" },
  { id: "admin", name: "Admin & Orga", color: "#475569", asksNote: false, kind: "beschaeftigt" },
  { id: "entw", name: "Weiterentwicklung", color: "#6D28D9", asksNote: false, kind: "beschaeftigt" },
  { id: "pause", name: "Pause", color: "#8A9A95", asksNote: false, kind: "pause" },
];

// Einstufung einer Kategorie: produktiv (Vorankommen) | beschaeftigt | pause (zählt nicht)
const kindOf = (c) => (c && c.kind ? c.kind : c && c.id === "pause" ? "pause" : "produktiv");
const KIND_OPTS = [
  ["produktiv", "Vorankommen"],
  ["beschaeftigt", "Nur beschäftigt"],
  ["pause", "Zählt nicht"],
];

/* ---------- Helpers ---------- */
const uid = () => Math.random().toString(36).slice(2, 10);
const pad = (n) => String(n).padStart(2, "0");

function fmtClock(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtDur(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}:${pad(m % 60)} h` : `${m} min`;
}
function fmtHours(ms) {
  const h = ms / 3600000;
  return h.toFixed(1).replace(".", ",");
}
function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function startOfWeek(ts) {
  const d = new Date(startOfDay(ts));
  const wd = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - wd);
  return d.getTime();
}
function setTimeOnDate(baseTs, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(baseTs);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}
const DAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const dateLabel = (ts) =>
  new Date(ts).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" });

/* ---------- App ---------- */
export default function Tagwerk() {
  const [cats, setCats] = useState(DEFAULT_CATS);
  const [entries, setEntries] = useState([]);
  const [tab, setTab] = useState("jetzt");
  const [showSettings, setShowSettings] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("ok");
  const [now, setNow] = useState(Date.now());
  const [viewDay, setViewDay] = useState(startOfDay(Date.now()));
  const [weekStart, setWeekStart] = useState(startOfWeek(Date.now()));
  const firstSave = useRef(true);

  /* load – synchron aus localStorage */
  useEffect(() => {
    try {
      const data = load();
      if (data) {
        if (Array.isArray(data.cats) && data.cats.length) setCats(data.cats);
        if (Array.isArray(data.entries)) setEntries(data.entries);
      }
    } catch (e) {
      /* noch nichts gespeichert */
    }
    setLoaded(true);
  }, []);

  /* save – nach localStorage */
  useEffect(() => {
    if (!loaded) return;
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    try {
      setSaveState("saving");
      save({ cats, entries });
      setSaveState("ok");
    } catch (e) {
      setSaveState("error");
    }
  }, [cats, entries, loaded]);

  /* ticking clock */
  const active = entries.find((e) => e.end == null);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  const catById = useMemo(() => Object.fromEntries(cats.map((c) => [c.id, c])), [cats]);

  /* actions */
  function switchTo(catId) {
    const t = Date.now();
    setEntries((prev) => {
      const next = prev.map((e) => (e.end == null ? { ...e, end: t } : e));
      // Kein Null-Eintrag: falls gerade dieselbe Kategorie lief, einfach weiterlaufen lassen
      const wasActive = prev.find((e) => e.end == null);
      if (wasActive && wasActive.catId === catId) return prev;
      return [...next.filter((e) => e.end - e.start >= 30000 || e.note), { id: uid(), catId, note: "", start: t, end: null }];
    });
    setViewDay(startOfDay(t));
  }
  function stopActive() {
    const t = Date.now();
    setEntries((prev) =>
      prev
        .map((e) => (e.end == null ? { ...e, end: t } : e))
        .filter((e) => e.end - e.start >= 30000 || e.note)
    );
  }
  const update = (id, patch) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const remove = (id) => setEntries((prev) => prev.filter((e) => e.id !== id));
  function addManual(dayTs, startHHMM, endHHMM, catId) {
    const s = setTimeOnDate(dayTs, startHHMM);
    let en = setTimeOnDate(dayTs, endHHMM);
    if (en <= s) en = s + 15 * 60000;
    setEntries((prev) => [...prev, { id: uid(), catId, note: "", start: s, end: en }]);
  }

  if (!loaded) {
    return (
      <div style={{ background: C.bg, color: C.muted }} className="min-h-screen flex items-center justify-center font-sans text-sm">
        Lade Zeiten …
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, color: C.ink }} className="min-h-screen font-sans pb-24">
      <style>{`
        input[type="time"]{ font-variant-numeric: tabular-nums; }
        .tw-btn:active{ transform: scale(0.985); }
        @media (prefers-reduced-motion: reduce){ *{ transition:none !important; } }
      `}</style>

      {/* Header */}
      <header style={{ background: C.pine }} className="px-5 pt-6 pb-5 text-white">
        <div className="flex items-baseline justify-between">
          <h1 className="font-mono text-lg tracking-widest uppercase">Tagwerk</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs opacity-60">
              {saveState === "error" ? "Nicht gespeichert" : saveState === "saving" ? "sichert …" : "gesichert"}
            </span>
            <button
              onClick={() => setShowSettings(true)}
              className="tw-btn text-lg leading-none opacity-85"
              aria-label="Einstellungen"
            >
              ⚙
            </button>
          </div>
        </div>
        <ActiveBar active={active} cat={active ? catById[active.catId] : null} now={now} />
      </header>

      <main className="px-4 pt-4">
        {tab === "jetzt" && (
          <JetztView
            cats={cats}
            active={active}
            now={now}
            onSwitch={switchTo}
            onStop={stopActive}
            onNote={(v) => active && update(active.id, { note: v })}
          />
        )}
        {tab === "tag" && (
          <TagView
            entries={entries}
            catById={catById}
            cats={cats}
            viewDay={viewDay}
            setViewDay={setViewDay}
            now={now}
            update={update}
            remove={remove}
            addManual={addManual}
          />
        )}
        {tab === "woche" && (
          <WocheView
            entries={entries}
            cats={cats}
            catById={catById}
            weekStart={weekStart}
            setWeekStart={setWeekStart}
            now={now}
          />
        )}
      </main>

      {/* Tabs */}
      <nav
        style={{ background: C.surface, borderColor: C.line }}
        className="fixed bottom-0 left-0 right-0 border-t grid grid-cols-3"
      >
        {[
          ["jetzt", "Jetzt"],
          ["tag", "Tag"],
          ["woche", "Woche"],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="py-4 text-sm font-medium"
            style={{
              color: tab === k ? C.pine : C.muted,
              boxShadow: tab === k ? `inset 0 3px 0 ${C.pine}` : "none",
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {showSettings && (
        <SettingsView cats={cats} setCats={setCats} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

/* ---------- Einstellungen ---------- */
function SettingsView({ cats, setCats, onClose }) {
  return (
    <div className="fixed inset-0 z-30 overflow-y-auto" style={{ background: C.bg }}>
      <header
        style={{ background: C.pine }}
        className="px-5 pt-6 pb-4 text-white sticky top-0 z-10"
      >
        <div className="flex items-center justify-between">
          <h1 className="font-mono text-lg tracking-widest uppercase">Einstellungen</h1>
          <button onClick={onClose} className="tw-btn text-sm underline opacity-90">
            Fertig
          </button>
        </div>
      </header>
      <div className="px-4 py-4 pb-16">
        <div className="text-xs uppercase tracking-wider mb-2" style={{ color: C.muted }}>
          Kategorien
        </div>
        <p className="text-xs mb-3 leading-relaxed" style={{ color: C.muted }}>
          Farbe, Name und Einstufung festlegen. Die Einstufung bestimmt die Wochenauswertung:
          {" "}
          <b>Vorankommen</b> = bringt dich voran · <b>Nur beschäftigt</b> = nötig, aber kein
          Fortschritt · <b>Zählt nicht</b> = keine Arbeitszeit (z. B. Pause).
        </p>
        <CatEditor cats={cats} setCats={setCats} />
      </div>
    </div>
  );
}

/* ---------- Laufende Tätigkeit im Header ---------- */
function ActiveBar({ active, cat, now }) {
  if (!active || !cat) {
    return (
      <div className="mt-4 text-sm opacity-70">Nichts läuft gerade. Tippe unten eine Tätigkeit an.</div>
    );
  }
  const ms = now - active.start;
  return (
    <div className="mt-4 flex items-end gap-3">
      <span className="inline-block w-3 h-3 rounded-full mb-2" style={{ background: cat.color }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{cat.name}</div>
        {active.note ? <div className="text-xs opacity-60 truncate">{active.note}</div> : null}
      </div>
      <div className="font-mono text-3xl leading-none tabular-nums">{fmtDur(ms)}</div>
    </div>
  );
}

/* ---------- Jetzt ---------- */
function JetztView({ cats, active, now, onSwitch, onStop, onNote }) {
  const cat = active ? cats.find((c) => c.id === active.catId) : null;

  return (
    <div>
      {active && (
        <div style={{ background: C.surface, borderColor: C.line }} className="border rounded-xl p-4 mb-4">
          <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: C.muted }}>
            Woran genau? (optional)
          </label>
          <input
            value={active.note}
            onChange={(e) => onNote(e.target.value)}
            placeholder={cat?.asksNote ? "z. B. Müller – Nideggen, Antrag an ING" : "Notiz"}
            className="w-full text-base outline-none bg-transparent border-b pb-2"
            style={{ borderColor: C.line }}
          />
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs" style={{ color: C.muted }}>
              seit {fmtClock(active.start)}
            </span>
            <button
              onClick={onStop}
              className="tw-btn px-4 py-2 rounded-lg text-sm font-medium border"
              style={{ borderColor: C.line, color: C.pine }}
            >
              Feierabend / Stopp
            </button>
          </div>
        </div>
      )}

      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: C.muted }}>
        {active ? "Wechseln zu" : "Starten"}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {cats.map((c) => {
          const on = active && active.catId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onSwitch(c.id)}
              className="tw-btn text-left rounded-xl px-3 py-4 border"
              style={{
                background: on ? c.color : C.surface,
                borderColor: on ? c.color : C.line,
                color: on ? "#fff" : C.ink,
              }}
            >
              <span
                className="block w-6 h-1 rounded mb-2"
                style={{ background: on ? "rgba(255,255,255,.7)" : c.color }}
              />
              <span className="text-sm font-medium leading-snug">{c.name}</span>
            </button>
          );
        })}
      </div>

    </div>
  );
}

function CatEditor({ cats, setCats }) {
  const PALETTE = ["#4338CA", "#0F766E", "#B45309", "#BE123C", "#475569", "#6D28D9", "#0369A1", "#7C2D12"];
  return (
    <div style={{ background: C.surface, borderColor: C.line }} className="border rounded-xl p-3 mt-3">
      {cats.map((c, i) => (
        <div key={c.id} className="py-2 border-b last:border-b-0" style={{ borderColor: C.line }}>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={c.color}
              onChange={(e) =>
                setCats(cats.map((x) => (x.id === c.id ? { ...x, color: e.target.value } : x)))
              }
              className="w-7 h-7 rounded border-0 bg-transparent p-0"
            />
            <input
              value={c.name}
              onChange={(e) =>
                setCats(cats.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))
              }
              className="flex-1 text-sm outline-none bg-transparent border-b pb-1"
              style={{ borderColor: C.line }}
            />
            <button
              onClick={() => setCats(cats.filter((x) => x.id !== c.id))}
              className="text-xs px-2 py-1"
              style={{ color: C.muted }}
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2 pl-9">
            <span className="text-xs" style={{ color: C.muted }}>
              Zählt als
            </span>
            <select
              value={kindOf(c)}
              onChange={(e) =>
                setCats(cats.map((x) => (x.id === c.id ? { ...x, kind: e.target.value } : x)))
              }
              className="text-xs border rounded px-2 py-1 bg-transparent"
              style={{ borderColor: C.line }}
            >
              {KIND_OPTS.map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      ))}
      <button
        onClick={() =>
          setCats([
            ...cats,
            { id: uid(), name: "Neue Kategorie", color: PALETTE[cats.length % PALETTE.length], asksNote: true, kind: "produktiv" },
          ])
        }
        className="mt-2 text-sm font-medium"
        style={{ color: C.pine }}
      >
        + Kategorie
      </button>
    </div>
  );
}

/* ---------- Tag ---------- */
function TagView({ entries, catById, cats, viewDay, setViewDay, now, update, remove, addManual }) {
  const dk = dayKey(viewDay);
  const day = entries
    .filter((e) => dayKey(e.start) === dk)
    .sort((a, b) => a.start - b.start);
  const total = day.reduce((s, e) => s + ((e.end ?? now) - e.start), 0);
  const [adding, setAdding] = useState(null); // {start,end}

  const rows = [];
  day.forEach((e, i) => {
    const prev = day[i - 1];
    if (prev && prev.end && e.start - prev.end > 5 * 60000) {
      rows.push({ gap: true, from: prev.end, to: e.start, key: "g" + e.id });
    }
    rows.push({ entry: e, key: e.id });
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setViewDay(viewDay - 86400000)} className="px-3 py-2 text-lg" style={{ color: C.muted }}>‹</button>
        <div className="text-center">
          <div className="text-sm font-medium">{dateLabel(viewDay)}</div>
          <div className="font-mono text-xs" style={{ color: C.muted }}>{fmtHours(total)} h erfasst</div>
        </div>
        <button
          onClick={() => setViewDay(Math.min(viewDay + 86400000, startOfDay(Date.now())))}
          className="px-3 py-2 text-lg"
          style={{ color: C.muted }}
        >›</button>
      </div>

      {day.length === 0 && (
        <div style={{ background: C.surface, borderColor: C.line }} className="border rounded-xl p-6 text-center">
          <p className="text-sm" style={{ color: C.muted }}>Für diesen Tag ist nichts erfasst.</p>
          <button
            onClick={() => setAdding({ start: "09:00", end: "10:00" })}
            className="mt-3 text-sm font-medium"
            style={{ color: C.pine }}
          >
            Eintrag nachtragen
          </button>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((r) =>
          r.gap ? (
            <button
              key={r.key}
              onClick={() =>
                setAdding({ start: fmtClock(r.from), end: fmtClock(r.to) })
              }
              className="w-full text-left rounded-xl px-3 py-3 border border-dashed text-xs"
              style={{ borderColor: C.line, color: C.muted }}
            >
              Lücke {fmtClock(r.from)}–{fmtClock(r.to)} · {fmtDur(r.to - r.from)} — nachtragen
            </button>
          ) : (
            <EntryRow
              key={r.key}
              e={r.entry}
              cat={catById[r.entry.catId]}
              cats={cats}
              now={now}
              viewDay={viewDay}
              update={update}
              remove={remove}
            />
          )
        )}
      </div>

      {day.length > 0 && (
        <button
          onClick={() => {
            const last = day[day.length - 1];
            const s = last.end ? fmtClock(last.end) : "09:00";
            setAdding({ start: s, end: s });
          }}
          className="mt-3 text-sm font-medium"
          style={{ color: C.pine }}
        >
          + Eintrag nachtragen
        </button>
      )}

      {adding && (
        <AddDialog
          cats={cats}
          init={adding}
          onCancel={() => setAdding(null)}
          onSave={(s, e, cid) => {
            addManual(viewDay, s, e, cid);
            setAdding(null);
          }}
        />
      )}
    </div>
  );
}

function EntryRow({ e, cat, cats, now, viewDay, update, remove }) {
  const [open, setOpen] = useState(false);
  const end = e.end ?? now;
  const dur = end - e.start;
  const h = Math.max(56, Math.min(150, 56 + dur / 60000 / 2));

  return (
    <div
      style={{ background: C.surface, borderColor: C.line }}
      className="border rounded-xl overflow-hidden"
    >
      <button onClick={() => setOpen((v) => !v)} className="w-full flex text-left">
        <span style={{ background: cat?.color ?? C.muted, width: 6, minHeight: h }} />
        <span className="flex-1 px-3 py-3">
          <span className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-xs tabular-nums" style={{ color: C.muted }}>
              {fmtClock(e.start)}–{e.end ? fmtClock(e.end) : "läuft"}
            </span>
            <span className="font-mono text-sm tabular-nums">{fmtDur(dur)}</span>
          </span>
          <span className="block text-sm font-medium mt-1">{cat?.name ?? "Gelöschte Kategorie"}</span>
          {e.note ? <span className="block text-xs mt-0.5" style={{ color: C.muted }}>{e.note}</span> : null}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1" style={{ borderTop: `1px solid ${C.line}` }}>
          <input
            value={e.note}
            onChange={(ev) => update(e.id, { note: ev.target.value })}
            placeholder="Woran genau? z. B. Schmidt – Unterlagen an Sparkasse"
            className="w-full text-sm outline-none bg-transparent border-b py-2"
            style={{ borderColor: C.line }}
          />
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <input
              type="time"
              value={fmtClock(e.start)}
              onChange={(ev) => update(e.id, { start: setTimeOnDate(e.start, ev.target.value) })}
              className="text-sm border rounded px-2 py-1"
              style={{ borderColor: C.line }}
            />
            <span style={{ color: C.muted }}>–</span>
            <input
              type="time"
              value={fmtClock(end)}
              onChange={(ev) => update(e.id, { end: setTimeOnDate(e.start, ev.target.value) })}
              className="text-sm border rounded px-2 py-1"
              style={{ borderColor: C.line }}
            />
            <select
              value={e.catId}
              onChange={(ev) => update(e.id, { catId: ev.target.value })}
              className="text-sm border rounded px-2 py-1 flex-1"
              style={{ borderColor: C.line }}
            >
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button onClick={() => remove(e.id)} className="mt-3 text-xs" style={{ color: "#BE123C" }}>
            Eintrag löschen
          </button>
        </div>
      )}
    </div>
  );
}

function AddDialog({ cats, init, onCancel, onSave }) {
  const [s, setS] = useState(init.start);
  const [e, setE] = useState(init.end);
  const [cid, setCid] = useState(cats[0]?.id);
  return (
    <div className="fixed inset-0 z-20 flex items-end" style={{ background: "rgba(19,26,24,.45)" }}>
      <div style={{ background: C.surface }} className="w-full rounded-t-2xl p-5">
        <h3 className="text-base font-medium mb-4">Eintrag nachtragen</h3>
        <div className="flex items-center gap-2 mb-3">
          <input type="time" value={s} onChange={(ev) => setS(ev.target.value)} className="text-base border rounded px-2 py-2 flex-1" style={{ borderColor: C.line }} />
          <span style={{ color: C.muted }}>–</span>
          <input type="time" value={e} onChange={(ev) => setE(ev.target.value)} className="text-base border rounded px-2 py-2 flex-1" style={{ borderColor: C.line }} />
        </div>
        <select value={cid} onChange={(ev) => setCid(ev.target.value)} className="w-full text-base border rounded px-2 py-2 mb-5" style={{ borderColor: C.line }}>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-3 rounded-lg border text-sm" style={{ borderColor: C.line, color: C.muted }}>
            Abbrechen
          </button>
          <button onClick={() => onSave(s, e, cid)} className="flex-1 py-3 rounded-lg text-sm text-white" style={{ background: C.pine }}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Woche ---------- */
function WocheView({ entries, cats, catById, weekStart, setWeekStart, now }) {
  const weekEnd = weekStart + 7 * 86400000;
  const week = entries.filter((e) => e.start >= weekStart && e.start < weekEnd);
  const dur = (e) => (e.end ?? now) - e.start;
  const total = week.reduce((s, e) => s + dur(e), 0);

  const perCat = cats
    .map((c) => {
      const list = week.filter((e) => e.catId === c.id);
      const ms = list.reduce((s, e) => s + dur(e), 0);
      const notes = {};
      list.forEach((e) => {
        if (!e.note.trim()) return;
        notes[e.note.trim()] = (notes[e.note.trim()] || 0) + dur(e);
      });
      return { c, ms, notes: Object.entries(notes).sort((a, b) => b[1] - a[1]) };
    })
    .filter((x) => x.ms > 0)
    .sort((a, b) => b.ms - a.ms);

  const perDay = DAY_NAMES.map((n, i) => {
    const ds = weekStart + i * 86400000;
    const de = ds + 86400000;
    const list = week.filter((e) => e.start >= ds && e.start < de);
    return { n, ms: list.reduce((s, e) => s + dur(e), 0), list };
  });
  const maxDay = Math.max(1, ...perDay.map((d) => d.ms));

  // Einstufung: gearbeitet (ohne Pause) + Aufteilung Vorankommen / nur beschäftigt
  const kindMs = (k) => perCat.filter(({ c }) => kindOf(c) === k).reduce((s, x) => s + x.ms, 0);
  const vorMs = kindMs("produktiv");
  const busyMs = kindMs("beschaeftigt");
  const pauseMs = kindMs("pause");
  const workedMs = vorMs + busyMs;
  const summary = { workedMs, vorMs, busyMs, pauseMs };

  const range = `${new Date(weekStart).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} – ${new Date(weekEnd - 86400000).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`;

  async function exportWeek() {
    const days = perDay.map((d, i) => {
      const dObj = new Date(weekStart + i * 86400000);
      return {
        title: dObj.toLocaleDateString("de-DE", { weekday: "long" }),
        dateShort: dObj.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
        ms: d.ms,
        entries: d.list.map((e) => ({
          start: e.start,
          end: e.end ?? now,
          ms: dur(e),
          color: catById[e.catId]?.color ?? C.muted,
          name: catById[e.catId]?.name ?? "Gelöschte Kategorie",
          note: e.note,
        })),
      };
    });
    const html = buildWeekPDFHTML({
      range,
      summary,
      perCat: perCat.map(({ c, ms }) => ({
        name: c.name,
        color: c.color,
        kind: kindOf(c),
        ms,
      })),
      days,
    });
    const fileRange = range.replace(/[^0-9]/g, "-").replace(/-+/g, "-");
    await shareWeekReport(`Tagwerk-Woche-${fileRange}.html`, html);
  }

  async function exportCSV() {
    const rows = week
      .slice()
      .sort((a, b) => a.start - b.start)
      .map((e) => ({
        start: e.start,
        end: e.end ?? now,
        ms: dur(e),
        cat: catById[e.catId]?.name ?? "Gelöschte Kategorie",
        note: e.note,
      }));
    const csv = buildWeekCSV(rows, total);
    const fileRange = range.replace(/[^0-9]/g, "-").replace(/-+/g, "-");
    await shareCSV(`Tagwerk-Woche-${fileRange}.csv`, csv);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setWeekStart(weekStart - 7 * 86400000)} className="px-3 py-2 text-lg" style={{ color: C.muted }}>‹</button>
        <div className="text-center">
          <div className="text-sm font-medium">Woche {range}</div>
          <div className="font-mono text-2xl tabular-nums mt-1">{fmtHours(total)} h</div>
        </div>
        <button
          onClick={() => setWeekStart(Math.min(weekStart + 7 * 86400000, startOfWeek(Date.now())))}
          className="px-3 py-2 text-lg"
          style={{ color: C.muted }}
        >›</button>
      </div>

      {total === 0 && (
        <div style={{ background: C.surface, borderColor: C.line }} className="border rounded-xl p-6 text-center text-sm">
          <span style={{ color: C.muted }}>In dieser Woche ist noch nichts erfasst.</span>
        </div>
      )}

      {total > 0 && (
        <div className="mb-4">
          <button
            onClick={exportWeek}
            className="tw-btn w-full py-3.5 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2"
            style={{ background: C.pine }}
          >
            <span aria-hidden="true">📄</span> Wochenauswertung erstellen (PDF)
          </button>
          <button
            onClick={exportCSV}
            className="mt-2 w-full text-xs underline"
            style={{ color: C.muted }}
          >
            Stattdessen als CSV-Tabelle
          </button>
        </div>
      )}

      {total > 0 && (
        <>
          {/* Anteile */}
          <div style={{ background: C.surface, borderColor: C.line }} className="border rounded-xl p-4 mb-4">
            <div className="flex h-3 rounded overflow-hidden mb-4">
              {perCat.map(({ c, ms }) => (
                <span key={c.id} style={{ background: c.color, width: `${(ms / total) * 100}%` }} />
              ))}
            </div>
            {perCat.map(({ c, ms }) => (
              <div key={c.id} className="flex items-center gap-3 py-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                <span className="text-sm flex-1 truncate">{c.name}</span>
                <span className="font-mono text-sm tabular-nums">{fmtDur(ms)}</span>
                <span className="font-mono text-xs tabular-nums w-10 text-right" style={{ color: C.muted }}>
                  {Math.round((ms / total) * 100)}%
                </span>
              </div>
            ))}

            {/* Gesamt gearbeitet + Aufteilung */}
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Gesamt gearbeitet</span>
                <span className="font-mono text-xl tabular-nums">{fmtDur(workedMs)}</span>
              </div>
              <div className="text-xs mb-2" style={{ color: C.muted }}>ohne Pause</div>
              <div className="flex items-center gap-3 py-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: C.pine }} />
                <span className="text-sm flex-1">Vorankommen</span>
                <span className="font-mono text-sm tabular-nums">{fmtDur(vorMs)}</span>
                <span className="font-mono text-xs tabular-nums w-10 text-right" style={{ color: C.muted }}>
                  {workedMs > 0 ? Math.round((vorMs / workedMs) * 100) : 0}%
                </span>
              </div>
              <div className="flex items-center gap-3 py-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: C.muted }} />
                <span className="text-sm flex-1">Nur beschäftigt</span>
                <span className="font-mono text-sm tabular-nums">{fmtDur(busyMs)}</span>
                <span className="font-mono text-xs tabular-nums w-10 text-right" style={{ color: C.muted }}>
                  {workedMs > 0 ? Math.round((busyMs / workedMs) * 100) : 0}%
                </span>
              </div>
              {pauseMs > 0 && (
                <div className="flex items-center gap-3 py-1" style={{ color: C.muted }}>
                  <span className="text-sm flex-1 pl-5">Pause (zählt nicht)</span>
                  <span className="font-mono text-sm tabular-nums">{fmtDur(pauseMs)}</span>
                  <span className="w-10" />
                </div>
              )}
            </div>
          </div>

          {/* Tage */}
          <div style={{ background: C.surface, borderColor: C.line }} className="border rounded-xl p-4 mb-4">
            <div className="text-xs uppercase tracking-wider mb-3" style={{ color: C.muted }}>
              Verlauf
            </div>
            {perDay.map((d) => (
              <div key={d.n} className="flex items-center gap-3 py-1">
                <span className="font-mono text-xs w-6" style={{ color: C.muted }}>{d.n}</span>
                <span className="flex-1 flex h-4 rounded overflow-hidden" style={{ background: C.bg }}>
                  {d.list
                    .slice()
                    .sort((a, b) => a.start - b.start)
                    .map((e) => (
                      <span
                        key={e.id}
                        style={{
                          background: catById[e.catId]?.color ?? C.muted,
                          width: `${(dur(e) / maxDay) * 100}%`,
                        }}
                      />
                    ))}
                </span>
                <span className="font-mono text-xs tabular-nums w-12 text-right">{fmtHours(d.ms)} h</span>
              </div>
            ))}
          </div>

          {/* Details je Kategorie */}
          {perCat.filter((x) => x.notes.length > 0).map(({ c, notes }) => (
            <div key={c.id} style={{ background: C.surface, borderColor: C.line }} className="border rounded-xl p-4 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                <span className="text-sm font-medium">{c.name}</span>
              </div>
              {notes.map(([n, ms]) => (
                <div key={n} className="flex items-baseline gap-3 py-1">
                  <span className="text-sm flex-1">{n}</span>
                  <span className="font-mono text-xs tabular-nums" style={{ color: C.muted }}>{fmtDur(ms)}</span>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
