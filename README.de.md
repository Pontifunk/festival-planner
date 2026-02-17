[Deutsch](README.de.md) | [English](README.md)

# Festival Planner

Datenschutzfreundlicher Festival-Line-up-Planer für Tomorrowland 2026 (W1/W2). Die App läuft statisch auf GitHub Pages, speichert Bewertungen/Favoriten nur lokal auf dem Gerät und benötigt keinen Account.

## Privacy-First Versprechen

- Keine Accounts
- Kein Tracking, keine Analytics
- Keine Cookies
- Kein Cloud-Sync
- Bewertungen/Favoriten nur lokal in IndexedDB
- Play-Einstellungen nur lokal in localStorage

## Schnellstart (unter 5 Minuten)

- Node.js: 20+
- Installieren: `npm install`
- Dev-Watch-Build: `npm run dev`
- Produktions-Build: `npm run build`
- Smoke-Test: `npm run test:smoke`

## Deployment (GitHub Pages)

- Primäres Ziel ist GitHub Pages (`.github/workflows/pages.yml`)
- Custom Domain wird über `CNAME` gesetzt
- Site-URL und Repo-URL liegen in `docs/config.json`

## Routing und Deep Links

- Kanonische URLs nutzen Trailing Slash (`/tomorrowland/2026/w1/`)
- GitHub-Pages-Deep-Link-Refresh-Fallback ist in `404.html` umgesetzt
- Unbekannte Deep Links werden auf den App-Einstieg umgeschrieben und clientseitig normalisiert

## PWA (Manifest + Service Worker)

- Manifest: `manifest.webmanifest`
- Service Worker: `service-worker.js`
- Offline-Verhalten:
  - App-Shell wird gecacht
  - Line-up-JSON wird per Runtime-Caching abgelegt
  - Favoriten/Bewertungen funktionieren offline via IndexedDB
- Update-Flow: App zeigt einen Hinweisbanner mit Reload-Aktion

## Datenmodell und Snapshot-Prozess

- Datenwurzel: `data/tomorrowland/2026/`
- Hauptordner:
  - `snapshots/`
  - `artists/`
  - `changes/`
- Update/Snapshot-Skripte liegen in `scripts/`

## IndexedDB-Speicher

- DB-Name: `festival_planner`
- Store: `ratings`
- Version: `1`
- Key-Format: `{festival}::{year}::{weekend}::{artistId}`
- Legacy-Prefix: `{festival}::{year}::`
- Export/Import-Format: JSON mit Ratings und lokalen Einstellungen

## i18n

- Wörterbücher: `i18n/de.json`, `i18n/en.json`
- Key-Verwendung: `data-i18n`, `data-i18n-placeholder`, `data-i18n-aria-label`, `data-i18n-title` sowie `t("...")`
- Benennung: lower snake_case
- Neue Keys immer in DE und EN ergänzen, danach `npm run lint:i18n`

## Troubleshooting

- App zeigt alte Version nach Deploy: Hard Reload (`Ctrl+F5`) und Update-Banner verwenden
- SW-Cache-Probleme: lokale Reset-Aktion in App-Menü/Einstellungen nutzen
- Deep Links: Trailing Slash prüfen und sicherstellen, dass `404.html` deployt ist

## Doku

- Architektur: `docs/ARCHITECTURE.md`
- i18n-Guide: `docs/I18N.md`
- Terminologie-Glossar: `docs/GLOSSARY.md`
- Config als Single Source of Truth: `docs/config.json`

## Link-Check

- Doku/README Link-Check: `npm run lint:links`

## Lizenz

Siehe `LICENSE`.
