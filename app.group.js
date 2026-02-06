// ====== GROUP MERGE (LEAN) ======
(function () {
  const dropzone = document.getElementById("groupDropzone");
  if (!dropzone) return;

  const fileInput = document.getElementById("groupFileInput");
  const selectBtn = document.getElementById("groupSelectBtn");
  const fileList = document.getElementById("groupFileList");
  const analyzeBtn = document.getElementById("groupAnalyzeBtn");
  const exportBtn = document.getElementById("groupExportBtn");
  const proceedBtn = document.getElementById("groupProceedBtn");
  const limitNote = document.getElementById("groupLimitNote");
  const limitText = document.getElementById("groupLimitText");
  const includeMismatchToggle = document.getElementById("includeMismatchToggle");
  const statusNote = document.getElementById("groupStatusNote");
  const resultsWrap = document.getElementById("groupResults");
  const resultsMeta = document.getElementById("groupResultsMeta");
  const topPicksBody = document.getElementById("groupTopPicksBody");
  const conflictsBody = document.getElementById("groupConflictsBody");
  const filterInput = document.getElementById("groupFilterInput");
  const backLink = document.getElementById("groupBackLink");
  const contextEl = document.getElementById("groupContext");

  const MAX_SOFT = 20;
  const MAX_HARD = 30;

  const state = {
    files: [],
    allowOverLimit: false,
    results: null,
    filter: ""
  };

  const reference = {
    names: new Map(),
    meta: new Map(),
    when: new Map(),
    stage: new Map(),
    canonical: new Map(),
    snapshot: null
  };

  const expected = getExpectedContext();
  if (state) {
    state.festival = expected.festival || state.festival;
    state.year = expected.year || state.year;
    state.activeWeekend = expected.weekend || state.activeWeekend;
  }
  updateContextUI();
  setupLang();
  loadReferenceData();

  if (selectBtn && fileInput) {
    selectBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      handleIncomingFiles(files);
      e.target.value = "";
    });
  }

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("isDragOver");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("isDragOver"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("isDragOver");
    const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
    handleIncomingFiles(files);
  });
  dropzone.addEventListener("click", (e) => {
    if (e.target === selectBtn || e.target.closest("#groupSelectBtn")) return;
    if (e.target.closest("button, input, a, label")) return;
    fileInput?.click();
  });
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput?.click();
    }
  });

  if (fileList) {
    fileList.addEventListener("input", (e) => {
      const input = e.target.closest("input[data-id]");
      if (!input) return;
      const id = input.getAttribute("data-id");
      const entry = state.files.find((f) => f.id === id);
      if (!entry) return;
      entry.name = String(input.value || "").trim();
      updateFileRowStatus(id);
      updateAnalyzeState();
    });
    fileList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action='removeFile']");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      state.files = state.files.filter((f) => f.id !== id);
      clearResults();
      if (state.files.length <= MAX_SOFT) state.allowOverLimit = false;
      renderFileList();
      updateLimitNotice();
      updateAnalyzeState();
    });
  }

  if (includeMismatchToggle) {
    includeMismatchToggle.addEventListener("change", () => {
      clearResults();
      updateAnalyzeState();
    });
  }

  if (proceedBtn) {
    proceedBtn.addEventListener("click", () => {
      state.allowOverLimit = true;
      updateLimitNotice();
      updateAnalyzeState();
    });
  }

  if (analyzeBtn) {
    analyzeBtn.addEventListener("click", () => runAnalysis());
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", () => exportGroupResults());
  }

  if (filterInput) {
    filterInput.addEventListener("input", () => {
      state.filter = String(filterInput.value || "").trim().toLowerCase();
      if (state.results) renderResults();
    });
  }

  function handleIncomingFiles(files) {
    clearStatusNote();
    if (!files.length) return;
    clearResults();

    let nonJson = 0;
    let skippedHard = 0;
    const remainingSlots = Math.max(0, MAX_HARD - state.files.length);
    const accepted = [];

    files.forEach((file) => {
      if (!isJsonFile(file)) {
        nonJson += 1;
        return;
      }
      if (accepted.length >= remainingSlots) {
        skippedHard += 1;
        return;
      }
      accepted.push(file);
    });

    if (nonJson) {
      showStatusNote(t("group_only_json") || "Only .json files are supported.");
    }
    if (skippedHard) {
      showStatusNote(t("group_hard_limit") || "Hard limit reached. Max 30 files.");
    }

    if (!accepted.length) {
      updateAnalyzeState();
      return;
    }

    accepted.forEach((file) => {
      const entry = {
        id: `file-${hashMini(file.name + file.size + Date.now())}`,
        file,
        name: "",
        status: "pending",
        error: "",
        mismatch: false,
        meta: {},
        ratings: new Map(),
        names: new Map()
      };
      state.files.push(entry);
      parseEntry(entry);
    });

    renderFileList();
    updateLimitNotice();
    updateAnalyzeState();
  }

  async function parseEntry(entry) {
    try {
      const text = await entry.file.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        entry.status = "invalid";
        entry.error = t("group_error_parse") || "Could not parse JSON.";
        renderFileList();
        updateAnalyzeState();
        return;
      }

      const parsed = parseExportData(data, expected.weekend);
      if (!parsed) {
        entry.status = "invalid";
        entry.error = t("group_error_invalid") || "Invalid export format.";
        renderFileList();
        updateAnalyzeState();
        return;
      }

      entry.meta = parsed.meta || {};
      entry.ratings = parsed.ratings || new Map();
      entry.names = parsed.names || new Map();

      const mismatchInfo = getMismatchInfo(entry.meta, expected, parsed.weekendSupport);
      entry.mismatch = mismatchInfo.mismatch;
      entry.error = mismatchInfo.message || "";
      entry.status = entry.mismatch ? "mismatch" : "ok";
    } catch {
      entry.status = "invalid";
      entry.error = t("group_error_invalid") || "Invalid export format.";
    }

    renderFileList();
    updateAnalyzeState();
  }

  function parseExportData(data, targetWeekend) {
    if (!data || typeof data !== "object") return null;

    const meta = {};
    meta.festival = cleanSegment(data?.event?.festival || data?.festival || data?.event?.key || "", /^[a-z0-9-]+$/i, "");
    meta.year = cleanSegment(data?.event?.year || data?.year || "", /^\d{4}$/, "");
    const weekendRaw = data?.event?.weekend || data?.weekend || "";
    const weekend = normalizeWeekend(weekendRaw || "");
    const weekends = Array.isArray(data?.weekends) ? data.weekends.map((w) => normalizeWeekend(w)).filter(Boolean) : [];
    meta.weekend = weekend || (weekends.length === 1 ? weekends[0] : "");
    meta.weekends = weekends;
    meta.snapshotId = data?.snapshotId || data?.snapshot?.id || data?.snapshot?.snapshotId || "";
    meta.exportVersion = data?.exportVersion || data?.version || "";
    meta.artistKey = data?.schema?.artistKey || data?.schema?.artist_key || "artistId";

    const ratings = new Map();
    const names = new Map();

    const weekendSupport = new Set(weekends.filter(Boolean));
    if (meta.weekend) weekendSupport.add(meta.weekend);

    const target = normalizeWeekend(targetWeekend || "");

    if (data?.artists && typeof data.artists === "object") {
      Object.keys(data.artists).forEach((id) => {
        const entry = data.artists[id] || {};
        const name = String(entry?.name || entry?.artist || entry?.title || entry?.label || "").trim();
        if (name && !names.has(id)) names.set(id, name);
        const extraKeys = [
          entry?.artistId,
          entry?.artistSlug,
          entry?.slug,
          entry?.artistNormalized,
          entry?.nameNormalized
        ].filter(Boolean);
        extraKeys.forEach((key) => {
          const normalizedKey = String(key).trim();
          if (name && normalizedKey && !names.has(normalizedKey)) names.set(normalizedKey, name);
        });

        let ratingValue = null;
        if (entry?.ratings && typeof entry.ratings === "object") {
          const direct = entry.ratings[target] ?? entry.ratings[target?.toLowerCase?.()] ?? entry.ratings[target?.toUpperCase?.()];
          if (direct !== undefined) ratingValue = direct;
        }

        if (ratingValue === null || ratingValue === undefined) {
          if (entry?.rating !== undefined) ratingValue = entry.rating;
          if (entry?.rate !== undefined) ratingValue = entry.rate;
        }

        if (Array.isArray(entry?.weekends) && entry.weekends.length) {
          const supported = entry.weekends.map((w) => normalizeWeekend(w)).filter(Boolean);
          const includesTarget = supported.includes(target) || !target;
          if (!includesTarget) ratingValue = null;
          supported.forEach((wk) => weekendSupport.add(wk));
        }

        const normalized = normalizeRating(ratingValue);
        if (normalized && normalized !== "unrated") {
          ratings.set(id, normalized);
        }
      });
      return { meta, ratings, names, weekendSupport };
    }

    if (data?.ratings && typeof data.ratings === "object") {
      Object.keys(data.ratings).forEach((id) => {
        const normalized = normalizeRating(data.ratings[id]);
        if (normalized && normalized !== "unrated") {
          ratings.set(id, normalized);
        }
      });
      return { meta, ratings, names, weekendSupport };
    }

    return null;
  }

  function normalizeRating(value) {
    if (value === null || value === undefined) return "unrated";
    if (typeof value === "number" && Number.isFinite(value)) {
      if (value >= 0.75) return "liked";
      if (value >= 0.25) return "maybe";
      if (value <= -0.25) return "disliked";
      return "unrated";
    }
    if (typeof value === "boolean") return value ? "liked" : "disliked";
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "unrated";
    if (["liked", "like", "love", "fav", "fave", "favorite", "favourite", "yes", "+1", "1"].includes(raw)) return "liked";
    if (["maybe", "ok", "okay", "neutral", "meh", "0.5", "+0.5", "interested"].includes(raw)) return "maybe";
    if (["disliked", "dislike", "no", "nope", "skip", "-1"].includes(raw)) return "disliked";
    if (["unrated", "none", "0"].includes(raw)) return "unrated";
    return "unrated";
  }

  function getMismatchInfo(meta, expectedCtx, weekendSupport) {
    const expFestival = expectedCtx.festival;
    const expYear = expectedCtx.year;
    const expWeekend = expectedCtx.weekend;

    const fileFestival = meta?.festival || "";
    const fileYear = meta?.year || "";
    const fileWeekend = meta?.weekend || "";
    const weekendList = Array.isArray(meta?.weekends) ? meta.weekends : [];

    let mismatch = false;
    if (fileFestival && expFestival && fileFestival !== expFestival) mismatch = true;
    if (fileYear && expYear && fileYear !== expYear) mismatch = true;

    const supportsWeekend = (() => {
      if (!expWeekend) return true;
      if (fileWeekend && fileWeekend === expWeekend) return true;
      if (weekendList.length && weekendList.includes(expWeekend)) return true;
      if (weekendSupport?.size && weekendSupport.has(expWeekend)) return true;
      return !(fileWeekend || weekendList.length || (weekendSupport && weekendSupport.size));
    })();

    if (!supportsWeekend) mismatch = true;

    const message = mismatch ? (t("group_status_mismatch_detail") || "Context mismatch.") : "";
    return { mismatch, message };
  }

  function renderFileList() {
    if (!fileList) return;
    if (!state.files.length) {
      fileList.innerHTML = "";
      return;
    }

    fileList.innerHTML = state.files.map((entry) => {
      const personLabel = t("group_person_label") || "Person";
      const fileLabel = t("group_file_label") || "File";
      const statusFieldLabel = t("group_status_label") || "Status";
      const statusDisplay = getStatusDisplay(entry);
      const statusLabel = statusDisplay.label;
      const badgeClass = statusDisplay.badgeClass;

      const message = entry.error ? `<div class="groupFileMessage">${escapeHtml(entry.error)}</div>` : "";
      return `
        <div class="groupFileRow" data-id="${escapeAttr(entry.id)}">
          <div class="groupFileField">
            <label class="groupFileLabel">${escapeHtml(personLabel)}</label>
            <input class="groupFileInput" data-id="${escapeAttr(entry.id)}" type="text" placeholder="${escapeAttr(t("group_person_placeholder") || "Name")}" value="${escapeAttr(entry.name)}" />
          </div>
          <div class="groupFileField">
            <div class="groupFileLabel">${escapeHtml(fileLabel)}</div>
            <div class="groupFileValue">${escapeHtml(entry.file.name || "")}</div>
          </div>
          <div class="groupFileStatus">
            <div class="groupFileLabel">${escapeHtml(statusFieldLabel)}</div>
            <span class="groupStatusBadge ${escapeAttr(badgeClass)}">${escapeHtml(statusLabel)}</span>
            ${message}
          </div>
          <button class="btn ghost" type="button" data-action="removeFile" data-id="${escapeAttr(entry.id)}">${escapeHtml(t("group_remove") || "Remove")}</button>
        </div>
      `;
    }).join("");
  }

  function getStatusDisplay(entry) {
    const isNameMissing = !(entry.name && entry.name.trim().length > 0);
    const label = entry.status === "invalid"
      ? (t("group_status_invalid") || "Invalid")
      : entry.status === "mismatch"
        ? (t("group_status_mismatch") || "Mismatch")
        : entry.status === "ok" && isNameMissing
          ? (t("group_status_name_missing") || "Name required")
          : entry.status === "ok"
            ? (t("group_status_ok") || "OK")
            : (t("group_status_pending") || "Loading");
    const badgeClass = entry.status === "invalid"
      ? "invalid"
      : entry.status === "mismatch"
        ? "mismatch"
        : entry.status === "ok" && isNameMissing
          ? "invalid"
          : entry.status === "ok"
            ? "ok"
            : "pending";
    return { label, badgeClass };
  }

  function updateFileRowStatus(id) {
    if (!fileList) return;
    const entry = state.files.find((f) => f.id === id);
    if (!entry) return;
    const row = fileList.querySelector(`.groupFileRow[data-id="${CSS.escape(id)}"]`);
    if (!row) return;
    const badge = row.querySelector(".groupStatusBadge");
    if (!badge) return;
    const statusDisplay = getStatusDisplay(entry);
    badge.textContent = statusDisplay.label;
    badge.classList.remove("ok", "mismatch", "invalid", "pending");
    badge.classList.add(statusDisplay.badgeClass);
  }

  function updateLimitNotice() {
    if (!limitNote || !limitText || !proceedBtn) return;
    const count = state.files.length;
    if (count <= MAX_SOFT) {
      limitNote.hidden = true;
      proceedBtn.hidden = true;
      return;
    }
    const warning = t("group_soft_limit") || "Recommended max 20 for best performance.";
    limitText.textContent = warning;
    limitNote.hidden = false;
    proceedBtn.hidden = state.allowOverLimit;
  }

  function updateAnalyzeState() {
    const included = getIncludedFiles();
    const named = included.every((entry) => entry.name && entry.name.trim().length > 0);
    const enough = included.length >= 2;
    const overLimit = state.files.length > MAX_SOFT && !state.allowOverLimit;

    if (analyzeBtn) analyzeBtn.disabled = !(named && enough && !overLimit);
    if (exportBtn) exportBtn.disabled = !state.results;
  }

  function getIncludedFiles() {
    const includeMismatch = includeMismatchToggle?.checked;
    return state.files.filter((entry) => {
      if (entry.status === "ok") return true;
      if (entry.status === "mismatch" && includeMismatch) return true;
      return false;
    });
  }

  function runAnalysis() {
    const included = getIncludedFiles();
    const groupSize = included.length;
    if (groupSize < 2) return;

    const aggregate = new Map();

    included.forEach((entry) => {
      entry.ratings.forEach((rating, artistId) => {
        const canonicalId = resolveCanonicalId(artistId);
        const nameFromEntry = entry.names.get(artistId) || entry.names.get(canonicalId) || "";
        const display = resolveArtistDisplay(canonicalId, nameFromEntry);
        const stats = aggregate.get(canonicalId) || {
          id: canonicalId,
          name: display.name,
          meta: display.meta,
          likeCount: 0,
          maybeCount: 0,
          dislikeCount: 0
        };
        if (!stats.name || stats.name === stats.id) {
          const candidate = nameFromEntry || reference.names.get(canonicalId) || reference.names.get(artistId);
          if (candidate) stats.name = candidate;
        }
        if (!stats.meta && display.meta) stats.meta = display.meta;
        if (rating === "liked") stats.likeCount += 1;
        if (rating === "maybe") stats.maybeCount += 1;
        if (rating === "disliked") stats.dislikeCount += 1;
        aggregate.set(canonicalId, stats);
      });
    });

    const results = Array.from(aggregate.values()).map((stat) => {
      const ratedCount = stat.likeCount + stat.maybeCount + stat.dislikeCount;
      const sumScore = stat.likeCount * 1 + stat.maybeCount * 0.5 + stat.dislikeCount * -1;
      const agreement = groupSize ? (stat.likeCount + 0.5 * stat.maybeCount) / groupSize : 0;
      const consensus = groupSize ? sumScore / groupSize : 0;
      return {
        ...stat,
        ratedCount,
        agreement,
        consensus,
        sumScore
      };
    });

    const topPicks = results
      .slice()
      .sort((a, b) => {
        if (b.agreement !== a.agreement) return b.agreement - a.agreement;
        if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
        if (a.dislikeCount !== b.dislikeCount) return a.dislikeCount - b.dislikeCount;
        return a.name.localeCompare(b.name);
      });

    const conflicts = results
      .filter((r) => r.likeCount > 0 && r.dislikeCount > 0)
      .slice()
      .sort((a, b) => {
        const aTotal = a.likeCount + a.dislikeCount;
        const bTotal = b.likeCount + b.dislikeCount;
        if (bTotal !== aTotal) return bTotal - aTotal;
        const aDiff = Math.abs(a.likeCount - a.dislikeCount);
        const bDiff = Math.abs(b.likeCount - b.dislikeCount);
        if (aDiff !== bDiff) return aDiff - bDiff;
        return a.name.localeCompare(b.name);
      });

    state.results = {
      groupSize,
      includedCount: included.length,
      totalCount: state.files.length,
      topPicks,
      conflicts
    };

    if (resultsWrap) resultsWrap.hidden = false;
    renderResults();
    updateAnalyzeState();
  }

  function renderResults() {
    if (!state.results) return;
    const filter = state.filter;

    const filterList = (list) => {
      if (!filter) return list;
      return list.filter((item) => String(item.name || "").toLowerCase().includes(filter));
    };

    const top = filterList(state.results.topPicks).slice(0, 50);
    const conflicts = filterList(state.results.conflicts).slice(0, 50);

    if (resultsMeta) {
      const metaText = formatTemplate(t("group_results_meta") || "{count} people included", {
        count: state.results.groupSize
      });
      resultsMeta.textContent = metaText;
    }

    renderTableRows(topPicksBody, top, state.results.groupSize, t("group_empty_top") || "No top picks yet.");
    renderTableRows(conflictsBody, conflicts, state.results.groupSize, t("group_empty_conflicts") || "No conflicts yet.");
  }

  function renderTableRows(tbody, items, groupSize, emptyText) {
    if (!tbody) return;
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="groupEmpty">${escapeHtml(emptyText)}</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map((item) => {
      const displayName = (!item.name || item.name === item.id) && reference.names.has(item.id)
        ? reference.names.get(item.id)
        : item.name;
      const whenLabel = reference.when.get(item.id) || "";
      const stageLabel = reference.stage.get(item.id) || "";
      const displayMeta = (!item.meta && reference.meta.has(item.id)) ? reference.meta.get(item.id) : item.meta;
      const metaLine = displayMeta || stageLabel;
      const artistLine = whenLabel ? `${whenLabel} \u00b7 ${displayName || item.id}` : (displayName || item.id);
      const agreement = formatPercent(item.agreement, false);
      const consensus = formatPercent(item.consensus, true);
      const likePct = groupSize ? (item.likeCount / groupSize) * 100 : 0;
      const maybePct = groupSize ? (item.maybeCount / groupSize) * 100 : 0;
      const dislikePct = groupSize ? (item.dislikeCount / groupSize) * 100 : 0;

      return `
        <tr>
          <td>
            <div class="groupArtist">${escapeHtml(artistLine)}</div>
            ${metaLine ? `<div class="groupMeta">${escapeHtml(metaLine)}</div>` : ""}
            <div class="groupBar" aria-hidden="true">
              <span class="groupBarLike" style="width:${likePct.toFixed(2)}%"></span>
              <span class="groupBarMaybe" style="width:${maybePct.toFixed(2)}%"></span>
              <span class="groupBarDislike" style="width:${dislikePct.toFixed(2)}%"></span>
            </div>
          </td>
          <td class="num">${item.likeCount}</td>
          <td class="num">${item.maybeCount}</td>
          <td class="num">${item.dislikeCount}</td>
          <td class="num">${agreement}</td>
          <td class="num">${consensus}</td>
        </tr>
      `;
    }).join("");
  }

  function formatPercent(value, signed) {
    if (!Number.isFinite(value)) return "0%";
    const pct = Math.round(value * 100);
    if (signed && pct > 0) return `+${pct}%`;
    return `${pct}%`;
  }

  function exportGroupResults() {
    if (!state.results) return;
    const included = getIncludedFiles();

    const payload = {
      app: "festival-planner-group",
      createdAt: new Date().toISOString(),
      group: {
        festival: expected.festival || "",
        year: expected.year || "",
        weekend: expected.weekend || "",
        snapshotId: resolveSnapshotId(included)
      },
      people: included.map((entry) => ({
        name: entry.name,
        fileName: entry.file.name || "",
        mismatch: entry.mismatch || false
      })),
      results: {
        topPicks: state.results.topPicks.slice(0, 50),
        conflicts: state.results.conflicts.slice(0, 50)
      }
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `group-merge-${expected.festival || "festival"}-${expected.year || ""}-${(expected.weekend || "").toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function clearResults() {
    state.results = null;
    if (resultsWrap) resultsWrap.hidden = true;
    if (exportBtn) exportBtn.disabled = true;
  }

  function resolveSnapshotId(included) {
    const ids = new Set(included.map((entry) => entry.meta?.snapshotId).filter(Boolean));
    if (ids.size === 1) return Array.from(ids)[0];
    return "";
  }

  function updateContextUI() {
    if (contextEl) {
      const festivalName = formatFestivalName(expected.festival);
      const weekendLabel = expected.weekend === "W2" ? (t("weekend_2") || "Weekend 2") : (t("weekend_1") || "Weekend 1");
      contextEl.textContent = `${festivalName} ${expected.year} \u00b7 ${weekendLabel}`;
    }
    if (backLink) {
      const wk = (expected.weekend || "").toLowerCase();
      backLink.href = `${BASE_PREFIX}/${expected.festival}/${expected.year}/${wk}/`;
    }
  }

  function setupLang() {
    const stored = localStorage.getItem("fp_lang");
    const bootLang = window.__FP_BOOT?.lang || "";
    const autoLang = (!stored && !bootLang) ? detectPreferredLang() : "";
    let active = stored || bootLang || autoLang || "de";

    applyTranslations(active).then(() => {
      updateContextUI();
      updateLimitNotice();
      updateTitleAndMeta();
    });
  }

  function updateTitleAndMeta() {
    const titleBase = t("group_merge_title") || "Group Merge";
    const title = `${titleBase} | Festival Planner`;
    document.title = title;
    const desc = t("group_meta_desc") || "Merge exported ratings locally and analyze group picks.";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", desc);
    const canonical = `${SITE_ORIGIN}${location.pathname}`;
    if (typeof upsertLinkRel === "function") upsertLinkRel("canonical", canonical);
    if (typeof upsertMetaTag === "function") {
      upsertMetaTag("property", "og:title", title);
      upsertMetaTag("property", "og:description", desc);
      upsertMetaTag("property", "og:url", canonical);
      upsertMetaTag("name", "twitter:title", title);
      upsertMetaTag("name", "twitter:description", desc);
    }
  }

  function isJsonFile(file) {
    const name = String(file?.name || "").toLowerCase();
    return name.endsWith(".json");
  }

  function showStatusNote(message) {
    if (!statusNote) return;
    statusNote.textContent = message;
    statusNote.hidden = !message;
  }

  function clearStatusNote() {
    if (!statusNote) return;
    statusNote.textContent = "";
    statusNote.hidden = true;
  }

  async function loadReferenceData() {
    try {
      if (typeof loadArtistsLatest === "function") {
        await loadArtistsLatest();
      } else {
        await loadArtistsFallback();
      }
      reference.snapshot = await loadReferenceSnapshot(expected.weekend);
      buildReferenceMaps();
    } catch {
      // Ignore reference load errors; fallback to export data only.
    }
  }

  function buildReferenceMaps() {
    reference.names = new Map();
    reference.meta = new Map();
    reference.when = new Map();
    reference.stage = new Map();
    reference.canonical = new Map();
    if (state.artists?.byId) {
      state.artists.byId.forEach((artist, artistId) => {
        const name = artist?.name || "";
        if (name) {
          addReferenceKey(artistId, name, "", artistId);
          if (artist?.nameNormalized) addReferenceKey(artist.nameNormalized, name, "", artistId);
          if (artist?.slug) addReferenceKey(artist.slug, name, "", artistId);
        }
      });
    }
    const snapshot = reference.snapshot || state.weekends?.[expected.weekend]?.snapshot;
    const slots = Array.isArray(snapshot?.slots) ? snapshot.slots : [];
    const byId = new Map();

    slots.forEach((slot) => {
      const artistId = slot?.artistId;
      if (!artistId) return;
      const name = slot.artist || reference.names.get(artistId) || "";
      const stageLabel = (() => {
        const raw = slot?.stage;
        if (!raw) return "";
        const label = normalizeStage(raw);
        const unknown = t("unknown_stage") || "Unknown stage";
        return label === unknown ? "" : label;
      })();
      const date = slot.date || extractDate(slot.start) || extractDate(slot.end) || "";
      const start = formatTime(slot.start);
      const end = formatTime(slot.end);
      const timeRange = start && end ? `${start}\u2013${end}` : (start || end || "");
      const dateLabel = date ? formatDate(date) : "";
      const whenLabel = [dateLabel, timeRange].filter(Boolean).join(" \u00b7 ");
      const meta = stageLabel;

      const key = `${date || ""} ${start || ""}`.trim();
      const prev = byId.get(artistId);
      if (!prev || (key && prev.key && key < prev.key)) {
        byId.set(artistId, { name, meta, key });
      }
      if (!prev && name) byId.set(artistId, { name, meta, key });

      addReferenceKey(artistId, name, meta, artistId);
      if (whenLabel) addReferenceWhen(artistId, whenLabel);
      if (stageLabel) addReferenceStage(artistId, stageLabel);
      if (slot?.artistNormalized) addReferenceKey(slot.artistNormalized, name, meta, artistId);
    });

    byId.forEach((value, artistId) => {
      if (value?.name) addReferenceKey(artistId, value.name, value.meta || "", artistId);
    });

    if (state.results) {
      renderResults();
    }
  }

  function resolveArtistDisplay(artistId, nameFromExport) {
    const name = nameFromExport || reference.names.get(artistId) || artistId;
    const meta = reference.meta.get(artistId) || "";
    return { name, meta };
  }

  function normalizeArtistKey(key) {
    if (!key) return "";
    return String(key).trim().toLowerCase();
  }

  function addReferenceKey(key, name, meta, canonicalId) {
    const raw = String(key || "").trim();
    if (!raw) return;
    if (name && !reference.names.has(raw)) reference.names.set(raw, name);
    if (meta && !reference.meta.has(raw)) reference.meta.set(raw, meta);
    if (canonicalId && !reference.canonical.has(raw)) reference.canonical.set(raw, canonicalId);
    const normalized = normalizeArtistKey(raw);
    if (normalized && normalized !== raw) {
      if (name && !reference.names.has(normalized)) reference.names.set(normalized, name);
      if (meta && !reference.meta.has(normalized)) reference.meta.set(normalized, meta);
      if (canonicalId && !reference.canonical.has(normalized)) reference.canonical.set(normalized, canonicalId);
    }
  }

  function addReferenceWhen(key, label) {
    const raw = String(key || "").trim();
    if (!raw || !label) return;
    if (!reference.when.has(raw)) reference.when.set(raw, label);
    const normalized = normalizeArtistKey(raw);
    if (normalized && normalized !== raw && !reference.when.has(normalized)) reference.when.set(normalized, label);
  }

  function addReferenceStage(key, label) {
    const raw = String(key || "").trim();
    if (!raw || !label) return;
    if (!reference.stage.has(raw)) reference.stage.set(raw, label);
    const normalized = normalizeArtistKey(raw);
    if (normalized && normalized !== raw && !reference.stage.has(normalized)) reference.stage.set(normalized, label);
  }

  function resolveCanonicalId(key) {
    const raw = String(key || "").trim();
    if (!raw) return raw;
    return reference.canonical.get(raw) || reference.canonical.get(normalizeArtistKey(raw)) || raw;
  }

  async function loadReferenceSnapshot(weekend) {
    if (typeof tryFetchJson !== "function") return null;
    const base = withRoot(`/data/${expected.festival}/${expected.year}/snapshots`);
    const latest = await tryFetchJson(`${base}/latest.json`, { cache: "no-store" });
    const normalizedWeekend = normalizeWeekend(weekend || "");
    if (latest && normalizeWeekend(latest?.meta?.weekend) === normalizedWeekend) {
      return latest;
    }
    const index = await tryFetchJson(`${base}/index.json`, { cache: "no-store" });
    const candidates = (index?.snapshots || [])
      .filter((s) => String(s.file || "").toUpperCase().endsWith(`_${normalizedWeekend}.JSON`))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (!candidates.length) return null;
    return await tryFetchJson(`${base}/${candidates[0].file}`, { cache: "default" });
  }

  async function loadArtistsFallback() {
    if (typeof tryFetchJson !== "function") return;
    const base = withRoot(`/data/${expected.festival}/${expected.year}/artists`);
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
      state.artists.byId = new Map(data.artists.map((a) => [a.artistId, a]));
    }
  }

  function getExpectedContext() {
    const boot = typeof getBootContext === "function" ? getBootContext() : null;
    const festival = boot?.festival || route?.festival || DEFAULT_FESTIVAL;
    const year = boot?.year || route?.year || DEFAULT_YEAR;
    const weekend = normalizeWeekend(boot?.weekend || route?.weekend || DEFAULT_WEEKEND);
    return { festival, year, weekend };
  }
})();

