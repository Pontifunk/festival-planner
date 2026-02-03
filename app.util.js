// ====== UTIL ======
function getBasePrefix() {
  const parts = location.pathname.split("/").filter(Boolean);
  const baseParts = parts.length >= 3 ? parts.slice(0, parts.length - 3) : parts;
  return baseParts.length ? `/${baseParts.join("/")}` : "";
}

function formatTemplate(template, vars) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, k) => (vars && k in vars ? vars[k] : ""));
}

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
        const label = `${formatDateTime(o.createdAt)}`;
        return `<option value="${escapeAttr(o.file)}">${escapeHtml(label)}</option>`;
      }).join("")
    : `<option value="">${escapeHtml(t("no_snapshots") || "No snapshots")}</option>`;

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
    if (!s || s === "[object Object]") return t("unknown_stage") || "Unknown stage";
    const key = normalizeStageName(s);
    if (useStageAliases && STAGE_ALIASES[key]) return STAGE_ALIASES[key];
    return s;
  }
  if (stage && typeof stage === "object") {
    const raw = String(stage.name || stage.title || stage.label || stage.stageName || stage.stage_name || (t("unknown_stage") || "Unknown stage")).trim();
    const key = normalizeStageName(raw);
    if (useStageAliases && STAGE_ALIASES[key]) return STAGE_ALIASES[key];
    return raw;
  }
  return t("unknown_stage") || "Unknown stage";
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
  return state.artists.byId.get(artistId)?.name || slot.artist || (t("unknown_artist") || "Unknown artist");
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

