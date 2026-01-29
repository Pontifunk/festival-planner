// ====== CONFIG ======
const DEFAULT_FESTIVAL = "tomorrowland";
const DEFAULT_YEAR = "2026";
const DEFAULT_WEEKEND = "W1";

const DONATION_URL = "https://www.buymeacoffee.com/Pontifunk"; 
const FEEDBACK_URL = "https://github.com/Pontifunk/festival-planner/issues/new/choose";

const CANONICAL_TRAILING_SLASH = true;
const WEEKENDS = ["W1", "W2"];
const RATING_STATES = ["liked", "maybe", "disliked", "unrated"];
const RATING_CYCLE = ["unrated", "liked", "maybe", "disliked"];
const VALID_RATINGS = new Set(RATING_STATES);

const RATING_ACTION_LABELS = {
  liked: { actionKey: "rating_action_liked", fallbackKey: "liked", fallback: "Liked" },
  maybe: { actionKey: "rating_action_maybe", fallbackKey: "maybe", fallback: "Maybe" },
  disliked: { actionKey: "rating_action_disliked", fallbackKey: "disliked", fallback: "Disliked" },
  unrated: { actionKey: "rating_action_unrated", fallbackKey: "reset", fallback: "Unrated" }
};

const RATING_CHIP_FALLBACKS = {
  liked: "❤️",
  maybe: "🤔",
  disliked: "👎",
  unrated: "○"
};
const BASE_PREFIX = getBasePrefix();
const withBase = (path) => `${BASE_PREFIX}${path}`;

const STAGE_ORDER = [
  "MAINSTAGE",
  "FREEDOM BY BUD",
  "THE ROSE GARDEN",
  "ELIXIR",
  "CAGE",
  "THE RAVE CAVE",
  "PLANAXIS",
  "MELODIA BY CORONA",
  "RISE",
  "ATMOSPHERE",
  "CORE",
  "CRYSTAL GARDEN",
  "THE LIBRARY",
  "MOOSE BAR",
  "HOUSE OF FORTUNE BY JBL"
];

const STAGE_GENRES = {
  "MAINSTAGE": "Big Room / EDM",
  "FREEDOM BY BUD": "Techno / Melodic Techno",
  "THE ROSE GARDEN": "House / Disco",
  "ELIXIR": "Trance / Progressive",
  "CAGE": "Hard Techno",
  "THE RAVE CAVE": "Hardcore / Rave",
  "PLANAXIS": "Techno",
  "MELODIA BY CORONA": "Melodic House & Techno",
  "RISE": "Bass / Future",
  "ATMOSPHERE": "Techno",
  "CORE": "Underground / Techno",
  "CRYSTAL GARDEN": "House / Tech House",
  "THE LIBRARY": "Eclectic / Classics",
  "MOOSE BAR": "Party / Hits",
  "HOUSE OF FORTUNE BY JBL": "House"
};

// ====== DOM ======
const langSelect = document.getElementById("langSelect");
const lastCheckedPill = document.getElementById("lastCheckedPill");
const lastUpdatedPill = document.getElementById("lastUpdatedPill");

const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const ratingFilter = document.getElementById("ratingFilter");
const dayFilter = document.getElementById("dayFilter");
const stageFilter = document.getElementById("stageFilter");
const tagFilter = document.getElementById("tagFilter");
const activeFiltersRow = document.getElementById("activeFilters");

const weekendChangesBox = document.getElementById("changesBox");
const weekendChangesSummary = document.getElementById("weekendChangesSummary");
const weekendChangesHistory = document.getElementById("weekendChangesHistory");
const weekendChangesTitle = weekendChangesBox?.querySelector(".cardTitle");
const exportRatingsBtn = document.getElementById("exportRatingsBtn");
const importRatingsInput = document.getElementById("importRatingsInput");
const importStatus = document.getElementById("importStatus");

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
const favoritesToggle = document.getElementById("favoritesToggle");
const favoritesPlanNote = document.getElementById("favoritesPlanNote");
const actionToast = document.getElementById("actionToast");
const menuBtn = document.getElementById("menuBtn");
const menuOverlay = document.getElementById("menuOverlay");
const menuSheet = document.getElementById("menuSheet");
const menuCloseBtn = document.getElementById("menuCloseBtn");
const menuDayLinks = document.getElementById("menuDayLinks");
const donateBtn = document.getElementById("donateBtn");
const feedbackBtn = document.getElementById("feedbackBtn");
const plannerExportBox = document.getElementById("plannerExportBox");
const mobileExportAnchor = document.getElementById("mobileExportAnchor");

