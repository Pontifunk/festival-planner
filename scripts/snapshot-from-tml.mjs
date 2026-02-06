import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Resolve repo paths.
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = path.join(ROOT_DIR, "data", "tomorrowland", "2026");
const SNAP_DIR = path.join(BASE, "snapshots");
const ARTISTS_LATEST = path.join(BASE, "artists", "latest.json");

// Day URLs to scrape (W1 + W2).
const DAY_URLS = [
  // Weekend 1
  "https://belgium.tomorrowland.com/nl/line-up/?day=2026-07-17",
  "https://belgium.tomorrowland.com/nl/line-up/?day=2026-07-18",
  "https://belgium.tomorrowland.com/nl/line-up/?day=2026-07-19",
  // Weekend 2
  "https://belgium.tomorrowland.com/nl/line-up/?day=2026-07-24",
  "https://belgium.tomorrowland.com/nl/line-up/?day=2026-07-25",
  "https://belgium.tomorrowland.com/nl/line-up/?day=2026-07-26"
];

// Small FS helpers.
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function writeJson(file, obj) { fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf8"); }
function readJsonSafe(file, fallback) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } }

function loadTomorrowlandArtistMap() {
  const data = readJsonSafe(ARTISTS_LATEST, null);
  const map = new Map();
  if (data && Array.isArray(data.artists)) {
    data.artists.forEach((artist) => {
      const artistId = String(artist?.artistId || "");
      const tmlId = String(artist?.tomorrowlandArtistId || "").trim();
      if (artistId && tmlId) map.set(artistId, tmlId);
    });
  }
  return map;
}

// Normalize artist names for stable IDs.
function normalizeArtist(name) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ");
}

// Normalize a stage field that may be string or object.
function normalizeStageValue(stage) {
  if (!stage) return "";
  if (typeof stage === "string") return stage.trim();
  if (typeof stage === "object") {
    const name = stage.name || stage.title || stage.label || stage.stageName || stage.stage_name;
    return name ? String(name).trim() : "";
  }
  return String(stage).trim();
}

// Short hash helper.
function hash16(str) {
  return crypto.createHash("sha256").update(str).digest("hex").slice(0, 16);
}

// Build stable IDs for artist, position, and slot.
function makeIds(slot) {
  const artistNormalized = normalizeArtist(slot.artist);
  const artistId = hash16(`tml|${artistNormalized}`);
  const positionId = hash16(`${slot.weekend}|${slot.date}|${slot.stage}|${slot.start}|${slot.end}`);
  const slotId = hash16(`${positionId}|${artistId}`);
  return { artistNormalized, artistId, positionId, slotId };
}

// Map date strings to weekend identifiers.
function weekendFromDate(dateStr) {
  // 2026-07-17/18/19 = W1, 2026-07-24/25/26 = W2
  if (dateStr >= "2026-07-17" && dateStr <= "2026-07-19") return "W1";
  if (dateStr >= "2026-07-24" && dateStr <= "2026-07-26") return "W2";
  return "UNKNOWN";
}

// Extract YYYY-MM-DD from the day= query param.
function extractDayParam(url) {
  const m = url.match(/day=(\d{4}-\d{2}-\d{2})/);
  if (!m) throw new Error(`No day=YYYY-MM-DD found in URL: ${url}`);
  return m[1];
}

