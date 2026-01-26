import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = path.join(ROOT_DIR, "data", "tomorrowland", "2026");
const OUT_DIR = path.join(BASE, "artists");

const ARTISTS_URL = "https://belgium.tomorrowland.com/nl/line-up/?page=artists";

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function writeJson(file, obj) { fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf8"); }
function readJsonSafe(file, fallback) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } }

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

function makeArtistId(name) {
  return hash16(`tml|${normalizeName(name)}`);
}

/**
 * Heuristik: finde ein JSON-Payload, das wie eine Artists-Liste aussieht.
 * Wir suchen nach Arrays/Objekten, die viele Namen enthalten.
 */
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
    if (looksLikeArtists) return obj;
  }

  return null;
}

/**
 * Extrahiert Artists aus payload via Tiefensuche.
 * Akzeptiert Objekte, die Felder wie name/title enthalten.
 */
function extractArtistsFromPayload(payload) {
  const found = [];

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
        if (cleanName.length >= 2) {
          found.push({
            name: cleanName,
            nameNormalized: normalizeName(cleanName),
            artistId: makeArtistId(cleanName),
            slug: typeof slug === "string" ? slug : null,
            image: typeof image === "string" ? image : null,
            genres: Array.isArray(genres)
              ? genres.map(g => String(g).trim()).filter(Boolean)
              : (typeof genres === "string" ? [genres.trim()].filter(Boolean) : [])
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
        genres: prev.genres.length ? prev.genres : a.genres
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
async function extractArtistsFromDOM(page) {
  // Warte auf irgendwas, das nach Artist-Liste aussieht
  // (Selektoren sind bewusst generisch)
  await page.waitForTimeout(1500);

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

  const artists = cleaned.map(name => ({
    name,
    nameNormalized: normalizeName(name),
    artistId: makeArtistId(name),
    slug: null,
    image: null,
    genres: []
  }));

  // dedup + sort
  const byId = new Map();
  for (const a of artists) byId.set(a.artistId, a);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

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
