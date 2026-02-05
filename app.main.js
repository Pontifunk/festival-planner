// ====== INIT ======
boot();

async function boot() {
  if (window.__FP_INIT__) return;

  const depsReady = typeof window.getBasePrefix === "function"
    && typeof window.loadSnapshotIndex === "function"
    && typeof window.initCustomSelect === "function"
    && typeof window.applyTranslations === "function";

  if (!depsReady) {
    await loadDeps();
  }

  if (shouldDebugCls()) {
    await loadScript("/debug.cls.js");
  }

  if (window.__FP_INIT__) return;
  window.__FP_INIT__ = true;

  if (typeof initClsDebug === "function") initClsDebug();
  init();
}

function shouldDebugCls() {
  try {
    return new URLSearchParams(window.location.search || "").get("debug") === "cls";
  } catch {
    return false;
  }
}

function loadDeps() {
  const deps = [
    "/app.util.js",
    "/app.config.js",
    "/app.i18n.js",
    "/app.routing.js",
    "/app.state.js",
    "/app.store.js",
    "/app.data.js",
    "/app.ui.js"
  ];

  return deps.reduce((p, src) => p.then(() => loadScript(src)), Promise.resolve());
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src="' + src + '"]')) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}

const ONBOARDING_HINT_KEY = "fp_onboarding_seen";

function getOnboardingEls() {
  const hint = onboardingHint || document.getElementById("onboardingHint");
  const text = onboardingHintText || document.getElementById("onboardingHintText");
  const dismiss = onboardingHintDismiss || document.getElementById("onboardingHintDismiss");
  return { hint, text, dismiss };
}

function buildOnboardingHintText() {
  const like = `${getRatingIcon("liked")} ${getRatingLabel("liked")}`;
  const maybe = `${getRatingIcon("maybe")} ${getRatingLabel("maybe")}`;
  const dislike = `${getRatingIcon("disliked")} ${getRatingLabel("disliked")}`;
  if (getActiveLang() === "de") {
    return `\uD83D\uDCA1 Bewerte Acts mit ${like}, ${maybe} oder ${dislike}. Deine Auswahl bleibt nur auf diesem Ger\u00e4t gespeichert.`;
  }
  return `\uD83D\uDCA1 Rate acts using ${like}, ${maybe} or ${dislike}. Your selections are stored only on this device.`;
}

function updateOnboardingHintText() {
  const { text } = getOnboardingEls();
  if (!text) return;
  text.textContent = buildOnboardingHintText();
}

function shouldShowOnboardingHint() {
  try {
    return localStorage.getItem(ONBOARDING_HINT_KEY) !== "1";
  } catch {
    return true;
  }
}

function markOnboardingSeen() {
  try {
    localStorage.setItem(ONBOARDING_HINT_KEY, "1");
  } catch {
    // Ignore storage failures.
  }
}

function dismissOnboardingHint() {
  const { hint } = getOnboardingEls();
  if (!hint) return;
  markOnboardingSeen();
  hint.hidden = true;
}

function initOnboardingHint() {
  const { hint, dismiss } = getOnboardingEls();
  if (!hint) return;
  if (!shouldShowOnboardingHint()) {
    hint.hidden = true;
  } else {
    updateOnboardingHintText();
    hint.hidden = false;
  }
  if (dismiss && dismiss.dataset.bound !== "true") {
    dismiss.dataset.bound = "true";
    dismiss.addEventListener("click", dismissOnboardingHint);
  }
}

