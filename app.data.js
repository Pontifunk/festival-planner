// ====== LOADING ======
async function loadSnapshotIndex() {
  const url = withBase(`/data/${state.festival}/${state.year}/snapshots/index.json`);
  const index = await fetchJson(url, { cache: "no-store" });
  state.snapshotIndex = index;

  WEEKENDS.forEach((weekend) => {
    const options = (index.snapshots || [])
      .filter(s => String(s.file || "").toUpperCase().endsWith(`_${weekend}.JSON`))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

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
  const fallback = options.length ? options[0].file : null;
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

    w.lastCheckedUrl = "https://belgium.tomorrowland.com/en/line-up/";
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

// ====== GROUPING ======
function groupSlots(slots, ratingFilterValue, filters) {
  const byDate = new Map();
  const stageFilterActive = filters?.stage && filters.stage !== "all";

  slots.forEach(slot => {
    const artistId = slot.artistId || "";
    const rating = ratings[artistId] || "unrated";
    if (ratingFilterValue !== "all" && rating !== ratingFilterValue) return;

    const date = slot.date || extractDate(slot.start) || (t("unknown") || "Unknown");
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

// Builds stable artist slugs per weekend (used for static artist pages).
function buildArtistSlugMap(slots) {
  const baseById = new Map();
  const counts = new Map();

  slots.forEach((slot) => {
    const id = slot.artistId || "";
    if (!id || baseById.has(id)) return;
    const base = slugifyArtist(slot.artistNormalized || slot.artist || "artist");
    baseById.set(id, base);
    counts.set(base, (counts.get(base) || 0) + 1);
  });

  const out = new Map();
  baseById.forEach((base, id) => {
    const suffix = (counts.get(base) || 0) > 1 ? `-${id.slice(0, 6)}` : "";
    out.set(id, `${base}${suffix}`);
  });
  return out;
}

function slugifyArtist(value) {
  const base = String(value || "")
    .replace(/[ßẞ]/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "artist";
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

