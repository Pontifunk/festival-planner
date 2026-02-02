// ====== ROUTING ======
function getBootContext() {
  if (typeof window === "undefined") return null;
  const boot = window.__FP_BOOT;
  if (!boot || typeof boot !== "object") return null;
  const festival = cleanSegment(boot.event, /^[a-z0-9-]+$/i, "");
  const year = cleanSegment(boot.year, /^\d{4}$/, "");
  const weekend = cleanSegment(String(boot.weekend || ""), /^(w1|w2)$/i, "");
  const lang = cleanSegment(boot.lang, /^(de|en)$/i, "");
  if (!festival && !year && !weekend && !lang) return null;
  return { festival, year, weekend, lang };
}

function resolveInitialRoute(pathname, boot) {
  if (boot?.festival && boot?.year && boot?.weekend) {
    return { festival: boot.festival, year: boot.year, weekend: boot.weekend };
  }
  return parseRoute(pathname);
}

function ensureRouteDefaults(r) {
  const next = { ...r };
  if (!next.festival) next.festival = DEFAULT_FESTIVAL;
  if (!next.year) next.year = DEFAULT_YEAR;
  const weekend = normalizeWeekend(next.weekend);
  next.weekend = weekend ? weekend.toLowerCase() : DEFAULT_WEEKEND.toLowerCase();
  return next;
}

function formatFestivalName(slug) {
  const value = String(slug || "").trim();
  if (!value) return "Festival";
  return value
    .split("-")
    .map(part => part ? part[0].toUpperCase() + part.slice(1) : "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function upsertMetaTag(attr, key, content) {
  if (!document?.head) return;
  if (!content) return;
  let meta = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attr, key);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

function upsertLinkRel(rel, href) {
  if (!document?.head) return;
  if (!href) return;
  let link = document.head.querySelector(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", rel);
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

function applySeoFromRoute(r) {
  if (!r || typeof document === "undefined") return;
  const normalized = ensureRouteDefaults(r);
  const festivalName = formatFestivalName(normalized.festival);
  const year = normalized.year;
  const weekend = normalizeWeekend(normalized.weekend);
  const weekendNumber = weekend ? weekend.slice(1) : "";
  const titleTemplate = weekend ? (dict?.seo_title_weekend || "") : (dict?.seo_title_base || "");
  const descTemplate = weekend ? (dict?.seo_desc_weekend || "") : (dict?.seo_desc_base || "");
  const titleFallback = weekend
    ? `${festivalName} ${year} Weekend ${weekendNumber} Lineup Planner | Festival Planner`
    : `${festivalName} ${year} Lineup Planner | Festival Planner`;
  const descFallback = weekend
    ? `Privacy-first ${festivalName} ${year} Weekend ${weekendNumber} lineup planner to rate DJs, save favorites locally, and plan your schedule — no account, no tracking.`
    : `Privacy-first ${festivalName} ${year} lineup planner to rate DJs, save favorites locally, and plan W1/W2 — no account, no tracking.`;
  const title = formatTemplate(titleTemplate || titleFallback, {
    festival: festivalName,
    year,
    weekend: weekendNumber
  });
  const description = formatTemplate(descTemplate || descFallback, {
    festival: festivalName,
    year,
    weekend: weekendNumber
  });

  document.title = title;
  upsertMetaTag("name", "description", description);

  const canonical = `${SITE_ORIGIN}${canonicalPath(normalized)}`;
  upsertLinkRel("canonical", canonical);
  upsertMetaTag("property", "og:title", title);
  upsertMetaTag("property", "og:description", description);
  upsertMetaTag("property", "og:url", canonical);
  upsertMetaTag("property", "og:type", "website");
  upsertMetaTag("property", "og:image", `${SITE_ORIGIN}${OG_IMAGE_PATH}`);

  upsertMetaTag("name", "twitter:card", "summary");
  upsertMetaTag("name", "twitter:title", title);
  upsertMetaTag("name", "twitter:description", description);
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

