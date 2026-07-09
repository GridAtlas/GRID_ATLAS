const STORAGE_KEY = "grid-atlas-workspace-v2";
const THEME_KEY = "grid-atlas-theme";
const LIGHT_THEME = "light";
const RETRO_THEME = "retro";
const POINT_RADIUS = 8;
const CURRENT_LOCATION_ID = "__current_location__";
const FOLLOW_SCALE_MANUAL = "manual";
const FOLLOW_SCALE_RANGE = "range";
const FOLLOW_SCALE_TARGET = "target";
const EARTH_RADIUS_METERS = 6371008.8;
const MERCATOR_RADIUS = 6378137;
const MAX_MERCATOR_LAT = 85.05112878;
const TARGET_DISTANCE_STEPS = [25, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
const TARGET_ARRIVAL_METERS = 25;
const DEFAULT_CENTER = projectLatLng(35.681236, 139.767125);

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
  themeToggleButton: document.querySelector("#themeToggleButton"),
  statusLine: document.querySelector("#statusLine"),
  mobileSelectedTitle: document.querySelector("#mobileSelectedTitle"),
  sidebarSelectedTitle: document.querySelector("#sidebarSelectedTitle"),
  pointForm: document.querySelector("#pointForm"),
  pointTitle: document.querySelector("#pointTitle"),
  pointLat: document.querySelector("#pointLat"),
  pointLng: document.querySelector("#pointLng"),
  pointPhoto: document.querySelector("#pointPhoto"),
  pointNote: document.querySelector("#pointNote"),
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
  exportButton: document.querySelector("#exportButton"),
  importButton: document.querySelector("#importButton"),
  importFile: document.querySelector("#importFile"),
  clearButton: document.querySelector("#clearButton")
};

const state = {
  version: 2,
  points: [],
  links: [],
  mode: "inspect",
  selection: [],
  selectedPointId: null,
  selectedLinkId: null,
  pendingLinkPointId: null,
  routeSelectionIds: [],
  routeStartPointId: null,
  routeReturnToStart: false,
  routeResult: null,
  targetPointId: null,
  pendingGeo: null,
  currentGeo: null,
  followCurrentLocation: false,
  locationWatchId: null,
  locationFollowFillForm: false,
  locationFollowScaleMode: FOLLOW_SCALE_MANUAL,
  viewport: {
    x: DEFAULT_CENTER.x,
    y: DEFAULT_CENTER.y,
    scale: 0.7
  },
  pointer: null
};

const CANVAS_PALETTES = {
  light: {
    gridMinor: "#edf0e8",
    gridMajor: "#d8ded1",
    link: "#116c6d",
    linkSelected: "#2e7d32",
    route: "#5a4aa0",
    target: "#c73a2a",
    targetSoft: "rgb(199 58 42 / 0.18)",
    currentAccuracy: "rgb(255 212 54 / 0.16)",
    currentFill: "#ffd436",
    currentStroke: "#6b5a00",
    currentSelectedStroke: "#2e7d32",
    currentInner: "#fff7bf",
    pendingFill: "rgb(233 95 26 / 0.24)",
    pendingStroke: "rgb(233 95 26 / 0.62)",
    pointFill: "#e95f1a",
    pointBaseStroke: "#ffffff",
    routeStart: "#5a4aa0",
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
    target: "#d6ffe0",
    targetSoft: "rgb(214 255 224 / 0.16)",
    currentAccuracy: "rgb(255 236 72 / 0.12)",
    currentFill: "#fff35a",
    currentStroke: "#d8c900",
    currentSelectedStroke: "#ffffff",
    currentInner: "#021006",
    pendingFill: "rgb(44 255 100 / 0.18)",
    pendingStroke: "rgb(119 255 153 / 0.72)",
    pointFill: "#23ff5e",
    pointBaseStroke: "#020806",
    routeStart: "#d6ffe0",
    routeSelected: "#8dffaa",
    pendingPointStroke: "#d6ffe0",
    selected: "#ffffff",
    badgeFill: "#020806",
    badgeText: "#d6ffe0",
    badgeStartFill: "#2cff64",
    badgeStartText: "#020806"
  }
};

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

  elements.themeToggleButton.textContent = isRetro ? "LIGHT" : "RETRO";
  elements.themeToggleButton.setAttribute("aria-pressed", String(isRetro));
  elements.themeToggleButton.title = isRetro ? "通常表示へ" : "レトロ表示へ";
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
  state.version = 2;
  state.points = Array.isArray(workspace.points)
    ? workspace.points.map((point) => normalizePoint(point, origin)).filter(Boolean)
    : [];
  state.links = Array.isArray(workspace.links)
    ? workspace.links.filter((link) => validLinkEndpointId(link.a) && validLinkEndpointId(link.b))
    : [];
  state.selection = [];
  state.selectedPointId = null;
  state.selectedLinkId = null;
  state.pendingLinkPointId = null;
  state.routeSelectionIds = [];
  state.routeStartPointId = null;
  state.routeReturnToStart = false;
  state.routeResult = null;
  state.targetPointId = null;
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
  return {
    version: 2,
    projection: "web-mercator",
    points: state.points,
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
  const latitude = gridReferenceLatitude();
  const candidates = [
    1, 2, 5, 10, 20, 50, 100, 200, 500,
    1000, 2000, 5000, 10000, 20000, 50000,
    100000, 200000, 500000, 1000000, 2000000,
    5000000, 10000000
  ];
  return candidates.find((step) => groundDistanceToMercator(step, latitude) * state.viewport.scale >= 48) ?? 20000000;
}

