/* localStorage-Anbindung – ersetzt die frühere Artefakt-Storage-API.
   Ein Schlüssel, synchron, kein Backend. */

const KEY = "tagwerk-v1";

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    // beschädigte oder fehlende Daten – als leer behandeln
    return null;
  }
}

export function save(data) {
  // wirft bei vollem Speicher (QuotaExceeded) – Aufrufer fängt das ab
  localStorage.setItem(KEY, JSON.stringify(data));
}
