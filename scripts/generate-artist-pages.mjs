import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// NOTE: After snapshot updates, re-run this script to keep artist pages in sync.
const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://festival-planner.tschann.me";
const FESTIVAL = process.env.FESTIVAL || "tomorrowland";
const YEAR = process.env.YEAR || "2026";
const LOCALE = (process.env.LOCALE || "en").toLowerCase();

const UI = {
  en: {
    titleSuffix: "Festival Planner",
    subtitle: "Artist details (privacy-first, no tracking)",
    backToLineup: "Back to lineup",
    setTimes: "Set times",
    noSlots: "No slots available.",
    desc: (name, year, weekendNum) =>
      `Set times and stage info for ${name} at Tomorrowland ${year} Weekend ${weekendNum}. Privacy-first, no tracking.`
  },
  de: {
    titleSuffix: "Festival Planner",
    subtitle: "Artist-Details (privacy-first, ohne Tracking)",
    backToLineup: "Zurück zum Line-up",
    setTimes: "Set-Zeiten",
    noSlots: "Keine Slots verfügbar.",
    desc: (name, year, weekendNum) =>
      `Set-Zeiten und Bühneninfos für ${name} beim Tomorrowland ${year} Wochenende ${weekendNum}. Privacy-first, ohne Tracking.`
  }
};

const copy = UI[LOCALE] || UI.en;

const snapshotPath = path.join(ROOT, "data", FESTIVAL, YEAR, "snapshots", "latest.json");
const raw = await fs.readFile(snapshotPath, "utf-8");
const snapshot = JSON.parse(raw);
const slots = Array.isArray(snapshot.slots) ? snapshot.slots : [];

const weekends = new Map();
for (const slot of slots) {
  const weekend = String(slot.weekend || "").toUpperCase();
  if (!weekend) continue;
  if (!weekends.has(weekend)) weekends.set(weekend, new Map());
  const artists = weekends.get(weekend);
  const artistId = String(slot.artistId || "");
  if (!artistId) continue;
  if (!artists.has(artistId)) {
    artists.set(artistId, {
      id: artistId,
      name: String(slot.artist || "Unknown artist"),
      normalized: String(slot.artistNormalized || ""),
      slots: []
    });
  }
  artists.get(artistId).slots.push(slot);
}

function slugify(value) {
  const base = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "artist";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("en-CA");
  } catch {
    return value;
  }
}

