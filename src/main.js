const STORAGE_KEY = "grid-atlas-workspace-v2";
const POINT_RADIUS = 8;
const CURRENT_LOCATION_ID = "__current_location__";
const EARTH_RADIUS_METERS = 6371008.8;
const MERCATOR_RADIUS = 6378137;
const MAX_MERCATOR_LAT = 85.05112878;
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
  actionMeasureButton: document.querySelector("#actionMeasureButton"),
  actionRouteButton: document.querySelector("#actionRouteButton"),
  actionRouteLabel: document.querySelector("#actionRouteLabel"),
  statusLine: document.querySelector("#statusLine"),
  mobileSelectedTitle: document.querySelector("#mobileSelectedTitle"),
  sidebarSelectedTitle: document.querySelector("#sidebarSelectedTitle"),
  pointForm: document.querySelector("#pointForm"),
  pointTitle: document.querySelector("#pointTitle"),
  pointLat: document.querySelector("#pointLat"),
  pointLng: document.querySelector("#pointLng"),
  pointPhoto: document.querySelector("#pointPhoto"),
  pointNote: document.querySelector("#pointNote"),
  shareInput: document.querySelector("#shareInput"),
  parseShareButton: document.querySelector("#parseShareButton"),
  shareImportStatus: document.querySelector("#shareImportStatus"),
  useCenterButton: document.querySelector("#useCenterButton"),
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
  openAppleMapsButton: document.querySelector("#openAppleMapsButton"),
  openGoogleMapsButton: document.querySelector("#openGoogleMapsButton"),
  deletePointButton: document.querySelector("#deletePointButton"),
  pointCount: document.querySelector("#pointCount"),
  linkCount: document.querySelector("#linkCount"),
  totalDistance: document.querySelector("#totalDistance"),
  longestDistance: document.querySelector("#longestDistance"),
  measureResult: document.querySelector("#measureResult"),
  linkList: document.querySelector("#linkList"),
  routeSelectedCount: document.querySelector("#routeSelectedCount"),
  routeStartSelect: document.querySelector("#routeStartSelect"),
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
  selectedPointId: null,
  selectedLinkId: null,
  pendingLinkPointId: null,
  measureStartPointId: null,
  measureResult: null,
  routeSelectionIds: [],
  routeStartPointId: null,
  routeResult: null,
  pendingGeo: null,
  currentGeo: null,
  viewport: {
    x: DEFAULT_CENTER.x,
    y: DEFAULT_CENTER.y,
    scale: 0.7
  },
  pointer: null
};

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
    ? workspace.links.filter((link) => findPointIn(link.a, state.points) && findPointIn(link.b, state.points))
    : [];
  state.selectedPointId = null;
  state.selectedLinkId = null;
  state.pendingLinkPointId = null;
  state.measureStartPointId = null;
  state.measureResult = null;
  state.routeSelectionIds = [];
  state.routeStartPointId = null;
  state.routeResult = null;
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
  const candidates = [
    1, 2, 5, 10, 20, 50, 100, 200, 500,
    1000, 2000, 5000, 10000, 20000, 50000,
    100000, 200000, 500000, 1000000, 2000000,
    5000000, 10000000
  ];
  return candidates.find((step) => step * state.viewport.scale >= 48) ?? 20000000;
}

