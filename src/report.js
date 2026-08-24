/* Erzeugt aus den Wochendaten einen eigenständigen HTML-Bericht (lesbare
   Auswertung) und teilt ihn über das iOS-Share-Sheet (AirDrop zum Mac).
   Kein Backend, keine Cloud – alles im Gerät. */

const pad = (n) => String(n).padStart(2, "0");

function fmtHours(ms) {
  return (ms / 3600000).toFixed(1).replace(".", ",");
}
function fmtDur(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}:${pad(m % 60)} h` : `${m} min`;
}
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* data = { range, total, perCat:[{name,color,ms,notes:[[note,ms],...]}],
            perDay:[{n,ms,segments:[{color,ms}]}], maxDay } */
export function buildWeekReportHTML(data) {
  const { range, total, perCat, perDay, maxDay } = data;

  const anteile = perCat
    .map((c) => {
      const pct = total > 0 ? Math.round((c.ms / total) * 100) : 0;
      return `
      <div class="row">
        <span class="dot" style="background:${esc(c.color)}"></span>
        <span class="name">${esc(c.name)}</span>
        <span class="num">${fmtDur(c.ms)}</span>
        <span class="num pct">${pct}%</span>
      </div>`;
    })
    .join("");

  const barSegs = perCat
    .map(
      (c) =>
        `<span style="background:${esc(c.color)};width:${
          total > 0 ? (c.ms / total) * 100 : 0
        }%"></span>`
    )
    .join("");

  const verlauf = perDay
    .map((d) => {
      const segs = d.segments
        .map(
          (s) =>
            `<span style="background:${esc(s.color)};width:${
              maxDay > 0 ? (s.ms / maxDay) * 100 : 0
            }%"></span>`
        )
        .join("");
      return `
      <div class="drow">
        <span class="dname">${esc(d.n)}</span>
        <span class="dbar">${segs}</span>
        <span class="num dsum">${fmtHours(d.ms)} h</span>
      </div>`;
    })
    .join("");

  const details = perCat
    .filter((c) => c.notes.length > 0)
    .map((c) => {
      const notes = c.notes
        .map(
          ([n, ms]) => `
        <div class="nrow">
          <span class="ntext">${esc(n)}</span>
          <span class="num nnum">${fmtDur(ms)}</span>
        </div>`
        )
        .join("");
      return `
      <div class="card">
        <div class="chead"><span class="dot" style="background:${esc(
          c.color
        )}"></span><span class="cname">${esc(c.name)}</span></div>
        ${notes}
      </div>`;
    })
    .join("");

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tagwerk – Woche ${esc(range)}</title>
<style>
  :root{ --bg:#E9EDEA; --surface:#FFFFFF; --ink:#131A18; --muted:#6B7A76;
         --line:#D3DAD6; --pine:#1F3D37; }
  *{ box-sizing:border-box; }
  body{ margin:0; background:var(--bg); color:var(--ink);
        font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  .wrap{ max-width:640px; margin:0 auto; padding:28px 20px 48px; }
  .mono{ font-variant-numeric:tabular-nums;
         font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  .num{ font-variant-numeric:tabular-nums;
        font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  header.top{ margin-bottom:24px; }
  .brand{ font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
          letter-spacing:.18em; text-transform:uppercase; color:var(--pine);
          font-size:14px; }
  .range{ font-size:15px; margin-top:6px; }
  .total{ font-size:40px; margin-top:2px; font-variant-numeric:tabular-nums;
          font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  .card{ background:var(--surface); border:1px solid var(--line);
         border-radius:14px; padding:16px; margin-bottom:14px; }
  .bar{ display:flex; height:12px; border-radius:6px; overflow:hidden; margin-bottom:14px; }
  .bar span{ display:block; }
  .row{ display:flex; align-items:center; gap:12px; padding:5px 0; }
  .dot{ width:10px; height:10px; border-radius:50%; flex:none; display:inline-block; }
  .name{ flex:1; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .row .num{ font-size:14px; }
  .pct{ width:44px; text-align:right; color:var(--muted); font-size:12px; }
  .sect{ font-size:11px; letter-spacing:.12em; text-transform:uppercase;
         color:var(--muted); margin-bottom:10px; }
  .drow{ display:flex; align-items:center; gap:12px; padding:3px 0; }
  .dname{ width:26px; font-size:12px; color:var(--muted);
          font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  .dbar{ flex:1; display:flex; height:16px; border-radius:5px; overflow:hidden; background:var(--bg); }
  .dbar span{ display:block; }
  .dsum{ width:52px; text-align:right; font-size:12px; }
  .chead{ display:flex; align-items:center; gap:8px; margin-bottom:8px; }
  .cname{ font-size:14px; font-weight:600; }
  .nrow{ display:flex; align-items:baseline; gap:12px; padding:4px 0; }
  .ntext{ flex:1; font-size:14px; }
  .nnum{ font-size:12px; color:var(--muted); }
  .foot{ margin-top:28px; font-size:11px; color:var(--muted); text-align:center; }
  @media print{ body{ background:#fff; } .card{ break-inside:avoid; } }
</style></head>
<body><div class="wrap">
  <header class="top">
    <div class="brand">Tagwerk · Wochenauswertung</div>
    <div class="range">Woche ${esc(range)}</div>
    <div class="total">${fmtHours(total)} h</div>
  </header>

  <div class="card">
    <div class="bar">${barSegs}</div>
    ${anteile}
  </div>

  <div class="card">
    <div class="sect">Verlauf</div>
    ${verlauf}
  </div>

  ${details}

  <div class="foot">Erstellt mit Tagwerk · ${esc(range)}</div>
</div></body></html>`;
}

/* Teilt den Bericht: erst iOS-Share-Sheet (AirDrop), sonst Datei-Download. */
export async function shareWeekReport(filename, html) {
  const file = new File([html], filename, { type: "text/html" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Tagwerk Wochenauswertung" });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
      /* sonst: Fallback unten */
    }
  }

  // Fallback (u. a. Desktop-Browser): Datei herunterladen
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
