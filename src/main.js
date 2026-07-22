const STORAGE_KEY = "grid-atlas-workspace-v2";
const THEME_KEY = "grid-atlas-theme";
const LANGUAGE_KEY = "grid-atlas-language";
const DISTANCE_UNIT_KEY = "grid-atlas-distance-unit";
const ROUTE_RETURN_KEY = "grid-atlas-route-return";
const MOBILE_PAGE_KEY = "grid-atlas-mobile-page";
const LIGHT_THEME = "light";
const RETRO_THEME = "retro";
const JA_LANGUAGE = "ja";
const EN_LANGUAGE = "en";
const METRIC_UNIT = "metric";
const IMPERIAL_UNIT = "imperial";
const POINT_RADIUS = 8;
const POINTER_MOVE_THRESHOLD = 3;
const CURRENT_LOCATION_ID = "__current_location__";
const LOADED_OBSERVATION_PREFIX = "__loaded_observation__";
const DEFAULT_POINT_LIST_ID = "local";
const FOLLOW_SCALE_MANUAL = "manual";
const FOLLOW_SCALE_CENTER = "center";
const FOLLOW_SCALE_TARGET = "target";
const EARTH_RADIUS_METERS = 6371008.8;
const MERCATOR_RADIUS = 6378137;
const MAX_MERCATOR_LAT = 85.05112878;
const TARGET_DISTANCE_STEPS = [25, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000, 2000000, 5000000];
const TARGET_ARRIVAL_METERS = 25;
const OBSERVATION_MIN_STEP_METERS = 15;
const OBSERVATION_ACCURACY_FACTOR = 1.5;
const OBSERVATION_MAX_ACCURACY_METERS = 50;
const OBSERVATION_MAX_POINTS = 2000;
const DEFAULT_GEO = { lat: 35.681236, lng: 139.767125 };
const DEFAULT_CENTER = { x: 0, y: 0 };
const MOBILE_GRID_PAGES = ["grid", "points", "lists"];

const canvas = document.querySelector("#gridCanvas");
const context = canvas.getContext("2d");
let canvasMetrics = {
  width: 0,
  height: 0,
  dpr: 1
};
let canvasResizeFrame = 0;
let canvasResizeObserver = null;

const elements = {
  actionLinkButton: document.querySelector("#actionLinkButton"),
  actionRegisterButton: document.querySelector("#actionRegisterButton"),
  actionRouteButton: document.querySelector("#actionRouteButton"),
  actionRouteLabel: document.querySelector("#actionRouteLabel"),
  clearSelectionButton: document.querySelector("#clearSelectionButton"),
  actionTargetButton: document.querySelector("#actionTargetButton"),
  actionRouteStartButton: document.querySelector("#actionRouteStartButton"),
  actionFollowButton: document.querySelector("#actionFollowButton"),
  actionCenterButton: document.querySelector("#actionCenterButton"),
  actionRestoreButton: document.querySelector("#actionRestoreButton"),
  actionEditButton: document.querySelector("#actionEditButton"),
  actionMapButton: document.querySelector("#actionMapButton"),
  editionBadge: document.querySelector("#editionBadge"),
  settingsMenu: document.querySelector("#settingsMenu"),
  settingsMenuButton: document.querySelector("#settingsMenuButton"),
  settingsPanel: document.querySelector("#settingsPanel"),
  settingsThemeSelect: document.querySelector("#settingsThemeSelect"),
  settingsLanguageSelect: document.querySelector("#settingsLanguageSelect"),
  settingsUnitSelect: document.querySelector("#settingsUnitSelect"),
  settingsRouteReturnToStart: document.querySelector("#settingsRouteReturnToStart"),
  statusLine: document.querySelector("#statusLine"),
  selectionInfoText: document.querySelector("#selectionInfoText"),
  mobileSelectedTitle: document.querySelector("#mobileSelectedTitle"),
  sidebarSelectedTitle: document.querySelector("#sidebarSelectedTitle"),
  mapColumn: document.querySelector(".map-column"),
  sidebar: document.querySelector(".sidebar"),
  mobileBackButton: document.querySelector("#mobileBackButton"),
  mobilePageTabs: Array.from(document.querySelectorAll("[data-mobile-page]")),
  mobilePanels: Array.from(document.querySelectorAll("[data-mobile-panel]")),
  mobileGridTabs: Array.from(document.querySelectorAll("[data-mobile-grid-page]")),
  mobileGridPanels: Array.from(document.querySelectorAll("[data-mobile-grid-panel]")),
  mobilePointCount: document.querySelector("#mobilePointCount"),
  mobilePointItems: document.querySelector("#mobilePointItems"),
  pointForm: document.querySelector("#pointForm"),
  pointTitle: document.querySelector("#pointTitle"),
  pointLat: document.querySelector("#pointLat"),
  pointLng: document.querySelector("#pointLng"),
  pointPhoto: document.querySelector("#pointPhoto"),
  pointNote: document.querySelector("#pointNote"),
  pointSubmitButton: document.querySelector("#pointSubmitButton"),
  readClipboardButton: document.querySelector("#readClipboardButton"),
  shareImportStatus: document.querySelector("#shareImportStatus"),
  useLocationButton: document.querySelector("#useLocationButton"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  fitButton: document.querySelector("#fitButton"),
  originButton: document.querySelector("#originButton"),
  emptyDetails: document.querySelector("#emptyDetails"),
  pointDetails: document.querySelector("#pointDetails"),
  selectionHeading: document.querySelector("#selectionHeading"),
  detailPhoto: document.querySelector("#detailPhoto"),
  detailTitleLabel: document.querySelector("#detailTitleLabel"),
  detailTitle: document.querySelector("#detailTitle"),
  detailCoordsLabel: document.querySelector("#detailCoordsLabel"),
  detailCoords: document.querySelector("#detailCoords"),
  detailCreatedLabel: document.querySelector("#detailCreatedLabel"),
  detailCreated: document.querySelector("#detailCreated"),
  detailNoteLabel: document.querySelector("#detailNoteLabel"),
  detailNote: document.querySelector("#detailNote"),
  mapOpenActions: document.querySelector("#mapOpenActions"),
  targetActions: document.querySelector("#targetActions"),
  targetPointButton: document.querySelector("#targetPointButton"),
  openAppleMapsButton: document.querySelector("#openAppleMapsButton"),
  openGoogleMapsButton: document.querySelector("#openGoogleMapsButton"),
  deletePointButton: document.querySelector("#deletePointButton"),
  pointCount: document.querySelector("#pointCount"),
  linkCount: document.querySelector("#linkCount"),
  totalDistance: document.querySelector("#totalDistance"),
  longestDistance: document.querySelector("#longestDistance"),
  linkList: document.querySelector("#linkList"),
  routeSelectedCount: document.querySelector("#routeSelectedCount"),
  routeStartSelect: document.querySelector("#routeStartSelect"),
  routeReturnToStart: document.querySelector("#routeReturnToStart"),
  computeRouteButton: document.querySelector("#computeRouteButton"),
  clearRouteSelectionButton: document.querySelector("#clearRouteSelectionButton"),
  routeSummary: document.querySelector("#routeSummary"),
  routeList: document.querySelector("#routeList"),
  exportPointsButton: document.querySelector("#exportPointsButton"),
  replacePointsButton: document.querySelector("#replacePointsButton"),
  appendPointsButton: document.querySelector("#appendPointsButton"),
  pointImportFile: document.querySelector("#pointImportFile"),
  pointListItemContainers: Array.from(document.querySelectorAll("[data-point-list-items]")),
  exportObservationButton: document.querySelector("#exportObservationButton"),
  replaceObservationButton: document.querySelector("#replaceObservationButton"),
  appendObservationButton: document.querySelector("#appendObservationButton"),
  observationImportFile: document.querySelector("#observationImportFile"),
  clearButton: document.querySelector("#clearButton")
};

const state = {
  version: 3,
  language: JA_LANGUAGE,
  distanceUnit: METRIC_UNIT,
  points: [],
  pointLists: [],
  links: [],
  mode: "inspect",
  mobileGridPage: "grid",
  selection: [],
  selectedPointId: null,
  selectedLinkId: null,
  pendingLinkPointId: null,
  routeSelectionIds: [],
  routeStartPointId: null,
  routeStartSnapshot: null,
  routeReturnToStart: false,
  routeResult: null,
  targetPointId: null,
  observationStartId: null,
  observationTargetId: null,
  observationStart: null,
  observationTrail: [],
  loadedObservations: [],
  editingPointId: null,
  lastDeleted: null,
  pendingGeo: null,
  gpsEnabled: false,
  followCurrentLocation: false,
  screenFollowCurrentLocation: false,
  locationWatchId: null,
  locationFollowFillForm: false,
  locationFollowScaleMode: FOLLOW_SCALE_MANUAL,
  projection: {
    mode: "local",
    centerGeo: DEFAULT_GEO,
    version: 1
  },
  viewport: {
    x: DEFAULT_CENTER.x,
    y: DEFAULT_CENTER.y,
    scale: 0.7
  },
  pointer: createPointerGestureState()
};

let pendingObservationImportMode = "replace";

const CANVAS_PALETTES = {
  light: {
    gridMinor: "#edf0e8",
    gridMajor: "#d8ded1",
    link: "#116c6d",
    linkSelected: "#2e7d32",
    route: "#5a4aa0",
    target: "#ff7a1a",
    targetSoft: "rgb(255 122 26 / 0.18)",
    targetGuide: "rgb(104 116 102 / 0.78)",
    targetFill: "#ff7a1a",
    observationBaseline: "rgb(199 58 42 / 0.34)",
    observationTrail: "#c73a2a",
    currentFill: "#ffd436",
    pendingFill: "rgb(233 95 26 / 0.24)",
    pendingStroke: "rgb(233 95 26 / 0.62)",
    pointFill: "#116c6d",
    pointBaseStroke: "#ffffff",
    routeStart: "#008fc7",
    routeSelected: "#7b68c7",
    pendingPointStroke: "#116c6d",
    selected: "#2e7d32",
    badgeFill: "#ffffff",
    badgeText: "#5a4aa0",
    badgeStartFill: "#5a4aa0",
    badgeStartText: "#ffffff"
  },
  retro: {
    gridMinor: "rgb(44 255 100 / 0.14)",
    gridMajor: "rgb(69 255 124 / 0.36)",
    link: "#29ff68",
    linkSelected: "#d6ffe0",
    route: "#7dff9b",
    target: "#ff8a1c",
    targetSoft: "rgb(255 138 28 / 0.18)",
    targetGuide: "rgb(214 255 224 / 0.62)",
    targetFill: "#ff8a1c",
    observationBaseline: "rgb(214 255 224 / 0.28)",
    observationTrail: "#fff35a",
    currentFill: "#fff35a",
    pendingFill: "rgb(44 255 100 / 0.18)",
    pendingStroke: "rgb(119 255 153 / 0.72)",
    pointFill: "#23ff5e",
    pointBaseStroke: "#020806",
    routeStart: "#2ddfff",
    routeSelected: "#8dffaa",
    pendingPointStroke: "#d6ffe0",
    selected: "#ffffff",
    badgeFill: "#020806",
    badgeText: "#d6ffe0",
    badgeStartFill: "#2cff64",
    badgeStartText: "#020806"
  }
};

const TRANSLATIONS = {
  ja: {
    "settings.title": "設定",
    "settings.menu": "メニュー",
    "settings.design": "デザイン",
    "settings.language": "言語",
    "settings.units": "距離単位",
    "settings.routeReturn": "巡回で起点に戻る",
    "settings.themeRetro": "レトロ",
    "settings.themeLight": "ライト",
    "settings.languageJa": "日本語",
    "settings.languageEn": "English",
    "settings.unitsMetric": "km",
    "settings.unitsImperial": "mile",
    "edition.web": "WEB版",
    "page.analysis": "分析",
    "page.data": "データ",
    "page.grid": "グリッド",
    "page.points": "地点一覧",
    "page.lists": "リスト一覧",
    "summary.selected": "選択中",
    "summary.info": "情報",
    "state.unselected": "未選択",
    "state.noPoints": "地点なし",
    "action.register": "登録",
    "action.connect": "接続",
    "action.center": "中心",
    "action.clear": "解除",
    "action.start": "起点",
    "action.target": "対象",
    "action.track": "追跡",
    "action.route": "巡回",
    "action.delete": "削除",
    "action.restore": "復旧",
    "action.edit": "編集",
    "action.map": "地図",
    "button.backToGrid": "← 格子に戻る",
    "button.clipboard": "クリップ読取",
    "button.currentLocation": "現在地",
    "button.submitRegister": "登録",
    "button.update": "更新",
    "button.appleMaps": "Appleマップ",
    "button.googleMaps": "Googleマップ",
    "button.setTarget": "ターゲットにする",
    "button.clearTarget": "ターゲット解除",
    "button.optimize": "最適順",
    "button.clear": "解除",
    "button.save": "保存",
    "button.load": "読込",
    "button.replaceLoad": "新規読込",
    "button.appendLoad": "追加読込",
    "button.clearGrid": "グリッド初期化",
    "panel.register": "地点登録",
    "panel.details": "選択地点",
    "panel.multiSelect": "複数選択",
    "panel.selectedLine": "選択線",
    "panel.observationResult": "観察結果",
    "panel.analysis": "分析",
    "panel.route": "巡回ルート",
    "panel.data": "データ",
    "panel.points": "地点一覧",
    "panel.lists": "リスト一覧",
    "field.title": "見出し",
    "field.lat": "緯度",
    "field.lng": "経度",
    "field.photo": "写真",
    "field.note": "コメント",
    "field.coords": "緯度経度",
    "field.created": "登録",
    "field.count": "件数",
    "field.order": "順序",
    "field.operation": "操作",
    "field.name": "名前",
    "field.actualDistance": "実距離",
    "field.record": "記録",
    "field.result": "結果",
    "field.line": "線",
    "field.distance": "距離",
    "field.endpoints": "端点",
    "metric.points": "地点",
    "metric.links": "線",
    "metric.total": "合計",
    "metric.longest": "最長",
    "route.startPoint": "スタート地点",
    "route.returnToStart": "最後にスタート地点へ戻る",
    "route.summaryDefault": "地点を選んで巡回を押す",
    "route.needStart": "起点を指定して2点以上選択",
    "route.needTwo": "2点以上を選択すると巡回を実行",
    "route.ready": "巡回で最適順を計算",
    "route.exact": "厳密",
    "route.heuristic": "近似",
    "route.return": "戻る",
    "route.total": "合計",
    "route.start": "スタート",
    "route.fromPrevious": "前地点から",
    "route.toStart": "スタートへ",
    "data.pointLists": "地点リスト",
    "data.observations": "観察記録",
    "data.grid": "グリッド",
    "status.grid": "格子",
    "label.points": "点",
    "label.links": "線",
    "label.observations": "観察",
    "label.selected": "選択",
    "label.sequence": "選択順",
    "label.linkTotal": "線合計",
    "label.betweenTwo": "2点間",
    "label.fromCurrent": "現在地から",
    "label.accuracy": "精度",
    "label.none": "なし",
    "message.loadedObservation": "読み込み観察",
    "message.pointUnavailable": "地点を確認できません",
    "message.linkUnavailable": "線を確認できません",
    "message.quickHint": "接続、巡回、削除、解除をクイックボタンで実行できます。",
    "message.currentLocation": "現在地"
  },
  en: {
    "settings.title": "Settings",
    "settings.menu": "Menu",
    "settings.design": "Design",
    "settings.language": "Language",
    "settings.units": "Distance Unit",
    "settings.routeReturn": "Return to start in route",
    "settings.themeRetro": "Retro",
    "settings.themeLight": "Light",
    "settings.languageJa": "Japanese",
    "settings.languageEn": "English",
    "settings.unitsMetric": "km",
    "settings.unitsImperial": "mile",
    "edition.web": "Web",
    "page.analysis": "Analysis",
    "page.data": "Data",
    "page.grid": "Grid",
    "page.points": "Points",
    "page.lists": "Lists",
    "summary.selected": "Selected",
    "summary.info": "Info",
    "state.unselected": "None",
    "state.noPoints": "No points",
    "action.register": "Add",
    "action.connect": "Link",
    "action.center": "Center",
    "action.clear": "Clear",
    "action.start": "Start",
    "action.target": "Target",
    "action.track": "Track",
    "action.route": "Route",
    "action.delete": "Delete",
    "action.restore": "Restore",
    "action.edit": "Edit",
    "action.map": "Map",
    "button.backToGrid": "← Back to grid",
    "button.clipboard": "Read Clipboard",
    "button.currentLocation": "Current",
    "button.submitRegister": "Add",
    "button.update": "Update",
    "button.appleMaps": "Apple Maps",
    "button.googleMaps": "Google Maps",
    "button.setTarget": "Set Target",
    "button.clearTarget": "Clear Target",
    "button.optimize": "Optimize",
    "button.clear": "Clear",
    "button.save": "Save",
    "button.load": "Load",
    "button.replaceLoad": "Replace Load",
    "button.appendLoad": "Add Load",
    "button.clearGrid": "Reset Grid",
    "panel.register": "Add Point",
    "panel.details": "Selected Point",
    "panel.multiSelect": "Multiple Selection",
    "panel.selectedLine": "Selected Line",
    "panel.observationResult": "Observation Result",
    "panel.analysis": "Analysis",
    "panel.route": "Route",
    "panel.data": "Data",
    "panel.points": "Points",
    "panel.lists": "Lists",
    "field.title": "Title",
    "field.lat": "Latitude",
    "field.lng": "Longitude",
    "field.photo": "Photo",
    "field.note": "Comment",
    "field.coords": "Coordinates",
    "field.created": "Created",
    "field.count": "Count",
    "field.order": "Order",
    "field.operation": "Action",
    "field.name": "Name",
    "field.actualDistance": "Actual",
    "field.record": "Record",
    "field.result": "Result",
    "field.line": "Line",
    "field.distance": "Distance",
    "field.endpoints": "Endpoints",
    "metric.points": "Points",
    "metric.links": "Lines",
    "metric.total": "Total",
    "metric.longest": "Longest",
    "route.startPoint": "Start Point",
    "route.returnToStart": "Return to start",
    "route.summaryDefault": "Select points and tap Route",
    "route.needStart": "Set a start and select 2+ points",
    "route.needTwo": "Select 2+ points to route",
    "route.ready": "Ready to optimize",
    "route.exact": "Exact",
    "route.heuristic": "Approx",
    "route.return": "Return",
    "route.total": "Total",
    "route.start": "Start",
    "route.fromPrevious": "From previous",
    "route.toStart": "To start",
    "data.pointLists": "Point Lists",
    "data.observations": "Observation Records",
    "data.grid": "Grid",
    "status.grid": "Grid",
    "label.points": "pts",
    "label.links": "lines",
    "label.observations": "observations",
    "label.selected": "Selected",
    "label.sequence": "Sequence",
    "label.linkTotal": "Line total",
    "label.betweenTwo": "Between",
    "label.fromCurrent": "From current",
    "label.accuracy": "Accuracy",
    "label.none": "None",
    "message.loadedObservation": "Loaded observation",
    "message.pointUnavailable": "Point unavailable",
    "message.linkUnavailable": "Line unavailable",
    "message.quickHint": "Use quick buttons to link, route, delete, or clear.",
    "message.currentLocation": "Current location"
  }
};

function activeLanguage() {
  return state.language === EN_LANGUAGE ? EN_LANGUAGE : JA_LANGUAGE;
}

function t(key) {
  return TRANSLATIONS[activeLanguage()]?.[key] ?? TRANSLATIONS.ja[key] ?? key;
}

function applyStaticTranslations() {
  document.documentElement.lang = activeLanguage();
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll("[data-i18n-title]")) {
    element.title = t(element.dataset.i18nTitle);
  }
  elements.settingsMenuButton.title = t("settings.title");
  if (elements.editionBadge) {
    elements.editionBadge.textContent = t("edition.web");
  }
}

function setLanguage(language, options = {}) {
  state.language = language === EN_LANGUAGE ? EN_LANGUAGE : JA_LANGUAGE;
  if (options.persist !== false) {
    try {
      localStorage.setItem(LANGUAGE_KEY, state.language);
    } catch {}
  }
  applyStaticTranslations();
  syncSettingsControls();
}

