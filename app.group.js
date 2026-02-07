// ====== GROUP MERGE (LEAN) ======
(function () {
  const dropzone = document.getElementById("groupDropzone");
  if (!dropzone) return;

  const fileInput = document.getElementById("groupFileInput");
  const selectBtn = document.getElementById("groupSelectBtn");
  const fileList = document.getElementById("groupFileList");
  const analyzeBtn = document.getElementById("groupAnalyzeBtn");
  const proceedBtn = document.getElementById("groupProceedBtn");
  const limitNote = document.getElementById("groupLimitNote");
  const limitText = document.getElementById("groupLimitText");
  const includeMismatchToggle = document.getElementById("includeMismatchToggle");
  const statusNote = document.getElementById("groupStatusNote");
  const resultsWrap = document.getElementById("groupResults");
  const resultsMeta = document.getElementById("groupResultsMeta");
  const participantsBar = document.getElementById("groupParticipantsBar");
  const sectionFilter = document.getElementById("groupSectionFilter");
  const conflictOnlyToggle = document.getElementById("groupConflictOnly");
  const unanimousOnlyToggle = document.getElementById("groupUnanimousOnly");
  const noDownvotesToggle = document.getElementById("groupNoDownvotes");
  const polarizingOnlyToggle = document.getElementById("groupPolarizingOnly");
  const minApprovalSelect = document.getElementById("groupMinApproval");
  const rejectedByPersonSelect = document.getElementById("groupRejectedByPerson");
  const heroSection = document.getElementById("groupHeroSection");
  const recommendedSection = document.getElementById("groupRecommendedSection");
  const discussionSection = document.getElementById("groupDiscussionSection");
  const avoidSection = document.getElementById("groupAvoidSection");
  const allSection = document.getElementById("groupAllSection");
  const topPicksBody = document.getElementById("groupTopPicksBody");
  const conflictsBody = document.getElementById("groupConflictsBody");
  const heroList = document.getElementById("groupHeroList");
  const recommendedList = document.getElementById("groupRecommendedList");
  const discussionList = document.getElementById("groupDiscussionList");
  const avoidList = document.getElementById("groupAvoidList");
  const allBody = document.getElementById("groupAllBody");
  const filterInput = document.getElementById("groupFilterInput");
  const personFilter = document.getElementById("groupPersonFilter");
  const backLink = document.getElementById("groupBackLink");
  const contextEl = document.getElementById("groupContext");

  const MAX_SOFT = 20;
  const MAX_HARD = 30;

  const state = {
    files: [],
    allowOverLimit: false,
    results: null,
    filter: "",
    personFilter: "all",
    sectionFilter: "all",
    conflictOnly: false,
    unanimousOnly: false,
    noDownvotes: false,
    polarizingOnly: false,
    minApproval: 0,
    rejectedByPerson: "any"
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

  if (filterInput) {
    filterInput.addEventListener("input", () => {
      state.filter = String(filterInput.value || "").trim().toLowerCase();
      if (state.results) renderResults();
    });
  }
  if (personFilter) {
    personFilter.addEventListener("change", () => {
      state.personFilter = String(personFilter.value || "all");
      if (state.results) renderResults();
    });
  }
  if (sectionFilter) {
    sectionFilter.addEventListener("change", () => {
      state.sectionFilter = String(sectionFilter.value || "all");
      if (state.results) renderResults();
    });
  }
  if (conflictOnlyToggle) {
    conflictOnlyToggle.addEventListener("change", () => {
      state.conflictOnly = Boolean(conflictOnlyToggle.checked);
      if (state.results) renderResults();
    });
  }
  if (unanimousOnlyToggle) {
    unanimousOnlyToggle.addEventListener("change", () => {
      state.unanimousOnly = Boolean(unanimousOnlyToggle.checked);
      if (state.results) renderResults();
    });
  }
  if (noDownvotesToggle) {
    noDownvotesToggle.addEventListener("change", () => {
      state.noDownvotes = Boolean(noDownvotesToggle.checked);
      if (state.results) renderResults();
    });
  }
  if (polarizingOnlyToggle) {
    polarizingOnlyToggle.addEventListener("change", () => {
      state.polarizingOnly = Boolean(polarizingOnlyToggle.checked);
      if (state.results) renderResults();
    });
  }
  if (minApprovalSelect) {
    minApprovalSelect.addEventListener("change", () => {
      const next = parseFloat(minApprovalSelect.value || "0");
      state.minApproval = Number.isFinite(next) ? next : 0;
      if (state.results) renderResults();
    });
  }
  if (rejectedByPersonSelect) {
    rejectedByPersonSelect.addEventListener("change", () => {
      state.rejectedByPerson = String(rejectedByPersonSelect.value || "any");
      if (state.results) renderResults();
    });
  }
  if (participantsBar) {
    participantsBar.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-person-id]");
      if (!btn) return;
      const id = btn.getAttribute("data-person-id") || "all";
      state.personFilter = id;
      if (personFilter) {
        personFilter.value = id;
        if (typeof rebuildCustomSelect === "function") {
          rebuildCustomSelect(personFilter);
        } else if (typeof initCustomSelect === "function") {
          initCustomSelect(personFilter);
        }
      }
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
      if (!entry.name && parsed.personName) {
        entry.name = parsed.personName;
      }

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
    const personName = String(
      data?.person?.name ||
      data?.personName ||
      data?.name ||
      data?.profile?.name ||
      ""
    ).trim();

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
      return { meta, ratings, names, weekendSupport, personName };
    }

    if (data?.ratings && typeof data.ratings === "object") {
      Object.keys(data.ratings).forEach((id) => {
        const normalized = normalizeRating(data.ratings[id]);
        if (normalized && normalized !== "unrated") {
          ratings.set(id, normalized);
        }
      });
      return { meta, ratings, names, weekendSupport, personName };
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
    const people = buildPeopleList(included);

    included.forEach((entry) => {
      const person = people.find((p) => p.id === entry.id);
      const personName = person?.displayName || "";
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
          dislikeCount: 0,
          likedBy: [],
          maybeBy: [],
          dislikedBy: [],
          ratingsByPerson: new Map()
        };
        if (!stats.name || stats.name === stats.id) {
          const candidate = nameFromEntry || reference.names.get(canonicalId) || reference.names.get(artistId);
          if (candidate) stats.name = candidate;
        }
        if (!stats.meta && display.meta) stats.meta = display.meta;
        if (rating === "liked") {
          stats.likeCount += 1;
          if (personName) stats.likedBy.push(personName);
          if (person?.id) stats.ratingsByPerson.set(person.id, "liked");
        }
        if (rating === "maybe") {
          stats.maybeCount += 1;
          if (personName) stats.maybeBy.push(personName);
          if (person?.id) stats.ratingsByPerson.set(person.id, "maybe");
        }
        if (rating === "disliked") {
          stats.dislikeCount += 1;
          if (personName) stats.dislikedBy.push(personName);
          if (person?.id) stats.ratingsByPerson.set(person.id, "disliked");
        }
        aggregate.set(canonicalId, stats);
      });
    });

    const results = Array.from(aggregate.values()).map((stat) => {
      const ratedCount = stat.likeCount + stat.maybeCount + stat.dislikeCount;
      const sumScore = stat.likeCount * 1 + stat.maybeCount * 0.5 + stat.dislikeCount * -1;
      const approvalPct = groupSize ? (stat.likeCount + 0.5 * stat.maybeCount) / groupSize : 0;
      const rejectPct = groupSize ? stat.dislikeCount / groupSize : 0;
      const agreementPct = ratedCount > 0 && groupSize
        ? Math.max(stat.likeCount, stat.maybeCount, stat.dislikeCount) / groupSize
        : 0;
      const agreement = approvalPct;
      const consensus = groupSize ? sumScore / groupSize : 0;
      const className = classifyGroupItem({
        approvalPct,
        rejectPct,
        dislikeCount: stat.dislikeCount,
        likeCount: stat.likeCount,
        groupSize
      });
      return {
        ...stat,
        ratedCount,
        agreement,
        approvalPct,
        rejectPct,
        agreementPct,
        consensus,
        sumScore,
        className
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

    const sortByDecision = (a, b) => {
      if (b.approvalPct !== a.approvalPct) return b.approvalPct - a.approvalPct;
      if (a.dislikeCount !== b.dislikeCount) return a.dislikeCount - b.dislikeCount;
      return String(a.name || "").localeCompare(String(b.name || ""));
    };

    const recommended = results.filter((r) => r.className === "recommended").slice().sort(sortByDecision);
    const discussion = results.filter((r) => r.className === "discussion").slice().sort(sortByDecision);
    const avoid = results.filter((r) => r.className === "avoid").slice().sort(sortByDecision);

    const hero = [];
    const heroIds = new Set();
    recommended.slice(0, 5).forEach((item) => {
      hero.push({ ...item, heroBorderline: false });
      heroIds.add(item.id);
    });
    if (hero.length < 3) {
      discussion.forEach((item) => {
        if (hero.length >= 5) return;
        if (heroIds.has(item.id)) return;
        hero.push({ ...item, heroBorderline: true });
        heroIds.add(item.id);
      });
    }

    const allSorted = [...recommended, ...discussion, ...avoid];

    state.results = {
      groupSize,
      includedCount: included.length,
      totalCount: state.files.length,
      people,
      topPicks,
      conflicts,
      recommended,
      discussion,
      avoid,
      hero,
      allSorted
    };

    if (resultsWrap) resultsWrap.hidden = false;
    renderResults();
    updateAnalyzeState();
  }

  function renderResults() {
    if (!state.results) return;
    const filter = state.filter;
    const activePerson = String(state.personFilter || "all");
    const sectionMode = String(state.sectionFilter || "all");
    const conflictOnly = Boolean(state.conflictOnly);
    const unanimousOnly = Boolean(state.unanimousOnly);
    const noDownvotes = Boolean(state.noDownvotes);
    const polarizingOnly = Boolean(state.polarizingOnly);
    const minApproval = Number.isFinite(state.minApproval) ? state.minApproval : 0;
    const rejectedByPerson = String(state.rejectedByPerson || "any");
    const people = state.results.people || [];
    const peopleById = new Map(people.map((p) => [p.id, p]));
    const peopleDisplay = people.map((p) => p.displayName);

    const filterList = (list) => {
      let filtered = Array.isArray(list) ? list.slice() : [];
      if (filter) {
        filtered = filtered.filter((item) => String(item.name || "").toLowerCase().includes(filter));
      }
      if (conflictOnly) {
        filtered = filtered.filter((item) => (item.dislikeCount || 0) > 0);
      }
      if (unanimousOnly) {
        filtered = filtered.filter((item) => (item.likeCount || 0) === state.results.groupSize);
      }
      if (noDownvotes) {
        filtered = filtered.filter((item) => (item.dislikeCount || 0) === 0);
      }
      if (polarizingOnly) {
        filtered = filtered.filter((item) => (item.likeCount || 0) > 0 && (item.dislikeCount || 0) > 0);
      }
      if (minApproval > 0) {
        filtered = filtered.filter((item) => (item.approvalPct || 0) >= minApproval);
      }
      if (rejectedByPerson !== "any") {
        filtered = filtered.filter((item) => item.ratingsByPerson?.get(rejectedByPerson) === "disliked");
      }
      return filtered;
    };

    const personRank = {
      liked: 0,
      maybe: 1,
      disliked: 2,
      unrated: 3
    };
    const sortWithPerson = (list) => {
      const copy = list.slice();
      copy.sort((a, b) => {
        if (activePerson && activePerson !== "all") {
          const aRating = a.ratingsByPerson?.get(activePerson) || "unrated";
          const bRating = b.ratingsByPerson?.get(activePerson) || "unrated";
          const aRank = personRank[aRating] ?? 3;
          const bRank = personRank[bRating] ?? 3;
          if (aRank !== bRank) return aRank - bRank;
        }
        if (b.approvalPct !== a.approvalPct) return b.approvalPct - a.approvalPct;
        if (a.dislikeCount !== b.dislikeCount) return a.dislikeCount - b.dislikeCount;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
      return copy;
    };

    const hero = sortWithPerson(filterList(state.results.hero)).slice(0, 5);
    const recommended = sortWithPerson(filterList(state.results.recommended));
    const discussion = sortWithPerson(filterList(state.results.discussion));
    const avoid = sortWithPerson(filterList(state.results.avoid));
    const allItems = sortWithPerson(filterList(state.results.allSorted));

    renderPersonFilter(people);
    renderSectionFilter();
    renderRejectedByFilter(people);
    renderParticipantsBar(people);

    const showHero = sectionMode === "all" || sectionMode === "highlights";
    const showRecommended = sectionMode === "all" || sectionMode === "recommended";
    const showDiscussion = sectionMode === "all" || sectionMode === "discussion";
    const showAvoid = sectionMode === "all" || sectionMode === "avoid";
    const showAll = sectionMode === "all";

    if (heroSection) heroSection.hidden = !showHero;
    if (recommendedSection) recommendedSection.hidden = !showRecommended;
    if (discussionSection) discussionSection.hidden = !showDiscussion;
    if (avoidSection) avoidSection.hidden = !showAvoid;
    if (allSection) allSection.hidden = !showAll;
    if (sectionFilter) {
      sectionFilter.value = sectionMode;
      if (typeof syncCustomSelect === "function") {
        syncCustomSelect(sectionFilter);
      }
    }
    if (conflictOnlyToggle) conflictOnlyToggle.checked = conflictOnly;
    if (unanimousOnlyToggle) unanimousOnlyToggle.checked = unanimousOnly;
    if (noDownvotesToggle) noDownvotesToggle.checked = noDownvotes;
    if (polarizingOnlyToggle) polarizingOnlyToggle.checked = polarizingOnly;
    if (minApprovalSelect) {
      minApprovalSelect.value = String(minApproval);
      if (typeof initCustomSelect === "function" && minApprovalSelect.dataset.customReady !== "true") {
        initCustomSelect(minApprovalSelect);
      } else if (typeof syncCustomSelect === "function") {
        syncCustomSelect(minApprovalSelect);
      }
    }
    if (rejectedByPersonSelect) {
      rejectedByPersonSelect.value = rejectedByPerson;
      if (typeof syncCustomSelect === "function") {
        syncCustomSelect(rejectedByPersonSelect);
      }
    }

    if (resultsMeta) {
      const metaText = formatTemplate(t("group_results_meta") || "{count} people included", {
        count: state.results.groupSize
      });
      const viewFor = activePerson && activePerson !== "all"
        ? `${t("group_view_for") || "View for"} ${peopleById.get(activePerson)?.displayName || activePerson}`
        : "";
      resultsMeta.textContent = viewFor ? `${metaText} \u00b7 ${viewFor}` : metaText;
    }

    renderCardList(heroList, hero, state.results.groupSize, {
      emptyText: t("group_empty_hero") || "No highlights yet.",
      activePerson,
      people: peopleDisplay,
      peopleById,
      showBorderline: true
    });
    renderCardList(recommendedList, recommended, state.results.groupSize, {
      emptyText: t("group_empty_recommended") || "No recommendations yet.",
      activePerson,
      people: peopleDisplay,
      peopleById
    });
    renderCardList(discussionList, discussion, state.results.groupSize, {
      emptyText: t("group_empty_discussion") || "No discussion cases yet.",
      activePerson,
      people: peopleDisplay,
      peopleById,
      showOpponents: true
    });
    renderCardList(avoidList, avoid, state.results.groupSize, {
      emptyText: t("group_empty_avoid") || "No skip candidates yet.",
      activePerson,
      people: peopleDisplay,
      peopleById
    });
    renderTableRows(allBody, allItems, state.results.groupSize, t("group_empty_all") || "No items yet.");
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

  function renderCardList(container, items, groupSize, options = {}) {
    if (!container) return;
    const { emptyText, activePerson, people, showOpponents, showBorderline } = options;
    if (!items.length) {
      container.innerHTML = `<div class="groupZoneEmpty">${escapeHtml(emptyText || "")}</div>`;
      return;
    }
    container.innerHTML = items.map((item) => renderDecisionCard(item, groupSize, {
      activePerson,
      people,
      showOpponents,
      showBorderline
    })).join("");
  }

  function renderDecisionCard(item, groupSize, options = {}) {
    const displayName = (!item.name || item.name === item.id) && reference.names.has(item.id)
      ? reference.names.get(item.id)
      : item.name;
    const whenLabel = reference.when.get(item.id) || "";
    const stageLabel = reference.stage.get(item.id) || "";
    const displayMeta = (!item.meta && reference.meta.has(item.id)) ? reference.meta.get(item.id) : item.meta;
    const metaLine = [displayMeta || stageLabel, whenLabel].filter(Boolean).join(" \u00b7 ");
    const badge = item.className === "recommended" ? "\ud83d\udfe2" : item.className === "discussion" ? "\ud83d\udfe1" : "\ud83d\udd34";
    const hintText = item.className === "recommended"
      ? (t("group_hint_recommended") || "Solid anchor")
      : item.className === "discussion"
        ? (t("group_hint_discussion") || "Quick discussion")
        : (t("group_hint_avoid") || "Probably skip");

    const likeLabel = t("liked") || "Liked";
    const maybeLabel = t("maybe") || "Maybe";
    const dislikeLabel = t("disliked") || "Disliked";
    const detailsLabel = t("group_votes_details") || "Who voted what?";
    const activePerson = options.activePerson && options.activePerson !== "all" ? options.activePerson : "";
    const personRating = activePerson ? (item.ratingsByPerson?.get(activePerson) || "unrated") : "";
    const personName = activePerson ? (options.peopleById?.get(activePerson)?.displayName || "") : "";
    const personLabel = personName && personRating !== "unrated"
      ? `${personName} ${personRating === "liked" ? likeLabel : personRating === "maybe" ? maybeLabel : dislikeLabel}`
      : "";

    const orderedPeople = Array.isArray(options.people) ? options.people : [];
    const orderedLiked = orderNames(item.likedBy || [], orderedPeople);
    const orderedMaybe = orderNames(item.maybeBy || [], orderedPeople);
    const orderedDisliked = orderNames(item.dislikedBy || [], orderedPeople);

    const opponentsLine = options.showOpponents
      ? renderOpponentsLine(orderedDisliked, orderedLiked)
      : "";

    const borderlineBadge = options.showBorderline && item.heroBorderline
      ? `<span class="groupBorderline">${escapeHtml(t("group_borderline") || "Borderline")}</span>`
      : "";

    return `
      <article class="groupItemCard is-${escapeAttr(item.className)}">
        <div class="groupItemHeader">
          <div>
            <div class="groupItemTitle">${escapeHtml(displayName || item.id)}</div>
            ${metaLine ? `<div class="groupItemMeta">${escapeHtml(metaLine)}</div>` : ""}
          </div>
          <div class="groupItemBadge">${badge}</div>
        </div>
        <div class="groupItemChips">
          <span class="groupVoteChip like">\ud83d\udc4d ${item.likeCount}</span>
          <span class="groupVoteChip maybe">\ud83e\udd14 ${item.maybeCount}</span>
          <span class="groupVoteChip dislike">\ud83d\udc4e ${item.dislikeCount}</span>
          ${borderlineBadge}
        </div>
        ${personLabel ? `<div class="groupPersonFocus">${escapeHtml(personLabel)}</div>` : ""}
        <div class="groupItemHint">${escapeHtml(hintText)}</div>
        ${opponentsLine}
        <details class="groupItemDetails">
          <summary>${escapeHtml(detailsLabel)}</summary>
          <div class="groupItemBreakdown">
            <div><span class="groupDetailIcon">\ud83d\udc4d</span>${renderNameList(orderedLiked)}</div>
            <div><span class="groupDetailIcon">\ud83e\udd14</span>${renderNameList(orderedMaybe)}</div>
            <div><span class="groupDetailIcon">\ud83d\udc4e</span>${renderNameList(orderedDisliked)}</div>
          </div>
        </details>
      </article>
    `;
  }

  function renderOpponentsLine(disliked, liked) {
    if (!Array.isArray(disliked) || !disliked.length) return "";
    const againstLabel = t("group_against") || "Against";
    const favorLabel = t("group_in_favor") || "In favor";
    const against = formatNameList(disliked, 2);
    const favor = Array.isArray(liked) && liked.length ? formatNameList(liked, 2) : null;
    const favorText = favor && favor.text
      ? `<span class="groupOpposeHint">${escapeHtml(favorLabel)}: ${escapeHtml(favor.text)}${favor.extra ? ` +${favor.extra}` : ""}</span>`
      : "";
    return `
      <div class="groupOpposeLine">
        <span class="groupOpposeHint">${escapeHtml(againstLabel)}: ${escapeHtml(against.text)}${against.extra ? ` +${against.extra}` : ""}</span>
        ${favorText}
      </div>
    `;
  }

  function renderNameList(list) {
    if (!Array.isArray(list) || !list.length) return `<span class="groupDetailEmpty">\u2014</span>`;
    return `<span>${escapeHtml(list.join(", "))}</span>`;
  }

  function formatNameList(list, maxNames) {
    const ordered = Array.isArray(list) ? list : [];
    const max = Math.max(1, maxNames || 2);
    const visible = ordered.slice(0, max);
    const extra = ordered.length - visible.length;
    return { text: visible.join(", "), extra: extra > 0 ? extra : 0 };
  }

  function orderNames(list, order) {
    if (!Array.isArray(list)) return [];
    if (!Array.isArray(order) || !order.length) return list.slice();
    const set = new Set(list);
    const ordered = order.filter((name) => set.has(name));
    const remaining = list.filter((name) => !ordered.includes(name));
    return ordered.concat(remaining);
  }

  function buildPeopleList(included) {
    const people = [];
    const counts = new Map();
    const normalized = (value) => String(value || "").trim().toLowerCase();

    included.forEach((entry) => {
      const name = String(entry?.name || "").trim();
      if (!name) return;
      const key = normalized(name);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const seen = new Map();
    included.forEach((entry) => {
      const name = String(entry?.name || "").trim();
      if (!name) return;
      const key = normalized(name);
      const total = counts.get(key) || 1;
      const index = (seen.get(key) || 0) + 1;
      seen.set(key, index);
      const displayName = total > 1 ? `${name} (${index})` : name;
      people.push({ id: entry.id, name, displayName });
    });

    return people;
  }

  function renderParticipantsBar(people) {
    if (!participantsBar) return;
    if (!Array.isArray(people) || !people.length) {
      participantsBar.innerHTML = "";
      return;
    }
    const includedLabel = t("group_people_included") || "people included";
    const count = people.length;
    const active = String(state.personFilter || "all");
    const allLabel = t("group_all_participants") || "All participants";
    const chips = [{ id: "all", label: allLabel }]
      .concat(people.map((person) => ({
        id: person.id,
        label: person.displayName || person.name || ""
      })));
    const chipsHtml = chips.map((chip) => {
      const isActive = chip.id === active ? " isActive" : "";
      return `<button type="button" class="groupParticipantChip${isActive}" data-person-id="${escapeAttr(chip.id)}">${escapeHtml(chip.label)}</button>`;
    }).join("");
    const baseText = `${count} ${includedLabel}`;
    participantsBar.innerHTML = `
      <div class="groupParticipantsText">${escapeHtml(baseText)}</div>
      <div class="groupParticipantsChips">${chipsHtml}</div>
    `;
  }

  function renderPersonFilter(people) {
    if (!personFilter) return;
    let active = state.personFilter || "all";
    const ids = Array.isArray(people) ? people.map((p) => p.id) : [];
    if (active !== "all" && !ids.includes(active)) {
      active = "all";
      state.personFilter = "all";
    }
    const options = [];
    options.push({
      value: "all",
      label: t("group_all_participants") || "All participants"
    });
    (people || []).forEach((person) => {
      if (!person?.id) return;
      options.push({ value: person.id, label: person.displayName || person.name || "" });
    });
    personFilter.innerHTML = options.map((opt) => {
      const selected = opt.value === active ? " selected" : "";
      return `<option value="${escapeAttr(opt.value)}"${selected}>${escapeHtml(opt.label)}</option>`;
    }).join("");
    if (typeof rebuildCustomSelect === "function") {
      rebuildCustomSelect(personFilter);
    } else if (typeof initCustomSelect === "function") {
      initCustomSelect(personFilter);
    }
  }

  function renderSectionFilter() {
    if (!sectionFilter) return;
    const active = String(state.sectionFilter || "all");
    const options = [
      { value: "all", label: t("group_view_all") || "All sections" },
      { value: "highlights", label: t("group_view_highlights") || "Highlights" },
      { value: "recommended", label: t("group_view_recommended") || "Recommended" },
      { value: "discussion", label: t("group_view_discussion") || "Discussion" },
      { value: "avoid", label: t("group_view_avoid") || "Avoid" }
    ];
    sectionFilter.innerHTML = options.map((opt) => {
      const selected = opt.value === active ? " selected" : "";
      return `<option value="${escapeAttr(opt.value)}"${selected}>${escapeHtml(opt.label)}</option>`;
    }).join("");
    if (typeof rebuildCustomSelect === "function") {
      rebuildCustomSelect(sectionFilter);
    } else if (typeof initCustomSelect === "function") {
      initCustomSelect(sectionFilter);
    }
  }

  function renderRejectedByFilter(people) {
    if (!rejectedByPersonSelect) return;
    let active = String(state.rejectedByPerson || "any");
    const ids = Array.isArray(people) ? people.map((p) => p.id) : [];
    if (active !== "any" && !ids.includes(active)) {
      active = "any";
      state.rejectedByPerson = "any";
    }
    const options = [];
    options.push({ value: "any", label: t("group_filter_any") || "Any" });
    (people || []).forEach((person) => {
      if (!person?.id) return;
      options.push({ value: person.id, label: person.displayName || person.name || "" });
    });
    rejectedByPersonSelect.innerHTML = options.map((opt) => {
      const selected = opt.value === active ? " selected" : "";
      return `<option value="${escapeAttr(opt.value)}"${selected}>${escapeHtml(opt.label)}</option>`;
    }).join("");
    if (typeof rebuildCustomSelect === "function") {
      rebuildCustomSelect(rejectedByPersonSelect);
    } else if (typeof initCustomSelect === "function") {
      initCustomSelect(rejectedByPersonSelect);
    }
  }

  function classifyGroupItem({ approvalPct, rejectPct, dislikeCount, likeCount, groupSize }) {
    if (approvalPct >= 0.7 && dislikeCount === 0) return "recommended";
    const half = Math.ceil(groupSize / 2);
    if (dislikeCount >= half || rejectPct >= 0.34) return "avoid";
    if (dislikeCount >= 1 && likeCount >= 1) return "discussion";
    if (approvalPct >= 0.4 && approvalPct < 0.7) return "discussion";
    return "discussion";
  }

  function formatPercent(value, signed) {
    if (!Number.isFinite(value)) return "0%";
    const pct = Math.round(value * 100);
    if (signed && pct > 0) return `+${pct}%`;
    return `${pct}%`;
  }

  function clearResults() {
    state.results = null;
    if (resultsWrap) resultsWrap.hidden = true;
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
      let timeRange = start && end ? `${start}\u2013${end}` : (start || end || "");
      const dateLabel = date ? formatDate(date) : "";
      if (dateLabel && !timeRange) {
        timeRange = t("group_time_tbd") || "Time TBD";
      }
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

