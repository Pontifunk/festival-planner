// scripts/generate-changes.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const BASE = path.join(REPO_ROOT, "data", "tomorrowland", "2026");
const SNAP_DIR = path.join(BASE, "snapshots");
const CHG_DIR  = path.join(BASE, "changes");

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function readJsonSafe(file, fallback) { try { return readJson(file); } catch { return fallback; } }
function writeJson(file, obj) { fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf8"); }

function indexBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) m.set(keyFn(x), x);
  return m;
}

function diffSnapshots(prevSnap, currSnap) {
  const prevSlots = prevSnap?.slots ?? [];
  const currSlots = currSnap?.slots ?? [];

  const prevBySlot = indexBy(prevSlots, s => s.slotId);
  const currBySlot = indexBy(currSlots, s => s.slotId);

  const added = [];
  const removed = [];

  for (const [slotId] of currBySlot) if (!prevBySlot.has(slotId)) added.push(slotId);
  for (const [slotId] of prevBySlot) if (!currBySlot.has(slotId)) removed.push(slotId);

  // replaced: same positionId in both, different artistId
  const prevByPos = indexBy(prevSlots, s => s.positionId);
  const currByPos = indexBy(currSlots, s => s.positionId);

  const replaced = [];
  for (const [posId, curr] of currByPos) {
    const prev = prevByPos.get(posId);
    if (prev && prev.artistId !== curr.artistId) {
      replaced.push({
        positionId: posId,
        from: { slotId: prev.slotId, artistId: prev.artistId, artist: prev.artist },
        to:   { slotId: curr.slotId, artistId: curr.artistId, artist: curr.artist }
      });
    }
  }

  return {
    summary: { added: added.length, removed: removed.length, replaced: replaced.length },
    added,
    removed,
    replaced
  };
}

function getWeekendFromFilename(file) {
  const m = file.match(/_W([12])\.json$/i);
  return m ? `W${m[1]}` : null;
}

function nowTs() {
  const createdAt = new Date().toISOString();
  const ts = createdAt
    .replace(/[:-]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
    .replace("T", "_");
  return { createdAt, ts };
}

function main() {
  ensureDir(CHG_DIR);

  const snapIndexPath = path.join(SNAP_DIR, "index.json");
  const snapIndex = readJsonSafe(snapIndexPath, null);
  if (!snapIndex?.snapshots?.length) {
    console.log("No snapshots/index.json or empty snapshots list. Skipping changes.");
    return;
  }

  // sort by createdAt asc to ensure "previous" logic is stable
  const entries = [...snapIndex.snapshots].sort((a,b) => a.createdAt.localeCompare(b.createdAt));

  const byWeekend = { W1: [], W2: [] };
  for (const e of entries) {
    const w = getWeekendFromFilename(e.file);
    if (w && byWeekend[w]) byWeekend[w].push(e);
  }

  const { createdAt, ts } = nowTs();

  const chgIndexPath = path.join(CHG_DIR, "index.json");
  const chgIndex = readJsonSafe(chgIndexPath, { latest: { W1: null, W2: null }, entries: [] });

  for (const weekend of ["W1", "W2"]) {
    const list = byWeekend[weekend];
    if (!list || list.length < 2) {
      console.log(`Not enough snapshots for ${weekend} (need 2). Skipping.`);
      continue;
    }

    const prevEntry = list[list.length - 2];
    const currEntry = list[list.length - 1];

    const prevSnap = readJson(path.join(SNAP_DIR, prevEntry.file));
    const currSnap = readJson(path.join(SNAP_DIR, currEntry.file));

    const diff = diffSnapshots(prevSnap, currSnap);

    const changeFile = `${ts}_${weekend}.changes.json`;
    const changePath = path.join(CHG_DIR, changeFile);

    const changeObj = {
      meta: {
        weekend,
        from: prevEntry.file,
        to: currEntry.file,
        createdAt,
        version: 1
      },
      ...diff
    };

    writeJson(changePath, changeObj);
    writeJson(path.join(CHG_DIR, `latest_${weekend}.json`), changeObj);

    // index updaten (dedup by file)
    chgIndex.entries = chgIndex.entries.filter(e => e.file !== changeFile);
    chgIndex.entries.push({
      weekend,
      file: changeFile,
      from: prevEntry.file,
      to: currEntry.file,
      createdAt,
      summary: diff.summary
    });

    chgIndex.latest = chgIndex.latest || { W1: null, W2: null };
    chgIndex.latest[weekend] = changeFile;

    console.log(`Wrote changes ${changeFile} (${weekend}) summary=`, diff.summary);
  }

  // sort index
  chgIndex.entries.sort((a,b) => a.createdAt.localeCompare(b.createdAt));
  writeJson(chgIndexPath, chgIndex);

  // optional combined latest.json for convenience
  const combined = {
    meta: { createdAt, version: 1, note: "latest changes per weekend" },
    latest: {
      W1: readJsonSafe(path.join(CHG_DIR, "latest_W1.json"), null),
      W2: readJsonSafe(path.join(CHG_DIR, "latest_W2.json"), null)
    }
  };
  writeJson(path.join(CHG_DIR, "latest.json"), combined);

  // No cross-weekend diff; only per-weekend snapshot changes are persisted.
}

main();