function setDistanceUnit(unit, options = {}) {
  state.distanceUnit = unit === IMPERIAL_UNIT ? IMPERIAL_UNIT : METRIC_UNIT;
  if (options.persist !== false) {
    try {
      localStorage.setItem(DISTANCE_UNIT_KEY, state.distanceUnit);
    } catch {}
  }
  syncSettingsControls();
}

function setRouteReturnToStart(value, options = {}) {
  state.routeReturnToStart = Boolean(value);
  if (options.persist !== false) {
    try {
      localStorage.setItem(ROUTE_RETURN_KEY, String(state.routeReturnToStart));
    } catch {}
  }
  syncSettingsControls();
}

function setGpsEnabled(value, options = {}) {
  const enabled = Boolean(value);
  if (enabled === state.gpsEnabled && options.force !== true) {
    syncSettingsControls();
    return true;
  }

  if (!enabled) {
    if (state.followCurrentLocation) {
      toggleLocationFollow();
      if (state.followCurrentLocation) {
        syncSettingsControls();
        return false;
      }
    }
    if (state.screenFollowCurrentLocation) {
      stopScreenFollow({ render: false });
    }
    state.gpsEnabled = false;
    if (state.locationWatchId !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(state.locationWatchId);
    }
    state.locationWatchId = null;
    state.currentGeo = null;
    state.selection = state.selection.filter((entry) => entry.id !== CURRENT_LOCATION_ID);
    normalizeSelection();
  } else {
    state.gpsEnabled = true;
  }

  if (options.persist !== false) {
    try {
      localStorage.setItem(GPS_ENABLED_KEY, String(state.gpsEnabled));
    } catch {}
  }

  syncSettingsControls();
  if (state.gpsEnabled && options.request !== false) {
    requestCurrentLocation({ fillForm: false, center: false, showButtonState: false });
  }
  if (options.render !== false) {
    render();
  }
  return true;
}
function syncSettingsControls() {
  elements.settingsThemeSelect.value = currentTheme();
  elements.settingsLanguageSelect.value = activeLanguage();
  elements.settingsUnitSelect.value = state.distanceUnit;
  elements.settingsRouteReturnToStart.checked = state.routeReturnToStart;
  elements.settingsGpsEnabled.checked = state.gpsEnabled;
  elements.routeReturnToStart.checked = state.routeReturnToStart;
}

function loadPreferences() {
  let language = JA_LANGUAGE;
  let unit = METRIC_UNIT;
  let returnToStart = false;
  let gpsEnabled = false;
  try {
    language = localStorage.getItem(LANGUAGE_KEY) === EN_LANGUAGE ? EN_LANGUAGE : JA_LANGUAGE;
    unit = localStorage.getItem(DISTANCE_UNIT_KEY) === IMPERIAL_UNIT ? IMPERIAL_UNIT : METRIC_UNIT;
    returnToStart = localStorage.getItem(ROUTE_RETURN_KEY) === "true";
    gpsEnabled = localStorage.getItem(GPS_ENABLED_KEY) === "true";
  } catch {}

  setLanguage(language, { persist: false });
  setDistanceUnit(unit, { persist: false });
  setRouteReturnToStart(returnToStart, { persist: false });
  state.gpsEnabled = gpsEnabled;
}

function setSettingsMenuOpen(open) {
  elements.settingsPanel.hidden = !open;
  elements.settingsMenuButton.setAttribute("aria-expanded", String(open));
}

function toggleSettingsMenu() {
  setSettingsMenuOpen(elements.settingsPanel.hidden);
}
function currentTheme() {
  return document.documentElement.dataset.theme === RETRO_THEME ? RETRO_THEME : LIGHT_THEME;
}

function canvasPalette() {
  return CANVAS_PALETTES[currentTheme()];
}

function loadTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {}

  setTheme(saved === LIGHT_THEME ? LIGHT_THEME : RETRO_THEME, { persist: false });
}

function setTheme(theme, options = {}) {
  const normalized = theme === RETRO_THEME ? RETRO_THEME : LIGHT_THEME;
  const isRetro = normalized === RETRO_THEME;
  document.documentElement.dataset.theme = normalized;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isRetro ? "#020806" : "#e95f1a");

  if (options.persist !== false) {
    localStorage.setItem(THEME_KEY, normalized);
  }

  if (elements.editionBadge) {
    elements.editionBadge.textContent = t("edition.web");
  }
  if (elements.settingsThemeSelect) {
    elements.settingsThemeSelect.value = normalized;
  }
}

function toggleTheme() {
  setTheme(currentTheme() === RETRO_THEME ? LIGHT_THEME : RETRO_THEME);
  render();
}

function createId() {
  if ("randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function loadWorkspace() {
  const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("grid-atlas-workspace-v1");
  if (!raw) {
    return;
  }

  try {
    applyWorkspace(JSON.parse(raw));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function applyWorkspace(workspace) {
  const origin = validGeo(workspace.origin) ? workspace.origin : null;
  const existingPointIds = new Set();
  state.version = 3;

  if (Array.isArray(workspace.pointLists)) {
    state.pointLists = workspace.pointLists
      .map((list, index) => normalizePointList(list, existingPointIds, index === 0 ? "マイ地点" : `地点リスト ${index + 1}`))
      .filter(Boolean);
  } else {
    const points = Array.isArray(workspace.points)
      ? workspace.points.map((point) => normalizePoint(point, origin)).filter(Boolean)
      : [];
    for (const point of points) {
      while (existingPointIds.has(point.id)) {
        point.id = createId();
      }
      existingPointIds.add(point.id);
    }
    state.pointLists = [createLocalPointList(points)];
  }

  ensurePointLists();
  refreshVisiblePoints();
  state.links = Array.isArray(workspace.links)
    ? workspace.links.filter((link) => validLinkEndpointId(link.a) && validLinkEndpointId(link.b))
    : [];
  state.selection = [];
  state.selectedPointId = null;
  state.selectedLinkId = null;
  state.pendingLinkPointId = null;
  state.routeSelectionIds = [];
  state.routeStartPointId = null;
  state.routeStartSnapshot = null;
  state.routeReturnToStart = false;
  state.routeResult = null;
  state.targetPointId = null;
  resetObservationTrail();
  state.editingPointId = null;
  state.lastDeleted = null;
  state.pendingGeo = null;
}

function normalizePoint(point, origin) {
  const geo = pointGeoFromAny(point, origin);
  if (!geo) {
    return null;
  }

  const projected = projectLatLng(geo.lat, geo.lng);
  return {
    id: point.id || createId(),
    x: projected.x,
    y: projected.y,
    title: typeof point.title === "string" && point.title.trim() ? point.title.trim() : "Point",
    note: typeof point.note === "string" ? point.note : "",
    photo: typeof point.photo === "string" ? point.photo : "",
    photoName: typeof point.photoName === "string" ? point.photoName : "",
    geo,
    createdAt: point.createdAt || new Date().toISOString()
  };
}

function createPointList(options = {}) {
  const now = new Date().toISOString();
  return {
    id: typeof options.id === "string" && options.id ? options.id : createId(),
    name: typeof options.name === "string" && options.name.trim() ? options.name.trim() : "地点リスト",
    description: typeof options.description === "string" ? options.description : "",
    author: typeof options.author === "string" ? options.author : "",
    visible: options.visible !== false,
    editable: Boolean(options.editable),
    source: typeof options.source === "string" ? options.source : "import",
    importedAt: typeof options.importedAt === "string" ? options.importedAt : now,
    createdAt: typeof options.createdAt === "string" ? options.createdAt : now,
    updatedAt: typeof options.updatedAt === "string" ? options.updatedAt : now,
    points: Array.isArray(options.points) ? options.points : []
  };
}

function createLocalPointList(points = []) {
  return createPointList({
    id: DEFAULT_POINT_LIST_ID,
    name: "マイ地点",
    visible: true,
    editable: true,
    source: "local",
    importedAt: "",
    points
  });
}

function ensurePointLists() {
  if (!Array.isArray(state.pointLists)) {
    state.pointLists = [];
  }

  if (state.pointLists.length === 0) {
    state.pointLists = [createLocalPointList(Array.isArray(state.points) ? state.points : [])];
  }

  if (!state.pointLists.some((list) => list.id === DEFAULT_POINT_LIST_ID)) {
    state.pointLists.unshift(createLocalPointList());
  }
}

function visiblePointLists() {
  ensurePointLists();
  return state.pointLists.filter((list) => list.visible !== false);
}

function allPointListPoints() {
  ensurePointLists();
  return state.pointLists.flatMap((list) => list.points);
}

function visiblePointIdSet() {
  return new Set(visiblePointLists().flatMap((list) => list.points.map((point) => point.id)));
}

function refreshVisiblePoints() {
  state.points = visiblePointLists().flatMap((list) => list.points);
}

function localPointList() {
  ensurePointLists();
  let list = state.pointLists.find((item) => item.id === DEFAULT_POINT_LIST_ID);
  if (!list) {
    list = createLocalPointList();
    state.pointLists.unshift(list);
  }
  return list;
}

function pointListForPoint(pointId) {
  ensurePointLists();
  return state.pointLists.find((list) => list.points.some((point) => point.id === pointId)) ?? null;
}

function findPointAny(pointId) {
  return allPointListPoints().find((point) => point.id === pointId) ?? null;
}

function pointEditable(pointId) {
  return Boolean(pointListForPoint(pointId)?.editable);
}

function normalizePointList(list, existingPointIds = new Set(), fallbackName = "地点リスト") {
  const rawPoints = Array.isArray(list?.points) ? list.points : [];
  const points = rawPoints.map((point) => normalizePoint(point, null)).filter(Boolean);
  for (const point of points) {
    while (existingPointIds.has(point.id)) {
      point.id = createId();
    }
    existingPointIds.add(point.id);
  }

  const normalized = createPointList({
    id: typeof list?.id === "string" && list.id ? list.id : createId(),
    name: typeof list?.name === "string" && list.name.trim() ? list.name.trim() : fallbackName,
    description: typeof list?.description === "string" ? list.description : "",
    author: typeof list?.author === "string" ? list.author : "",
    visible: list?.visible !== false,
    editable: Boolean(list?.editable),
    source: typeof list?.source === "string" ? list.source : "import",
    importedAt: typeof list?.importedAt === "string" ? list.importedAt : new Date().toISOString(),
    createdAt: typeof list?.createdAt === "string" ? list.createdAt : new Date().toISOString(),
    updatedAt: typeof list?.updatedAt === "string" ? list.updatedAt : new Date().toISOString(),
    points
  });

  if (normalized.id === DEFAULT_POINT_LIST_ID) {
    normalized.name = normalized.name || "マイ地点";
    normalized.editable = true;
    normalized.source = "local";
  }

  return normalized;
}

function pruneHiddenPointReferences() {
  const visibleIds = visiblePointIdSet();
  state.selection = state.selection.filter((entry) => entry.type !== "point" || visibleIds.has(entry.id));
  state.routeSelectionIds = state.routeSelectionIds.filter((id) => visibleIds.has(id));

  if (state.routeStartPointId && state.routeStartPointId !== CURRENT_LOCATION_ID && !visibleIds.has(state.routeStartPointId)) {
    clearRouteStartState();
  }

  if (state.targetPointId && !visibleIds.has(state.targetPointId)) {
    clearTarget({ render: false });
  }

  if (state.routeResult?.pointIds?.some((id) => !visibleIds.has(id))) {
    state.routeResult = null;
  }
}

function safeFilenamePart(value) {
  return String(value || "list")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 60) || "list";
}

function syncProjectedPoint(point) {
  if (!point || typeof point !== "object") {
    return null;
  }

  const geo = pointGeoFromAny(point, null);
  if (!geo) {
    return null;
  }

  const projected = projectGeo(geo);
  point.geo = geo;
  point.x = projected.x;
  point.y = projected.y;
  return point;
}

function syncProjectedCoordinates() {
  ensurePointLists();
  for (const point of allPointListPoints()) {
    syncProjectedPoint(point);
  }

  syncProjectedPoint(state.routeStartSnapshot);
  syncProjectedPoint(state.observationStart);
  for (const point of state.observationTrail) {
    syncProjectedPoint(point);
  }

  for (const observation of state.loadedObservations) {
    syncProjectedPoint(observation.start);
    syncProjectedPoint(observation.target);
    if (Array.isArray(observation.trail)) {
      for (const point of observation.trail) {
        syncProjectedPoint(point);
      }
    }
  }
}
function pointGeoFromAny(point, origin) {
  if (validGeo(point.geo)) {
    return normalizeGeo(point.geo);
  }

  if (Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
    return normalizeGeo({ lat: point.lat, lng: point.lng, accuracy: point.accuracy });
  }

  if (origin && Number.isFinite(point.x) && Number.isFinite(point.y)) {
    const lat = origin.lat + point.y / 111320;
    const lng = origin.lng + point.x / (111320 * Math.cos((origin.lat * Math.PI) / 180));
    return normalizeGeo({ lat, lng });
  }

  if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
    return normalizeGeo(unprojectMercator(point.x, point.y));
  }

  return null;
}

function workspaceSnapshot() {
  ensurePointLists();
  return {
    version: 3,
    projection: { mode: "local", version: 1 },
    pointLists: state.pointLists,
    links: state.links
  };
}

function persistWorkspace() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaceSnapshot()));
}

function syncCanvasSize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));

  canvasMetrics = { width, height, dpr };

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resizeCanvas() {
  syncCanvasSize();
  draw();
}

function scheduleCanvasResize() {
  if (canvasResizeFrame) {
    return;
  }

  canvasResizeFrame = window.requestAnimationFrame(() => {
    canvasResizeFrame = 0;
    resizeCanvas();
  });
}

function canvasSize() {
  if (canvasMetrics.width > 0 && canvasMetrics.height > 0) {
    return {
      width: canvasMetrics.width,
      height: canvasMetrics.height
    };
  }

  const rect = canvas.getBoundingClientRect();
  return {
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height)
  };
}

function clampScale(scale) {
  return Math.min(24, Math.max(0.000006, scale));
}

function worldToScreen(point) {
  const size = canvasSize();
  return {
    x: size.width / 2 + (point.x - state.viewport.x) * state.viewport.scale,
    y: size.height / 2 - (point.y - state.viewport.y) * state.viewport.scale
  };
}

function screenToWorld(point) {
  const size = canvasSize();
  return {
    x: state.viewport.x + (point.x - size.width / 2) / state.viewport.scale,
    y: state.viewport.y - (point.y - size.height / 2) / state.viewport.scale
  };
}

function chooseGridStep() {
  const candidates = [
    1, 2, 5, 10, 20, 50, 100, 200, 500,
    1000, 2000, 5000, 10000, 20000, 50000,
    100000, 200000, 500000, 1000000, 2000000,
    5000000, 10000000
  ];
  return candidates.find((step) => step * state.viewport.scale >= 48) ?? 20000000;
}

function viewportCenterGeo() {
  return unprojectWorld(state.viewport.x, state.viewport.y);
}

function drawGrid(width, height) {
  const majorGroundStep = chooseGridStep();
  const majorStep = majorGroundStep;
  const minorStep = majorStep / 5;
  const topLeft = screenToWorld({ x: 0, y: 0 });
  const bottomRight = screenToWorld({ x: width, y: height });

  const colors = canvasPalette();
  drawGridLines(topLeft, bottomRight, minorStep, colors.gridMinor, 1);
  drawGridLines(topLeft, bottomRight, majorStep, colors.gridMajor, 1.25);
}

function drawGridLines(topLeft, bottomRight, step, color, lineWidth) {
  const minX = Math.floor(topLeft.x / step) * step;
  const maxX = Math.ceil(bottomRight.x / step) * step;
  const minY = Math.floor(bottomRight.y / step) * step;
  const maxY = Math.ceil(topLeft.y / step) * step;
  const size = canvasSize();

  context.beginPath();
  context.strokeStyle = color;
  context.lineWidth = lineWidth;

  for (let x = minX; x <= maxX; x += step) {
    const screen = worldToScreen({ x, y: 0 });
    context.moveTo(screen.x, 0);
    context.lineTo(screen.x, size.height);
  }

  for (let y = minY; y <= maxY; y += step) {
    const screen = worldToScreen({ x: 0, y });
    context.moveTo(0, screen.y);
    context.lineTo(size.width, screen.y);
  }

  context.stroke();
}

function drawLinks() {
  for (const link of state.links) {
    const a = findPoint(link.a);
    const b = findPoint(link.b);
    if (!a || !b) {
      continue;
    }

    const start = worldToScreen(a);
    const end = worldToScreen(b);
    const isSelected = isLinkSelected(link.id);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    const colors = canvasPalette();
    context.strokeStyle = isSelected ? colors.linkSelected : colors.link;
    context.lineWidth = isSelected ? 5 : 2.4;
    context.stroke();
  }
}

function drawTargetLine() {
  const anchor = routeStartPoint();
  const target = targetPoint();
  if (!observationEndpointsDistinct(anchor, target)) {
    return;
  }

  const start = worldToScreen(anchor);
  const end = worldToScreen(target);
  const lineEnd = targetLineEndPoint(start, end);
  const colors = canvasPalette();

  context.save();
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(lineEnd.x, lineEnd.y);
  const guideColor = colors.targetGuide ?? colors.target;
  context.strokeStyle = guideColor;
  context.lineWidth = 2.8;
  context.setLineDash([7, 6]);
  context.stroke();
  context.setLineDash([]);
  drawArrowHead(start, lineEnd, guideColor);

  context.beginPath();
  context.arc(end.x, end.y, POINT_RADIUS + 8, 0, Math.PI * 2);
  context.strokeStyle = colors.targetSoft;
  context.lineWidth = 6;
  context.stroke();
  context.restore();
}

function targetLineEndPoint(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= POINT_RADIUS + 12) {
    return end;
  }

  const offset = POINT_RADIUS + 5;
  return {
    x: end.x - (dx / distance) * offset,
    y: end.y - (dy / distance) * offset
  };
}

function drawArrowHead(start, tip, color) {
  const dx = tip.x - start.x;
  const dy = tip.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) {
    return;
  }

  const ux = dx / distance;
  const uy = dy / distance;
  const px = -uy;
  const py = ux;
  const length = 13;
  const width = 7;
  const base = {
    x: tip.x - ux * length,
    y: tip.y - uy * length
  };

  context.beginPath();
  context.moveTo(tip.x, tip.y);
  context.lineTo(base.x + px * width, base.y + py * width);
  context.lineTo(base.x - px * width, base.y - py * width);
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

function activeObservationLayer() {
  const start = observationStartPoint();
  const target = targetPoint();
  const current = observationModeActive() ? currentLocationPoint() : null;
  const points = observationDisplayPathPoints(current);
  if (!start || points.length < 2) {
    return null;
  }

  return { id: "__active_observation__", start, target, points, loaded: false };
}

function loadedObservationLayer(observation) {
  if (!observation || !observation.start || !Array.isArray(observation.trail) || observation.trail.length === 0) {
    return null;
  }

  return {
    id: observation.id,
    start: observation.start,
    target: observation.target ?? null,
    points: [observation.start, ...observation.trail],
    loaded: true
  };
}

function loadedObservationLayers() {
  return state.loadedObservations.map(loadedObservationLayer).filter(Boolean);
}

function visibleObservationLayers() {
  const layers = loadedObservationLayers();
  const active = activeObservationLayer();
  if (active) {
    layers.push(active);
  }
  return layers;
}

function drawObservationLayer(layer) {
  const colors = canvasPalette();
  const isSelected = layer.loaded && isLoadedObservationSelected(layer.id);
  const startScreen = worldToScreen(layer.start);
  const targetScreen = layer.target ? worldToScreen(layer.target) : null;

  context.save();
  if (targetScreen) {
    context.beginPath();
    context.moveTo(startScreen.x, startScreen.y);
    context.lineTo(targetScreen.x, targetScreen.y);
    context.strokeStyle = isSelected ? colors.selected : colors.observationBaseline;
    context.lineWidth = isSelected ? 3 : 2.2;
    context.setLineDash([12, 8]);
    context.stroke();
  }

  context.beginPath();
  layer.points.forEach((point, index) => {
    const screen = worldToScreen(point);
    if (index === 0) {
      context.moveTo(screen.x, screen.y);
    } else {
      context.lineTo(screen.x, screen.y);
    }
  });
  context.strokeStyle = isSelected ? colors.selected : colors.observationTrail;
  context.lineWidth = layer.loaded ? (isSelected ? 4.2 : 2.8) : 3.4;
  context.setLineDash([4, 4]);
  context.stroke();
  context.restore();
}

