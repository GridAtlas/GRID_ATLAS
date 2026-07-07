const STORAGE_KEY = "grid-atlas-workspace-v1";
const POINT_RADIUS = 8;

const canvas = document.querySelector("#gridCanvas");
const context = canvas.getContext("2d");

const elements = {
  modeButtons: Array.from(document.querySelectorAll(".mode-button")),
  statusLine: document.querySelector("#statusLine"),
  pointForm: document.querySelector("#pointForm"),
  pointTitle: document.querySelector("#pointTitle"),
  pointX: document.querySelector("#pointX"),
  pointY: document.querySelector("#pointY"),
  pointPhoto: document.querySelector("#pointPhoto"),
  pointNote: document.querySelector("#pointNote"),
  useCenterButton: document.querySelector("#useCenterButton"),
  useLocationButton: document.querySelector("#useLocationButton"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  fitButton: document.querySelector("#fitButton"),
  originButton: document.querySelector("#originButton"),
  emptyDetails: document.querySelector("#emptyDetails"),
  pointDetails: document.querySelector("#pointDetails"),
  detailPhoto: document.querySelector("#detailPhoto"),
  detailTitle: document.querySelector("#detailTitle"),
  detailCoords: document.querySelector("#detailCoords"),
  detailCreated: document.querySelector("#detailCreated"),
  detailNote: document.querySelector("#detailNote"),
  deletePointButton: document.querySelector("#deletePointButton"),
  pointCount: document.querySelector("#pointCount"),
  linkCount: document.querySelector("#linkCount"),
  totalDistance: document.querySelector("#totalDistance"),
  longestDistance: document.querySelector("#longestDistance"),
  measureResult: document.querySelector("#measureResult"),
  linkList: document.querySelector("#linkList"),
  exportButton: document.querySelector("#exportButton"),
  importButton: document.querySelector("#importButton"),
  importFile: document.querySelector("#importFile"),
  clearButton: document.querySelector("#clearButton")
};

const state = {
  version: 1,
  origin: null,
  points: [],
  links: [],
  mode: "inspect",
  selectedPointId: null,
  pendingLinkPointId: null,
  measureStartPointId: null,
  measureResult: null,
  pendingGeo: null,
  viewport: {
    x: 0,
    y: 0,
    scale: 1
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
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    state.version = parsed.version ?? 1;
    state.origin = parsed.origin ?? null;
    state.points = Array.isArray(parsed.points) ? parsed.points : [];
    state.links = Array.isArray(parsed.links) ? parsed.links : [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function workspaceSnapshot() {
  return {
    version: 1,
    origin: state.origin,
    points: state.points,
    links: state.links
  };
}

function persistWorkspace() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaceSnapshot()));
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function canvasSize() {
  const rect = canvas.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height
  };
}

function clampScale(scale) {
  return Math.min(18, Math.max(0.08, scale));
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
  const candidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  return candidates.find((step) => step * state.viewport.scale >= 48) ?? 10000;
}

function drawGrid(width, height) {
  const majorStep = chooseGridStep();
  const minorStep = majorStep / 5;
  const topLeft = screenToWorld({ x: 0, y: 0 });
  const bottomRight = screenToWorld({ x: width, y: height });

  drawGridLines(topLeft, bottomRight, minorStep, "#edf0e8", 1);
  drawGridLines(topLeft, bottomRight, majorStep, "#d8ded1", 1.25);
  drawAxisLine(width, height);
}

function drawGridLines(topLeft, bottomRight, step, color, lineWidth) {
  const minX = Math.floor(topLeft.x / step) * step;
  const maxX = Math.ceil(bottomRight.x / step) * step;
  const minY = Math.floor(bottomRight.y / step) * step;
  const maxY = Math.ceil(topLeft.y / step) * step;

  context.beginPath();
  context.strokeStyle = color;
  context.lineWidth = lineWidth;

  for (let x = minX; x <= maxX; x += step) {
    const screen = worldToScreen({ x, y: 0 });
    context.moveTo(screen.x, 0);
    context.lineTo(screen.x, canvasSize().height);
  }

  for (let y = minY; y <= maxY; y += step) {
    const screen = worldToScreen({ x: 0, y });
    context.moveTo(0, screen.y);
    context.lineTo(canvasSize().width, screen.y);
  }

  context.stroke();
}

function drawAxisLine(width, height) {
  const origin = worldToScreen({ x: 0, y: 0 });

  context.beginPath();
  context.strokeStyle = "#b8c4b2";
  context.lineWidth = 1.4;

  if (origin.x >= 0 && origin.x <= width) {
    context.moveTo(origin.x, 0);
    context.lineTo(origin.x, height);
  }

  if (origin.y >= 0 && origin.y <= height) {
    context.moveTo(0, origin.y);
    context.lineTo(width, origin.y);
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
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.strokeStyle = "#116c6d";
    context.lineWidth = 2.4;
    context.stroke();
  }
}

function drawPoints() {
  for (const point of state.points) {
    const screen = worldToScreen(point);
    const isSelected = point.id === state.selectedPointId;
    const isPending = point.id === state.pendingLinkPointId || point.id === state.measureStartPointId;

    context.beginPath();
    context.arc(screen.x, screen.y, POINT_RADIUS, 0, Math.PI * 2);
    context.fillStyle = "#e95f1a";
    context.fill();

    context.lineWidth = isSelected || isPending ? 4 : 2;
    context.strokeStyle = isPending ? "#116c6d" : isSelected ? "#2e7d32" : "#ffffff";
    context.stroke();
  }
}

function draw() {
  const size = canvasSize();
  context.clearRect(0, 0, size.width, size.height);
  drawGrid(size.width, size.height);
  drawLinks();
  drawPoints();
}

function render() {
  draw();
  renderDetails();
  renderAnalysis();
  renderStatus();
  renderModeButtons();
}

function renderStatus() {
  const scaleLabel = state.viewport.scale.toFixed(state.viewport.scale >= 1 ? 1 : 2);
  const modeLabel = {
    inspect: "選択",
    add: "登録",
    link: "接続",
    measure: "計測"
  }[state.mode];

  let extra = "";
  const pendingLink = findPoint(state.pendingLinkPointId);
  const pendingMeasure = findPoint(state.measureStartPointId);

  if (pendingLink) {
    extra = ` | 接続元: ${pendingLink.title}`;
  } else if (pendingMeasure) {
    extra = ` | 計測元: ${pendingMeasure.title}`;
  }

  elements.statusLine.value = `${modeLabel} | ${state.points.length}点 | ${state.links.length}線 | ${scaleLabel}px/m${extra}`;
}

function renderModeButtons() {
  for (const button of elements.modeButtons) {
    const isActive = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function renderDetails() {
  const point = findPoint(state.selectedPointId);
  const hasPoint = Boolean(point);

  elements.emptyDetails.hidden = hasPoint;
  elements.pointDetails.hidden = !hasPoint;
  elements.deletePointButton.hidden = !hasPoint;

  if (!point) {
    return;
  }

  elements.detailTitle.textContent = point.title;
  elements.detailCoords.textContent = `${formatNumber(point.x)} m, ${formatNumber(point.y)} m`;
  elements.detailCreated.textContent = formatDate(point.createdAt);
  elements.detailNote.textContent = point.note || "なし";

  if (point.photo) {
    elements.detailPhoto.hidden = false;
    elements.detailPhoto.src = point.photo;
    elements.detailPhoto.alt = point.photoName || point.title;
  } else {
    elements.detailPhoto.hidden = true;
    elements.detailPhoto.removeAttribute("src");
    elements.detailPhoto.alt = "";
  }
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

  elements.totalDistance.textContent = formatDistance(total);
  elements.longestDistance.textContent = formatDistance(longest);
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
      persistWorkspace();
      render();
    });

    row.append(text, remove);
    elements.linkList.append(row);
  }
}

