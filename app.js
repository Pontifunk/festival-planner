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
  "THE GREAT LIBRARY",
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
  "THE GREAT LIBRARY": "Eclectic / Classics",
  "MOOSE BAR": "Party / Hits",
  "HOUSE OF FORTUNE BY JBL": "House"
};

const STAGE_ALIASES = {
  "THE LIBRARY": "THE GREAT LIBRARY",
  "GREAT LIBRARY": "THE GREAT LIBRARY",
  "THE GREAT LIBRARY": "THE GREAT LIBRARY"
};

// ====== DOM ======
const langSelect = document.getElementById("langSelect");
const lastCheckedPill = document.getElementById("lastCheckedPill");
const lastUpdatedPill = document.getElementById("lastUpdatedPill");
const topbar = document.getElementById("top");

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
const weekendChangesDetailsWrap = document.getElementById("weekendChangesDetailsWrap");
const weekendChangesDetails = document.getElementById("weekendChangesDetails");
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
const controlsCard = document.getElementById("controlsCard");
const mobileControlsAnchor = document.getElementById("mobileControlsAnchor");

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
let changesDetailsUid = 0;
let changesSelectionUid = 0;

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
  selectedChanges: { W1: null, W2: null },
  ratings: {}
};

// ====== INIT ======
init();

// Bootstraps UI state, loads data, and renders the initial view.
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
  setupTopbarHeight();
  setupMobileControlsPlacement();
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

  setDefaultSelectedChanges();
  renderWeekendChangesBox();
  setActiveWeekend(state.activeWeekend, false);
}

// Wires the update banner and handles SW update flow.
function setupServiceWorkerUpdates(registration) {
  const banner = document.getElementById("updateBanner");
  const textEl = document.getElementById("updateBannerText");
  const button = document.getElementById("updateReloadBtn");
  if (!registration || !banner || !textEl || !button) return;

  const setLabels = () => {
    const isDe = lang === "de";
    textEl.textContent = isDe ? "Update verf\u00fcgbar" : "Update available";
    button.textContent = isDe ? "Neu laden" : "Reload";
  };

  const show = () => {
    setLabels();
    banner.hidden = false;
    banner.classList.add("isVisible");
  };

  const onWaiting = (waiting) => {
    if (!waiting) return;
    show();
    button.onclick = () => waiting.postMessage({ type: "SKIP_WAITING" });
  };

  if (registration.waiting) onWaiting(registration.waiting);

  registration.addEventListener("updatefound", () => {
    const sw = registration.installing;
    if (!sw) return;
    sw.addEventListener("statechange", () => {
      if (sw.state === "installed" && navigator.serviceWorker.controller) {
        onWaiting(registration.waiting || sw);
      }
    });
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  if (langSelect) {
    langSelect.addEventListener("change", () => {
      if (!banner.hidden) setLabels();
    });
  }
}

// Attaches all UI event listeners.
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
  if (favoritesList) {
    favoritesList.addEventListener("click", async (e) => {
      const link = e.target.closest("[data-action='scrollLineup']");
      if (link) {
        e.preventDefault();
        scrollToTarget("#lineupListAnchor");
        return;
      }

      const removeBtn = e.target.closest("[data-action='removeFavorite']");
      if (removeBtn) {
        e.preventDefault();
        const id = removeBtn.getAttribute("data-artist-id");
        if (id) {
          await setRating(id, "unrated");
          renderActiveWeekend();
          showToast(t("saved") || "Gespeichert \u2713");
        }
        return;
      }

      if (e.target.closest("button, a, input, label")) return;
      const item = e.target.closest(".favItem");
      const id = item?.getAttribute("data-artist-id");
      if (id) scrollToArtist(id);
    });
    favoritesList.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (e.target.closest("button, a, input, label")) return;
      const item = e.target.closest(".favItem");
      const id = item?.getAttribute("data-artist-id");
      if (!id) return;
      e.preventDefault();
      scrollToArtist(id);
    });
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

  if (weekendChangesDetails) {
    weekendChangesDetails.addEventListener("click", (e) => {
      const link = e.target.closest(".changesDetailLink");
      const item = e.target.closest(".changesDetailItem");
      const slotId = link?.getAttribute("data-slot-id") || item?.getAttribute("data-slot-id");
      if (!slotId) return;
      e.preventDefault();
      scrollToSlotId(slotId);
    });
  }

  if (weekendChangesHistory) {
    weekendChangesHistory.addEventListener("click", async (e) => {
      const btn = e.target.closest(".changesHistoryBtn");
      if (!btn) return;
      e.preventDefault();
      const file = btn.getAttribute("data-file");
      const weekend = btn.getAttribute("data-weekend") || state.activeWeekend;
      if (!file || !weekend) return;
      const uid = ++changesSelectionUid;
      const url = withBase(`/data/${state.festival}/${state.year}/changes/${file}`);
      const data = await tryFetchJson(url, { cache: "no-store" });
      if (uid !== changesSelectionUid) return;
      if (!data) return;
      state.selectedChanges[weekend] = {
        data,
        entry: {
          weekend,
          file,
          createdAt: btn.getAttribute("data-created-at") || data?.meta?.createdAt || null,
          summary: data?.summary || null
        }
      };
      renderWeekendChangesBox();
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

  const playPressState = new WeakMap();

  const clearPlayPress = (btn) => {
    const state = playPressState.get(btn);
    if (!state) return;
    if (state.timer) clearTimeout(state.timer);
    playPressState.delete(btn);
  };

  document.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest(".playBtn");
    if (!btn) return;
    if (e.button !== undefined && e.button !== 0) return;
    clearPlayPress(btn);
    const state = { timer: null, longPress: false };
    state.timer = setTimeout(() => {
      state.longPress = true;
      openPlayOverlay(btn.getAttribute("data-artist") || "", btn);
    }, 550);
    playPressState.set(btn, state);
  });

  document.addEventListener("pointerup", (e) => {
    const btn = e.target.closest(".playBtn");
    if (!btn) return;
    clearPlayPress(btn);
  });

  document.addEventListener("pointercancel", (e) => {
    const btn = e.target.closest(".playBtn");
    if (!btn) return;
    clearPlayPress(btn);
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".playBtn");
    if (!btn) return;
    const state = playPressState.get(btn);
    if (state?.longPress) {
      clearPlayPress(btn);
      e.preventDefault();
      return;
    }
    e.preventDefault();
    const artist = btn.getAttribute("data-artist") || "";
    openDefaultPlay(artist);
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".playMoreBtn");
    if (!btn) return;
    e.preventDefault();
    const artist = btn.getAttribute("data-artist") || "";
    openPlayOverlay(artist, btn);
  });
}

