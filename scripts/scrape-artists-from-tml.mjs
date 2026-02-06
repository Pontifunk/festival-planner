import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Resolve repo paths.
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = path.join(ROOT_DIR, "data", "tomorrowland", "2026");
const OUT_DIR = path.join(BASE, "artists");

// Source page for artist listings.
const ARTISTS_URL = "https://belgium.tomorrowland.com/nl/line-up/?page=artists";

// Small FS helpers.
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function writeJson(file, obj) { fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf8"); }
function readJsonSafe(file, fallback) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } }

// Normalize artist names for stable IDs.
function normalizeName(name) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ");
}

function hash16(str) {
  return crypto.createHash("sha256").update(str).digest("hex").slice(0, 16);
}

function extractTmlArtistIdFromUrl(value) {
  if (!value || typeof value !== "string") return "";
  const m = value.match(/[?&]artist=(\d+)/);
  return m ? m[1] : "";
}

function extractTmlArtistIdFromNode(node) {
  if (!node || typeof node !== "object") return "";
  const urlKeys = [
    "url",
    "href",
    "link",
    "permalink",
    "artistUrl",
    "artistURL",
    "artist_url",
    "artistLink",
    "artist_link",
    "pageUrl",
    "pageURL",
    "page_url",
    "shareUrl",
    "shareURL",
    "share_url"
  ];
  for (const key of urlKeys) {
    const value = node[key];
    const id = extractTmlArtistIdFromUrl(value);
    if (id) return id;
  }
  for (const value of Object.values(node)) {
    if (typeof value === "string") {
      const id = extractTmlArtistIdFromUrl(value);
      if (id) return id;
    }
  }
  return "";
}

// Build a deterministic artist ID from the name.
function makeArtistId(name) {
  return hash16(`tml|${normalizeName(name)}`);
}

/**
 * Heuristik: finde ein JSON-Payload, das wie eine Artists-Liste aussieht.
 * Wir suchen nach Arrays/Objekten, die viele Namen enthalten.
 */