// ====== STATE ======
let lang = localStorage.getItem("fp_lang") || "de";
let route = parseRoute(location.pathname);
let selectUid = 0;
const customSelectMap = new WeakMap();
let ratings = {};
let favoritesOnly = false;
let lastFilterValue = "all";
let toastTimer = null;
let menuOpen = false;
let menuScrollY = 0;

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
  changesIndex: null,
  weekendChanges: { W1: null, W2: null },
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
  ensureSelectVisible(ratingFilter);

  await applyTranslations(lang);

  if (!route.festival) route.festival = DEFAULT_FESTIVAL;
  if (!route.year) route.year = DEFAULT_YEAR;
  route.festival = cleanSegment(route.festival, /^[a-z0-9-]+$/i, DEFAULT_FESTIVAL);
  route.year = cleanSegment(route.year, /^\d{4}$/, DEFAULT_YEAR);

  const routeWeekend = normalizeWeekend(route.weekend);
  if (routeWeekend) {
    state.activeWeekend = routeWeekend;
  } else {
    route.weekend = DEFAULT_WEEKEND.toLowerCase();
  }

  normalizeUrlIfNeeded();
  ensureCanonicalUrl();

  bindUi();
  setupMobileExportPlacement();

  try {
    await Promise.all([
      loadSnapshotIndex(),
      loadArtistsLatest(),
      loadChangesIndex(),
      loadWeekendChanges()
    ]);
  } catch (e) {
    showError("Fehler beim Laden der Grunddaten.");
  }

  ratings = await dbGetAll(makeDbKeyPrefix(state));

  await Promise.all(WEEKENDS.map((w) => loadSnapshotForWeekend(w)));

  renderWeekendChangesBox();
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

  searchInput.addEventListener("input", () => {
    updateSearchResults();
    renderActiveFilters();
  });
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const first = searchResults.querySelector(".searchItem");
      if (first) {
        const id = first.getAttribute("data-artist-id");
        if (id) scrollToArtist(id);
      }
    }
  });

  ratingFilter.addEventListener("input", () => {
    if (favoritesOnly && ratingFilter.value !== "liked") {
      favoritesOnly = false;
      updateFavoritesToggleUI();
    }
    renderActiveWeekend();
  });
  ratingFilter.addEventListener("change", () => {
    if (favoritesOnly && ratingFilter.value !== "liked") {
      favoritesOnly = false;
      updateFavoritesToggleUI();
    }
    renderActiveWeekend();
  });

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

  if (exportRatingsBtn) {
    exportRatingsBtn.addEventListener("click", () => exportRatings());
  }
  if (importRatingsInput) {
    importRatingsInput.addEventListener("change", (e) => importRatings(e));
  }
  if (favoritesToggle) {
    favoritesToggle.addEventListener("click", () => setFavoritesOnly(!favoritesOnly));
  }
  if (menuBtn && menuSheet && menuOverlay) {
    menuBtn.addEventListener("click", () => toggleMenu());
    menuOverlay.addEventListener("click", () => closeMenu());
    if (menuCloseBtn) menuCloseBtn.addEventListener("click", () => closeMenu());
    menuSheet.addEventListener("click", (e) => {
      const item = e.target.closest(".menuItem");
      if (!item) return;
      handleMenuItem(item);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menuOpen) closeMenu();
    });
  }

  if (activeFiltersRow) {
    activeFiltersRow.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-filter]");
      if (!btn) return;
      const type = btn.getAttribute("data-filter");
      clearFilter(type);
    });
  }
}

function setupMobileExportPlacement() {
  if (!plannerExportBox || !mobileExportAnchor) return;
  const originalParent = plannerExportBox.parentNode;
  const originalNext = plannerExportBox.nextSibling;
  const mq = window.matchMedia("(max-width: 980px)");

  const applyPlacement = () => {
    if (mq.matches) {
      const anchorParent = mobileExportAnchor.parentNode;
      if (plannerExportBox.parentNode !== anchorParent) {
        const next = mobileExportAnchor.nextSibling;
        if (next) {
          anchorParent.insertBefore(plannerExportBox, next);
        } else {
          anchorParent.appendChild(plannerExportBox);
        }
      }
      return;
    }
    if (plannerExportBox.parentNode !== originalParent) {
      if (originalNext && originalNext.parentNode === originalParent) {
        originalParent.insertBefore(plannerExportBox, originalNext);
      } else {
        originalParent.appendChild(plannerExportBox);
      }
    }
  };

  applyPlacement();
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", applyPlacement);
  } else if (typeof mq.addListener === "function") {
    mq.addListener(applyPlacement);
  }
}
// ====== LOADING ======
async function loadSnapshotIndex() {
  const url = withBase(`/data/${state.festival}/${state.year}/snapshots/index.json`);
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
  const latestUrl = withBase(`/data/${state.festival}/${state.year}/snapshots/latest.json`);
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
  const url = withBase(`/data/${state.festival}/${state.year}/snapshots/${file}`);
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
      if (!Array.from(sel.options).some(o => o.value === selectedFile)) {
        const label = snap?.meta?.createdAt
          ? `${formatDateTime(snap.meta.createdAt)} \u00b7 ${snap?.slots?.length ?? 0} Slots`
          : selectedFile;
        const opt = document.createElement("option");
        opt.value = selectedFile;
        opt.textContent = label;
        sel.insertBefore(opt, sel.firstChild);
      }
      sel.value = selectedFile;
      rebuildCustomSelect(sel);
    }
  } catch (e) {
    w.error = "Snapshot konnte nicht geladen werden.";
    w.snapshot = null;
  }
}

