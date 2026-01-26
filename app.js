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
let selectUid = 0;
const customSelectMap = new WeakMap();

// ====== INIT ======
init();

async function init() {
  if (DONATION_URL && !DONATION_URL.includes("DEINNAME")) {
    donateBtn.href = DONATION_URL;
  } else {
    donateBtn.href = "#";
    donateBtn.classList.add("isDisabled");
    donateBtn.setAttribute("aria-disabled", "true");
    donateBtn.title = "Spendenlink folgt";
  }
  feedbackBtn.href = FEEDBACK_URL;

  langSelect.value = lang;
  initCustomSelect(langSelect);
  initCustomSelect(weekendSelect);
  initCustomSelect(ratingFilter);
  await applyTranslations(lang);

  if (!route.festival) route.festival = DEFAULT_FESTIVAL;
  if (!route.year) route.year = DEFAULT_YEAR;
  if (!route.weekend) route.weekend = DEFAULT_WEEKEND;
  route.festival = cleanSegment(route.festival, /^[a-z0-9-]+$/i, DEFAULT_FESTIVAL);
  route.year = cleanSegment(route.year, /^\d{4}$/, DEFAULT_YEAR);
  route.weekend = cleanSegment(route.weekend, /^w\d+$/i, DEFAULT_WEEKEND);

  normalizeUrlIfNeeded();
  ensureCanonicalUrl();

  weekendSelect.value = route.weekend;
  syncCustomSelect(weekendSelect);

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

// ====== CUSTOM SELECT ======
function initCustomSelect(selectEl) {
  if (!selectEl || selectEl.dataset.customReady) return;
  selectEl.dataset.customReady = "true";
  selectEl.tabIndex = -1;
  selectEl.setAttribute("aria-hidden", "true");

  const wrapper = document.createElement("div");
  wrapper.className = "selectWrap";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "selectTrigger";
  trigger.id = `select-trigger-${selectUid++}`;
  trigger.setAttribute("role", "combobox");
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const list = document.createElement("div");
  list.className = "selectList";
  list.setAttribute("role", "listbox");
  list.tabIndex = -1;
  list.id = `select-list-${selectUid++}`;
  list.setAttribute("aria-labelledby", trigger.id);
  trigger.setAttribute("aria-controls", list.id);

  const opts = Array.from(selectEl.options);
  opts.forEach((opt) => {
    const item = document.createElement("div");
    item.className = "selectOption";
    item.id = `select-opt-${selectUid++}`;
    item.setAttribute("role", "option");
    item.setAttribute("data-value", opt.value);
    item.textContent = opt.textContent;
    item.tabIndex = -1;
    list.appendChild(item);
  });

  selectEl.parentNode.insertBefore(wrapper, selectEl.nextSibling);
  wrapper.appendChild(trigger);
  wrapper.appendChild(list);

  customSelectMap.set(selectEl, { wrapper, trigger, list });

  const closeAll = (returnFocus = false) => {
    wrapper.classList.remove("isOpen");
    trigger.setAttribute("aria-expanded", "false");
    list.tabIndex = -1;
    if (returnFocus) trigger.focus();
  };

  const open = () => {
    wrapper.classList.add("isOpen");
    trigger.setAttribute("aria-expanded", "true");
    list.tabIndex = 0;
    list.focus();
  };

  const toggle = () => (wrapper.classList.contains("isOpen") ? closeAll(true) : open());

  const setValue = (val, focusTrigger = true) => {
    if (selectEl.value === val) return;
    selectEl.value = val;
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    syncCustomSelect(selectEl);
    if (focusTrigger) trigger.focus();
  };

  const move = (dir) => {
    const values = opts.map(o => o.value);
    const idx = Math.max(0, values.indexOf(selectEl.value));
    const next = Math.min(values.length - 1, Math.max(0, idx + dir));
    setValue(values[next], false);
  };

  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    toggle();
  });

  trigger.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); open(); move(1); }
    if (e.key === "ArrowUp") { e.preventDefault(); open(); move(-1); }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    if (e.key === "Escape") { e.preventDefault(); closeAll(true); }
  });

  list.addEventListener("click", (e) => {
    const item = e.target.closest(".selectOption");
    if (!item) return;
    setValue(item.getAttribute("data-value"));
    closeAll(true);
  });

  list.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); closeAll(true); }
    if (e.key === "Escape") { e.preventDefault(); closeAll(true); }
  });

  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target)) closeAll();
  });

  trigger.addEventListener("blur", () => {
    setTimeout(() => {
      if (!wrapper.contains(document.activeElement)) closeAll();
    }, 0);
  });

  syncCustomSelect(selectEl);
}

function syncCustomSelect(selectEl) {
  const bound = customSelectMap.get(selectEl);
  const wrapper = bound?.wrapper || (selectEl.nextSibling?.classList?.contains("selectWrap")
    ? selectEl.nextSibling
    : selectEl.parentNode.querySelector(".selectWrap"));
  if (!wrapper) return;
  const trigger = wrapper.querySelector(".selectTrigger");
  const list = wrapper.querySelector(".selectList");
  const options = Array.from(list.querySelectorAll(".selectOption"));
  const map = new Map(Array.from(selectEl.options).map(o => [o.value, o.textContent]));
  let activeId = "";

  options.forEach(opt => {
    const val = opt.getAttribute("data-value");
    if (map.has(val)) opt.textContent = map.get(val);
    const isActive = val === selectEl.value;
    opt.classList.toggle("isActive", isActive);
    opt.setAttribute("aria-selected", isActive ? "true" : "false");
    if (isActive) activeId = opt.id;
  });

  const active = options.find(opt => opt.classList.contains("isActive"));
  trigger.textContent = active ? active.textContent : selectEl.options[selectEl.selectedIndex]?.textContent || "";
  if (activeId) trigger.setAttribute("aria-activedescendant", activeId);
}