// Moves the export card for mobile layout changes.
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

// Resolves the newest snapshot for the given weekend.
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

// Fetches a snapshot JSON file by name.
async function loadSnapshotFile(file) {
  const url = withBase(`/data/${state.festival}/${state.year}/snapshots/${file}`);
  return await fetchJson(url, { cache: "default" });
}

// Loads a snapshot into state and updates the select UI.
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

// Loads the latest artist metadata index.
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

// Loads the changes index for diff history.
async function loadChangesIndex() {
  const url = withBase(`/data/${state.festival}/${state.year}/changes/index.json`);
  state.changesIndex = await tryFetchJson(url, { cache: "no-store" });
}

// Loads the latest change summaries for both weekends.
async function loadWeekendChanges() {
  const base = withBase(`/data/${state.festival}/${state.year}/changes`);
  const [w1, w2] = await Promise.all([
    tryFetchJson(`${base}/latest_W1.json`, { cache: "no-store" }),
    tryFetchJson(`${base}/latest_W2.json`, { cache: "no-store" })
  ]);
  state.weekendChanges = { W1: w1, W2: w2 };
}

function setDefaultSelectedChanges() {
  WEEKENDS.forEach((weekend) => {
    const data = state.weekendChanges?.[weekend] || null;
    if (!data) return;
    const file = state.changesIndex?.latest?.[weekend] || null;
    state.selectedChanges[weekend] = {
      data,
      entry: { weekend, file, createdAt: data?.meta?.createdAt || null, summary: data?.summary || null }
    };
  });
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

// Builds the day/stage list for a weekend and injects HTML.
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

// Renders a day group with stage accordions.
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

// Renders a single artist slot card.
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

        <div class="playRow">
          <button class="playBtn" type="button" data-artist="${escapeAttr(name)}" aria-label="${escapeAttr(`Open play links for ${name}`)}">
            <span class="playIcon" aria-hidden="true">▶</span>
            <span class="playText">Play</span>
          </button>
          <button class="playMoreBtn" type="button" data-artist="${escapeAttr(name)}" aria-label="${escapeAttr(`Choose platform for ${name}`)}">
            <span class="playMoreIcon" aria-hidden="true">⋯</span>
          </button>
        </div>

        
      </div>
    </div>
  `;
}

// Renders the favorites list and summary.
function renderFavorites() {
  const weekend = state.activeWeekend;
  const w = state.weekends[weekend];
  const likedIds = Object.keys(ratings).filter(id => ratings[id] === "liked");
  const visibleLikedIds = likedIds.filter(id => w.artistSlots.has(id));
  updateFavoritesSummary(visibleLikedIds.length);

  if (favoritesPlanNote) {
    const note = t("plan_note") || "Deine Favoriten bilden automatisch die Basis f\u00fcr deine Tagesplanung.";
    favoritesPlanNote.textContent = note;
    favoritesPlanNote.hidden = visibleLikedIds.length === 0;
  }

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

    const removeLabel = t("favorites_remove") || "Aus Favoriten entfernen";
    return `
      <div class="favItem" data-artist-id="${escapeAttr(id)}" role="button" tabindex="0" aria-label="${escapeAttr(name)}">
        <div class="favItemTop">
          <div>
            <div class="actName">${escapeHtml(name)}</div>
            <div class="actMeta">${escapeHtml(meta)}</div>
          </div>
          <button class="favRemoveBtn" type="button" data-action="removeFavorite" data-artist-id="${escapeAttr(id)}" aria-label="${escapeAttr(removeLabel)}">${escapeHtml(removeLabel)}</button>
        </div>
        <div class="playRow" style="margin-top:8px">
          <button class="playBtn" type="button" data-artist="${escapeAttr(name)}" aria-label="${escapeAttr(`Open play links for ${name}`)}">
            <span class="playIcon" aria-hidden="true">▶</span>
            <span class="playText">Play</span>
          </button>
          <button class="playMoreBtn" type="button" data-artist="${escapeAttr(name)}" aria-label="${escapeAttr(`Choose platform for ${name}`)}">
            <span class="playMoreIcon" aria-hidden="true">⋯</span>
          </button>
        </div>
        
      </div>
    `;
  }).filter(Boolean);

  if (items.length) {
    favoritesList.innerHTML = items.join("");
    return;
  }

  const emptyLines = [
    t("favorites_empty_line1") || "Noch keine Favoriten ausgew\u00e4hlt.",
    t("favorites_empty_line2") || "Starte, indem du Acts mit \u2764\ufe0f markierst oder \ud83c\udfa7 kurz reinh\u00f6rst.",
    t("favorites_empty_line3") || "Deine Favoriten bilden automatisch die Basis f\u00fcr deine Tagesplanung."
  ];
  const tip = t("favorites_empty_tip") || "\ud83d\udca1 Tipp: 5\u201310 Favoriten reichen f\u00fcr einen guten \u00dcberblick.";
  const linkLabel = t("favorites_empty_link") || "\u21b3 Zur\u00fcck zur Line-up-Liste";
  const previewTitle = t("favorites_empty_preview_title") || "Beispiel \u2013 so k\u00f6nnte dein Tag aussehen";
  const previewDay = t("favorites_empty_preview_day") || "\u2b50 Mainstage \u2013 Freitag";
  const previewItems = [
    t("favorites_empty_preview_item_a") || "\u2022 Artist A",
    t("favorites_empty_preview_item_b") || "\u2022 Artist B",
    t("favorites_empty_preview_item_c") || "\u2022 Artist C"
  ];

  favoritesList.innerHTML = `
    <div class="favEmpty">
      <div class="favEmptyText">${emptyLines.map(line => escapeHtml(line)).join("<br>")}</div>
      <div class="favEmptyTip muted">${escapeHtml(tip)}</div>
      <button class="favEmptyLink" type="button" role="link" aria-label="${escapeAttr(linkLabel)}" data-action="scrollLineup">${escapeHtml(linkLabel)}</button>
      <div class="favEmptyPreview" aria-hidden="true">
        <div class="favEmptyPreviewTitle">${escapeHtml(previewTitle)}</div>
        <div class="favEmptyPreviewDay">${escapeHtml(previewDay)}</div>
        <div class="favEmptyPreviewList">
          ${previewItems.map(item => `<div>${escapeHtml(item)}</div>`).join("")}
        </div>
      </div>
    </div>
  `;

}

// Updates the favorites count pill and label.
function updateFavoritesSummary(count) {
  if (!favoritesToggle) return;
  const label = t("favorites_count") || "\u2764\ufe0f Deine Favoriten: {count} DJs";
  favoritesToggle.textContent = label.replace("{count}", String(count));
  const toggleLabel = t("favorites_toggle") || "Nur Favoriten anzeigen";
  favoritesToggle.setAttribute("aria-label", toggleLabel);
  updateFavoritesToggleUI();
}

// Syncs favorites-only toggle UI state.
function updateFavoritesToggleUI() {
  if (!favoritesToggle) return;
  favoritesToggle.classList.toggle("isActive", favoritesOnly);
  favoritesToggle.setAttribute("aria-pressed", favoritesOnly ? "true" : "false");
}

// Enables or disables favorites-only filtering.
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

// Shows a short-lived toast message.
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

// Opens the mobile menu and locks scroll.
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

// Closes the mobile menu and restores scroll.
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

// Toggles the mobile menu open/closed.
function toggleMenu() {
  if (menuOpen) closeMenu();
  else openMenu();
}

// Routes menu actions (scroll, weekend, filters).
function handleMenuItem(item) {
  const action = item.getAttribute("data-action");
  const target = item.getAttribute("data-target");
  let postClose = null;
  if (action === "weekend") {
    const weekend = item.getAttribute("data-weekend");
    if (weekend) setActiveWeekend(weekend, true);
    const id = weekend === "W2" ? "#w2Section" : "#w1Section";
    postClose = () => scrollToTarget(id);
  } else if (action === "setLang") {
    const nextLang = item.getAttribute("data-lang");
    if (nextLang && langSelect) {
      langSelect.value = nextLang;
      langSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
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

// Scrolls smoothly to the given selector.
function scrollToTarget(selector) {
  if (!selector) return;
  if (selector === "#top") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const el = document.querySelector(selector);
  if (!el) return;
  const topbarHeight = topbar ? topbar.getBoundingClientRect().height : 0;
  const y = el.getBoundingClientRect().top + window.scrollY - Math.ceil(topbarHeight) - 8;
  window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
}

// Populates menu day links for quick navigation.
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

// Renders the changes summary card.
function renderWeekendChangesBox() {
  if (!weekendChangesBox || !weekendChangesSummary || !weekendChangesHistory) return;
  const selected = state.selectedChanges?.[state.activeWeekend] || null;
  const data = selected?.data || state.weekendChanges?.[state.activeWeekend] || null;

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
  renderWeekendChangesDetails();
  weekendChangesBox.hidden = false;
}

function isSelectedChange(entry, selected) {
  if (!entry || !selected) return false;
  const selectedFile = selected?.entry?.file;
  if (selectedFile && entry.file === selectedFile) return true;
  const selectedCreatedAt = selected?.entry?.createdAt || selected?.data?.meta?.createdAt;
  return !!selectedCreatedAt && entry.createdAt === selectedCreatedAt;
}

// Renders the change history list.
function renderWeekendChangesHistory() {
  if (!weekendChangesHistory) return;
  const idx = state.changesIndex;
  const weekend = state.activeWeekend;
  const selected = state.selectedChanges?.[weekend] || null;
  if (!idx?.entries?.length) {
    weekendChangesHistory.textContent = t("weekend_changes_empty") || "Keine Historie.";
    return;
  }

  const entries = idx.entries
    .filter(e => e.weekend === weekend)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  if (!entries.length) {
    weekendChangesHistory.textContent = t("weekend_changes_empty") || "Keine Historie.";
    return;
  }

  weekendChangesHistory.innerHTML = entries.map(e => {
    const when = formatDateTime(e.createdAt);
    const s = e.summary || {};
    const isActive = isSelectedChange(e, selected);
    return `
      <div class="changesHistoryItem${isActive ? " isActive" : ""}">
        <button class="changesHistoryBtn" type="button" data-weekend="${escapeAttr(weekend)}" data-file="${escapeAttr(e.file)}" data-created-at="${escapeAttr(e.createdAt || "")}">${escapeHtml(when)}</button>
        <span>
          ${t("changes_added") || "Added"}: <strong>${s.added ?? 0}</strong>
          \u00b7 ${t("changes_removed") || "Removed"}: <strong>${s.removed ?? 0}</strong>
          \u00b7 ${t("changes_replaced") || "Replaced"}: <strong>${s.replaced ?? 0}</strong>
        </span>
      </div>
    `;
  }).join("");
}

// Renders detailed change lists (added/moved/removed/replaced).
async function renderWeekendChangesDetails() {
  if (!weekendChangesDetails || !weekendChangesDetailsWrap) return;
  const weekend = state.activeWeekend;
  const data = state.selectedChanges?.[weekend]?.data || state.weekendChanges?.[weekend];
  const uid = ++changesDetailsUid;

  if (!data?.meta?.from || !data?.meta?.to) {
    weekendChangesDetails.textContent = t("changes_details_empty") || "Keine Details verf\u00fcgbar.";
    weekendChangesDetailsWrap.open = false;
    return;
  }

  const [prevSnap, currSnap] = await Promise.all([
    resolveChangesSnapshot(weekend, data.meta.from),
    resolveChangesSnapshot(weekend, data.meta.to)
  ]);

  if (uid !== changesDetailsUid) return;

  if (!prevSnap?.slots || !currSnap?.slots) {
    weekendChangesDetails.textContent = t("changes_details_empty") || "Keine Details verf\u00fcgbar.";
    weekendChangesDetailsWrap.open = false;
    return;
  }

  const prevMap = buildSlotIdMap(prevSnap.slots);
  const currMap = buildSlotIdMap(currSnap.slots);

  const addedSlots = (data.added || []).map(id => currMap.get(id)).filter(Boolean);
  const removedSlots = (data.removed || []).map(id => prevMap.get(id)).filter(Boolean);

  const moved = [];
  const movedAddedIds = new Set();
  const movedRemovedIds = new Set();
  const addedByArtist = bucketByArtist(addedSlots);
  const removedByArtist = bucketByArtist(removedSlots);

  for (const [artistId, addedList] of addedByArtist.entries()) {
    const removedList = removedByArtist.get(artistId);
    if (!removedList?.length) continue;
    const pairs = Math.min(addedList.length, removedList.length);
    for (let i = 0; i < pairs; i++) {
      moved.push({ artistId, from: removedList[i], to: addedList[i] });
      movedAddedIds.add(addedList[i].slotId);
      movedRemovedIds.add(removedList[i].slotId);
    }
  }

  const finalAdded = addedSlots.filter(s => !movedAddedIds.has(s.slotId));
  const finalRemoved = removedSlots.filter(s => !movedRemovedIds.has(s.slotId));

  const replaced = (data.replaced || []).map(item => {
    const fromSlot = prevMap.get(item?.from?.slotId) || item?.from || null;
    const toSlot = currMap.get(item?.to?.slotId) || item?.to || null;
    return { from: fromSlot, to: toSlot, meta: item };
  }).filter(item => item.from || item.to);

  const sections = [];
  sections.push(renderChangesSection(t("changes_added") || "Added", finalAdded.length, finalAdded.map(slot => {
    return renderChangeItem(slot, weekend, true);
  })));
  sections.push(renderChangesSection(t("changes_moved") || "Moved", moved.length, moved.map(pair => {
    return renderMovedChangeItem(pair, weekend);
  })));
  sections.push(renderChangesSection(t("changes_removed") || "Removed", finalRemoved.length, finalRemoved.map(slot => {
    return renderChangeItem(slot, weekend, false);
  })));
  sections.push(renderChangesSection(t("changes_replaced") || "Replaced", replaced.length, replaced.map(item => {
    return renderReplacedChangeItem(item);
  })));

  const hasItems = sections.some(Boolean);
  weekendChangesDetails.innerHTML = hasItems ? sections.filter(Boolean).join("") : escapeHtml(t("changes_details_empty") || "Keine Details verf\u00fcgbar.");
  weekendChangesDetailsWrap.open = hasItems;
}

function buildSlotIdMap(slots) {
  const m = new Map();
  (slots || []).forEach(s => {
    if (s?.slotId) m.set(s.slotId, s);
  });
  return m;
}

function bucketByArtist(slots) {
  const m = new Map();
  (slots || []).forEach(s => {
    const id = s?.artistId || "__unknown__";
    if (!m.has(id)) m.set(id, []);
    m.get(id).push(s);
  });
  return m;
}

async function resolveChangesSnapshot(weekend, file) {
  if (!file) return null;
  const w = state.weekends?.[weekend];
  if (w?.selectedFile === file && w?.snapshot) return w.snapshot;
  const url = withBase(`/data/${state.festival}/${state.year}/snapshots/${file}`);
  return await tryFetchJson(url, { cache: "no-store" });
}

function formatSlotMeta(slot, { useStageAliases = true } = {}) {
  const date = slot?.date || extractDate(slot?.start) || "";
  const dateLabel = date ? formatDate(date) : notAvailable();
  const stage = normalizeStage(slot?.stage, { useStageAliases });
  const start = formatTime(slot?.start);
  const end = formatTime(slot?.end);
  const timeRange = start && end ? `${start}\u2013${end}` : (start || end || notAvailable());
  return `${dateLabel} \u00b7 ${timeRange} \u00b7 ${stage}`;
}

function renderChangesSection(label, count, items) {
  if (!count || !items?.length) return "";
  return `
    <div class="changesDetailSection">
      <div class="changesDetailTitle">${escapeHtml(label)} (${count})</div>
      <div class="changesDetailList">${items.join("")}</div>
    </div>
  `;
}

function renderChangeItem(slot, weekend, linkToSlot) {
  if (!slot) return "";
  const name = getArtistName(slot.artistId, slot);
  const meta = formatSlotMeta(slot, { useStageAliases: false });
  const nameHtml = linkToSlot && slot.slotId
    ? `<a class="changesDetailLink" data-slot-id="${escapeAttr(slot.slotId)}" href="${escapeAttr(`#slot-${weekend}-${slot.slotId}`)}">${escapeHtml(name)}</a>`
    : `<span class="changesDetailNameText">${escapeHtml(name)}</span>`;
  return `
    <div class="changesDetailItem" ${linkToSlot && slot.slotId ? `data-slot-id="${escapeAttr(slot.slotId)}"` : ""}>
      <div class="changesDetailName">${nameHtml}</div>
      <div class="changesDetailMeta">${escapeHtml(meta)}</div>
    </div>
  `;
}

function renderMovedChangeItem(pair, weekend) {
  if (!pair?.from && !pair?.to) return "";
  const baseSlot = pair.to || pair.from || {};
  const name = getArtistName(pair.artistId, baseSlot);
  const fromMeta = pair.from ? formatSlotMeta(pair.from, { useStageAliases: false }) : notAvailable();
  const toMeta = pair.to ? formatSlotMeta(pair.to, { useStageAliases: false }) : notAvailable();
  const nameHtml = pair?.to?.slotId
    ? `<a class="changesDetailLink" data-slot-id="${escapeAttr(pair.to.slotId)}" href="${escapeAttr(`#slot-${weekend}-${pair.to.slotId}`)}">${escapeHtml(name)}</a>`
    : `<span class="changesDetailNameText">${escapeHtml(name)}</span>`;
  return `
    <div class="changesDetailItem" ${pair?.to?.slotId ? `data-slot-id="${escapeAttr(pair.to.slotId)}"` : ""}>
      <div class="changesDetailName">${nameHtml}</div>
      <div class="changesDetailMeta">${escapeHtml(fromMeta)} -> ${escapeHtml(toMeta)}</div>
    </div>
  `;
}

function renderReplacedChangeItem(item) {
  if (!item?.from && !item?.to) return "";
  const fromName = item?.from?.artist || getArtistName(item?.meta?.from?.artistId, item?.from || {});
  const toName = item?.to?.artist || getArtistName(item?.meta?.to?.artistId, item?.to || {});
  const metaSlot = item.to || item.from || null;
  const meta = metaSlot ? formatSlotMeta(metaSlot, { useStageAliases: false }) : notAvailable();
  return `
    <div class="changesDetailItem" ${item?.to?.slotId ? `data-slot-id="${escapeAttr(item.to.slotId)}"` : ""}>
      <div class="changesDetailName">${escapeHtml(fromName)} -> ${escapeHtml(toName)}</div>
      <div class="changesDetailMeta">${escapeHtml(meta)}</div>
    </div>
  `;
}

// Exports ratings to a local JSON download.
function exportRatings() {
  const createdAt = new Date().toISOString();
  const playProvider = getPlayProvider();
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
    settings: {
      playProvider
    },
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

// Imports ratings from a JSON file.
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
      const provider = data?.settings?.playProvider;
      if (provider && ["sp", "am", "yt", "sc"].includes(provider)) {
        setPlayProvider(provider);
      }
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

// Updates last-checked and last-updated pills.
function renderStatusPills() {
  const w = state.weekends[state.activeWeekend];
  const lastChecked = w.snapshot?.meta?.createdAt
    ? formatDateTime(w.snapshot.meta.createdAt)
    : notAvailable();
  lastCheckedPill.textContent = lastChecked;

  const slotCount = w.snapshot?.slots?.length ?? 0;
  lastUpdatedPill.textContent = `${slotCount} ${t("slots") || "Slots"}`;
}

// Rebuilds day/stage filter options from snapshot data.
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

// Creates a filter option descriptor.
function buildFilterOption(value, label) {
  return { value, label };
}

// Renders select options and syncs the custom select UI.
function setSelectOptions(selectEl, options, selectedValue) {
  if (!selectEl) return;
  selectEl.innerHTML = options.map(o => `
      <option value="${escapeAttr(o.value)}">${escapeHtml(o.label)}</option>
    `).join("");
  selectEl.value = selectedValue;
  rebuildCustomSelect(selectEl);
}

// Renders active filter chips row.
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

// Clears a specific filter and refreshes results.
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

// Gets the display label for a select value.
function getSelectLabel(selectEl, value) {
  if (!selectEl) return value;
  const opt = Array.from(selectEl.options).find(o => o.value === value);
  return opt ? opt.textContent : value;
}

// Returns the label for a rating filter chip.
function ratingChipLabel(value) {
  if (value === "liked") return translateOr("rating_chip_liked", "❤️");
  if (value === "maybe") return translateOr("rating_chip_maybe", "🤔");
  if (value === "disliked") return translateOr("rating_chip_disliked", "👎");
  if (value === "unrated") return translateOr("rating_chip_unrated", translateOr("unrated", "Unrated"));
  return value;
}

// Builds i18n labels for rating actions.
function getRatingActionLabels() {
  const labels = {};
  RATING_STATES.forEach((key) => {
    const meta = RATING_ACTION_LABELS[key];
    labels[key] = translateOr(meta.actionKey, translateOr(meta.fallbackKey, meta.fallback));
  });
  return labels;
}

// Resolves the icon for a rating state.
function getRatingChipIcon(key) {
  const lookupKey = `rating_chip_${key}`;
  return translateOr(lookupKey, RATING_CHIP_FALLBACKS[key] || "");
}

// Looks up a translation with fallback.
function translateOr(key, fallback) {
  if (key && Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
  return fallback;
}
// ====== INTERACTIONS ======
function bindSlotInteractions(container, weekend) {
  bindRatingMenus(container, weekend);
}

// Binds rating menu interactions for each slot.
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
      if (e.target.closest(".ratingSelect, a, button, input, label")) return;
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

// Indexes artist elements for search/scroll.
function indexArtistElements(container, weekend) {
  const map = new Map();
  Array.from(container.querySelectorAll(".slot")).forEach(el => {
    const id = el.getAttribute("data-artist-id") || "";
    if (id && !map.has(id)) map.set(id, el);
  });
  state.weekends[weekend].artistFirstEl = map;
}

// Updates live search results list.
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

// Scrolls to an artist in the active list.
function scrollToArtist(artistId) {
  const w = state.weekends[state.activeWeekend];
  const el = w.artistFirstEl.get(artistId);
  if (!el) {
    showError("Artist im aktuellen Weekend nicht gefunden.");
    return;
  }

  clearError();
  const slots = w.artistSlots.get(artistId) || [];
  if (slots.length) {
    const container = state.activeWeekend === "W1" ? actsListW1 : actsListW2;
    openDetailsForSlot(container, slots[0]);
  }
  el.classList.remove("isTarget");
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => el.classList.add("isTarget"), 50);
  setTimeout(() => el.classList.remove("isTarget"), 2500);
}

// Scrolls to a specific slot by slotId in the active weekend.
function scrollToSlotId(slotId) {
  const weekend = state.activeWeekend;
  const w = state.weekends[weekend];
  const slots = w?.snapshot?.slots || [];
  const slot = slots.find(s => s.slotId === slotId);
  if (!slot) {
    showError("Slot im aktuellen Weekend nicht gefunden.");
    return;
  }
  clearError();
  const container = weekend === "W1" ? actsListW1 : actsListW2;
  openDetailsForSlot(container, slot);
  const el = document.getElementById(`slot-${weekend}-${slotId}`);
  if (!el) {
    showError("Act im aktuellen Weekend nicht gefunden.");
    return;
  }
  el.classList.remove("isTarget");
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => el.classList.add("isTarget"), 50);
  setTimeout(() => el.classList.remove("isTarget"), 2500);
}

// Opens the correct day/stage details for a slot.
function openDetailsForSlot(container, slot) {
  if (!container || !slot) return;
  const day = slot.date || extractDate(slot.start) || "Unknown";
  const stage = normalizeStage(slot.stage);
  const dayEl = Array.from(container.querySelectorAll("details.dayGroup"))
    .find(el => el.getAttribute("data-day") === day);
  if (dayEl && !dayEl.open) dayEl.open = true;
  const stageEl = Array.from(container.querySelectorAll("details.stageGroup"))
    .find(el => el.getAttribute("data-day") === day && el.getAttribute("data-stage") === stage);
  if (stageEl && !stageEl.open) stageEl.open = true;
}

// Switches the active weekend tab and updates route.
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

// Maps artist IDs to their slots.
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

// Counts total slots in grouped data.
function countGroupedSlots(grouped) {
  let count = 0;
  grouped.forEach(day => {
    day.stages.forEach(stage => {
      count += stage.slots.length;
    });
  });
  return count;
}

// Sorts stages by the predefined order list.
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

// Returns a genre label for a stage.
function getStageGenre(stage) {
  const key = normalizeStageName(stage);
  const alias = STAGE_ALIASES[key];
  const genreKey = normalizeStageName(alias || stage);
  return STAGE_GENRES[genreKey] || "";
}

// Reads which day/stage accordions are open.
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

// Keeps accordion open state consistent after filtering.
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

// Parses festival/year/weekend from the current path.
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

// Builds the canonical URL path for the route.
function canonicalPath(r) {
  const base = `${BASE_PREFIX}/${r.festival}/${r.year}/${r.weekend}`;
  return CANONICAL_TRAILING_SLASH ? `${base}/` : base;
}

// Replaces the URL to the canonical route.
function setCanonicalRoute(r) {
  if (!r?.festival || !r?.year || !r?.weekend) return;
  history.replaceState({}, "", canonicalPath(r));
}

// Normalizes path override query param routing.
function normalizeUrlIfNeeded() {
  const { value: p, rest } = stripQueryParam(location.search, "path");
  if (!p) return;
  const canonical = canonicalPath(route) + rest;
  history.replaceState({}, "", canonical);
}

// Ensures trailing slash and canonical path.
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
// Loads i18n JSON and updates localized text.
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

// Returns a translated string or the key fallback.
function t(key) {
  return dict[key] || key;
}

// Returns the localized "not available" placeholder.
function notAvailable() {
  return t("not_available_yet") || "Not available yet";
}

// ====== UTIL ======
function cleanSegment(value, pattern, fallback) {
  const v = String(value || "").trim();
  if (!v || !pattern.test(v)) return fallback;
  return v;
}

// Reads a query parameter value.
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

// Removes a query param and returns remaining query.
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

// Normalizes weekend identifiers to W1/W2.
function normalizeWeekend(value) {
  const v = String(value || "").toUpperCase();
  if (v === "W1" || v === "W2") return v;
  if (v === "1" || v === "WEEKEND1") return "W1";
  if (v === "2" || v === "WEEKEND2") return "W2";
  return "";
}

// Returns the snapshot select for a weekend.
function snapshotSelectForWeekend(weekend) {
  return weekend === "W1" ? snapshotSelectW1 : snapshotSelectW2;
}

// Populates snapshot options for a weekend.
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

// Formats an ISO datetime string.
function formatDateTime(iso) {
  if (!iso) return notAvailable();
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

// Formats an ISO date string.
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

// Extracts an ISO date from a string.
function extractDate(value) {
  const m = String(value || "").match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

// Extracts HH:MM from a time string.
function formatTime(value) {
  const m = String(value || "").match(/(\d{2}):(\d{2})/);
  if (!m) return "";
  return `${m[1]}:${m[2]}`;
}

// Converts a time string to minutes since midnight.
function toMinutes(value) {
  const t = formatTime(value);
  if (!t) return 9999;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Normalizes stage data to a display string.
function normalizeStage(stage, { useStageAliases = true } = {}) {
  if (typeof stage === "string") {
    const s = stage.trim();
    if (!s || s === "[object Object]") return "Unknown Stage";
    const key = normalizeStageName(s);
    if (useStageAliases && STAGE_ALIASES[key]) return STAGE_ALIASES[key];
    return s;
  }
  if (stage && typeof stage === "object") {
    const raw = String(stage.name || stage.title || stage.label || stage.stageName || stage.stage_name || "Unknown Stage").trim();
    const key = normalizeStageName(raw);
    if (useStageAliases && STAGE_ALIASES[key]) return STAGE_ALIASES[key];
    return raw;
  }
  return "Unknown Stage";
}

// Normalizes stage names for lookup keys.
function normalizeStageName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

// Resolves artist name from metadata or slot.
function getArtistName(artistId, slot) {
  return state.artists.byId.get(artistId)?.name || slot.artist || "Unknown Artist";
}

// Shows the top error box.
function showError(msg) {
  if (!errorBox) return;
  errorBox.textContent = msg;
  errorBox.hidden = false;
}

// Clears the top error box.
function clearError() {
  if (!errorBox) return;
  errorBox.hidden = true;
  errorBox.textContent = "";
}

// Creates a short stable hash for IDs.
function hashMini(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i) | 0;
  return Math.abs(h).toString(36);
}

// Escapes HTML special characters.
function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
// Escapes HTML attribute values.
function escapeAttr(s){ return escapeHtml(s).replace(/`/g, "&#096;"); }

