// ====== CONFIG ======
const DEFAULT_FESTIVAL = "tomorrowland";
const DEFAULT_YEAR = "2026";
const DEFAULT_WEEKEND = "w1";

const DONATION_URL = "https://buymeacoffee.com/DEINNAME"; // TODO
const FEEDBACK_URL = "https://github.com/Puntifunk/festival-planner/issues/new";

const CANONICAL_TRAILING_SLASH = true;

// ====== DOM ======
const weekendSelect = document.getElementById("weekendSelect");
const langSelect = document.getElementById("langSelect");
const lastCheckedPill = document.getElementById("lastCheckedPill");
const lastUpdatedPill = document.getElementById("lastUpdatedPill");

const searchInput = document.getElementById("searchInput");
const ratingFilter = document.getElementById("ratingFilter");

const actsList = document.getElementById("actsList");
const favoritesList = document.getElementById("favoritesList");

const donateBtn = document.getElementById("donateBtn");
const feedbackBtn = document.getElementById("feedbackBtn");

// ====== STATE ======
let lang = localStorage.getItem("fp_lang") || "de";
let route = parseRoute(location.pathname);
let lineup = null;
let ratings = {}; // { actId: "liked"|"maybe"|"disliked" }

// ====== INIT ======
init();

async function init() {
  if (DONATION_URL && !DONATION_URL.includes("DEINNAME")) {
    donateBtn.href = DONATION_URL;
  } else {
    donateBtn.style.display = "none";
  }
  feedbackBtn.href = FEEDBACK_URL;

  langSelect.value = lang;
  await applyTranslations(lang);

  if (!route.festival) route.festival = DEFAULT_FESTIVAL;
  if (!route.year) route.year = DEFAULT_YEAR;
  if (!route.weekend) route.weekend = DEFAULT_WEEKEND;

  normalizeUrlIfNeeded();
  ensureCanonicalUrl();

  weekendSelect.value = route.weekend;

  await loadAndRender();

  langSelect.addEventListener("change", async () => {
    lang = langSelect.value;
    localStorage.setItem("fp_lang", lang);
    await applyTranslations(lang);
    render();
  });

  weekendSelect.addEventListener("change", async () => {
    route.weekend = weekendSelect.value;
    setCanonicalRoute(route);
    await loadAndRender();
  });

  searchInput.addEventListener("input", render);
  ratingFilter.addEventListener("change", render);
}

function canonicalPath(r) {
  const base = `/${r.festival}/${r.year}/${r.weekend}`;
  return CANONICAL_TRAILING_SLASH ? `${base}/` : base;
}

function setCanonicalRoute(r) {
  history.replaceState({}, "", canonicalPath(r));
}

function normalizeUrlIfNeeded() {
  const params = new URLSearchParams(location.search);
  const p = params.get("path");
  if (!p) return;

  params.delete("path");
  const qs = params.toString();
  const canonical = canonicalPath(route) + (qs ? `?${qs}` : "");
  history.replaceState({}, "", canonical);
}

function ensureCanonicalUrl() {
  if (!CANONICAL_TRAILING_SLASH) return;

  const desired = canonicalPath(route);
  const currentPath = location.pathname;

  if (currentPath === desired) return;

  if (currentPath === "/" || currentPath === "/index.html") {
    history.replaceState({}, "", desired);
    return;
  }

  const noSlash = desired.endsWith("/") ? desired.slice(0, -1) : desired;
  if (currentPath === noSlash) {
    history.replaceState({}, "", desired);
  }
}

async function loadAndRender() {
  try {
    lineup = await fetchLineup(route.festival, route.year, route.weekend);
  } catch (e) {
    console.error(e);
    lineup = { acts: [], lastCheckedAt: null, lastUpdated: null };
  }

  ratings = await dbGetAll(makeDbKeyPrefix(route));
  renderHeaderStamps(lineup);
  render();
}

function render() {
  if (!lineup) return;

  const q = (searchInput.value || "").trim().toLowerCase();
  const rf = ratingFilter.value;

  const acts = (lineup.acts || []).filter(a => {
    const nameMatch = !q || (a.name || "").toLowerCase().includes(q);
    if (!nameMatch) return false;

    const r = ratings[a.id] || "unrated";
    if (rf === "all") return true;
    return r === rf;
  });

  actsList.innerHTML = acts.map(a => renderActRow(a)).join("");

  // rating buttons
  Array.from(document.querySelectorAll(".rbtn")).forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const rate = btn.getAttribute("data-rate");
      await setRating(id, rate);
    });
  });

  // quicklinks
  Array.from(document.querySelectorAll(".qbtn")).forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const name = btn.getAttribute("data-name") || "";
      const type = btn.getAttribute("data-ql");
      if (type === "sp") openLink(makeSpotifySearchUrl(name));
      if (type === "am") openLink(makeAppleMusicSearchUrl(name));
      if (type === "yt") openLink(makeYouTubeSearchUrl(name));
    });
  });

  renderFavorites();
}

