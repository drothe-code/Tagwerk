# Tagwerk

Zeiterfassung mit One-Tap-Switch für einen selbstständigen Finanzierungsberater.
React + Vite + Tailwind, als PWA konfiguriert. Daten liegen ausschließlich im
`localStorage` des Geräts (Schlüssel `tagwerk-v1`) – kein Backend, keine Accounts.

## Voraussetzung

Node.js (Version 18 oder neuer) muss installiert sein. Auf diesem Mac war es
beim Erstellen noch nicht vorhanden. Installation z. B. über den offiziellen
Installer von <https://nodejs.org> oder via Homebrew:

```bash
brew install node
```

## Lokal starten

```bash
npm install
npm run dev
```

Vite gibt eine Adresse wie `http://localhost:5173` aus. Zum Testen der
PWA-/Installierbarkeit auf dem iPhone im selben WLAN:

```bash
npm run dev -- --host
```

Dann die angezeigte Netzwerk-Adresse am iPhone in Safari öffnen. Der Service
Worker (und damit „Zum Home-Bildschirm" als echte App-Kachel) greift zuverlässig
erst im Produktions-Build.

## Produktions-Build

```bash
npm run build
npm run preview
```

`npm run build` erzeugt den Ordner `dist/` inklusive `manifest.webmanifest` und
Service Worker.

## Deployment auf Netlify

`netlify.toml` ist vorbereitet (Build `npm run build`, Publish-Verzeichnis
`dist`, SPA-Redirect). Repository mit Netlify verbinden – der Rest läuft
automatisch.

## Projektstruktur

```
tagwerk/
├── index.html              Root-HTML, iOS-Meta-Tags
├── vite.config.js          React- + PWA-Plugin (Manifest, Service Worker)
├── tailwind.config.js      Tailwind v3
├── postcss.config.js
├── netlify.toml
├── public/                 PWA-Icons (Platzhalter)
└── src/
    ├── main.jsx            Einstiegspunkt
    ├── index.css           Tailwind + Basis-Styles
    ├── storage.js          load()/save() gegen localStorage
    └── Tagwerk.jsx         die App (drei Ansichten: Jetzt · Tag · Woche)
```

## Icons ersetzen

In `public/` liegen Platzhalter (Pine-Kachel mit „T"): `icon-192.png`,
`icon-512.png`, `apple-touch-icon.png` (180×180). Einfach durch eigene PNGs
gleicher Größe/Dateinamen ersetzen.