function drawGrid(width, height) {
  const majorStep = chooseGridStep();
  const minorStep = majorStep / 5;
  const topLeft = screenToWorld({ x: 0, y: 0 });
  const bottomRight = screenToWorld({ x: width, y: height });

  drawGridLines(topLeft, bottomRight, minorStep, "#edf0e8", 1);
  drawGridLines(topLeft, bottomRight, majorStep, "#d8ded1", 1.25);
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
    const isSelected = link.id === state.selectedLinkId;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.strokeStyle = isSelected ? "#2e7d32" : "#116c6d";
    context.lineWidth = isSelected ? 5 : 2.4;
    context.stroke();
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
  context.strokeStyle = "#5a4aa0";
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

  const screen = worldToScreen(location);
  const accuracyRadius = Number.isFinite(state.currentGeo.accuracy)
    ? Math.min(160, Math.max(16, state.currentGeo.accuracy * state.viewport.scale))
    : 0;

  if (accuracyRadius > 0) {
    context.beginPath();
    context.arc(screen.x, screen.y, accuracyRadius, 0, Math.PI * 2);
    context.fillStyle = "rgb(255 212 54 / 0.16)";
    context.fill();
  }

  context.beginPath();
  context.arc(screen.x, screen.y, 9, 0, Math.PI * 2);
  context.fillStyle = "#ffd436";
  context.fill();
  context.lineWidth = state.selectedPointId === CURRENT_LOCATION_ID ? 4 : 3;
  context.strokeStyle = state.selectedPointId === CURRENT_LOCATION_ID ? "#2e7d32" : "#6b5a00";
  context.stroke();

  context.beginPath();
  context.arc(screen.x, screen.y, 3, 0, Math.PI * 2);
  context.fillStyle = "#fff7bf";
  context.fill();
}
function drawPoints() {
  for (const point of state.points) {
    const screen = worldToScreen(point);
    const isSelected = point.id === state.selectedPointId;
    const isPending = point.id === state.pendingLinkPointId || point.id === state.measureStartPointId;
    const shouldShowRouteSelection = state.routeSelectionIds.length > 0 || Boolean(state.routeResult);
    const isRouteSelected = shouldShowRouteSelection && state.routeSelectionIds.includes(point.id);
    const isRouteStart = shouldShowRouteSelection && state.routeStartPointId === point.id;
    context.beginPath();
    context.arc(screen.x, screen.y, POINT_RADIUS, 0, Math.PI * 2);
    context.fillStyle = "#e95f1a";
    context.fill();

    context.lineWidth = isSelected || isPending || isRouteSelected ? 4 : 2;
    context.strokeStyle = isRouteStart
      ? "#5a4aa0"
      : isRouteSelected
        ? "#7b68c7"
        : isPending
          ? "#116c6d"
          : isSelected
            ? "#2e7d32"
            : "#ffffff";
    context.stroke();
  }
}

function drawRouteBadges() {
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
    context.fillStyle = index === 0 ? "#5a4aa0" : "#ffffff";
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = "#5a4aa0";
    context.stroke();
    context.fillStyle = index === 0 ? "#ffffff" : "#5a4aa0";
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
  drawCurrentLocation();
  drawLinks();
  drawRouteResult();
  drawPoints();
  drawRouteBadges();
}

function render() {
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
  const point = findPoint(state.selectedPointId);
  const link = selectedLink();
  const title = point ? point.title : link ? linkTitle(link) : "未選択";
  elements.mobileSelectedTitle.textContent = title;
  elements.sidebarSelectedTitle.textContent = title;
}

function renderStatus() {
  const modeLabel = {
    inspect: "選択",
    add: "登録",
    link: "接続",
    measure: "計測",
    route: "巡回"
  }[state.mode];

  let extra = "";
  const pendingLink = findPoint(state.pendingLinkPointId);
  const pendingMeasure = findPoint(state.measureStartPointId);

  if (pendingLink) {
    extra = ` | 接続元: ${pendingLink.title}`;
  } else if (pendingMeasure) {
    extra = ` | 計測元: ${pendingMeasure.title}`;
  } else if (state.routeSelectionIds.length > 0) {
    extra = ` | 巡回: ${state.routeSelectionIds.length}点`;
  }

  elements.statusLine.value = `${modeLabel} | ${state.points.length}点 | ${state.links.length}線 | 格子 ${formatDistance(chooseGridStep())}${extra}`;
}