// Fetches JSON and throws on non-OK responses.
async function fetchJson(url, { cache = "default" } = {}) {
  const res = await fetch(url, { cache });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return await res.json();
}

// Fetches JSON and returns null on errors.
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
// Builds an Apple Music search URL for an artist.
function makeAppleMusicSearchUrl(name){ return `https://music.apple.com/search?term=${encodeURIComponent(name)}`; }
// Builds a YouTube search URL for an artist.
function makeYouTubeSearchUrl(name){ return `https://www.youtube.com/results?search_query=${encodeURIComponent(name)}`; }
// Builds a SoundCloud search URL for an artist.
function makeSoundCloudSearchUrl(name){ return `https://soundcloud.com/search?q=${encodeURIComponent(name)}`; }
// Opens a link in a new tab safely.
function openLink(url){ window.open(url, "_blank", "noopener"); }

const DEFAULT_PLAY_PROVIDER = "sp";
const PLAY_PROVIDER_KEY = "fp_play_provider";

function getPlayProvider() {
  return localStorage.getItem(PLAY_PROVIDER_KEY) || DEFAULT_PLAY_PROVIDER;
}

function setPlayProvider(value) {
  if (!value) return;
  localStorage.setItem(PLAY_PROVIDER_KEY, value);
}

let playOverlay = null;
let playOverlayPanel = null;
let playOverlayTitle = null;
let playOverlayLinks = null;
let playOverlayTrigger = null;