async function loadArtistsLatest() {
  const base = withBase(`/data/${state.festival}/${state.year}/artists`);
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

async function loadChangesIndex() {
  const url = withBase(`/data/${state.festival}/${state.year}/changes/index.json`);
  state.changesIndex = await tryFetchJson(url, { cache: "no-store" });
}

async function loadWeekendChanges() {
  const base = withBase(`/data/${state.festival}/${state.year}/changes`);
  const [w1, w2] = await Promise.all([
    tryFetchJson(`${base}/latest_W1.json`, { cache: "no-store" }),
    tryFetchJson(`${base}/latest_W2.json`, { cache: "no-store" })
  ]);
  state.weekendChanges = { W1: w1, W2: w2 };
}

// ====== RENDER ======
function renderActiveWeekend() {
  if (favoritesOnly && ratingFilter?.value && ratingFilter.value !== "liked") {
    favoritesOnly = false;
    updateFavoritesToggleUI();
  }
  updateFiltersUI(state.activeWeekend);
  renderWeekend(state.activeWeekend);
  renderFavorites();
  updateSearchResults();
  renderActiveFilters();
  renderStatusPills();
  renderWeekendChangesBox();
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
  const ratingValue = favoritesOnly ? "liked" : ratingFilter.value;
  const prevOpen = container ? getOpenState(container) : null;
  const grouped = groupSlots(w.snapshot.slots, ratingValue, activeFilters);
  const openState = resolveOpenState(grouped, prevOpen, activeFilters);
  w.grouped = grouped;
  w.artistSlots = buildArtistSlotMap(w.snapshot.slots);
  const dayList = Array.from(new Set(w.snapshot.slots.map(s => s.date || extractDate(s.start) || "Unknown"))).sort();
  updateMenuDayLinks(dayList);

  const shownCount = countGroupedSlots(grouped);
  metaEl.textContent =
    `${t("snapshot_label")}: ${w.selectedFile || notAvailable()} \u00b7 ` +
    `${t("slots") || "Slots"}: ${w.snapshot.slots.length} \u00b7 ` +
    `${t("shown") || "Angezeigt"}: ${shownCount}`;

  container.innerHTML = grouped.map(group => renderDayGroup(group, weekend, openState)).join("");

  bindSlotInteractions(container, weekend);
  indexArtistElements(container, weekend);
}

function renderDayGroup(group, weekend, openState) {
  const dateLabel = formatDate(group.date);
  const dayUrl = `https://belgium.tomorrowland.com/nl/line-up/?day=${group.date}`;
  const dayCount = group.stages.reduce((sum, stage) => sum + stage.slots.length, 0);
  const dayOpen = openState?.openDays?.has(group.date);

  const stagesHtml = group.stages.map(stageGroup => {
    const stageCount = stageGroup.slots.length;
    const stageKey = stageGroup.stage;
    const stageOpen = openState?.openStages?.get(group.date)?.has(stageKey);
    const genre = getStageGenre(stageGroup.stage);
    const slotsHtml = stageGroup.slots.map(slot => renderSlot(slot, weekend)).join("");
    return `
      <details class="stageGroup" data-day="${escapeAttr(group.date)}" data-stage="${escapeAttr(stageKey)}" ${stageOpen ? "open" : ""}>
        <summary class="stageSummary">
          <div class="stageSummaryMain">
            <span class="stageTitle">${escapeHtml(stageGroup.stage)}</span>
            ${genre ? `<span class="stageGenre">${escapeHtml(genre)}</span>` : ""}
          </div>
          <div class="daySummaryMeta">
            <span class="stageCount">(${stageCount})</span>
            <span class="stageChevron" aria-hidden="true"></span>
          </div>
        </summary>
        <div class="stageBody">
          <div class="slotList">${slotsHtml}</div>
        </div>
      </details>
    `;
  }).join("");

  return `
    <details class="dayGroup" id="day-${escapeAttr(group.date)}" data-day="${escapeAttr(group.date)}" ${dayOpen ? "open" : ""}>
      <summary class="daySummary">
        <div class="daySummaryMain">
          <span class="dayTitle">${escapeHtml(dateLabel)}</span>
          <span class="dayCount">(${dayCount})</span>
        </div>
        <div class="daySummaryMeta">
          <a class="dayLink" href="${dayUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("lineup"))}</a>
          <span class="dayChevron" aria-hidden="true"></span>
        </div>
      </summary>
      <div class="dayBody">
        ${stagesHtml}
      </div>
    </details>
  `;
}

function renderSlot(slot, weekend) {
  const artistId = slot.artistId || "";
  const name = slot.artist || "Unknown Artist";
  const stage = normalizeStage(slot.stage);
  const start = formatTime(slot.start);
  const end = formatTime(slot.end);
  const timeRange = start && end ? `${start}\u2013${end}` : (start || end || notAvailable());

  const r = ratings[artistId] || "unrated";
  const ratingLabels = getRatingActionLabels();

  const slotId = slot.slotId ? `slot-${weekend}-${slot.slotId}` : `slot-${weekend}-${hashMini(name + stage + timeRange)}`;

  return `
    <div class="act slot" id="${escapeAttr(slotId)}" data-artist-id="${escapeAttr(artistId)}">
      <div>
        <div class="actName">${escapeHtml(name)}</div>
        <div class="actMeta">${escapeHtml(timeRange)} \u00b7 ${escapeHtml(stage)}</div>
      </div>

      <div class="badges">
        <div class="ratingSelect" data-id="${escapeAttr(artistId)}" role="radiogroup" aria-label="${escapeAttr(t("rating_label") || "Rating")}">
          <button class="ratingChip ${r === "liked" ? "isActive" : ""}" data-rate="liked" type="button" role="radio" aria-checked="${r === "liked" ? "true" : "false"}" title="${escapeAttr(ratingLabels.liked)}" aria-label="${escapeAttr(ratingLabels.liked)}">
            <span class="ratingEmoji" aria-hidden="true">${escapeHtml(getRatingChipIcon("liked"))}</span>
            <span class="ratingLabel">${escapeHtml(t("liked"))}</span>
          </button>
          <button class="ratingChip ${r === "maybe" ? "isActive" : ""}" data-rate="maybe" type="button" role="radio" aria-checked="${r === "maybe" ? "true" : "false"}" title="${escapeAttr(ratingLabels.maybe)}" aria-label="${escapeAttr(ratingLabels.maybe)}">
            <span class="ratingEmoji" aria-hidden="true">${escapeHtml(getRatingChipIcon("maybe"))}</span>
            <span class="ratingLabel">${escapeHtml(t("maybe"))}</span>
          </button>
          <button class="ratingChip ${r === "disliked" ? "isActive" : ""}" data-rate="disliked" type="button" role="radio" aria-checked="${r === "disliked" ? "true" : "false"}" title="${escapeAttr(ratingLabels.disliked)}" aria-label="${escapeAttr(ratingLabels.disliked)}">
            <span class="ratingEmoji" aria-hidden="true">${escapeHtml(getRatingChipIcon("disliked"))}</span>
            <span class="ratingLabel">${escapeHtml(t("disliked"))}</span>
          </button>
          <button class="ratingChip ${r === "unrated" ? "isActive" : ""}" data-rate="unrated" type="button" role="radio" aria-checked="${r === "unrated" ? "true" : "false"}" title="${escapeAttr(ratingLabels.unrated)}" aria-label="${escapeAttr(ratingLabels.unrated)}">
            <span class="ratingEmoji" aria-hidden="true">${escapeHtml(getRatingChipIcon("unrated"))}</span>
            <span class="ratingLabel">${escapeHtml(t("unrated"))}</span>
          </button>
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
  const visibleLikedIds = likedIds.filter(id => w.artistSlots.has(id));
  updateFavoritesSummary(visibleLikedIds.length);

  const items = visibleLikedIds.map((id) => {
    const slots = w.artistSlots.get(id) || [];
    if (!slots.length) return null;
    const slot = slots[0];
    const name = getArtistName(id, slot);
    const stage = normalizeStage(slot.stage);
    const start = formatTime(slot.start);
    const end = formatTime(slot.end);
    const timeRange = start && end ? `${start}\u2013${end}` : (start || end || notAvailable());
    const meta = `${slot.date || notAvailable()} \u00b7 ${stage} \u00b7 ${timeRange}`;

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

function updateFavoritesSummary(count) {
  if (!favoritesToggle) return;
  const label = t("favorites_count") || "Deine Favoriten: {count} DJs";
  favoritesToggle.textContent = label.replace("{count}", String(count));
  const toggleLabel = t("favorites_toggle") || "Nur Favoriten anzeigen";
  favoritesToggle.setAttribute("aria-label", toggleLabel);
  updateFavoritesToggleUI();
}

function updateFavoritesToggleUI() {
  if (!favoritesToggle) return;
  favoritesToggle.classList.toggle("isActive", favoritesOnly);
  favoritesToggle.setAttribute("aria-pressed", favoritesOnly ? "true" : "false");
}

function setFavoritesOnly(next) {
  favoritesOnly = !!next;
  if (favoritesOnly) {
    lastFilterValue = ratingFilter.value || "all";
    ratingFilter.value = "liked";
    syncCustomSelect(ratingFilter);
  } else {
    ratingFilter.value = lastFilterValue || "all";
    syncCustomSelect(ratingFilter);
  }
  updateFavoritesToggleUI();
  renderActiveWeekend();
}

function showToast(message) {
  if (!actionToast) return;
  actionToast.textContent = message;
  actionToast.classList.add("isVisible");
  actionToast.setAttribute("aria-hidden", "false");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    actionToast.classList.remove("isVisible");
  }, 1300);
}

function openMenu() {
  if (!menuSheet || !menuOverlay || !menuBtn) return;
  menuOpen = true;
  menuScrollY = window.scrollY || 0;
  menuSheet.classList.add("isOpen");
  menuOverlay.hidden = false;
  menuBtn.setAttribute("aria-expanded", "true");
  menuSheet.setAttribute("aria-hidden", "false");
  document.body.classList.add("menuOpen");
  document.body.style.top = `-${menuScrollY}px`;
}

function closeMenu() {
  if (!menuSheet || !menuOverlay || !menuBtn) return;
  menuOpen = false;
  menuSheet.classList.remove("isOpen");
  menuOverlay.hidden = true;
  menuBtn.setAttribute("aria-expanded", "false");
  menuSheet.setAttribute("aria-hidden", "true");
  document.body.classList.remove("menuOpen");
  document.body.style.top = "";
  if (menuScrollY) window.scrollTo(0, menuScrollY);
}

function toggleMenu() {
  if (menuOpen) closeMenu();
  else openMenu();
}

function handleMenuItem(item) {
  const action = item.getAttribute("data-action");
  const target = item.getAttribute("data-target");
  let postClose = null;
  if (action === "weekend") {
    const weekend = item.getAttribute("data-weekend");
    if (weekend) setActiveWeekend(weekend, true);
    const id = weekend === "W2" ? "#w2Section" : "#w1Section";
    postClose = () => scrollToTarget(id);
  } else if (action === "favoritesToggle") {
    setFavoritesOnly(!favoritesOnly);
  } else if (action === "searchFocus") {
    if (searchInput) {
      postClose = () => {
        searchInput.focus();
        scrollToTarget("#searchInput");
      };
    }
  } else if (action === "exportRatings") {
    if (exportRatingsBtn) exportRatingsBtn.click();
  } else if (action === "importRatings") {
    if (importRatingsInput) importRatingsInput.click();
  } else if (target) {
    postClose = () => scrollToTarget(target);
  }
  closeMenu();
  if (postClose) requestAnimationFrame(() => postClose());
}

function scrollToTarget(selector) {
  if (!selector) return;
  const el = document.querySelector(selector);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateMenuDayLinks(dates) {
  if (!menuDayLinks) return;
  if (!dates || !dates.length) {
    menuDayLinks.innerHTML = `<div class="menuEmpty">Keine Tage</div>`;
    return;
  }
  menuDayLinks.innerHTML = dates.map((d) => {
    const label = formatDate(d);
    const target = `#day-${d}`;
    return `<button class="menuItem isSub" data-target="${escapeAttr(target)}" type="button">${escapeHtml(label)}</button>`;
  }).join("");
}

