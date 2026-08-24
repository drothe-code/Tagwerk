/* Wochen-Kalender als eigenständige HTML-Seite (Spalten Mo–So, Blöcke nach
   Uhrzeit von oben nach unten). Enthält einen „Als PDF / Drucken"-Knopf
   (window.print → Sichern als PDF / AirDrop). Geteilt via Share-Sheet. */

const pad = (n) => String(n).padStart(2, "0");
const minOfDay = (ts) => {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
};
const clock = (ts) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* data = { range, days:[{label,date,entries:[{start,end,color,name,note}]}] } */
export function buildWeekCalendarHTML(data) {
  const { range, days } = data;

  // Zeitfenster bestimmen: Standard 7–20 Uhr, bei Bedarf erweitern
  let minStart = 7 * 60;
  let maxEnd = 20 * 60;
  days.forEach((d) =>
    d.entries.forEach((e) => {
      const s = minOfDay(e.start);
      let en = minOfDay(e.end);
      if (en <= s) en = Math.min(24 * 60, s + 15); // Schutz gegen 0-Höhe
      minStart = Math.min(minStart, Math.floor(s / 60) * 60);
      maxEnd = Math.max(maxEnd, Math.ceil(en / 60) * 60);
    })
  );
  const rangeMin = maxEnd - minStart;
  const PX = 1.0; // Pixel pro Minute
  const colH = rangeMin * PX;

  // Stundenlinien + Achsenbeschriftung
  let hourLines = "";
  for (let m = minStart; m <= maxEnd; m += 60) {
    const top = (m - minStart) * PX;
    hourLines += `<div class="hline" style="top:${top}px"></div>`;
  }
  let axis = "";
  for (let m = minStart; m < maxEnd; m += 60) {
    const top = (m - minStart) * PX;
    axis += `<div class="hlabel" style="top:${top}px">${pad(m / 60)}:00</div>`;
  }

  const cols = days
    .map((d) => {
      const blocks = d.entries
        .slice()
        .sort((a, b) => a.start - b.start)
        .map((e) => {
          const s = minOfDay(e.start);
          let en = minOfDay(e.end);
          if (en <= s) en = Math.min(24 * 60, s + 15);
          const top = (s - minStart) * PX;
          const h = Math.max(14, (en - s) * PX);
          const noteLine = e.note
            ? `<span class="bnote">${esc(e.note)}</span>`
            : "";
          return `<div class="block" style="top:${top}px;height:${h}px;background:${esc(
            e.color
          )}">
            <span class="btime">${clock(e.start)}–${clock(e.end)}</span>
            <span class="bname">${esc(e.name)}</span>
            ${noteLine}
          </div>`;
        })
        .join("");
      return `<div class="col">
        <div class="colhead"><span class="dname">${esc(d.label)}</span><span class="ddate">${esc(
        d.date
      )}</span></div>
        <div class="colbody" style="height:${colH}px">${hourLines}${blocks}</div>
      </div>`;
    })
    .join("");

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tagwerk – Kalender ${esc(range)}</title>
<style>
  :root{ --bg:#E9EDEA; --surface:#FFFFFF; --ink:#131A18; --muted:#6B7A76;
         --line:#D3DAD6; --pine:#1F3D37; }
  *{ box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body{ margin:0; background:var(--bg); color:var(--ink);
        font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  .wrap{ max-width:1100px; margin:0 auto; padding:20px 16px 40px; }
  .top{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
  .brand{ font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
          letter-spacing:.16em; text-transform:uppercase; color:var(--pine); font-size:13px; }
  .range{ font-size:15px; font-weight:600; }
  .pdfbtn{ background:var(--pine); color:#fff; border:0; border-radius:10px;
           padding:10px 16px; font-size:14px; font-weight:600; cursor:pointer; }
  .cal{ display:grid; grid-template-columns:44px repeat(7,1fr); gap:6px; }
  .axis{ position:relative; }
  .hlabel{ position:absolute; right:4px; transform:translateY(-6px); font-size:10px;
           color:var(--muted); font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  .col{ background:var(--surface); border:1px solid var(--line); border-radius:8px; overflow:hidden; }
  .colhead{ text-align:center; padding:6px 2px; border-bottom:1px solid var(--line); }
  .dname{ display:block; font-size:12px; font-weight:700; }
  .ddate{ display:block; font-size:10px; color:var(--muted);
          font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  .colbody{ position:relative; }
  .hline{ position:absolute; left:0; right:0; border-top:1px solid #EEF1EF; }
  .block{ position:absolute; left:2px; right:2px; border-radius:5px; color:#fff;
          padding:2px 5px; overflow:hidden; box-shadow:0 1px 2px rgba(0,0,0,.12); }
  .btime{ display:block; font-size:9px; opacity:.9;
          font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  .bname{ display:block; font-size:11px; font-weight:600; line-height:1.15; }
  .bnote{ display:block; font-size:10px; opacity:.92; line-height:1.15; }
  .foot{ margin-top:20px; font-size:11px; color:var(--muted); text-align:center; }
  @media print{
    @page{ size:A4 landscape; margin:8mm; }
    body{ background:#fff; }
    .pdfbtn{ display:none; }
    .wrap{ max-width:none; padding:0; }
  }
</style></head>
<body><div class="wrap">
  <div class="top">
    <div>
      <div class="brand">Tagwerk · Wochen-Kalender</div>
      <div class="range">Woche ${esc(range)}</div>
    </div>
    <button class="pdfbtn" onclick="window.print()">Als PDF sichern / Drucken</button>
  </div>
  <div class="cal">
    <div class="axis" style="height:${colH + 28}px">
      <div style="height:28px"></div>
      <div style="position:relative;height:${colH}px">${axis}</div>
    </div>
    ${cols}
  </div>
  <div class="foot">Erstellt mit Tagwerk · ${esc(range)}</div>
</div></body></html>`;
}