// Pull a YYYY-MM-DD substring from timestamps.
function extractDateFromString(value) {
  const m = String(value || "").match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

/**
 * Heuristik: finde “wahrscheinlichstes” JSON Payload Objekt,
 * das Slot-ähnliche Daten enthält (stage/time/artist).
 */
// Heuristic: pick the payload that looks most like lineup data.
function findLineupPayload(jsonObjects) {
  // 1) Bevorzugt größere Objekte
  const candidates = jsonObjects
    .filter(o => o && typeof o === "object")
    .map(o => ({ o, size: JSON.stringify(o).length }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 30)
    .map(x => x.o);

  // 2) Suche nach arrays, die stage/time/artist enthalten könnten
  for (const obj of candidates) {
    const str = JSON.stringify(obj).toLowerCase();
    const looksLikeLineup =
      str.includes("stage") &&
      (str.includes("artist") || str.includes("name")) &&
      (str.includes("start") || str.includes("time"));
    if (looksLikeLineup) return obj;
  }
  return null;
}

/**
 * Extrahiert Slots aus einem Payload.
 * Da wir die exakte API-Struktur nicht garantieren können, arbeiten wir mit:
 * - Tiefensuche nach Arrays von Objekten
 * - Erkennung von Feldern, die wie start/end/time + artist/name + stage wirken
 */
// Extract slot objects by walking a JSON payload.
function extractSlotsFromPayload(payload, context) {
  const found = [];

  function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) {
      // Array von Objekten?
      for (const item of node) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const keys = Object.keys(item).map(k => k.toLowerCase());
          const hasArtist = keys.includes("artist") || keys.includes("name") || keys.includes("title");
          const hasStage = keys.includes("stage") || keys.includes("stageName".toLowerCase());
          const hasTime =
            keys.includes("start") || keys.includes("starttime") || keys.includes("time") ||
            keys.includes("end") || keys.includes("endtime");

          if (hasArtist && (hasStage || hasTime)) {
            // best-effort mapping:
            const artist = item.artist || item.name || item.title;
            const stage = normalizeStageValue(item.stage || item.stageName || item.stage_name);
            const start = item.start || item.startTime || item.start_time || item.time || "";
            const end = item.end || item.endTime || item.end_time || "";

            const dateFromStart = extractDateFromString(start) || extractDateFromString(end);
            const date = dateFromStart || context.date;
            const weekend = weekendFromDate(date) || context.weekend;

            if (artist && stage && start) {
              found.push({
                weekend,
                date,
                stage,
                start: String(start).trim(),
                end: String(end).trim(),
                artist: String(artist).trim()
              });
            }
          }
        }
        walk(item);
      }
      return;
    }

    if (typeof node === "object") {
      for (const v of Object.values(node)) walk(v);
    }
  }

  walk(payload);

  // Dedup (falls wir mehrfach laufen)
  const key = s => `${s.date}|${s.stage}|${s.start}|${s.end}|${s.artist}`;
  const uniq = new Map();
  for (const s of found) uniq.set(key(s), s);

  return [...uniq.values()];
}

// Choose the payload that best matches the target day/weekend.
function pickBestPayload(entries, context) {
  let best = null;
  for (const entry of entries) {
    try {
      const slots = extractSlotsFromPayload(entry.data, context);
      const matchCount = slots.filter(s => s.date === context.date && s.weekend === context.weekend).length;
      const total = slots.length;
      if (!best || matchCount > best.matchCount || (matchCount === best.matchCount && total > best.total)) {
        best = { entry, slots, matchCount, total };
      }
    } catch {
      // ignore payloads that don't parse into slots
    }
  }
  return best;
}

// Fetch a single day page and extract slots.
async function fetchDay(browser, url) {
  const date = extractDayParam(url);
  const weekend = weekendFromDate(date);

  const page = await browser.newPage();
  const jsonEntries = [];

  page.on("response", async (res) => {
    try {
      const ct = (res.headers()["content-type"] || "").toLowerCase();
      if (!ct.includes("application/json")) return;

      // Nur “relevante” JSONs sammeln (reduziert Noise)
      const u = res.url().toLowerCase();
      const looksRelevant =
        u.includes("line") || u.includes("line-up") || u.includes("lineup") ||
        u.includes("timetable") || u.includes("program") || u.includes("schedule");
      if (!looksRelevant) return;

      const data = await res.json();
      jsonEntries.push({ url: res.url(), data });
    } catch {
      // ignore non-json or blocked
    }
  });

  await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });

  // Sicherheits-wait: manche Seiten feuern nach networkidle noch XHR nach
  await page.waitForTimeout(2_000);

  await page.close();

  const best = pickBestPayload(jsonEntries, { date, weekend });
  const payload = best?.entry?.data || findLineupPayload(jsonEntries.map(e => e.data));
  if (!payload) {
    throw new Error(
      `No lineup-like JSON payload found for ${url}. Collected JSON payload count=${jsonEntries.length}`
    );
  }

  const slots = extractSlotsFromPayload(payload, { date, weekend });

  if (!slots.length) {
    throw new Error(
      `Lineup payload found but no slots extracted for ${url}. You may need to adjust mapping rules.`
    );
  }

  const uniqueDates = [...new Set(slots.map(s => s.date))].sort();
  const mismatchCount = slots.filter(s => s.date !== date).length;
  const urlSamples = jsonEntries.slice(0, 3).map(e => e.url).join(", ");
  const chosenUrl = best?.entry?.url || "fallback";
  const bestInfo = best ? `bestMatch=${best.matchCount}/${best.total} chosenUrl=${chosenUrl}` : "bestMatch=none";
  console.log(
    `Debug ${date} ${weekend}: payloads=${jsonEntries.length} slots=${slots.length} ` +
    `uniqueDates=${uniqueDates.join("|") || "-"} mismatches=${mismatchCount} ${bestInfo} ` +
    `jsonUrls=${urlSamples || "-"}`
  );

  return slots;
}

