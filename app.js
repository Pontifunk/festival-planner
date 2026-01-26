// ====== CONFIG ======
const DEFAULT_FESTIVAL = "tomorrowland";
const DEFAULT_YEAR = "2026";
const DEFAULT_WEEKEND = "W1";

const DONATION_URL = "buymeacoffee.com/pontifunk"; 
const FEEDBACK_URL = "https://github.com/Pontifunk/festival-planner/issues/new/choose";

const CANONICAL_TRAILING_SLASH = true;
const WEEKENDS = ["W1", "W2"];

// ====== DOM ======
const langSelect = document.getElementById("langSelect");
const lastCheckedPill = document.getElementById("lastCheckedPill");
const lastUpdatedPill = document.getElementById("lastUpdatedPill");

const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const ratingFilter = document.getElementById("ratingFilter");
const dayFilter = document.getElementById("dayFilter");
const stageFilter = document.getElementById("stageFilter");

const changesBox = document.getElementById("changesBox");
const changesSummary = document.getElementById("changesSummary");
const changesDetails = document.getElementById("changesDetails");
const changesDetailsBody = document.getElementById("changesDetailsBody");

const errorBox = document.getElementById("errorBox");

const weekendTabs = Array.from(document.querySelectorAll(".tabBtn"));
const weekendPanels = Array.from(document.querySelectorAll(".weekendPanel"));

const snapshotSelectW1 = document.getElementById("snapshotSelectW1");
const snapshotSelectW2 = document.getElementById("snapshotSelectW2");
const weekendMetaW1 = document.getElementById("weekendMetaW1");
const weekendMetaW2 = document.getElementById("weekendMetaW2");
const actsListW1 = document.getElementById("actsListW1");
const actsListW2 = document.getElementById("actsListW2");

const favoritesList = document.getElementById("favoritesList");
const donateBtn = document.getElementById("donateBtn");
const feedbackBtn = document.getElementById("feedbackBtn");

// ====== STATE ======
let lang = localStorage.getItem("fp_lang") || "de";
let route = parseRoute(location.pathname);
let selectUid = 0;
const customSelectMap = new WeakMap();
let ratings = {};

const state = {
  festival: DEFAULT_FESTIVAL,
  year: DEFAULT_YEAR,
  activeWeekend: DEFAULT_WEEKEND,
  snapshotIndex: null,
  weekends: {
    W1: { options: [], selectedFile: null, snapshot: null, grouped: [], artistSlots: new Map(), artistFirstEl: new Map(), filters: { day: "all", stage: "all" }, error: null },
    W2: { options: [], selectedFile: null, snapshot: null, grouped: [], artistSlots: new Map(), artistFirstEl: new Map(), filters: { day: "all", stage: "all" }, error: null }
  },
  artists: { list: [], byId: new Map() },
  changes: null,
  ratings: {}
};

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
  initCustomSelect(ratingFilter);
  initCustomSelect(dayFilter);
  initCustomSelect(stageFilter);
  initCustomSelect(snapshotSelectW1);
  initCustomSelect(snapshotSelectW2);

  await applyTranslations(lang);

  if (!route.festival) route.festival = DEFAULT_FESTIVAL;
  if (!route.year) route.year = DEFAULT_YEAR;
  route.festival = cleanSegment(route.festival, /^[a-z0-9-]+$/i, DEFAULT_FESTIVAL);
  route.year = cleanSegment(route.year, /^\d{4}$/, DEFAULT_YEAR);

  const routeWeekend = normalizeWeekend(route.weekend);
  if (routeWeekend) state.activeWeekend = routeWeekend;

  normalizeUrlIfNeeded();
  ensureCanonicalUrl();

  bindUi();

  try {
    await Promise.all([
      loadSnapshotIndex(),
      loadArtistsLatest(),
      loadChangesLatest()
    ]);
  } catch (e) {
    showError("Fehler beim Laden der Grunddaten.");
  }

  ratings = await dbGetAll(makeDbKeyPrefix(state));

  await Promise.all(WEEKENDS.map((w) => loadSnapshotForWeekend(w)));

  renderChangesBox();
  setActiveWeekend(state.activeWeekend, false);
}

