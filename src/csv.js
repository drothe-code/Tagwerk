/* CSV-Export der Woche. Deutsches Format: Semikolon-Trenner + Komma-Dezimal,
   damit Numbers/Excel (DE-Locale) direkt in Spalten öffnet. UTF-8-BOM für Umlaute.
   Teilen via Share-Sheet (AirDrop iPhone→Mac), Fallback Download. */

const pad = (n) => String(n).padStart(2, "0");
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const clock = (ts) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const dateStr = (ts) => {
  const d = new Date(ts);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};
const weekday = (ts) => WD[new Date(ts).getDay()];
const decH = (ms) => (ms / 3600000).toFixed(2).replace(".", ",");

// Feld quoten, falls es Trenner, Anführungszeichen oder Zeilenumbruch enthält
const q = (s) => {
  const v = String(s ?? "");
  return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
};

/* rows: [{ start, end, ms, cat, note }] – bereits nach Startzeit sortiert */
export function buildWeekCSV(rows, totalMs) {
  const head = ["Datum", "Wochentag", "Start", "Ende", "Dauer (Std)", "Kategorie", "Notiz"];
  const lines = [head.join(";")];
  rows.forEach((r) => {
    lines.push(
      [
        dateStr(r.start),
        weekday(r.start),
        clock(r.start),
        clock(r.end),
        decH(r.ms),
        q(r.cat),
        q(r.note),
      ].join(";")
    );
  });
  // Summenzeile
  lines.push(["", "", "", "", decH(totalMs), "Gesamt", ""].join(";"));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export async function shareCSV(filename, csv) {
  const file = new File([csv], filename, { type: "text/csv" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Tagwerk – Woche (CSV)" });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
    }
  }
  const blob = new Blob([csv], { type: "text/csv" });
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
