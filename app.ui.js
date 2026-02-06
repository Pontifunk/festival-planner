// ====== RENDER ======
function renderActiveWeekend() {
  if (favoritesOnly && ratingFilter?.value && ratingFilter.value !== "liked") {
    favoritesOnly = false;
    updateFavoritesToggleUI();
  }
  updateFiltersUI(state.activeWeekend);
  renderWeekend(state.activeWeekend);
  updateInlineFavoritesToggleUI();
  updateRatingsProgress();
  renderFavorites();
  updateSearchResults();
  renderActiveFilters();
  renderStatusPills();
  renderWeekendChangesBox();
}

const renderTokens = { W1: 0, W2: 0 };
const renderPending = { W1: false, W2: false };

const SKELETON_ROWS = 8;

function countRatings(slots) {
  const counts = { liked: 0, maybe: 0, disliked: 0, unrated: 0, total: 0 };
  if (!Array.isArray(slots)) return counts;
  slots.forEach((slot) => {
    const id = slot?.artistId || "";
    const rating = ratings[id] || "unrated";
    if (rating === "liked" || rating === "maybe" || rating === "disliked" || rating === "unrated") {
      counts[rating] += 1;
    } else {
      counts.unrated += 1;
    }
    counts.total += 1;
  });
  return counts;
}

function renderRatingBreakdown(counts) {
  if (!counts || !counts.total) return "";
  const labels = getRatingStateLabels();
  const title = `${labels.liked}: ${counts.liked} · ${labels.maybe}: ${counts.maybe} · ${labels.disliked}: ${counts.disliked} · ${labels.unrated}: ${counts.unrated}`;
  return `
    <span class="ratingBreakdown" title="${escapeAttr(title)}">
      <span class="ratingBreakdownItem" aria-label="${escapeAttr(labels.liked)}"><span class="ratingBreakdownIcon" aria-hidden="true">${getRatingIcon("liked")}</span><span class="ratingBreakdownCount">${counts.liked}</span></span>
      <span class="ratingBreakdownItem" aria-label="${escapeAttr(labels.maybe)}"><span class="ratingBreakdownIcon" aria-hidden="true">${getRatingIcon("maybe")}</span><span class="ratingBreakdownCount">${counts.maybe}</span></span>
      <span class="ratingBreakdownItem" aria-label="${escapeAttr(labels.disliked)}"><span class="ratingBreakdownIcon" aria-hidden="true">${getRatingIcon("disliked")}</span><span class="ratingBreakdownCount">${counts.disliked}</span></span>
      <span class="ratingBreakdownItem" aria-label="${escapeAttr(labels.unrated)}"><span class="ratingBreakdownIcon" aria-hidden="true">${getRatingIcon("unrated")}</span><span class="ratingBreakdownCount">${counts.unrated}</span></span>
    </span>
  `;
}

function renderSkeletonList(count = SKELETON_ROWS) {
  const rows = Array.from({ length: count }, () => `
    <div class="act skeleton" aria-hidden="true">
      <div class="skeletonMain">
        <div class="skeletonLine skeletonTitle"></div>
        <div class="skeletonLine skeletonMeta"></div>
      </div>
      <div class="badges skeletonBadges">
        <div class="skeletonPill"></div>
        <div class="skeletonPill"></div>
      </div>
    </div>
  `).join("");
  return rows;
}

// Builds the day/stage list for a weekend and injects HTML.
function renderWeekend(weekend) {
  const w = state.weekends[weekend];
  const container = weekend === "W1" ? actsListW1 : actsListW2;
  if (!container) return;

  if (w.error) {
    container.innerHTML = `<div class="muted">${escapeHtml(w.error)}</div>`;
    container.classList.remove("isSkeleton");
    container.setAttribute("aria-busy", "false");
    renderPending[weekend] = false;
    return;
  }

  if (!w.snapshot || !Array.isArray(w.snapshot.slots)) {
    container.setAttribute("aria-busy", "true");
    container.classList.add("isSkeleton");
    container.innerHTML = renderSkeletonList();
    renderPending[weekend] = false;
    return;
  }

  const activeFilters = w.filters || { day: "all", stage: "all" };
  const ratingValue = favoritesOnly ? "liked" : ratingFilter.value;
  const prevOpen = container ? getOpenState(container) : null;
  const grouped = groupSlots(w.snapshot.slots, ratingValue, activeFilters);
  const openState = resolveOpenState(grouped, prevOpen, activeFilters);
  w.grouped = grouped;
  w.artistSlots = buildArtistSlotMap(w.snapshot.slots);
  w.artistSlugMap = buildArtistSlugMap(w.snapshot.slots);
  const dayList = Array.from(new Set(w.snapshot.slots.map(s => s.date || extractDate(s.start) || (t("unknown") || "Unknown")))).sort();
  updateMenuDayLinks(dayList);
  w.artistFirstEl = new Map();
  renderPending[weekend] = true;
  const token = ++renderTokens[weekend];

  bindSlotInteractions(container, weekend);

  const isMobile = window.matchMedia("(max-width: 720px)").matches;
  const targetSlotsPerFrame = isMobile ? 40 : 80;
  let index = 0;
  let cleared = false;

  const reserveSkeletonHeight = () => {
    if (!container.classList.contains("isSkeleton")) return;
    const h = Math.ceil(container.getBoundingClientRect().height);
    if (h) container.style.minHeight = `${h}px`;
  };

  const clearForRender = () => {
    if (cleared) return;
    reserveSkeletonHeight();
    container.classList.remove("isSkeleton");
    container.innerHTML = "";
    container.setAttribute("aria-busy", "true");
    cleared = true;
  };

  const renderChunk = () => {
    if (renderTokens[weekend] !== token) return;
    clearForRender();
    if (index >= grouped.length) {
      container.setAttribute("aria-busy", "false");
      container.style.minHeight = "";
      renderPending[weekend] = false;
      runIdle(() => {
        if (renderTokens[weekend] !== token) return;
        indexArtistElements(container, weekend);
      });
      return;
    }

    let slotsCount = 0;
    const start = index;
    while (index < grouped.length) {
      const group = grouped[index];
      const groupSlots = group.stages.reduce((sum, stage) => sum + stage.slots.length, 0);
      if (index > start && slotsCount + groupSlots > targetSlotsPerFrame) break;
      slotsCount += groupSlots;
      index += 1;
      if (slotsCount >= targetSlotsPerFrame) break;
    }

    const slice = grouped.slice(start, index);
    const html = slice.map(group => renderDayGroup(group, weekend, openState)).join("");
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const frag = document.createDocumentFragment();
    while (temp.firstChild) frag.appendChild(temp.firstChild);
    container.appendChild(frag);
    requestAnimationFrame(renderChunk);
  };

  requestAnimationFrame(renderChunk);
}