function renderWeekendChangesBox() {
  if (!weekendChangesBox || !weekendChangesSummary || !weekendChangesHistory) return;
  const data = state.weekendChanges?.[state.activeWeekend] || null;

  if (weekendChangesTitle) {
    const weekendLabel = state.activeWeekend === "W2"
      ? (t("weekend_2") || "Weekend 2")
      : (t("weekend_1") || "Weekend 1");
    weekendChangesTitle.textContent = `${t("weekend_changes_title") || "\u00c4nderungen"} \u2013 ${weekendLabel}`;
  }

  const summary = data?.summary || { added: 0, removed: 0, replaced: 0 };
  const weekendLabel = state.activeWeekend === "W2"
    ? (t("weekend_2") || "Weekend 2")
    : (t("weekend_1") || "Weekend 1");
  weekendChangesSummary.innerHTML =
    `${escapeHtml(weekendLabel)} \u00b7 ` +
    `${t("changes_added") || "Added"}: <strong>${summary.added ?? 0}</strong> \u00b7 ` +
    `${t("changes_removed") || "Removed"}: <strong>${summary.removed ?? 0}</strong> \u00b7 ` +
    `${t("changes_replaced") || "Replaced"}: <strong>${summary.replaced ?? 0}</strong>`;

  renderWeekendChangesHistory();
  weekendChangesBox.hidden = false;
}