function bindUi() {
  langSelect.addEventListener("change", async () => {
    lang = langSelect.value;
    localStorage.setItem("fp_lang", lang);
    await applyTranslations(lang);
    renderActiveWeekend();
  });

  snapshotSelectW1.addEventListener("change", async () => {
    await loadSnapshotForWeekend("W1", snapshotSelectW1.value);
    if (state.activeWeekend === "W1") renderActiveWeekend();
  });

  snapshotSelectW2.addEventListener("change", async () => {
    await loadSnapshotForWeekend("W2", snapshotSelectW2.value);
    if (state.activeWeekend === "W2") renderActiveWeekend();
  });

  weekendTabs.forEach(btn => {
    btn.addEventListener("click", () => setActiveWeekend(btn.getAttribute("data-weekend")));
  });

  searchInput.addEventListener("input", () => updateSearchResults());
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const first = searchResults.querySelector(".searchItem");
      if (first) {
        const id = first.getAttribute("data-artist-id");
        if (id) scrollToArtist(id);
      }
    }
  });

  ratingFilter.addEventListener("input", () => renderActiveWeekend());
  ratingFilter.addEventListener("change", () => renderActiveWeekend());

  if (dayFilter) {
    const onDayChange = () => {
      const w = state.weekends[state.activeWeekend];
      if (!w.filters) w.filters = { day: "all", stage: "all" };
      w.filters.day = dayFilter.value || "all";
      w.filters.stage = "all";
      renderActiveWeekend();
    };
    dayFilter.addEventListener("change", onDayChange);
    dayFilter.addEventListener("input", onDayChange);
  }

  if (stageFilter) {
    const onStageChange = () => {
      const w = state.weekends[state.activeWeekend];
      if (!w.filters) w.filters = { day: "all", stage: "all" };
      w.filters.stage = stageFilter.value || "all";
      renderActiveWeekend();
    };
    stageFilter.addEventListener("change", onStageChange);
    stageFilter.addEventListener("input", onStageChange);
  }
}
// ====== LOADING ======
async function loadSnapshotIndex() {
  const url = `/data/${state.festival}/${state.year}/snapshots/index.json`;
  const index = await fetchJson(url, { cache: "no-store" });
  state.snapshotIndex = index;

  WEEKENDS.forEach((weekend) => {
    const options = (index.snapshots || [])
      .filter(s => String(s.file || "").toUpperCase().endsWith(`_${weekend}.JSON`))
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

    state.weekends[weekend].options = options;
    setSnapshotOptions(weekend);
  });
}

async function loadLatestSnapshotForWeekend(weekend) {
  const latestUrl = `/data/${state.festival}/${state.year}/snapshots/latest.json`;
  const latest = await tryFetchJson(latestUrl, { cache: "no-store" });
  if (latest && normalizeWeekend(latest.meta?.weekend) === weekend) {
    const match = state.weekends[weekend].options.find(o => o.createdAt === latest.meta?.createdAt);
    if (match) {
      return { file: match.file, snapshot: await loadSnapshotFile(match.file) };
    }
    return { file: "latest.json", snapshot: latest };
  }

  const options = state.weekends[weekend].options;
  const fallback = options.length ? options[options.length - 1].file : null;
  if (!fallback) return null;

  return { file: fallback, snapshot: await loadSnapshotFile(fallback) };
}

async function loadSnapshotFile(file) {
  const url = `/data/${state.festival}/${state.year}/snapshots/${file}`;
  return await fetchJson(url, { cache: "default" });
}

async function loadSnapshotForWeekend(weekend, file = null) {
  const w = state.weekends[weekend];
  w.error = null;

  try {
    let snap;
    let selectedFile = file;

    if (!selectedFile) {
      const latest = await loadLatestSnapshotForWeekend(weekend);
      if (!latest) throw new Error("No snapshot available");
      selectedFile = latest.file;
      snap = latest.snapshot;
    } else {
      snap = await loadSnapshotFile(selectedFile);
    }

    w.snapshot = snap;
    w.selectedFile = selectedFile;
    const sel = snapshotSelectForWeekend(weekend);
    if (sel) {
      sel.value = selectedFile;
      syncCustomSelect(sel);
    }
  } catch (e) {
    w.error = "Snapshot konnte nicht geladen werden.";
    w.snapshot = null;
  }
}