function drawObservationPath() {
  for (const layer of visibleObservationLayers()) {
    drawObservationLayer(layer);
  }
}
function drawRouteResult() {
  const points = routeResultPoints();
  if (points.length < 2) {
    return;
  }

  context.save();
  context.beginPath();
  points.forEach((point, index) => {
    const screen = worldToScreen(point);
    if (index === 0) {
      context.moveTo(screen.x, screen.y);
    } else {
      context.lineTo(screen.x, screen.y);
    }
  });
  if (state.routeResult.returnToStart) {
    const first = worldToScreen(points[0]);
    context.lineTo(first.x, first.y);
  }
  context.strokeStyle = canvasPalette().route;
  context.lineWidth = 3.2;
  context.setLineDash([10, 7]);
  context.stroke();
  context.restore();
}

function drawCurrentLocation() {
  const location = currentLocationPoint();
  if (!location) {
    return;
  }

  const colors = canvasPalette();
  const screen = worldToScreen(location);
  const isSelected = isPointSelected(CURRENT_LOCATION_ID);

  context.beginPath();
  context.arc(screen.x, screen.y, POINT_RADIUS, 0, Math.PI * 2);
  context.fillStyle = colors.currentFill;
  context.fill();

  if (isSelected) {
    context.lineWidth = 4;
    context.strokeStyle = colors.selected;
    context.stroke();
  }
}

function drawRouteStartSnapshot() {
  const snapshot = currentRouteStartSnapshot();
  if (!snapshot) {
    return;
  }

  const colors = canvasPalette();
  const screen = worldToScreen(snapshot);
  context.save();

  context.beginPath();
  context.arc(screen.x, screen.y, POINT_RADIUS, 0, Math.PI * 2);
  context.fillStyle = colors.routeStart;
  context.fill();
  context.restore();
}
function drawPendingPoint() {
  if (!validGeo(state.pendingGeo)) {
    return;
  }

  const colors = canvasPalette();
  const projected = projectLatLng(state.pendingGeo.lat, state.pendingGeo.lng);
  const screen = worldToScreen(projected);
  context.save();
  context.beginPath();
  context.arc(screen.x, screen.y, 10, 0, Math.PI * 2);
  context.fillStyle = colors.pendingFill;
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = colors.pendingStroke;
  context.setLineDash([4, 4]);
  context.stroke();
  context.restore();
}
function isPriorityPoint(point) {
  return point.id === state.targetPointId || point.id === state.routeStartPointId;
}

function drawPointMarker(point, colors) {
  const screen = worldToScreen(point);
  const isTarget = point.id === state.targetPointId;
  const isRouteStart = point.id === state.routeStartPointId;
  const isSelected = isPointSelected(point.id);
  context.beginPath();
  context.arc(screen.x, screen.y, POINT_RADIUS, 0, Math.PI * 2);
  context.fillStyle = isTarget ? colors.targetFill : isRouteStart ? colors.routeStart : colors.pointFill;
  context.fill();

  if (isSelected) {
    context.lineWidth = 4;
    context.strokeStyle = colors.selected;
    context.stroke();
  }
}

function drawPoints(options = {}) {
  const colors = canvasPalette();
  const priority = Boolean(options.priority);
  for (const point of state.points) {
    if (isPriorityPoint(point) !== priority) {
      continue;
    }

    drawPointMarker(point, colors);
  }
}

function drawRouteBadges() {
  const colors = canvasPalette();
  const ids = state.routeResult?.pointIds ?? [];
  ids.forEach((pointId, index) => {
    const point = findPoint(pointId);
    if (!point) {
      return;
    }

    const screen = worldToScreen(point);
    const label = String(index + 1);
    context.beginPath();
    context.arc(screen.x + 12, screen.y - 12, 9, 0, Math.PI * 2);
    context.fillStyle = index === 0 ? colors.badgeStartFill : colors.badgeFill;
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = colors.badgeStartFill;
    context.stroke();
    context.fillStyle = index === 0 ? colors.badgeStartText : colors.badgeText;
    context.font = "700 11px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, screen.x + 12, screen.y - 12);
  });
}

function draw() {
  const size = canvasSize();
  context.clearRect(0, 0, size.width, size.height);
  drawGrid(size.width, size.height);
  drawLinks();
  drawRouteResult();
  drawObservationPath();
  drawTargetLine();
  drawPoints();
  drawCurrentLocation();
  drawPendingPoint();
  drawRouteStartSnapshot();
  drawPoints({ priority: true });
  drawRouteBadges();
}

function render() {
  refreshVisiblePoints();
  pruneHiddenPointReferences();
  normalizeSelection();
  syncCanvasSize();
  draw();
  renderDetails();
  renderAnalysis();
  renderRoute();
  renderPointLists();
  renderPointIndex();
  renderMobileGridTabs();
  renderSelectedSummary();
  renderSelectionInfo();
  renderStatus();
  renderActionButtons();
  syncSettingsControls();
}

function renderSelectedSummary() {
  const title = state.selection.length > 0
    ? state.selection.map(selectionTitle).join(", ")
    : t("state.unselected");
  elements.mobileSelectedTitle.textContent = title;
  elements.sidebarSelectedTitle.textContent = title;
}

function validMobilePageName(value) {
  return ["map", "register", "data"].includes(value);
}

function storedMobilePageName() {
  try {
    const value = localStorage.getItem(MOBILE_PAGE_KEY);
    return validMobilePageName(value) ? value : "map";
  } catch {
    return "map";
  }
}

function setMobilePage(name, options = {}) {
  const pageName = validMobilePageName(name) ? name : "map";
  const mapActive = pageName === "map";

  for (const tab of elements.mobilePageTabs) {
    const active = tab.dataset.mobilePage === pageName;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-pressed", String(active));
  }

  elements.mapColumn.classList.toggle("is-mobile-page-active", mapActive);
  elements.sidebar.classList.toggle("is-mobile-page-active", !mapActive);

  for (const panel of elements.mobilePanels) {
    panel.classList.toggle("is-mobile-active", !mapActive && panel.dataset.mobilePanel === pageName);
  }

  if (mapActive) {
    scheduleCanvasResize();
  }

  if (options.persist !== false) {
    try {
      localStorage.setItem(MOBILE_PAGE_KEY, pageName);
    } catch {
      // Ignore storage failures; the visible page has already been updated.
    }
  }
}

function validMobileGridPageName(value) {
  return MOBILE_GRID_PAGES.includes(value);
}

function setMobileGridPage(name) {
  const pageName = validMobileGridPageName(name) ? name : "grid";
  state.mobileGridPage = pageName;

  for (const tab of elements.mobileGridTabs) {
    const active = tab.dataset.mobileGridPage === pageName;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-pressed", String(active));
  }

  for (const panel of elements.mobileGridPanels) {
    panel.classList.toggle("is-mobile-grid-active", panel.dataset.mobileGridPanel === pageName);
  }

  if (pageName === "grid") {
    scheduleCanvasResize();
  }
}

function renderMobileGridTabs() {
  setMobileGridPage(state.mobileGridPage);
}

function initMobilePages() {
  setMobilePage(storedMobilePageName(), { persist: false });
  setMobileGridPage("grid");
}

function mobilePageUiActive() {
  return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 860px)").matches;
}

function renderSelectionInfo() {
  elements.selectionInfoText.textContent = selectionInfoText();
}

function selectionInfoText() {
  const observationText = observationInfoText();
  if (observationText) {
    return observationText;
  }

  const followText = followStateInfoText();
  if (state.selection.length === 0) {
    return followText || t("state.unselected");
  }

  const points = selectedPointIds().map(findPoint).filter(Boolean);
  const links = selectedLinkIds().map(findLink).filter(Boolean);
  const observations = selectedObservationIds();

  if (state.selection.length === 1) {
    const entry = state.selection[0];
    if (entry.type === "observation") {
      return loadedObservationInfoText(findLoadedObservation(entry.id)) || t("message.loadedObservation");
    }

    if (entry.type === "point") {
      const point = findPoint(entry.id);
      return point ? pointSelectionInfo(point) : t("message.pointUnavailable");
    }

    const link = findLink(entry.id);
    return link ? linkSelectionInfo(link) : t("message.linkUnavailable");
  }

  if (points.length === 2 && links.length === 0) {
    return `${points[0].title} - ${points[1].title} | ${t("label.betweenTwo")} ${formatDistance(distanceBetween(points[0], points[1]))}`;
  }

  const parts = [];
  const countParts = [];
  if (points.length > 0) {
    countParts.push(`${points.length}${t("label.points")}`);
  }
  if (links.length > 0) {
    countParts.push(`${links.length}${t("label.links")}`);
  }
  if (observations.length > 0) {
    countParts.push(`${observations.length}${t("label.observations")}`);
  }
  if (countParts.length > 0) {
    parts.push(`${t("label.selected")} ${countParts.join(" / ")}`);
  }

  if (points.length > 1) {
    parts.push(`${t("label.sequence")} ${formatDistance(pointSequenceDistance(points))}`);
  }

  const linkTotal = selectedLinksDistance(links);
  if (Number.isFinite(linkTotal)) {
    parts.push(`${t("label.linkTotal")} ${formatDistance(linkTotal)}`);
  }

  return parts.join(" | ") || t("summary.selected");
}

function followStateInfoText() {
  if (!state.followCurrentLocation) {
    return "";
  }

  const start = observationStartPoint();
  const target = targetPoint();
  if (start && target) {
    return `観察中 ${start.title} → ${target.title}`;
  }
  if (start) {
    return `観察中 ${start.title}から`;
  }
  if (target) {
    return `追跡準備中 現在地 → ${target.title}`;
  }

  return "追跡準備中 現在地";
}

function pointSelectionInfo(point) {
  const geo = pointGeo(point);
  const coords = `${formatCoordinate(geo.lat)}, ${formatCoordinate(geo.lng)}`;
  const accuracy = Number.isFinite(geo.accuracy) ? ` | ${t("label.accuracy")} ±${formatDistance(geo.accuracy)}` : "";

  if (point.id === CURRENT_LOCATION_ID) {
    return `${point.title} | ${coords}${accuracy}`;
  }

  const current = currentLocationPoint();
  if (current) {
    return `${point.title} | ${t("label.fromCurrent")} ${formatDistance(distanceBetween(current, point))} | ${coords}`;
  }

  return `${point.title} | ${coords}`;
}

function linkSelectionInfo(link) {
  const endpoints = linkEndpoints(link);
  if (!endpoints) {
    return t("message.linkUnavailable");
  }

  return `${linkTitle(link)} | ${t("field.distance")} ${formatDistance(distanceBetween(endpoints.a, endpoints.b))}`;
}

function pointSequenceDistance(points) {
  return points.slice(1).reduce((total, point, index) => total + distanceBetween(points[index], point), 0);
}

function selectedLinksDistance(links) {
  if (links.length === 0) {
    return NaN;
  }

  return links.reduce((total, link) => {
    const endpoints = linkEndpoints(link);
    return endpoints ? total + distanceBetween(endpoints.a, endpoints.b) : total;
  }, 0);
}

function renderStatus() {
  elements.statusLine.value = `${t("status.grid")} ${formatDistance(chooseGridStep())}`;
}

function renderActionButtons() {
  const hasPendingPoint = validGeo(state.pendingGeo);
  const pointIds = selectedPointIds();
  const linkIds = selectedLinkIds();
  const pointPair = selectedPointPair();
  const singlePointCandidate = singleSelectedPoint();
  const targetCandidate = singleTargetableSelectedPoint();
  const routeStartCandidate = singlePointCandidate;
  const routePlan = routePlanFromCurrentSelection();
  const routeActive = Boolean(state.routeResult);
  const routeStart = routeStartPoint();
  const target = targetPoint();
  const targetSwitchesFromRouteStart = Boolean(
    targetCandidate && targetCandidate.id !== state.targetPointId && routeStart && !observationEndpointsDistinct(routeStart, targetCandidate)
  );
  const routeStartSwitchesFromTarget = Boolean(
    routeStartCandidate && routeStartCandidate.id !== state.routeStartPointId && target && !observationEndpointsDistinct(routeStartCandidate, target)
  );
  const centerCandidateCount = pointIds.length;
  const restoreCandidateCount = deletedSnapshotItemCount();
  const editCandidate = editableSelectedPoint();
  const mapCandidate = mapPointForSelection();
  const deletablePointCount = pointIds.filter((id) => id !== CURRENT_LOCATION_ID && pointEditable(id)).length;
  const observationSelected = isLoadedObservationSelected();
  const canDelete = deletablePointCount + linkIds.length > 0 || observationSelected;

  const canOpenRegisterPage = !hasPendingPoint && state.selection.length === 0 && mobilePageUiActive();
  elements.actionRegisterButton.disabled = !hasPendingPoint && !canOpenRegisterPage;
  elements.actionLinkButton.disabled = !pointPair;
  elements.actionRouteButton.disabled = !routeActive && !routePlan;
  elements.deletePointButton.disabled = !canDelete;
  elements.clearSelectionButton.disabled = state.selection.length === 0 && !hasPendingPoint;
  elements.actionTargetButton.disabled = !targetCandidate;
  elements.actionRouteStartButton.disabled = !routeStartCandidate;
  elements.actionCenterButton.disabled = centerCandidateCount < 2;
  elements.actionRestoreButton.disabled = restoreCandidateCount === 0;
  elements.actionEditButton.disabled = !editCandidate;
  elements.actionMapButton.disabled = !mapCandidate;

  elements.actionRegisterButton.classList.remove("is-active");
  elements.actionRegisterButton.title = hasPendingPoint ? "仮ポイントを登録" : canOpenRegisterPage ? "地点登録画面を開く" : "仮ポイントを作成すると登録できます";
  elements.actionLinkButton.classList.toggle("is-active", false);
  elements.actionRouteButton.classList.toggle("is-active", routeActive);
  elements.actionRouteButton.setAttribute("aria-pressed", String(routeActive));
  elements.actionRouteButton.title = routeActive ? "巡回表示を解除" : routePlan ? "選択点を起点から巡回計算" : "複数選択と起点指定が必要";
  elements.actionTargetButton.title = targetSwitchesFromRouteStart ? "起点から対象に切り替え" : "選択地点を対象にする";
  elements.actionRouteStartButton.title = routeStartSwitchesFromTarget ? "対象から起点に切り替え" : "選択地点を起点にする";
  elements.deletePointButton.classList.toggle("is-active", false);
  elements.clearSelectionButton.classList.toggle("is-active", false);
  elements.actionTargetButton.classList.toggle("is-active", Boolean(targetCandidate && targetCandidate.id === state.targetPointId));
  elements.actionRouteStartButton.classList.toggle("is-active", Boolean(routeStartCandidate && routeStartCandidate.id === state.routeStartPointId));
  elements.actionCenterButton.classList.toggle("is-active", false);
  elements.actionRestoreButton.classList.toggle("is-active", false);
  elements.actionEditButton.classList.toggle("is-active", Boolean(state.editingPointId));
  elements.actionMapButton.classList.toggle("is-active", false);
  elements.actionRestoreButton.title = restoreCandidateCount > 0 ? `直前の削除を復旧 (${restoreCandidateCount}件)` : "直前の削除を復旧";
  elements.pointSubmitButton.textContent = state.editingPointId ? t("button.update") : t("button.submitRegister");
  elements.actionRouteLabel.textContent = t("action.route");
  renderLocationFollowButton();
}

function renderDetails() {
  const entries = state.selection;
  const point = selectedPoint();
  const link = selectedLink();
  const observation = selectedObservation();
  const hasSelection = entries.length > 0;

  elements.emptyDetails.hidden = hasSelection;
  elements.pointDetails.hidden = !hasSelection;

  if (!hasSelection) {
    elements.selectionHeading.textContent = "選択地点";
    return;
  }

  elements.detailPhoto.hidden = true;
  elements.detailPhoto.removeAttribute("src");
  elements.detailPhoto.alt = "";

  if (entries.length > 1) {
    const counts = selectedCounts();
    const parts = [];
    if (counts.point > 0) {
      parts.push(`${counts.point}${t("label.points")}`);
    }
    if (counts.link > 0) {
      parts.push(`${counts.link}${t("label.links")}`);
    }
    if (counts.observation > 0) {
      parts.push(`${counts.observation}${t("label.observations")}`);
    }

    elements.selectionHeading.textContent = t("panel.multiSelect");
    elements.detailTitleLabel.textContent = t("label.selected");
    elements.detailCoordsLabel.textContent = t("field.count");
    elements.detailCreatedLabel.textContent = t("field.order");
    elements.detailNoteLabel.textContent = t("field.operation");
    elements.detailTitle.textContent = state.selection.map(selectionTitle).join(", ");
    elements.detailCoords.textContent = parts.join(" / ");
    elements.detailCreated.textContent = state.selection.map((entry, index) => `${index + 1}. ${selectionTitle(entry)}`).join(" / ");
    elements.detailNote.textContent = t("message.quickHint");
    elements.mapOpenActions.hidden = true;
    elements.targetActions.hidden = true;
    return;
  }

  elements.selectionHeading.textContent = observation ? t("panel.observationResult") : link ? t("panel.selectedLine") : t("panel.details");

  if (observation) {
    elements.detailTitleLabel.textContent = t("field.name");
    elements.detailCoordsLabel.textContent = t("field.actualDistance");
    elements.detailCreatedLabel.textContent = t("field.record");
    elements.detailNoteLabel.textContent = t("field.result");
    elements.detailTitle.textContent = loadedObservationTitle(observation);
    elements.detailCoords.textContent = formatDistance(observation.metrics.traveled);
    elements.detailCreated.textContent = `${formatDate(observation.startedAt)} - ${formatDate(observation.endedAt)}`;
    elements.detailNote.textContent = loadedObservationInfoText(observation) || t("message.loadedObservation");
    elements.mapOpenActions.hidden = true;
    elements.targetActions.hidden = true;
    return;
  }

  if (link) {
    const endpoints = linkEndpoints(link);
    if (!endpoints) {
      return;
    }

    elements.detailTitleLabel.textContent = t("field.line");
    elements.detailCoordsLabel.textContent = t("field.distance");
    elements.detailCreatedLabel.textContent = t("field.created");
    elements.detailNoteLabel.textContent = t("field.endpoints");
    elements.detailTitle.textContent = linkTitle(link);
    elements.detailCoords.textContent = formatDistance(distanceBetween(endpoints.a, endpoints.b));
    elements.detailCreated.textContent = formatDate(link.createdAt);
    elements.detailNote.textContent = `${endpoints.a.title} / ${endpoints.b.title}`;
    elements.mapOpenActions.hidden = true;
    elements.targetActions.hidden = true;
    return;
  }

  if (!point) {
    return;
  }

  const geo = pointGeo(point);
  const accuracy = Number.isFinite(geo.accuracy) ? ` / ±${formatDistance(geo.accuracy)}` : "";
  elements.detailTitleLabel.textContent = t("field.title");
  elements.detailCoordsLabel.textContent = t("field.coords");
  elements.detailCreatedLabel.textContent = t("field.created");
  elements.detailNoteLabel.textContent = t("field.note");
  elements.detailTitle.textContent = point.title;
  elements.detailCoords.textContent = `${formatCoordinate(geo.lat)}, ${formatCoordinate(geo.lng)}${accuracy}`;
  elements.detailCreated.textContent = point.isVirtual ? t("message.currentLocation") : formatDate(point.createdAt);
  elements.detailNote.textContent = point.note || t("label.none");
  elements.mapOpenActions.hidden = false;
  renderTargetActions(point);

  if (point.photo) {
    elements.detailPhoto.hidden = false;
    elements.detailPhoto.src = point.photo;
    elements.detailPhoto.alt = point.photoName || point.title;
  }
}
function renderTargetActions(point) {
  const canTarget = point && !point.isVirtual;
  elements.targetActions.hidden = !canTarget;
  if (!canTarget) {
    return;
  }

  const isTarget = point.id === state.targetPointId;
  const start = routeStartPoint();
  const switchesFromRouteStart = !isTarget && start && !observationEndpointsDistinct(start, point);
  elements.targetPointButton.disabled = false;
  elements.targetPointButton.textContent = isTarget ? t("button.clearTarget") : t("button.setTarget");
  elements.targetPointButton.title = switchesFromRouteStart ? "起点からターゲットに切り替え" : "ターゲットにする";
  elements.targetPointButton.classList.toggle("is-active", isTarget);
  elements.targetPointButton.setAttribute("aria-pressed", String(isTarget));
}