function renderWeekendChangesHistory() {
  if (!weekendChangesHistory) return;
  const idx = state.changesIndex;
  const weekend = state.activeWeekend;
  if (!idx?.entries?.length) {
    weekendChangesHistory.textContent = t("weekend_changes_empty") || "Keine Historie.";
    return;
  }

  const entries = idx.entries
    .filter(e => e.weekend === weekend)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 5);

  if (!entries.length) {
    weekendChangesHistory.textContent = t("weekend_changes_empty") || "Keine Historie.";
    return;
  }

  weekendChangesHistory.innerHTML = entries.map(e => {
    const when = formatDateTime(e.createdAt);
    const s = e.summary || {};
    const href = withBase(`/data/${state.festival}/${state.year}/changes/${e.file}`);
    return `
      <div class="changesHistoryItem">
        <a href="${escapeAttr(href)}" target="_blank" rel="noopener">${escapeHtml(when)}</a>
        <span>
          ${t("changes_added") || "Added"}: <strong>${s.added ?? 0}</strong>
          \u00b7 ${t("changes_removed") || "Removed"}: <strong>${s.removed ?? 0}</strong>
          \u00b7 ${t("changes_replaced") || "Replaced"}: <strong>${s.replaced ?? 0}</strong>
        </span>
      </div>
    `;
  }).join("");
}

