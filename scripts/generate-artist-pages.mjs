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
    artists.set(artistId, {
      id: artistId,
      name,
      normalized,
      slots: [],
      stages: new Set(),
      genres,
      links
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
<body>
  <header class="topbar" id="top">
    <div class="brand">
      <div class="logo">FP</div>
      <div class="brandText">
        <div class="title">Festival Planner</div>
        <div class="subtitle" id="artistSubtitle">Artist details (privacy-first, no tracking)</div>
      </div>
    </div>
  </header>

  <main class="layout">
    <section class="panel">
      <div class="card">
        <div class="cardTitle">${escapeHtml(artist.name)}</div>
        <div class="muted" id="artistMeta">Tomorrowland ${YEAR} - Wochenende ${weekendNum}</div>
        <div style="margin-top:12px">
          <a class="btn" id="backToLineup" href="${escapeHtml(plannerUrl)}">Back to line-up</a>
        </div>
        ${stages.length ? `<div class="muted" style="margin-top:12px">Stages: ${escapeHtml(stages.join(", "))}</div>` : ""}
        ${genres.length ? `<div class="muted" style="margin-top:6px">Tags: ${escapeHtml(genres.join(", "))}</div>` : ""}
        <div class="muted" style="margin-top:8px" id="artistPrivacy">Offline planning, no account, no tracking.</div>
      </div>

      <div class="card" style="margin-top:12px">
        <div class="cardTitle" id="ratingTitle">Your rating</div>
        <div class="badges" style="margin-top:8px">
          <div class="badge" id="artistRatingBadge">Unrated</div>
        </div>
        <div class="ratingSegmented" id="artistRatingControls" data-artist-id="${escapeHtml(artist.id)}" role="group" aria-label="Rating">
          <button class="ratingSegBtn" data-rate="liked" type="button" aria-pressed="false" aria-label="Liked">
            <span class="ratingEmoji" aria-hidden="true">&#x1F44D;&#xFE0F;</span>
            <span class="segLabel">Liked</span>
          </button>
          <button class="ratingSegBtn" data-rate="maybe" type="button" aria-pressed="false" aria-label="Maybe">
            <span class="ratingEmoji" aria-hidden="true">&#x1F914;</span>
            <span class="segLabel">Maybe</span>
          </button>
          <button class="ratingSegBtn" data-rate="disliked" type="button" aria-pressed="false" aria-label="Disliked">
            <span class="ratingEmoji" aria-hidden="true">&#x1F44E;&#xFE0F;</span>
            <span class="segLabel">Nope</span>
          </button>
          <button class="ratingSegBtn" data-rate="unrated" type="button" aria-pressed="false" aria-label="Reset">
            <span class="ratingEmoji" aria-hidden="true">&#x21BA;&#xFE0F;</span>
            <span class="segLabel">Reset</span>
          </button>
        </div>
        <div class="playRow" style="margin-top:10px">
          <button class="playBtn" type="button" id="artistPlayBtn" aria-label="Play ${escapeHtml(artist.name)}">
            <span class="playIcon" aria-hidden="true">&#x25B6;</span>
            <span class="playText">Play</span>
          </button>
          <button class="playMoreBtn" type="button" id="artistPlayMoreBtn" aria-label="Choose platform for ${escapeHtml(artist.name)}">
            <span class="playMoreIcon" aria-hidden="true">&#x22EF;</span>
          </button>
        </div>
        <div class="muted" style="margin-top:8px" id="ratingNote">Stored locally in your browser.</div>
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
      var dict = {
        de: {
          subtitle: "Artist-Details (privacy-first, ohne Tracking)",
          backToLineup: "Zur\u00fcck zum Line-up",
          privacy: "Offline planen, ohne Account, ohne Tracking.",
          ratingTitle: "Deine Bewertung",
          ratingLiked: "Gef\u00e4llt",
          ratingMaybe: "Vielleicht",
          ratingDisliked: "Mag ich nicht",
          ratingUnrated: "Unbewertet",
          ratingReset: "Reset",
          saved: "Gespeichert \u2713",
          ratingNote: "Lokal in deinem Browser gespeichert.",
          play: "Play",
          playMore: "Plattform w\u00e4hlen",
          playDefault: "Standard",
          playSetDefault: "Als Standard setzen",
          meta: "Tomorrowland ${YEAR} - Wochenende ${weekendNum}",
          title: artistName + " - Tomorrowland ${YEAR} (Wochenende ${weekendNum}) | Festival Planner",
          desc: "Offline planen f\u00fcr Tomorrowland ${YEAR} Wochenende ${weekendNum}. Kein Account, kein Tracking."
        },
        en: {
          subtitle: "Artist details (privacy-first, no tracking)",
          backToLineup: "Back to line-up",
          privacy: "Offline planning, no account, no tracking.",
          ratingTitle: "Your rating",
          ratingLiked: "Liked",
          ratingMaybe: "Maybe",
          ratingDisliked: "Nope",
          ratingUnrated: "Unrated",
          ratingReset: "Reset",
          saved: "Saved \u2713",
          ratingNote: "Stored locally in your browser.",
          play: "Play",
          playMore: "Choose platform",
          playDefault: "Default",
          playSetDefault: "Set as default",
          meta: "Tomorrowland ${YEAR} - Weekend ${weekendNum}",
          title: artistName + " - Tomorrowland ${YEAR} (Weekend ${weekendNum}) | Festival Planner",
          desc: "Offline planning for Tomorrowland ${YEAR} Weekend ${weekendNum}. No account, no tracking."
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

      var subtitle = document.getElementById("artistSubtitle");
      if (subtitle) subtitle.textContent = t.subtitle;
      var backBtn = document.getElementById("backToLineup");
      if (backBtn) backBtn.textContent = t.backToLineup;
      var privacy = document.getElementById("artistPrivacy");
      if (privacy) privacy.textContent = t.privacy;
      var meta = document.getElementById("artistMeta");
      if (meta) meta.textContent = t.meta;
      var ratingTitle = document.getElementById("ratingTitle");
      if (ratingTitle) ratingTitle.textContent = t.ratingTitle;
      var ratingNote = document.getElementById("ratingNote");
      if (ratingNote) ratingNote.textContent = t.ratingNote;

      var titleEl = document.querySelector("title");
      if (titleEl) titleEl.textContent = t.title;
      var metaDesc = document.querySelector("meta[name='description']");
      if (metaDesc) metaDesc.setAttribute("content", t.desc);
      var ogTitle = document.querySelector("meta[property='og:title']");
      if (ogTitle) ogTitle.setAttribute("content", t.title);
      var ogDesc = document.querySelector("meta[property='og:description']");
      if (ogDesc) ogDesc.setAttribute("content", t.desc);
      var twTitle = document.querySelector("meta[name='twitter:title']");
      if (twTitle) twTitle.setAttribute("content", t.title);
      var twDesc = document.querySelector("meta[name='twitter:description']");
      if (twDesc) twDesc.setAttribute("content", t.desc);

      var ratingControls = document.getElementById("artistRatingControls");
      var badge = document.getElementById("artistRatingBadge");
      if (ratingControls) {
        var btnLiked = ratingControls.querySelector("[data-rate='liked'] .segLabel");
        var btnMaybe = ratingControls.querySelector("[data-rate='maybe'] .segLabel");
        var btnDisliked = ratingControls.querySelector("[data-rate='disliked'] .segLabel");
        var btnReset = ratingControls.querySelector("[data-rate='unrated'] .segLabel");
        if (btnLiked) btnLiked.textContent = t.ratingLiked;
        if (btnMaybe) btnMaybe.textContent = t.ratingMaybe;
        if (btnDisliked) btnDisliked.textContent = t.ratingDisliked;
        if (btnReset) btnReset.textContent = t.ratingReset;
      }

      var labels = {
        liked: t.ratingLiked,
        maybe: t.ratingMaybe,
        disliked: t.ratingDisliked,
        unrated: t.ratingUnrated
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
            showToast(t.saved);
            return;
          }
          Promise.resolve(setRating(artistId, rate)).then(function () {
            applyState(rate);
            showToast(t.saved);
          });
        });
      });

      loadRating();

      var PLAY_PROVIDER_KEY = "fp_play_provider";
      function makeSpotifySearchUrl(name){ return "https://open.spotify.com/search/" + encodeURIComponent(name); }
      function makeAppleMusicSearchUrl(name){ return "https://music.apple.com/search?term=" + encodeURIComponent(name); }
      function makeYouTubeSearchUrl(name){
        var query = ((name || "") + " Tomorrowland set").trim();
        return "https://www.youtube.com/results?search_query=" + encodeURIComponent(query);
      }
      function makeSoundCloudSearchUrl(name){ return "https://soundcloud.com/search?q=" + encodeURIComponent(name); }
      function getPlayProvider() { return localStorage.getItem(PLAY_PROVIDER_KEY) || "sp"; }
      function setPlayProvider(value) { if (value) localStorage.setItem(PLAY_PROVIDER_KEY, value); }
      function buildPlayUrls(name) {
        return { sp: makeSpotifySearchUrl(name), am: makeAppleMusicSearchUrl(name), yt: makeYouTubeSearchUrl(name), sc: makeSoundCloudSearchUrl(name) };
      }
      function openDefaultPlay() {
        var urls = buildPlayUrls(artistName);
        var provider = getPlayProvider();
        var url = urls[provider] || urls.sp;
        if (url) window.open(url, "_blank", "noopener");
      }

      var playBtn = document.getElementById("artistPlayBtn");
      var playMoreBtn = document.getElementById("artistPlayMoreBtn");
      if (playBtn) {
        playBtn.setAttribute("aria-label", t.play + " " + artistName);
        var playText = playBtn.querySelector(".playText");
        if (playText) playText.textContent = t.play;
      }
      if (playMoreBtn) playMoreBtn.setAttribute("aria-label", t.playMore + " " + artistName);

      var playOverlay = null;
      var playOverlayPanel = null;
      var playOverlayTitle = null;
      var playOverlayLinks = null;
      var playOverlayTrigger = null;

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
        playOverlayTitle.textContent = t.playMore;

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
          setBtn.textContent = t.playSetDefault;

          row.append(a, setBtn);
          return { row: row, link: a, setBtn: setBtn };
        }

        var sp = makeRow("sp", "Spotify");
        var am = makeRow("am", "Apple Music");
        var yt = makeRow("yt", "YouTube");
        var sc = makeRow("sc", "SoundCloud");

        playOverlayLinks = [sp.link, am.link, yt.link, sc.link];
        list.append(sp.row, am.row, yt.row, sc.row);

        playOverlayPanel.append(playOverlayTitle, list);
        playOverlay.append(playOverlayPanel);
        document.body.append(playOverlay);

        playOverlay.addEventListener("click", function (e) {
          if (e.target === playOverlay) closePlayOverlay();
        });

        playOverlayPanel.addEventListener("click", function (e) {
          var link = e.target.closest("a.playLink");
          if (link) {
            closePlayOverlay();
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
        Array.prototype.forEach.call(playOverlayPanel.querySelectorAll(".playDefaultBtn"), function (btn) {
          var key = btn.getAttribute("data-provider");
          var isActive = key === current;
          btn.classList.toggle("isActive", isActive);
          btn.textContent = isActive ? t.playDefault : t.playSetDefault;
        });
      }

      if (playBtn) playBtn.addEventListener("click", function () { openDefaultPlay(); });
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
<body>
  <header class="topbar" id="top">
    <div class="brand">
      <div class="logo">FP</div>
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
          <a class="btn" id="backToPlanner" href="${escapeHtml(plannerUrl)}">Back to Planner</a>
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