function gridReferenceLatitude() {
  const latitudes = state.points.map((point) => pointGeo(point).lat);

  if (validGeo(state.currentGeo)) {
    latitudes.push(normalizeGeo(state.currentGeo).lat);
  }

  if (latitudes.length === 0) {
    return viewportCenterLatitude();
  }

  return (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
}

function viewportCenterLatitude() {
  return unprojectMercator(state.viewport.x, state.viewport.y).lat;
}

function groundDistanceToMercator(distance, latitude) {
  const cosine = Math.max(0.02, Math.cos(toRadians(clampLatitude(latitude))));
  return distance / cosine;
}

function drawGrid(width, height) {
  const latitude = gridReferenceLatitude();
  const majorGroundStep = chooseGridStep();
  const majorStep = groundDistanceToMercator(majorGroundStep, latitude);
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
  const current = currentLocationPoint();
  const target = targetPoint();
  if (!current || !target) {
    return;
  }

  const start = worldToScreen(current);
  const end = worldToScreen(target);
  const colors = canvasPalette();

  context.save();
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.strokeStyle = colors.target;
  context.lineWidth = 2.8;
  context.setLineDash([7, 6]);
  context.stroke();

  context.beginPath();
  context.arc(end.x, end.y, POINT_RADIUS + 8, 0, Math.PI * 2);
  context.strokeStyle = colors.targetSoft;
  context.lineWidth = 6;
  context.setLineDash([]);
  context.stroke();
  context.restore();
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
  const accuracyRadius = Number.isFinite(state.currentGeo.accuracy)
    ? Math.min(160, Math.max(16, state.currentGeo.accuracy * state.viewport.scale))
    : 0;

  if (accuracyRadius > 0) {
    context.beginPath();
    context.arc(screen.x, screen.y, accuracyRadius, 0, Math.PI * 2);
    context.fillStyle = colors.currentAccuracy;
    context.fill();
  }

  context.beginPath();
  context.arc(screen.x, screen.y, 9, 0, Math.PI * 2);
  context.fillStyle = colors.currentFill;
  context.fill();
  const isSelected = isPointSelected(CURRENT_LOCATION_ID);
  context.lineWidth = isSelected ? 4 : 3;
  context.strokeStyle = isSelected ? colors.currentSelectedStroke : colors.currentStroke;
  context.stroke();

  context.beginPath();
  context.arc(screen.x, screen.y, 3, 0, Math.PI * 2);
  context.fillStyle = colors.currentInner;
  context.fill();
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
function drawPoints() {
  const colors = canvasPalette();
  for (const point of state.points) {
    const screen = worldToScreen(point);
    const isSelected = isPointSelected(point.id);
    const isPending = point.id === state.pendingLinkPointId;
    const isTarget = point.id === state.targetPointId;
    const shouldShowRouteSelection = state.routeSelectionIds.length > 0 || Boolean(state.routeResult);
    const isRouteSelected = shouldShowRouteSelection && state.routeSelectionIds.includes(point.id);
    const isRouteStart = shouldShowRouteSelection && state.routeStartPointId === point.id;
    context.beginPath();
    context.arc(screen.x, screen.y, POINT_RADIUS, 0, Math.PI * 2);
    context.fillStyle = colors.pointFill;
    context.fill();

    context.lineWidth = isSelected || isPending || isRouteSelected || isTarget ? 4 : 2;
    context.strokeStyle = isRouteStart
      ? colors.routeStart
      : isTarget
        ? colors.target
        : isRouteSelected
        ? colors.routeSelected
        : isPending
          ? colors.pendingPointStroke
          : isSelected
            ? colors.selected
            : colors.pointBaseStroke;
    context.stroke();
  }
}

function drawRouteBadges() {
  const colors = canvasPalette();
  const ids = state.routeResult?.pointIds?.length
    ? state.routeResult.pointIds
    : state.routeSelectionIds;
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
  drawTargetLine();
  drawCurrentLocation();
  drawLinks();
  drawRouteResult();
  drawPoints();
  drawPendingPoint();
  drawRouteBadges();
}

function render() {
  normalizeSelection();
  syncCanvasSize();
  draw();
  renderDetails();
  renderAnalysis();
  renderRoute();
  renderSelectedSummary();
  renderStatus();
  renderActionButtons();
}

function renderSelectedSummary() {
  const title = state.selection.length > 0
    ? state.selection.map(selectionTitle).join(", ")
    : "未選択";
  elements.mobileSelectedTitle.textContent = title;
  elements.sidebarSelectedTitle.textContent = title;
}

function renderStatus() {
  const modeLabel = {
    inspect: "選択",
    add: "登録",
    link: "接続",
    route: "巡回"
  }[state.mode];

  const extras = [];
  const counts = selectedCounts();

  if (counts.total > 0) {
    const parts = [];
    if (counts.point > 0) {
      parts.push(`${counts.point}点`);
    }
    if (counts.link > 0) {
      parts.push(`${counts.link}線`);
    }
    extras.push(`選択: ${parts.join(" / ")}`);
  }

  if (state.followCurrentLocation) {
    extras.push("追従");
  }

  const target = targetPoint();
  const targetDistance = targetDistanceMeters();
  if (target) {
    const distanceLabel = Number.isFinite(targetDistance) ? ` ${formatDistance(targetDistance)}` : "";
    const arrivalLabel = targetArrived() ? " 到着圏" : "";
    extras.push(`ターゲット: ${target.title}${distanceLabel}${arrivalLabel}`);
  }

  if (state.routeSelectionIds.length > 0) {
    extras.push(`巡回: ${state.routeSelectionIds.length}点`);
  }

  const extra = extras.length > 0 ? ` | ${extras.join(" | ")}` : "";
  elements.statusLine.value = `${modeLabel} | ${state.points.length}点 | ${state.links.length}線 | 格子 ${formatDistance(chooseGridStep())}${extra}`;
}

function renderActionButtons() {
  const hasPendingPoint = validGeo(state.pendingGeo);
  const pointIds = selectedPointIds();
  const linkIds = selectedLinkIds();
  const pointPair = selectedPointPair();
  const targetCandidate = lastTargetableSelectedPoint();
  const routeStartCandidate = lastSelectedPoint();
  const routeMatchesSelection = selectedPointIdsMatchRoute(pointIds);
  const connectedPair = pointPair ? findLinkBetween(pointPair[0], pointPair[1]) : null;
  const deletablePointCount = pointIds.filter((id) => id !== CURRENT_LOCATION_ID).length;
  const canDelete = deletablePointCount + linkIds.length > 0;

  elements.actionRegisterButton.disabled = !hasPendingPoint;
  elements.actionLinkButton.disabled = !pointPair;
  elements.actionRouteButton.disabled = pointIds.length === 0;
  elements.deletePointButton.disabled = !canDelete;
  elements.clearSelectionButton.disabled = state.selection.length === 0 && !hasPendingPoint;
  elements.actionTargetButton.disabled = !targetCandidate;
  elements.actionRouteStartButton.disabled = !routeStartCandidate;

  elements.actionRegisterButton.classList.remove("is-active");
  elements.actionLinkButton.classList.toggle("is-active", Boolean(connectedPair));
  elements.actionRouteButton.classList.toggle("is-active", routeMatchesSelection);
  elements.actionRouteButton.title = routeMatchesSelection ? "選択中の巡回対象を解除" : "選択点を巡回対象にする";
  elements.deletePointButton.classList.toggle("is-active", false);
  elements.clearSelectionButton.classList.toggle("is-active", state.selection.length > 0 || hasPendingPoint);
  elements.actionTargetButton.classList.toggle("is-active", Boolean(targetCandidate && targetCandidate.id === state.targetPointId));
  elements.actionRouteStartButton.classList.toggle("is-active", Boolean(routeStartCandidate && routeStartCandidate.id === state.routeStartPointId));
  elements.actionRouteLabel.textContent = routeMatchesSelection ? "解除" : "巡回";
  renderLocationFollowButton();
}

function renderDetails() {
  const entries = state.selection;
  const point = selectedPoint();
  const link = selectedLink();
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
      parts.push(`${counts.point}点`);
    }
    if (counts.link > 0) {
      parts.push(`${counts.link}線`);
    }

    elements.selectionHeading.textContent = "複数選択";
    elements.detailTitleLabel.textContent = "選択";
    elements.detailCoordsLabel.textContent = "件数";
    elements.detailCreatedLabel.textContent = "順序";
    elements.detailNoteLabel.textContent = "操作";
    elements.detailTitle.textContent = state.selection.map(selectionTitle).join(", ");
    elements.detailCoords.textContent = parts.join(" / ");
    elements.detailCreated.textContent = state.selection.map((entry, index) => `${index + 1}. ${selectionTitle(entry)}`).join(" / ");
    elements.detailNote.textContent = "接続、巡回、削除、解除をクイックボタンで実行できます。";
    elements.mapOpenActions.hidden = true;
    elements.targetActions.hidden = true;
    return;
  }

  elements.selectionHeading.textContent = link ? "選択線" : "選択地点";

  if (link) {
    const endpoints = linkEndpoints(link);
    if (!endpoints) {
      return;
    }

    elements.detailTitleLabel.textContent = "線";
    elements.detailCoordsLabel.textContent = "距離";
    elements.detailCreatedLabel.textContent = "登録";
    elements.detailNoteLabel.textContent = "端点";
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
  elements.detailTitleLabel.textContent = "見出し";
  elements.detailCoordsLabel.textContent = "緯度経度";
  elements.detailCreatedLabel.textContent = "登録";
  elements.detailNoteLabel.textContent = "コメント";
  elements.detailTitle.textContent = point.title;
  elements.detailCoords.textContent = `${formatCoordinate(geo.lat)}, ${formatCoordinate(geo.lng)}${accuracy}`;
  elements.detailCreated.textContent = point.isVirtual ? "現在地" : formatDate(point.createdAt);
  elements.detailNote.textContent = point.note || "なし";
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
  elements.targetPointButton.textContent = isTarget ? "ターゲット解除" : "ターゲットにする";
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

function toggleTargetForSelection() {
  const point = lastTargetableSelectedPoint();
  if (!point) {
    return;
  }

  if (state.targetPointId === point.id) {
    clearTarget();
    return;
  }

  state.targetPointId = point.id;
  state.locationFollowScaleMode = FOLLOW_SCALE_TARGET;

  if (!state.followCurrentLocation) {
    startLocationFollow({ fillForm: false });
    return;
  }

  const current = currentLocationPoint();
  if (current) {
    fitTargetFromCurrent(current, point);
    return;
  }

  render();
}

function clearTarget(options = {}) {
  state.targetPointId = null;
  if (state.locationFollowScaleMode === FOLLOW_SCALE_TARGET) {
    state.locationFollowScaleMode = FOLLOW_SCALE_MANUAL;
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
  elements.linkCount.textContent = String(state.links.length);

  const linkDistances = state.links
    .map((link) => {
      const a = findPoint(link.a);
      const b = findPoint(link.b);
      return a && b ? { link, a, b, distance: distanceBetween(a, b) } : null;
    })
    .filter(Boolean);

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


function renderRoute() {
  normalizeRouteSelection();
  const selectedPoints = selectedRoutePoints();
  elements.routeSelectedCount.textContent = `${selectedPoints.length}点`;
  elements.routeStartSelect.replaceChildren();

  if (selectedPoints.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "未選択";
    elements.routeStartSelect.append(option);
    elements.routeStartSelect.disabled = true;
    elements.routeReturnToStart.disabled = true;
    elements.routeReturnToStart.checked = state.routeReturnToStart;
    elements.computeRouteButton.disabled = true;
    elements.clearRouteSelectionButton.disabled = true;
    elements.routeSummary.textContent = "地点を選んで巡回を押す";
    elements.routeList.replaceChildren();
    return;
  }

  elements.routeStartSelect.disabled = false;
  elements.routeReturnToStart.disabled = selectedPoints.length < 2;
  elements.routeReturnToStart.checked = state.routeReturnToStart;
  elements.computeRouteButton.disabled = selectedPoints.length < 2;
  elements.clearRouteSelectionButton.disabled = false;

  if (!state.routeStartPointId || !state.routeSelectionIds.includes(state.routeStartPointId)) {
    state.routeStartPointId = state.routeSelectionIds[0] ?? null;
  }

  for (const point of selectedPoints) {
    const option = document.createElement("option");
    option.value = point.id;
    option.textContent = point.title;
    elements.routeStartSelect.append(option);
  }

  elements.routeStartSelect.value = state.routeStartPointId ?? "";
  elements.routeList.replaceChildren();

  if (!state.routeResult) {
    elements.routeSummary.textContent = selectedPoints.length < 2
      ? "2点以上を選択すると順番を計算"
      : "スタート地点を選んで最適順を計算";
    return;
  }

  const method = state.routeResult.exact ? "厳密" : "近似";
  const returnLabel = state.routeResult.returnToStart ? " | 戻る" : "";
  elements.routeSummary.textContent = `${method}計算 | ${state.routeResult.pointIds.length}点${returnLabel} | 合計 ${formatDistance(state.routeResult.totalDistance)}`;

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
    segment.textContent = index === 0 ? "スタート" : `前地点から ${formatDistance(state.routeResult.segmentDistances[index - 1])}`;
    text.append(title, segment);

    const cumulative = document.createElement("span");
    cumulative.textContent = index === 0 ? "0 m" : formatDistance(sumDistances(state.routeResult.segmentDistances.slice(0, index)));

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
    segment.textContent = `スタートへ ${formatDistance(returnDistance)}`;
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
  return id === CURRENT_LOCATION_ID || Boolean(findPointIn(id, state.points));
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
    return Boolean(findLink(entry.id));
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

  const link = findLink(entry.id);
  return link ? linkTitle(link) : "線";
}

function selectedPointIds() {
  return state.selection.filter((entry) => entry.type === "point" && findPoint(entry.id)).map((entry) => entry.id);
}

function selectedLinkIds() {
  return state.selection.filter((entry) => entry.type === "link" && findLink(entry.id)).map((entry) => entry.id);
}

function selectedCounts() {
  const point = selectedPointIds().length;
  const link = selectedLinkIds().length;
  return { point, link, total: point + link };
}

function isPointSelected(pointId) {
  return state.selection.some((entry) => entry.type === "point" && entry.id === pointId);
}

function isLinkSelected(linkId) {
  return state.selection.some((entry) => entry.type === "link" && entry.id === linkId);
}

function selectedPoint() {
  const primary = primarySelection();
  return primary?.type === "point" ? findPoint(primary.id) : null;
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

function findLinkBetween(a, b) {
  return state.links.find((link) => (link.a === a && link.b === b) || (link.a === b && link.b === a)) ?? null;
}

function setRouteFromSelectedPoints() {
  const ids = selectedPointIds();
  if (ids.length === 0) {
    return;
  }

  state.mode = "inspect";
  state.pendingLinkPointId = null;

  if (selectedPointIdsMatchRoute(ids)) {
    state.routeSelectionIds = [];
    state.routeStartPointId = null;
    state.routeResult = null;
    render();
    return;
  }

  state.routeSelectionIds = ids;
  if (!state.routeSelectionIds.includes(state.routeStartPointId)) {
    state.routeStartPointId = ids[0] ?? null;
  }
  state.routeResult = null;
  render();
}

function setRouteStartFromSelection() {
  const point = lastSelectedPoint();
  if (!point) {
    return;
  }

  if (!state.routeSelectionIds.includes(point.id)) {
    const ids = selectedPointIds();
    state.routeSelectionIds = ids.includes(point.id) ? ids : [point.id, ...ids];
  }

  state.routeStartPointId = point.id;
  state.routeResult = null;
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
  const dLng = toRadians(geoB.lng - geoA.lng);
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function formatDistance(distance) {
  if (!Number.isFinite(distance) || distance < 0) {
    return "-";
  }

  if (distance < 1000) {
    return `${distance.toFixed(1)} m`;
  }

  if (distance < 1000000) {
    return `${(distance / 1000).toFixed(2)} km`;
  }

  return `${Math.round(distance / 1000).toLocaleString("ja-JP")} km`;
}

function formatCoordinate(value) {
  return Number(value).toFixed(6);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ja-JP", {
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
  render();
}

function submitPendingPoint() {
  if (!validGeo(state.pendingGeo)) {
    return;
  }

  if (typeof elements.pointForm.requestSubmit === "function") {
    elements.pointForm.requestSubmit();
    return;
  }

  elements.pointForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
}

function fillFormFromWorld(point) {
  state.mode = "add";
  state.pendingGeo = unprojectMercator(point.x, point.y);
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

function handleCanvasClick(screenPoint) {
  const nearest = findNearestPoint(screenPoint);
  const nearestLink = nearest ? null : findNearestLink(screenPoint);
  const world = screenToWorld(screenPoint);

  if (nearest) {
    toggleSelection("point", nearest.id);
    return;
  }

  if (nearestLink) {
    toggleSelection("link", nearestLink.id);
    return;
  }

  pauseLocationFollowForManualView();
  state.mode = "inspect";
  clearSelection({ render: false });
  fillFormFromWorld(world);
  render();
}
function setRouteStart(pointId) {
  if (!state.routeSelectionIds.includes(pointId)) {
    return;
  }

  state.routeStartPointId = pointId;
  state.routeResult = null;
  render();
}

function clearRouteSelection() {
  state.routeSelectionIds = [];
  state.routeStartPointId = null;
  state.routeResult = null;
  render();
}

function computeRouteFromSelection() {
  normalizeRouteSelection();
  const selectedPoints = selectedRoutePoints();

  if (selectedPoints.length < 2) {
    state.routeResult = null;
    render();
    return;
  }

  if (!state.routeStartPointId || !state.routeSelectionIds.includes(state.routeStartPointId)) {
    state.routeStartPointId = selectedPoints[0].id;
  }

  state.routeResult = optimizeVisitOrder(selectedPoints, state.routeStartPointId, state.routeReturnToStart);
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

  if (!state.routeSelectionIds.includes(state.routeStartPointId)) {
    state.routeStartPointId = state.routeSelectionIds[0] ?? null;
    state.routeResult = null;
  }

  if (state.routeResult && state.routeResult.pointIds.some((id) => !state.routeSelectionIds.includes(id))) {
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

  if (state.followCurrentLocation) {
    state.locationFollowScaleMode = state.targetPointId ? FOLLOW_SCALE_TARGET : FOLLOW_SCALE_RANGE;
    const current = currentLocationPoint();
    if (current) {
      fitFollowViewport(current);
      return;
    }

    render();
    return;
  }

  pauseLocationFollowForManualView();

  const fitPoints = fitTargetPoints();

  if (fitPoints.length === 0) {
    state.viewport.x = DEFAULT_CENTER.x;
    state.viewport.y = DEFAULT_CENTER.y;
    state.viewport.scale = 0.7;
    render();
    return;
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
  const mercatorRange = groundDistanceToMercator(range, geo.lat);
  const size = canvasSize();
  const padding = Math.min(110, Math.max(34, Math.min(size.width, size.height) * 0.16));
  const availableWidth = Math.max(64, size.width - padding * 2);
  const availableHeight = Math.max(64, size.height - padding * 2);

  state.viewport.x = current.x;
  state.viewport.y = current.y;
  state.viewport.scale = clampScale(Math.min(availableWidth, availableHeight) / (mercatorRange * 2));
  render();
}

function targetRangeForDistance(distance) {
  const desired = Math.max(25, distance * 1.25);
  return TARGET_DISTANCE_STEPS.find((step) => step >= desired) ?? desired;
}

function followFitTargetPoints(current) {
  const points = [...state.points, current];

  if (validGeo(state.pendingGeo)) {
    const pending = normalizeGeo(state.pendingGeo);
    points.push({ ...projectLatLng(pending.lat, pending.lng), geo: pending });
  }

  return points;
}

function fitTargetPoints() {
  const routePoints = routeResultPoints();
  if (routePoints.length > 0) {
    return routePoints;
  }

  const routeSelection = selectedRoutePoints();
  if (routeSelection.length > 0) {
    return routeSelection;
  }

  const points = [...state.points];
  const current = currentLocationPoint();
  if (current) {
    points.push(current);
  }

  if (validGeo(state.pendingGeo)) {
    const pending = normalizeGeo(state.pendingGeo);
    points.push({ ...projectLatLng(pending.lat, pending.lng), geo: pending });
  }

  return points;
}

function centerOnSelectedPoint() {
  pauseLocationFollowForManualView();
  syncCanvasSize();
  const selected = lastSelectedPoint();

  if (selected) {
    state.viewport.x = selected.x;
    state.viewport.y = selected.y;
    state.viewport.scale = Math.max(state.viewport.scale, 0.7);
    render();
    return;
  }

  const current = currentLocationPoint();
  if (current) {
    state.viewport.x = current.x;
    state.viewport.y = current.y;
    state.viewport.scale = Math.max(state.viewport.scale, 0.7);
    render();
    return;
  }

  fitToPoints();
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

async function submitPoint(event) {
  event.preventDefault();

  const lat = Number.parseFloat(elements.pointLat.value);
  const lng = Number.parseFloat(elements.pointLng.value);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    elements.statusLine.value = "緯度経度を入力してください";
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
  const fallbackTitle = `Point ${state.points.length + 1}`;

  pauseLocationFollowForManualView();

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

  state.points.push(point);
  state.selection = [{ type: "point", id: point.id }];
  normalizeSelection();
  state.pendingGeo = null;
  state.mode = "inspect";
  elements.pointForm.reset();
  state.viewport.x = point.x;
  state.viewport.y = point.y;
  state.viewport.scale = Math.max(state.viewport.scale, 0.7);
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
  requestCurrentLocation({ fillForm: true, center: true, showButtonState: true });
}

function locateOnStartup() {
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
  const geo = normalizeGeo({
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy
  });
  const projected = projectLatLng(geo.lat, geo.lng);

  state.currentGeo = geo;

  if (options.fillForm) {
    state.mode = "add";
    state.pendingGeo = geo;
    fillFormFromGeo(geo);
  }

  if (options.center) {
    if (state.followCurrentLocation && state.locationFollowScaleMode !== FOLLOW_SCALE_MANUAL) {
      fitFollowViewport(currentLocationPoint());
      return;
    }

    state.viewport.x = projected.x;
    state.viewport.y = projected.y;

    if (!state.followCurrentLocation) {
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
  if (!("geolocation" in navigator)) {
    if (!options.startup) {
      elements.statusLine.value = "現在地を取得できません";
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
        elements.statusLine.value = locationErrorMessage(error, "現在地エラー");
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
    stopLocationFollow();
    return;
  }

  startLocationFollow(options);
}

function startLocationFollow(options = {}) {
  if (!("geolocation" in navigator)) {
    elements.statusLine.value = "現在地を取得できません";
    return;
  }

  if (state.locationWatchId !== null) {
    return;
  }

  state.followCurrentLocation = true;
  state.locationFollowFillForm = Boolean(options.fillForm);
  if (state.targetPointId && state.locationFollowScaleMode === FOLLOW_SCALE_MANUAL) {
    state.locationFollowScaleMode = FOLLOW_SCALE_TARGET;
  }

  try {
    state.locationWatchId = navigator.geolocation.watchPosition(
      (position) => updateCurrentLocationFromPosition(position, {
        center: state.followCurrentLocation,
        fillForm: state.locationFollowFillForm
      }),
      (error) => {
        const message = locationErrorMessage(error, "追従エラー");
        stopLocationFollow();
        elements.statusLine.value = message;
      },
      geolocationOptions()
    );
    render();
  } catch {
    state.followCurrentLocation = false;
    state.locationWatchId = null;
    state.locationFollowFillForm = false;
    state.locationFollowScaleMode = FOLLOW_SCALE_MANUAL;
    renderLocationFollowButton();
    elements.statusLine.value = "追従エラー";
  }
}

function stopLocationFollow(options = {}) {
  if (state.locationWatchId !== null && "geolocation" in navigator) {
    navigator.geolocation.clearWatch(state.locationWatchId);
  }

  state.locationWatchId = null;
  state.followCurrentLocation = false;
  state.locationFollowFillForm = false;
  state.locationFollowScaleMode = FOLLOW_SCALE_MANUAL;

  if (options.render !== false) {
    render();
    return;
  }

  renderLocationFollowButton();
}

function pauseLocationFollowForManualView() {
  if (state.followCurrentLocation) {
    stopLocationFollow({ render: false });
  }
}

function renderLocationFollowButton() {
  const isSupported = "geolocation" in navigator;
  elements.useLocationButton.disabled = !isSupported;
  elements.useLocationButton.classList.remove("is-active");
  elements.useLocationButton.setAttribute("aria-pressed", "false");
  elements.useLocationButton.textContent = "現在地";
  elements.useLocationButton.title = isSupported ? "現在地を登録フォームへ入力" : "現在地を取得できません";

  elements.actionFollowButton.disabled = !isSupported;
  elements.actionFollowButton.classList.toggle("is-active", state.followCurrentLocation);
  elements.actionFollowButton.setAttribute("aria-pressed", String(state.followCurrentLocation));
  elements.actionFollowButton.title = state.followCurrentLocation ? "現在地追従を停止" : "現在地追従を開始";
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
  const safeLat = clampLatitude(lat);
  const normalizedLng = normalizeLongitude(lng);
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
  return Math.min(MAX_MERCATOR_LAT, Math.max(-MAX_MERCATOR_LAT, lat));
}

function normalizeLongitude(lng) {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
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
  let reloadingForUpdate = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloadOnControllerChange || reloadingForUpdate) {
      return;
    }

    reloadingForUpdate = true;
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
function exportWorkspace() {
  const blob = new Blob([JSON.stringify(workspaceSnapshot(), null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `grid-atlas-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function importWorkspaceFile(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed.points) || !Array.isArray(parsed.links)) {
        throw new Error("Invalid workspace");
      }

      applyWorkspace(parsed);
      persistWorkspace();
      fitToPoints();
    } catch {
      elements.statusLine.value = "読み込みエラー";
    }
  });
  reader.readAsText(file);
}

function clearWorkspace() {
  const confirmed = window.confirm("登録データを初期化しますか。");
  if (!confirmed) {
    return;
  }

  state.points = [];
  state.links = [];
  state.selection = [];
  state.selectedPointId = null;
  state.selectedLinkId = null;
  state.pendingLinkPointId = null;
  state.routeSelectionIds = [];
  state.routeStartPointId = null;
  state.routeReturnToStart = false;
  state.routeResult = null;
  clearTarget({ render: false });
  localStorage.removeItem(STORAGE_KEY);
  render();
}

function deleteSelectedPoint() {
  normalizeSelection();
  const pointIds = selectedPointIds().filter((id) => id !== CURRENT_LOCATION_ID);
  const explicitLinkIds = selectedLinkIds();
  const pointIdSet = new Set(pointIds);
  const linkIdSet = new Set(explicitLinkIds);

  for (const link of state.links) {
    if (pointIdSet.has(link.a) || pointIdSet.has(link.b)) {
      linkIdSet.add(link.id);
    }
  }

  if (pointIdSet.size + linkIdSet.size === 0) {
    return;
  }

  const parts = [];
  if (pointIdSet.size > 0) {
    parts.push(`${pointIdSet.size}点`);
  }
  if (linkIdSet.size > 0) {
    parts.push(`${linkIdSet.size}線`);
  }

  const confirmed = window.confirm(`選択中の${parts.join(" / ")}を削除しますか。`);
  if (!confirmed) {
    return;
  }

  state.points = state.points.filter((item) => !pointIdSet.has(item.id));
  state.links = state.links.filter((item) => !linkIdSet.has(item.id));
  state.selection = [];
  state.selectedPointId = null;
  state.selectedLinkId = null;
  state.pendingLinkPointId = null;
  state.routeSelectionIds = state.routeSelectionIds.filter((id) => !pointIdSet.has(id));
  state.routeStartPointId = state.routeSelectionIds.includes(state.routeStartPointId) ? state.routeStartPointId : state.routeSelectionIds[0] ?? null;
  state.routeResult = null;

  if (pointIdSet.has(state.targetPointId)) {
    clearTarget({ render: false });
  }

  persistWorkspace();
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

  elements.themeToggleButton.addEventListener("click", toggleTheme);
  elements.actionLinkButton.addEventListener("click", connectSelectedPoints);
  elements.actionRegisterButton.addEventListener("click", submitPendingPoint);
  elements.actionRouteButton.addEventListener("click", setRouteFromSelectedPoints);
  elements.clearSelectionButton.addEventListener("click", () => clearSelection());
  elements.actionTargetButton.addEventListener("click", toggleTargetForSelection);
  elements.actionRouteStartButton.addEventListener("click", setRouteStartFromSelection);
  elements.actionFollowButton.addEventListener("click", () => toggleLocationFollow({ fillForm: false }));

  elements.pointForm.addEventListener("submit", submitPoint);
  elements.readClipboardButton.addEventListener("click", readClipboardShare);
  elements.useLocationButton.addEventListener("click", useCurrentLocation);
  elements.zoomInButton.addEventListener("click", () => zoomAt({ x: canvasSize().width / 2, y: canvasSize().height / 2 }, 1.25));
  elements.zoomOutButton.addEventListener("click", () => zoomAt({ x: canvasSize().width / 2, y: canvasSize().height / 2 }, 0.8));
  elements.fitButton.addEventListener("click", fitToPoints);
  elements.originButton.addEventListener("click", centerOnSelectedPoint);
  elements.routeStartSelect.addEventListener("change", () => setRouteStart(elements.routeStartSelect.value));
  elements.routeReturnToStart.addEventListener("change", () => {
    state.routeReturnToStart = elements.routeReturnToStart.checked;
    state.routeResult = null;
    render();
  });
  elements.computeRouteButton.addEventListener("click", computeRouteFromSelection);
  elements.clearRouteSelectionButton.addEventListener("click", clearRouteSelection);
  elements.openAppleMapsButton.addEventListener("click", () => openSelectedPointInExternalMap("apple"));
  elements.openGoogleMapsButton.addEventListener("click", () => openSelectedPointInExternalMap("google"));
  elements.targetPointButton.addEventListener("click", toggleTargetForSelection);
  elements.deletePointButton.addEventListener("click", deleteSelectedPoint);
  elements.exportButton.addEventListener("click", exportWorkspace);
  elements.importButton.addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", () => {
    const file = elements.importFile.files[0];
    if (file) {
      importWorkspaceFile(file);
    }
    elements.importFile.value = "";
  });
  elements.clearButton.addEventListener("click", clearWorkspace);

  canvas.addEventListener("pointerdown", (event) => {
    const point = getCanvasPoint(event);
    state.pointer = {
      id: event.pointerId,
      start: point,
      last: point,
      viewportX: state.viewport.x,
      viewportY: state.viewport.y,
      moved: false
    };
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.pointer || state.pointer.id !== event.pointerId) {
      return;
    }

    const point = getCanvasPoint(event);
    const dx = point.x - state.pointer.start.x;
    const dy = point.y - state.pointer.start.y;

    if (Math.hypot(dx, dy) > 3) {
      if (!state.pointer.moved) {
        pauseLocationFollowForManualView();
      }
      state.pointer.moved = true;
    }

    if (state.pointer.moved) {
      state.viewport.x = state.pointer.viewportX - dx / state.viewport.scale;
      state.viewport.y = state.pointer.viewportY + dy / state.viewport.scale;
      draw();
      renderStatus();
    }

    state.pointer.last = point;
  });

  canvas.addEventListener("pointerup", (event) => {
    if (!state.pointer || state.pointer.id !== event.pointerId) {
      return;
    }

    const point = getCanvasPoint(event);
    const wasMoved = state.pointer.moved;
    state.pointer = null;
    canvas.releasePointerCapture(event.pointerId);

    if (!wasMoved) {
      handleCanvasClick(point);
    }
  });

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
bindEvents();
resizeCanvas();
handleIncomingShare();
locateOnStartup();
registerServiceWorker();
render();