function targetPoint() {
  return findPoint(state.targetPointId);
}

function targetDistanceMeters() {
  const current = currentLocationPoint();
  const target = targetPoint();
  return current && target ? distanceBetween(current, target) : NaN;
}

function targetArrived() {
  const distance = targetDistanceMeters();
  if (!Number.isFinite(distance)) {
    return false;
  }

  const accuracy = Number.isFinite(state.currentGeo?.accuracy) ? state.currentGeo.accuracy : 0;
  return distance <= Math.max(TARGET_ARRIVAL_METERS, accuracy);
}

function resetObservationTrail() {
  state.observationStartId = null;
  state.observationTargetId = null;
  state.observationStart = null;
  state.observationTrail = [];
}

function observationModeActive() {
  const start = observationStartPoint();
  const target = targetPoint();
  return state.followCurrentLocation && observationScopeValid(start, target);
}

function observationResetNeedsConfirmation() {
  return observationModeActive() || state.observationTrail.length > 0;
}

function confirmObservationReset(actionLabel) {
  if (!observationResetNeedsConfirmation()) {
    return true;
  }

  const confirmed = window.confirm(`${actionLabel}しますか。記録中の実軌道はリセットされます。`);
  if (confirmed) {
    maybeSaveObservationRecord();
  }

  return confirmed;
}

function cloneObservationPoint(point) {
  const geo = pointGeo(point);
  return {
    id: point.id,
    x: point.x,
    y: point.y,
    title: point.title,
    geo,
    recordedAt: new Date().toISOString()
  };
}

function routeStartPoint() {
  if (state.routeStartPointId === CURRENT_LOCATION_ID) {
    return currentRouteStartSnapshot() ?? currentLocationPoint();
  }

  return findPoint(state.routeStartPointId);
}

function currentRouteStartSnapshot() {
  if (state.routeStartPointId !== CURRENT_LOCATION_ID) {
    return null;
  }

  return state.routeStartSnapshot ?? state.observationStart ?? null;
}

function ensureCurrentRouteStartSnapshot() {
  if (state.routeStartPointId !== CURRENT_LOCATION_ID || state.routeStartSnapshot) {
    return;
  }

  const current = currentLocationPoint();
  if (current) {
    state.routeStartSnapshot = cloneObservationPoint(current);
  }
}

function updateRouteStartSnapshot(point) {
  state.routeStartSnapshot = point?.id === CURRENT_LOCATION_ID ? cloneObservationPoint(point) : null;
}

function ensureTrackingObservationStart(current = currentLocationPoint()) {
  if (routeStartPoint()) {
    ensureCurrentRouteStartSnapshot();
    return true;
  }

  state.routeStartPointId = CURRENT_LOCATION_ID;
  if (!current) {
    return false;
  }

  state.routeStartSnapshot = cloneObservationPoint(current);
  return true;
}

function observationEndpointsDistinct(start, target) {
  if (!start || !target) {
    return false;
  }

  if (start.id && target.id && start.id === target.id) {
    return false;
  }

  return distanceBetween(start, target) > 1;
}

function observationScopeValid(start, target) {
  return Boolean(start) && (!target || observationEndpointsDistinct(start, target));
}

function clearRouteStartState() {
  state.routeStartPointId = null;
  state.routeStartSnapshot = null;
  resetObservationTrail();
}

function observationStartPoint() {
  return state.observationStart ?? routeStartPoint();
}

function observationAccuracy(point) {
  const accuracy = Number(point?.geo?.accuracy);
  return Number.isFinite(accuracy) ? Math.max(0, accuracy) : 0;
}

function hasUsableObservationAccuracy(point) {
  const accuracy = observationAccuracy(point);
  return accuracy === 0 || accuracy <= OBSERVATION_MAX_ACCURACY_METERS;
}

function observationStepThreshold(previous, point) {
  const accuracyThreshold = Math.max(observationAccuracy(previous), observationAccuracy(point)) * OBSERVATION_ACCURACY_FACTOR;
  return Math.max(OBSERVATION_MIN_STEP_METERS, accuracyThreshold);
}

function recordObservationPoint(current) {
  if (!state.followCurrentLocation || !current) {
    return;
  }

  ensureTrackingObservationStart(current);
  const target = targetPoint();
  const start = observationStartPoint();
  if (!observationScopeValid(start, target)) {
    return;
  }

  const targetId = target?.id ?? null;
  if (state.observationStartId !== start.id || state.observationTargetId !== targetId || !state.observationStart) {
    state.observationStartId = start.id;
    state.observationTargetId = targetId;
    state.observationStart = cloneObservationPoint(start);
    state.observationTrail = [];
  }

  const point = cloneObservationPoint(current);
  if (!hasUsableObservationAccuracy(point)) {
    return;
  }

  const previous = state.observationTrail.at(-1) ?? state.observationStart;
  if (previous && distanceBetween(previous, point) < observationStepThreshold(previous, point)) {
    return;
  }

  state.observationTrail.push(point);
  if (state.observationTrail.length > OBSERVATION_MAX_POINTS) {
    state.observationTrail.splice(0, state.observationTrail.length - OBSERVATION_MAX_POINTS);
  }
}

function observationPathPoints() {
  const start = observationStartPoint();
  if (!start || state.observationTrail.length === 0) {
    return [];
  }

  return [start, ...state.observationTrail];
}

function observationDisplayPathPoints(current) {
  const start = observationStartPoint();
  if (!start) {
    return [];
  }

  const points = [start, ...state.observationTrail];
  if (current) {
    const last = points.at(-1);
    if (!last || distanceBetween(last, current) > 1) {
      points.push(current);
    }
  }

  return points;
}

function observationPathDistance(points = observationPathPoints()) {
  if (points.length < 2) {
    return 0;
  }

  return points.slice(1).reduce((total, point, index) => total + distanceBetween(points[index], point), 0);
}

function observationMetrics() {
  const start = observationStartPoint();
  const target = targetPoint();
  const observing = observationModeActive();
  const current = observing ? currentLocationPoint() ?? state.observationTrail.at(-1) : state.observationTrail.at(-1);
  if (!observationScopeValid(start, target) || !current || (!observing && state.observationTrail.length === 0)) {
    return null;
  }

  const directToCurrent = distanceBetween(start, current);
  const displayPath = observationDisplayPathPoints(observing ? current : null);
  const traveled = Math.max(observationPathDistance(displayPath), directToCurrent);
  return {
    start,
    target,
    current,
    traveled,
    remaining: target ? distanceBetween(current, target) : NaN,
    ratio: directToCurrent > 1 ? traveled / directToCurrent : NaN
  };
}

function observationInfoText() {
  const metrics = observationMetrics();
  if (!metrics) {
    return "";
  }

  const parts = [
    metrics.target ? `観察 ${metrics.start.title} → ${metrics.target.title}` : `観察 ${metrics.start.title}から`,
    `実 ${formatDistance(metrics.traveled)}`
  ];

  if (Number.isFinite(metrics.remaining)) {
    parts.splice(1, 0, `残 ${formatDistance(metrics.remaining)}`);
  }

  if (Number.isFinite(metrics.ratio)) {
    parts.push(`道直比 ${metrics.ratio.toFixed(2)}`);
  }

  return parts.join(" | ");
}

function observationDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(localeName(), {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function observationRecordName(start, target, endedAt) {
  const label = observationDateLabel(endedAt);
  const title = target ? `${start.title} → ${target.title}` : `${start.title}から`;
  return `${title}${label ? ` ${label}` : ""}`;
}

function loadedObservationTitle(observation = selectedObservation()) {
  if (!observation) {
    return "読み込み観察";
  }

  return typeof observation.title === "string" && observation.title.trim()
    ? observation.title.trim()
    : observationRecordName(observation.start, observation.target, observation.endedAt);
}

function loadedObservationInfoText(observation = selectedObservation()) {
  const loaded = observation;
  if (!loaded) {
    return "";
  }

  const parts = [
    `観察結果 ${loadedObservationTitle(loaded)}`,
    `実 ${formatDistance(loaded.metrics.traveled)}`
  ];

  if (Number.isFinite(loaded.metrics.ratio)) {
    parts.push(`道直比 ${loaded.metrics.ratio.toFixed(2)}`);
  }

  return parts.join(" | ");
}

function observationSnapshot(options = {}) {
  const start = observationStartPoint();
  const target = targetPoint();
  if (!observationScopeValid(start, target)) {
    return null;
  }

  const trail = state.observationTrail.map(clonePlain);
  if (options.includeTarget && target) {
    const finalTarget = cloneObservationPoint(target);
    const last = trail.at(-1);
    if (!last || distanceBetween(last, finalTarget) > 1) {
      trail.push(finalTarget);
    }
  }

  if (trail.length === 0) {
    return null;
  }

  const path = [start, ...trail];
  const current = trail.at(-1);
  const traveled = path.slice(1).reduce((total, point, index) => total + distanceBetween(path[index], point), 0);
  const directToCurrent = distanceBetween(start, current);
  const endedAt = current.recordedAt ?? new Date().toISOString();

  return {
    type: "grid-atlas-observation",
    version: 1,
    title: observationRecordName(start, target, endedAt),
    exportedAt: new Date().toISOString(),
    startedAt: state.observationStart?.recordedAt ?? trail[0]?.recordedAt ?? new Date().toISOString(),
    endedAt,
    start: exportObservationPoint(start),
    target: target ? exportObservationPoint(target) : null,
    trail: trail.map(exportObservationPoint),
    metrics: {
      remaining: target ? distanceBetween(current, target) : NaN,
      traveled,
      ratio: directToCurrent > 1 ? traveled / directToCurrent : NaN
    }
  };
}

function exportObservationPoint(point) {
  const geo = pointGeo(point);
  return {
    id: point.id,
    title: point.title,
    geo,
    x: point.x,
    y: point.y,
    recordedAt: point.recordedAt
  };
}

function maybeSaveObservationRecord() {
  const snapshot = observationSnapshot();
  if (!snapshot) {
    return;
  }

  if (window.confirm("観察記録を保存しますか。")) {
    downloadJson(snapshot, `grid-atlas-observation-${dateTimeStamp()}.json`);
  }
}

function toggleTargetForSelection() {
  const point = singleTargetableSelectedPoint();
  if (!point) {
    return;
  }

  if (state.targetPointId === point.id) {
    if (!confirmObservationReset("対象を解除")) {
      return;
    }
    clearTarget({ render: false });
    setSelection([], { render: false });
    render();
    return;
  }

  const start = routeStartPoint();
  const switchesFromRouteStart = Boolean(start && !observationEndpointsDistinct(start, point));
  const changesTarget = Boolean(state.targetPointId && state.targetPointId !== point.id);
  if ((switchesFromRouteStart || changesTarget) && !confirmObservationReset(switchesFromRouteStart ? "起点から対象へ切り替え" : "対象を変更")) {
    return;
  }

  if (switchesFromRouteStart) {
    clearRouteStartState();
  }

  ensureCurrentRouteStartSnapshot();
  state.targetPointId = point.id;
  resetObservationTrail();
  if (!state.followCurrentLocation) {
    state.locationFollowScaleMode = FOLLOW_SCALE_MANUAL;
    setSelection([], { render: false });
    render();
    return;
  }

  state.locationFollowScaleMode = FOLLOW_SCALE_TARGET;
  const current = currentLocationPoint();
  if (current) {
    recordObservationPoint(current);
    setSelection([], { render: false });
    fitTargetFromCurrent(current, point);
    return;
  }

  setSelection([], { render: false });
  render();
}

function clearTarget(options = {}) {
  resetObservationTrail();
  state.targetPointId = null;
  if (state.locationFollowScaleMode === FOLLOW_SCALE_TARGET) {
    state.locationFollowScaleMode = state.followCurrentLocation ? FOLLOW_SCALE_CENTER : FOLLOW_SCALE_MANUAL;
  }

  if (options.render !== false) {
    render();
  }
}
function openSelectedPointInExternalMap(provider) {
  const point = selectedPoint();
  if (!point) {
    return;
  }

  openPointInExternalMap(point, provider);
}

function openSelectedPointInPreferredMap() {
  const point = mapPointForSelection();
  if (!point) {
    return;
  }

  openPointInExternalMap(point, preferredMapProvider());
}

function openPointInExternalMap(point, provider) {
  const geo = pointGeo(point);
  const url = externalMapUrl(provider, geo, point.title);
  window.location.href = url;
}

function externalMapUrl(provider, geo, title) {
  const lat = formatCoordinate(geo.lat);
  const lng = formatCoordinate(geo.lng);
  const label = encodeURIComponent(title || "GRID ATLAS Point");

  if (provider === "apple") {
    return `https://maps.apple.com/?ll=${lat},${lng}&q=${label}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
function renderAnalysis() {
  elements.pointCount.textContent = String(state.points.length);

  const linkDistances = state.links
    .map((link) => {
      const a = findPoint(link.a);
      const b = findPoint(link.b);
      return a && b ? { link, a, b, distance: distanceBetween(a, b) } : null;
    })
    .filter(Boolean);

  elements.linkCount.textContent = String(linkDistances.length);
  const total = linkDistances.reduce((sum, item) => sum + item.distance, 0);
  const longest = linkDistances.reduce((max, item) => Math.max(max, item.distance), 0);

  elements.totalDistance.textContent = linkDistances.length ? formatDistance(total) : "-";
  elements.longestDistance.textContent = linkDistances.length ? formatDistance(longest) : "-";

  elements.linkList.replaceChildren();

  if (linkDistances.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "線なし";
    elements.linkList.append(empty);
    return;
  }

  for (const item of linkDistances) {
    const row = document.createElement("div");
    row.className = "link-row";

    const text = document.createElement("div");
    const title = document.createElement("strong");
    const distance = document.createElement("span");
    title.textContent = `${item.a.title} - ${item.b.title}`;
    distance.textContent = formatDistance(item.distance);
    text.append(title, distance);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger-button";
    remove.title = "削除";
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      state.links = state.links.filter((link) => link.id !== item.link.id);
      removeSelectionEntry("link", item.link.id);
      persistWorkspace();
      render();
    });

    row.append(text, remove);
    elements.linkList.append(row);
  }
}


function pointRoleMarker(point) {
  const markers = [];
  if (point.id === CURRENT_LOCATION_ID) {
    markers.push("🟡");
  }
  if (point.id === state.routeStartPointId) {
    markers.push("🔵");
  }
  if (point.id === state.targetPointId) {
    markers.push("🟠");
  }
  return markers.length > 0 ? `${markers.join("")} ` : "";
}

function renderPointIndex() {
  if (!elements.mobilePointItems || !elements.mobilePointCount) {
    return;
  }

  ensurePointLists();
  const current = state.gpsEnabled ? currentLocationPoint() : null;
  const rows = visiblePointLists().flatMap((list) => list.points.map((point) => ({ point, list })));
  if (current) {
    rows.unshift({ point: current, list: null });
  }
  elements.mobilePointCount.textContent = `${rows.length}${t("label.points")}`;
  elements.mobilePointItems.replaceChildren();

  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = t("state.noPoints");
    elements.mobilePointItems.append(empty);
    return;
  }

  for (const { point, list } of rows) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "point-index-row";
    row.classList.toggle("is-active", isPointSelected(point.id));
    row.setAttribute("aria-pressed", String(isPointSelected(point.id)));

    const name = document.createElement("span");
    name.className = "point-index-name";
    const title = document.createElement("strong");
    title.textContent = `${pointRoleMarker(point)}${point.title || "Point"}`;
    const meta = document.createElement("span");
    meta.textContent = list?.name || t("label.gps");
    name.append(title, meta);

    const distance = document.createElement("span");
    distance.className = "point-index-distance";
    distance.textContent = point.id === CURRENT_LOCATION_ID ? t("message.currentLocation") : current ? formatDistance(distanceBetween(current, point)) : `${formatCoordinate(pointGeo(point).lat)}, ${formatCoordinate(pointGeo(point).lng)}`;

    row.append(name, distance);
    row.addEventListener("click", () => toggleSelection("point", point.id));
    elements.mobilePointItems.append(row);
  }
}

function createPointListRow(list) {
  const row = document.createElement("div");
  row.className = "point-list-row";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = list.visible !== false;
  checkbox.title = "グリッドに表示";
  checkbox.addEventListener("change", () => setPointListVisible(list.id, checkbox.checked));

  const name = document.createElement("div");
  name.className = "point-list-name";
  const title = document.createElement("strong");
  title.textContent = list.name || "地点リスト";
  const meta = document.createElement("span");
  const source = list.editable ? "編集可" : "共有リスト";
  meta.textContent = `${list.points.length}${t("label.points")} / ${source}`;
  name.append(title, meta);

  const save = document.createElement("button");
  save.type = "button";
  save.textContent = t("button.save");
  save.addEventListener("click", () => exportPointList(list.id));

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "danger-button";
  remove.textContent = "削除";
  remove.disabled = list.id === DEFAULT_POINT_LIST_ID;
  remove.title = remove.disabled ? "マイ地点は削除できません" : "リストを削除";
  remove.addEventListener("click", () => deletePointList(list.id));

  row.append(checkbox, name, save, remove);
  return row;
}

function renderPointLists() {
  ensurePointLists();

  for (const container of elements.pointListItemContainers) {
    container.replaceChildren();
    for (const list of state.pointLists) {
      container.append(createPointListRow(list));
    }
  }
}
function setPointListVisible(listId, visible) {
  const list = state.pointLists.find((item) => item.id === listId);
  if (!list) {
    return;
  }

  list.visible = Boolean(visible);
  list.updatedAt = new Date().toISOString();
  refreshVisiblePoints();
  pruneHiddenPointReferences();
  persistWorkspace();
  render();
}

function deletePointList(listId) {
  const list = state.pointLists.find((item) => item.id === listId);
  if (!list || list.id === DEFAULT_POINT_LIST_ID) {
    return;
  }

  const confirmed = window.confirm(`${list.name || "地点リスト"}を削除しますか。`);
  if (!confirmed) {
    return;
  }

  const pointIds = new Set(list.points.map((point) => point.id));
  state.pointLists = state.pointLists.filter((item) => item.id !== listId);
  state.links = state.links.filter((link) => !pointIds.has(link.a) && !pointIds.has(link.b));
  ensurePointLists();
  refreshVisiblePoints();
  pruneHiddenPointReferences();
  state.selection = state.selection.filter((entry) => entry.type !== "point" || !pointIds.has(entry.id));
  normalizeSelection();
  persistWorkspace();
  render();
}

function renderRoute() {
  normalizeRouteSelection();
  const selectedPoints = selectedPointIds().map(findPoint).filter(Boolean);
  const resultPoints = routeResultPoints();
  const routePlan = routePlanFromCurrentSelection();
  const start = routeStartPoint();
  elements.routeSelectedCount.textContent = selectedPoints.length > 0 ? `${selectedPoints.length}点` : `${resultPoints.length}点`;
  elements.routeStartSelect.replaceChildren();

  const option = document.createElement("option");
  option.value = start?.id ?? "";
  option.textContent = start?.title ?? "未指定";
  elements.routeStartSelect.append(option);
  elements.routeStartSelect.disabled = true;
  elements.routeReturnToStart.disabled = !routePlan;
  elements.routeReturnToStart.checked = state.routeReturnToStart;
  elements.computeRouteButton.disabled = !routePlan;
  elements.clearRouteSelectionButton.disabled = !state.routeResult;
  elements.routeList.replaceChildren();

  if (state.routeResult) {
    renderRouteResultDetails();
    return;
  }

  if (!start) {
    elements.routeSummary.textContent = t("route.needStart");
    return;
  }

  elements.routeSummary.textContent = selectedPoints.length < 2
    ? "2点以上を選択すると巡回を実行"
    : "巡回で最適順を計算";
}
function renderRouteResultDetails() {
  if (!state.routeResult) {
    return;
  }

  const method = state.routeResult.exact ? t("route.exact") : t("route.heuristic");
  const returnLabel = state.routeResult.returnToStart ? ` | ${t("route.return")}` : "";
  elements.routeSummary.textContent = `${method} | ${state.routeResult.pointIds.length}${t("label.points")}${returnLabel} | ${t("route.total")} ${formatDistance(state.routeResult.totalDistance)}`;

  const routePoints = routeResultPoints();
  routePoints.forEach((point, index) => {
    const item = document.createElement("li");
    const number = document.createElement("span");
    number.className = "route-step-number";
    number.textContent = String(index + 1);

    const text = document.createElement("div");
    const title = document.createElement("strong");
    const segment = document.createElement("small");
    title.textContent = point.title;
    segment.textContent = index === 0 ? t("route.start") : `${t("route.fromPrevious")} ${formatDistance(state.routeResult.segmentDistances[index - 1])}`;
    text.append(title, segment);

    const cumulative = document.createElement("span");
    cumulative.textContent = index === 0 ? formatDistance(0) : formatDistance(sumDistances(state.routeResult.segmentDistances.slice(0, index)));

    item.append(number, text, cumulative);
    elements.routeList.append(item);
  });

  if (state.routeResult.returnToStart && routePoints.length > 1) {
    const returnDistance = state.routeResult.segmentDistances[routePoints.length - 1];
    const item = document.createElement("li");
    const number = document.createElement("span");
    number.className = "route-step-number route-step-return";
    number.textContent = "戻";

    const text = document.createElement("div");
    const title = document.createElement("strong");
    const segment = document.createElement("small");
    title.textContent = `${routePoints.at(-1).title} - ${routePoints[0].title}`;
    segment.textContent = `${t("route.toStart")} ${formatDistance(returnDistance)}`;
    text.append(title, segment);

    const cumulative = document.createElement("span");
    cumulative.textContent = formatDistance(state.routeResult.totalDistance);

    item.append(number, text, cumulative);
    elements.routeList.append(item);
  }
}

function findPoint(id) {
  return id === CURRENT_LOCATION_ID ? currentLocationPoint() : findPointIn(id, state.points);
}

function findPointIn(id, points) {
  return points.find((point) => point.id === id) ?? null;
}

function validLinkEndpointId(id) {
  return id === CURRENT_LOCATION_ID || Boolean(findPointAny(id));
}

function findLink(id) {
  return state.links.find((link) => link.id === id) ?? null;
}

function linkEndpoints(link) {
  const a = findPoint(link?.a);
  const b = findPoint(link?.b);
  return a && b ? { a, b } : null;
}

function linkTitle(link) {
  const endpoints = linkEndpoints(link);
  return endpoints ? `${endpoints.a.title} - ${endpoints.b.title}` : "線";
}
function selectionKey(type, id) {
  return `${type}:${id}`;
}

function isValidSelectionEntry(entry) {
  if (!entry || typeof entry.id !== "string") {
    return false;
  }

  if (entry.type === "point") {
    return Boolean(findPoint(entry.id));
  }

  if (entry.type === "link") {
    const link = findLink(entry.id);
    return Boolean(link && linkEndpoints(link));
  }

  if (entry.type === "observation") {
    return Boolean(findLoadedObservation(entry.id));
  }

  return false;
}

function normalizeSelection() {
  const unique = [];
  const seen = new Set();

  for (const entry of state.selection) {
    if (!isValidSelectionEntry(entry)) {
      continue;
    }

    const key = selectionKey(entry.type, entry.id);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push({ type: entry.type, id: entry.id });
  }

  state.selection = unique;
  const primary = primarySelection();
  state.selectedPointId = primary?.type === "point" ? primary.id : null;
  state.selectedLinkId = primary?.type === "link" ? primary.id : null;
}

function primarySelection() {
  return state.selection.at(-1) ?? null;
}

function selectionTitle(entry) {
  if (entry.type === "point") {
    return findPoint(entry.id)?.title ?? "地点";
  }

  if (entry.type === "observation") {
    return loadedObservationTitle(findLoadedObservation(entry.id));
  }

  const link = findLink(entry.id);
  return link ? linkTitle(link) : "線";
}

function selectedPointIds() {
  return state.selection.filter((entry) => entry.type === "point" && findPoint(entry.id)).map((entry) => entry.id);
}

function selectedLinkIds() {
  return state.selection.filter((entry) => {
    if (entry.type !== "link") {
      return false;
    }
    const link = findLink(entry.id);
    return Boolean(link && linkEndpoints(link));
  }).map((entry) => entry.id);
}

function selectedObservationIds() {
  return state.selection.filter((entry) => entry.type === "observation" && findLoadedObservation(entry.id)).map((entry) => entry.id);
}

function selectedLoadedObservations() {
  return selectedObservationIds().map(findLoadedObservation).filter(Boolean);
}

function selectedCounts() {
  const point = selectedPointIds().length;
  const link = selectedLinkIds().length;
  const observation = selectedObservationIds().length;
  return { point, link, observation, total: point + link + observation };
}

function editableSelectedPoint() {
  const pointIds = selectedPointIds().filter((id) => id !== CURRENT_LOCATION_ID && pointEditable(id));
  return pointIds.length === 1 && selectedCounts().total === 1 && pointEditable(pointIds[0]) ? findPointIn(pointIds[0], state.points) : null;
}

function mapPointForSelection() {
  return singleSelectedPoint();
}

function deletedSnapshotItemCount() {
  if (!state.lastDeleted) {
    return 0;
  }

  const points = Array.isArray(state.lastDeleted.points) ? state.lastDeleted.points.length : 0;
  const links = Array.isArray(state.lastDeleted.links) ? state.lastDeleted.links.length : 0;
  const observations = Array.isArray(state.lastDeleted.observations) ? state.lastDeleted.observations.length : 0;
  return points + links + observations;
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createObservationId() {
  return `${LOADED_OBSERVATION_PREFIX}-${createId()}`;
}

function withObservationId(observation, existingIds = new Set()) {
  const next = clonePlain(observation);
  let id = typeof next.id === "string" && next.id ? next.id : createObservationId();
  while (existingIds.has(id)) {
    id = createObservationId();
  }
  next.id = id;
  existingIds.add(id);
  return next;
}

function findLoadedObservation(id) {
  return state.loadedObservations.find((observation) => observation.id === id) ?? null;
}

function preferredMapProvider() {
  return /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) ? "apple" : "google";
}

function isPointSelected(pointId) {
  return state.selection.some((entry) => entry.type === "point" && entry.id === pointId);
}

function isLinkSelected(linkId) {
  return state.selection.some((entry) => entry.type === "link" && entry.id === linkId);
}

function isLoadedObservationSelected(id) {
  if (id) {
    return state.selection.some((entry) => entry.type === "observation" && entry.id === id && findLoadedObservation(id));
  }

  return selectedObservationIds().length > 0;
}

function selectedObservation() {
  for (let index = state.selection.length - 1; index >= 0; index -= 1) {
    const entry = state.selection[index];
    if (entry.type === "observation") {
      const observation = findLoadedObservation(entry.id);
      if (observation) {
        return observation;
      }
    }
  }

  return null;
}

function selectedPoint() {
  const primary = primarySelection();
  return primary?.type === "point" ? findPoint(primary.id) : null;
}

function singleSelectedPoint() {
  const counts = selectedCounts();
  if (counts.total !== 1 || counts.point !== 1) {
    return null;
  }

  const entry = state.selection[0];
  return entry?.type === "point" ? findPoint(entry.id) : null;
}

function singleTargetableSelectedPoint() {
  const point = singleSelectedPoint();
  return point && !point.isVirtual ? point : null;
}

function lastSelectedPoint() {
  for (let index = state.selection.length - 1; index >= 0; index -= 1) {
    const entry = state.selection[index];
    if (entry.type === "point") {
      const point = findPoint(entry.id);
      if (point) {
        return point;
      }
    }
  }

  return null;
}

function lastTargetableSelectedPoint() {
  for (let index = state.selection.length - 1; index >= 0; index -= 1) {
    const entry = state.selection[index];
    if (entry.type !== "point") {
      continue;
    }

    const point = findPoint(entry.id);
    if (point && !point.isVirtual) {
      return point;
    }
  }

  return null;
}

function selectedLink() {
  const primary = primarySelection();
  return primary?.type === "link" ? findLink(primary.id) : null;
}

function setSelection(entries, options = {}) {
  state.selection = entries;
  normalizeSelection();

  if (options.clearPending !== false) {
    state.pendingGeo = null;
  }

  state.pendingLinkPointId = null;
  state.editingPointId = null;

  if (options.render !== false) {
    render();
  }
}

function toggleSelection(type, id) {
  const key = selectionKey(type, id);
  const exists = state.selection.some((entry) => selectionKey(entry.type, entry.id) === key);
  const next = exists
    ? state.selection.filter((entry) => selectionKey(entry.type, entry.id) !== key)
    : [...state.selection, { type, id }];

  state.mode = "inspect";
  setSelection(next);
}

function clearSelection(options = {}) {
  state.mode = "inspect";
  state.selection = [];
  state.selectedPointId = null;
  state.selectedLinkId = null;
  state.pendingLinkPointId = null;
  state.editingPointId = null;
  state.routeSelectionIds = [];

  if (options.clearPending !== false) {
    state.pendingGeo = null;
  }

  if (options.render !== false) {
    render();
  }
}

function removeSelectionEntry(type, id) {
  state.selection = state.selection.filter((entry) => !(entry.type === type && entry.id === id));
  normalizeSelection();
}

function selectedPointPair() {
  const ids = selectedPointIds();
  return ids.length === 2 ? ids : null;
}

function selectedPointIdsMatchRoute(ids) {
  return ids.length > 0
    && ids.length === state.routeSelectionIds.length
    && ids.every((id, index) => state.routeSelectionIds[index] === id);
}

function routeStartInSelection() {
  return state.routeSelectionIds.includes(state.routeStartPointId) ? state.routeStartPointId : null;
}

function effectiveRouteStartPointId() {
  return routeStartInSelection() ?? state.routeSelectionIds[0] ?? null;
}

function routePlanFromCurrentSelection() {
  const selectedPoints = selectedPointIds().map(findPoint).filter(Boolean);
  const start = routeStartPoint();
  if (!start || selectedPoints.length < 2) {
    return null;
  }

  const points = [];
  const seen = new Set();
  for (const point of [start, ...selectedPoints]) {
    if (!point || seen.has(point.id)) {
      continue;
    }
    seen.add(point.id);
    points.push(point);
  }

  return points.length >= 2 ? { start, points } : null;
}

function findLinkBetween(a, b) {
  return state.links.find((link) => (link.a === a && link.b === b) || (link.a === b && link.b === a)) ?? null;
}

function setRouteFromSelectedPoints() {
  if (state.routeResult) {
    state.routeResult = null;
    render();
    return;
  }

  const plan = routePlanFromCurrentSelection();
  if (!plan) {
    return;
  }

  state.mode = "inspect";
  state.pendingLinkPointId = null;
  state.routeSelectionIds = [];
  state.routeResult = optimizeVisitOrder(plan.points, plan.start.id, state.routeReturnToStart);
  setSelection([], { render: false });
  render();
}

function setRouteStartFromSelection() {
  const point = singleSelectedPoint();
  if (!point) {
    return;
  }

  if (state.routeStartPointId === point.id) {
    if (!confirmObservationReset("起点を解除")) {
      return;
    }
    clearRouteStartState();
    setSelection([], { render: false });
    render();
    return;
  }

  const target = targetPoint();
  const switchesFromTarget = Boolean(target && !observationEndpointsDistinct(point, target));
  const changesRouteStart = Boolean(state.routeStartPointId && state.routeStartPointId !== point.id);
  if ((switchesFromTarget || changesRouteStart) && !confirmObservationReset(switchesFromTarget ? "対象から起点へ切り替え" : "起点を変更")) {
    return;
  }

  if (switchesFromTarget) {
    clearTarget({ render: false });
  }

  resetObservationTrail();
  state.routeStartPointId = point.id;
  updateRouteStartSnapshot(point);
  setSelection([], { render: false });
  render();
}
function findNearestPoint(screenPoint) {
  let nearest = null;
  let nearestDistance = Infinity;
  const candidates = [...state.points];
  const current = currentLocationPoint();

  if (current) {
    candidates.push(current);
  }

  for (const point of candidates) {
    const screen = worldToScreen(point);
    const distance = Math.hypot(screen.x - screenPoint.x, screen.y - screenPoint.y);
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  }

  return nearestDistance <= POINT_RADIUS + 12 ? nearest : null;
}

function findNearestLink(screenPoint) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const link of state.links) {
    const endpoints = linkEndpoints(link);
    if (!endpoints) {
      continue;
    }

    const start = worldToScreen(endpoints.a);
    const end = worldToScreen(endpoints.b);
    const distance = distanceToSegment(screenPoint, start, end);
    if (distance < nearestDistance) {
      nearest = link;
      nearestDistance = distance;
    }
  }

  return nearestDistance <= 12 ? nearest : null;
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const projection = {
    x: start.x + t * dx,
    y: start.y + t * dy
  };

  return Math.hypot(point.x - projection.x, point.y - projection.y);
}
function distanceBetween(a, b) {
  const geoA = pointGeo(a);
  const geoB = pointGeo(b);
  const lat1 = toRadians(geoA.lat);
  const lat2 = toRadians(geoB.lat);
  const dLat = toRadians(geoB.lat - geoA.lat);
  const dLng = toRadians(shortestLongitudeDelta(geoA.lng, geoB.lng));
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function formatDistance(distance) {
  if (!Number.isFinite(distance) || distance < 0) {
    return "-";
  }

  if (state.distanceUnit === IMPERIAL_UNIT) {
    const feet = distance * 3.280839895;
    if (distance < 1609.344) {
      return `${Math.round(feet).toLocaleString(localeName())} ft`;
    }

    const miles = distance / 1609.344;
    if (distance < 1609344) {
      return `${miles.toFixed(2)} mi`;
    }

    return `${Math.round(miles).toLocaleString(localeName())} mi`;
  }

  if (distance < 1000) {
    return `${distance.toFixed(1)} m`;
  }

  if (distance < 1000000) {
    return `${(distance / 1000).toFixed(2)} km`;
  }

  return `${Math.round(distance / 1000).toLocaleString(localeName())} km`;
}

function localeName() {
  return activeLanguage() === EN_LANGUAGE ? "en-US" : "ja-JP";
}

function formatCoordinate(value) {
  return Number(value).toFixed(6);
}

function formatDate(value) {
  return new Intl.DateTimeFormat(localeName(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function connectSelectedPoints() {
  const pair = selectedPointPair();
  if (!pair) {
    return;
  }

  const [a, b] = pair;
  if (a === b) {
    return;
  }

  const existing = findLinkBetween(a, b);
  if (!existing) {
    state.links.push({
      id: createId(),
      a,
      b,
      createdAt: new Date().toISOString()
    });
    persistWorkspace();
  }

  state.mode = "inspect";
  state.pendingLinkPointId = null;
  setSelection([], { render: false });
  render();
}

function submitPendingPoint() {
  if (!validGeo(state.pendingGeo)) {
    if (state.selection.length === 0 && mobilePageUiActive()) {
      state.mode = "add";
      state.editingPointId = null;
      state.pendingLinkPointId = null;
      elements.shareImportStatus.value = "地点情報を入力できます";
      setMobilePage("register");
    }
    return;
  }

  if (typeof elements.pointForm.requestSubmit === "function") {
    elements.pointForm.requestSubmit();
    return;
  }

  elements.pointForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
}

function createCenterPendingPoint() {
  const points = selectedPointIds().map(findPoint).filter(Boolean);
  if (points.length < 2) {
    return;
  }

  const geo = geographicCenter(points);
  if (!geo) {
    return;
  }
  state.mode = "add";
  state.pendingGeo = geo;
  state.editingPointId = null;
  state.pendingLinkPointId = null;
  elements.pointTitle.value = "中心";
  elements.pointNote.value = `${points.length}点の中心`;
  elements.pointPhoto.value = "";
  fillFormFromGeo(geo);
  setSelection([], { clearPending: false, render: false });
  render();
}

function startEditingSelectedPoint() {
  const point = editableSelectedPoint();
  if (!point) {
    return;
  }

  const geo = pointGeo(point);
  state.editingPointId = point.id;
  state.pendingGeo = null;
  state.pendingLinkPointId = null;
  state.mode = "inspect";
  elements.pointTitle.value = point.title;
  elements.pointNote.value = point.note || "";
  elements.pointPhoto.value = "";
  fillFormFromGeo(geo);
  elements.shareImportStatus.value = "編集: 内容を更新できます";
  if (mobilePageUiActive()) {
    setMobilePage("register");
  }
  render();
}

function restoreLastDeleted() {
  const snapshot = state.lastDeleted;
  if (!snapshot || deletedSnapshotItemCount() === 0) {
    return;
  }

  const snapshotPoints = Array.isArray(snapshot.points) ? snapshot.points : [];
  const snapshotLinks = Array.isArray(snapshot.links) ? snapshot.links : [];
  const snapshotObservations = Array.isArray(snapshot.observations) ? snapshot.observations : [];
  const parts = [];
  if (snapshotPoints.length > 0) {
    parts.push(`${snapshotPoints.length}点`);
  }
  if (snapshotLinks.length > 0) {
    parts.push(`${snapshotLinks.length}線`);
  }
  if (snapshotObservations.length > 0) {
    parts.push(`${snapshotObservations.length}観察`);
  }

  const confirmed = window.confirm(`直前に削除した${parts.join(" / ")}を復旧しますか。`);
  if (!confirmed) {
    return;
  }

  const restoredSelection = [];
  const localList = localPointList();
  if (snapshotPoints.length > 0) {
    localList.visible = true;
  }

  const existingPointIds = new Set(allPointListPoints().map((point) => point.id));
  for (const point of snapshotPoints) {
    if (existingPointIds.has(point.id)) {
      continue;
    }

    localList.points.push(clonePlain(point));
    existingPointIds.add(point.id);
    restoredSelection.push({ type: "point", id: point.id });
  }

  const existingLinkIds = new Set(state.links.map((link) => link.id));
  for (const link of snapshotLinks) {
    if (existingLinkIds.has(link.id) || !validLinkEndpointId(link.a) || !validLinkEndpointId(link.b)) {
      continue;
    }

    state.links.push(clonePlain(link));
    existingLinkIds.add(link.id);
    restoredSelection.push({ type: "link", id: link.id });
  }

  const existingObservationIds = new Set(state.loadedObservations.map((observation) => observation.id));
  for (const observation of snapshotObservations) {
    const restoredObservation = withObservationId(observation, existingObservationIds);
    state.loadedObservations.push(restoredObservation);
    restoredSelection.push({ type: "observation", id: restoredObservation.id });
  }

  state.lastDeleted = null;
  refreshVisiblePoints();
  state.selection = restoredSelection;
  normalizeSelection();
  state.routeResult = null;
  if (snapshotPoints.length + snapshotLinks.length > 0) {
    persistWorkspace();
  }
  render();
}

function fillFormFromWorld(point) {
  state.mode = "add";
  state.pendingGeo = unprojectWorld(point.x, point.y);
  state.editingPointId = null;
  state.pendingLinkPointId = null;
  fillFormFromGeo(state.pendingGeo);
}

function fillFormFromGeo(geo) {
  const normalized = normalizeGeo(geo);
  elements.pointLat.value = normalized.lat.toFixed(6);
  elements.pointLng.value = normalized.lng.toFixed(6);
}

function selectPoint(pointId) {
  setSelection([{ type: "point", id: pointId }]);
}

function selectLink(linkId) {
  setSelection([{ type: "link", id: linkId }]);
}

function findNearestLoadedObservation(screenPoint) {
  let nearestId = null;
  let nearestDistance = Infinity;

  const measurePath = (layer, points) => {
    for (let index = 1; index < points.length; index += 1) {
      const start = worldToScreen(points[index - 1]);
      const end = worldToScreen(points[index]);
      const distance = distanceToSegment(screenPoint, start, end);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = layer.id;
      }
    }
  };

  for (const layer of loadedObservationLayers()) {
    if (layer.target) {
      measurePath(layer, [layer.start, layer.target]);
    }
    measurePath(layer, layer.points);
  }

  return nearestDistance <= 14 ? nearestId : null;
}

function handleCanvasClick(screenPoint) {
  const nearest = findNearestPoint(screenPoint);
  const nearestLink = nearest ? null : findNearestLink(screenPoint);
  const nearestObservation = nearest || nearestLink ? null : findNearestLoadedObservation(screenPoint);

  if (nearest) {
    toggleSelection("point", nearest.id);
    return;
  }

  if (nearestLink) {
    toggleSelection("link", nearestLink.id);
    return;
  }

  if (nearestObservation) {
    toggleSelection("observation", nearestObservation);
    return;
  }

  pauseLocationFollowForManualView();
  state.mode = "inspect";
  fillFormFromWorld(screenToWorld(screenPoint));
  render();
}
function setRouteStart(pointId) {
  if (!state.routeSelectionIds.includes(pointId)) {
    return;
  }

  if (state.routeStartPointId !== pointId) {
    if (!confirmObservationReset("起点を変更")) {
      render();
      return;
    }
    resetObservationTrail();
  }
  state.routeStartPointId = pointId;
  updateRouteStartSnapshot(findPoint(pointId));
  render();
}

function clearRouteSelection() {
  state.routeSelectionIds = [];
  state.routeResult = null;
  render();
}

function computeRouteFromSelection() {
  const plan = routePlanFromCurrentSelection();
  if (!plan) {
    state.routeResult = null;
    render();
    return;
  }

  state.routeSelectionIds = [];
  state.routeResult = optimizeVisitOrder(plan.points, plan.start.id, state.routeReturnToStart);
  setSelection([], { render: false });
  render();
}

function normalizeRouteSelection() {
  const validIds = new Set(state.points.map((point) => point.id));
  if (currentLocationPoint()) {
    validIds.add(CURRENT_LOCATION_ID);
  }
  const uniqueIds = [];

  for (const id of state.routeSelectionIds) {
    if (validIds.has(id) && !uniqueIds.includes(id)) {
      uniqueIds.push(id);
    }
  }

  state.routeSelectionIds = uniqueIds;

  if (state.routeStartPointId && !validIds.has(state.routeStartPointId)) {
    clearRouteStartState();
  }

  if (state.routeResult && state.routeResult.pointIds.some((id) => !validIds.has(id))) {
    state.routeResult = null;
  }
}

function selectedRoutePoints() {
  return state.routeSelectionIds.map(findPoint).filter(Boolean);
}

function routeResultPoints() {
  return state.routeResult?.pointIds?.map(findPoint).filter(Boolean) ?? [];
}

function optimizeVisitOrder(points, startPointId, returnToStart) {
  const startIndex = Math.max(0, points.findIndex((point) => point.id === startPointId));
  const orderedPoints = [points[startIndex], ...points.filter((_, index) => index !== startIndex)];
  const distances = buildDistanceMatrix(orderedPoints);
  const result = orderedPoints.length <= 12
    ? optimizeExact(distances, returnToStart)
    : optimizeHeuristic(distances, returnToStart);
  const routePoints = result.path.map((index) => orderedPoints[index]);
  const segmentDistances = routePoints.slice(1).map((point, index) => distanceBetween(routePoints[index], point));
  if (returnToStart && routePoints.length > 1) {
    segmentDistances.push(distanceBetween(routePoints.at(-1), routePoints[0]));
  }

  return {
    pointIds: routePoints.map((point) => point.id),
    totalDistance: sumDistances(segmentDistances),
    segmentDistances,
    returnToStart: Boolean(returnToStart),
    exact: result.exact
  };
}

function buildDistanceMatrix(points) {
  return points.map((from) => points.map((to) => (from.id === to.id ? 0 : distanceBetween(from, to))));
}

function optimizeExact(distances, returnToStart) {
  const count = distances.length;
  const size = 1 << count;
  const dp = Array.from({ length: size }, () => Array(count).fill(Infinity));
  const parent = Array.from({ length: size }, () => Array(count).fill(-1));
  dp[1][0] = 0;

  for (let mask = 1; mask < size; mask += 1) {
    if ((mask & 1) === 0) {
      continue;
    }

    for (let last = 0; last < count; last += 1) {
      const current = dp[mask][last];
      if (!Number.isFinite(current)) {
        continue;
      }

      for (let next = 1; next < count; next += 1) {
        if ((mask & (1 << next)) !== 0) {
          continue;
        }

        const nextMask = mask | (1 << next);
        const candidate = current + distances[last][next];
        if (candidate < dp[nextMask][next]) {
          dp[nextMask][next] = candidate;
          parent[nextMask][next] = last;
        }
      }
    }
  }

  const fullMask = size - 1;
  let bestLast = 0;
  let bestDistance = Infinity;
  for (let last = 0; last < count; last += 1) {
    const candidate = dp[fullMask][last] + (returnToStart && count > 1 ? distances[last][0] : 0);
    if (candidate < bestDistance) {
      bestDistance = candidate;
      bestLast = last;
    }
  }

  const path = [];
  let mask = fullMask;
  let current = bestLast;
  while (current !== -1) {
    path.push(current);
    const previous = parent[mask][current];
    mask ^= 1 << current;
    current = previous;
  }

  return {
    path: path.reverse(),
    exact: true
  };
}

function optimizeHeuristic(distances, returnToStart) {
  const count = distances.length;
  const unvisited = new Set(Array.from({ length: count - 1 }, (_, index) => index + 1));
  const path = [0];

  while (unvisited.size > 0) {
    const last = path[path.length - 1];
    let best = null;
    let bestDistance = Infinity;

    for (const candidate of unvisited) {
      if (distances[last][candidate] < bestDistance) {
        best = candidate;
        bestDistance = distances[last][candidate];
      }
    }

    path.push(best);
    unvisited.delete(best);
  }

  improveRouteWithTwoOpt(path, distances, returnToStart);

  return {
    path,
    exact: false
  };
}

function improveRouteWithTwoOpt(path, distances, returnToStart) {
  let improved = true;

  while (improved) {
    improved = false;

    for (let start = 1; start < path.length - 1; start += 1) {
      for (let end = start + 1; end < path.length; end += 1) {
        const before = routeEdgeCost(path, distances, start, end, returnToStart);
        const reversed = [...path.slice(0, start), ...path.slice(start, end + 1).reverse(), ...path.slice(end + 1)];
        const after = routeEdgeCost(reversed, distances, start, end, returnToStart);

        if (after + 0.000001 < before) {
          path.splice(0, path.length, ...reversed);
          improved = true;
        }
      }
    }
  }
}

function routeEdgeCost(path, distances, start, end, returnToStart) {
  const beforeStart = distances[path[start - 1]][path[start]];
  const afterEnd = end + 1 < path.length
    ? distances[path[end]][path[end + 1]]
    : returnToStart
      ? distances[path[end]][path[0]]
      : 0;
  return beforeStart + afterEnd;
}

function sumDistances(distances) {
  return distances.reduce((sum, distance) => sum + distance, 0);
}
function zoomAt(screenPoint, factor) {
  state.locationFollowScaleMode = FOLLOW_SCALE_MANUAL;
  const before = screenToWorld(screenPoint);
  state.viewport.scale = clampScale(state.viewport.scale * factor);
  const after = screenToWorld(screenPoint);
  state.viewport.x += before.x - after.x;
  state.viewport.y += before.y - after.y;
  render();
}

function fitToPoints() {
  syncCanvasSize();
  pauseLocationFollowForManualView();

  let fitPoints = fitTargetPoints();

  if (fitPoints.length === 0) {
    setProjectionCenterGeo(DEFAULT_GEO);
    state.viewport.x = DEFAULT_CENTER.x;
    state.viewport.y = DEFAULT_CENTER.y;
    state.viewport.scale = 0.7;
    render();
    return;
  }

  const centerGeo = geographicCenter(fitPoints);
  if (centerGeo) {
    setProjectionCenterGeo(centerGeo);
    fitPoints = fitTargetPoints();
  }

  const size = canvasSize();
  const xs = fitPoints.map((point) => point.x);
  const ys = fitPoints.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padding = Math.min(110, Math.max(34, Math.min(size.width, size.height) * 0.16));
  const availableWidth = Math.max(64, size.width - padding * 2);
  const availableHeight = Math.max(64, size.height - padding * 2);
  const spanX = Math.max(60, maxX - minX);
  const spanY = Math.max(60, maxY - minY);
  const scaleX = availableWidth / spanX;
  const scaleY = availableHeight / spanY;

  state.viewport.x = (minX + maxX) / 2;
  state.viewport.y = (minY + maxY) / 2;
  state.viewport.scale = clampScale(Math.min(scaleX, scaleY));
  render();
}

function fitFollowViewport(current) {
  const size = canvasSize();
  const target = targetPoint();
  if (state.locationFollowScaleMode === FOLLOW_SCALE_TARGET && target) {
    fitTargetFromCurrent(current, target);
    return;
  }

  const targets = followFitTargetPoints(current);
  const remoteTargets = targets.filter((point) => Math.hypot(point.x - current.x, point.y - current.y) > 1);

  state.viewport.x = current.x;
  state.viewport.y = current.y;

  if (remoteTargets.length === 0) {
    render();
    return;
  }

  const padding = Math.min(110, Math.max(34, Math.min(size.width, size.height) * 0.16));
  const availableWidth = Math.max(64, size.width - padding * 2);
  const availableHeight = Math.max(64, size.height - padding * 2);
  const maxDx = Math.max(30, ...remoteTargets.map((point) => Math.abs(point.x - current.x)));
  const maxDy = Math.max(30, ...remoteTargets.map((point) => Math.abs(point.y - current.y)));
  const scaleX = availableWidth / (maxDx * 2);
  const scaleY = availableHeight / (maxDy * 2);

  state.viewport.scale = clampScale(Math.min(scaleX, scaleY));
  render();
}

function fitTargetFromCurrent(current, target) {
  const geo = pointGeo(current);
  const distance = distanceBetween(current, target);
  const accuracy = Number.isFinite(geo.accuracy) ? geo.accuracy : 0;
  const range = targetRangeForDistance(Math.max(distance, accuracy * 2));

  const size = canvasSize();
  const padding = Math.min(110, Math.max(34, Math.min(size.width, size.height) * 0.16));
  const availableWidth = Math.max(64, size.width - padding * 2);
  const availableHeight = Math.max(64, size.height - padding * 2);

  state.viewport.x = current.x;
  state.viewport.y = current.y;
  state.viewport.scale = clampScale(Math.min(availableWidth, availableHeight) / (range * 2));
  render();
}

function targetRangeForDistance(distance) {
  const desired = Math.max(TARGET_ARRIVAL_METERS, distance);
  return TARGET_DISTANCE_STEPS.find((step) => step >= desired) ?? desired;
}

function geographicCenter(points) {
  const geos = points.map(pointGeo).filter(validGeo);
  if (geos.length === 0) {
    return null;
  }

  let x = 0;
  let y = 0;
  let z = 0;
  for (const geo of geos) {
    const lat = toRadians(geo.lat);
    const lng = toRadians(geo.lng);
    x += Math.cos(lat) * Math.cos(lng);
    y += Math.cos(lat) * Math.sin(lng);
    z += Math.sin(lat);
  }

  const length = Math.hypot(x, y, z);
  if (length < 1e-9) {
    const first = geos[0];
    const lat = geos.reduce((sum, geo) => sum + geo.lat, 0) / geos.length;
    const lng = first.lng + geos.reduce((sum, geo) => sum + shortestLongitudeDelta(first.lng, geo.lng), 0) / geos.length;
    return normalizeGeo({ lat, lng });
  }

  return normalizeGeo({
    lat: toDegrees(Math.atan2(z, Math.hypot(x, y))),
    lng: toDegrees(Math.atan2(y, x))
  });
}

function followFitTargetPoints(current) {
  const points = [...state.points, current];

  if (validGeo(state.pendingGeo)) {
    const pending = normalizeGeo(state.pendingGeo);
    points.push({ ...projectLatLng(pending.lat, pending.lng), geo: pending });
  }

  return points;
}

function loadedObservationFitPoints() {
  return state.loadedObservations.flatMap((observation) => [
    observation.start,
    ...(observation.target ? [observation.target] : []),
    ...observation.trail
  ]);
}

function fitTargetPoints() {
  const routeStartSnapshot = state.routeStartSnapshot ? [state.routeStartSnapshot] : [];
  const loadedPoints = loadedObservationFitPoints();
  const routePoints = routeResultPoints();
  if (routePoints.length > 0) {
    return [...routePoints, ...routeStartSnapshot, ...loadedPoints];
  }

  const routeSelection = selectedRoutePoints();
  if (routeSelection.length > 0) {
    return [...routeSelection, ...routeStartSnapshot, ...loadedPoints];
  }

  const points = [...state.points, ...routeStartSnapshot, ...loadedPoints];
  if (state.followCurrentLocation || points.length === 0) {
    const current = currentLocationPoint();
    if (current) {
      points.push(current);
    }
  }

  if (validGeo(state.pendingGeo)) {
    const pending = normalizeGeo(state.pendingGeo);
    points.push({ ...projectLatLng(pending.lat, pending.lng), geo: pending });
  }

  return points;
}

function centerAndFollowCurrentLocation() {
  if (!state.gpsEnabled || !("geolocation" in navigator)) {
    elements.shareImportStatus.value = "現在地を取得できません";
    return;
  }

  syncCanvasSize();
  state.screenFollowCurrentLocation = true;
  state.locationFollowScaleMode = FOLLOW_SCALE_CENTER;

  const current = currentLocationPoint();
  if (current) {
    setProjectionCenterGeo(pointGeo(current));
    const centeredCurrent = currentLocationPoint();
    state.viewport.x = centeredCurrent.x;
    state.viewport.y = centeredCurrent.y;
  }

  if (state.locationWatchId !== null) {
    render();
    return;
  }

  try {
    state.locationWatchId = navigator.geolocation.watchPosition(
      (position) => updateCurrentLocationFromPosition(position, {
        center: state.followCurrentLocation || state.screenFollowCurrentLocation,
        fillForm: state.locationFollowFillForm
      }),
      (error) => {
        const message = locationErrorMessage(error, "現在地エラー");
        stopScreenFollow({ render: false });
        elements.shareImportStatus.value = message;
        render();
      },
      geolocationOptions()
    );
    render();
  } catch {
    state.screenFollowCurrentLocation = false;
    clearLocationWatchIfIdle();
    renderLocationFollowButton();
    elements.shareImportStatus.value = "現在地エラー";
  }
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function createPointerGestureState() {
  return {
    active: new Map(),
    drag: null,
    pinch: null
  };
}

function pointerEntries() {
  return [...state.pointer.active.entries()];
}

function pointerDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointerMidpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

function startDragGesture(pointerId, point, options = {}) {
  state.pointer.drag = {
    id: pointerId,
    start: point,
    last: point,
    viewportX: state.viewport.x,
    viewportY: state.viewport.y,
    moved: Boolean(options.moved)
  };
}

function startPinchGesture() {
  const entries = pointerEntries();
  if (entries.length < 2) {
    state.pointer.pinch = null;
    return;
  }

  const [, first] = entries[0];
  const [, second] = entries[1];
  const midpoint = pointerMidpoint(first, second);
  state.pointer.drag = null;
  state.pointer.pinch = {
    startDistance: Math.max(1, pointerDistance(first, second)),
    startMidpoint: midpoint,
    startWorld: screenToWorld(midpoint),
    startScale: state.viewport.scale,
    moved: false
  };
}

function updatePinchGesture() {
  const entries = pointerEntries();
  if (entries.length < 2) {
    return;
  }

  if (!state.pointer.pinch) {
    startPinchGesture();
  }

  const pinch = state.pointer.pinch;
  const [, first] = entries[0];
  const [, second] = entries[1];
  const distance = Math.max(1, pointerDistance(first, second));
  const midpoint = pointerMidpoint(first, second);
  const movedDistance = Math.abs(distance - pinch.startDistance);
  const movedCenter = pointerDistance(midpoint, pinch.startMidpoint);

  if (movedDistance > POINTER_MOVE_THRESHOLD || movedCenter > POINTER_MOVE_THRESHOLD) {
    pinch.moved = true;
  }

  if (!pinch.moved) {
    return;
  }

  const size = canvasSize();
  const nextScale = clampScale(pinch.startScale * (distance / pinch.startDistance));
  state.locationFollowScaleMode = FOLLOW_SCALE_MANUAL;
  state.viewport.scale = nextScale;
  state.viewport.x = pinch.startWorld.x - (midpoint.x - size.width / 2) / nextScale;
  state.viewport.y = pinch.startWorld.y + (midpoint.y - size.height / 2) / nextScale;

  draw();
  renderStatus();
}

function removePointer(event, options = {}) {
  if (!state.pointer.active.has(event.pointerId)) {
    return;
  }

  const point = getCanvasPoint(event);
  const drag = state.pointer.drag;
  const allowTap = options.allowTap !== false;
  const wasTap = allowTap
    && state.pointer.active.size === 1
    && drag
    && drag.id === event.pointerId
    && !drag.moved
    && !state.pointer.pinch;

  state.pointer.active.delete(event.pointerId);

  try {
    canvas.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture can already be released by the browser during cancellation.
  }

  if (state.pointer.pinch) {
    state.pointer.pinch = null;
    const remaining = pointerEntries()[0];
    if (remaining) {
      startDragGesture(remaining[0], remaining[1], { moved: true });
    } else {
      state.pointer.drag = null;
    }
    return;
  }

  state.pointer.drag = null;

  if (wasTap) {
    handleCanvasClick(point);
  }
}

async function submitPoint(event) {
  event.preventDefault();

  const lat = Number.parseFloat(elements.pointLat.value);
  const lng = Number.parseFloat(elements.pointLng.value);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    elements.shareImportStatus.value = "緯度経度を入力してください";
    return;
  }

  const geo = normalizeGeo({
    lat,
    lng,
    accuracy: isSameGeo(state.pendingGeo, { lat, lng }) ? state.pendingGeo.accuracy : undefined
  });
  const projected = projectLatLng(geo.lat, geo.lng);
  const file = elements.pointPhoto.files[0] ?? null;
  const photo = file ? await readPhoto(file) : null;
  const createdAt = new Date().toISOString();
  const fallbackTitle = `Point ${localPointList().points.length + 1}`;

  pauseLocationFollowForManualView();

  const editedPoint = state.editingPointId ? findPointIn(state.editingPointId, state.points) : null;
  if (editedPoint) {
    editedPoint.x = projected.x;
    editedPoint.y = projected.y;
    editedPoint.title = elements.pointTitle.value.trim() || editedPoint.title || fallbackTitle;
    editedPoint.note = elements.pointNote.value.trim();
    editedPoint.geo = geo;
    editedPoint.updatedAt = createdAt;
    if (photo) {
      editedPoint.photo = photo;
      editedPoint.photoName = file?.name ?? "";
    }

    state.selection = [{ type: "point", id: editedPoint.id }];
    normalizeSelection();
    state.pendingGeo = null;
    state.editingPointId = null;
    state.mode = "inspect";
    elements.pointForm.reset();
    elements.shareImportStatus.value = "更新しました";
    persistWorkspace();
    syncCanvasSize();
    render();
    return;
  }

  const point = {
    id: createId(),
    x: projected.x,
    y: projected.y,
    title: elements.pointTitle.value.trim() || fallbackTitle,
    note: elements.pointNote.value.trim(),
    photo,
    photoName: file?.name ?? "",
    geo,
    createdAt
  };

  const list = localPointList();
  list.visible = true;
  list.points.push(point);
  refreshVisiblePoints();
  state.selection = [{ type: "point", id: point.id }];
  normalizeSelection();
  state.pendingGeo = null;
  state.mode = "inspect";
  elements.pointForm.reset();
  persistWorkspace();
  syncCanvasSize();
  render();
}

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resizeImage(reader.result).then(resolve, reject));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function resizeImage(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener("load", () => {
      const longestSide = Math.max(image.width, image.height);
      const scale = Math.min(1, 1400 / longestSide);

      if (scale === 1) {
        resolve(dataUrl);
        return;
      }

      const photoCanvas = document.createElement("canvas");
      photoCanvas.width = Math.round(image.width * scale);
      photoCanvas.height = Math.round(image.height * scale);
      const photoContext = photoCanvas.getContext("2d");
      photoContext.drawImage(image, 0, 0, photoCanvas.width, photoCanvas.height);
      resolve(photoCanvas.toDataURL("image/jpeg", 0.82));
    });
    image.addEventListener("error", () => resolve(dataUrl));
    image.src = dataUrl;
  });
}

function useCurrentLocation() {
  requestCurrentLocation({ fillForm: true, center: false, showButtonState: true });
}

function locateOnStartup() {
  if (!state.gpsEnabled) {
    return;
  }

  requestCurrentLocation({ fillForm: false, center: true, showButtonState: false, startup: true });
}

function geolocationOptions(options = {}) {
  return {
    enableHighAccuracy: true,
    timeout: options.startup ? 6500 : 10000,
    maximumAge: 5000
  };
}

function updateCurrentLocationFromPosition(position, options = {}) {
  if (!state.gpsEnabled) {
    return;
  }

  const geo = normalizeGeo({
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy
  });

  state.currentGeo = geo;
  if (options.center && !state.followCurrentLocation && !state.screenFollowCurrentLocation) {
    setProjectionCenterGeo(geo);
  }

  const current = currentLocationPoint();
  if (state.followCurrentLocation) {
    ensureTrackingObservationStart(current);
  }
  recordObservationPoint(current);

  if (options.fillForm) {
    state.mode = "add";
    state.pendingGeo = geo;
    fillFormFromGeo(geo);
  }

  if (options.center) {
    if (state.screenFollowCurrentLocation) {
      state.viewport.x = current.x;
      state.viewport.y = current.y;
    } else if (state.followCurrentLocation) {
      if (state.locationFollowScaleMode === FOLLOW_SCALE_CENTER) {
        state.viewport.x = current.x;
        state.viewport.y = current.y;
      } else if (state.locationFollowScaleMode !== FOLLOW_SCALE_MANUAL) {
        fitFollowViewport(current);
        return;
      }
    } else {
      state.viewport.x = current.x;
      state.viewport.y = current.y;
      state.viewport.scale = Math.max(state.viewport.scale, 0.7);
    }
  }

  render();
}
function locationErrorMessage(error, fallback) {
  if (error?.code === 1) {
    return "位置情報を許可してください";
  }

  return fallback;
}

function requestCurrentLocation(options = {}) {
  if (!state.gpsEnabled || !("geolocation" in navigator)) {
    if (!options.startup) {
      elements.shareImportStatus.value = "現在地を取得できません";
    }
    return;
  }

  if (options.showButtonState) {
    elements.useLocationButton.disabled = true;
    elements.useLocationButton.textContent = "取得中";
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const shouldCenter = options.center && (!options.startup || (state.mode === "inspect" && state.selection.length === 0));
      updateCurrentLocationFromPosition(position, {
        fillForm: options.fillForm,
        center: shouldCenter
      });

      if (options.showButtonState) {
        elements.useLocationButton.disabled = false;
        elements.useLocationButton.textContent = "現在地";
      }
    },
    (error) => {
      if (!options.startup) {
        elements.shareImportStatus.value = locationErrorMessage(error, "現在地エラー");
      }
      if (options.showButtonState) {
        elements.useLocationButton.disabled = false;
        elements.useLocationButton.textContent = "現在地";
      }
    },
    geolocationOptions({ startup: options.startup })
  );
}

function toggleLocationFollow(options = {}) {
  if (state.followCurrentLocation) {
    if (observationModeActive()) {
      const action = chooseObservationStopAction();
      if (action === "continue") {
        return;
      }

      finishObservation({ includeTarget: action === "arrived" });
      stopLocationFollow({ render: false });
      clearObservationAssignments();
      elements.shareImportStatus.value = action === "arrived" ? "到着として観察を終了しました" : action === "finish" ? "観察を終了しました" : "観察を中断終了しました";
      render();
      return;
    }

    stopLocationFollow();
    return;
  }

  startLocationFollow(options);
}

function chooseObservationStopAction() {
  const shouldStop = window.confirm("観察を終了しますか？");
  if (!shouldStop) {
    return "continue";
  }

  if (!targetPoint()) {
    return "finish";
  }

  return window.confirm("対象に到着しましたか？\nOK: はい（対象へ接続）\nキャンセル: いいえ（現在地まで）")
    ? "arrived"
    : "abort";
}

function finishObservation(options = {}) {
  const snapshot = observationSnapshot({ includeTarget: Boolean(options.includeTarget) });
  if (!snapshot) {
    clearSelection({ render: false });
    return;
  }

  const observation = withObservationId(snapshot, new Set(state.loadedObservations.map((item) => item.id)));
  state.loadedObservations.push(observation);
  setSelection([{ type: "observation", id: observation.id }], { render: false });
}

function clearObservationAssignments() {
  state.routeStartPointId = null;
  state.routeStartSnapshot = null;
  state.targetPointId = null;
  resetObservationTrail();
}

function startLocationFollow(options = {}) {
  if (!state.gpsEnabled || !("geolocation" in navigator)) {
    elements.shareImportStatus.value = "現在地を取得できません";
    return;
  }

  const autoRouteStart = !state.routeStartPointId;
  state.followCurrentLocation = true;
  state.locationFollowFillForm = Boolean(options.fillForm);
  state.pendingGeo = null;
  state.editingPointId = null;
  state.pendingLinkPointId = null;
  ensureTrackingObservationStart();

  const start = observationStartPoint();
  const target = targetPoint();
  if (start && target && !observationEndpointsDistinct(start, target)) {
    state.followCurrentLocation = false;
    if (autoRouteStart) {
      clearRouteStartState();
    }
    elements.shareImportStatus.value = "起点と対象が同じです。別の地点を指定してください";
    render();
    return;
  }

  resetObservationTrail();
  if (state.locationFollowScaleMode === FOLLOW_SCALE_MANUAL) {
    state.locationFollowScaleMode = state.targetPointId ? FOLLOW_SCALE_TARGET : FOLLOW_SCALE_CENTER;
  }

  if (state.locationWatchId !== null) {
    render();
    return;
  }

  try {
    state.locationWatchId = navigator.geolocation.watchPosition(
      (position) => updateCurrentLocationFromPosition(position, {
        center: state.followCurrentLocation || state.screenFollowCurrentLocation,
        fillForm: state.locationFollowFillForm
      }),
      (error) => {
        const message = locationErrorMessage(error, "追跡エラー");
        state.screenFollowCurrentLocation = false;
        stopLocationFollow();
        if (autoRouteStart) {
          clearRouteStartState();
        }
        elements.shareImportStatus.value = message;
      },
      geolocationOptions()
    );
    render();
  } catch {
    state.followCurrentLocation = false;
    state.locationWatchId = null;
    state.locationFollowFillForm = false;
    state.locationFollowScaleMode = FOLLOW_SCALE_MANUAL;
    if (autoRouteStart) {
      clearRouteStartState();
    }
    renderLocationFollowButton();
    elements.shareImportStatus.value = "追跡エラー";
  }
}

function clearLocationWatchIfIdle() {
  if (state.followCurrentLocation || state.screenFollowCurrentLocation || state.locationWatchId === null) {
    return;
  }

  if ("geolocation" in navigator) {
    navigator.geolocation.clearWatch(state.locationWatchId);
  }
  state.locationWatchId = null;
}

function stopScreenFollow(options = {}) {
  state.screenFollowCurrentLocation = false;
  clearLocationWatchIfIdle();

  if (options.render !== false) {
    render();
    return;
  }

  renderLocationFollowButton();
}

function stopLocationFollow(options = {}) {
  state.followCurrentLocation = false;
  state.locationFollowFillForm = false;
  state.locationFollowScaleMode = FOLLOW_SCALE_MANUAL;
  clearLocationWatchIfIdle();

  if (options.render !== false) {
    render();
    return;
  }

  renderLocationFollowButton();
}

function pauseLocationFollowForManualView() {
  let changed = false;
  if (state.screenFollowCurrentLocation) {
    state.screenFollowCurrentLocation = false;
    changed = true;
  }
  if (state.followCurrentLocation) {
    state.locationFollowScaleMode = FOLLOW_SCALE_MANUAL;
    changed = true;
  }

  clearLocationWatchIfIdle();
  if (changed) {
    renderLocationFollowButton();
  }
}

function renderLocationFollowButton() {
  const isSupported = state.gpsEnabled && "geolocation" in navigator;
  elements.useLocationButton.disabled = !isSupported;
  elements.useLocationButton.classList.remove("is-active");
  elements.useLocationButton.setAttribute("aria-pressed", "false");
  elements.useLocationButton.textContent = "現在地";
  elements.useLocationButton.title = !state.gpsEnabled ? "設定でGPSを有効にしてください" : isSupported ? "現在地を登録フォームへ入力" : "現在地を取得できません";

  elements.actionFollowButton.disabled = !isSupported;
  elements.actionFollowButton.classList.toggle("is-active", state.followCurrentLocation);
  elements.actionFollowButton.setAttribute("aria-pressed", String(state.followCurrentLocation));
  elements.actionFollowButton.title = !state.gpsEnabled ? "設定でGPSを有効にしてください" : state.followCurrentLocation ? "追跡を停止" : "追跡を開始";
  elements.originButton.disabled = !isSupported;
  elements.originButton.classList.toggle("is-active", state.screenFollowCurrentLocation);
  elements.originButton.setAttribute("aria-pressed", String(state.screenFollowCurrentLocation));
  elements.originButton.title = !state.gpsEnabled ? "設定でGPSを有効にしてください" : state.screenFollowCurrentLocation ? "画面追従中" : "現在地を中央にして画面追従";
}

function currentLocationPoint() {
  if (!validGeo(state.currentGeo)) {
    return null;
  }

  const projected = projectLatLng(state.currentGeo.lat, state.currentGeo.lng);
  return {
    id: CURRENT_LOCATION_ID,
    x: projected.x,
    y: projected.y,
    title: "現在地",
    note: "端末から取得した現在地です。",
    photo: "",
    photoName: "",
    geo: state.currentGeo,
    createdAt: new Date().toISOString(),
    isVirtual: true
  };
}
function projectLatLng(lat, lng) {
  return projectGeo({ lat, lng });
}

function projectGeo(geo, projection = state.projection) {
  const normalized = normalizeGeo(geo);
  if (projection?.mode === "local") {
    return projectLocalAeqd(normalized, projectionCenterGeo(projection));
  }

  return projectWorldMercator(normalized);
}

function unprojectWorld(x, y, projection = state.projection) {
  if (projection?.mode === "local") {
    return unprojectLocalAeqd({ x, y }, projectionCenterGeo(projection));
  }

  return unprojectMercator(x, y);
}

function projectionCenterGeo(projection = state.projection) {
  return validGeo(projection?.centerGeo) ? normalizeGeo(projection.centerGeo) : normalizeGeo(DEFAULT_GEO);
}

function setProjectionCenterGeo(geo, options = {}) {
  if (!validGeo(geo)) {
    return false;
  }

  const next = normalizeGeo(geo);
  const current = projectionCenterGeo();
  if (isSameGeo(current, next)) {
    return false;
  }

  state.projection.centerGeo = next;
  state.projection.version += 1;
  if (options.sync !== false) {
    syncProjectedCoordinates();
  }
  return true;
}

function projectLocalAeqd(geo, centerGeo) {
  const lat = toRadians(geo.lat);
  const lngDelta = toRadians(shortestLongitudeDelta(centerGeo.lng, geo.lng));
  const lat0 = toRadians(centerGeo.lat);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLat0 = Math.sin(lat0);
  const cosLat0 = Math.cos(lat0);
  const cosC = Math.max(-1, Math.min(1, sinLat0 * sinLat + cosLat0 * cosLat * Math.cos(lngDelta)));
  const c = Math.acos(cosC);
  if (Math.PI - c < 1e-8) {
    return { x: 0, y: EARTH_RADIUS_METERS * Math.PI };
  }
  const k = Math.abs(c) < 1e-12 ? 1 : c / Math.sin(c);

  return {
    x: EARTH_RADIUS_METERS * k * cosLat * Math.sin(lngDelta),
    y: EARTH_RADIUS_METERS * k * (cosLat0 * sinLat - sinLat0 * cosLat * Math.cos(lngDelta))
  };
}

function unprojectLocalAeqd(point, centerGeo) {
  const rho = Math.hypot(point.x, point.y);
  const lat0 = toRadians(centerGeo.lat);
  const lng0 = toRadians(centerGeo.lng);
  if (rho < 1e-9) {
    return normalizeGeo(centerGeo);
  }

  const c = rho / EARTH_RADIUS_METERS;
  const sinC = Math.sin(c);
  const cosC = Math.cos(c);
  const sinLat0 = Math.sin(lat0);
  const cosLat0 = Math.cos(lat0);
  const lat = Math.asin(Math.max(-1, Math.min(1, cosC * sinLat0 + (point.y * sinC * cosLat0) / rho)));
  const lng = lng0 + Math.atan2(point.x * sinC, rho * cosLat0 * cosC - point.y * sinLat0 * sinC);

  return normalizeGeo({ lat: toDegrees(lat), lng: toDegrees(lng) });
}

function projectWorldMercator(geo) {
  const safeLat = clampMercatorLatitude(geo.lat);
  const normalizedLng = normalizeLongitude(geo.lng);
  const latRadians = toRadians(safeLat);
  return {
    x: MERCATOR_RADIUS * toRadians(normalizedLng),
    y: MERCATOR_RADIUS * Math.log(Math.tan(Math.PI / 4 + latRadians / 2))
  };
}

function unprojectMercator(x, y) {
  const lng = toDegrees(x / MERCATOR_RADIUS);
  const lat = toDegrees(2 * Math.atan(Math.exp(y / MERCATOR_RADIUS)) - Math.PI / 2);
  return normalizeGeo({ lat, lng });
}

function normalizeGeo(geo) {
  const normalized = {
    lat: clampLatitude(Number(geo.lat)),
    lng: normalizeLongitude(Number(geo.lng))
  };

  if (Number.isFinite(geo.accuracy)) {
    normalized.accuracy = Number(geo.accuracy);
  }

  return normalized;
}

function validGeo(geo) {
  return Boolean(geo) && Number.isFinite(Number(geo.lat)) && Number.isFinite(Number(geo.lng));
}

function pointGeo(point) {
  return validGeo(point.geo) ? normalizeGeo(point.geo) : unprojectMercator(point.x, point.y);
}

function clampLatitude(lat) {
  return Math.min(90, Math.max(-90, lat));
}

function clampMercatorLatitude(lat) {
  return Math.min(MAX_MERCATOR_LAT, Math.max(-MAX_MERCATOR_LAT, lat));
}

function normalizeLongitude(lng) {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

function shortestLongitudeDelta(fromLng, toLng) {
  return ((((toLng - fromLng) + 540) % 360) + 360) % 360 - 180;
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

function isSameGeo(a, b) {
  return validGeo(a) && validGeo(b) && Math.abs(a.lat - b.lat) < 0.000001 && Math.abs(a.lng - b.lng) < 0.000001;
}


async function readClipboardShare() {
  if (!navigator.clipboard?.readText) {
    elements.shareImportStatus.value = "このブラウザではクリップボードを読めません";
    return;
  }

  let text = "";
  try {
    text = await navigator.clipboard.readText();
  } catch {
    elements.shareImportStatus.value = "クリップボードの読み取りが許可されませんでした";
    return;
  }

  if (!text.trim()) {
    elements.shareImportStatus.value = "クリップボードが空です";
    return;
  }

  applySharedTextToForm(text, "クリップボードから読み取りました", "クリップボードから座標を読み取れません");
}

function applySharedTextToForm(text, successMessage, failureMessage) {
  const result = parseSharedLocationPayload({
    text,
    title: elements.pointTitle.value
  });

  if (!result) {
    elements.shareImportStatus.value = shortMapUrlLikely(text) ? "短縮URLは展開できません" : failureMessage;
    return false;
  }

  applySharedLocationToForm(result, successMessage);
  return true;
}

function handleIncomingShare() {
  const params = new URLSearchParams(window.location.search);
  const payload = {
    title: params.get("share_title") || params.get("title") || "",
    text: params.get("share_text") || params.get("text") || "",
    url: params.get("share_url") || params.get("url") || "",
    lat: params.get("lat") || params.get("latitude") || "",
    lng: params.get("lng") || params.get("lon") || params.get("longitude") || ""
  };
  const hasPayload = Object.values(payload).some((value) => typeof value === "string" && value.trim());

  if (!hasPayload) {
    return;
  }

  const result = parseSharedLocationPayload(payload);
  const sharedText = [payload.title, payload.text, payload.url].filter(Boolean).join("\n");

  if (!result) {
    elements.shareImportStatus.value = shortMapUrlLikely(sharedText)
      ? "短縮URLは展開できません"
      : "共有内容から座標を読み取れません";
    return;
  }

  applySharedLocationToForm(result, "共有地点を読み取りました");
}

function applySharedLocationToForm(result, message) {
  pauseLocationFollowForManualView();
  const geo = normalizeGeo({ lat: result.lat, lng: result.lng });
  const projected = projectLatLng(geo.lat, geo.lng);

  state.mode = "add";
  state.pendingGeo = geo;
  state.viewport.x = projected.x;
  state.viewport.y = projected.y;
  state.viewport.scale = Math.max(state.viewport.scale, 0.7);
  fillFormFromGeo(geo);

  if (result.title && !elements.pointTitle.value.trim()) {
    elements.pointTitle.value = result.title.slice(0, 80);
  }

  if (result.note && !elements.pointNote.value.trim()) {
    elements.pointNote.value = result.note;
  }

  elements.shareImportStatus.value = `${message}: ${formatCoordinate(geo.lat)}, ${formatCoordinate(geo.lng)}`;
}

function parseSharedLocationPayload(payload) {
  const direct = coordinatesFromPair(payload.lat, payload.lng);
  if (direct) {
    return withShareMetadata(direct, payload);
  }

  const candidates = [payload.url, payload.text, payload.title]
    .filter((value) => typeof value === "string" && value.trim())
    .flatMap((value) => expandTextCandidates(value));

  for (const candidate of candidates) {
    const parsed = coordinatesFromText(candidate);
    if (parsed) {
      return withShareMetadata(parsed, payload);
    }
  }

  return null;
}

function expandTextCandidates(value) {
  const decoded = safelyDecode(value);
  const candidates = [value, decoded];
  const urls = decoded.match(/https?:\/\/\S+/g) ?? [];

  for (const url of urls) {
    candidates.push(url, safelyDecode(url));
  }

  return [...new Set(candidates)];
}

function coordinatesFromText(value) {
  const cardinal = coordinatesFromCardinalText(value);
  if (cardinal) {
    return cardinal;
  }

  const fromUrl = coordinatesFromUrl(value);
  if (fromUrl) {
    return fromUrl;
  }

  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i,
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:[,/?]|$)/i,
    /(?:^|[^\d.-])loc:(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
    /(?:^|[^\d.-])(-?\d{1,2}\.\d{4,}),\s*(-?\d{1,3}\.\d{4,})(?:[^\d.]|$)/i
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    const coordinates = match ? coordinatesFromPair(match[1], match[2]) : null;
    if (coordinates) {
      return coordinates;
    }
  }

  return null;
}


function coordinatesFromCardinalText(value) {
  const latFirst = value.match(/([北南NS])\s*(\d+(?:\.\d+)?)\s*[°º]?\s*[,、，]\s*([東西EW])\s*(\d+(?:\.\d+)?)\s*[°º]?/i);
  if (latFirst) {
    return coordinatesFromPair(
      signedCoordinate(latFirst[2], latFirst[1]),
      signedCoordinate(latFirst[4], latFirst[3])
    );
  }

  const lngFirst = value.match(/([東西EW])\s*(\d+(?:\.\d+)?)\s*[°º]?\s*[,、，]\s*([北南NS])\s*(\d+(?:\.\d+)?)\s*[°º]?/i);
  if (lngFirst) {
    return coordinatesFromPair(
      signedCoordinate(lngFirst[4], lngFirst[3]),
      signedCoordinate(lngFirst[2], lngFirst[1])
    );
  }

  return null;
}

function signedCoordinate(value, direction) {
  const sign = /[南西SW]/i.test(direction) ? -1 : 1;
  return sign * Number.parseFloat(value);
}
function coordinatesFromUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const params = url.searchParams;
  const pairKeys = ["q", "query", "ll", "center", "destination", "origin"];
  const direct = coordinatesFromPair(
    params.get("lat") || params.get("latitude"),
    params.get("lng") || params.get("lon") || params.get("longitude")
  );

  if (direct) {
    return direct;
  }

  for (const key of pairKeys) {
    const valueForKey = params.get(key);
    if (!valueForKey) {
      continue;
    }

    const coordinates = coordinatesFromText(valueForKey);
    if (coordinates) {
      return coordinates;
    }
  }

  return coordinatesFromText(url.pathname + url.hash);
}

function coordinatesFromPair(latValue, lngValue) {
  const lat = Number.parseFloat(String(latValue ?? "").trim());
  const lng = Number.parseFloat(String(lngValue ?? "").trim());

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

  return { lat, lng };
}

function withShareMetadata(coordinates, payload) {
  const title = guessSharedTitle(payload);
  const note = [payload.url, payload.text]
    .filter((value) => typeof value === "string" && value.trim())
    .join("\n")
    .slice(0, 1200);

  return {
    ...coordinates,
    title,
    note
  };
}

function guessSharedTitle(payload) {
  const values = [payload.title, payload.text]
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim());

  for (const value of values) {
    const firstLine = value.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (firstLine && !/^https?:\/\//i.test(firstLine) && !/^Google Maps$/i.test(firstLine)) {
      return firstLine;
    }
  }

  return "";
}

function safelyDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function shortMapUrlLikely(value) {
  return /(?:maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(value);
}

function activateWaitingServiceWorker(registration) {
  if (registration.waiting && navigator.serviceWorker.controller) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const reloadOnControllerChange = Boolean(navigator.serviceWorker.controller);
  let reloadingForServiceWorker = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloadOnControllerChange || reloadingForServiceWorker) {
      return;
    }
    reloadingForServiceWorker = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").then((registration) => {
      activateWaitingServiceWorker(registration);
      registration.update().catch(() => {});
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed") {
            activateWaitingServiceWorker(registration);
          }
        });
      });
    }).catch(() => {});
  });
}
function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function dateTimeStamp() {
  return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function selectedFiles(fileList) {
  return Array.from(fileList ?? []).filter(Boolean);
}

function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        resolve(JSON.parse(String(reader.result ?? "")));
      } catch (error) {
        reject(error);
      }
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Read failed")));
    reader.readAsText(file);
  });
}

function pointListSnapshot(listId = DEFAULT_POINT_LIST_ID) {
  ensurePointLists();
  const list = state.pointLists.find((item) => item.id === listId) ?? localPointList();
  return {
    type: "grid-atlas-point-list",
    version: 2,
    exportedAt: new Date().toISOString(),
    list: {
      name: list.name || "地点リスト",
      description: list.description || "",
      author: list.author || ""
    },
    points: list.points.map((point) => ({
      id: point.id,
      title: point.title,
      note: point.note,
      photo: point.photo,
      photoName: point.photoName,
      geo: pointGeo(point),
      createdAt: point.createdAt,
      updatedAt: point.updatedAt
    }))
  };
}

function exportPointList(listId = DEFAULT_POINT_LIST_ID) {
  const list = state.pointLists.find((item) => item.id === listId) ?? localPointList();
  downloadJson(pointListSnapshot(list.id), `grid-atlas-list-${safeFilenamePart(list.name)}-${dateStamp()}.json`);
}

function pointListFromPayload(parsed, fileName, existingIds) {
  if (parsed?.type !== "grid-atlas-point-list" || parsed.version !== 2 || !Array.isArray(parsed.points)) {
    throw new Error("Invalid point list");
  }

  const listMeta = parsed.list && typeof parsed.list === "object" ? parsed.list : {};
  const fallbackName = safeFilenamePart(String(fileName || "").replace(/\.json$/i, "")).replace(/-/g, " ") || "読み込みリスト";
  return normalizePointList({
    name: typeof listMeta.name === "string" && listMeta.name.trim() ? listMeta.name.trim() : fallbackName,
    description: typeof listMeta.description === "string" ? listMeta.description : "",
    author: typeof listMeta.author === "string" ? listMeta.author : "",
    visible: true,
    editable: false,
    source: "import",
    importedAt: new Date().toISOString(),
    points: parsed.points
  }, existingIds, fallbackName);
}

async function importPointListFiles(files) {
  const fileItems = selectedFiles(files);
  if (fileItems.length === 0) {
    return;
  }

  try {
    const existingIds = new Set(allPointListPoints().map((point) => point.id));
    const importedLists = [];
    for (const file of fileItems) {
      const parsed = await readJsonFile(file);
      importedLists.push(pointListFromPayload(parsed, file.name, existingIds));
    }

    state.pointLists.push(...importedLists);
    refreshVisiblePoints();
    state.selection = importedLists.flatMap((list) => list.points.map((point) => ({ type: "point", id: point.id })));
    normalizeSelection();
    persistWorkspace();
    elements.shareImportStatus.value = `${importedLists.length}リストを読み込みました`;
    fitToPoints();
  } catch {
    elements.shareImportStatus.value = "地点リスト読み込みエラー";
  }
}
function observationExportRecords() {
  const records = state.loadedObservations.map((observation) => ({
    ...clonePlain(observation),
    exportedAt: new Date().toISOString()
  }));
  const snapshot = observationSnapshot();
  if (snapshot) {
    records.push(snapshot);
  }

  return records;
}

function observationExportPayload() {
  const records = observationExportRecords();
  if (records.length === 0) {
    return null;
  }

  if (records.length === 1) {
    return {
      ...clonePlain(records[0]),
      exportedAt: new Date().toISOString()
    };
  }

  return {
    type: "grid-atlas-observations",
    version: 1,
    exportedAt: new Date().toISOString(),
    records: records.map((record) => ({
      ...clonePlain(record),
      exportedAt: record.exportedAt ?? new Date().toISOString()
    }))
  };
}

function exportObservationRecord() {
  const payload = observationExportPayload();
  if (!payload) {
    elements.shareImportStatus.value = "観察記録なし";
    return;
  }

  downloadJson(payload, `grid-atlas-observation-${dateTimeStamp()}.json`);
}

function normalizeObservationPoint(point, fallbackTitle) {
  if (!point || typeof point !== "object") {
    return null;
  }

  const geo = pointGeoFromAny(point, null);
  if (!geo) {
    return null;
  }

  const projected = projectLatLng(geo.lat, geo.lng);
  return {
    id: typeof point.id === "string" && point.id ? point.id : createId(),
    title: typeof point.title === "string" && point.title.trim() ? point.title.trim() : fallbackTitle,
    x: projected.x,
    y: projected.y,
    geo,
    recordedAt: typeof point.recordedAt === "string" ? point.recordedAt : new Date().toISOString()
  };
}

function normalizeObservationRecord(parsed) {
  if (parsed?.type !== "grid-atlas-observation" || !Array.isArray(parsed.trail)) {
    throw new Error("Invalid observation");
  }

  const start = normalizeObservationPoint(parsed.start, "起点");
  const target = parsed.target ? normalizeObservationPoint(parsed.target, "対象") : null;
  const trail = parsed.trail.map((point) => normalizeObservationPoint(point, "現在地")).filter(Boolean);
  if (!start || trail.length === 0 || (parsed.target && !target)) {
    throw new Error("Invalid observation points");
  }

  const path = [start, ...trail];
  const traveled = path.slice(1).reduce((total, point, index) => total + distanceBetween(path[index], point), 0);
  const current = trail.at(-1);
  const directToCurrent = distanceBetween(start, current);
  const endedAt = typeof parsed.endedAt === "string" ? parsed.endedAt : trail.at(-1).recordedAt;
  return {
    id: typeof parsed.id === "string" && parsed.id ? parsed.id : createObservationId(),
    type: "grid-atlas-observation",
    version: 1,
    title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : observationRecordName(start, target, endedAt),
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : new Date().toISOString(),
    startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : trail[0].recordedAt,
    endedAt,
    start,
    target,
    trail,
    metrics: {
      remaining: target ? distanceBetween(current, target) : NaN,
      traveled,
      ratio: directToCurrent > 1 ? traveled / directToCurrent : NaN
    }
  };
}

function normalizeObservationRecordsPayload(parsed) {
  if (parsed?.type === "grid-atlas-observations") {
    const records = Array.isArray(parsed.records)
      ? parsed.records
      : Array.isArray(parsed.observations)
        ? parsed.observations
        : [];
    return records.map(normalizeObservationRecord);
  }

  return [normalizeObservationRecord(parsed)];
}

async function importObservationFiles(files, mode) {
  const fileItems = selectedFiles(files);
  if (fileItems.length === 0) {
    return;
  }

  try {
    const parsedFiles = await Promise.all(fileItems.map(readJsonFile));
    const observations = parsedFiles.flatMap(normalizeObservationRecordsPayload);
    if (observations.length === 0) {
      throw new Error("No observations");
    }

    const action = mode === "replace" ? "観察記録を新規読み込み" : "観察記録を追加読み込み";
    if (observationResetNeedsConfirmation() && !confirmObservationReset(action)) {
      return;
    }

    if (state.followCurrentLocation) {
      stopLocationFollow({ render: false });
    }
    resetObservationTrail();

    if (mode === "replace") {
      state.loadedObservations = [];
    }

    const existingIds = new Set(state.loadedObservations.map((observation) => observation.id));
    const importedObservations = observations.map((observation) => withObservationId(observation, existingIds));
    state.loadedObservations.push(...importedObservations);
    setSelection(importedObservations.map((observation) => ({ type: "observation", id: observation.id })), { render: false });
    elements.shareImportStatus.value = mode === "replace" ? "観察記録を新規読み込みしました" : "観察記録を追加しました";
    fitToPoints();
  } catch {
    elements.shareImportStatus.value = "読み込みエラー";
  }
}
function clearWorkspace() {
  const confirmed = window.confirm("グリッドを初期化しますか。登録地点、線、読み込み観察を消去します。\n保存済みファイルには影響しません。");
  if (!confirmed) {
    return;
  }

  state.pointLists = [createLocalPointList()];
  refreshVisiblePoints();
  state.links = [];
  state.selection = [];
  state.selectedPointId = null;
  state.selectedLinkId = null;
  state.pendingLinkPointId = null;
  state.editingPointId = null;
  state.lastDeleted = null;
  state.routeSelectionIds = [];
  state.routeStartPointId = null;
  state.routeStartSnapshot = null;
  state.routeReturnToStart = false;
  state.routeResult = null;
  state.loadedObservations = [];
  clearTarget({ render: false });
  localStorage.removeItem(STORAGE_KEY);
  render();
}

function deleteSelectedPoint() {
  normalizeSelection();
  const pointIds = selectedPointIds().filter((id) => id !== CURRENT_LOCATION_ID && pointEditable(id));
  const explicitLinkIds = selectedLinkIds();
  const selectedObservations = selectedLoadedObservations();
  const selectedObservationIdSet = new Set(selectedObservations.map((observation) => observation.id));
  const pointIdSet = new Set(pointIds);
  const linkIdSet = new Set(explicitLinkIds);

  for (const link of state.links) {
    if (pointIdSet.has(link.a) || pointIdSet.has(link.b)) {
      linkIdSet.add(link.id);
    }
  }

  if (pointIdSet.size + linkIdSet.size + selectedObservationIdSet.size === 0) {
    return;
  }

  const parts = [];
  if (pointIdSet.size > 0) {
    parts.push(`${pointIdSet.size}点`);
  }
  if (linkIdSet.size > 0) {
    parts.push(`${linkIdSet.size}線`);
  }
  if (selectedObservationIdSet.size > 0) {
    parts.push(`${selectedObservationIdSet.size}観察（保存ファイルには影響しません）`);
  }

  const confirmed = window.confirm(`選択中の${parts.join(" / ")}を削除しますか。`);
  if (!confirmed) {
    return;
  }

  state.lastDeleted = {
    points: state.points.filter((item) => pointIdSet.has(item.id)).map(clonePlain),
    links: state.links.filter((item) => linkIdSet.has(item.id)).map(clonePlain),
    observations: selectedObservations.map(clonePlain)
  };
  if (selectedObservationIdSet.size > 0) {
    state.loadedObservations = state.loadedObservations.filter((observation) => !selectedObservationIdSet.has(observation.id));
  }
  for (const list of state.pointLists) {
    if (list.editable) {
      list.points = list.points.filter((item) => !pointIdSet.has(item.id));
    }
  }
  refreshVisiblePoints();
  state.links = state.links.filter((item) => !linkIdSet.has(item.id));
  state.selection = [];
  state.selectedPointId = null;
  state.selectedLinkId = null;
  state.pendingLinkPointId = null;
  if (pointIdSet.has(state.editingPointId)) {
    state.editingPointId = null;
  }
  state.routeSelectionIds = state.routeSelectionIds.filter((id) => !pointIdSet.has(id));
  if (pointIdSet.has(state.routeStartPointId)) {
    clearRouteStartState();
  }
  if (state.routeResult?.pointIds?.some((id) => pointIdSet.has(id))) {
    state.routeResult = null;
  }

  if (pointIdSet.has(state.targetPointId)) {
    clearTarget({ render: false });
  }

  if (pointIdSet.size + linkIdSet.size > 0) {
    persistWorkspace();
  }
  render();
}

function bindEvents() {
  window.addEventListener("resize", scheduleCanvasResize);
  window.visualViewport?.addEventListener("resize", scheduleCanvasResize);
  window.visualViewport?.addEventListener("scroll", scheduleCanvasResize);

  if ("ResizeObserver" in window) {
    canvasResizeObserver = new ResizeObserver(scheduleCanvasResize);
    canvasResizeObserver.observe(canvas);

    if (canvas.parentElement) {
      canvasResizeObserver.observe(canvas.parentElement);
    }
  }

  elements.settingsMenuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleSettingsMenu();
  });
  elements.settingsMenu.addEventListener("click", (event) => event.stopPropagation());
  elements.settingsThemeSelect.addEventListener("change", () => {
    setTheme(elements.settingsThemeSelect.value);
    render();
  });
  elements.settingsLanguageSelect.addEventListener("change", () => {
    setLanguage(elements.settingsLanguageSelect.value);
    render();
  });
  elements.settingsUnitSelect.addEventListener("change", () => {
    setDistanceUnit(elements.settingsUnitSelect.value);
    render();
  });
  elements.settingsRouteReturnToStart.addEventListener("change", () => {
    setRouteReturnToStart(elements.settingsRouteReturnToStart.checked);
    render();
  });
  elements.settingsGpsEnabled.addEventListener("change", () => {
    setGpsEnabled(elements.settingsGpsEnabled.checked);
  });
  document.addEventListener("click", () => setSettingsMenuOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setSettingsMenuOpen(false);
    }
  });
  elements.actionLinkButton.addEventListener("click", connectSelectedPoints);
  elements.actionRegisterButton.addEventListener("click", submitPendingPoint);
  elements.actionRouteButton.addEventListener("click", setRouteFromSelectedPoints);
  elements.clearSelectionButton.addEventListener("click", () => clearSelection());
  elements.actionTargetButton.addEventListener("click", toggleTargetForSelection);
  elements.actionRouteStartButton.addEventListener("click", setRouteStartFromSelection);
  elements.actionFollowButton.addEventListener("click", () => toggleLocationFollow({ fillForm: false }));
  elements.actionCenterButton.addEventListener("click", createCenterPendingPoint);
  elements.actionRestoreButton.addEventListener("click", restoreLastDeleted);
  elements.actionEditButton.addEventListener("click", startEditingSelectedPoint);
  elements.actionMapButton.addEventListener("click", openSelectedPointInPreferredMap);

  elements.pointForm.addEventListener("submit", submitPoint);
  elements.readClipboardButton.addEventListener("click", readClipboardShare);
  elements.useLocationButton.addEventListener("click", useCurrentLocation);
  elements.zoomInButton.addEventListener("click", () => zoomAt({ x: canvasSize().width / 2, y: canvasSize().height / 2 }, 1.25));
  elements.zoomOutButton.addEventListener("click", () => zoomAt({ x: canvasSize().width / 2, y: canvasSize().height / 2 }, 0.8));
  elements.fitButton.addEventListener("click", fitToPoints);
  elements.originButton.addEventListener("click", centerAndFollowCurrentLocation);
  elements.routeStartSelect.addEventListener("change", () => setRouteStart(elements.routeStartSelect.value));
  elements.routeReturnToStart.addEventListener("change", () => {
    setRouteReturnToStart(elements.routeReturnToStart.checked);
    render();
  });
  elements.computeRouteButton.addEventListener("click", computeRouteFromSelection);
  elements.clearRouteSelectionButton.addEventListener("click", clearRouteSelection);
  elements.openAppleMapsButton.addEventListener("click", () => openSelectedPointInExternalMap("apple"));
  elements.openGoogleMapsButton.addEventListener("click", () => openSelectedPointInExternalMap("google"));
  elements.targetPointButton.addEventListener("click", toggleTargetForSelection);
  elements.deletePointButton.addEventListener("click", deleteSelectedPoint);
  elements.exportPointsButton.addEventListener("click", exportPointList);
  elements.replacePointsButton.addEventListener("click", () => {
    elements.pointImportFile.click();
  });
  elements.appendPointsButton.addEventListener("click", () => {
    elements.pointImportFile.click();
  });
  elements.pointImportFile.addEventListener("change", () => {
    const files = selectedFiles(elements.pointImportFile.files);
    if (files.length > 0) {
      void importPointListFiles(files);
    }
    elements.pointImportFile.value = "";
  });
  elements.exportObservationButton.addEventListener("click", exportObservationRecord);
  elements.replaceObservationButton.addEventListener("click", () => {
    pendingObservationImportMode = "replace";
    elements.observationImportFile.click();
  });
  elements.appendObservationButton.addEventListener("click", () => {
    pendingObservationImportMode = "append";
    elements.observationImportFile.click();
  });
  elements.observationImportFile.addEventListener("change", () => {
    const files = selectedFiles(elements.observationImportFile.files);
    if (files.length > 0) {
      void importObservationFiles(files, pendingObservationImportMode);
    }
    elements.observationImportFile.value = "";
  });
  elements.clearButton.addEventListener("click", clearWorkspace);
  elements.mobileBackButton.addEventListener("click", () => setMobilePage("map"));
  for (const tab of elements.mobilePageTabs) {
    tab.addEventListener("click", () => {
      setMobilePage(tab.dataset.mobilePage);
      setSettingsMenuOpen(false);
    });
  }
  for (const tab of elements.mobileGridTabs) {
    tab.addEventListener("click", () => setMobileGridPage(tab.dataset.mobileGridPage));
  }

  canvas.addEventListener("pointerdown", (event) => {
    const point = getCanvasPoint(event);
    state.pointer.active.set(event.pointerId, point);

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers skip pointer capture for canceled touch gestures.
    }

    if (state.pointer.active.size === 1) {
      startDragGesture(event.pointerId, point);
      return;
    }

    if (state.pointer.active.size === 2) {
      startPinchGesture();
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.pointer.active.has(event.pointerId)) {
      return;
    }

    const point = getCanvasPoint(event);
    state.pointer.active.set(event.pointerId, point);

    if (state.pointer.active.size >= 2) {
      updatePinchGesture();
      return;
    }

    const drag = state.pointer.drag;
    if (!drag || drag.id !== event.pointerId) {
      return;
    }

    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;

    if (Math.hypot(dx, dy) > POINTER_MOVE_THRESHOLD) {
      if (!drag.moved) {
        pauseLocationFollowForManualView();
      }
      drag.moved = true;
    }

    if (drag.moved) {
      state.viewport.x = drag.viewportX - dx / state.viewport.scale;
      state.viewport.y = drag.viewportY + dy / state.viewport.scale;
      draw();
      renderStatus();
    }

    drag.last = point;
  });

  canvas.addEventListener("pointerup", removePointer);
  canvas.addEventListener("pointercancel", (event) => removePointer(event, { allowTap: false }));

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const point = getCanvasPoint(event);
      const factor = event.deltaY < 0 ? 1.12 : 0.89;
      zoomAt(point, factor);
    },
    { passive: false }
  );
}

loadTheme();
loadWorkspace();
loadPreferences();
bindEvents();
initMobilePages();
resizeCanvas();
handleIncomingShare();
locateOnStartup();
registerServiceWorker();
render();