function renderActionButtons() {
  const point = findPoint(state.selectedPointId);
  const link = selectedLink();
  const hasPoint = Boolean(point);
  const isRouteSelected = hasPoint && state.routeSelectionIds.includes(point.id);

  elements.actionLinkButton.disabled = !hasPoint || point.isVirtual;
  elements.actionMeasureButton.disabled = !hasPoint;
  elements.actionRouteButton.disabled = !hasPoint;
  elements.deletePointButton.disabled = !(link || (point && !point.isVirtual));
  elements.actionLinkButton.classList.toggle("is-active", Boolean(state.pendingLinkPointId));
  elements.actionMeasureButton.classList.toggle("is-active", Boolean(state.measureStartPointId));
  elements.actionRouteButton.classList.toggle("is-active", Boolean(isRouteSelected));
  elements.actionRouteLabel.textContent = isRouteSelected ? "解除" : "巡回";
}

function renderDetails() {
  const point = findPoint(state.selectedPointId);
  const link = selectedLink();
  const hasSelection = Boolean(point || link);

  elements.emptyDetails.hidden = hasSelection;
  elements.pointDetails.hidden = !hasSelection;
  elements.selectionHeading.textContent = link ? "選択線" : "選択地点";

  if (!hasSelection) {
    return;
  }

  elements.detailPhoto.hidden = true;
  elements.detailPhoto.removeAttribute("src");
  elements.detailPhoto.alt = "";

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

  if (point.photo) {
    elements.detailPhoto.hidden = false;
    elements.detailPhoto.src = point.photo;
    elements.detailPhoto.alt = point.photoName || point.title;
  }
}


function openSelectedPointInExternalMap(provider) {
  const point = findPoint(state.selectedPointId);
  if (!point) {
    return;
  }

  const geo = pointGeo(point);
  const url = externalMapUrl(provider, geo, point.title);
  const opened = window.open(url, "_blank");
  if (opened) {
    opened.opener = null;
    return;
  }

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
  elements.measureResult.textContent = state.measureResult
    ? `${state.measureResult.a.title} - ${state.measureResult.b.title}: ${formatDistance(state.measureResult.distance)}`
    : "未計測";

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
      state.selectedLinkId = state.selectedLinkId === item.link.id ? null : state.selectedLinkId;
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
    elements.computeRouteButton.disabled = true;
    elements.clearRouteSelectionButton.disabled = true;
    elements.routeSummary.textContent = "地点を選んで上部の巡回を押す";
    elements.routeList.replaceChildren();
    return;
  }

  elements.routeStartSelect.disabled = false;
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
  elements.routeSummary.textContent = `${method}計算 | ${state.routeResult.pointIds.length}点 | 合計 ${formatDistance(state.routeResult.totalDistance)}`;

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
}
function findPoint(id) {
  return id === CURRENT_LOCATION_ID ? currentLocationPoint() : findPointIn(id, state.points);
}

function findPointIn(id, points) {
  return points.find((point) => point.id === id) ?? null;
}

function findLink(id) {
  return state.links.find((link) => link.id === id) ?? null;
}