// Renders a day group with stage accordions.
function renderDayGroup(group, weekend, openState) {
  const dateLabel = formatDate(group.date);
  const dayUrl = `https://belgium.tomorrowland.com/nl/line-up/?day=${group.date}`;
  const dayCount = group.stages.reduce((sum, stage) => sum + stage.slots.length, 0);
  const dayOpen = openState?.openDays?.has(group.date);
  const dayCounts = countRatings(group.stages.flatMap(stage => stage.slots));

  const stagesHtml = group.stages.map(stageGroup => {
    const stageCount = stageGroup.slots.length;
    const stageKey = stageGroup.stage;
    const stageOpen = openState?.openStages?.get(group.date)?.has(stageKey);
    const genre = getStageGenre(stageGroup.stage);
    const stageCounts = countRatings(stageGroup.slots);
    const slotsHtml = stageGroup.slots.map(slot => renderSlot(slot, weekend)).join("");
    return `
      <details class="stageGroup" data-day="${escapeAttr(group.date)}" data-stage="${escapeAttr(stageKey)}" ${stageOpen ? "open" : ""}>
        <summary class="stageSummary">
          <div class="stageSummaryMain">
            <span class="stageTitle">${escapeHtml(stageGroup.stage)}</span>
            ${genre ? `<span class="stageGenre">${escapeHtml(genre)}</span>` : ""}
          </div>
          <div class="daySummaryMeta">
            ${renderRatingBreakdown(stageCounts)}
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
          <span class="dayLinkPseudo" role="link" tabindex="0" data-url="${escapeAttr(dayUrl)}">${escapeHtml(t("lineup"))}</span>
        </div>
        <div class="daySummaryMeta">
          ${renderRatingBreakdown(dayCounts)}
          <span class="dayCount">(${dayCount})</span>
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
  const name = slot.artist || (t("unknown_artist") || "Unknown artist");
  const artistUrl = getArtistPageUrl(weekend, artistId);
  const stage = normalizeStage(slot.stage);
  const start = formatTime(slot.start);
  const end = formatTime(slot.end);
  const timeRange = start && end ? `${start}\u2013${end}` : (start || end || notAvailable());

  const r = ratings[artistId] || "unrated";
  // Inline rating controls reuse the shared rating labels for a11y/tooltips.
  const ratingLabels = getRatingActionLabels();
  const badge = badgeFor(r);
  const resetLabel = ratingLabels.unrated;

  const slotId = slot.slotId ? `slot-${weekend}-${slot.slotId}` : `slot-${weekend}-${hashMini(name + stage + timeRange)}`;

  return `
    <div class="act slot" id="${escapeAttr(slotId)}" data-artist-id="${escapeAttr(artistId)}">
      <div>
        <div class="actName">
          ${artistUrl
            ? `<a class="actNameLink" href="${escapeAttr(artistUrl)}">${escapeHtml(name)}</a>`
            : `${escapeHtml(name)}`}
        </div>
        <div class="actMeta">${escapeHtml(timeRange)} \u00b7 ${escapeHtml(stage)}</div>
      </div>

      <div class="badges">
        <div class="badge ${escapeAttr(badge.cls)}">${escapeHtml(badge.text)}</div>
        <div class="ratingSegmented" data-id="${escapeAttr(artistId)}" role="group" aria-label="${escapeAttr(t("rating_label") || "Rating")}">
          <button class="ratingSegBtn ${r === "liked" ? "isActive" : ""}" data-rate="liked" type="button" aria-pressed="${r === "liked" ? "true" : "false"}" title="${escapeAttr(ratingLabels.liked)}" aria-label="${escapeAttr(ratingLabels.liked)}">
            <span class="ratingEmoji" aria-hidden="true">${getRatingIcon("liked")}</span>
            <span class="segLabel">${escapeHtml(ratingLabels.liked)}</span>
          </button>
          <button class="ratingSegBtn ${r === "maybe" ? "isActive" : ""}" data-rate="maybe" type="button" aria-pressed="${r === "maybe" ? "true" : "false"}" title="${escapeAttr(ratingLabels.maybe)}" aria-label="${escapeAttr(ratingLabels.maybe)}">
            <span class="ratingEmoji" aria-hidden="true">${getRatingIcon("maybe")}</span>
            <span class="segLabel">${escapeHtml(ratingLabels.maybe)}</span>
          </button>
          <button class="ratingSegBtn ${r === "disliked" ? "isActive" : ""}" data-rate="disliked" type="button" aria-pressed="${r === "disliked" ? "true" : "false"}" title="${escapeAttr(ratingLabels.disliked)}" aria-label="${escapeAttr(ratingLabels.disliked)}">
            <span class="ratingEmoji" aria-hidden="true">${getRatingIcon("disliked")}</span>
            <span class="segLabel">${escapeHtml(ratingLabels.disliked)}</span>
          </button>
          <button class="ratingSegBtn ${r === "unrated" ? "isActive" : ""}" data-rate="unrated" type="button" aria-pressed="${r === "unrated" ? "true" : "false"}" title="${escapeAttr(ratingLabels.unrated)}" aria-label="${escapeAttr(ratingLabels.unrated)}">
            <span class="ratingEmoji" aria-hidden="true">${getRatingIcon("unrated")}</span>
            <span class="segLabel">${escapeHtml(resetLabel)}</span>
          </button>
        </div>

        <div class="playRow">
          <button class="playBtn" type="button" data-artist="${escapeAttr(name)}" aria-label="${escapeAttr(formatTemplate(t("play_open_links") || "Open play links for {name}", { name }))}">
            <span class="playIcon" aria-hidden="true">▶</span>
            <span class="playText">${escapeHtml(t("play") || "Play")}</span>
          </button>
          <button class="playMoreBtn" type="button" data-artist="${escapeAttr(name)}" aria-label="${escapeAttr(formatTemplate(t("play_choose_platform") || "Choose platform for {name}", { name }))}">
            <span class="playMoreIcon" aria-hidden="true">⋯</span>
          </button>
        </div>

        
      </div>
    </div>
  `;
}

function getArtistPageUrl(weekend, artistId) {
  if (!artistId) return "";
  const w = state.weekends[weekend];
  const slug = w?.artistSlugMap?.get(artistId);
  if (!slug) return "";
  const wk = String(weekend || "").toLowerCase();
  return `${BASE_PREFIX}/${state.festival}/${state.year}/${wk}/artists/${slug}/`;
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
          <button class="playBtn" type="button" data-artist="${escapeAttr(name)}" aria-label="${escapeAttr(formatTemplate(t("play_open_links") || "Open play links for {name}", { name }))}">
            <span class="playIcon" aria-hidden="true">▶</span>
            <span class="playText">${escapeHtml(t("play") || "Play")}</span>
          </button>
          <button class="playMoreBtn" type="button" data-artist="${escapeAttr(name)}" aria-label="${escapeAttr(formatTemplate(t("play_choose_platform") || "Choose platform for {name}", { name }))}">
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
  favoritesToggle.setAttribute("aria-label", favoritesToggle.textContent);
  updateFavoritesToggleUI();
}

// Syncs favorites-only toggle UI state.
function updateFavoritesToggleUI() {
  if (!favoritesToggle) return;
  favoritesToggle.classList.toggle("isActive", favoritesOnly);
  favoritesToggle.setAttribute("aria-pressed", favoritesOnly ? "true" : "false");
}

// Syncs inline favorites toggle state.
function updateInlineFavoritesToggleUI() {
  if (!favoritesToggleAll || !favoritesToggleOnly) return;
  favoritesToggleAll.classList.toggle("isActive", !favoritesOnly);
  favoritesToggleOnly.classList.toggle("isActive", favoritesOnly);
  favoritesToggleAll.setAttribute("aria-pressed", favoritesOnly ? "false" : "true");
  favoritesToggleOnly.setAttribute("aria-pressed", favoritesOnly ? "true" : "false");
}

// Updates the rating progress line near the inline favorites toggle.
function updateRatingsProgress() {
  if (!ratingProgress) return;
  const w = state.weekends[state.activeWeekend];
  const total = w?.artistSlots?.size || 0;
  if (!total) {
    ratingProgress.textContent = "";
    ratingProgress.hidden = true;
    return;
  }
  let rated = 0;
  w.artistSlots.forEach((_, artistId) => {
    if (ratings[artistId] && ratings[artistId] !== "unrated") rated += 1;
  });
  const template = t("rating_progress") || "You have rated {rated}/{total} artists.";
  ratingProgress.textContent = template
    .replace("{rated}", String(rated))
    .replace("{total}", String(total));
  ratingProgress.hidden = false;
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
  updateInlineFavoritesToggleUI();
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
  menuSheet.removeAttribute("inert");
  document.body.classList.add("menuOpen");
  document.body.style.top = `-${menuScrollY}px`;
}

// Closes the mobile menu and restores scroll.
function closeMenu(restoreScroll = true) {
  if (!menuSheet || !menuOverlay || !menuBtn) return;
  // Move focus out of the menu before hiding it (avoids aria-hidden focus warning).
  if (menuSheet.contains(document.activeElement)) {
    menuBtn.focus();
  }
  menuOpen = false;
  menuSheet.classList.remove("isOpen");
  menuOverlay.hidden = true;
  menuBtn.setAttribute("aria-expanded", "false");
  menuSheet.setAttribute("aria-hidden", "true");
  menuSheet.setAttribute("inert", "");
  document.body.classList.remove("menuOpen");
  const bodyTop = parseFloat(document.body.style.top || "0");
  document.body.style.top = "";
  if (restoreScroll) {
    const restoreY = menuScrollY || Math.abs(bodyTop || 0);
    if (restoreY) window.scrollTo(0, restoreY);
  }
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
  const debugMenu = (() => {
    try {
      return new URLSearchParams(window.location.search || "").get("debugMenu") === "1";
    } catch {
      return false;
    }
  })();
  if (debugMenu) {
    console.info("[menu] click", { action, target, text: item?.textContent?.trim(), menuScrollY, bodyTop: document.body.style.top || "" });
  }
  if (action === "weekend") {
    const weekend = item.getAttribute("data-weekend");
    if (weekend) setActiveWeekend(weekend, true);
    const id = weekend === "W2" ? "#w2Section" : "#w1Section";
    postClose = () => scrollToTarget(id);
  } else if (action === "setDay") {
    const day = item.getAttribute("data-day");
    const w = state.weekends[state.activeWeekend];
    if (day && w) {
      w.filters.day = day;
      if (dayFilter) {
        dayFilter.value = day;
        syncCustomSelect(dayFilter);
      }
      updateFiltersUI(state.activeWeekend);
      renderActiveWeekend();
      postClose = () => scrollToTarget(`#day-${day}`);
    }
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
  // Close menu without restoring scroll, then run the target scroll.
  closeMenu(true);
  if (postClose) {
    setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => postClose());
      });
    }, 0);
  }
}

