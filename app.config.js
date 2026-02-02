// ====== CONFIG ======
const DEFAULT_FESTIVAL = "tomorrowland";
const DEFAULT_YEAR = "2026";
const DEFAULT_WEEKEND = "W1";

const DONATION_URL = "https://www.buymeacoffee.com/Pontifunk"; 
const FEEDBACK_URL = "https://github.com/Pontifunk/festival-planner/issues/new/choose";

const CANONICAL_TRAILING_SLASH = true;
const WEEKENDS = ["W1", "W2"];
const RATING_STATES = ["liked", "maybe", "disliked", "unrated"];
const RATING_CYCLE = ["unrated", "liked", "maybe", "disliked"];
const VALID_RATINGS = new Set(RATING_STATES);

const RATING_ACTION_LABELS = {
  liked: { actionKey: "rating_action_liked", fallbackKey: "liked", fallback: "Liked" },
  maybe: { actionKey: "rating_action_maybe", fallbackKey: "maybe", fallback: "Maybe" },
  disliked: { actionKey: "rating_action_disliked", fallbackKey: "disliked", fallback: "Disliked" },
  unrated: { actionKey: "rating_action_unrated", fallbackKey: "reset", fallback: "Unrated" }
};

const RATING_CHIP_FALLBACKS = {
  liked: "❤︎",
  maybe: "🤔",
  disliked: "👎",
  unrated: "○"
};
const BASE_PREFIX = getBasePrefix();
const withBase = (path) => `${BASE_PREFIX}${path}`;
const SITE_ORIGIN = (location.origin && location.origin !== "null")
  ? location.origin
  : "https://festival-planner.tschann.me";
const OG_IMAGE_PATH = "/icons/og.png";

const STAGE_ORDER = [
  "MAINSTAGE",
  "FREEDOM BY BUD",
  "THE ROSE GARDEN",
  "ELIXIR",
  "CAGE",
  "THE RAVE CAVE",
  "PLANAXIS",
  "MELODIA BY CORONA",
  "RISE",
  "ATMOSPHERE",
  "CORE",
  "CRYSTAL GARDEN",
  "THE GREAT LIBRARY",
  "MOOSE BAR",
  "HOUSE OF FORTUNE BY JBL"
];

const STAGE_GENRES = {
  "MAINSTAGE": "Big Room / EDM",
  "FREEDOM BY BUD": "Techno / Melodic Techno",
  "THE ROSE GARDEN": "House / Disco",
  "ELIXIR": "Trance / Progressive",
  "CAGE": "Hard Techno",
  "THE RAVE CAVE": "Hardcore / Rave",
  "PLANAXIS": "Techno",
  "MELODIA BY CORONA": "Melodic House & Techno",
  "RISE": "Bass / Future",
  "ATMOSPHERE": "Techno",
  "CORE": "Underground / Techno",
  "CRYSTAL GARDEN": "House / Tech House",
  "THE GREAT LIBRARY": "Eclectic / Classics",
  "MOOSE BAR": "Party / Hits",
  "HOUSE OF FORTUNE BY JBL": "House"
};

const STAGE_ALIASES = {
  "THE LIBRARY": "THE GREAT LIBRARY",
  "GREAT LIBRARY": "THE GREAT LIBRARY",
  "THE GREAT LIBRARY": "THE GREAT LIBRARY"
};

// ====== DOM ======
const langSelect = document.getElementById("langSelect");
const lastCheckedPill = document.getElementById("lastCheckedPill");
const lastUpdatedPill = document.getElementById("lastUpdatedPill");
const topbar = document.getElementById("top");

const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const ratingFilter = document.getElementById("ratingFilter");
const dayFilter = document.getElementById("dayFilter");
const stageFilter = document.getElementById("stageFilter");
const tagFilter = document.getElementById("tagFilter");
const activeFiltersRow = document.getElementById("activeFilters");

const weekendChangesBox = document.getElementById("changesBox");
const weekendChangesSummary = document.getElementById("weekendChangesSummary");
const weekendChangesHistory = document.getElementById("weekendChangesHistory");
const weekendChangesTitle = weekendChangesBox?.querySelector(".cardTitle");
const weekendChangesDetailsWrap = document.getElementById("weekendChangesDetailsWrap");
const weekendChangesDetails = document.getElementById("weekendChangesDetails");
const exportRatingsBtn = document.getElementById("exportRatingsBtn");
const importRatingsInput = document.getElementById("importRatingsInput");
const importStatus = document.getElementById("importStatus");

const errorBox = document.getElementById("errorBox");

const weekendTabs = Array.from(document.querySelectorAll(".tabBtn"));
const weekendPanels = Array.from(document.querySelectorAll(".weekendPanel"));

const snapshotSelectW1 = document.getElementById("snapshotSelectW1");
const snapshotSelectW2 = document.getElementById("snapshotSelectW2");
const weekendMetaW1 = document.getElementById("weekendMetaW1");
const weekendMetaW2 = document.getElementById("weekendMetaW2");
const actsListW1 = document.getElementById("actsListW1");
const actsListW2 = document.getElementById("actsListW2");

const favoritesList = document.getElementById("favoritesList");
const favoritesToggle = document.getElementById("favoritesToggle");
const favoritesPlanNote = document.getElementById("favoritesPlanNote");
const actionToast = document.getElementById("actionToast");
const menuBtn = document.getElementById("menuBtn");
const menuOverlay = document.getElementById("menuOverlay");
const menuSheet = document.getElementById("menuSheet");
const menuCloseBtn = document.getElementById("menuCloseBtn");
const menuDayLinks = document.getElementById("menuDayLinks");
const donateBtn = document.getElementById("donateBtn");
const feedbackBtn = document.getElementById("feedbackBtn");
const plannerExportBox = document.getElementById("plannerExportBox");
const mobileExportAnchor = document.getElementById("mobileExportAnchor");
const controlsCard = document.getElementById("controlsCard");
const mobileControlsAnchor = document.getElementById("mobileControlsAnchor");

