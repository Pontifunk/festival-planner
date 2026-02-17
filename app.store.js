// ====== RATINGS ======
function badgeFor(r) {
  if (r === "liked") return { cls: "ok", text: getRatingLabel("liked") };
  if (r === "maybe") return { cls: "warn", text: getRatingLabel("maybe") };
  if (r === "disliked") return { cls: "bad", text: getRatingLabel("disliked") };
  return { cls: "", text: getRatingLabel("unrated", { kind: "status" }) };
}

function resolveWeekendKey(value) {
  const raw = String(value || "").trim();
  if (raw) {
    const upper = raw.toUpperCase();
    if (upper === "W1" || upper === "W2") return upper;
  }
  const active = state?.activeWeekend;
  if (active === "W1" || active === "W2") return active;
  try {
    const m = String(location.pathname || "").match(/\/w(1|2)\//i);
    if (m) return `W${m[1]}`;
  } catch {
    // Ignore location parsing errors.
  }
  if (typeof DEFAULT_WEEKEND !== "undefined" && DEFAULT_WEEKEND) return DEFAULT_WEEKEND;
  return "W1";
}

// Updates rating state and persists to IndexedDB.
async function setRating(artistId, rate) {
  if (!artistId) return;
  const weekend = resolveWeekendKey(state.activeWeekend);
  if (!state.ratingsByWeekend) state.ratingsByWeekend = {};
  if (!state.ratingsByWeekend[weekend]) state.ratingsByWeekend[weekend] = {};
  ratings = state.ratingsByWeekend[weekend];

  const value = rate || "unrated";
  ratings[artistId] = value;
  await dbPut(makeDbKey(state, weekend, artistId), value);
}

// ====== INDEXEDDB (minimal) ======
const DB_NAME = "festival_planner";
const DB_STORE = "ratings";
const DB_VERSION = 1;

// Creates the key prefix for a festival/year/weekend.
function makeDbKeyPrefix(r, weekend){
  const wk = resolveWeekendKey(weekend);
  return `${r.festival}::${r.year}::${wk}::`;
}
// Creates the full key for an artist rating.
function makeDbKey(r, weekend, artistId){ return `${makeDbKeyPrefix(r, weekend)}${artistId}`; }
// Legacy (pre-weekend) key prefix.
function makeLegacyDbKeyPrefix(r){ return `${r.festival}::${r.year}::`; }

// Opens the IndexedDB database.
function db(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(DB_STORE)) d.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
// Stores a rating in IndexedDB.
async function dbPut(key, value){
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
// Deletes a rating from IndexedDB.
async function dbDelete(key){
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
// Reads all ratings with the given key prefix.
async function dbGetAll(prefix){
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(DB_STORE, "readonly");
    const store = tx.objectStore(DB_STORE);
    const out = {};
    const req = store.openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) { resolve(out); return; }
      if (String(cur.key).startsWith(prefix)) {
        const actId = String(cur.key).slice(prefix.length);
        out[actId] = cur.value;
      }
      cur.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

// Clears all rating entries from IndexedDB.
async function dbClearAll(){
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}