function findPoint(id) {
  return state.points.find((point) => point.id === id) ?? null;
}

function findNearestPoint(screenPoint) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const point of state.points) {
    const screen = worldToScreen(point);
    const distance = Math.hypot(screen.x - screenPoint.x, screen.y - screenPoint.y);
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  }

  return nearestDistance <= POINT_RADIUS + 10 ? nearest : null;
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function formatDistance(distance) {
  if (!Number.isFinite(distance) || distance <= 0) {
    return "0 m";
  }

  if (distance < 1000) {
    return `${distance.toFixed(1)} m`;
  }

  return `${(distance / 1000).toFixed(2)} km`;
}

function formatNumber(value) {
  return Number(value).toLocaleString("ja-JP", {
    maximumFractionDigits: 1
  });
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

function setMode(mode) {
  state.mode = mode;
  state.pendingLinkPointId = null;
  state.measureStartPointId = null;

  if (mode === "add") {
    fillFormFromWorld({ x: state.viewport.x, y: state.viewport.y });
  }

  render();
}

function fillFormFromWorld(point) {
  elements.pointX.value = point.x.toFixed(1);
  elements.pointY.value = point.y.toFixed(1);
}

function selectPoint(pointId) {
  state.selectedPointId = pointId;
  render();
}

function handleCanvasClick(screenPoint) {
  const nearest = findNearestPoint(screenPoint);
  const world = screenToWorld(screenPoint);

  if (state.mode === "add") {
    fillFormFromWorld(world);
    elements.pointTitle.focus();
    renderStatus();
    return;
  }

  if (!nearest) {
    state.selectedPointId = null;
    render();
    return;
  }

  if (state.mode === "link") {
    handleLinkPoint(nearest);
    return;
  }

  if (state.mode === "measure") {
    handleMeasurePoint(nearest);
    return;
  }

  selectPoint(nearest.id);
}

function handleLinkPoint(point) {
  if (!state.pendingLinkPointId) {
    state.pendingLinkPointId = point.id;
    state.selectedPointId = point.id;
    render();
    return;
  }

  if (state.pendingLinkPointId === point.id) {
    state.pendingLinkPointId = null;
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
  state.selectedPointId = point.id;
  render();
}

function handleMeasurePoint(point) {
  if (!state.measureStartPointId) {
    state.measureStartPointId = point.id;
    state.selectedPointId = point.id;
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
  state.selectedPointId = point.id;
  render();
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
  if (state.points.length === 0) {
    state.viewport.x = 0;
    state.viewport.y = 0;
    state.viewport.scale = 1;
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
  const spanX = Math.max(80, maxX - minX);
  const spanY = Math.max(80, maxY - minY);
  const scaleX = (size.width - 100) / spanX;
  const scaleY = (size.height - 100) / spanY;

  state.viewport.x = (minX + maxX) / 2;
  state.viewport.y = (minY + maxY) / 2;
  state.viewport.scale = clampScale(Math.min(scaleX, scaleY));
  render();
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

  const x = Number.parseFloat(elements.pointX.value);
  const y = Number.parseFloat(elements.pointY.value);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    elements.statusLine.value = "座標エラー";
    return;
  }

  const file = elements.pointPhoto.files[0] ?? null;
  const photo = file ? await readPhoto(file) : null;
  const createdAt = new Date().toISOString();
  const fallbackTitle = `Point ${state.points.length + 1}`;

  const point = {
    id: createId(),
    x,
    y,
    title: elements.pointTitle.value.trim() || fallbackTitle,
    note: elements.pointNote.value.trim(),
    photo,
    photoName: file?.name ?? "",
    geo: state.pendingGeo,
    createdAt
  };

  state.points.push(point);
  state.selectedPointId = point.id;
  state.pendingGeo = null;
  elements.pointForm.reset();
  fillFormFromWorld({ x: state.viewport.x, y: state.viewport.y });
  persistWorkspace();
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
  if (!("geolocation" in navigator)) {
    elements.statusLine.value = "現在地を取得できません";
    return;
  }

  elements.useLocationButton.disabled = true;
  elements.useLocationButton.textContent = "取得中";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const geo = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      };

      if (!state.origin) {
        state.origin = {
          lat: geo.lat,
          lng: geo.lng,
          createdAt: new Date().toISOString()
        };
      }

      const projected = projectGeoToGrid(geo);
      state.pendingGeo = geo;
      fillFormFromWorld(projected);
      persistWorkspace();
      elements.useLocationButton.disabled = false;
      elements.useLocationButton.textContent = "現在地";
      renderStatus();
    },
    () => {
      elements.statusLine.value = "現在地エラー";
      elements.useLocationButton.disabled = false;
      elements.useLocationButton.textContent = "現在地";
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000
    }
  );
}