// Scrolls smoothly to the given selector.
function scrollToTarget(selector) {
  if (!selector) return;
  const debugMenu = (() => {
    try {
      return new URLSearchParams(window.location.search || "").get("debugMenu") === "1";
    } catch {
      return false;
    }
  })();
  if (selector === "#top") {
    if (debugMenu) console.info("[menu] scroll top");
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => {
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    }, 120);
    return;
  }
  const el = document.querySelector(selector);
  if (!el) {
    if (debugMenu) console.warn("[menu] target not found", selector);
    return;
  }
  const topbarHeight = topbar ? topbar.getBoundingClientRect().height : 0;
  if (debugMenu) console.info("[menu] scroll", { selector, topbarHeight, scrollY: window.scrollY });
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  const offset = Math.ceil(topbarHeight) + 8;
  setTimeout(() => {
    window.scrollBy(0, -offset);
  }, 80);
  setTimeout(() => {
    const targetY = Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset);
    if (Math.abs(window.scrollY - targetY) > 4) window.scrollTo(0, targetY);
  }, 180);
}

// Populates menu day links for quick navigation.
function updateMenuDayLinks(dates) {
  if (!menuDayLinks) return;
  if (!dates || !dates.length) {
    menuDayLinks.innerHTML = `<div class="menuEmpty">${escapeHtml(t("no_days") || "No days")}</div>`;
    return;
  }
  menuDayLinks.innerHTML = dates.map((d) => {
    const label = formatDate(d);
    const target = `#day-${d}`;
    return `<button class="menuItem isSub" data-action="setDay" data-day="${escapeAttr(d)}" data-target="${escapeAttr(target)}" type="button">${escapeHtml(label)}</button>`;
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
  const url = withRoot(`/data/${state.festival}/${state.year}/snapshots/${file}`);
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
  WEEKENDS.forEach((wk) => {
    const wkRatings = state.ratingsByWeekend?.[wk] || {};
    Object.keys(wkRatings).forEach((artistId) => {
      const rate = String(wkRatings[artistId] || "").toLowerCase();
      if (!VALID_RATINGS.has(rate) || rate === "unrated") return;
      if (!artists[artistId]) {
        const name = state.artists.byId.get(artistId)?.name || "";
        artists[artistId] = {
          name,
          ratings: {},
          tags: [],
          updatedAt: createdAt
        };
      }
      artists[artistId].ratings[wk] = rate;
    });
  });
  Object.keys(artists).forEach((artistId) => {
    artists[artistId].weekends = Object.keys(artists[artistId].ratings || {});
  });

  const payload = {
    app: "festival-planner",
    exportVersion: 4,
    createdAt,
    event: { festival: state.festival, year: state.year },
    weekends: Array.from(WEEKENDS),
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

    const incomingByWeekend = {};
    WEEKENDS.forEach((wk) => { incomingByWeekend[wk] = {}; });

    if (data?.artists && typeof data.artists === "object") {
      Object.keys(data.artists).forEach((artistId) => {
        const entry = data.artists[artistId] || {};
        const ratingsMap = entry?.ratings && typeof entry.ratings === "object" ? entry.ratings : null;
        if (ratingsMap) {
          Object.keys(ratingsMap).forEach((wk) => {
            const normalized = normalizeWeekend(wk);
            if (!normalized) return;
            const rate = String(ratingsMap[wk] || "").toLowerCase();
            if (VALID_RATINGS.has(rate)) incomingByWeekend[normalized][artistId] = rate;
          });
          return;
        }
        const rate = entry?.rating ? String(entry.rating).toLowerCase() : "";
        if (!VALID_RATINGS.has(rate)) return;
        const wkList = Array.isArray(entry?.weekends) ? entry.weekends : WEEKENDS;
        wkList.forEach((wk) => {
          const normalized = normalizeWeekend(wk);
          if (!normalized) return;
          incomingByWeekend[normalized][artistId] = rate;
        });
      });
      const provider = data?.settings?.playProvider;
      if (provider && ["sp", "am", "yt", "sc"].includes(provider)) {
        setPlayProvider(provider);
      }
      incoming = incomingByWeekend;
    } else if (data?.ratings && typeof data.ratings === "object") {
      WEEKENDS.forEach((wk) => { incomingByWeekend[wk] = data.ratings; });
      incoming = incomingByWeekend;
    }

    if (!incoming || typeof incoming !== "object") {
      throw new Error("Invalid ratings file");
    }

    if (!state.ratingsByWeekend) state.ratingsByWeekend = {};
    const persistOps = [];
    WEEKENDS.forEach((wk) => {
      const wkIncoming = incoming?.[wk];
      if (!wkIncoming || typeof wkIncoming !== "object") return;
      const filtered = {};
      Object.keys(wkIncoming).forEach((id) => {
        const rate = String(wkIncoming[id] || "").toLowerCase();
        if (VALID_RATINGS.has(rate)) filtered[id] = rate;
      });

      const existing = state.ratingsByWeekend[wk] || {};
      const merged = { ...existing };
      Object.keys(filtered).forEach((id) => {
        const rate = filtered[id];
        merged[id] = rate || "unrated";
      });
      state.ratingsByWeekend[wk] = merged;
      if (state.activeWeekend === wk) ratings = merged;

      Object.keys(filtered).forEach((id) => {
        const rate = filtered[id] || "unrated";
        persistOps.push(dbPut(makeDbKey(state, wk, id), rate));
      });
    });
    if (persistOps.length) await Promise.all(persistOps);

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
  const createdAt = w.snapshot?.meta?.createdAt || "";
  const hasCreatedAt = Number.isFinite(Date.parse(createdAt));
  const checkedUrl = w.lastCheckedUrl || "";

  if (lastCheckedRow && lastCheckedPill) {
    if (hasCreatedAt) {
      // Include the exact URL that was checked to make data provenance explicit.
      const checkedText = formatDateTime(createdAt);
      if (checkedUrl) {
        const safeUrl = escapeAttr(checkedUrl);
        lastCheckedPill.innerHTML = `${escapeHtml(checkedText)} \u00b7 <a class="pillLink" href="${safeUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(checkedUrl)}</a>`;
      } else {
        lastCheckedPill.textContent = checkedText;
      }
      lastCheckedRow.hidden = false;
    } else {
      lastCheckedPill.textContent = "";
      lastCheckedRow.hidden = true;
    }
  }

  if (lastUpdatedRow && lastUpdatedPill) {
    const select = snapshotSelectForWeekend(state.activeWeekend);
    const labelRaw = select ? getSelectLabel(select, w.selectedFile) : (w.selectedFile || "");
    const label = String(labelRaw || "").trim();
    if (label) {
      const createdLabel = hasCreatedAt ? formatDateTime(createdAt) : "";
      const datePart = createdLabel && label !== createdLabel ? ` (${createdLabel})` : "";
      lastUpdatedPill.textContent = `${label}${datePart}`;
      lastUpdatedRow.hidden = false;
    } else {
      lastUpdatedPill.textContent = "";
      lastUpdatedRow.hidden = true;
    }
  }
}

function renderBuildStamp() {
  if (!buildStamp) return;
  const label = t("build_label") || "Build";
  buildStamp.textContent = `${label}: ${BUILD_ID}`;
  buildStamp.hidden = !BUILD_ID;
}

function updateArtistIndexLink() {
  if (!artistIndexLink) return;
  const festival = route?.festival || DEFAULT_FESTIVAL;
  const year = route?.year || DEFAULT_YEAR;
  const weekend = String(state.activeWeekend || DEFAULT_WEEKEND).toLowerCase();
  artistIndexLink.href = `${BASE_PREFIX}/${festival}/${year}/${weekend}/artists/`;
}

// Rebuilds day/stage filter options from snapshot data.
function updateFiltersUI(weekend) {
  const w = state.weekends[weekend];
  if (!w?.snapshot?.slots) return;
  if (!dayFilter || !stageFilter) return;
  if (!w.filters) w.filters = { day: "all", stage: "all" };

  const slots = w.snapshot.slots;
  const dates = Array.from(new Set(slots.map(s => s.date || extractDate(s.start) || (t("unknown") || "Unknown")))).sort();

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
    const date = s.date || extractDate(s.start) || (t("unknown") || "Unknown");
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
  const icon = getRatingIcon(value);
  const label = getRatingLabel(value, { kind: value === "unrated" ? "status" : "action" });
  if (icon && label) return `${icon} ${label}`;
  return label || icon || value;
}

// Builds i18n labels for rating actions.
function getRatingActionLabels() {
  const labels = {};
  RATING_STATES.forEach((key) => {
    labels[key] = getRatingLabel(key, { kind: "action" });
  });
  return labels;
}

// Builds labels for rating state summaries (uses status label for unrated).
function getRatingStateLabels() {
  const labels = {};
  RATING_STATES.forEach((key) => {
    labels[key] = getRatingLabel(key, { kind: key === "unrated" ? "status" : "action" });
  });
  return labels;
}

// Looks up a translation with fallback.
function translateOr(key, fallback) {
  if (key && Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
  return fallback;
}

// Adds subtle haptic feedback on supported mobile devices.
function triggerRatingHaptic() {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia && !window.matchMedia("(pointer: coarse)").matches) return;
    navigator.vibrate(10);
  } catch {
    // Fail silently.
  }
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
    const chip = e.target.closest(".ratingSegBtn");
    if (chip && container.contains(chip)) {
      e.preventDefault();
      e.stopPropagation();
      const sel = chip.closest(".ratingSegmented");
      const id = sel?.getAttribute("data-id");
      const rate = chip.getAttribute("data-rate");
      if (id && rate) {
        triggerRatingHaptic();
        await setRating(id, rate);
        if (state.activeWeekend === weekend) renderActiveWeekend();
        showToast(t("saved") || "Gespeichert \u2713");
      }
      return;
    }

    const slotEl = e.target.closest(".slot");
    if (slotEl && container.contains(slotEl)) {
      if (e.target.closest(".ratingSegmented, a, button, input, label")) return;
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
  }).join("") || `<div class="muted" style="padding:8px 10px">${escapeHtml(t("no_results") || "No results.")}</div>`;

  searchResults.hidden = false;
}

// Scrolls to an artist in the active list.
function scrollToArtist(artistId, attempt = 0, opts = {}) {
  const w = state.weekends[state.activeWeekend];
  const el = w.artistFirstEl.get(artistId);
  if (!el) {
    if (renderPending[state.activeWeekend] && attempt < 10) {
      runIdle(() => scrollToArtist(artistId, attempt + 1));
      return;
    }
    if (!opts.suppressError) {
      showError(t("artist_not_found") || "Artist im aktuellen Weekend nicht gefunden.");
    }
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

// Resolves an artistId from a slug or direct id for the active weekend.
function resolveArtistId(param) {
  const w = state.weekends[state.activeWeekend];
  const raw = String(param || "").trim();
  if (!raw || !w) return "";
  if (w.artistFirstEl?.has(raw)) return raw;
  if (!w.artistSlugMap || !w.artistSlots) return "";

  const target = raw.toLowerCase();
  const stripSuffix = (value) => String(value || "").replace(/-[a-f0-9]{6}$/i, "");
  const targetBase = stripSuffix(target);

  for (const [id, slug] of w.artistSlugMap.entries()) {
    const normalized = String(slug || "").toLowerCase();
    if (normalized === target) return id;
  }

  if (targetBase && targetBase !== target) {
    let match = "";
    for (const [id, slug] of w.artistSlugMap.entries()) {
      if (stripSuffix(String(slug || "").toLowerCase()) === targetBase) {
        if (match) return "";
        match = id;
      }
    }
    if (match) return match;
  }

  for (const [id, slots] of w.artistSlots.entries()) {
    const slot = slots[0] || {};
    const nameSlug = slugifyArtist(getArtistName(id, slot));
    if (String(nameSlug || "").toLowerCase() === target) return id;
    if (targetBase && String(nameSlug || "").toLowerCase() === targetBase) return id;
    const normalizedSlug = slugifyArtist(slot.artistNormalized || slot.artist || "");
    if (String(normalizedSlug || "").toLowerCase() === target) return id;
  }

  return "";
}

// Scrolls to a specific slot by slotId in the active weekend.
function scrollToSlotId(slotId) {
  const weekend = state.activeWeekend;
  const w = state.weekends[weekend];
  const slots = w?.snapshot?.slots || [];
  const slot = slots.find(s => s.slotId === slotId);
  if (!slot) {
    showError(t("slot_not_found") || "Slot im aktuellen Weekend nicht gefunden.");
    return;
  }
  clearError();
  const container = weekend === "W1" ? actsListW1 : actsListW2;
  openDetailsForSlot(container, slot);
  const el = document.getElementById(`slot-${weekend}-${slotId}`);
  if (!el) {
    showError(t("act_not_found") || "Act im aktuellen Weekend nicht gefunden.");
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
  const day = slot.date || extractDate(slot.start) || (t("unknown") || "Unknown");
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
  if (!state.ratingsByWeekend) state.ratingsByWeekend = {};
  if (!state.ratingsByWeekend[normalized]) state.ratingsByWeekend[normalized] = {};
  ratings = state.ratingsByWeekend[normalized];

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
    applySeoFromRoute(route);
  }

  const w = state.weekends?.[normalized];
  if (w && !w.snapshot && !w.loading) {
    w.loading = true;
    loadSnapshotForWeekend(normalized)
      .then(() => {
        w.loading = false;
        if (state.activeWeekend === normalized) renderActiveWeekend();
      })
      .catch(() => {
        w.loading = false;
        if (state.activeWeekend === normalized) renderActiveWeekend();
      });
  }

  updateArtistIndexLink();
  renderActiveWeekend();
}

// ====== MUSIC LINKS ======
function isMobileDevice() {
  const ua = navigator.userAgent || "";
  const uaMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  return uaMobile || coarse;
}

function isIOSDevice() {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function isStandaloneMode() {
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
  return !!navigator.standalone;
}

function openWithFallback({ deepUrl, webUrl, fallbackMs = 700, useNewTab = false }) {
  if (!deepUrl || !webUrl) return;
  let timer = null;
  const cleanup = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("blur", onBlur);
  };
  const openWeb = () => {
    cleanup();
    if (useNewTab) openLink(webUrl);
    else window.location.href = webUrl;
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") cleanup();
  };
  const onPageHide = () => cleanup();
  const onBlur = () => {
    if (document.visibilityState === "hidden") cleanup();
  };

  document.addEventListener("visibilitychange", onVisibilityChange, { once: true });
  window.addEventListener("pagehide", onPageHide, { once: true });
  window.addEventListener("blur", onBlur, { once: true });
  timer = setTimeout(openWeb, fallbackMs);
  window.location.href = deepUrl;
}

// Builds the provider links for an artist search.
function buildPlayLinks(name) {
  const { primary, normalized } = normalizeSearchTerm(name);
  const term = primary || normalized || "";
  const encoded = encodeURIComponent(term);
  const youtubeQuery = `${term || ""} Tomorrowland set`.trim();

  return {
    sp: {
      web: `https://open.spotify.com/search/${encoded}`,
      deep: `spotify:search:${encodeURIComponent(term)}`
    },
    am: { web: `https://music.apple.com/search?term=${encoded}` },
    yt: { web: `https://www.youtube.com/results?search_query=${encodeURIComponent(youtubeQuery)}` },
    sc: {
      web: `https://soundcloud.com/search?q=${encoded}`,
      deep: `soundcloud://search?q=${encoded}`
    }
  };
}

// Opens a link in a new tab when possible, with a same-tab fallback for iOS/PWA.
function openLink(url){
  if (!url) return;
  if (isIOSDevice() || isStandaloneMode()) {
    window.location.href = url;
    return;
  }
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) window.location.href = url;
}

const DEFAULT_PLAY_PROVIDER = "sp";
const PLAY_PROVIDER_KEY = "fp_play_provider";
const PLAY_COPY_KEY = "fp_play_copy_name";

function getPlayProvider() {
  return localStorage.getItem(PLAY_PROVIDER_KEY) || DEFAULT_PLAY_PROVIDER;
}

function setPlayProvider(value) {
  if (!value) return;
  localStorage.setItem(PLAY_PROVIDER_KEY, value);
}

function getPlayCopyEnabled() {
  return localStorage.getItem(PLAY_COPY_KEY) === "true";
}

function setPlayCopyEnabled(value) {
  localStorage.setItem(PLAY_COPY_KEY, value ? "true" : "false");
}

let playOverlay = null;
let playOverlayPanel = null;
let playOverlayTitle = null;
let playOverlayLinks = null;
let playOverlayTrigger = null;
let playCopyToggleBtn = null;
let playCopyLabel = null;

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
  const links = buildPlayLinks(name);
  return {
    sp: links.sp.web,
    am: links.am.web,
    yt: links.yt.web,
    sc: links.sc.web
  };
}

async function copyArtistName(name) {
  const text = String(name || "").trim();
  if (!text) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "true");
      el.style.position = "absolute";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    showToast(t("play_copy_toast") || "Name copied");
  } catch {
    // Silently ignore clipboard errors.
  }
}

