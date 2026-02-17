// ====== i18n ======
let dict = {};

function getI18nDevFlags() {
  let pseudoloc = false;
  let keyMode = false;
  try {
    const query = new URLSearchParams(location.search || "");
    if (query.has("pseudoloc")) {
      pseudoloc = query.get("pseudoloc") === "1";
      localStorage.setItem("fp_pseudoloc", pseudoloc ? "1" : "0");
    } else {
      pseudoloc = localStorage.getItem("fp_pseudoloc") === "1";
    }
    if (query.has("i18nqa")) {
      keyMode = query.get("i18nqa") === "1";
      localStorage.setItem("fp_i18n_qa", keyMode ? "1" : "0");
    } else {
      keyMode = localStorage.getItem("fp_i18n_qa") === "1";
    }
  } catch {
    // Ignore storage/query errors.
  }
  return { pseudoloc, keyMode };
}

function pseudolocalize(text) {
  const source = String(text || "");
  const parts = source.split(/(\{[a-zA-Z0-9_]+\})/g);
  const map = {
    a: "á", A: "Á", e: "ë", E: "Ë", i: "ï", I: "Ï", o: "õ", O: "Õ", u: "ü", U: "Ü",
    y: "ÿ", Y: "Ÿ", c: "ç", C: "Ç", n: "ñ", N: "Ñ"
  };
  const transformed = parts.map((part) => {
    if (/^\{[a-zA-Z0-9_]+\}$/.test(part)) return part;
    return part.split("").map((ch) => map[ch] || ch).join("");
  }).join("");
  return `[!! ${transformed} !!! !!]`;
}

function getTranslation(key) {
  if (!key) return "";
  const flags = getI18nDevFlags();
  if (flags.keyMode) return `[[${key}]]`;
  const value = dict[key] || key;
  if (flags.pseudoloc) return pseudolocalize(value);
  return value;
}

// Loads i18n JSON and updates localized text.
async function applyTranslations(newLang) {
  const res = await fetch(withBase(`/i18n/${newLang}.json`), { cache: "no-store" });
  dict = res.ok ? await res.json() : {};
  document.documentElement.lang = newLang;

  Array.from(document.querySelectorAll("[data-i18n]")).forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    el.textContent = getTranslation(key);
  });

  Array.from(document.querySelectorAll("[data-i18n-placeholder]")).forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (!key) return;
    el.setAttribute("placeholder", getTranslation(key));
  });

  Array.from(document.querySelectorAll("[data-i18n-aria-label]")).forEach(el => {
    const key = el.getAttribute("data-i18n-aria-label");
    if (!key) return;
    el.setAttribute("aria-label", getTranslation(key));
  });

  Array.from(document.querySelectorAll("[data-i18n-title]")).forEach(el => {
    const key = el.getAttribute("data-i18n-title");
    if (!key) return;
    el.setAttribute("title", getTranslation(key));
  });

  if (searchInput) searchInput.placeholder = t("search_placeholder") || "Search for artist";
  if (donateBtn?.getAttribute("aria-disabled") === "true") {
    donateBtn.title = t("donation_link_coming") || donateBtn.title;
  }
  if (playOverlayPanel) {
    updatePlayDefaultUI();
    const name = playOverlayTitle?.dataset?.artistName;
    if (name) {
      playOverlayTitle.textContent = formatTemplate(t("play_overlay_title") || "Open {name} in\u2026", { name });
    }
  }
  applySeoFromRoute(route);

  document.querySelectorAll("[data-custom-select]").forEach((sel) => syncCustomSelect(sel));
}

// Returns a translated string or the key fallback.
function t(key) {
  return getTranslation(key);
}

// Returns the localized "not available" placeholder.
function notAvailable() {
  return t("not_available_yet") || "Not available yet";
}
