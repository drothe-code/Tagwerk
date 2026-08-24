/* Kombinierte Wochenauswertung als eine eigenständige, druckbare Seite (PDF).
   Aufbau: 1) Wochenübersicht (Gesamt gearbeitet + Vorankommen/Beschäftigt/Pause
   + Kategorien), 2) Tag für Tag mit Zeiten und Notizen. Enthält einen
   „Als PDF sichern/Drucken"-Knopf. Geteilt via Share-Sheet (AirDrop). */

const pad = (n) => String(n).padStart(2, "0");
const clock = (ts) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtDur = (ms) => {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}:${pad(m % 60)} h` : `${m} min`;
};
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const pctOf = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

const KIND_LABEL = {
  produktiv: "Vorankommen",
  beschaeftigt: "Beschäftigt",
  pause: "Pause",
};

/* data = {
     range, summary:{workedMs,vorMs,busyMs,pauseMs},
     perCat:[{name,color,kind,ms}],
     days:[{title,dateShort,ms,entries:[{start,end,ms,color,name,note}]}]
   } */
export function buildWeekPDFHTML(data) {
  const { range } = data;
  const s = data.summary || { workedMs: 0, vorMs: 0, busyMs: 0, pauseMs: 0 };
  const perCat = data.perCat || [];
  const days = data.days || [];

  const vorW = pctOf(s.vorMs, s.workedMs);
  const busyW = 100 - vorW;

  const catRows = perCat
    .map((c) => {
      const kl = KIND_LABEL[c.kind] || "Vorankommen";
      const kc =
        c.kind === "produktiv" ? "k-vor" : c.kind === "pause" ? "k-pause" : "k-busy";
      return `<div class="crow">
        <span class="dot" style="background:${esc(c.color)}"></span>
        <span class="cname">${esc(c.name)}</span>
        <span class="badge ${kc}">${kl}</span>
        <span class="num cdur">${fmtDur(c.ms)}</span>
      </div>`;
    })
    .join("");

  const dayBlocks = days
    .map((d) => {
      if (!d.entries.length) {
        return `<div class="day empty">
          <div class="dhead"><span class="dtitle">${esc(d.title)}</span><span class="ddate">${esc(
          d.dateShort
        )}</span><span class="dtot">—</span></div>
        </div>`;
      }
      const rows = d.entries
        .slice()
        .sort((a, b) => a.start - b.start)
        .map((e) => {
          const note = e.note
            ? `<span class="enote">${esc(e.note)}</span>`
            : "";
          return `<div class="e">
            <span class="etime">${clock(e.start)}–${clock(e.end)}</span>
            <span class="dot" style="background:${esc(e.color)}"></span>
            <span class="emid"><span class="ecat">${esc(e.name)}</span>${note}</span>
            <span class="num edur">${fmtDur(e.ms)}</span>
          </div>`;
        })
        .join("");
      const dv = d.vorMs || 0;
      const db = d.busyMs || 0;
      const dp = d.pauseMs || 0;
      const split = `<div class="dsplit">
        <span class="sd" style="background:#1F3D37"></span>Vorankommen ${fmtDur(dv)}
        <span class="sd" style="background:#6B7A76"></span>Beschäftigt ${fmtDur(db)}${
        dp > 0 ? ` <span class="sd" style="background:#8A9A95"></span>Pause ${fmtDur(dp)}` : ""
      }
      </div>`;
      return `<div class="day">
        <div class="dhead"><span class="dtitle">${esc(d.title)}</span><span class="ddate">${esc(
        d.dateShort
      )}</span><span class="dtot num">${fmtDur(d.ms)}</span></div>
        ${split}
        ${rows}
      </div>`;
    })
    .join("");

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tagwerk – Wochenauswertung ${esc(range)}</title>
<style>
  :root{ --bg:#E9EDEA; --surface:#FFFFFF; --ink:#131A18; --muted:#6B7A76;
         --line:#D3DAD6; --pine:#1F3D37; }
  *{ box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body{ margin:0; background:var(--bg); color:var(--ink);
        font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  .num{ font-variant-numeric:tabular-nums;
        font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  .wrap{ max-width:720px; margin:0 auto; padding:24px 20px 48px; }
  .top{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:20px; }
  .brand{ font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
          letter-spacing:.16em; text-transform:uppercase; color:var(--pine); font-size:13px; }
  .range{ font-size:16px; font-weight:600; margin-top:4px; }
  .pdfbtn{ background:var(--pine); color:#fff; border:0; border-radius:10px;
           padding:10px 16px; font-size:14px; font-weight:600; cursor:pointer; white-space:nowrap; }
  h2{ font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted);
      margin:0 0 10px; font-weight:600; }
  .card{ background:var(--surface); border:1px solid var(--line); border-radius:14px;
         padding:18px; margin-bottom:16px; }
  .worked{ display:flex; align-items:baseline; justify-content:space-between; }
  .worked .lbl{ font-size:15px; font-weight:600; }
  .worked .val{ font-size:30px; }
  .sub{ font-size:11px; color:var(--muted); margin:2px 0 14px; }
  .splitbar{ display:flex; height:12px; border-radius:6px; overflow:hidden; margin-bottom:12px; background:var(--bg); }
  .srow{ display:flex; align-items:center; gap:10px; padding:5px 0; }
  .srow .dot{ width:10px; height:10px; }
  .srow .nm{ flex:1; font-size:14px; }
  .srow .pct{ font-size:12px; color:var(--muted); width:44px; text-align:right; }
  .dot{ width:10px; height:10px; border-radius:50%; flex:none; display:inline-block; }
  hr{ border:0; border-top:1px solid var(--line); margin:14px 0; }
  .crow{ display:flex; align-items:center; gap:10px; padding:5px 0; }
  .crow .cname{ flex:1; font-size:14px; }
  .crow .cdur{ font-size:13px; }
  .badge{ font-size:10px; padding:2px 8px; border-radius:999px; white-space:nowrap; }
  .k-vor{ background:#E2ECE9; color:#1F3D37; }
  .k-busy{ background:#ECEEF0; color:#475569; }
  .k-pause{ background:#EDEFEE; color:#8A9A95; }
  .day{ background:var(--surface); border:1px solid var(--line); border-radius:12px;
        padding:12px 14px; margin-bottom:10px; break-inside:avoid; }
  .day.empty{ padding:10px 14px; opacity:.7; }
  .dhead{ display:flex; align-items:baseline; gap:8px; padding-bottom:6px; border-bottom:1px solid var(--line); margin-bottom:6px; }
  .day.empty .dhead{ border-bottom:0; margin-bottom:0; padding-bottom:0; }
  .dtitle{ font-size:14px; font-weight:600; }
  .ddate{ font-size:12px; color:var(--muted); font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  .dtot{ margin-left:auto; font-size:14px; }
  .dsplit{ font-size:11px; color:var(--muted); margin:6px 0 8px; display:flex; flex-wrap:wrap; align-items:center; gap:4px 6px; }
  .dsplit .sd{ width:8px; height:8px; border-radius:50%; display:inline-block; margin-left:6px; }
  .dsplit .sd:first-child{ margin-left:0; }
  .e{ display:flex; align-items:flex-start; gap:10px; padding:5px 0; }
  .etime{ font-size:11px; color:var(--muted); width:82px; flex:none; padding-top:1px;
          font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  .e .dot{ margin-top:5px; }
  .emid{ flex:1; min-width:0; }
  .ecat{ font-size:14px; font-weight:600; }
  .enote{ display:block; font-size:13px; color:var(--muted); margin-top:1px; }
  .edur{ font-size:13px; white-space:nowrap; padding-top:1px; }
  .foot{ margin-top:22px; font-size:11px; color:var(--muted); text-align:center; }
  @media print{
    @page{ size:A4 portrait; margin:14mm; }
    body{ background:#fff; }
    .pdfbtn{ display:none; }
    .wrap{ max-width:none; padding:0; }
    .card,.day{ box-shadow:none; }
  }
</style></head>
<body><div class="wrap">
  <div class="top">
    <div>
      <div class="brand">Tagwerk · Wochenauswertung</div>
      <div class="range">Woche ${esc(range)}</div>
    </div>
    <button class="pdfbtn" onclick="window.print()">Als PDF sichern / Drucken</button>
  </div>

  <h2>Wochenübersicht</h2>
  <div class="card">
    <div class="worked"><span class="lbl">Gesamt gearbeitet</span><span class="val num">${fmtDur(
      s.workedMs
    )}</span></div>
    <div class="sub">ohne Pause</div>
    <div class="splitbar">
      <span style="background:var(--pine);width:${vorW}%"></span>
      <span style="background:var(--muted);width:${busyW}%"></span>
    </div>
    <div class="srow"><span class="dot" style="background:#1F3D37"></span><span class="nm">Vorankommen</span><span class="num">${fmtDur(
      s.vorMs
    )}</span><span class="num pct">${pctOf(s.vorMs, s.workedMs)}%</span></div>
    <div class="srow"><span class="dot" style="background:#6B7A76"></span><span class="nm">Nur beschäftigt</span><span class="num">${fmtDur(
      s.busyMs
    )}</span><span class="num pct">${pctOf(s.busyMs, s.workedMs)}%</span></div>
    ${
      s.pauseMs > 0
        ? `<div class="srow" style="color:var(--muted)"><span class="dot" style="background:#8A9A95"></span><span class="nm">Pause (zählt nicht)</span><span class="num">${fmtDur(
            s.pauseMs
          )}</span><span class="pct"></span></div>`
        : ""
    }
    <hr>
    ${catRows}
  </div>

  <h2>Tag für Tag</h2>
  ${dayBlocks}

  <div class="foot">Erstellt mit Tagwerk · Woche ${esc(range)}</div>
</div></body></html>`;
}
