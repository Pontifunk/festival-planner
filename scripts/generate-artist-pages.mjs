import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// NOTE: After snapshot updates, re-run this script to keep artist pages in sync.
const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://festival-planner.tschann.me";
const FESTIVAL = process.env.FESTIVAL || "tomorrowland";
const YEAR = process.env.YEAR || "2026";
const LOCALE = (process.env.LOCALE || "de").toLowerCase();

const UI = {
  en: {
    titleSuffix: "Festival Planner",
    subtitle: "Artist details (privacy-first, no tracking)",
    backToLineup: "Back to line-up",
    setTimes: "Set times",
    noSlots: "No slots available.",
    ratingTitle: "Your rating",
    ratingLabel: "Rating",
    ratingLiked: "Liked",
    ratingMaybe: "Maybe",
    ratingDisliked: "No",
    ratingUnrated: "Unrated",
    ratingReset: "Reset",
    ratingNote: "Stored locally in your browser.",
    play: "Play",
    playMore: "Choose platform",
    playDefault: "Default",
    playSetDefault: "Set as default",
    desc: (name, year, weekendNum) =>
      `Set times and stage info for ${name} at Tomorrowland ${year} Weekend ${weekendNum}. Privacy-first, no tracking.`
  },
  de: {
    titleSuffix: "Festival Planner",
    subtitle: "Artist-Details (privacy-first, ohne Tracking)",
    backToLineup: "Zurück zum Line-up",
    setTimes: "Set-Zeiten",
    noSlots: "Keine Slots verfügbar.",
    ratingTitle: "Deine Bewertung",
    ratingLabel: "Bewertung",
    ratingLiked: "Gefällt",
    ratingMaybe: "Vielleicht",
    ratingDisliked: "Mag ich nicht",
    ratingUnrated: "Unbewertet",
    ratingReset: "Reset",
    ratingNote: "Lokal in deinem Browser gespeichert.",
    play: "Play",
    playMore: "Plattform wählen",
    playDefault: "Standard",
    playSetDefault: "Als Standard setzen",
    desc: (name, year, weekendNum) =>
      `Set-Zeiten und Bühneninfos für ${name} beim Tomorrowland ${year} Wochenende ${weekendNum}. Privacy-first, ohne Tracking.`
  }
};

const copy = UI[LOCALE] || UI.en;

const snapshotPath = path.join(ROOT, "data", FESTIVAL, YEAR, "snapshots", "latest.json");
const raw = await fs.readFile(snapshotPath, "utf-8");
const snapshot = JSON.parse(raw);
const slots = Array.isArray(snapshot.slots) ? snapshot.slots : [];

const weekends = new Map();
for (const slot of slots) {
  const weekend = String(slot.weekend || "").toUpperCase();
  if (!weekend) continue;
  if (!weekends.has(weekend)) weekends.set(weekend, new Map());
  const artists = weekends.get(weekend);
  const artistId = String(slot.artistId || "");
  if (!artistId) continue;
  if (!artists.has(artistId)) {
    artists.set(artistId, {
      id: artistId,
      name: String(slot.artist || "Unknown artist"),
      normalized: String(slot.artistNormalized || ""),
      slots: []
    });
  }
  artists.get(artistId).slots.push(slot);
}

function slugify(value) {
  const base = String(value || "")
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

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("en-CA");
  } catch {
    return value;
  }
}