function renderFavorites() {
  const favActs = (lineup.acts || []).filter(a => (ratings[a.id] || "unrated") === "liked");

  favoritesList.innerHTML = favActs.length
    ? favActs.map(a => `
        <div class="favItem">
          <div class="actName">${escapeHtml(a.name)}</div>
          <div class="actMeta">${escapeHtml(a.day)} · ${escapeHtml(a.stage)} · ${escapeHtml(a.timeStart || "–")}–${escapeHtml(a.timeEnd || "–")}</div>
          <div class="quicklinks" style="margin-top:8px">
            <button class="qbtn sp" data-ql="sp" data-name="${escapeAttr(a.name)}">Spotify</button>
            <button class="qbtn am" data-ql="am" data-name="${escapeAttr(a.name)}">Apple</button>
            <button class="qbtn yt" data-ql="yt" data-name="${escapeAttr(a.name)}">YouTube</button>
          </div>
        </div>
      `).join("")
    : `<div class="muted">${escapeHtml(t("no_favorites") || "Noch keine Favoriten.")}</div>`;

  Array.from(favoritesList.querySelectorAll(".qbtn")).forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const name = btn.getAttribute("data-name") || "";
      const type = btn.getAttribute("data-ql");
      if (type === "sp") openLink(makeSpotifySearchUrl(name));
      if (type === "am") openLink(makeAppleMusicSearchUrl(name));
      if (type === "yt") openLink(makeYouTubeSearchUrl(name));
    });
  });
}

function renderActRow(a) {
  const r = ratings[a.id] || "unrated";
  const badge = badgeFor(r);
  const active = (val) => (r === val ? "isActive" : "");

  return `
    <div class="act" data-id="${escapeAttr(a.id)}">
      <div>
        <div class="actName">${escapeHtml(a.name)}</div>
        <div class="actMeta">${escapeHtml(a.day)} · ${escapeHtml(a.stage)} · ${escapeHtml(a.timeStart || "–")}–${escapeHtml(a.timeEnd || "–")}</div>
      </div>

      <div class="badges">
        <div class="badge ${badge.cls}">${badge.text}</div>

        <div class="ratingBar">
          <button class="rbtn ${active("liked")}" data-rate="liked" data-id="${escapeAttr(a.id)}">${t("liked")}</button>
          <button class="rbtn ${active("maybe")}" data-rate="maybe" data-id="${escapeAttr(a.id)}">${t("maybe")}</button>
          <button class="rbtn ${active("disliked")}" data-rate="disliked" data-id="${escapeAttr(a.id)}">${t("disliked")}</button>
          <button class="rbtn ${active("unrated")}" data-rate="unrated" data-id="${escapeAttr(a.id)}">${t("reset")}</button>
        </div>

        <div class="quicklinks">
          <button class="qbtn sp" data-ql="sp" data-name="${escapeAttr(a.name)}">Spotify</button>
          <button class="qbtn am" data-ql="am" data-name="${escapeAttr(a.name)}">Apple</button>
          <button class="qbtn yt" data-ql="yt" data-name="${escapeAttr(a.name)}">YouTube</button>
        </div>
      </div>
    </div>
  `;
}

function badgeFor(r) {
  if (r === "liked") return { cls: "ok", text: t("liked") };
  if (r === "maybe") return { cls: "warn", text: t("maybe") };
  if (r === "disliked") return { cls: "bad", text: t("disliked") };
  return { cls: "", text: t("unrated") };
}

async function setRating(actId, rate) {
  if (rate === "unrated") {
    delete ratings[actId];
    await dbDelete(makeDbKey(route, actId));
  } else {
    ratings[actId] = rate;
    await dbPut(makeDbKey(route, actId), rate);
  }
  render();
}

function renderHeaderStamps(data) {
  lastCheckedPill.textContent = `${t("last_checked")}: ${formatDateTime(data.lastCheckedAt)}`;
  lastUpdatedPill.textContent = `${t("lineup_status")}: ${data.lastUpdated || "–"}`;
}

// ====== ROUTING ======
function parseRoute(pathname) {
  const params = new URLSearchParams(location.search);
  const overridePath = params.get("path");
  const effectivePath = overridePath ? overridePath : pathname;

  const parts = (effectivePath || "/").split("/").filter(Boolean);
  return {
    festival: parts[0] || "",
    year: parts[1] || "",
    weekend: parts[2] || ""
  };
}

// ====== DATA LOADING ======
async function fetchLineup(festival, year, weekend) {
  const url = `/data/${festival}/${year}/${weekend}.json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return await res.json();
}

// ====== i18n ======
let dict = {};
async function applyTranslations(newLang) {
  const res = await fetch(`/i18n/${newLang}.json`, { cache: "no-store" });
  dict = res.ok ? await res.json() : {};
  document.documentElement.lang = newLang;

  Array.from(document.querySelectorAll("[data-i18n]")).forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (key && dict[key]) el.textContent = dict[key];
  });

  searchInput.placeholder = t("search");
}

function t(key) {
  return dict[key] || key;
}

// ====== MUSIC LINKS ======
function makeSpotifySearchUrl(name){ return `https://open.spotify.com/search/${encodeURIComponent(name)}`; }
function makeAppleMusicSearchUrl(name){ return `https://music.apple.com/search?term=${encodeURIComponent(name)}`; }
function makeYouTubeSearchUrl(name){ return `https://www.youtube.com/results?search_query=${encodeURIComponent(name + " dj set")}`; }
function openLink(url){ window.open(url, "_blank", "noopener"); }

// ====== UTIL ======
function formatDateTime(iso){
  if (!iso) return "–";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
function escapeHtml(s){
  return String(s || "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function escapeAttr(s){ return escapeHtml(s).replaceAll("`","&#096;"); }

// ====== INDEXEDDB (minimal) ======
const DB_NAME = "festival_planner";
const DB_STORE = "ratings";
const DB_VERSION = 1;

function makeDbKeyPrefix(r){ return `${r.festival}::${r.year}::${r.weekend}::`; }
function makeDbKey(r, actId){ return `${makeDbKeyPrefix(r)}${actId}`; }

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
async function dbPut(key, value){
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function dbDelete(key){
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
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