async function loadArtistsLatest() {
  const base = `/data/${state.festival}/${state.year}/artists`;
  const latest = await tryFetchJson(`${base}/latest.json`, { cache: "no-store" });
  let data = latest;

  if (!data) {
    const index = await tryFetchJson(`${base}/index.json`, { cache: "no-store" });
    if (index?.latest) {
      data = await tryFetchJson(`${base}/${index.latest}`, { cache: "no-store" });
    }
  }

  if (data && Array.isArray(data.artists)) {
    state.artists.list = data.artists;
    state.artists.byId = new Map(data.artists.map(a => [a.artistId, a]));
  }
}

async function loadChangesLatest() {
  const base = `/data/${state.festival}/${state.year}/changes`;
  const latest = await tryFetchJson(`${base}/latest.json`, { cache: "no-store" });
  let data = latest;

  if (!data) {
    const index = await tryFetchJson(`${base}/index.json`, { cache: "no-store" });
    if (index?.latest) {
      data = await tryFetchJson(`${base}/${index.latest}`, { cache: "no-store" });
    }
  }

  state.changes = data;
}

// ====== RENDER ======
function renderActiveWeekend() {
  updateFiltersUI(state.activeWeekend);
  renderWeekend(state.activeWeekend);
  renderFavorites();
  updateSearchResults();
  renderStatusPills();
}

function renderWeekend(weekend) {
  const w = state.weekends[weekend];
  const container = weekend === "W1" ? actsListW1 : actsListW2;
  const metaEl = weekend === "W1" ? weekendMetaW1 : weekendMetaW2;

  if (w.error) {
    container.innerHTML = `<div class="muted">${escapeHtml(w.error)}</div>`;
    metaEl.textContent = "";
    return;
  }

  if (!w.snapshot || !Array.isArray(w.snapshot.slots)) {
    container.innerHTML = `<div class="muted">Keine Daten verf\u00fcgbar.</div>`;
    metaEl.textContent = "";
    return;
  }

  const activeFilters = w.filters || { day: "all", stage: "all" };
  const grouped = groupSlots(w.snapshot.slots, ratingFilter.value, activeFilters);
  w.grouped = grouped;
  w.artistSlots = buildArtistSlotMap(w.snapshot.slots);

  metaEl.textContent = `${t("snapshot_label")}: ${w.selectedFile || "\u2013"} \u00b7 ${t("slots") || "Slots"}: ${w.snapshot.slots.length}`;

  container.innerHTML = grouped.map(group => renderDayGroup(group, weekend)).join("");

  bindSlotInteractions(container, weekend);
  indexArtistElements(container, weekend);
}

function renderDayGroup(group, weekend) {
  const dateLabel = formatDate(group.date);
  const dayUrl = `https://belgium.tomorrowland.com/nl/line-up/?day=${group.date}`;

  const stagesHtml = group.stages.map(stageGroup => {
    const slotsHtml = stageGroup.slots.map(slot => renderSlot(slot, weekend)).join("");
    return `
      <div class="stageGroup">
        <div class="stageTitle">${escapeHtml(stageGroup.stage)}</div>
        <div class="slotList">${slotsHtml}</div>
      </div>
    `;
  }).join("");

  return `
    <div class="dayGroup">
      <div class="dayHeader">
        <div class="dayTitle">${escapeHtml(dateLabel)}</div>
        <a class="dayLink" href="${dayUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("lineup"))}</a>
      </div>
      ${stagesHtml}
    </div>
  `;
}