// Heuristic: find the JSON payload that most likely contains artists.
function findArtistsPayload(jsonPayloads) {
  // bevorzugt größere payloads
  const candidates = jsonPayloads
    .filter(o => o && typeof o === "object")
    .map(o => ({ o, size: JSON.stringify(o).length }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 40)
    .map(x => x.o);

  // Suche nach "artists" oder nach vielen "name"-Feldern
  for (const obj of candidates) {
    const str = JSON.stringify(obj).toLowerCase();
    const looksLikeArtists =
      str.includes("artist") && str.includes("name") && !str.includes("start") && !str.includes("stage");
    const hasArtistLinks = str.includes("artist=") && str.includes("line-up");
    const hasPerformances = Array.isArray(obj?.performances);
    if (looksLikeArtists) return obj;
    if (hasArtistLinks) return obj;
    if (hasPerformances) return obj;
  }

  return null;
}

/**
 * Extrahiert Artists aus payload via Tiefensuche.
 * Akzeptiert Objekte, die Felder wie name/title enthalten.
 */
// Extract artists from a payload via deep traversal.
function extractArtistsFromPayload(payload) {
  const found = [];

  if (payload && Array.isArray(payload.performances)) {
    payload.performances.forEach((performance) => {
      const artists = Array.isArray(performance?.artists) ? performance.artists : [];
      artists.forEach((artist) => {
        const name = String(artist?.name || "").trim();
        const id = String(artist?.id || "").trim();
        if (!name) return;
        found.push({
          name,
          nameNormalized: normalizeName(name),
          artistId: makeArtistId(name),
          slug: null,
          image: typeof artist?.image === "string" ? artist.image : null,
          genres: [],
          ...(id ? { tomorrowlandArtistId: id } : {})
        });
      });
    });
  }

  function walk(node) {
    if (!node) return;

    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }

    if (typeof node === "object") {
      // Kandidat?
      const keys = Object.keys(node).map(k => k.toLowerCase());

      // typische Felder
      const name = node.name ?? node.title ?? node.artist ?? null;
      const slug = node.slug ?? node.urlSlug ?? node.url_slug ?? null;

      // optional: images
      const image =
        node.image ?? node.imageUrl ?? node.image_url ?? node.thumbnail ?? node.thumbnailUrl ?? null;

      // optional: tags/genres
      const genres = node.genres ?? node.genre ?? node.tags ?? null;

      if (name && typeof name === "string") {
        const cleanName = name.trim();
        const tomorrowlandArtistId = extractTmlArtistIdFromNode(node) ?? "";
        if (cleanName.length >= 2) {
          found.push({
            name: cleanName,
            nameNormalized: normalizeName(cleanName),
            artistId: makeArtistId(cleanName),
            slug: typeof slug === "string" ? slug : null,
            image: typeof image === "string" ? image : null,
            genres: Array.isArray(genres)
              ? genres.map(g => String(g).trim()).filter(Boolean)
              : (typeof genres === "string" ? [genres.trim()].filter(Boolean) : []),
            ...(tomorrowlandArtistId ? { tomorrowlandArtistId } : {})
          });
        }
      }

      for (const v of Object.values(node)) walk(v);
    }
  }

  walk(payload);

  // dedup by artistId
  const byId = new Map();
  for (const a of found) {
    if (!byId.has(a.artistId)) byId.set(a.artistId, a);
    else {
      // merge optionale Felder, falls wir aus mehreren Stellen Daten bekommen
      const prev = byId.get(a.artistId);
      byId.set(a.artistId, {
        ...prev,
        slug: prev.slug ?? a.slug,
        image: prev.image ?? a.image,
        genres: prev.genres.length ? prev.genres : a.genres,
        tomorrowlandArtistId: prev.tomorrowlandArtistId || a.tomorrowlandArtistId
      });
    }
  }

  // Sortierung nach Name für UI/Suche
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fallback: DOM scrape (wenn JSON sniffer nichts bringt)
 * Achtung: Selector kann je nach Site-Update angepasst werden müssen.
 */
// Fallback: DOM scrape when JSON sniffing fails.
async function extractArtistsFromDOM(page) {
  // Warte auf irgendwas, das nach Artist-Liste aussieht
  // (Selektoren sind bewusst generisch)
  await page.waitForTimeout(1500);

  const linkEntries = await page.$$eval("a[href*='artist=']", (nodes) => {
    return nodes.map((n) => ({
      name: (n.textContent || "").trim(),
      href: n.getAttribute("href") || ""
    }));
  });
  const artistsFromLinks = linkEntries
    .map((entry) => {
      const name = String(entry.name || "").trim();
      if (!name) return null;
      const m = String(entry.href || "").match(/[?&]artist=(\d+)/);
      if (!m) return null;
      return { name, id: m[1] };
    })
    .filter(Boolean);

  if (artistsFromLinks.length) {
    const byId = new Map();
    artistsFromLinks.forEach((entry) => {
      const cleanName = String(entry.name || "").trim();
      if (!cleanName) return;
      const artistId = makeArtistId(cleanName);
      if (byId.has(artistId)) return;
      byId.set(artistId, {
        name: cleanName,
        nameNormalized: normalizeName(cleanName),
        artistId,
        slug: null,
        image: null,
        genres: [],
        tomorrowlandArtistId: entry.id
      });
    });
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  const names = await page.$$eval("a, div, span", (nodes) => {
    // Heuristik: viele Artist-Namen sind Links/Items; wir filtern kurze/irrelevante Strings raus
    const text = nodes
      .map(n => (n.textContent || "").trim())
      .filter(t => t.length >= 2 && t.length <= 60);
    return Array.from(new Set(text));
  });

  // Sehr konservativ: wir nehmen nur Strings, die nicht nach UI-Labels aussehen
  const blacklist = new Set(["line-up", "artists", "stages", "day", "weekend"]);
  const cleaned = names.filter(t => !blacklist.has(t.toLowerCase()));

  const artists = cleaned.map(name => {
    const tomorrowlandArtistId = "";
    return {
      name,
      nameNormalized: normalizeName(name),
      artistId: makeArtistId(name),
      slug: null,
      image: null,
      genres: [],
      ...(tomorrowlandArtistId ? { tomorrowlandArtistId } : {})
    };
  });

  // dedup + sort
  const byId = new Map();
  for (const a of artists) byId.set(a.artistId, a);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Update artists index.json (latest pointer and history).
function updateArtistsIndex(file, createdAt, count) {
  const indexPath = path.join(OUT_DIR, "index.json");
  const idx = readJsonSafe(indexPath, { latest: null, artists: [] });

  idx.artists = idx.artists.filter(e => e.file !== file);
  idx.artists.push({ file, createdAt, artistCount: count });
  idx.artists.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  idx.latest = idx.artists.at(-1)?.file ?? null;

  writeJson(indexPath, idx);
  return idx;
}

// Main scrape flow: sniff JSON responses, fallback to DOM, write files.
async function main() {
  ensureDir(OUT_DIR);

  const createdAt = new Date().toISOString();
  const ts = createdAt
    .replace(/[:-]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
    .replace("T", "_"); // 20260126_074514Z

  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    const jsonPayloads = [];
    page.on("response", async (res) => {
      try {
        const ct = (res.headers()["content-type"] || "").toLowerCase();
        if (!ct.includes("application/json")) return;

        const u = res.url().toLowerCase();
        const looksRelevant =
          u.includes("artist") || u.includes("line") || u.includes("line-up") || u.includes("lineup");

        if (!looksRelevant) return;

        const data = await res.json();
        jsonPayloads.push(data);
      } catch {
        // ignore
      }
    });

    await page.goto(ARTISTS_URL, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(2000);

    let artists = [];
    const payload = findArtistsPayload(jsonPayloads);

    if (payload) {
      artists = extractArtistsFromPayload(payload);
      console.log(`Extracted artists from JSON payload: ${artists.length}`);
    } else {
      console.log(`No suitable JSON payload found, using DOM fallback.`);
      artists = await extractArtistsFromDOM(page);
      console.log(`Extracted artists from DOM fallback: ${artists.length}`);
    }

    await page.close();

    if (!artists.length) {
      throw new Error("No artists extracted (both JSON and DOM fallback empty).");
    }

    const outFile = `${ts}.json`;
    const outPath = path.join(OUT_DIR, outFile);

    const doc = {
      meta: {
        festival: "tomorrowland",
        year: 2026,
        createdAt,
        source: "belgium.tomorrowland.com (playwright) ?page=artists",
        version: 1
      },
      artists
    };

    writeJson(outPath, doc);

    const idx = updateArtistsIndex(outFile, createdAt, artists.length);
    writeJson(path.join(OUT_DIR, "latest.json"), doc);

    console.log(`Wrote artists file ${outFile} (count=${artists.length}) latest=${idx.latest}`);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
