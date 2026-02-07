import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://festival-planner.org";
const FESTIVAL = process.env.FESTIVAL || "tomorrowland";
const YEAR = process.env.YEAR || "2026";

const snapshotPath = path.join(ROOT, "data", FESTIVAL, YEAR, "snapshots", "latest.json");
const artistsPath = path.join(ROOT, "data", FESTIVAL, YEAR, "artists", "latest.json");

const snapshotRaw = await fs.readFile(snapshotPath, "utf-8");
const snapshot = JSON.parse(snapshotRaw);
const slots = Array.isArray(snapshot.slots) ? snapshot.slots : [];

let artistMeta = new Map();
try {
  const artistsRaw = await fs.readFile(artistsPath, "utf-8");
  const artistsData = JSON.parse(artistsRaw);
  if (Array.isArray(artistsData.artists)) {
    artistMeta = new Map(artistsData.artists.map(a => [String(a.artistId || ""), a]));
  }
} catch {
  artistMeta = new Map();
}

const weekends = new Map();
for (const slot of slots) {
  const weekend = String(slot.weekend || "").toUpperCase();
  if (!weekend) continue;
  if (!weekends.has(weekend)) weekends.set(weekend, new Map());
  const artists = weekends.get(weekend);

  const artistId = String(slot.artistId || "");
  if (!artistId) continue;
  if (!artists.has(artistId)) {
    const name = String(slot.artist || "Unknown artist");
    const normalized = String(slot.artistNormalized || "");
    const meta = artistMeta.get(artistId) || {};
    const genres = Array.isArray(meta.genres) ? meta.genres.map(g => String(g || "")).filter(Boolean) : [];
    const links = extractSameAs(meta);
    const tomorrowlandArtistId = String(meta.tomorrowlandArtistId ?? "").trim();
    artists.set(artistId, {
      id: artistId,
      name,
      normalized,
      slots: [],
      stages: new Set(),
      genres,
      links,
      ...(tomorrowlandArtistId ? { tomorrowlandArtistId } : {})
    });
  }
  const entry = artists.get(artistId);
  entry.slots.push(slot);
  if (slot.stage) entry.stages.add(String(slot.stage));
}

