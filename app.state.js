// ====== STATE ======
const BOOT_CONTEXT = getBootContext();
const storedLang = localStorage.getItem("fp_lang");
let lang = storedLang || BOOT_CONTEXT?.lang || "de";
if (!storedLang && BOOT_CONTEXT?.lang) localStorage.setItem("fp_lang", BOOT_CONTEXT.lang);
let route = ensureRouteDefaults(resolveInitialRoute(location.pathname, BOOT_CONTEXT));
applySeoFromRoute(route);
let selectUid = 0;
const customSelectMap = new WeakMap();
let ratings = {};
let favoritesOnly = false;
let lastFilterValue = "all";
let toastTimer = null;
let menuOpen = false;
let menuScrollY = 0;
let changesDetailsUid = 0;
let changesSelectionUid = 0;

const state = {
  festival: DEFAULT_FESTIVAL,
  year: DEFAULT_YEAR,
  activeWeekend: DEFAULT_WEEKEND,
  snapshotIndex: null,
  weekends: {
    W1: { options: [], selectedFile: null, snapshot: null, grouped: [], artistSlots: new Map(), artistFirstEl: new Map(), filters: { day: "all", stage: "all" }, error: null },
    W2: { options: [], selectedFile: null, snapshot: null, grouped: [], artistSlots: new Map(), artistFirstEl: new Map(), filters: { day: "all", stage: "all" }, error: null }
  },
  artists: { list: [], byId: new Map() },
  changesIndex: null,
  weekendChanges: { W1: null, W2: null },
  selectedChanges: { W1: null, W2: null },
  ratings: {},
  ratingsByWeekend: { W1: {}, W2: {} }
};