function formatTime(value) {
  const match = String(value || "").match(/(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

function buildArtistSlugMap(artists) {
  const baseById = new Map();
  const counts = new Map();
  for (const artist of artists.values()) {
    const base = slugify(artist.normalized || artist.name);
    baseById.set(artist.id, base);
    counts.set(base, (counts.get(base) || 0) + 1);
  }
  const out = new Map();
  for (const [id, base] of baseById.entries()) {
    const suffix = (counts.get(base) || 0) > 1 ? `-${id.slice(0, 6)}` : "";
    out.set(id, `${base}${suffix}`);
  }
  return out;
}

function renderArtistPage({ artist, weekend, slug, createdAt }) {
  const weekendNum = weekend.slice(1);
  const weekendLower = weekend.toLowerCase();
  const title = `${artist.name} at Tomorrowland ${YEAR} Weekend ${weekendNum} | ${copy.titleSuffix}`;
  const description = copy.desc(artist.name, YEAR, weekendNum);
  const canonical = `${SITE_ORIGIN}/${FESTIVAL}/${YEAR}/${weekendLower}/artist/${slug}/`;

  const slots = [...artist.slots].sort((a, b) => {
    const da = String(a.date || a.start || "");
    const db = String(b.date || b.start || "");
    if (da !== db) return da.localeCompare(db);
    const ta = String(a.start || "");
    const tb = String(b.start || "");
    return ta.localeCompare(tb);
  });

  const slotItems = slots.map((slot) => {
    const date = escapeHtml(slot.date || formatDate(slot.start));
    const start = formatTime(slot.start);
    const end = formatTime(slot.end);
    const time = start && end ? `${start}-${end}` : (start || end || "");
    const stage = escapeHtml(slot.stage || "Unknown stage");
    return `<li><strong>${date}</strong> - ${escapeHtml(time)} - ${stage}</li>`;
  }).join("\n");

  const snapshotMeta = createdAt ? `Snapshot: ${escapeHtml(createdAt)}` : "";
  const lineupUrl = `/${FESTIVAL}/${YEAR}/${weekendLower}/`;

  return `<!doctype html>
<html lang="${LOCALE}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="${SITE_ORIGIN}/icons/og.png">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${SITE_ORIGIN}/icons/og.png">
  <link rel="stylesheet" href="/styles.css">
  <script type="application/ld+json">
    ${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "MusicGroup",
      "name": artist.name,
      "performerIn": {
        "@type": "Event",
        "name": `Tomorrowland ${YEAR} Weekend ${weekendNum}`,
        "startDate": slots[0]?.start || slots[0]?.date || ""
      }
    })}
  </script>
</head>
<body>
  <header class="topbar" id="top">
    <div class="brand">
      <div class="logo">FP</div>
      <div class="brandText">
        <div class="title">Festival Planner</div>
        <div class="subtitle">${escapeHtml(copy.subtitle)}</div>
      </div>
    </div>
  </header>

  <main class="layout">
    <section class="panel">
      <div class="card">
        <div class="cardTitle">${escapeHtml(artist.name)}</div>
        <div class="muted">Tomorrowland ${YEAR} - Weekend ${weekendNum}</div>
        ${snapshotMeta ? `<div class="muted" style="margin-top:6px">${snapshotMeta}</div>` : ""}
        <div style="margin-top:12px">
          <a class="btn" href="${lineupUrl}">${escapeHtml(copy.backToLineup)}</a>
        </div>
        <div style="margin-top:14px">
          <div class="muted" style="margin-bottom:6px">${escapeHtml(copy.setTimes)}</div>
          <ul style="margin:0;padding-left:16px;display:flex;flex-direction:column;gap:6px">
            ${slotItems || `<li>${escapeHtml(copy.noSlots)}</li>`}
          </ul>
        </div>
      </div>
    </section>
  </main>
</body>
</html>`;
}

const baseUrls = [
  `${SITE_ORIGIN}/`,
  `${SITE_ORIGIN}/${FESTIVAL}/${YEAR}/w1/`,
  `${SITE_ORIGIN}/${FESTIVAL}/${YEAR}/w2/`,
  `${SITE_ORIGIN}/about/`,
  `${SITE_ORIGIN}/changelog/`,
  `${SITE_ORIGIN}/privacy/`,
  `${SITE_ORIGIN}/impressum/`
];

const sitemapUrls = new Set(baseUrls);

for (const [weekend, artists] of weekends.entries()) {
  const weekendLower = weekend.toLowerCase();
  const artistDir = path.join(ROOT, FESTIVAL, YEAR, weekendLower, "artist");
  await fs.rm(artistDir, { recursive: true, force: true });
  await fs.mkdir(artistDir, { recursive: true });

  const slugMap = buildArtistSlugMap(artists);
  for (const artist of artists.values()) {
    const slug = slugMap.get(artist.id);
    const createdAt = snapshot?.meta?.createdAt || "";
    const html = renderArtistPage({ artist, weekend, slug, createdAt });
    const targetDir = path.join(artistDir, slug);
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(path.join(targetDir, "index.html"), html, "utf-8");
    sitemapUrls.add(`${SITE_ORIGIN}/${FESTIVAL}/${YEAR}/${weekendLower}/artist/${slug}/`);
  }
}

const sitemapEntries = [...sitemapUrls].map((loc) => `  <url>\n    <loc>${loc}</loc>\n  </url>`).join("\n");
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>\n`;
await fs.writeFile(path.join(ROOT, "sitemap.xml"), sitemapXml, "utf-8");

console.log(`Generated artist pages for ${weekends.size} weekends.`);