function slugify(value) {
  const base = String(value || "")
    .replace(/[�?]/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "artist";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function extractSameAs(meta) {
  const candidates = [];
  const add = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }
    if (typeof value === "object") {
      if (value.url) return add(value.url);
      if (value.href) return add(value.href);
      return;
    }
    if (typeof value === "string") candidates.push(value);
  };

  add(meta.links);
  add(meta.socials);
  for (const key of [
    "spotify",
    "spotifyUrl",
    "spotifyLink",
    "soundcloud",
    "soundcloudUrl",
    "soundcloudLink",
    "youtube",
    "youtubeUrl",
    "youtubeLink",
    "appleMusic",
    "appleMusicUrl",
    "appleMusicLink",
    "applemusic",
    "applemusicUrl",
    "applemusicLink"
  ]) {
    add(meta[key]);
  }

  const clean = candidates
    .map((value) => String(value || "").trim())
    .filter((value) => /^https?:\/\//i.test(value));
  return Array.from(new Set(clean));
}

function buildArtistSlugMap(artists) {
  const baseById = new Map();
  const counts = new Map();
  for (const artist of artists.values()) {
    const base = slugify(artist.normalized || artist.name);
    baseById.set(artist.id, base);
    counts.set(base, (counts.get(base) || 0) + 1);
  }
  const out = new Map();
  for (const [id, base] of baseById.entries()) {
    const suffix = (counts.get(base) || 0) > 1 ? `-${id.slice(0, 6)}` : "";
    out.set(id, `${base}${suffix}`);
  }
  return out;
}

function renderArtistPage({ artist, weekend, slug }) {
  const weekendNum = weekend.slice(1);
  const weekendLower = weekend.toLowerCase();
  const title = `${artist.name} - Tomorrowland ${YEAR} (Wochenende ${weekendNum}) | Festival Planner`;
  const description = `Offline planen für Tomorrowland ${YEAR} Wochenende ${weekendNum}. Kein Account, kein Tracking.`;
  const canonical = `${SITE_ORIGIN}/${FESTIVAL}/${YEAR}/${weekendLower}/artists/${slug}/`;
  const stages = Array.from(artist.stages).sort();
  const genres = Array.isArray(artist.genres) ? artist.genres : [];
  const plannerUrl = `/${FESTIVAL}/${YEAR}/${weekendLower}/?artist=${encodeURIComponent(slug)}`;
  const tomorrowlandArtistId = String(artist.tomorrowlandArtistId ?? "").trim();
  const tmlUrlEn = tomorrowlandArtistId
    ? `https://belgium.tomorrowland.com/en/line-up/?page=artists&artist=${encodeURIComponent(tomorrowlandArtistId)}`
    : "";
  const sameAs = Array.isArray(artist.links)
    ? artist.links.map(link => String(link || "")).filter(Boolean)
    : [];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    "name": artist.name,
    "url": canonical
  };
  if (sameAs.length) jsonLd.sameAs = sameAs;

  return `<!doctype html>
<html lang="de">
<head>
  <!-- Generated by scripts/generate-artist-pages.mjs; do not edit. -->
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="${SITE_ORIGIN}/icons/og.png">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${SITE_ORIGIN}/icons/og.png">
  <link rel="stylesheet" href="/styles.css">
  <script type="application/ld+json">
    ${JSON.stringify(jsonLd)}
  </script>
</head>
<body class="simplePage">
  <header class="topbar" id="top">
    <div class="brand">
      <a class="logoLink" href="/" aria-label="Festival Planner">
        <div class="logo">FP</div>
      </a>
      <div class="brandText">
        <div class="title">Festival Planner</div>
        <div class="subtitle" id="artistSubtitle" data-i18n="artist_subtitle">Artist details (privacy-first, no tracking)</div>
      </div>
    </div>
  </header>

  <main class="layout">
    <section class="panel">
      <div class="card">
        <div class="cardTitle">${escapeHtml(artist.name)}</div>
        ${tomorrowlandArtistId ? `
        <div class="tmlLinkRow">
          <a class="tmlLink" href="${escapeHtml(tmlUrlEn)}" target="_blank" rel="noopener noreferrer" aria-label="Open official Tomorrowland artist page" title="Official Tomorrowland page" data-tml-id="${escapeHtml(tomorrowlandArtistId)}" data-i18n="tml_artist_page">Tomorrowland DJ Page</a>
        </div>
        ` : ""}
        <div class="muted" id="artistMeta" data-i18n="artist_meta">Tomorrowland ${YEAR} - Wochenende ${weekendNum}</div>
        <div style="margin-top:12px">
          <button class="btn" id="backToLineup" type="button" data-fallback="${escapeHtml(plannerUrl)}" data-i18n="artist_back_to_lineup">Back to line-up</button>
        </div>
        ${stages.length ? `<div class="muted" style="margin-top:12px" data-i18n="artist_stages_label">Stages</div><div class="muted" style="margin-top:4px">${escapeHtml(stages.join(", "))}</div>` : ""}
        ${genres.length ? `<div class="muted" style="margin-top:6px" data-i18n="artist_tags_label">Tags</div><div class="muted" style="margin-top:4px">${escapeHtml(genres.join(", "))}</div>` : ""}
        <div class="muted" style="margin-top:8px" id="artistPrivacy" data-i18n="artist_privacy">Offline planning, no account, no tracking.</div>
      </div>

      <div class="card" style="margin-top:12px">
        <div class="cardTitle" id="ratingTitle" data-i18n="artist_rating_title">Your rating</div>
        <div class="badges" style="margin-top:8px">
          <div class="badge" id="artistRatingBadge" data-i18n="unrated">Unrated</div>
        </div>
        <div class="ratingSegmented" id="artistRatingControls" data-artist-id="${escapeHtml(artist.id)}" role="group" aria-label="Rating" data-i18n-aria-label="rating_label">
          <button class="ratingSegBtn" data-rate="liked" type="button" aria-pressed="false" aria-label="Liked" data-i18n-aria-label="liked">
            <span class="ratingEmoji" aria-hidden="true">&#x1F44D;&#xFE0F;</span>
            <span class="segLabel" data-i18n="liked">Liked</span>
          </button>
          <button class="ratingSegBtn" data-rate="maybe" type="button" aria-pressed="false" aria-label="Maybe" data-i18n-aria-label="maybe">
            <span class="ratingEmoji" aria-hidden="true">&#x1F914;</span>
            <span class="segLabel" data-i18n="maybe">Maybe</span>
          </button>
          <button class="ratingSegBtn" data-rate="disliked" type="button" aria-pressed="false" aria-label="Disliked" data-i18n-aria-label="disliked">
            <span class="ratingEmoji" aria-hidden="true">&#x1F44E;&#xFE0F;</span>
            <span class="segLabel" data-i18n="disliked">Dislike</span>
          </button>
          <button class="ratingSegBtn" data-rate="unrated" type="button" aria-pressed="false" aria-label="Reset" data-i18n-aria-label="rating_reset">
            <span class="ratingEmoji" aria-hidden="true">&#x21BA;&#xFE0F;</span>
            <span class="segLabel" data-i18n="rating_reset">Reset</span>
          </button>
        </div>
        <div class="playRow" style="margin-top:10px">
          <button class="playBtn" type="button" id="artistPlayBtn" aria-label="Play ${escapeHtml(artist.name)}">
            <span class="playIcon" aria-hidden="true">&#x25B6;</span>
            <span class="playText" data-i18n="play">Play</span>
          </button>
          <button class="playMoreBtn" type="button" id="artistPlayMoreBtn" aria-label="Choose platform for ${escapeHtml(artist.name)}">
            <span class="playMoreIcon" aria-hidden="true">&#x22EF;</span>
          </button>
        </div>
        <div class="muted" style="margin-top:8px" id="ratingNote" data-i18n="artist_rating_note">Stored locally in your browser.</div>
      </div>
    </section>
  </main>

  <script>
    window.state = { festival: "${escapeHtml(FESTIVAL)}", year: "${escapeHtml(YEAR)}" };
    window.ratings = {};
  </script>
  <script src="/app.store.js"></script>
  <script>
    (function () {
      var artistName = ${JSON.stringify(String(artist.name || ""))};
      var fallback = {
        de: {
          artist_subtitle: "Artist-Details (privacy-first, ohne Tracking)",
          artist_back_to_lineup: "Zur\u00fcck zum Line-up",
          artist_privacy: "Offline planen, ohne Account, ohne Tracking.",
          artist_rating_title: "Deine Bewertung",
          liked: "Gef\u00e4llt mir",
          maybe: "Vielleicht",
          disliked: "Mag ich nicht",
          unrated: "Unbewertet",
          rating_reset: "Reset",
          saved: "Gespeichert \u2713",
          artist_rating_note: "Lokal in deinem Browser gespeichert.",
          play: "Play",
          play_choose_platform: "Plattform f\u00fcr {name} w\u00e4hlen",
          play_open_links: "Play-Links f\u00fcr {name} \u00f6ffnen",
          play_default: "Standard",
          play_set_default: "Als Standard setzen",
          play_copy_label: "DJ-Name in Zwischenablage",
          play_copy_on: "Aktiviert",
          play_copy_off: "Aus",
          play_copy_toast: "DJ-Name kopiert",
          tml_artist_page: "Tomorrowland DJ-Seite",
          artist_meta: "{festival} {year} - Wochenende {weekend}",
          artist_title: "{name} - {festival} {year} (Wochenende {weekend}) | Festival Planner",
          artist_desc: "Offline planen f\u00fcr {festival} {year} Wochenende {weekend}. Kein Account, kein Tracking.",
          artist_stages_label: "Stages",
          artist_tags_label: "Tags"
        },
        en: {
          artist_subtitle: "Artist details (privacy-first, no tracking)",
          artist_back_to_lineup: "Back to line-up",
          artist_privacy: "Offline planning, no account, no tracking.",
          artist_rating_title: "Your rating",
          liked: "Like",
          maybe: "Maybe",
          disliked: "Dislike",
          unrated: "Not rated",
          rating_reset: "Reset",
          saved: "Saved \u2713",
          artist_rating_note: "Stored locally in your browser.",
          play: "Play",
          play_choose_platform: "Choose platform for {name}",
          play_open_links: "Open play links for {name}",
          play_default: "Default",
          play_set_default: "Set as default",
          play_copy_label: "Copy DJ name to clipboard",
          play_copy_on: "On",
          play_copy_off: "Off",
          play_copy_toast: "DJ name copied",
          tml_artist_page: "Tomorrowland DJ Page",
          artist_meta: "{festival} {year} - Weekend {weekend}",
          artist_title: "{name} - {festival} {year} (Weekend {weekend}) | Festival Planner",
          artist_desc: "Offline planning for {festival} {year} Weekend {weekend}. No account, no tracking.",
          artist_stages_label: "Stages",
          artist_tags_label: "Tags"
        }
      };

      var storedLang = localStorage.getItem("fp_lang");
      var lang = (storedLang || "").toLowerCase();
      if (lang !== "de" && lang !== "en") {
        var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ""];
        var foundDe = false;
        for (var i = 0; i < list.length; i++) {
          var base = String(list[i] || "").toLowerCase().split("-")[0];
          if (base === "de") { foundDe = true; break; }
        }
        lang = foundDe ? "de" : "en";
      }
      if (!storedLang && lang) localStorage.setItem("fp_lang", lang);
      document.documentElement.lang = lang;

      var tmlLink = document.querySelector(".tmlLink[data-tml-id]");
      if (tmlLink) {
        var tmlId = tmlLink.getAttribute("data-tml-id") || "";
        var tmlLocale = (lang === "nl" || lang === "fr" || lang === "en") ? lang : "en";
        tmlLink.setAttribute(
          "href",
          "https://belgium.tomorrowland.com/" + tmlLocale + "/line-up/?page=artists&artist=" + encodeURIComponent(tmlId)
        );
      }

      function formatTemplate(template, vars) {
        return String(template || "").replace(/\\{(\\w+)\\}/g, function (_, key) {
          return (vars && key in vars) ? vars[key] : "";
        });
      }

      var festivalName = "${FESTIVAL}".replace(/^./, function (m) { return m.toUpperCase(); });
      var vars = { name: artistName, festival: festivalName, year: "${YEAR}", weekend: "${weekendNum}" };

      function applyTranslations(dict) {
        Array.prototype.forEach.call(document.querySelectorAll("[data-i18n]"), function (el) {
          var key = el.getAttribute("data-i18n");
          if (!key || !dict[key]) return;
          var value = dict[key];
          if (value && value.indexOf("{") !== -1) {
            value = formatTemplate(value, vars);
          }
          el.textContent = value;
        });
        Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-aria-label]"), function (el) {
          var key = el.getAttribute("data-i18n-aria-label");
          if (!key || !dict[key]) return;
          var value = dict[key];
          if (value && value.indexOf("{") !== -1) {
            value = formatTemplate(value, vars);
          }
          el.setAttribute("aria-label", value);
        });
        Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-title]"), function (el) {
          var key = el.getAttribute("data-i18n-title");
          if (!key || !dict[key]) return;
          var value = dict[key];
          if (value && value.indexOf("{") !== -1) {
            value = formatTemplate(value, vars);
          }
          el.setAttribute("title", value);
        });
      }

      function loadDict() {
        return fetch("/i18n/" + lang + ".json", { cache: "no-store" })
          .then(function (res) { return res.ok ? res.json() : null; })
          .catch(function () { return null; })
          .then(function (data) { return data || fallback[lang] || fallback.en; });
      }

      loadDict().then(function (dict) {
        applyTranslations(dict);

        var titleText = formatTemplate(dict.artist_title || fallback.en.artist_title, vars);
        var descText = formatTemplate(dict.artist_desc || fallback.en.artist_desc, vars);

        var meta = document.getElementById("artistMeta");
        if (meta) meta.textContent = formatTemplate(dict.artist_meta || fallback.en.artist_meta, vars);

        var titleEl = document.querySelector("title");
        if (titleEl) titleEl.textContent = titleText;
        var metaDesc = document.querySelector("meta[name='description']");
        if (metaDesc) metaDesc.setAttribute("content", descText);
        var ogTitle = document.querySelector("meta[property='og:title']");
        if (ogTitle) ogTitle.setAttribute("content", titleText);
        var ogDesc = document.querySelector("meta[property='og:description']");
        if (ogDesc) ogDesc.setAttribute("content", descText);
        var twTitle = document.querySelector("meta[name='twitter:title']");
        if (twTitle) twTitle.setAttribute("content", titleText);
        var twDesc = document.querySelector("meta[name='twitter:description']");
        if (twDesc) twDesc.setAttribute("content", descText);

        var ratingControls = document.getElementById("artistRatingControls");
        var badge = document.getElementById("artistRatingBadge");
        if (ratingControls) {
          var btnLiked = ratingControls.querySelector("[data-rate='liked'] .segLabel");
          var btnMaybe = ratingControls.querySelector("[data-rate='maybe'] .segLabel");
          var btnDisliked = ratingControls.querySelector("[data-rate='disliked'] .segLabel");
          var btnReset = ratingControls.querySelector("[data-rate='unrated'] .segLabel");
          if (btnLiked) btnLiked.textContent = dict.liked || fallback.en.liked;
          if (btnMaybe) btnMaybe.textContent = dict.maybe || fallback.en.maybe;
          if (btnDisliked) btnDisliked.textContent = dict.disliked || fallback.en.disliked;
          if (btnReset) btnReset.textContent = dict.rating_reset || fallback.en.rating_reset;
        }

        var labels = {
          liked: dict.liked || fallback.en.liked,
          maybe: dict.maybe || fallback.en.maybe,
          disliked: dict.disliked || fallback.en.disliked,
          unrated: dict.unrated || fallback.en.unrated
        };

      var toast = null;
      var toastTimer = null;
      function showToast(text) {
        if (!text) return;
        if (!toast) {
          toast = document.createElement("div");
          toast.className = "toast";
          toast.setAttribute("role", "status");
          toast.setAttribute("aria-live", "polite");
          toast.setAttribute("aria-atomic", "true");
          document.body.appendChild(toast);
        }
        toast.textContent = text;
        toast.classList.add("isVisible");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
          toast.classList.remove("isVisible");
        }, 1400);
      }

      function applyState(rate) {
        var value = rate || "unrated";
        if (badge) badge.textContent = labels[value] || labels.unrated;
        if (!ratingControls) return;
        Array.prototype.forEach.call(ratingControls.querySelectorAll(".ratingSegBtn"), function (btn) {
          var isActive = btn.getAttribute("data-rate") === value;
          btn.classList.toggle("isActive", isActive);
          btn.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
      }

      function loadRating() {
        if (!ratingControls) return;
        if (typeof dbGetAll !== "function" || typeof makeDbKeyPrefix !== "function") {
          applyState("unrated");
          return;
        }
        var artistId = ratingControls.getAttribute("data-artist-id") || "";
        dbGetAll(makeDbKeyPrefix(state)).then(function (all) {
          ratings = all || {};
          applyState(ratings[artistId] || "unrated");
        }).catch(function () {
          applyState("unrated");
        });
      }

      if (ratingControls) Array.prototype.forEach.call(ratingControls.querySelectorAll(".ratingSegBtn"), function (btn) {
        btn.addEventListener("click", function () {
          var rate = btn.getAttribute("data-rate") || "unrated";
          var artistId = ratingControls.getAttribute("data-artist-id") || "";
          if (typeof setRating !== "function") {
            applyState(rate);
            showToast(dict.saved || fallback.en.saved);
            return;
          }
          Promise.resolve(setRating(artistId, rate)).then(function () {
            applyState(rate);
            showToast(dict.saved || fallback.en.saved);
          });
        });
      });

      loadRating();

      var playLabel = dict.play || fallback.en.play;
      var playMoreLabel = formatTemplate(dict.play_choose_platform || fallback.en.play_choose_platform, { name: artistName });
      var playOpenLabel = formatTemplate(dict.play_open_links || fallback.en.play_open_links, { name: artistName });
      var playSetDefaultLabel = dict.play_set_default || fallback.en.play_set_default;
      var playCopyLabel = dict.play_copy_label || fallback.en.play_copy_label;
      var playCopyOn = dict.play_copy_on || fallback.en.play_copy_on;
      var playCopyOff = dict.play_copy_off || fallback.en.play_copy_off;
      var playCopyToast = dict.play_copy_toast || fallback.en.play_copy_toast;

      var PLAY_PROVIDER_KEY = "fp_play_provider";
      var PLAY_COPY_KEY = "fp_play_copy_name";

      function isMobileDevice() {
        var ua = navigator.userAgent || "";
        var uaMobile = /iPhone|iPad|iPod|Android/i.test(ua);
        var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
        return uaMobile || coarse;
      }

      function isIOSDevice() {
        var ua = navigator.userAgent || "";
        if (/iPhone|iPad|iPod/i.test(ua)) return true;
        return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
      }

      function isStandaloneMode() {
        if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
        return !!navigator.standalone;
      }

      function openLink(url) {
        if (!url) return;
        if (isIOSDevice() || isStandaloneMode()) {
          window.location.href = url;
          return;
        }
        var win = window.open(url, "_blank", "noopener,noreferrer");
        if (!win) window.location.href = url;
      }

      function openWithFallback(opts) {
        if (!opts || !opts.deepUrl || !opts.webUrl) return;
        var timer = null;
        function cleanup() {
          if (timer) clearTimeout(timer);
          timer = null;
          document.removeEventListener("visibilitychange", onVisibilityChange);
          window.removeEventListener("pagehide", onPageHide);
          window.removeEventListener("blur", onBlur);
        }
        function openWeb() {
          cleanup();
          window.location.href = opts.webUrl;
        }
        function onVisibilityChange() {
          if (document.visibilityState === "hidden") cleanup();
        }
        function onPageHide() { cleanup(); }
        function onBlur() {
          if (document.visibilityState === "hidden") cleanup();
        }
        document.addEventListener("visibilitychange", onVisibilityChange, { once: true });
        window.addEventListener("pagehide", onPageHide, { once: true });
        window.addEventListener("blur", onBlur, { once: true });
        timer = setTimeout(openWeb, 700);
        window.location.href = opts.deepUrl;
      }

      function makeSpotifySearchUrl(name){ return "https://open.spotify.com/search/" + encodeURIComponent(name); }
      function makeAppleMusicSearchUrl(name){ return "https://music.apple.com/search?term=" + encodeURIComponent(name); }
      function makeYouTubeSearchUrl(name){
        var query = ((name || "") + " Tomorrowland set").trim();
        return "https://www.youtube.com/results?search_query=" + encodeURIComponent(query);
      }
      function makeSoundCloudSearchUrl(name){ return "https://soundcloud.com/search?q=" + encodeURIComponent(name); }
      function getPlayProvider() { return localStorage.getItem(PLAY_PROVIDER_KEY) || "sp"; }
      function setPlayProvider(value) { if (value) localStorage.setItem(PLAY_PROVIDER_KEY, value); }
      function getPlayCopyEnabled() { return localStorage.getItem(PLAY_COPY_KEY) === "true"; }
      function setPlayCopyEnabled(value) { localStorage.setItem(PLAY_COPY_KEY, value ? "true" : "false"); }
      function buildPlayUrls(name) {
        return { sp: makeSpotifySearchUrl(name), am: makeAppleMusicSearchUrl(name), yt: makeYouTubeSearchUrl(name), sc: makeSoundCloudSearchUrl(name) };
      }

      function buildPlayLinks(name) {
        var term = (name || "").trim();
        var encoded = encodeURIComponent(term);
        return {
          sp: { web: "https://open.spotify.com/search/" + encoded, deep: "spotify:search:" + encodeURIComponent(term) },
          am: { web: "https://music.apple.com/search?term=" + encoded },
          yt: { web: "https://www.youtube.com/results?search_query=" + encodeURIComponent(((term || "") + " Tomorrowland set").trim()) },
          sc: { web: "https://soundcloud.com/search?q=" + encoded, deep: "soundcloud://search?q=" + encoded }
        };
      }

      function copyArtistName(name) {
        var text = String(name || "").trim();
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            showToast(playCopyToast || "DJ name copied");
          }).catch(function () {});
          return;
        }
        try {
          var el = document.createElement("textarea");
          el.value = text;
          el.setAttribute("readonly", "true");
          el.style.position = "absolute";
          el.style.left = "-9999px";
          document.body.appendChild(el);
          el.select();
          document.execCommand("copy");
          document.body.removeChild(el);
          showToast(playCopyToast || "DJ name copied");
        } catch (e) {}
      }

      function openPlayService(provider) {
        var links = buildPlayLinks(artistName);
        var entry = links && links[provider];
        if (!entry || !entry.web) return;
        if (getPlayCopyEnabled()) copyArtistName(artistName);
        var mobile = isMobileDevice();
        var allowDeepLink = mobile && entry.deep && provider !== "sc";
        if (allowDeepLink) {
          openWithFallback({ deepUrl: entry.deep, webUrl: entry.web, fallbackMs: 700 });
          return;
        }
        openLink(entry.web);
      }

      function openDefaultPlay() {
        var provider = getPlayProvider() || "sp";
        openPlayService(provider);
      }

      var playBtn = document.getElementById("artistPlayBtn");
      var playMoreBtn = document.getElementById("artistPlayMoreBtn");
      if (playBtn) {
        playBtn.setAttribute("aria-label", playOpenLabel);
        var playText = playBtn.querySelector(".playText");
        if (playText) playText.textContent = playLabel;
      }
      if (playMoreBtn) playMoreBtn.setAttribute("aria-label", playMoreLabel);

      var playOverlay = null;
      var playOverlayPanel = null;
      var playOverlayTitle = null;
      var playOverlayLinks = null;
      var playOverlayTrigger = null;
      var playCopyToggleBtn = null;
      var playCopyLabelEl = null;

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
        playOverlayTitle.textContent = playMoreLabel;

        var list = document.createElement("div");
        list.className = "playPanelList";

        function makeRow(key, label) {
          var row = document.createElement("div");
          row.className = "playRowItem";

          var a = document.createElement("a");
          a.className = "playLink " + key;
          a.setAttribute("data-provider", key);
          a.setAttribute("target", "_blank");
          a.setAttribute("rel", "noopener noreferrer");
          a.href = "#";
          a.textContent = label;

          var setBtn = document.createElement("button");
          setBtn.type = "button";
          setBtn.className = "playDefaultBtn";
          setBtn.setAttribute("data-provider", key);
          setBtn.textContent = playSetDefaultLabel;

          row.append(a, setBtn);
          return { row: row, link: a, setBtn: setBtn };
        }

        function makeToggleRow() {
          var row = document.createElement("div");
          row.className = "playRowItem";

          var label = document.createElement("div");
          label.className = "playLink copy";
          label.textContent = playCopyLabel;

          var toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "playDefaultBtn";
          toggle.setAttribute("data-action", "toggleCopyName");
          toggle.setAttribute("aria-pressed", "false");
          toggle.textContent = playCopyOff;

          row.append(label, toggle);
          return { row: row, label: label, button: toggle };
        }

        var sp = makeRow("sp", "Spotify");
        var am = makeRow("am", "Apple Music");
        var yt = makeRow("yt", "YouTube");
        var sc = makeRow("sc", "SoundCloud");
        var copyRow = makeToggleRow();

        playOverlayLinks = [sp.link, am.link, yt.link, sc.link];
        playCopyToggleBtn = copyRow.button;
        playCopyLabelEl = copyRow.label;
        list.append(sp.row, am.row, yt.row, sc.row, copyRow.row);

        playOverlayPanel.append(playOverlayTitle, list);
        playOverlay.append(playOverlayPanel);
        document.body.append(playOverlay);

        playOverlay.addEventListener("click", function (e) {
          if (e.target === playOverlay) closePlayOverlay();
        });

        playOverlayPanel.addEventListener("click", function (e) {
          var link = e.target.closest("a.playLink");
          if (link) {
            var provider = link.getAttribute("data-provider");
            var shouldIntercept = isMobileDevice() && provider === "sp";
            if (shouldIntercept || getPlayCopyEnabled()) {
              e.preventDefault();
              openPlayService(provider);
            }
            closePlayOverlay();
            return;
          }
          var copyBtn = e.target.closest("button[data-action='toggleCopyName']");
          if (copyBtn) {
            var next = !getPlayCopyEnabled();
            setPlayCopyEnabled(next);
            updatePlayDefaultUI();
            showToast(dict.saved || fallback.en.saved);
            return;
          }
          var setBtn = e.target.closest(".playDefaultBtn");
          if (setBtn) {
            var provider = setBtn.getAttribute("data-provider");
            setPlayProvider(provider);
            updatePlayDefaultUI();
          }
        });
      }

      function positionPlayOverlay(trigger) {
        if (!playOverlayPanel || !trigger) return;
        var isMobile = window.matchMedia("(max-width: 720px)").matches;
        playOverlay.classList.toggle("isSheet", isMobile);
        if (isMobile) return;

        var rect = trigger.getBoundingClientRect();
        var margin = 8;
        var left = Math.min(Math.max(rect.left + rect.width / 2, 16), window.innerWidth - 16);
        playOverlayPanel.style.left = left + "px";
        playOverlayPanel.style.top = (rect.bottom + margin) + "px";
        playOverlayPanel.style.transform = "translateX(-50%)";

        var panelRect = playOverlayPanel.getBoundingClientRect();
        if (panelRect.bottom > window.innerHeight - 8 && rect.top > panelRect.height + margin) {
          playOverlayPanel.style.top = (rect.top - margin) + "px";
          playOverlayPanel.style.transform = "translate(-50%, -100%)";
        }
      }

      function openPlayOverlay(trigger) {
        ensurePlayOverlay();
        playOverlayTrigger = trigger || null;

        var urls = buildPlayUrls(artistName);
        playOverlayLinks[0].href = urls.sp;
        playOverlayLinks[1].href = urls.am;
        playOverlayLinks[2].href = urls.yt;
        playOverlayLinks[3].href = urls.sc;
        if (playCopyLabelEl) playCopyLabelEl.textContent = playCopyLabel;
        updatePlayDefaultUI();

        playOverlay.hidden = false;
        playOverlay.classList.add("isOpen");
        positionPlayOverlay(trigger);
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
        var current = getPlayProvider();
        Array.prototype.forEach.call(playOverlayPanel.querySelectorAll(".playDefaultBtn[data-provider]"), function (btn) {
          var key = btn.getAttribute("data-provider");
          var isActive = key === current;
          btn.classList.toggle("isActive", isActive);
          btn.textContent = isActive
            ? (dict.play_default || fallback.en.play_default)
            : (dict.play_set_default || fallback.en.play_set_default);
        });
        if (playCopyToggleBtn) {
          var enabled = getPlayCopyEnabled();
          playCopyToggleBtn.classList.toggle("isActive", enabled);
          playCopyToggleBtn.setAttribute("aria-pressed", enabled ? "true" : "false");
          playCopyToggleBtn.textContent = enabled ? playCopyOn : playCopyOff;
        }
      }

      var backBtn = document.getElementById("backToLineup");
      if (backBtn) {
        backBtn.addEventListener("click", function () {
          var canGoBack = false;
          if (history.length > 1 && document.referrer) {
            try {
              canGoBack = new URL(document.referrer).origin === location.origin;
            } catch (e) {
              canGoBack = false;
            }
          }
          if (canGoBack) {
            history.back();
          } else {
            var fallback = backBtn.getAttribute("data-fallback") || "/";
            location.href = fallback;
          }
        });
      }

      if (playBtn) {
        playBtn.setAttribute("aria-label", playOpenLabel);
        var playText = playBtn.querySelector(".playText");
        if (playText) playText.textContent = playLabel;
        var longPress = { timer: null, fired: false };
        playBtn.addEventListener("pointerdown", function (e) {
          if (e.button !== void 0 && e.button !== 0) return;
          longPress.fired = false;
          longPress.timer = setTimeout(function () {
            longPress.fired = true;
            openPlayOverlay(playBtn);
          }, 550);
        }, { passive: true });
        playBtn.addEventListener("pointerup", function () {
          if (longPress.timer) clearTimeout(longPress.timer);
          longPress.timer = null;
        }, { passive: true });
        playBtn.addEventListener("pointercancel", function () {
          if (longPress.timer) clearTimeout(longPress.timer);
          longPress.timer = null;
        }, { passive: true });
        playBtn.addEventListener("click", function (e) {
          if (longPress.fired) {
            e.preventDefault();
            return;
          }
          openDefaultPlay();
        });
      }
      if (playMoreBtn) playMoreBtn.setAttribute("aria-label", playMoreLabel);
      if (playMoreBtn) playMoreBtn.addEventListener("click", function () { openPlayOverlay(playMoreBtn); });

      document.addEventListener("keydown", function (e) {
        if (!playOverlay || playOverlay.hidden) return;
        if (e.key === "Escape") {
          e.preventDefault();
          closePlayOverlay();
        }
      });
      window.addEventListener("resize", function () {
        if (!playOverlay || playOverlay.hidden || !playOverlayTrigger) return;
        positionPlayOverlay(playOverlayTrigger);
      });
      });
    })();
  </script>
</body>
</html>`;
}

