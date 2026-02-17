# Architecture

This project is a static, privacy-first web app served from GitHub Pages.

## Runtime Modules

- `app.main.js`: boot sequence, wiring, update flow, lifecycle
- `app.config.js`: constants, DOM references
- `app.routing.js`: route parsing, canonical normalization, SEO updates
- `app.i18n.js`: dictionary loading and translation application
- `app.store.js`: IndexedDB storage and rating persistence
- `app.data.js`: snapshot/artists/changes loading
- `app.ui.js`: rendering and interaction layer
- `app.util.js`: helpers

## Data Sources

- Snapshots: `data/tomorrowland/2026/snapshots/`
- Artists index/details: `data/tomorrowland/2026/artists/`
- Change history: `data/tomorrowland/2026/changes/`

## Storage

- IndexedDB DB: `festival_planner`
- Store: `ratings`
- `localStorage`: language + player preferences + QA flags

## Routing Model

- Canonical: `/{festival}/{year}/{weekend}/`
- Artist pages: `/{festival}/{year}/{weekend}/artists/{slug}/`
- Group view: `/{festival}/{year}/{weekend}/group/`
- Deep-link fallback for GitHub Pages: `404.html`

## PWA Model

- Manifest: `manifest.webmanifest`
- Service worker: cache versioned app shell, runtime cache for JSON/static assets, navigation fallback
- Update UX: update banner + reload

## Single Source of Truth

Central URL/config values are documented in `docs/config.json` and must stay aligned with README, sitemap, robots and canonical logic.