// Basic normalization for multi-artist strings (b2b, &, x, feat).
function normalizeSearchTerm(name) {
  const primary = String(name || "").trim();
  const normalized = primary
    .replace(/\s*(?:b2b|&|x|feat\.?|ft\.?)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { primary, normalized };
}

// Build provider URLs using the best available search term.
function buildPlayUrls(name) {
  const { primary, normalized } = normalizeSearchTerm(name);
  const term = primary || normalized || "";
  return {
    sp: makeSpotifySearchUrl(term),
    am: makeAppleMusicSearchUrl(term),
    yt: makeYouTubeSearchUrl(term),
    sc: makeSoundCloudSearchUrl(term)
  };
}

function openDefaultPlay(name) {
  const urls = buildPlayUrls(name);
  const provider = getPlayProvider();
  const url = urls[provider] || urls.sp;
  if (url) openLink(url);
}

// Create the overlay once and reuse it for all artists.
function ensurePlayOverlay() {
  if (playOverlay) return;

  playOverlay = document.createElement("div");
  playOverlay.className = "playOverlay";
  playOverlay.hidden = true;

  playOverlayPanel = document.createElement("div");
  playOverlayPanel.className = "playPanel";
  playOverlayPanel.setAttribute("role", "dialog");
  playOverlayPanel.setAttribute("aria-modal", "true");
  playOverlayPanel.setAttribute("aria-labelledby", "playOverlayTitle");
  playOverlayPanel.tabIndex = -1;

  playOverlayTitle = document.createElement("div");
  playOverlayTitle.className = "playPanelTitle";
  playOverlayTitle.id = "playOverlayTitle";

  const list = document.createElement("div");
  list.className = "playPanelList";

  const makeRow = (key, label) => {
    const row = document.createElement("div");
    row.className = "playRowItem";

    const a = document.createElement("a");
    a.className = `playLink ${key}`;
    a.setAttribute("data-provider", key);
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
    a.href = "#";
    a.textContent = label;

    const setBtn = document.createElement("button");
    setBtn.type = "button";
    setBtn.className = "playDefaultBtn";
    setBtn.setAttribute("data-provider", key);
    setBtn.textContent = "Als Standard";

    row.append(a, setBtn);
    return { row, link: a, button: setBtn };
  };

  const sp = makeRow("sp", "Spotify");
  const am = makeRow("am", "Apple Music");
  const yt = makeRow("yt", "YouTube");
  const sc = makeRow("sc", "SoundCloud");

  playOverlayLinks = [sp.link, am.link, yt.link, sc.link];

  list.append(sp.row, am.row, yt.row, sc.row);
  playOverlayPanel.append(playOverlayTitle, list);
  playOverlay.append(playOverlayPanel);
  document.body.append(playOverlay);

  playOverlay.addEventListener("click", (e) => {
    if (e.target === playOverlay) closePlayOverlay();
  });

  playOverlayPanel.addEventListener("click", (e) => {
    const link = e.target.closest("a.playLink");
    if (link) {
      closePlayOverlay();
      return;
    }
    const setBtn = e.target.closest(".playDefaultBtn");
    if (setBtn) {
      const provider = setBtn.getAttribute("data-provider");
      setPlayProvider(provider);
      updatePlayDefaultUI();
    }
  });

  playOverlayPanel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closePlayOverlay();
      return;
    }
    if (e.key !== "Tab") return;
    const items = playOverlayLinks || [];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (!playOverlay || playOverlay.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closePlayOverlay();
    }
  });

  window.addEventListener("resize", () => {
    if (!playOverlay || playOverlay.hidden || !playOverlayTrigger) return;
    positionPlayOverlay(playOverlayTrigger);
  });
}