function exportRatings() {
  const createdAt = new Date().toISOString();
  const artists = {};
  Object.keys(ratings).forEach((artistId) => {
    const name = state.artists.byId.get(artistId)?.name || "";
    artists[artistId] = {
      name,
      rating: ratings[artistId],
      tags: [],
      updatedAt: createdAt
    };
  });

  const payload = {
    app: "festival-planner",
    exportVersion: 2,
    createdAt,
    schema: { artistKey: "artistId", slotKey: "slotId" },
    artists,
    slots: {}
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `festival-planner-ratings-${state.festival}-${state.year}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importRatings(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    if (importStatus) {
      importStatus.textContent = t("import_failed") || "Import fehlgeschlagen.";
    }
    e.target.value = "";
    return;
  }
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    let incoming = null;

    if (data?.exportVersion === 2 && data?.artists && typeof data.artists === "object") {
      incoming = {};
      Object.keys(data.artists).forEach((artistId) => {
        const entry = data.artists[artistId];
        const rate = entry?.rating ? String(entry.rating).toLowerCase() : "";
        if (VALID_RATINGS.has(rate)) incoming[artistId] = rate;
      });
    } else if (data?.ratings && typeof data.ratings === "object") {
      incoming = data.ratings;
    }

    if (!incoming || typeof incoming !== "object") {
      throw new Error("Invalid ratings file");
    }

    const filtered = {};
    Object.keys(incoming).forEach((id) => {
      const rate = String(incoming[id] || "").toLowerCase();
      if (VALID_RATINGS.has(rate)) filtered[id] = rate;
    });

    const merged = { ...ratings };
    Object.keys(filtered).forEach((id) => {
      const rate = filtered[id];
      if (rate === "unrated") {
        delete merged[id];
      } else {
        merged[id] = rate;
      }
    });
    ratings = merged;

    const prefix = makeDbKeyPrefix(state);
    await Promise.all(Object.keys(filtered).map((id) => {
      const rate = filtered[id];
      if (rate === "unrated" || rate === null || typeof rate === "undefined") {
        return dbDelete(prefix + id);
      }
      return dbPut(prefix + id, rate);
    }));

    if (importStatus) {
      importStatus.textContent = t("import_done") || "Import abgeschlossen.";
    }
    renderActiveWeekend();
  } catch {
    if (importStatus) {
      importStatus.textContent = t("import_failed") || "Import fehlgeschlagen.";
    }
  } finally {
    e.target.value = "";
  }
}

function renderStatusPills() {
  const w = state.weekends[state.activeWeekend];
  const lastChecked = w.snapshot?.meta?.createdAt
    ? formatDateTime(w.snapshot.meta.createdAt)
    : notAvailable();
  lastCheckedPill.textContent = lastChecked;

  const slotCount = w.snapshot?.slots?.length ?? 0;
  lastUpdatedPill.textContent = `${slotCount} ${t("slots") || "Slots"}`;
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
    buildFilterOption("all", t("all_days") || "All days"),
    ...dates.map(d => buildFilterOption(d, formatDate(d)))
  ];
  setSelectOptions(dayFilter, dayOptions, dayVal);
  w.filters.day = dayVal;

  const stageSet = new Set();
  slots.forEach(s => {
    const date = s.date || extractDate(s.start) || "Unknown";
    if (dayVal !== "all" && date !== dayVal) return;
    stageSet.add(normalizeStage(s.stage));
  });
  const stages = sortStagesByOrder(Array.from(stageSet));
  const currentStage = w.filters.stage || stageFilter.value || "all";
  const stageVal = stages.includes(currentStage) ? currentStage : "all";
  const stageOptions = [
    buildFilterOption("all", t("all_stages") || "All stages"),
    ...stages.map(s => buildFilterOption(s, s))
  ];
  setSelectOptions(stageFilter, stageOptions, stageVal);
  w.filters.stage = stageVal;
}

function buildFilterOption(value, label) {
  return { value, label };
}

function setSelectOptions(selectEl, options, selectedValue) {
  if (!selectEl) return;
  selectEl.innerHTML = options.map(o => `
      <option value="${escapeAttr(o.value)}">${escapeHtml(o.label)}</option>
    `).join("");
  selectEl.value = selectedValue;
  rebuildCustomSelect(selectEl);
}

function renderActiveFilters() {
  if (!activeFiltersRow) return;
  const w = state.weekends[state.activeWeekend];
  const filters = w.filters || { day: "all", stage: "all" };
  const chips = [];

  if (searchInput?.value?.trim()) {
    chips.push({
      type: "search",
      label: `${t("search") || "Search"}: ${searchInput.value.trim()}`,
      aria: t("clear_search") || "Clear search"
    });
  }

  if (filters.day && filters.day !== "all") {
    chips.push({
      type: "day",
      label: `${t("day_label") || "Day"}: ${formatDate(filters.day)}`,
      aria: t("clear_day") || "Clear day filter"
    });
  }

  if (filters.stage && filters.stage !== "all") {
    chips.push({
      type: "stage",
      label: `${t("stage_label") || "Stage"}: ${filters.stage}`,
      aria: t("clear_stage") || "Clear stage filter"
    });
  }

  if (tagFilter && tagFilter.value && tagFilter.value !== "all") {
    chips.push({
      type: "tag",
      label: `${t("tag_label") || "Tag"}: ${getSelectLabel(tagFilter, tagFilter.value)}`,
      aria: t("clear_tag") || "Clear tag filter"
    });
  }

  const ratingValue = favoritesOnly ? "liked" : (ratingFilter?.value || "all");
  if (ratingValue !== "all") {
    chips.push({
      type: "rating",
      label: `${t("rating_label") || "Rating"}: ${ratingChipLabel(ratingValue)}`,
      aria: t("clear_rating") || "Clear rating filter"
    });
  }

  if (!chips.length) {
    activeFiltersRow.hidden = true;
    activeFiltersRow.innerHTML = "";
    return;
  }

  activeFiltersRow.hidden = false;
  activeFiltersRow.innerHTML = `
    <span class="activeFiltersLabel">${escapeHtml(t("active_filters") || "Active filters")}</span>
    ${chips.map(c => `
      <span class="filterChip">
        ${escapeHtml(c.label)}
        <button type="button" data-filter="${escapeAttr(c.type)}" aria-label="${escapeAttr(c.aria)}">✕</button>
      </span>
    `).join("")}
  `;
}

function clearFilter(type) {
  const w = state.weekends[state.activeWeekend];
  if (!w.filters) w.filters = { day: "all", stage: "all" };

  if (type === "search") {
    if (searchInput) searchInput.value = "";
    updateSearchResults();
    renderActiveFilters();
    return;
  }

  if (type === "day") {
    w.filters.day = "all";
    w.filters.stage = "all";
    if (dayFilter) {
      dayFilter.value = "all";
      syncCustomSelect(dayFilter);
    }
    if (stageFilter) {
      stageFilter.value = "all";
      syncCustomSelect(stageFilter);
    }
    renderActiveWeekend();
    return;
  }

  if (type === "stage") {
    w.filters.stage = "all";
    if (stageFilter) {
      stageFilter.value = "all";
      syncCustomSelect(stageFilter);
    }
    renderActiveWeekend();
    return;
  }

  if (type === "tag") {
    if (tagFilter) {
      tagFilter.value = "all";
      syncCustomSelect(tagFilter);
    }
    renderActiveWeekend();
    return;
  }

  if (type === "rating") {
    favoritesOnly = false;
    if (ratingFilter) {
      ratingFilter.value = "all";
      syncCustomSelect(ratingFilter);
    }
    updateFavoritesToggleUI();
    renderActiveWeekend();
  }
}

function getSelectLabel(selectEl, value) {
  if (!selectEl) return value;
  const opt = Array.from(selectEl.options).find(o => o.value === value);
  return opt ? opt.textContent : value;
}

function ratingChipLabel(value) {
  if (value === "liked") return t("rating_chip_liked") || "❤️";
  if (value === "maybe") return t("rating_chip_maybe") || "🤔";
  if (value === "disliked") return t("rating_chip_disliked") || "👎";
  if (value === "unrated") return t("rating_chip_unrated") || (t("unrated") || "Unrated");
  return value;
}

function getRatingActionLabels() {
  const labels = {};
  RATING_STATES.forEach((key) => {
    const meta = RATING_ACTION_LABELS[key];
    labels[key] = t(meta.actionKey) || t(meta.fallbackKey) || meta.fallback;
  });
  return labels;
}

function getRatingChipIcon(key) {
  const lookupKey = `rating_chip_${key}`;
  return t(lookupKey) || RATING_CHIP_FALLBACKS[key] || "";
}
// ====== INTERACTIONS ======
function bindSlotInteractions(container, weekend) {
  bindRatingMenus(container, weekend);
  bindQuicklinks(container);
}

function bindRatingMenus(container, weekend) {
  if (!container) return;
  if (container.dataset.ratingMenusBound === "true") return;
  container.dataset.ratingMenusBound = "true";
  const ratingCycle = RATING_CYCLE;

  container.addEventListener("click", async (e) => {
    const chip = e.target.closest(".ratingChip");
    if (chip && container.contains(chip)) {
      e.preventDefault();
      e.stopPropagation();
      const sel = chip.closest(".ratingSelect");
      const id = sel?.getAttribute("data-id");
      const rate = chip.getAttribute("data-rate");
      if (id && rate) {
        await setRating(id, rate);
        if (state.activeWeekend === weekend) renderActiveWeekend();
        showToast(t("saved") || "Gespeichert \u2713");
      }
      return;
    }

    const slotEl = e.target.closest(".slot");
    if (slotEl && container.contains(slotEl)) {
      if (e.target.closest(".ratingSelect, .qbtn, a, button, input, label")) return;
      const id = slotEl.getAttribute("data-artist-id") || "";
      if (!id) return;
      const current = ratings[id] || "unrated";
      const idx = ratingCycle.indexOf(current);
      const next = ratingCycle[(idx + 1) % ratingCycle.length];
      await setRating(id, next);
      if (state.activeWeekend === weekend) renderActiveWeekend();
      showToast(t("saved") || "Gespeichert \u2713");
    }
  });
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
    const meta = `${first.date || notAvailable()} \u00b7 ${normalizeStage(first.stage)}`;
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
  const stageFilterActive = filters?.stage && filters.stage !== "all";

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
    const stageKeys = Array.from(stageMap.keys());
    const orderedStages = stageFilterActive
      ? stageKeys
      : sortStagesByOrder(stageKeys);
    const stages = orderedStages.map(stage => {
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

function countGroupedSlots(grouped) {
  let count = 0;
  grouped.forEach(day => {
    day.stages.forEach(stage => {
      count += stage.slots.length;
    });
  });
  return count;
}

function sortStagesByOrder(stages) {
  const orderIndex = new Map(STAGE_ORDER.map((name, idx) => [normalizeStageName(name), idx]));
  return stages
    .map((name, idx) => ({ name, idx, key: normalizeStageName(name) }))
    .sort((a, b) => {
      const aOrder = orderIndex.has(a.key) ? orderIndex.get(a.key) : Number.MAX_SAFE_INTEGER;
      const bOrder = orderIndex.has(b.key) ? orderIndex.get(b.key) : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.idx - b.idx;
    })
    .map(item => item.name);
}

function getStageGenre(stage) {
  const key = normalizeStageName(stage);
  return STAGE_GENRES[key] || "";
}

function getOpenState(container) {
  const openDays = new Set();
  const openStages = new Map();
  if (!container) return { openDays, openStages };

  container.querySelectorAll("details.dayGroup[open]").forEach(day => {
    const dayId = day.getAttribute("data-day");
    if (dayId) openDays.add(dayId);
  });

  container.querySelectorAll("details.stageGroup[open]").forEach(stage => {
    const dayId = stage.getAttribute("data-day");
    const stageId = stage.getAttribute("data-stage");
    if (!dayId || !stageId) return;
    if (!openStages.has(dayId)) openStages.set(dayId, new Set());
    openStages.get(dayId).add(stageId);
  });

  return { openDays, openStages };
}

function resolveOpenState(grouped, prevOpen, filters) {
  const openDays = new Set();
  const openStages = new Map();
  const availableDays = grouped.map(g => g.date);

  if (prevOpen?.openDays?.size) {
    availableDays.forEach(day => {
      if (prevOpen.openDays.has(day)) openDays.add(day);
    });
  }

  if (!openDays.size && availableDays.length) {
    openDays.add(availableDays[0]);
  }

  grouped.forEach(day => {
    const prevStages = prevOpen?.openStages?.get(day.date);
    if (prevStages?.size) {
      const existing = new Set(day.stages.map(s => s.stage));
      const keep = Array.from(prevStages).filter(s => existing.has(s));
      if (keep.length) openStages.set(day.date, new Set(keep));
    }
  });

  openDays.forEach(dayId => {
    const day = grouped.find(d => d.date === dayId);
    if (!day || !day.stages.length) return;
    const current = openStages.get(dayId);
    if (!current || !current.size) {
      const defaultStage = day.stages[0].stage;
      openStages.set(dayId, new Set([defaultStage]));
    }
  });

  if (!openDays.size && grouped.length) {
    const firstDay = grouped[0];
    openDays.add(firstDay.date);
    if (firstDay.stages.length) {
      openStages.set(firstDay.date, new Set([firstDay.stages[0].stage]));
    }
  }

  return { openDays, openStages };
}

// ====== ROUTING ======
function getBasePrefix() {
  const parts = location.pathname.split("/").filter(Boolean);
  const baseParts = parts.length >= 3 ? parts.slice(0, parts.length - 3) : parts;
  return baseParts.length ? `/${baseParts.join("/")}` : "";
}

function parseRoute(pathname) {
  const overridePath = getQueryParam("path");
  const effectivePath = overridePath ? overridePath : pathname;

  const parts = (effectivePath || "/").split("/").filter(Boolean);
  const tail = parts.length >= 3 ? parts.slice(-3) : parts;
  return {
    festival: tail[0] || "",
    year: tail[1] || "",
    weekend: tail[2] || ""
  };
}

function canonicalPath(r) {
  const base = `${BASE_PREFIX}/${r.festival}/${r.year}/${r.weekend}`;
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
  const baseRoot = BASE_PREFIX ? `${BASE_PREFIX}/` : "/";
  const baseRootNoSlash = BASE_PREFIX || "/";
  const baseIndex = BASE_PREFIX ? `${BASE_PREFIX}/index.html` : "/index.html";

  if (currentPath === desired) return;

  if (currentPath === baseRoot || currentPath === baseRootNoSlash || currentPath === baseIndex) {
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
  const res = await fetch(withBase(`/i18n/${newLang}.json`), { cache: "no-store" });
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

function notAvailable() {
  return t("not_available_yet") || "Not available yet";
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
  if (!iso) return notAvailable();
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function formatDate(dateStr) {
  if (!dateStr) return notAvailable();
  try {
    const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
    const d = isoDateOnly ? new Date(`${dateStr}T00:00:00`) : new Date(dateStr);
    return d.toLocaleDateString();
  } catch {
    return dateStr;
  }
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

function normalizeStageName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
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

function ensureSelectVisible(selectEl) {
  if (!selectEl) return;
  const bound = customSelectMap.get(selectEl);
  const wrapper = bound?.wrapper || selectEl.parentNode?.querySelector(".selectWrap");
  if (wrapper && wrapper.querySelector(".selectTrigger")) return;
  selectEl.classList.remove("selectNative");
  selectEl.removeAttribute("data-custom-select");
  selectEl.style.position = "relative";
  selectEl.style.width = "100%";
  selectEl.style.height = "auto";
  selectEl.style.opacity = "1";
  selectEl.style.pointerEvents = "auto";
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

