// ====== CONFIG ======
const DEFAULT_FESTIVAL = "tomorrowland";
const DEFAULT_YEAR = "2026";
const DEFAULT_WEEKEND = "w1";

const DONATION_URL = "https://buymeacoffee.com/DEINNAME"; // TODO
const FEEDBACK_URL = "https://github.com/DEINUSER/DEINREPO/issues/new"; // TODO

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
let lineup = null;       // loaded JSON
let ratings = {};        // { actId: "liked"|"maybe"|"disliked" }

// ====== INIT ======
init();

async function init(){
  // buttons
  donateBtn.href = DONATION_URL;
  feedbackBtn.href = FEEDBACK_URL;

  // language
  langSelect.value = lang;
  await applyTranslations(lang);

  // route defaults
  if (!route.festival) route.festival = DEFAULT_FESTIVAL;
  if (!route.year) route.year = DEFAULT_YEAR;
  if (!route.weekend) route.weekend = DEFAULT_WEEKEND;

  weekendSelect.value = route.weekend;

  // load
  await loadAndRender();

  // events
  langSelect.addEventListener("change", async () => {
    lang = langSelect.value;
    localStorage.setItem("fp_lang", lang);
    await applyTranslations(lang);
    render(); // rerender labels in UI if needed
  });

  weekendSelect.addEventListener("change", async () => {
    route.weekend = weekendSelect.value;
    // Update URL (nice for SEO + share)
    const newPath = `/${route.festival}/${route.year}/${route.weekend}`;
    history.replaceState({}, "", newPath);
    await loadAndRender();
  });

  searchInput.addEventListener("input", render);
  ratingFilter.addEventListener("change", render);
}

async function loadAndRender(){
  lineup = await fetchLineup(route.festival, route.year, route.weekend);
  // load ratings for this namespace
  ratings = await dbGetAll(makeDbKeyPrefix(route));
  renderHeaderStamps(lineup);
  render();
}

function render(){
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

  // bind act click + quicklinks + rating toggle
  Array.from(document.querySelectorAll(".act")).forEach(el => {
    el.addEventListener("click", async () => {
      const id = el.getAttribute("data-id");
      await cycleRating(id);
    });
  });

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

function renderFavorites(){
  const favActs = (lineup.acts || [])
    .filter(a => (ratings[a.id] || "unrated") === "liked");

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
    : `<div class="muted">Noch keine Favoriten.</div>`;

  // bind quicklinks in favorites too
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

function renderActRow(a){
  const r = ratings[a.id] || "unrated";
  const badge = badgeFor(r);
  return `
    <div class="act" data-id="${escapeAttr(a.id)}">
      <div>
        <div class="actName">${escapeHtml(a.name)}</div>
        <div class="actMeta">${escapeHtml(a.day)} · ${escapeHtml(a.stage)} · ${escapeHtml(a.timeStart || "–")}–${escapeHtml(a.timeEnd || "–")}</div>
      </div>
      <div class="badges">
        <div class="badge ${badge.cls}">${badge.text}</div>
        <div class="quicklinks">
          <button class="qbtn sp" data-ql="sp" data-name="${escapeAttr(a.name)}">Spotify</button>
          <button class="qbtn am" data-ql="am" data-name="${escapeAttr(a.name)}">Apple</button>
          <button class="qbtn yt" data-ql="yt" data-name="${escapeAttr(a.name)}">YouTube</button>
        </div>
      </div>
    </div>
  `;
}

function badgeFor(r){
  if (r === "liked") return { cls:"ok", text: t("liked") };
  if (r === "maybe") return { cls:"warn", text: t("maybe") };
  if (r === "disliked") return { cls:"bad", text: t("disliked") };
  return { cls:"", text: t("unrated") };
}

async function cycleRating(actId){
  const current = ratings[actId] || "unrated";
  const next = current === "unrated" ? "liked"
            : current === "liked" ? "maybe"
            : current === "maybe" ? "disliked"
            : "unrated";

  if (next === "unrated") {
    delete ratings[actId];
    await dbDelete(makeDbKey(route, actId));
  } else {
    ratings[actId] = next;
    await dbPut(makeDbKey(route, actId), next);
  }
  render();
}

function renderHeaderStamps(data){
  lastCheckedPill.textContent = `${t("last_checked")}: ${formatDateTime(data.lastCheckedAt)}`;
  lastUpdatedPill.textContent = `${t("lineup_status")}: ${data.lastUpdated || "–"}`;
}

// ====== ROUTING ======
function parseRoute(pathname){
  // expected: /festival/year/weekend
  const parts = (pathname || "/").split("/").filter(Boolean);
  return {
    festival: parts[0] || "",
    year: parts[1] || "",
    weekend: parts[2] || ""
  };
}

// ====== DATA LOADING ======
async function fetchLineup(festival, year, weekend){
  const url = `/data/${festival}/${year}/${weekend}.json`;
  const res = await fetch(url, { cache: "no-store" }); // keep simple for v1
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return await res.json();
}

// ====== i18n ======
let dict = {};
async function applyTranslations(newLang){
  const res = await fetch(`/i18n/${newLang}.json`, { cache: "no-store" });
  dict = res.ok ? await res.json() : {};
  document.documentElement.lang = newLang;

  // replace data-i18n nodes
  Array.from(document.querySelectorAll("[data-i18n]")).forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (key && dict[key]) el.textContent = dict[key];
  });

  // update placeholders
  searchInput.placeholder = t("search");
}

function t(key){
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

function makeDbKeyPrefix(r){
  return `${r.festival}::${r.year}::${r.weekend}::`;
}
function makeDbKey(r, actId){
  return `${makeDbKeyPrefix(r)}${actId}`;
}

function db(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
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