// Update snapshots index.json (latest pointer and history).
function updateSnapshotIndex(snapshotFile, createdAt, slotCount) {
  const indexPath = path.join(SNAP_DIR, "index.json");
  const idx = readJsonSafe(indexPath, { latest: null, snapshots: [] });

  idx.snapshots = idx.snapshots.filter(s => s.file !== snapshotFile);
  idx.snapshots.push({ file: snapshotFile, createdAt, slotCount });
  idx.snapshots.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  idx.latest = idx.snapshots.at(-1)?.file ?? null;

  writeJson(indexPath, idx);
  return idx;
}

// Main scrape flow for all days and snapshot generation.
async function main() {
  ensureDir(SNAP_DIR);

  const createdAt = new Date().toISOString();
  const ts = createdAt
    .replace(/[:-]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
    .replace("T", "_"); // 20260126_074514Z

  const browser = await chromium.launch({ headless: true });

  try {
    const tmlArtistMap = loadTomorrowlandArtistMap();
    const allSlots = [];
    for (const url of DAY_URLS) {
      const daySlots = await fetchDay(browser, url);
      allSlots.push(...daySlots);
      console.log(`Fetched ${daySlots.length} slots from ${url}`);
    }

    // Globales Dedup (falls die API mehrere Tage gleichzeitig liefert)
    const uniq = new Map();
    for (const s of allSlots) {
      const key = `${s.date}|${s.stage}|${s.start}|${s.end}|${s.artist}`;
      if (!uniq.has(key)) uniq.set(key, s);
    }

    // IDs ergänzen
    const slotsWithIds = [...uniq.values()].map(s => {
      const withIds = { ...s, ...makeIds(s) };
      const tmlId = tmlArtistMap.get(withIds.artistId) ?? null;
      if (tmlId) withIds.tomorrowlandArtistId = tmlId;
      return withIds;
    });

    // Optional: getrennte Snapshots pro Weekend
    const byWeekend = slotsWithIds.reduce((acc, s) => {
      (acc[s.weekend] ||= []).push(s);
      return acc;
    }, {});

    for (const [weekend, slots] of Object.entries(byWeekend)) {
      const snapshot = {
        meta: {
          festival: "tomorrowland",
          year: 2026,
          weekend,
          createdAt,
          source: "belgium.tomorrowland.com (playwright)",
          version: 1
        },
        slots
      };

      const file = `${ts}_${weekend}.json`;
      const filePath = path.join(SNAP_DIR, file);

      writeJson(filePath, snapshot);
      const idx = updateSnapshotIndex(file, createdAt, slots.length);

      console.log(`Wrote snapshot ${file} (slots=${slots.length}) latest=${idx.latest}`);
    }

    // latest.json als kombinierter Snapshot (W1 + W2)
    const combined = {
      meta: {
        festival: "tomorrowland",
        year: 2026,
        weekend: "W1+W2",
        createdAt,
        source: "belgium.tomorrowland.com (playwright)",
        version: 1
      },
      slots: slotsWithIds
    };
    writeJson(path.join(SNAP_DIR, "latest.json"), combined);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});