function projectGeoToGrid(geo) {
  const origin = state.origin;
  const latRadians = (origin.lat * Math.PI) / 180;

  return {
    x: (geo.lng - origin.lng) * 111320 * Math.cos(latRadians),
    y: (geo.lat - origin.lat) * 111320
  };
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

      state.version = parsed.version ?? 1;
      state.origin = parsed.origin ?? null;
      state.points = parsed.points;
      state.links = parsed.links;
      state.selectedPointId = null;
      state.pendingLinkPointId = null;
      state.measureStartPointId = null;
      state.measureResult = null;
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

  state.origin = null;
  state.points = [];
  state.links = [];
  state.selectedPointId = null;
  state.pendingLinkPointId = null;
  state.measureStartPointId = null;
  state.measureResult = null;
  localStorage.removeItem(STORAGE_KEY);
  render();
}

function deleteSelectedPoint() {
  const point = findPoint(state.selectedPointId);
  if (!point) {
    return;
  }

  const confirmed = window.confirm("選択地点を削除しますか。");
  if (!confirmed) {
    return;
  }

  state.points = state.points.filter((item) => item.id !== point.id);
  state.links = state.links.filter((link) => link.a !== point.id && link.b !== point.id);
  state.selectedPointId = null;
  state.pendingLinkPointId = state.pendingLinkPointId === point.id ? null : state.pendingLinkPointId;
  state.measureStartPointId = state.measureStartPointId === point.id ? null : state.measureStartPointId;
  persistWorkspace();
  render();
}

function bindEvents() {
  window.addEventListener("resize", resizeCanvas);

  for (const button of elements.modeButtons) {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  }

  elements.pointForm.addEventListener("submit", submitPoint);
  elements.useCenterButton.addEventListener("click", () => {
    state.pendingGeo = null;
    fillFormFromWorld({ x: state.viewport.x, y: state.viewport.y });
  });
  elements.useLocationButton.addEventListener("click", useCurrentLocation);
  elements.zoomInButton.addEventListener("click", () => zoomAt({ x: canvasSize().width / 2, y: canvasSize().height / 2 }, 1.25));
  elements.zoomOutButton.addEventListener("click", () => zoomAt({ x: canvasSize().width / 2, y: canvasSize().height / 2 }, 0.8));
  elements.fitButton.addEventListener("click", fitToPoints);
  elements.originButton.addEventListener("click", () => {
    state.viewport.x = 0;
    state.viewport.y = 0;
    render();
  });
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
fillFormFromWorld({ x: state.viewport.x, y: state.viewport.y });
render();