function positionPlayOverlay(trigger) {
  if (!playOverlayPanel) return;
  if (!trigger) return;
  const isMobile = window.matchMedia("(max-width: 720px)").matches;
  playOverlay.classList.toggle("isSheet", isMobile);
  if (isMobile) return;

  const rect = trigger.getBoundingClientRect();
  const margin = 8;
  const left = Math.min(Math.max(rect.left + rect.width / 2, 16), window.innerWidth - 16);
  playOverlayPanel.style.left = `${left}px`;
  playOverlayPanel.style.top = `${rect.bottom + margin}px`;
  playOverlayPanel.style.transform = "translateX(-50%)";

  const panelRect = playOverlayPanel.getBoundingClientRect();
  if (panelRect.bottom > window.innerHeight - 8 && rect.top > panelRect.height + margin) {
    playOverlayPanel.style.top = `${rect.top - margin}px`;
    playOverlayPanel.style.transform = "translate(-50%, -100%)";
  }
}

// Syncs a CSS var with the current topbar height (for fixed layout padding).
function setupTopbarHeight() {
  if (!topbar) return;
  const update = () => {
    const h = Math.ceil(topbar.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--topbar-h", `${h}px`);
  };
  update();
  window.addEventListener("resize", update);
  if (document.fonts && typeof document.fonts.addEventListener === "function") {
    document.fonts.addEventListener("loadingdone", update);
  }
}

// Moves the controls card for mobile layout changes.
function setupMobileControlsPlacement() {
  if (!controlsCard || !mobileControlsAnchor) return;
  const originalParent = controlsCard.parentNode;
  const originalNext = controlsCard.nextSibling;
  const mq = window.matchMedia("(max-width: 980px)");

  const applyPlacement = () => {
    if (mq.matches) {
      const anchorParent = mobileControlsAnchor.parentNode;
      if (controlsCard.parentNode !== anchorParent) {
        const next = mobileControlsAnchor.nextSibling;
        if (next) {
          anchorParent.insertBefore(controlsCard, next);
        } else {
          anchorParent.appendChild(controlsCard);
        }
      }
      return;
    }
    if (controlsCard.parentNode !== originalParent) {
      if (originalNext && originalNext.parentNode === originalParent) {
        originalParent.insertBefore(controlsCard, originalNext);
      } else {
        originalParent.appendChild(controlsCard);
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

function openPlayOverlay(artist, trigger) {
  ensurePlayOverlay();
  playOverlayTrigger = trigger || null;

  const name = String(artist || "").trim() || "Artist";
  playOverlayTitle.textContent = `Open ${name} in\u2026`;

  const urls = buildPlayUrls(name);
  playOverlayLinks[0].href = urls.sp;
  playOverlayLinks[1].href = urls.am;
  playOverlayLinks[2].href = urls.yt;
  playOverlayLinks[3].href = urls.sc;
  updatePlayDefaultUI();

  playOverlay.hidden = false;
  playOverlay.classList.add("isOpen");
  positionPlayOverlay(trigger);

  setTimeout(() => {
    playOverlayLinks[0].focus();
  }, 0);
}

function closePlayOverlay() {
  if (!playOverlay) return;
  playOverlay.classList.remove("isOpen");
  playOverlay.hidden = true;
  if (playOverlayTrigger && typeof playOverlayTrigger.focus === "function") {
    playOverlayTrigger.focus();
  }
  playOverlayTrigger = null;
}

function updatePlayDefaultUI() {
  if (!playOverlayPanel) return;
  const current = getPlayProvider();
  playOverlayPanel.querySelectorAll(".playDefaultBtn").forEach((btn) => {
    const key = btn.getAttribute("data-provider");
    const isActive = key === current;
    btn.classList.toggle("isActive", isActive);
    btn.textContent = isActive ? "Standard" : "Als Standard";
  });
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

// Syncs custom select UI with native select state.
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

// Rebuilds the custom select after options change.
function rebuildCustomSelect(selectEl) {
  const wrapper = selectEl?.parentNode?.querySelector(".selectWrap");
  if (wrapper) wrapper.remove();
  selectEl.dataset.customReady = "";
  initCustomSelect(selectEl);
}

// Falls back to the native select if needed.
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

// Updates rating state and persists to IndexedDB.
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

// Creates the key prefix for a festival/year.
function makeDbKeyPrefix(r){ return `${r.festival}::${r.year}::`; }
// Creates the full key for an artist rating.
function makeDbKey(r, artistId){ return `${makeDbKeyPrefix(r)}${artistId}`; }

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