function openPlayService(provider, name) {
  const links = buildPlayLinks(name);
  const entry = links?.[provider];
  if (!entry || !entry.web) return;
  if (getPlayCopyEnabled()) {
    copyArtistName(name);
  }
  const mobile = isMobileDevice();
  const allowDeepLink = mobile && entry.deep && provider !== "sc";
  if (allowDeepLink) {
    openWithFallback({ deepUrl: entry.deep, webUrl: entry.web, fallbackMs: 700 });
    return;
  }
  openLink(entry.web);
}

function openDefaultPlay(name) {
  const urls = buildPlayUrls(name);
  const provider = getPlayProvider();
  const target = provider && urls[provider] ? provider : "sp";
  openPlayService(target, name);
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
    setBtn.textContent = t("play_set_default") || "Set as default";

    row.append(a, setBtn);
    return { row, link: a, button: setBtn };
  };

  const makeToggleRow = () => {
    const row = document.createElement("div");
    row.className = "playRowItem";

    const label = document.createElement("div");
    label.className = "playLink copy";
    label.textContent = t("play_copy_label") || "Copy DJ name";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "playDefaultBtn";
    toggle.setAttribute("data-action", "toggleCopyName");
    toggle.setAttribute("aria-pressed", "false");
    toggle.textContent = t("play_copy_off") || "Off";

    row.append(label, toggle);
    return { row, label, button: toggle };
  };

  const sp = makeRow("sp", "Spotify");
  const am = makeRow("am", "Apple Music");
  const yt = makeRow("yt", "YouTube");
  const sc = makeRow("sc", "SoundCloud");
  const copyRow = makeToggleRow();

  playOverlayLinks = [sp.link, am.link, yt.link, sc.link];
  playCopyToggleBtn = copyRow.button;
  playCopyLabel = copyRow.label;

  list.append(sp.row, am.row, yt.row, sc.row, copyRow.row);
  playOverlayPanel.append(playOverlayTitle, list);
  playOverlay.append(playOverlayPanel);
  document.body.append(playOverlay);

  playOverlay.addEventListener("click", (e) => {
    if (e.target === playOverlay) closePlayOverlay();
  });

  playOverlayPanel.addEventListener("click", (e) => {
    const link = e.target.closest("a.playLink");
    if (link) {
      const provider = link.getAttribute("data-provider");
      const name = playOverlayTitle?.dataset?.artistName || "";
      const shouldIntercept = isMobileDevice() && provider === "sp";
      if (shouldIntercept || getPlayCopyEnabled()) {
        e.preventDefault();
        openPlayService(provider, name);
      }
      closePlayOverlay();
      return;
    }
    const copyBtn = e.target.closest("button[data-action='toggleCopyName']");
    if (copyBtn) {
      const next = !getPlayCopyEnabled();
      setPlayCopyEnabled(next);
      updatePlayDefaultUI();
      showToast(t("saved") || "Gespeichert ✓");
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

// Moves the controls card for mobile layout changes.
function setupMobileControlsPlacement() {
  if (!controlsCard || !mobileControlsAnchor) return;
  const originalParent = controlsCard.parentNode;
  const originalNext = controlsCard.nextSibling;
  const mq = window.matchMedia("(max-width: 980px)");
  const getViewportWidth = () => {
    const vv = window.visualViewport?.width;
    const w = typeof vv === "number" ? vv : window.innerWidth;
    return typeof w === "number" ? w : 0;
  };

  const applyPlacement = () => {
    if (getViewportWidth() <= 980) {
      const anchorParent = mobileControlsAnchor.parentNode;
      if (controlsCard.parentNode !== anchorParent) {
        const next = mobileControlsAnchor.nextSibling;
        if (next) {
          anchorParent.insertBefore(controlsCard, next);
        } else {
          anchorParent.appendChild(controlsCard);
        }
      }
      mobileControlsAnchor.style.minHeight = "0px";
      return;
    }
    mobileControlsAnchor.style.minHeight = "";
    if (controlsCard.parentNode !== originalParent) {
      if (originalNext && originalNext.parentNode === originalParent) {
        originalParent.insertBefore(controlsCard, originalNext);
      } else {
        originalParent.appendChild(controlsCard);
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

function openPlayOverlay(artist, trigger) {
  ensurePlayOverlay();
  playOverlayTrigger = trigger || null;

  const name = String(artist || "").trim() || (t("artist_generic") || "Artist");
  playOverlayTitle.textContent = formatTemplate(t("play_overlay_title") || "Open {name} in\u2026", { name });
  playOverlayTitle.dataset.artistName = name;

  const urls = buildPlayUrls(name);
  playOverlayLinks[0].href = urls.sp;
  playOverlayLinks[1].href = urls.am;
  playOverlayLinks[2].href = urls.yt;
  playOverlayLinks[3].href = urls.sc;
  if (playCopyLabel) playCopyLabel.textContent = t("play_copy_label") || "Copy DJ name";
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
  playOverlayPanel.querySelectorAll(".playDefaultBtn[data-provider]").forEach((btn) => {
    const key = btn.getAttribute("data-provider");
    const isActive = key === current;
    btn.classList.toggle("isActive", isActive);
    btn.textContent = isActive ? (t("play_default") || "Default") : (t("play_set_default") || "Set as default");
  });
  if (playCopyToggleBtn) {
    const enabled = getPlayCopyEnabled();
    playCopyToggleBtn.classList.toggle("isActive", enabled);
    playCopyToggleBtn.setAttribute("aria-pressed", enabled ? "true" : "false");
    playCopyToggleBtn.textContent = enabled ? (t("play_copy_on") || "On") : (t("play_copy_off") || "Off");
  }
}

// ====== CUSTOM SELECT ======
function initCustomSelect(selectEl) {
  if (!selectEl) return;
  const useNative = window.matchMedia("(max-width: 720px)").matches
    || window.matchMedia("(pointer: coarse)").matches;
  if (useNative) {
    const wrapper = selectEl.parentNode?.querySelector(".selectWrap");
    if (wrapper) wrapper.remove();
    selectEl.dataset.customReady = "native";
    selectEl.classList.remove("isHidden");
    selectEl.removeAttribute("aria-hidden");
    selectEl.tabIndex = 0;
    return;
  }
  if (selectEl.dataset.customReady === "true") return;
  selectEl.dataset.customReady = "true";
  selectEl.classList.add("isHidden");
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
  const ariaLabel = selectEl.getAttribute("aria-label");
  const ariaLabelledby = selectEl.getAttribute("aria-labelledby");
  if (ariaLabel) trigger.setAttribute("aria-label", ariaLabel);
  if (ariaLabelledby) trigger.setAttribute("aria-labelledby", ariaLabelledby);

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
  const ariaLabel = selectEl.getAttribute("aria-label");
  const ariaLabelledby = selectEl.getAttribute("aria-labelledby");
  if (ariaLabel) {
    trigger.setAttribute("aria-label", ariaLabel);
  } else {
    trigger.removeAttribute("aria-label");
  }
  if (ariaLabelledby) {
    trigger.setAttribute("aria-labelledby", ariaLabelledby);
  } else {
    trigger.removeAttribute("aria-labelledby");
  }
}

// Rebuilds the custom select after options change.
function rebuildCustomSelect(selectEl) {
  if (!selectEl) return;
  if (selectEl.dataset.customReady === "native") {
    initCustomSelect(selectEl);
    return;
  }
  const wrapper = selectEl?.parentNode?.querySelector(".selectWrap");
  if (!wrapper) {
    selectEl.dataset.customReady = "";
    initCustomSelect(selectEl);
    return;
  }
  const bound = customSelectMap.get(selectEl);
  const list = bound?.list || wrapper.querySelector(".selectList");
  if (!list) {
    selectEl.dataset.customReady = "";
    initCustomSelect(selectEl);
    return;
  }
  list.innerHTML = "";
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
  syncCustomSelect(selectEl);
}

// Falls back to the native select if needed.
function ensureSelectVisible(selectEl) {
  if (!selectEl) return;
  if (selectEl.dataset.customReady === "native") return;
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