function renderArtistIndexPage({ weekend, entries }) {
  const weekendNum = weekend.slice(1);
  const weekendLower = weekend.toLowerCase();
  const title = `Tomorrowland ${YEAR} Artists (Wochenende ${weekendNum}) | Festival Planner`;
  const description = `Artist-Verzeichnis für Tomorrowland ${YEAR} Wochenende ${weekendNum}. Privacy-first, kein Tracking.`;
  const canonical = `${SITE_ORIGIN}/${FESTIVAL}/${YEAR}/${weekendLower}/artists/`;
  const plannerUrl = `/${FESTIVAL}/${YEAR}/${weekendLower}/`;
  const list = entries.map((entry) => `        <div class="act" role="listitem">
          <div>
            <div class="actName">
              <a class="actNameLink" href="./${escapeHtml(entry.slug)}/">${escapeHtml(entry.name)}</a>
            </div>
          </div>
        </div>`).join("\n");

  return `<!doctype html>
<html lang="de">
<head>
  <!-- Generated by scripts/generate-artist-pages.mjs; do not edit. -->
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="${SITE_ORIGIN}/icons/og.png">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${SITE_ORIGIN}/icons/og.png">
  <link rel="icon" href="/favicon.ico">
  <link rel="stylesheet" href="/styles.css">
  <meta name="theme-color" content="#2c1a60">
</head>
<body class="simplePage">
  <header class="topbar" id="top">
    <div class="brand">
      <a class="logoLink" href="/" aria-label="Festival Planner">
        <div class="logo">FP</div>
      </a>
      <div class="brandText">
        <div class="title">Festival Planner</div>
        <div class="subtitle" id="artistIndexSubtitle">Artist directory (privacy-first, no tracking)</div>
      </div>
    </div>
  </header>

  <main class="layout">
    <section class="panel">
      <div class="card">
        <h1 class="cardTitle" id="artistIndexTitle">Tomorrowland ${YEAR} Artists - Weekend ${weekendNum}</h1>
        <div class="muted" id="artistIndexNote">Offline planning, no account, no tracking.</div>
        <div style="margin-top:12px">
          <button class="btn" id="backToPlanner" type="button" data-fallback="${escapeHtml(plannerUrl)}">Back to Planner</button>
        </div>
      </div>
      <div class="list" role="list" style="margin-top:12px">
${list}
      </div>
    </section>
  </main>

  <script>
    (function () {
      var dict = {
        de: {
          subtitle: "Artist-Verzeichnis (privacy-first, ohne Tracking)",
          title: "Tomorrowland ${YEAR} Artists - Wochenende ${weekendNum}",
          note: "Offline planen, ohne Account, ohne Tracking.",
          back: "Zur\u00fcck zum Planner",
          desc: "Artist-Verzeichnis f\u00fcr Tomorrowland ${YEAR} Wochenende ${weekendNum}. Privacy-first, kein Tracking."
        },
        en: {
          subtitle: "Artist directory (privacy-first, no tracking)",
          title: "Tomorrowland ${YEAR} Artists - Weekend ${weekendNum}",
          note: "Offline planning, no account, no tracking.",
          back: "Back to Planner",
          desc: "Artist directory for Tomorrowland ${YEAR} Weekend ${weekendNum}. Privacy-first, no tracking."
        }
      };

      var storedLang = localStorage.getItem("fp_lang");
      var lang = (storedLang || "").toLowerCase();
      if (lang !== "de" && lang !== "en") {
        var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ""];
        var foundDe = false;
        for (var i = 0; i < list.length; i++) {
          var base = String(list[i] || "").toLowerCase().split("-")[0];
          if (base === "de") { foundDe = true; break; }
        }
        lang = foundDe ? "de" : "en";
      }
      if (!storedLang && lang) localStorage.setItem("fp_lang", lang);
      document.documentElement.lang = lang;
      var t = dict[lang];

      var subtitle = document.getElementById("artistIndexSubtitle");
      if (subtitle) subtitle.textContent = t.subtitle;
      var titleEl = document.getElementById("artistIndexTitle");
      if (titleEl) titleEl.textContent = t.title;
      var note = document.getElementById("artistIndexNote");
      if (note) note.textContent = t.note;
      var back = document.getElementById("backToPlanner");
      if (back) back.textContent = t.back;

      var docTitle = document.querySelector("title");
      if (docTitle) docTitle.textContent = t.title + " | Festival Planner";
      var metaDesc = document.querySelector("meta[name='description']");
      if (metaDesc) metaDesc.setAttribute("content", t.desc);
      var ogTitle = document.querySelector("meta[property='og:title']");
      if (ogTitle) ogTitle.setAttribute("content", t.title + " | Festival Planner");
      var ogDesc = document.querySelector("meta[property='og:description']");
      if (ogDesc) ogDesc.setAttribute("content", t.desc);
      var twTitle = document.querySelector("meta[name='twitter:title']");
      if (twTitle) twTitle.setAttribute("content", t.title + " | Festival Planner");
      var twDesc = document.querySelector("meta[name='twitter:description']");
      if (twDesc) twDesc.setAttribute("content", t.desc);

      if (back) {
        back.addEventListener("click", function () {
          var canGoBack = false;
          if (history.length > 1 && document.referrer) {
            try {
              canGoBack = new URL(document.referrer).origin === location.origin;
            } catch (e) {
              canGoBack = false;
            }
          }
          if (canGoBack) {
            history.back();
          } else {
            var fallback = back.getAttribute("data-fallback") || "/";
            location.href = fallback;
          }
        });
      }
    })();
  </script>
</body>
</html>`;
}