function renderSlot(slot, weekend) {
  const artistId = slot.artistId || "";
  const name = slot.artist || "Unknown Artist";
  const stage = normalizeStage(slot.stage);
  const start = formatTime(slot.start);
  const end = formatTime(slot.end);
  const timeRange = start && end ? `${start}\u2013${end}` : (start || end || "\u2013");

  const r = ratings[artistId] || "unrated";
  const badge = badgeFor(r);
  const active = (val) => (r === val ? "isActive" : "");

  const slotId = slot.slotId ? `slot-${weekend}-${slot.slotId}` : `slot-${weekend}-${hashMini(name + stage + timeRange)}`;

  return `
    <div class="act slot" id="${escapeAttr(slotId)}" data-artist-id="${escapeAttr(artistId)}">
      <div>
        <div class="actName">${escapeHtml(name)}</div>
        <div class="actMeta">${escapeHtml(timeRange)} \u00b7 ${escapeHtml(stage)}</div>
      </div>

      <div class="badges">
        <div class="badge ${badge.cls}">${badge.text}</div>

        <div class="ratingBar">
          <button class="rbtn ${active("liked")}" data-rate="liked" data-id="${escapeAttr(artistId)}">${t("liked")}</button>
          <button class="rbtn ${active("maybe")}" data-rate="maybe" data-id="${escapeAttr(artistId)}">${t("maybe")}</button>
          <button class="rbtn ${active("disliked")}" data-rate="disliked" data-id="${escapeAttr(artistId)}">${t("disliked")}</button>
          <button class="rbtn ${active("unrated")}" data-rate="unrated" data-id="${escapeAttr(artistId)}">${t("reset")}</button>
        </div>

        <div class="quicklinks">
          <button class="qbtn sp" data-ql="sp" data-name="${escapeAttr(name)}"><span class="qicon" aria-hidden="true"></span><span class="qtext">Spotify</span></button>
          <button class="qbtn am" data-ql="am" data-name="${escapeAttr(name)}"><span class="qicon" aria-hidden="true"></span><span class="qtext">Apple</span></button>
          <button class="qbtn yt" data-ql="yt" data-name="${escapeAttr(name)}"><span class="qicon" aria-hidden="true"></span><span class="qtext">YouTube</span></button>
          <button class="qbtn sc" data-ql="sc" data-name="${escapeAttr(name)}"><span class="qicon" aria-hidden="true"></span><span class="qtext">SoundCloud</span></button>
        </div>
      </div>
    </div>
  `;
}

function renderFavorites() {
  const weekend = state.activeWeekend;
  const w = state.weekends[weekend];
  const likedIds = Object.keys(ratings).filter(id => ratings[id] === "liked");

  const items = likedIds.map((id) => {
    const slots = w.artistSlots.get(id) || [];
    if (!slots.length) return null;
    const slot = slots[0];
    const name = getArtistName(id, slot);
    const stage = normalizeStage(slot.stage);
    const start = formatTime(slot.start);
    const end = formatTime(slot.end);
    const timeRange = start && end ? `${start}\u2013${end}` : (start || end || "\u2013");
    const meta = `${slot.date || "\u2013"} \u00b7 ${stage} \u00b7 ${timeRange}`;

    return `
      <div class="favItem">
        <div class="actName">${escapeHtml(name)}</div>
        <div class="actMeta">${escapeHtml(meta)}</div>
        <div class="quicklinks" style="margin-top:8px">
          <button class="qbtn sp" data-ql="sp" data-name="${escapeAttr(name)}"><span class="qicon" aria-hidden="true"></span><span class="qtext">Spotify</span></button>
          <button class="qbtn am" data-ql="am" data-name="${escapeAttr(name)}"><span class="qicon" aria-hidden="true"></span><span class="qtext">Apple</span></button>
          <button class="qbtn yt" data-ql="yt" data-name="${escapeAttr(name)}"><span class="qicon" aria-hidden="true"></span><span class="qtext">YouTube</span></button>
          <button class="qbtn sc" data-ql="sc" data-name="${escapeAttr(name)}"><span class="qicon" aria-hidden="true"></span><span class="qtext">SoundCloud</span></button>
        </div>
      </div>
    `;
  }).filter(Boolean);

  favoritesList.innerHTML = items.length
    ? items.join("")
    : `<div class="muted">${escapeHtml(t("no_favorites") || "Noch keine Favoriten.")}</div>`;

  bindQuicklinks(favoritesList);
}

function renderChangesBox() {
  if (!state.changes || !changesBox) {
    changesBox.hidden = true;
    return;
  }

  const summary = state.changes.summary || {};
  const added = summary.added ?? 0;
  const removed = summary.removed ?? 0;
  const replaced = summary.replaced ?? 0;

  changesSummary.innerHTML = `${t("changes_added") || "Added"} <strong>${added}</strong> \u00b7 ${t("changes_removed") || "Removed"} <strong>${removed}</strong> \u00b7 ${t("changes_replaced") || "Replaced"} <strong>${replaced}</strong>`;

  const details = state.changes.details || state.changes.items || state.changes.changes || null;
  if (details) {
    changesDetailsBody.textContent = JSON.stringify(details, null, 2);
    changesDetails.hidden = false;
  } else {
    changesDetails.hidden = true;
  }

  changesBox.hidden = false;
}

