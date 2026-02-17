[Deutsch](README.de.md) | [English](README.md)

# Festival Planner

Privacy-first festival lineup planner for Tomorrowland 2026 (W1/W2). It runs fully static on GitHub Pages, stores ratings/favorites only on-device, and does not require any account.

## Privacy-First Promise

- No accounts
- No tracking or analytics
- No cookies
- No cloud sync
- Ratings/favorites are stored locally in IndexedDB
- Play preferences are stored locally in localStorage

## Quickstart (under 5 minutes)

- Node.js: 20+
- Install: `npm install`
- Dev watch build: `npm run dev`
- Production build: `npm run build`
- Smoke test: `npm run test:smoke`

## Deploy (GitHub Pages)

- Primary deploy target is GitHub Pages (`.github/workflows/pages.yml`)
- Custom domain is configured through `CNAME`
- Site URL and repo URL are defined in `docs/config.json`

## Routing and Deep Links

- Canonical URLs use trailing slash (`/tomorrowland/2026/w1/`)
- GitHub Pages deep-link refresh fallback is implemented in `404.html`
- Unknown deep links are rewritten to app entry and normalized by client routing

## PWA (Manifest + Service Worker)

- Manifest: `manifest.webmanifest`
- Service worker: `service-worker.js`
- Offline behavior:
  - App shell is cached
  - Lineup JSON is runtime-cached
  - Favorites/ratings keep working offline via IndexedDB
- Update flow: app shows an "update available" banner and reload action

## Data Model and Snapshot Flow

- Lineup data root: `data/tomorrowland/2026/`
- Main folders:
  - `snapshots/`
  - `artists/`
  - `changes/`
- Update/snapshot scripts are in `scripts/`

## IndexedDB Storage

- DB name: `festival_planner`
- Store: `ratings`
- Version: `1`
- Key format: `{festival}::{year}::{weekend}::{artistId}`
- Legacy prefix: `{festival}::{year}::`
- Export/import format: JSON file containing ratings and local preferences

## i18n

- Dictionaries: `i18n/de.json`, `i18n/en.json`
- Key usage: `data-i18n`, `data-i18n-placeholder`, `data-i18n-aria-label`, `data-i18n-title`, and `t("...")`
- Naming: lower snake_case
- Add keys in both languages and run `npm run lint:i18n`

## Troubleshooting

- App looks stale after deploy: hard reload (`Ctrl+F5`) and click update banner reload
- SW cache issues: use local reset action in app settings/menu
- Deep links: verify trailing slash and that `404.html` is deployed

## Docs

- Architecture: `docs/ARCHITECTURE.md`
- i18n guide: `docs/I18N.md`
- Terminology glossary: `docs/GLOSSARY.md`
- Config source of truth: `docs/config.json`

## Link Checking

- Run docs/readme link check: `npm run lint:links`

## License

See `LICENSE`.
