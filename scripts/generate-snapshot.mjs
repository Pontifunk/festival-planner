// scripts/generate-snapshot.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const OUT_DIR = path.resolve(process.cwd(), "..", "data", "tomorrowland", "2026", "snapshots");

function normalizeArtist(name) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ");
}

function hash(str) {
  return crypto.createHash("sha256").update(str).digest("hex").slice(0, 16);
}

function makeIds(slot) {
  const artistNormalized = normalizeArtist(slot.artist);
  const artistId = hash(`tml|${artistNormalized}`);
  const positionId = hash(`${slot.date}|${slot.stage}|${slot.start}|${slot.end}`);
  const slotId = hash(`${positionId}|${artistId}`);
  return { artistNormalized, artistId, positionId, slotId };
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readJsonSafe(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function main() {
  ensureDir(OUT_DIR);

  const createdAt = new Date().toISOString();
  const snapshotName = createdAt.slice(0, 10); // YYYY-MM-DD
  const snapshotFile = path.join(OUT_DIR, `${snapshotName}.json`);

  // TODO: hier später echtes Scraping-Ergebnis rein
  const slotsRaw = [
    { date: "2026-07-17", stage: "Mainstage", start: "20:00", end: "21:00", artist: "Example Artist" },
  ].map(s => ({ ...s, ...makeIds(s) }));

  const snapshot = {
    meta: {
      festival: "tomorrowland",
      year: 2026,
      createdAt,
      source: "generated (template)",
      version: 1
    },
    slots: slotsRaw
  };

  // Snapshot schreiben
  writeJson(snapshotFile, snapshot);

  // Index aktualisieren
  const indexFile = path.join(OUT_DIR, "index.json");
  const index = readJsonSafe(indexFile, { latest: null, snapshots: [] });

  // Falls Snapshot mit gleichem Datum schon existiert, ersetze ihn
  index.snapshots = index.snapshots.filter(s => s.file !== `${snapshotName}.json`);
  index.snapshots.push({
    file: `${snapshotName}.json`,
    createdAt,
    slotCount: slotsRaw.length
  });

  // sort newest last (oder nach createdAt)
  index.snapshots.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  index.latest = index.snapshots[index.snapshots.length - 1]?.file ?? null;

  writeJson(indexFile, index);

  // optional latest.json
  const latestFile = path.join(OUT_DIR, "latest.json");
  writeJson(latestFile, snapshot);

  console.log(`Wrote ${snapshotFile}`);
  console.log(`Updated ${indexFile} (latest=${index.latest})`);
}

main();
