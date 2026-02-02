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

  Array.from(document.querySelectorAll("[data-i18n-placeholder]")).forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key && dict[key]) el.setAttribute("placeholder", dict[key]);
  });

  Array.from(document.querySelectorAll("[data-i18n-aria-label]")).forEach(el => {
    const key = el.getAttribute("data-i18n-aria-label");
    if (key && dict[key]) el.setAttribute("aria-label", dict[key]);
  });

  Array.from(document.querySelectorAll("[data-i18n-title]")).forEach(el => {
    const key = el.getAttribute("data-i18n-title");
    if (key && dict[key]) el.setAttribute("title", dict[key]);
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
  return dict[key] || key;
}

// Returns the localized "not available" placeholder.
function notAvailable() {
  return t("not_available_yet") || "Not available yet";
}