function canonicalPath(r) {
  const base = `/${r.festival}/${r.year}/${r.weekend}`;
  return CANONICAL_TRAILING_SLASH ? `${base}/` : base;
}

function setCanonicalRoute(r) {
  history.replaceState({}, "", canonicalPath(r));
}

function normalizeUrlIfNeeded() {
  const { value: p, rest } = stripQueryParam(location.search, "path");
  if (!p) return;
  const canonical = canonicalPath(route) + rest;
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
      if (type === "sc") openLink(makeSoundCloudSearchUrl(name));
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
          <div class=\"quicklinks\" style=\"margin-top:8px\">
            <button class=\"qbtn sp\" data-ql=\"sp\" data-name=\"${escapeAttr(a.name)}\"><span class=\"qicon\" aria-hidden=\"true\"></span><span class=\"qtext\">Spotify</span></button>
            <button class=\"qbtn am\" data-ql=\"am\" data-name=\"${escapeAttr(a.name)}\"><span class=\"qicon\" aria-hidden=\"true\"></span><span class=\"qtext\">Apple</span></button>
            <button class=\"qbtn yt\" data-ql=\"yt\" data-name=\"${escapeAttr(a.name)}\"><span class=\"qicon\" aria-hidden=\"true\"></span><span class=\"qtext\">YouTube</span></button>
            <button class=\"qbtn sc\" data-ql=\"sc\" data-name=\"${escapeAttr(a.name)}\"><span class=\"qicon\" aria-hidden=\"true\"></span><span class=\"qtext\">SoundCloud</span></button>
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
      if (type === "sc") openLink(makeSoundCloudSearchUrl(name));
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

        <div class=\"quicklinks\">
          <button class=\"qbtn sp\" data-ql=\"sp\" data-name=\"${escapeAttr(a.name)}\"><span class=\"qicon\" aria-hidden=\"true\"></span><span class=\"qtext\">Spotify</span></button>
          <button class=\"qbtn am\" data-ql=\"am\" data-name=\"${escapeAttr(a.name)}\"><span class=\"qicon\" aria-hidden=\"true\"></span><span class=\"qtext\">Apple</span></button>
          <button class=\"qbtn yt\" data-ql=\"yt\" data-name=\"${escapeAttr(a.name)}\"><span class=\"qicon\" aria-hidden=\"true\"></span><span class=\"qtext\">YouTube</span></button>
          <button class=\"qbtn sc\" data-ql=\"sc\" data-name=\"${escapeAttr(a.name)}\"><span class=\"qicon\" aria-hidden=\"true\"></span><span class=\"qtext\">SoundCloud</span></button>
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
  const overridePath = getQueryParam("path");
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
  document.querySelectorAll("[data-custom-select]").forEach((sel) => syncCustomSelect(sel));
}

function cleanSegment(value, pattern, fallback) {
  const v = String(value || "").trim();
  if (!v || !pattern.test(v)) return fallback;
  return v;
}

function getQueryParam(name) {
  if (typeof URLSearchParams !== "undefined") {
    return new URLSearchParams(location.search).get(name);
  }
  const query = String(location.search || "").replace(/^\?/, "");
  if (!query) return null;
  for (const part of query.split("&")) {
    if (!part) continue;
    const [k, v = ""] = part.split("=");
    if (decodeURIComponent(k) === name) {
      return decodeURIComponent(v.replace(/\+/g, " "));
    }
  }
  return null;
}

function stripQueryParam(search, name) {
  if (typeof URLSearchParams !== "undefined") {
    const params = new URLSearchParams(search);
    const value = params.get(name);
    if (value === null) return { value: null, rest: search || "" };
    params.delete(name);
    const qs = params.toString();
    return { value, rest: qs ? `?${qs}` : "" };
  }
  const query = String(search || "").replace(/^\?/, "");
  if (!query) return { value: null, rest: "" };
  let value = null;
  const kept = [];
  for (const part of query.split("&")) {
    if (!part) continue;
    const [k, v = ""] = part.split("=");
    const key = decodeURIComponent(k);
    if (key === name) {
      value = decodeURIComponent(v.replace(/\+/g, " "));
    } else {
      kept.push(part);
    }
  }
  return { value, rest: kept.length ? `?${kept.join("&")}` : "" };
}

function t(key) {
  return dict[key] || key;
}

// ====== MUSIC LINKS ======
function makeSpotifySearchUrl(name){ return `https://open.spotify.com/search/${encodeURIComponent(name)}`; }
function makeAppleMusicSearchUrl(name){ return `https://music.apple.com/search?term=${encodeURIComponent(name)}`; }
function makeYouTubeSearchUrl(name){ return `https://www.youtube.com/results?search_query=${encodeURIComponent(name + " dj set")}`; }
function makeSoundCloudSearchUrl(name){ return `https://soundcloud.com/search?q=${encodeURIComponent(name)}`; }
function openLink(url){ window.open(url, "_blank", "noopener"); }

// ====== UTIL ======
function formatDateTime(iso){
  if (!iso) return "–";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
function escapeHtml(s){
  return String(s || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/\"/g,"&quot;")
    .replace(/'/g,"&#039;");
}
function escapeAttr(s){ return escapeHtml(s).replace(/`/g,"&#096;"); }

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