function selectedLink() {
  return findLink(state.selectedLinkId);
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

function selectedPoint() {
  return findPoint(state.selectedPointId);
}

function startLinkFromSelection() {
  const point = selectedPoint();
  if (!point || point.isVirtual) {
    return;
  }

  state.mode = "link";
  state.pendingLinkPointId = point.id;
  state.measureStartPointId = null;
  render();
}

function startMeasureFromSelection() {
  const point = selectedPoint();
  if (!point) {
    return;
  }

  state.mode = "measure";
  state.measureStartPointId = point.id;
  state.pendingLinkPointId = null;
  render();
}

function toggleSelectedRoutePoint() {
  const point = selectedPoint();
  if (!point) {
    return;
  }

  state.mode = "inspect";
  state.pendingLinkPointId = null;
  state.measureStartPointId = null;
  handleRoutePoint(point);
}

function fillFormFromWorld(point) {
  fillFormFromGeo(unprojectMercator(point.x, point.y));
}

function fillFormFromGeo(geo) {
  const normalized = normalizeGeo(geo);
  elements.pointLat.value = normalized.lat.toFixed(6);
  elements.pointLng.value = normalized.lng.toFixed(6);
}

function selectPoint(pointId) {
  state.selectedPointId = pointId;
  state.selectedLinkId = null;
  render();
}

function selectLink(linkId) {
  state.mode = "inspect";
  state.selectedPointId = null;
  state.selectedLinkId = linkId;
  state.pendingLinkPointId = null;
  state.measureStartPointId = null;
  render();
}

function handleCanvasClick(screenPoint) {
  const nearest = findNearestPoint(screenPoint);
  const nearestLink = nearest ? null : findNearestLink(screenPoint);
  const world = screenToWorld(screenPoint);

  if (nearest) {
    if (state.mode === "link" && state.pendingLinkPointId) {
      handleLinkPoint(nearest);
      return;
    }

    if (state.mode === "measure" && state.measureStartPointId) {
      handleMeasurePoint(nearest);
      return;
    }

    state.mode = "inspect";
    state.pendingLinkPointId = null;
    state.measureStartPointId = null;
    selectPoint(nearest.id);
    return;
  }

  if (nearestLink) {
    selectLink(nearestLink.id);
    return;
  }

  state.mode = "inspect";
  state.selectedPointId = null;
  state.selectedLinkId = null;
  state.pendingLinkPointId = null;
  state.measureStartPointId = null;
  state.pendingGeo = null;
  fillFormFromWorld(world);
  render();
}
function handleLinkPoint(point) {
  if (point.isVirtual) {
    state.pendingLinkPointId = null;
    state.mode = "inspect";
    state.selectedPointId = point.id;
    state.selectedLinkId = null;
    render();
    return;
  }

  if (!state.pendingLinkPointId) {
    state.pendingLinkPointId = point.id;
    state.selectedPointId = point.id;
    state.selectedLinkId = null;
    render();
    return;
  }

  if (state.pendingLinkPointId === point.id) {
    state.pendingLinkPointId = null;
    state.mode = "inspect";
    render();
    return;
  }

  const a = state.pendingLinkPointId;
  const b = point.id;
  const exists = state.links.some((link) => (link.a === a && link.b === b) || (link.a === b && link.b === a));

  if (!exists) {
    state.links.push({
      id: createId(),
      a,
      b,
      createdAt: new Date().toISOString()
    });
    persistWorkspace();
  }

  state.pendingLinkPointId = null;
  state.mode = "inspect";
  state.selectedPointId = point.id;
  state.selectedLinkId = null;
  render();
}

function handleMeasurePoint(point) {
  if (!state.measureStartPointId) {
    state.measureStartPointId = point.id;
    state.selectedPointId = point.id;
    state.selectedLinkId = null;
    render();
    return;
  }

  const start = findPoint(state.measureStartPointId);

  if (start && start.id !== point.id) {
    state.measureResult = {
      a: start,
      b: point,
      distance: distanceBetween(start, point)
    };
  }

  state.measureStartPointId = null;
  state.mode = "inspect";
  state.selectedPointId = point.id;
  state.selectedLinkId = null;
  render();
}


function handleRoutePoint(point) {
  const exists = state.routeSelectionIds.includes(point.id);
  state.routeSelectionIds = exists
    ? state.routeSelectionIds.filter((id) => id !== point.id)
    : [...state.routeSelectionIds, point.id];

  if (!state.routeSelectionIds.includes(state.routeStartPointId)) {
    state.routeStartPointId = exists ? state.routeSelectionIds[0] ?? null : point.id;
  }

  state.routeResult = null;
  state.selectedPointId = point.id;
  state.selectedLinkId = null;
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

  state.routeResult = optimizeVisitOrder(selectedPoints, state.routeStartPointId);
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

function optimizeVisitOrder(points, startPointId) {
  const startIndex = Math.max(0, points.findIndex((point) => point.id === startPointId));
  const orderedPoints = [points[startIndex], ...points.filter((_, index) => index !== startIndex)];
  const distances = buildDistanceMatrix(orderedPoints);
  const result = orderedPoints.length <= 12
    ? optimizeExact(distances)
    : optimizeHeuristic(distances);
  const routePoints = result.path.map((index) => orderedPoints[index]);
  const segmentDistances = routePoints.slice(1).map((point, index) => distanceBetween(routePoints[index], point));

  return {
    pointIds: routePoints.map((point) => point.id),
    totalDistance: sumDistances(segmentDistances),
    segmentDistances,
    exact: result.exact
  };
}

function buildDistanceMatrix(points) {
  return points.map((from) => points.map((to) => (from.id === to.id ? 0 : distanceBetween(from, to))));
}

function optimizeExact(distances) {
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
    if (dp[fullMask][last] < bestDistance) {
      bestDistance = dp[fullMask][last];
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

function optimizeHeuristic(distances) {
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

  improveRouteWithTwoOpt(path, distances);

  return {
    path,
    exact: false
  };
}

function improveRouteWithTwoOpt(path, distances) {
  let improved = true;

  while (improved) {
    improved = false;

    for (let start = 1; start < path.length - 1; start += 1) {
      for (let end = start + 1; end < path.length; end += 1) {
        const before = routeEdgeCost(path, distances, start, end);
        const reversed = [...path.slice(0, start), ...path.slice(start, end + 1).reverse(), ...path.slice(end + 1)];
        const after = routeEdgeCost(reversed, distances, start, end);

        if (after + 0.000001 < before) {
          path.splice(0, path.length, ...reversed);
          improved = true;
        }
      }
    }
  }
}

function routeEdgeCost(path, distances, start, end) {
  const beforeStart = distances[path[start - 1]][path[start]];
  const afterEnd = end + 1 < path.length ? distances[path[end]][path[end + 1]] : 0;
  return beforeStart + afterEnd;
}

function sumDistances(distances) {
  return distances.reduce((sum, distance) => sum + distance, 0);
}
function zoomAt(screenPoint, factor) {
  const before = screenToWorld(screenPoint);
  state.viewport.scale = clampScale(state.viewport.scale * factor);
  const after = screenToWorld(screenPoint);
  state.viewport.x += before.x - after.x;
  state.viewport.y += before.y - after.y;
  render();
}

function fitToPoints() {
  syncCanvasSize();

  if (state.points.length === 0) {
    const current = currentLocationPoint();
    state.viewport.x = current?.x ?? DEFAULT_CENTER.x;
    state.viewport.y = current?.y ?? DEFAULT_CENTER.y;
    state.viewport.scale = 0.7;
    render();
    return;
  }

  const size = canvasSize();
  const xs = state.points.map((point) => point.x);
  const ys = state.points.map((point) => point.y);
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

function centerOnSelectedPoint() {
  syncCanvasSize();
  const selected = findPoint(state.selectedPointId);

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
  state.selectedPointId = point.id;
  state.selectedLinkId = null;
  state.pendingGeo = null;
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
      const geo = normalizeGeo({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      });
      const projected = projectLatLng(geo.lat, geo.lng);

      state.currentGeo = geo;
      if (options.fillForm) {
        state.pendingGeo = geo;
        fillFormFromGeo(geo);
      }
      if (options.center && (!options.startup || (state.mode === "inspect" && !state.selectedPointId))) {
        state.viewport.x = projected.x;
        state.viewport.y = projected.y;
        state.viewport.scale = Math.max(state.viewport.scale, 0.7);
      }
      if (options.showButtonState) {
        elements.useLocationButton.disabled = false;
        elements.useLocationButton.textContent = "現在地";
      }
      render();
    },
    () => {
      if (!options.startup) {
        elements.statusLine.value = "現在地エラー";
      }
      if (options.showButtonState) {
        elements.useLocationButton.disabled = false;
        elements.useLocationButton.textContent = "現在地";
      }
    },
    {
      enableHighAccuracy: true,
      timeout: options.startup ? 6500 : 10000,
      maximumAge: 5000
    }
  );
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


function parseShareInput() {
  const result = parseSharedLocationPayload({
    text: elements.shareInput.value,
    title: elements.pointTitle.value
  });

  if (!result) {
    elements.shareImportStatus.value = shortMapUrlLikely(elements.shareInput.value)
      ? "短縮URLは展開できません"
      : "座標を読み取れません";
    return;
  }

  applySharedLocationToForm(result, "共有地点を読み取りました");
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
  elements.shareInput.value = [payload.title, payload.text, payload.url].filter(Boolean).join("\n");

  if (!result) {
    elements.shareImportStatus.value = shortMapUrlLikely(elements.shareInput.value)
      ? "短縮URLは展開できません"
      : "共有内容から座標を読み取れません";
    return;
  }

  applySharedLocationToForm(result, "共有地点を読み取りました");
}

function applySharedLocationToForm(result, message) {
  const geo = normalizeGeo({ lat: result.lat, lng: result.lng });
  const projected = projectLatLng(geo.lat, geo.lng);

  state.mode = "inspect";
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

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
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
  state.selectedPointId = null;
  state.selectedLinkId = null;
  state.pendingLinkPointId = null;
  state.measureStartPointId = null;
  state.measureResult = null;
  state.routeSelectionIds = [];
  state.routeStartPointId = null;
  state.routeResult = null;
  localStorage.removeItem(STORAGE_KEY);
  render();
}

function deleteSelectedPoint() {
  const link = selectedLink();
  if (link) {
    const confirmed = window.confirm("選択線を削除しますか。");
    if (!confirmed) {
      return;
    }

    state.links = state.links.filter((item) => item.id !== link.id);
    state.selectedLinkId = null;
    persistWorkspace();
    render();
    return;
  }

  const point = findPoint(state.selectedPointId);
  if (!point) {
    return;
  }

  const confirmed = window.confirm("選択地点を削除しますか。");
  if (!confirmed) {
    return;
  }

  state.points = state.points.filter((item) => item.id !== point.id);
  state.links = state.links.filter((item) => item.a !== point.id && item.b !== point.id);
  state.selectedPointId = null;
  state.selectedLinkId = null;
  state.pendingLinkPointId = state.pendingLinkPointId === point.id ? null : state.pendingLinkPointId;
  state.measureStartPointId = state.measureStartPointId === point.id ? null : state.measureStartPointId;
  state.routeSelectionIds = state.routeSelectionIds.filter((id) => id !== point.id);
  state.routeStartPointId = state.routeStartPointId === point.id ? state.routeSelectionIds[0] ?? null : state.routeStartPointId;
  state.routeResult = null;
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

  elements.actionLinkButton.addEventListener("click", startLinkFromSelection);
  elements.actionMeasureButton.addEventListener("click", startMeasureFromSelection);
  elements.actionRouteButton.addEventListener("click", toggleSelectedRoutePoint);

  elements.pointForm.addEventListener("submit", submitPoint);
  elements.parseShareButton.addEventListener("click", parseShareInput);
  elements.useCenterButton.addEventListener("click", () => {
    state.pendingGeo = null;
    fillFormFromWorld({ x: state.viewport.x, y: state.viewport.y });
  });
  elements.useLocationButton.addEventListener("click", useCurrentLocation);
  elements.zoomInButton.addEventListener("click", () => zoomAt({ x: canvasSize().width / 2, y: canvasSize().height / 2 }, 1.25));
  elements.zoomOutButton.addEventListener("click", () => zoomAt({ x: canvasSize().width / 2, y: canvasSize().height / 2 }, 0.8));
  elements.fitButton.addEventListener("click", fitToPoints);
  elements.originButton.addEventListener("click", centerOnSelectedPoint);
  elements.routeStartSelect.addEventListener("change", () => setRouteStart(elements.routeStartSelect.value));
  elements.computeRouteButton.addEventListener("click", computeRouteFromSelection);
  elements.clearRouteSelectionButton.addEventListener("click", clearRouteSelection);
  elements.openAppleMapsButton.addEventListener("click", () => openSelectedPointInExternalMap("apple"));
  elements.openGoogleMapsButton.addEventListener("click", () => openSelectedPointInExternalMap("google"));
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

loadWorkspace();
bindEvents();
resizeCanvas();
handleIncomingShare();
locateOnStartup();
registerServiceWorker();
render();