const baseUrls = [
  `${SITE_ORIGIN}/`,
  `${SITE_ORIGIN}/${FESTIVAL}/${YEAR}/w1/`,
  `${SITE_ORIGIN}/${FESTIVAL}/${YEAR}/w2/`,
  `${SITE_ORIGIN}/about/`,
  `${SITE_ORIGIN}/changelog/`,
  `${SITE_ORIGIN}/privacy/`,
  `${SITE_ORIGIN}/impressum/`
];

const sitemapUrls = new Set(baseUrls);

for (const [weekend, artists] of weekends.entries()) {
  const weekendLower = weekend.toLowerCase();
  const artistDir = path.join(ROOT, FESTIVAL, YEAR, weekendLower, "artists");
  await fs.mkdir(artistDir, { recursive: true });

  const slugMap = buildArtistSlugMap(artists);
  const entries = [];

  for (const artist of artists.values()) {
    const slug = slugMap.get(artist.id);
    if (!slug) continue;
    const html = renderArtistPage({ artist, weekend, slug });
    const targetDir = path.join(artistDir, slug);
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(path.join(targetDir, "index.html"), html, "utf-8");
    entries.push({ name: artist.name, slug });
    sitemapUrls.add(`${SITE_ORIGIN}/${FESTIVAL}/${YEAR}/${weekendLower}/artists/${slug}/`);
  }

  entries.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const indexHtml = renderArtistIndexPage({ weekend, entries });
  await fs.writeFile(path.join(artistDir, "index.html"), indexHtml, "utf-8");
  sitemapUrls.add(`${SITE_ORIGIN}/${FESTIVAL}/${YEAR}/${weekendLower}/artists/`);
}

const sitemapEntries = [...sitemapUrls].map((loc) => `  <url>\n    <loc>${loc}</loc>\n  </url>`).join("\n");
const sitemapXml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"https://www.sitemaps.org/schemas/sitemap/0.9\">\n${sitemapEntries}\n</urlset>\n`;
await fs.writeFile(path.join(ROOT, "sitemap.xml"), sitemapXml, "utf-8");

console.log(`Generated artist pages for ${weekends.size} weekends.`);