function renderStatusPills() {
  const w = state.weekends[state.activeWeekend];
  if (w.snapshot?.meta?.createdAt) {
    lastCheckedPill.textContent = `${t("last_checked")}: \u2013`;
  } else {
    lastCheckedPill.textContent = `${t("last_checked")}: \u2013`;
  }

  const slotCount = w.snapshot?.slots?.length ?? 0;
  lastUpdatedPill.textContent = `${t("lineup_status")}: ${slotCount} ${t("slots") || "Slots"}`;
}

function updateFiltersUI(weekend) {
  const w = state.weekends[weekend];
  if (!w?.snapshot?.slots) return;
  if (!dayFilter || !stageFilter) return;
  if (!w.filters) w.filters = { day: "all", stage: "all" };

  const slots = w.snapshot.slots;
  const dates = Array.from(new Set(slots.map(s => s.date || extractDate(s.start) || "Unknown"))).sort();

  const currentDay = w.filters.day || dayFilter.value || "all";
  const dayVal = dates.includes(currentDay) ? currentDay : "all";
  const dayOptions = [
    { value: "all", label: t("all_days") || "All days" },
    ...dates.map(d => ({ value: d, label: formatDate(d) }))
  ];
  setSelectOptions(dayFilter, dayOptions, dayVal);
  w.filters.day = dayVal;

  const stageSet = new Set();
  slots.forEach(s => {
    const date = s.date || extractDate(s.start) || "Unknown";
    if (dayVal !== "all" && date !== dayVal) return;
    stageSet.add(normalizeStage(s.stage));
  });
  const stages = Array.from(stageSet).sort((a, b) => a.localeCompare(b));
  const currentStage = w.filters.stage || stageFilter.value || "all";
  const stageVal = stages.includes(currentStage) ? currentStage : "all";
  const stageOptions = [
    { value: "all", label: t("all_stages") || "All stages" },
    ...stages.map(s => ({ value: s, label: s }))
  ];
  setSelectOptions(stageFilter, stageOptions, stageVal);
  w.filters.stage = stageVal;
}

function setSelectOptions(selectEl, options, selectedValue) {
  if (!selectEl) return;
  selectEl.innerHTML = options.map(o => `
      <option value="${escapeAttr(o.value)}">${escapeHtml(o.label)}</option>
    `).join("");
  selectEl.value = selectedValue;
  rebuildCustomSelect(selectEl);
}
// ====== INTERACTIONS ======
function bindSlotInteractions(container, weekend) {
  Array.from(container.querySelectorAll(".rbtn")).forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const rate = btn.getAttribute("data-rate");
      await setRating(id, rate);
      if (state.activeWeekend === weekend) renderActiveWeekend();
    });
  });

  bindQuicklinks(container);
}