function formatTime(value) {
  const match = String(value || "").match(/(\d{2}:\d{2})/);
  return match ? match[1] : "";
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

function renderArtistPage({ artist, weekend, slug, createdAt }) {
  const weekendNum = weekend.slice(1);
  const weekendLower = weekend.toLowerCase();
  const title = `${artist.name} at Tomorrowland ${YEAR} Weekend ${weekendNum} | ${copy.titleSuffix}`;
  const description = copy.desc(artist.name, YEAR, weekendNum);
  const canonical = `${SITE_ORIGIN}/${FESTIVAL}/${YEAR}/${weekendLower}/artist/${slug}/`;

  const slots = [...artist.slots].sort((a, b) => {
    const da = String(a.date || a.start || "");
    const db = String(b.date || b.start || "");
    if (da !== db) return da.localeCompare(db);
    const ta = String(a.start || "");
    const tb = String(b.start || "");
    return ta.localeCompare(tb);
  });

  const slotItems = slots.map((slot) => {
    const date = escapeHtml(slot.date || formatDate(slot.start));
    const start = formatTime(slot.start);
    const end = formatTime(slot.end);
    const time = start && end ? `${start}-${end}` : (start || end || "");
    const stage = escapeHtml(slot.stage || "Unknown stage");
    return `<li><strong>${date}</strong> - ${escapeHtml(time)} - ${stage}</li>`;
  }).join("\n");

  const snapshotMeta = createdAt ? `Snapshot: ${escapeHtml(createdAt)}` : "";
  const lineupUrl = `${FESTIVAL}/${YEAR}/${weekendLower}/`;

  return `<!doctype html>
<html lang="${LOCALE}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
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
  <script>
    (function () {
      var parts = location.pathname.split("/").filter(Boolean);
      var baseParts = parts.length >= 5 ? parts.slice(0, parts.length - 5) : parts;
      var basePath = "/" + baseParts.join("/");
      if (!basePath.endsWith("/")) basePath += "/";
      var baseEl = document.createElement("base");
      baseEl.href = basePath;
      document.head.appendChild(baseEl);
    })();
  </script>
  <link rel="stylesheet" href="styles.css">
  <script type="application/ld+json">
    ${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "MusicGroup",
      "name": artist.name,
      "performerIn": {
        "@type": "Event",
        "name": `Tomorrowland ${YEAR} Weekend ${weekendNum}`,
        "startDate": slots[0]?.start || slots[0]?.date || ""
      }
    })}
  </script>
</head>
<body>
  <header class="topbar" id="top">
    <div class="brand">
      <div class="logo">FP</div>
      <div class="brandText">
        <div class="title">Festival Planner</div>
        <div class="subtitle">${escapeHtml(copy.subtitle)}</div>
      </div>
    </div>
  </header>

  <main class="layout">
    <section class="panel">
      <div class="card">
        <div class="cardTitle">${escapeHtml(artist.name)}</div>
        <div class="muted">Tomorrowland ${YEAR} - Weekend ${weekendNum}</div>
        ${snapshotMeta ? `<div class="muted" style="margin-top:6px">${snapshotMeta}</div>` : ""}
        <div style="margin-top:12px">
          <a class="btn" href="${lineupUrl}">${escapeHtml(copy.backToLineup)}</a>
        </div>
        <div style="margin-top:14px">
          <div class="muted" style="margin-bottom:6px">${escapeHtml(copy.setTimes)}</div>
          <ul style="margin:0;padding-left:16px;display:flex;flex-direction:column;gap:6px">
            ${slotItems || `<li>${escapeHtml(copy.noSlots)}</li>`}
          </ul>
        </div>
      </div>
      <div class="card" style="margin-top:12px">
        <div class="cardTitle">${escapeHtml(copy.ratingTitle)}</div>
        <div class="badges" style="margin-top:8px">
          <div class="badge" id="artistRatingBadge">${escapeHtml(copy.ratingUnrated)}</div>
        </div>
        <div class="ratingSegmented" id="artistRatingControls" data-artist-id="${escapeHtml(artist.id)}" role="group" aria-label="${escapeHtml(copy.ratingLabel)}">
          <button class="ratingSegBtn" data-rate="liked" type="button" aria-pressed="false" aria-label="${escapeHtml(copy.ratingLiked)}">
            <span class="ratingEmoji" aria-hidden="true">👍</span>
            <span class="segLabel">${escapeHtml(copy.ratingLiked)}</span>
          </button>
          <button class="ratingSegBtn" data-rate="maybe" type="button" aria-pressed="false" aria-label="${escapeHtml(copy.ratingMaybe)}">
            <span class="ratingEmoji" aria-hidden="true">🤔</span>
            <span class="segLabel">${escapeHtml(copy.ratingMaybe)}</span>
          </button>
          <button class="ratingSegBtn" data-rate="disliked" type="button" aria-pressed="false" aria-label="${escapeHtml(copy.ratingDisliked)}">
            <span class="ratingEmoji" aria-hidden="true">👎</span>
            <span class="segLabel">${escapeHtml(copy.ratingDisliked)}</span>
          </button>
          <button class="ratingSegBtn" data-rate="unrated" type="button" aria-pressed="false" aria-label="${escapeHtml(copy.ratingReset)}">
            <span class="ratingEmoji" aria-hidden="true">↺</span>
            <span class="segLabel">${escapeHtml(copy.ratingReset)}</span>
          </button>
        </div>
        <div class="playRow" style="margin-top:10px">
          <button class="playBtn" type="button" id="artistPlayBtn" aria-label="${escapeHtml(copy.play)} ${escapeHtml(artist.name)}">
            <span class="playIcon" aria-hidden="true">▶</span>
            <span class="playText">${escapeHtml(copy.play)}</span>
          </button>
          <button class="playMoreBtn" type="button" id="artistPlayMoreBtn" aria-label="${escapeHtml(copy.playMore)} ${escapeHtml(artist.name)}">
            <span class="playMoreIcon" aria-hidden="true">⋯</span>
          </button>
        </div>
        <div class="muted" style="margin-top:8px">${escapeHtml(copy.ratingNote)}</div>
      </div>
    </section>
  </main>
  <script>
    window.state = { festival: "${escapeHtml(FESTIVAL)}", year: "${escapeHtml(YEAR)}" };
    window.ratings = {};
  </script>
  <script src="app.store.js"></script>
  <script>
    (function () {
      var artistName = (document.querySelectorAll(".cardTitle")[0] || {}).textContent || "";
      var metaLine = (document.querySelector(".card .muted") || {}).textContent || "";
      var yearMatch = metaLine.match(/(\\d{4}).*?(\\d)/);
      var year = yearMatch ? yearMatch[1] : "${escapeHtml(YEAR)}";
      var weekendNum = yearMatch ? yearMatch[2] : "${escapeHtml(weekendNum)}";

      var dict = {
        de: {
          subtitle: "Artist-Details (privacy-first, ohne Tracking)",
          backToLineup: "Zurück zum Line-up",
          setTimes: "Set-Zeiten",
          weekendLabel: "Wochenende",
          ratingTitle: "Deine Bewertung",
          ratingLiked: "Gefällt",
          ratingMaybe: "Vielleicht",
          ratingDisliked: "Mag ich nicht",
          ratingUnrated: "Unbewertet",
          ratingReset: "Reset",
          ratingNote: "Lokal in deinem Browser gespeichert.",
          play: "Play",
          playMore: "Plattform wählen",
          playDefault: "Standard",
          playSetDefault: "Als Standard setzen",
          title: artistName + " bei Tomorrowland " + year + " Wochenende " + weekendNum + " | Festival Planner",
          desc: "Set-Zeiten und Bühneninfos für " + artistName + " bei Tomorrowland " + year + " Wochenende " + weekendNum + ". Privacy-first, ohne Tracking."
        },
        en: {
          subtitle: "Artist details (privacy-first, no tracking)",
          backToLineup: "Back to line-up",
          setTimes: "Set times",
          weekendLabel: "Weekend",
          ratingTitle: "Your rating",
          ratingLiked: "Liked",
          ratingMaybe: "Maybe",
          ratingDisliked: "No",
          ratingUnrated: "Unrated",
          ratingReset: "Reset",
          ratingNote: "Stored locally in your browser.",
          play: "Play",
          playMore: "Choose platform",
          playDefault: "Default",
          playSetDefault: "Set as default",
          title: artistName + " at Tomorrowland " + year + " Weekend " + weekendNum + " | Festival Planner",
          desc: "Set times and stage info for " + artistName + " at Tomorrowland " + year + " Weekend " + weekendNum + ". Privacy-first, no tracking."
        }
      };

      var lang = (localStorage.getItem("fp_lang") || "de").toLowerCase();
      if (lang !== "de" && lang !== "en") lang = "de";
      document.documentElement.lang = lang;

      var t = dict[lang];
      var subtitle = document.querySelector(".subtitle");
      if (subtitle) subtitle.textContent = t.subtitle;

      var btn = document.querySelector(".card .btn");
      if (btn) btn.textContent = t.backToLineup;

      var setTimesLabel = document.querySelector(".card div[style*='margin-bottom:6px']");
      if (setTimesLabel) setTimesLabel.textContent = t.setTimes;

      var metaRow = document.querySelectorAll(".card .muted")[0];
      if (metaRow) metaRow.textContent = "Tomorrowland " + year + " - " + t.weekendLabel + " " + weekendNum;

      var ratingCard = document.querySelectorAll(".card")[1];
      if (ratingCard) {
        var ratingTitle = ratingCard.querySelector(".cardTitle");
        if (ratingTitle) ratingTitle.textContent = t.ratingTitle;
        var ratingNote = ratingCard.querySelector(".muted[style*='margin-top:8px']");
        if (ratingNote) ratingNote.textContent = t.ratingNote;
      }

      var ratingControls = document.getElementById("artistRatingControls");
      if (ratingControls) {
        var btnLiked = ratingControls.querySelector("[data-rate='liked'] .segLabel");
        var btnMaybe = ratingControls.querySelector("[data-rate='maybe'] .segLabel");
        var btnDisliked = ratingControls.querySelector("[data-rate='disliked'] .segLabel");
        var btnReset = ratingControls.querySelector("[data-rate='unrated'] .segLabel");
        if (btnLiked) btnLiked.textContent = t.ratingLiked;
        if (btnMaybe) btnMaybe.textContent = t.ratingMaybe;
        if (btnDisliked) btnDisliked.textContent = t.ratingDisliked;
        if (btnReset) btnReset.textContent = t.ratingReset;

        var btnLikedEl = ratingControls.querySelector("[data-rate='liked']");
        var btnMaybeEl = ratingControls.querySelector("[data-rate='maybe']");
        var btnDislikedEl = ratingControls.querySelector("[data-rate='disliked']");
        var btnResetEl = ratingControls.querySelector("[data-rate='unrated']");
        if (btnLikedEl) btnLikedEl.setAttribute("aria-label", t.ratingLiked);
        if (btnMaybeEl) btnMaybeEl.setAttribute("aria-label", t.ratingMaybe);
        if (btnDislikedEl) btnDislikedEl.setAttribute("aria-label", t.ratingDisliked);
        if (btnResetEl) btnResetEl.setAttribute("aria-label", t.ratingReset);
      }

      var badge = document.getElementById("artistRatingBadge");
      var labels = {
        liked: t.ratingLiked,
        maybe: t.ratingMaybe,
        disliked: t.ratingDisliked,
        unrated: t.ratingUnrated
      };

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

      var playBtn = document.getElementById("artistPlayBtn");
      var playMoreBtn = document.getElementById("artistPlayMoreBtn");
      if (playBtn) {
        playBtn.setAttribute("aria-label", t.play + " " + artistName);
        var playText = playBtn.querySelector(".playText");
        if (playText) playText.textContent = t.play;
      }
      if (playMoreBtn) playMoreBtn.setAttribute("aria-label", t.playMore + " " + artistName);

      var artistId = (ratingControls && ratingControls.getAttribute("data-artist-id")) || "";
      if (!badge || !ratingControls || !artistId) return;

      function applyState(rate) {
        var value = rate || "unrated";
        badge.textContent = labels[value] || labels.unrated;
        badge.classList.toggle("ok", value === "liked");
        badge.classList.toggle("warn", value === "maybe");
        badge.classList.toggle("bad", value === "disliked");
        Array.prototype.forEach.call(ratingControls.querySelectorAll(".ratingSegBtn"), function (btn) {
          var isActive = btn.getAttribute("data-rate") === value;
          btn.classList.toggle("isActive", isActive);
          btn.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
      }

      function loadRating() {
        if (typeof dbGetAll !== "function" || typeof makeDbKeyPrefix !== "function") {
          applyState("unrated");
          return;
        }
        dbGetAll(makeDbKeyPrefix(state)).then(function (all) {
          ratings = all || {};
          applyState(ratings[artistId] || "unrated");
        }).catch(function () {
          applyState("unrated");
        });
      }

      Array.prototype.forEach.call(ratingControls.querySelectorAll(".ratingSegBtn"), function (btn) {
        btn.addEventListener("click", function () {
          var rate = btn.getAttribute("data-rate") || "unrated";
          if (typeof setRating !== "function") {
            applyState(rate);
            return;
          }
          Promise.resolve(setRating(artistId, rate)).then(function () {
            applyState(rate);
          });
        });
      });

      loadRating();

      var PLAY_PROVIDER_KEY = "fp_play_provider";
      function makeSpotifySearchUrl(name){ return "https://open.spotify.com/search/" + encodeURIComponent(name); }
      function makeAppleMusicSearchUrl(name){ return "https://music.apple.com/search?term=" + encodeURIComponent(name); }
      function makeYouTubeSearchUrl(name){ return "https://www.youtube.com/results?search_query=" + encodeURIComponent(name); }
      function makeSoundCloudSearchUrl(name){ return "https://soundcloud.com/search?q=" + encodeURIComponent(name); }
      function getPlayProvider() { return localStorage.getItem(PLAY_PROVIDER_KEY) || "sp"; }
      function setPlayProvider(value) { if (value) localStorage.setItem(PLAY_PROVIDER_KEY, value); }
      function buildPlayUrls(name) {
        return {
          sp: makeSpotifySearchUrl(name),
          am: makeAppleMusicSearchUrl(name),
          yt: makeYouTubeSearchUrl(name),
          sc: makeSoundCloudSearchUrl(name)
        };
      }
      function openDefaultPlay() {
        var urls = buildPlayUrls(artistName);
        var provider = getPlayProvider();
        var url = urls[provider] || urls.sp;
        if (url) window.open(url, "_blank", "noopener");
      }

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
          return { row: row, link: a };
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
  const artistDir = path.join(ROOT, FESTIVAL, YEAR, weekendLower, "artist");
  await fs.rm(artistDir, { recursive: true, force: true });
  await fs.mkdir(artistDir, { recursive: true });

  const slugMap = buildArtistSlugMap(artists);
  for (const artist of artists.values()) {
    const slug = slugMap.get(artist.id);
    const createdAt = snapshot?.meta?.createdAt || "";
    const html = renderArtistPage({ artist, weekend, slug, createdAt });
    const targetDir = path.join(artistDir, slug);
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(path.join(targetDir, "index.html"), html, "utf-8");
    sitemapUrls.add(`${SITE_ORIGIN}/${FESTIVAL}/${YEAR}/${weekendLower}/artist/${slug}/`);
  }
}

const sitemapEntries = [...sitemapUrls].map((loc) => `  <url>\n    <loc>${loc}</loc>\n  </url>`).join("\n");
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>\n`;
await fs.writeFile(path.join(ROOT, "sitemap.xml"), sitemapXml, "utf-8");

console.log(`Generated artist pages for ${weekends.size} weekends.`);