// Bootstraps UI state, loads data, and renders the initial view.
async function init() {
  console.info("[festival-planner] build", BUILD_ID);
  if (DONATION_URL && !DONATION_URL.includes("DEINNAME")) {
    donateBtn.href = DONATION_URL;
  } else {
    donateBtn.href = "#";
    donateBtn.classList.add("isDisabled");
    donateBtn.setAttribute("aria-disabled", "true");
    donateBtn.title = "Spendenlink folgt";
    donateBtn.setAttribute("data-i18n-title", "donation_link_coming");
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
  initOnboardingHint();
  renderBuildStamp();

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

  applySeoFromRoute(route);
  normalizeUrlIfNeeded();
  ensureCanonicalUrl();

  const perfDebug = shouldDebugCls();
  const logPerf = (...args) => {
    if (!perfDebug) return;
    console.info("[perf]", ...args);
  };

  bindUi();
  setupMobileControlsPlacement();
  setupMobileExportPlacement();

  try {
    await Promise.all([
      loadSnapshotIndex(),
      loadArtistsLatest(),
      loadChangesIndex(),
      loadWeekendChanges()
    ]);
    logPerf("base-data-ready");
  } catch (e) {
    showError(t("base_data_load_error") || "Error loading base data.");
  }

  const legacyRatings = await dbGetAll(makeLegacyDbKeyPrefix(state));
  const ratingsByWeekend = {};
  await Promise.all(WEEKENDS.map(async (wk) => {
    const wkRatings = await dbGetAll(makeDbKeyPrefix(state, wk));
    ratingsByWeekend[wk] = { ...legacyRatings, ...wkRatings };
  }));
  state.ratingsByWeekend = ratingsByWeekend;
  ratings = ratingsByWeekend[state.activeWeekend] || {};

  await loadSnapshotForWeekend(state.activeWeekend);
  logPerf("active-weekend-snapshot-ready", state.activeWeekend);

  setDefaultSelectedChanges();
  renderWeekendChangesBox();
  setActiveWeekend(state.activeWeekend, false);

  runIdle(() => {
    const otherWeekend = WEEKENDS.find((w) => w !== state.activeWeekend);
    if (!otherWeekend) return;
    loadSnapshotForWeekend(otherWeekend).then(() => {
      if (state.activeWeekend === otherWeekend) renderActiveWeekend();
    });
  }, { timeout: 1000 });

  tryScrollToArtistFromQuery();
}

function resetFiltersForArtistDeepLink() {
  let changed = false;
  if (favoritesOnly) {
    favoritesOnly = false;
    updateFavoritesToggleUI();
    changed = true;
  }
  if (ratingFilter && ratingFilter.value !== "all") {
    ratingFilter.value = "all";
    syncCustomSelect(ratingFilter);
    changed = true;
  }
  const w = state.weekends[state.activeWeekend];
  if (w?.filters) {
    if (w.filters.day !== "all") {
      w.filters.day = "all";
      if (dayFilter) {
        dayFilter.value = "all";
        syncCustomSelect(dayFilter);
      }
      changed = true;
    }
    if (w.filters.stage !== "all") {
      w.filters.stage = "all";
      if (stageFilter) {
        stageFilter.value = "all";
        syncCustomSelect(stageFilter);
      }
      changed = true;
    }
  }
  if (changed) renderActiveWeekend();
}

async function refreshRatingsFromDb() {
  try {
    const wk = state.activeWeekend || DEFAULT_WEEKEND;
    const legacyRatings = await dbGetAll(makeLegacyDbKeyPrefix(state));
    const wkRatings = await dbGetAll(makeDbKeyPrefix(state, wk));
    if (!state.ratingsByWeekend) state.ratingsByWeekend = {};
    state.ratingsByWeekend[wk] = { ...legacyRatings, ...wkRatings };
    ratings = state.ratingsByWeekend[wk] || {};
    renderActiveWeekend();
  } catch {
    // Ignore refresh failures.
  }
}

function tryScrollToArtistFromQuery() {
  const artistParam = getQueryParam("artist");
  if (!artistParam) return;
  resetFiltersForArtistDeepLink();

  const tryScroll = (attempt = 0) => {
    const id = resolveArtistId(artistParam);
    const w = state.weekends[state.activeWeekend];
    const hasEl = id && w?.artistFirstEl?.has(id);

    if (id && hasEl) {
      setTimeout(() => scrollToArtist(id, 0, { suppressError: true }), 60);
      return;
    }

    if (attempt < 12) {
      runIdle(() => tryScroll(attempt + 1), { timeout: 400 });
      return;
    }

    if (id) {
      scrollToArtist(id, 0, { suppressError: false });
    } else {
      showError(t("artist_not_found") || "Artist im aktuellen Weekend nicht gefunden.");
    }
  };

  tryScroll();
}

window.addEventListener("pageshow", (e) => {
  if (!window.__FP_INIT__) return;
  if (e && e.persisted) {
    refreshRatingsFromDb().then(() => tryScrollToArtistFromQuery());
    return;
  }
  tryScrollToArtistFromQuery();
});

// Wires the update banner and handles SW update flow.
function setupServiceWorkerUpdates(registration) {
  const banner = document.getElementById("updateBanner");
  const textEl = document.getElementById("updateBannerText");
  const button = document.getElementById("updateReloadBtn");
  if (!registration || !banner || !textEl || !button) return;
  banner.hidden = true;
  banner.setAttribute("aria-hidden", "true");
  banner.setAttribute("inert", "");
  banner.classList.remove("isVisible");

  const setLabels = () => {
    textEl.textContent = t("update_available") || "Update available";
    button.textContent = t("reload_safe") || t("reload") || "Reload";
  };

  const show = () => {
    setLabels();
    banner.hidden = false;
    banner.setAttribute("aria-hidden", "false");
    banner.removeAttribute("inert");
    banner.classList.add("isVisible");
  };

  const onWaiting = (waiting) => {
    if (!waiting) return;
    show();
    button.onclick = () => {
      reloading = true;
      waiting.postMessage({ type: "SKIP_WAITING" });
      window.location.reload();
    };
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

// Binds input + change for select-like controls.
function bindSelectChange(selectEl, handler) {
  if (!selectEl || typeof handler !== "function") return;
  const onChange = () => handler();
  selectEl.addEventListener("input", onChange);
  selectEl.addEventListener("change", onChange);
}

// Attaches all UI event listeners.
function bindUi() {
  langSelect.addEventListener("change", async () => {
    lang = langSelect.value;
    localStorage.setItem("fp_lang", lang);
    await applyTranslations(lang);
    updateOnboardingHintText();
    renderActiveWeekend();
    renderBuildStamp();
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
  if (searchResults) {
    searchResults.addEventListener("click", (e) => {
      const item = e.target.closest(".searchItem");
      if (!item) return;
      const id = item.getAttribute("data-artist-id");
      if (id) scrollToArtist(id);
    });
  }

  bindSelectChange(ratingFilter, () => {
    if (favoritesOnly && ratingFilter.value !== "liked") {
      favoritesOnly = false;
      updateFavoritesToggleUI();
    }
    renderActiveWeekend();
  });

  bindSelectChange(dayFilter, () => {
    const w = state.weekends[state.activeWeekend];
    if (!w.filters) w.filters = { day: "all", stage: "all" };
    w.filters.day = dayFilter.value || "all";
    w.filters.stage = "all";
    renderActiveWeekend();
  });

  bindSelectChange(stageFilter, () => {
    const w = state.weekends[state.activeWeekend];
    if (!w.filters) w.filters = { day: "all", stage: "all" };
    w.filters.stage = stageFilter.value || "all";
    renderActiveWeekend();
  });

  if (exportRatingsBtn) {
    exportRatingsBtn.addEventListener("click", () => exportRatings());
  }
  if (importRatingsInput) {
    importRatingsInput.addEventListener("change", (e) => importRatings(e));
  }
  if (favoritesToggle) {
    favoritesToggle.addEventListener("click", () => setFavoritesOnly(!favoritesOnly));
  }
  if (favoritesToggleAll) {
    favoritesToggleAll.addEventListener("click", () => setFavoritesOnly(false));
  }
  if (favoritesToggleOnly) {
    favoritesToggleOnly.addEventListener("click", () => setFavoritesOnly(true));
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
      const url = withRoot(`/data/${state.festival}/${state.year}/changes/${file}`);
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

  document.addEventListener("click", (e) => {
    const link = e.target.closest(".dayLinkPseudo");
    if (!link) return;
    e.preventDefault();
    e.stopPropagation();
    const url = link.getAttribute("data-url");
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const link = e.target.closest(".dayLinkPseudo");
    if (!link) return;
    e.preventDefault();
    e.stopPropagation();
    const url = link.getAttribute("data-url");
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  });

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
  }, { passive: true });

  document.addEventListener("pointerup", (e) => {
    const btn = e.target.closest(".playBtn");
    if (!btn) return;
    clearPlayPress(btn);
  }, { passive: true });

  document.addEventListener("pointercancel", (e) => {
    const btn = e.target.closest(".playBtn");
    if (!btn) return;
    clearPlayPress(btn);
  }, { passive: true });

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
  const getViewportWidth = () => {
    const vv = window.visualViewport?.width;
    const w = typeof vv === "number" ? vv : window.innerWidth;
    return typeof w === "number" ? w : 0;
  };

  const applyPlacement = () => {
    if (getViewportWidth() <= 980) {
      const anchorParent = mobileExportAnchor.parentNode;
      if (plannerExportBox.parentNode !== anchorParent) {
        const next = mobileExportAnchor.nextSibling;
        if (next) {
          anchorParent.insertBefore(plannerExportBox, next);
        } else {
          anchorParent.appendChild(plannerExportBox);
        }
      }
      mobileExportAnchor.style.minHeight = "0px";
      return;
    }
    mobileExportAnchor.style.minHeight = "";
    if (plannerExportBox.parentNode !== originalParent) {
      if (originalNext && originalNext.parentNode === originalParent) {
        originalParent.insertBefore(plannerExportBox, originalNext);
      } else {
        originalParent.appendChild(plannerExportBox);
      }
    }
  };

  applyPlacement();
  const onResize = () => applyPlacement();
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", applyPlacement);
  } else if (typeof mq.addListener === "function") {
    mq.addListener(applyPlacement);
  }
  window.addEventListener("resize", onResize, { passive: true });
  if (window.visualViewport?.addEventListener) {
    window.visualViewport.addEventListener("resize", onResize, { passive: true });
  }
}