function bindQuicklinks(container) {
  Array.from(container.querySelectorAll(".qbtn")).forEach(btn => {
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

function indexArtistElements(container, weekend) {
  const map = new Map();
  Array.from(container.querySelectorAll(".slot")).forEach(el => {
    const id = el.getAttribute("data-artist-id") || "";
    if (id && !map.has(id)) map.set(id, el);
  });
  state.weekends[weekend].artistFirstEl = map;
}

function updateSearchResults() {
  const q = (searchInput.value || "").trim().toLowerCase();
  if (!q) {
    searchResults.hidden = true;
    searchResults.innerHTML = "";
    return;
  }

  const w = state.weekends[state.activeWeekend];
  const results = [];
  for (const [artistId, slots] of w.artistSlots.entries()) {
    const slot = slots[0];
    const name = getArtistName(artistId, slot);
    if (name.toLowerCase().includes(q)) {
      results.push({ artistId, name, slots });
    }
  }

  results.sort((a, b) => a.name.localeCompare(b.name));
  const top = results.slice(0, 20);

  searchResults.innerHTML = top.map(r => {
    const first = r.slots[0];
    const meta = `${first.date || "\u2013"} \u00b7 ${normalizeStage(first.stage)}`;
    return `
      <div class="searchItem" data-artist-id="${escapeAttr(r.artistId)}">
        <div>${escapeHtml(r.name)}</div>
        <div class="searchMeta">${escapeHtml(meta)}</div>
      </div>
    `;
  }).join("") || `<div class="muted" style="padding:8px 10px">Keine Treffer.</div>`;

  Array.from(searchResults.querySelectorAll(".searchItem")).forEach(item => {
    item.addEventListener("click", () => {
      const id = item.getAttribute("data-artist-id");
      if (id) scrollToArtist(id);
    });
  });

  searchResults.hidden = false;
}

function scrollToArtist(artistId) {
  const w = state.weekends[state.activeWeekend];
  const el = w.artistFirstEl.get(artistId);
  if (!el) {
    showError("Artist im aktuellen Weekend nicht gefunden.");
    return;
  }

  clearError();
  el.classList.remove("isTarget");
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => el.classList.add("isTarget"), 50);
  setTimeout(() => el.classList.remove("isTarget"), 2500);
}

function setActiveWeekend(weekend, updateRoute = true) {
  const normalized = normalizeWeekend(weekend) || "W1";
  state.activeWeekend = normalized;

  weekendTabs.forEach(btn => {
    const isActive = btn.getAttribute("data-weekend") === normalized;
    btn.classList.toggle("isActive", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  weekendPanels.forEach(panel => {
    panel.classList.toggle("isActive", panel.getAttribute("data-weekend") === normalized);
  });

  if (updateRoute) {
    route.weekend = normalized.toLowerCase();
    setCanonicalRoute(route);
  }

  renderActiveWeekend();
}

// ====== GROUPING ======
function groupSlots(slots, ratingFilterValue, filters) {
  const byDate = new Map();

  slots.forEach(slot => {
    const artistId = slot.artistId || "";
    const rating = ratings[artistId] || "unrated";
    if (ratingFilterValue !== "all" && rating !== ratingFilterValue) return;

    const date = slot.date || extractDate(slot.start) || "Unknown";
    const stage = normalizeStage(slot.stage);

    if (filters?.day && filters.day !== "all" && date !== filters.day) return;
    if (filters?.stage && filters.stage !== "all" && stage !== filters.stage) return;

    if (!byDate.has(date)) byDate.set(date, new Map());
    const stageMap = byDate.get(date);
    if (!stageMap.has(stage)) stageMap.set(stage, []);
    stageMap.get(stage).push(slot);
  });

  const datesSorted = Array.from(byDate.keys()).sort();
  return datesSorted.map(date => {
    const stageMap = byDate.get(date);
    const stages = Array.from(stageMap.keys()).sort((a, b) => a.localeCompare(b)).map(stage => {
      const slotsSorted = stageMap.get(stage).slice().sort((a, b) => {
        const ta = toMinutes(a.start);
        const tb = toMinutes(b.start);
        if (ta !== tb) return ta - tb;
        return String(a.artist || "").localeCompare(String(b.artist || ""));
      });
      return { stage, slots: slotsSorted };
    });
    return { date, stages };
  });
}

function buildArtistSlotMap(slots) {
  const map = new Map();
  slots.forEach(slot => {
    const id = slot.artistId || "";
    if (!id) return;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(slot);
  });
  return map;
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

function canonicalPath(r) {
  const base = `/${r.festival}/${r.year}/${r.weekend}`;
  return CANONICAL_TRAILING_SLASH ? `${base}/` : base;
}

function setCanonicalRoute(r) {
  if (!r?.festival || !r?.year || !r?.weekend) return;
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

function t(key) {
  return dict[key] || key;
}

// ====== UTIL ======
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

function normalizeWeekend(value) {
  const v = String(value || "").toUpperCase();
  if (v === "W1" || v === "W2") return v;
  if (v === "1" || v === "WEEKEND1") return "W1";
  if (v === "2" || v === "WEEKEND2") return "W2";
  return "";
}

function snapshotSelectForWeekend(weekend) {
  return weekend === "W1" ? snapshotSelectW1 : snapshotSelectW2;
}

function setSnapshotOptions(weekend) {
  const select = snapshotSelectForWeekend(weekend);
  const opts = state.weekends[weekend].options || [];

  select.innerHTML = opts.length
    ? opts.map(o => {
        const label = `${formatDateTime(o.createdAt)} \u00b7 ${o.slotCount} Slots`;
        return `<option value="${escapeAttr(o.file)}">${escapeHtml(label)}</option>`;
      }).join("")
    : `<option value="">Keine Snapshots</option>`;

  rebuildCustomSelect(select);
}

function formatDateTime(iso) {
  if (!iso) return "\u2013";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function formatDate(dateStr) {
  if (!dateStr) return "\u2013";
  try { return new Date(dateStr).toLocaleDateString(); } catch { return dateStr; }
}

function extractDate(value) {
  const m = String(value || "").match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

function formatTime(value) {
  const m = String(value || "").match(/(\d{2}):(\d{2})/);
  if (!m) return "";
  return `${m[1]}:${m[2]}`;
}

function toMinutes(value) {
  const t = formatTime(value);
  if (!t) return 9999;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function normalizeStage(stage) {
  if (typeof stage === "string") {
    const s = stage.trim();
    if (!s || s === "[object Object]") return "Unknown Stage";
    return s;
  }
  if (stage && typeof stage === "object") {
    return String(stage.name || stage.title || stage.label || stage.stageName || stage.stage_name || "Unknown Stage").trim();
  }
  return "Unknown Stage";
}

function getArtistName(artistId, slot) {
  return state.artists.byId.get(artistId)?.name || slot.artist || "Unknown Artist";
}

function showError(msg) {
  if (!errorBox) return;
  errorBox.textContent = msg;
  errorBox.hidden = false;
}

function clearError() {
  if (!errorBox) return;
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function hashMini(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i) | 0;
  return Math.abs(h).toString(36);
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function escapeAttr(s){ return escapeHtml(s).replace(/`/g, "&#096;"); }

async function fetchJson(url, { cache = "default" } = {}) {
  const res = await fetch(url, { cache });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return await res.json();
}

async function tryFetchJson(url, { cache = "default" } = {}) {
  try {
    const res = await fetch(url, { cache });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ====== MUSIC LINKS ======
function makeSpotifySearchUrl(name){ return `https://open.spotify.com/search/${encodeURIComponent(name)}`; }
function makeAppleMusicSearchUrl(name){ return `https://music.apple.com/search?term=${encodeURIComponent(name)}`; }
function makeYouTubeSearchUrl(name){ return `https://www.youtube.com/results?search_query=${encodeURIComponent(name + " dj set")}`; }
function makeSoundCloudSearchUrl(name){ return `https://soundcloud.com/search?q=${encodeURIComponent(name)}`; }
function openLink(url){ window.open(url, "_blank", "noopener"); }

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
    selectEl.dispatchEvent(new Event("input", { bubbles: true }));
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

function rebuildCustomSelect(selectEl) {
  const wrapper = selectEl?.parentNode?.querySelector(".selectWrap");
  if (wrapper) wrapper.remove();
  selectEl.dataset.customReady = "";
  initCustomSelect(selectEl);
}

// ====== RATINGS ======
function badgeFor(r) {
  if (r === "liked") return { cls: "ok", text: t("liked") };
  if (r === "maybe") return { cls: "warn", text: t("maybe") };
  if (r === "disliked") return { cls: "bad", text: t("disliked") };
  return { cls: "", text: t("unrated") };
}

async function setRating(artistId, rate) {
  if (!artistId) return;
  if (rate === "unrated") {
    delete ratings[artistId];
    await dbDelete(makeDbKey(state, artistId));
  } else {
    ratings[artistId] = rate;
    await dbPut(makeDbKey(state, artistId), rate);
  }
}

// ====== INDEXEDDB (minimal) ======
const DB_NAME = "festival_planner";
const DB_STORE = "ratings";
const DB_VERSION = 1;

function makeDbKeyPrefix(r){ return `${r.festival}::${r.year}::`; }
function makeDbKey(r, artistId){ return `${makeDbKeyPrefix(r)}${artistId}`; }

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

























