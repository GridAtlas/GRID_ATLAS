const STOCK_GRANT_HOURS = Object.freeze([4, 12, 20]);

export const BARRIER_CONFIG = Object.freeze({
  dataZoom: 18,
  maxVertices: 8,
  maxVerticesByRank: Object.freeze([3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 6, 6, 6, 8, 8]),
  perimeterLimitKm: Object.freeze([6, 9, 12, 16, 20, 24, 32, 40, 48, 60, 120, 240, 720, 1200, 1800]),
  kekkaishiLifetimeThresholds: Object.freeze([0, 100, 400, 800, 1600, 3600, 8000, 14000, 23000, 40000, 160000, 800000, 4000000, 20000000, 100000000]),
  kekkaishiRankNames: Object.freeze(["F3", "F2", "F1", "E3", "E2", "E1", "D3", "D2", "D1", "C", "B", "A", "S", "SS", "SSS"]),
  crossLinkFromRank: 11,
  dailyGrant: 3,
  stockGrantHours: STOCK_GRANT_HOURS,
  stockCapByRank: Object.freeze([20, 20, 20, 20, 30, 30, 30, 40, 40, 40, 60, 80, 100, 200, 300]),
  stoneCapVertex: 100,
  stoneCapVertexByRank: Object.freeze([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 200, 300]),
  stoneCapLoose: 20,
  ryumyakuScatter: Object.freeze([0.15, 0.15, 0.14, 0.14, 0.13, 0.13, 0.12, 0.12, 0.11, 0.09, 0.07, 0.06, 0.05, 0.05, 0.05]),
  rotationFromRank: 0,
  windowDays: 90,
  weatherRate: 0.001,
  accuracyThresholdMeters: 100,
  // Guardian fields remain accepted in old snapshots/events for migration,
  // but are no longer active in the current scoring or UI.
});

export const BARRIER_LOG_SCHEMA_VERSION = 3;

const WEB_MERCATOR_HALF_WORLD = Math.PI;
const ROTATED_CELL_AXIS = Math.SQRT1_2;

export function createBarrierLog(now = Date.now()) {
  const startedAt = new Date(now).toISOString();
  return {
    type: "barrier-log",
    schemaVersion: BARRIER_LOG_SCHEMA_VERSION,
    stones: {},
    barriers: {},
    events: [],
    kekkaishi: {
      lifetimeOutput: 0,
      dailyHistory: Array(BARRIER_CONFIG.windowDays).fill(0),
      peakAverage: 0,
      peakAchievedAt: "",
      lastEvaluatedAt: new Date(now).toISOString(),
      lastDailyPower: 0,
      kekkaiCreatedCount: 0,
      startedAt,
      rankAchievedAt: [startedAt]
    },
    stock: {
      amount: BARRIER_CONFIG.dailyGrant,
      lastGrantAt: new Date(now).toISOString()
    }
  };
}

export function stoneIdFromTile(tileId) {
  const parsed = parseTileId(tileId);
  return parsed ? `stone-${formatTileId(parsed.x, parsed.y, parsed.z)}` : null;
}

export function barrierFigureId(barrierId) {
  return typeof barrierId === "string" && barrierId ? `barrier-figure-${barrierId}` : null;
}

export function barrierStoneIds(barrier) {
  const ids = Array.isArray(barrier?.stoneIds)
    ? barrier.stoneIds
    : Array.isArray(barrier?.vertices) ? barrier.vertices : [];
  return ids.filter((value) => typeof value === "string");
}

export function sanitizeBarrierLog(raw, now = Date.now()) {
  if (!raw || typeof raw !== "object") {
    return { log: createBarrierLog(now), changed: true };
  }

  const isBarrierLog = raw.type === "barrier-log" && [1, 2, BARRIER_LOG_SCHEMA_VERSION].includes(raw.schemaVersion);
  const isLegacyLog = raw.type === "traverse-log" && [1, 2].includes(raw.schemaVersion);
  if (!isBarrierLog && !isLegacyLog) {
    return { log: createBarrierLog(now), changed: true };
  }

  const sourceStock = raw.stock && typeof raw.stock === "object" ? raw.stock : {};
  const stockCap = stockCapForLifetime(raw?.kekkaishi?.lifetimeOutput);
  const amount = Number.isFinite(Number(sourceStock.amount))
    ? Math.min(stockCap, Math.max(0, Math.floor(Number(sourceStock.amount))))
    : BARRIER_CONFIG.dailyGrant;
  const parsedLastGrantAt = Date.parse(sourceStock.lastGrantAt);
  const lastGrantAt = Number.isFinite(parsedLastGrantAt) ? parsedLastGrantAt : now;
  let stones = isLegacyLog
    ? normalizeLegacyStones(raw.tiles, now)
    : normalizeStones(raw.stones, now);
  let barriers = normalizeBarriers(raw.barriers, stones, now);
  const events = normalizeEvents(raw.events, { stones, barriers, now });
  if (!isLegacyLog && events.length > 0) {
    const replayed = replayBarrierEvents(events);
    stones = replayed.stones;
    barriers = replayed.barriers;
  }
  if (events.length === 0 && (Object.keys(stones).length > 0 || Object.keys(barriers).length > 0)) {
    events.push(createMigrationSnapshotEvent(stones, barriers, now));
  }
  const log = {
    type: "barrier-log",
    schemaVersion: BARRIER_LOG_SCHEMA_VERSION,
    stones,
    barriers,
    events,
    kekkaishi: raw.kekkaishi && typeof raw.kekkaishi === "object" ? raw.kekkaishi : undefined,
    stock: {
      amount,
      lastGrantAt: new Date(lastGrantAt).toISOString()
    }
  };
  const granted = grantBarrierStock(log, now);
  return { log, changed: granted || JSON.stringify(raw) !== JSON.stringify(log) };
}

export function grantBarrierStock(log, now = Date.now()) {
  const lastGrantAt = Date.parse(log.stock.lastGrantAt);
  if (!Number.isFinite(lastGrantAt)) return false;
  const grantTimes = barrierStockGrantTimes(lastGrantAt, now);
  if (grantTimes.length === 0) return false;

  log.stock.amount = Math.min(
    stockCapForLifetime(log?.kekkaishi?.lifetimeOutput),
    Math.max(0, Math.floor(Number(log.stock.amount) || 0)) + grantTimes.length
  );
  log.stock.lastGrantAt = new Date(grantTimes[grantTimes.length - 1]).toISOString();
  return true;
}

export function stockCapForRank(rankIndex = 0) {
  const index = Math.max(0, Math.min(BARRIER_CONFIG.stockCapByRank.length - 1, Math.floor(Number(rankIndex) || 0)));
  return Number(BARRIER_CONFIG.stockCapByRank[index]) || BARRIER_CONFIG.stockCapByRank[0];
}

export function stockCapForLifetime(lifetimeOutput = 0) {
  let rankIndex = 0;
  for (let index = 0; index < BARRIER_CONFIG.kekkaishiLifetimeThresholds.length; index += 1) {
    if (Number(lifetimeOutput) >= BARRIER_CONFIG.kekkaishiLifetimeThresholds[index]) rankIndex = index;
  }
  return stockCapForRank(rankIndex);
}

function barrierStockGrantTimes(afterAt, throughAt) {
  if (!Number.isFinite(afterAt) || !Number.isFinite(throughAt) || throughAt <= afterAt) return [];
  const start = new Date(afterAt);
  const end = new Date(throughAt);
  const firstDay = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1);
  const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
  const grantTimes = [];

  for (const day = new Date(firstDay); day <= lastDay; day.setDate(day.getDate() + 1)) {
    for (const hour of BARRIER_CONFIG.stockGrantHours) {
      const grantAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0, 0).getTime();
      if (grantAt > afterAt && grantAt <= throughAt) grantTimes.push(grantAt);
    }
  }
  return grantTimes.sort((left, right) => left - right);
}

export function validateBarrierVertices(log, vertices, options = {}) {
  if (!Array.isArray(vertices) || vertices.length < 3) {
    return { ok: false, reason: "too-few" };
  }
  const maxVertices = Math.min(
    BARRIER_CONFIG.maxVertices,
    Math.max(3, Number(options.maxVertices) || BARRIER_CONFIG.maxVertices)
  );
  if (vertices.length > maxVertices) {
    return { ok: false, reason: "too-many", maxVertices };
  }
  if (new Set(vertices).size !== vertices.length) {
    return { ok: false, reason: "duplicate" };
  }
  if (vertices.some((stoneId) => !log?.stones?.[stoneId])) {
    return { ok: false, reason: "missing" };
  }
  const usedStoneIds = new Set(Object.values(log.barriers || {}).flatMap((barrier) => barrierStoneIds(barrier)));
  const usedStoneId = vertices.find((stoneId) => usedStoneIds.has(stoneId));
  if (usedStoneId) {
    return { ok: false, reason: "used", stoneId: usedStoneId };
  }
  return { ok: true };
}

export function stoneCapFor(log, stoneId, rankIndex = 0) {
  const isVertex = Object.values(log?.barriers || {}).some((barrier) => barrierStoneIds(barrier).includes(stoneId));
  if (!isVertex) return BARRIER_CONFIG.stoneCapLoose;
  const index = Math.max(0, Math.min(BARRIER_CONFIG.stoneCapVertexByRank.length - 1, Math.floor(Number(rankIndex) || 0)));
  return Number(BARRIER_CONFIG.stoneCapVertexByRank[index]) || BARRIER_CONFIG.stoneCapVertex;
}

export function maxVerticesForRank(rankIndex = 0) {
  const index = Math.max(0, Math.min(BARRIER_CONFIG.maxVerticesByRank.length - 1, Math.floor(Number(rankIndex) || 0)));
  return Number(BARRIER_CONFIG.maxVerticesByRank[index]) || BARRIER_CONFIG.maxVertices;
}

export function perimeterLimitKmForRank(rankIndex = 0) {
  const index = Math.max(0, Math.min(BARRIER_CONFIG.perimeterLimitKm.length - 1, Math.floor(Number(rankIndex) || 0)));
  return Number(BARRIER_CONFIG.perimeterLimitKm[index]) || BARRIER_CONFIG.perimeterLimitKm[0];
}

export function ryumyakuScatterForRank(rankIndex = 0) {
  const index = Math.max(0, Math.min(BARRIER_CONFIG.ryumyakuScatter.length - 1, Math.floor(Number(rankIndex) || 0)));
  return Number(BARRIER_CONFIG.ryumyakuScatter[index]) || BARRIER_CONFIG.ryumyakuScatter[0];
}

export function stoneExactCount(stone) {
  const value = Number(stone?.countExact ?? stone?.count);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function stoneDisplayCount(stone) {
  return Math.floor(stoneExactCount(stone));
}

export function registerBarrier(log, barrier) {
  const validation = validateBarrierVertices(log, barrier?.vertices, { maxVertices: barrier?.maxVertices });
  if (!validation.ok) return validation;
  if (!barrier?.id || typeof barrier.id !== "string") {
    return { ok: false, reason: "missing-id" };
  }
  const createdAt = typeof barrier.createdAt === "string" ? barrier.createdAt : new Date().toISOString();
  const rankProgress = normalizeRankProgress(barrier.rankProgress);
  const figureId = typeof barrier.figureId === "string" && barrier.figureId
    ? barrier.figureId
    : barrierFigureId(barrier.id);
  log.barriers[barrier.id] = {
    figureId,
    name: typeof barrier.name === "string" ? barrier.name : "",
    note: typeof barrier.note === "string" ? barrier.note.slice(0, 500) : "",
    stoneIds: [...barrier.vertices],
    linkPattern: typeof barrier.linkPattern === "string" ? barrier.linkPattern : "adjacent",
    skip: Math.max(1, Math.floor(Number(barrier.skip) || 1)),
    createdAt,
    guardian: normalizeGuardian(barrier.guardian, createdAt),
    rankProgress
  };
  if (log.kekkaishi && typeof log.kekkaishi === "object") {
    log.kekkaishi.kekkaiCreatedCount = Math.max(0, Math.floor(Number(log.kekkaishi.kekkaiCreatedCount) || 0)) + 1;
  }
  appendBarrierEvent(log, {
    type: "barrier-created",
    at: log.barriers[barrier.id].createdAt,
    barrierId: barrier.id,
    name: log.barriers[barrier.id].name,
    note: log.barriers[barrier.id].note,
    vertices: [...log.barriers[barrier.id].stoneIds],
    linkPattern: log.barriers[barrier.id].linkPattern,
    skip: log.barriers[barrier.id].skip,
    guardian: log.barriers[barrier.id].guardian,
    rankProgress: log.barriers[barrier.id].rankProgress
  });
  return { ok: true, barrier: log.barriers[barrier.id] };
}

export function dissolveBarrier(log, barrierId, at = Date.now()) {
  const barrier = log?.barriers?.[barrierId];
  if (!barrier) return { ok: false, reason: "missing" };

  delete log.barriers[barrierId];
  appendBarrierEvent(log, {
    type: "barrier-dissolved",
    at: new Date(at).toISOString(),
    barrierId
  });
  return { ok: true, barrier };
}

export function appendBarrierEvent(log, event) {
  if (!log || typeof log !== "object") return null;
  if (!Array.isArray(log.events)) log.events = [];
  const normalized = normalizeEvent(event, Date.now());
  if (!normalized) return null;
  log.events.push(normalized);
  return normalized;
}

export function normalizeGuardian(rawGuardian, fallbackAt = Date.now()) {
  if (!rawGuardian || typeof rawGuardian !== "object") return null;
  const lat = Number(rawGuardian.lat);
  const lng = Number(rawGuardian.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  const fallback = typeof fallbackAt === "string" && Number.isFinite(Date.parse(fallbackAt))
    ? fallbackAt
    : new Date(fallbackAt).toISOString();
  const placedAt = typeof rawGuardian.placedAt === "string" && Number.isFinite(Date.parse(rawGuardian.placedAt))
    ? rawGuardian.placedAt
    : fallback;
  return {
    lat,
    lng,
    label: typeof rawGuardian.label === "string" ? rawGuardian.label.slice(0, 120) : "",
    placedAt
  };
}

function normalizeRankProgress(rawProgress) {
  const activeDays = Array.from({ length: 8 }, (_, index) => Math.max(0, Number(rawProgress?.activeDays?.[index]) || 0));
  return {
    activeDays,
    lastPower: rawProgress && rawProgress.lastPower !== null && rawProgress.lastPower !== undefined
      ? Math.max(0, Number(rawProgress.lastPower) || 0)
      : null
  };
}

export function replayBarrierEvents(events) {
  const stones = {};
  const barriers = {};
  for (const event of Array.isArray(events) ? events : []) {
    if (!event || typeof event !== "object") continue;
    if (event.type === "barrier-snapshot") {
      for (const stone of Array.isArray(event.stones) ? event.stones : []) {
        const normalized = normalizeStones({ [stone.stoneId || stoneIdFromTile(stone.tile)]: stone }, Date.parse(event.at) || Date.now());
        const [stoneId, value] = Object.entries(normalized)[0] || [];
        if (stoneId && value) stones[stoneId] = value;
      }
      for (const [barrierId, barrier] of Object.entries(event.barriers || {})) {
        if (barrier && typeof barrier === "object") barriers[barrierId] = {
          figureId: typeof barrier.figureId === "string" ? barrier.figureId : barrierFigureId(barrierId),
          name: typeof barrier.name === "string" ? barrier.name : "",
          note: typeof barrier.note === "string" ? barrier.note.slice(0, 500) : "",
          stoneIds: barrierStoneIds(barrier),
          linkPattern: typeof barrier.linkPattern === "string" ? barrier.linkPattern : "adjacent",
          createdAt: typeof barrier.createdAt === "string" ? barrier.createdAt : event.at,
          guardian: normalizeGuardian(barrier.guardian, event.at),
          rankProgress: normalizeRankProgress(barrier.rankProgress)
        };
      }
      continue;
    }
    if (event.type === "barrier-created" && typeof event.barrierId === "string") {
      barriers[event.barrierId] = {
        figureId: barrierFigureId(event.barrierId),
        name: typeof event.name === "string" ? event.name : "",
        note: typeof event.note === "string" ? event.note.slice(0, 500) : "",
        stoneIds: Array.isArray(event.vertices) ? [...event.vertices] : [],
        linkPattern: typeof event.linkPattern === "string" ? event.linkPattern : "adjacent",
        createdAt: event.at,
        guardian: normalizeGuardian(event.guardian, event.at),
        rankProgress: normalizeRankProgress(event.rankProgress)
      };
      continue;
    }
    if (event.type === "barrier-dissolved" && typeof event.barrierId === "string") {
      delete barriers[event.barrierId];
      continue;
    }
    if (event.type === "barrier-memo-updated" && typeof event.barrierId === "string") {
      if (barriers[event.barrierId]) {
        barriers[event.barrierId].note = typeof event.note === "string" ? event.note.slice(0, 500) : "";
      }
      continue;
    }
    if (event.type === "guardian-placed" && typeof event.barrierId === "string") {
      // Legacy event: keep parsing it, but do not reactivate the retired field.
      continue;
    }
    if (event.type === "guardian-label-updated" && typeof event.barrierId === "string") {
      continue;
    }
    if (event.type === "guardian-removed" && typeof event.barrierId === "string") {
      continue;
    }
    if (!event.tile || !event.stoneId) continue;
    const stone = stones[event.stoneId] || {
      tile: event.tile,
      lat: null,
      lng: null,
      count: 0,
      countExact: 0,
      firstAt: event.at,
      lastAt: event.at
    };
    if (event.type === "stone-placed") {
      stone.countExact = stoneExactCount(stone) + Math.max(1, Number(event.amount) || 1);
      stone.count = Math.floor(stone.countExact);
      stone.firstAt ||= event.at;
      stone.lastAt = event.at;
      stones[event.stoneId] = stone;
    } else if (event.type === "stone-renamed") {
      if (stones[event.stoneId]) {
        stones[event.stoneId].name = typeof event.name === "string" ? event.name.slice(0, 80) : "";
      }
    } else if (event.type === "stone-memo-updated") {
      if (stones[event.stoneId]) {
        stones[event.stoneId].note = typeof event.note === "string" ? event.note.slice(0, 500) : "";
      }
    } else if (event.type === "stone-picked" || event.type === "stone-weathered") {
      if (Number.isFinite(Number(event.countExact))) {
        stone.countExact = Math.max(0, Number(event.countExact));
      } else {
        stone.countExact = Math.max(0, stoneExactCount(stone) - Math.max(1, Number(event.amount) || 1));
      }
      stone.count = Math.floor(stone.countExact);
      stone.lastAt = event.at;
      if (stone.countExact > 0) stones[event.stoneId] = stone;
      else delete stones[event.stoneId];
    }
  }
  const figures = Object.fromEntries(Object.entries(barriers).flatMap(([barrierId, barrier]) => {
    const vertices = barrierStoneIds(barrier)
      .map((stoneId) => {
        const geo = tileCenterGeo(stones[stoneId]?.tile);
        return geo ? {
          lat: geo.lat,
          lng: geo.lng,
          key: `geo:${geo.lat}:${geo.lng}`,
          name: "結界頂点",
          note: stones[stoneId]?.note || "",
          placeRef: null
        } : null;
      })
      .filter(Boolean);
    const figureId = barrier.figureId || barrierFigureId(barrierId);
    return figureId && vertices.length >= 3
      ? [[figureId, { id: figureId, vertices, note: barrier.note || "", layer: "barrier", barrierId, createdAt: barrier.createdAt }]]
      : [];
  }));
  return { stones, barriers, figures };
}

export function parseTileId(tileId) {
  if (typeof tileId !== "string") return null;
  const parts = tileId.split("/").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return null;
  const [z, x, y] = parts;
  if (z < 0 || z > 24) return null;
  return { z, x, y };
}

export function formatTileId(x, y, z = BARRIER_CONFIG.dataZoom) {
  return `${z}/${x}/${y}`;
}

export function tileIdFromGeo(geo, zoom = BARRIER_CONFIG.dataZoom) {
  const lat = Math.max(-85.05112878, Math.min(85.05112878, Number(geo?.lat)));
  const lng = Number(geo?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const cellSize = rotatedCellSize(zoom);
  const point = geoToMercator({ lat, lng });
  const u = (point.x - point.y) * ROTATED_CELL_AXIS;
  const v = (point.x + point.y) * ROTATED_CELL_AXIS;
  return formatTileId(Math.floor(u / cellSize), Math.floor(v / cellSize), zoom);
}

export function tileBounds(tileId) {
  const parsed = parseTileId(tileId);
  if (!parsed) return null;
  const corners = rotatedCellMercatorCorners(parsed).map(mercatorToGeo);
  const longitudes = corners.map((corner) => corner.lng);
  const latitudes = corners.map((corner) => corner.lat);
  return {
    west: Math.min(...longitudes),
    east: Math.max(...longitudes),
    north: Math.max(...latitudes),
    south: Math.min(...latitudes),
    corners,
    z: parsed.z,
    x: parsed.x,
    y: parsed.y
  };
}

export function tileCenterGeo(tileId) {
  const parsed = parseTileId(tileId);
  if (!parsed) return null;
  const cellSize = rotatedCellSize(parsed.z);
  const u = (parsed.x + 0.5) * cellSize;
  const v = (parsed.y + 0.5) * cellSize;
  return mercatorToGeo({
    x: (u + v) * ROTATED_CELL_AXIS,
    y: (v - u) * ROTATED_CELL_AXIS
  });
}

function rotatedCellSize(zoom) {
  return (WEB_MERCATOR_HALF_WORLD * 2) / (2 ** zoom);
}

function rotatedCellMercatorCorners({ x, y, z }) {
  const cellSize = rotatedCellSize(z);
  const u0 = x * cellSize;
  const v0 = y * cellSize;
  const u1 = u0 + cellSize;
  const v1 = v0 + cellSize;
  return [
    { x: (u0 + v0) * ROTATED_CELL_AXIS, y: (v0 - u0) * ROTATED_CELL_AXIS },
    { x: (u1 + v0) * ROTATED_CELL_AXIS, y: (v0 - u1) * ROTATED_CELL_AXIS },
    { x: (u1 + v1) * ROTATED_CELL_AXIS, y: (v1 - u1) * ROTATED_CELL_AXIS },
    { x: (u0 + v1) * ROTATED_CELL_AXIS, y: (v1 - u0) * ROTATED_CELL_AXIS }
  ];
}

function geoToMercator({ lat, lng }) {
  const latRadians = (lat * Math.PI) / 180;
  const normalizedLng = ((((lng + 180) % 360) + 360) % 360) - 180;
  return {
    x: (normalizedLng * Math.PI) / 180,
    y: Math.log(Math.tan(Math.PI / 4 + latRadians / 2))
  };
}

function mercatorToGeo({ x, y }) {
  return {
    lat: (Math.atan(Math.sinh(y)) * 180) / Math.PI,
    lng: (x * 180) / Math.PI
  };
}

function normalizeLegacyStones(rawTiles, now) {
  const stones = {};
  if (!rawTiles || typeof rawTiles !== "object" || Array.isArray(rawTiles)) return stones;
  for (const [rawTileId, tile] of Object.entries(rawTiles)) {
    const parsed = parseTileId(rawTileId);
    if (!parsed || !tile || typeof tile !== "object") continue;
    const tileId = formatTileId(parsed.x, parsed.y, parsed.z);
    const stoneId = stoneIdFromTile(tileId);
    if (!stoneId) continue;
    const count = normalizeCount(tile.count);
    if (count < 1) continue;
    stones[stoneId] = normalizeStone(stoneId, tileId, count, tile, now);
  }
  return stones;
}

function normalizeStones(rawStones, now) {
  const stones = {};
  if (!rawStones || typeof rawStones !== "object" || Array.isArray(rawStones)) return stones;
  for (const stone of Object.values(rawStones)) {
    if (!stone || typeof stone !== "object") continue;
    const parsed = parseTileId(stone.tile);
    if (!parsed) continue;
    const tileId = formatTileId(parsed.x, parsed.y, parsed.z);
    const stoneId = stoneIdFromTile(tileId);
    const countExact = normalizeExactCount(stone.countExact ?? stone.count);
    if (!stoneId || countExact <= 0) continue;
    stones[stoneId] = normalizeStone(stoneId, tileId, countExact, stone, now);
  }
  return stones;
}

function normalizeStone(stoneId, tileId, countExact, source, now) {
  const fallback = new Date(now).toISOString();
  const firstAt = typeof source.firstAt === "string" && Number.isFinite(Date.parse(source.firstAt))
    ? source.firstAt
    : fallback;
  const lastAt = typeof source.lastAt === "string" && Number.isFinite(Date.parse(source.lastAt))
    ? source.lastAt
    : firstAt;
  return {
    tile: tileId,
    lat: null,
    lng: null,
    name: typeof source.name === "string" ? source.name.slice(0, 80) : "",
    note: typeof source.note === "string" ? source.note.slice(0, 500) : "",
    countExact,
    count: Math.floor(countExact),
    firstAt,
    lastAt
  };
}

function normalizeEvents(rawEvents, context) {
  if (!Array.isArray(rawEvents)) return [];
  return rawEvents.map((event, index) => normalizeEvent(event, context.now, `barrier-event-${index + 1}`)).filter(Boolean);
}

function normalizeEvent(event, now, fallbackId = "") {
  if (!event || typeof event !== "object") return null;
  const at = typeof event.at === "string" && Number.isFinite(Date.parse(event.at))
    ? event.at
    : new Date(now).toISOString();
  const id = typeof event.id === "string" && event.id.trim()
    ? event.id
    : fallbackId || `barrier-event-${Date.parse(at)}-${Math.random().toString(36).slice(2, 8)}`;
  if (event.type === "barrier-snapshot") {
    return {
      id,
      type: "barrier-snapshot",
      at,
      stones: normalizeSnapshotStones(event.stones, now),
      barriers: normalizeSnapshotBarriers(event.barriers, now)
    };
  }
  if (event.type === "barrier-created") {
    const vertices = Array.isArray(event.vertices) ? event.vertices.filter((value) => typeof value === "string") : [];
    if (!event.barrierId || vertices.length < 3 || new Set(vertices).size !== vertices.length) return null;
    return {
      id,
      type: event.type,
      at,
      barrierId: String(event.barrierId),
      name: typeof event.name === "string" ? event.name : "",
      note: typeof event.note === "string" ? event.note.slice(0, 500) : "",
      vertices,
      linkPattern: typeof event.linkPattern === "string" ? event.linkPattern : "adjacent",
      guardian: normalizeGuardian(event.guardian, at),
      rankProgress: normalizeRankProgress(event.rankProgress)
    };
  }
  if (event.type === "barrier-dissolved") {
    if (!event.barrierId) return null;
    return { id, type: event.type, at, barrierId: String(event.barrierId) };
  }
  if (event.type === "barrier-memo-updated") {
    if (!event.barrierId) return null;
    return {
      id,
      type: event.type,
      at,
      barrierId: String(event.barrierId),
      note: typeof event.note === "string" ? event.note.slice(0, 500) : ""
    };
  }
  if (event.type === "stone-renamed") {
    const parsed = parseTileId(event.tile);
    const stoneId = stoneIdFromTile(event.tile);
    if (!parsed || !stoneId || event.stoneId !== stoneId) return null;
    return {
      id,
      type: event.type,
      at,
      tile: formatTileId(parsed.x, parsed.y, parsed.z),
      stoneId,
      name: typeof event.name === "string" ? event.name.slice(0, 80) : ""
    };
  }
  if (event.type === "stone-memo-updated") {
    const parsed = parseTileId(event.tile);
    const stoneId = stoneIdFromTile(event.tile);
    if (!parsed || !stoneId || event.stoneId !== stoneId) return null;
    return {
      id,
      type: event.type,
      at,
      tile: formatTileId(parsed.x, parsed.y, parsed.z),
      stoneId,
      note: typeof event.note === "string" ? event.note.slice(0, 500) : ""
    };
  }
  if (event.type === "barrier-spirit-settled") {
    if (!event.barrierId) return null;
    return {
      id,
      type: event.type,
      at,
      barrierId: String(event.barrierId),
      amount: Math.max(0, Number(event.amount) || 0),
      lifetimeOutput: Math.max(0, Number(event.lifetimeOutput) || 0)
    };
  }
  if (event.type === "guardian-placed") {
    const guardian = normalizeGuardian(event.guardian, at);
    if (!event.barrierId || !guardian) return null;
    return { id, type: event.type, at, barrierId: String(event.barrierId), guardian };
  }
  if (event.type === "guardian-label-updated") {
    if (!event.barrierId) return null;
    return { id, type: event.type, at, barrierId: String(event.barrierId), label: typeof event.label === "string" ? event.label.slice(0, 120) : "" };
  }
  if (event.type === "guardian-removed") {
    if (!event.barrierId) return null;
    return { id, type: event.type, at, barrierId: String(event.barrierId) };
  }
  if (event.type === "daily-evaluation") {
    const elapsedDays = Math.max(1, Math.floor(Number(event.elapsedDays) || 0));
    const evaluatedLastAt = typeof event.lastEvaluatedAt === "string" && Number.isFinite(Date.parse(event.lastEvaluatedAt))
      ? new Date(Date.parse(event.lastEvaluatedAt)).toISOString()
      : at;
    return {
      id,
      type: event.type,
      at,
      elapsedDays,
      lastEvaluatedAt: evaluatedLastAt,
      dailyPower: Math.max(0, Number(event.dailyPower) || 0),
      lifetimeOutput: Math.max(0, Number(event.lifetimeOutput) || 0)
    };
  }
  if (event.type === "evaluation-settings") {
    const arrays = ["powerThresholds", "daysRequired", "kekkaishiLifetimeThresholds"];
    if (arrays.some((key) => !Array.isArray(event[key]))) return null;
    return {
      id,
      type: event.type,
      at,
      weatherRate: Number(event.weatherRate),
      powerThresholds: event.powerThresholds.map((value) => Number(value)),
      daysRequired: event.daysRequired.map((value) => Number(value)),
      kekkaishiLifetimeThresholds: event.kekkaishiLifetimeThresholds.map((value) => Number(value)),
      windowDays: Number(event.windowDays),
      scaleL0: Number(event.scaleL0),
      shapeCoefficients: event.shapeCoefficients && typeof event.shapeCoefficients === "object"
        ? { ...event.shapeCoefficients }
        : {},
      stoneCapVertex: Number(event.stoneCapVertex),
      dailyGrant: Number(event.dailyGrant),
      maxVertices: Number(event.maxVertices),
      maxVerticesByRank: Array.isArray(event.maxVerticesByRank) ? event.maxVerticesByRank.map((value) => Number(value)) : [],
      perimeterLimitKm: Array.isArray(event.perimeterLimitKm)
        ? event.perimeterLimitKm.map((value) => Number(value))
        : Array.isArray(event.sightRadiusKm) ? event.sightRadiusKm.map((value) => Number(value)) : [],
      crossLinkFromRank: Number(event.crossLinkFromRank),
      stoneCapVertexByRank: Array.isArray(event.stoneCapVertexByRank) ? event.stoneCapVertexByRank.map((value) => Number(value)) : [],
      stockCapByRank: Array.isArray(event.stockCapByRank) ? event.stockCapByRank.map((value) => Number(value)) : [],
      ryumyakuScatter: Array.isArray(event.ryumyakuScatter) ? event.ryumyakuScatter.map((value) => Number(value)) : [],
      rotationFromRank: Number(event.rotationFromRank),
      beautyTolerance: Number(event.beautyTolerance),
      beautyToleranceTiles: Number(event.beautyToleranceTiles),
      beautyGamma: Number(event.beautyGamma)
    };
  }
  const stoneEventTypes = new Set(["stone-placed", "stone-picked", "stone-weathered"]);
  if (!stoneEventTypes.has(event.type)) return null;
  const parsed = parseTileId(event.tile);
  const stoneId = stoneIdFromTile(event.tile);
  if (!parsed || !stoneId || event.stoneId !== stoneId) return null;
  return {
    id,
    type: event.type,
    at,
    tile: formatTileId(parsed.x, parsed.y, parsed.z),
    stoneId,
    barrierId: typeof event.barrierId === "string" ? event.barrierId : null,
    amount: Math.max(1, Math.floor(Number(event.amount) || 1)),
    ...(Number.isFinite(Number(event.countExact))
      ? { countExact: Math.max(0, Number(event.countExact)) }
      : {})
  };
}

function normalizeSnapshotStones(rawStones, now) {
  if (!Array.isArray(rawStones)) return [];
  return rawStones.map((stone) => {
    if (!stone || typeof stone !== "object") return null;
    const tile = typeof stone.tile === "string" ? stone.tile : "";
    const stoneId = stoneIdFromTile(tile);
    const normalized = stoneId ? normalizeStones({ [stoneId]: stone }, now)[stoneId] : null;
    return normalized ? { stoneId, ...normalized } : null;
  }).filter(Boolean);
}

function normalizeSnapshotBarriers(rawBarriers, now) {
  if (!rawBarriers || typeof rawBarriers !== "object" || Array.isArray(rawBarriers)) return {};
  return Object.fromEntries(Object.entries(rawBarriers).flatMap(([barrierId, barrier]) => {
    if (!barrier || typeof barrier !== "object") return [];
    const vertices = barrierStoneIds(barrier);
    if (vertices.length < 3 || new Set(vertices).size !== vertices.length) return [];
    const createdAt = typeof barrier.createdAt === "string" && Number.isFinite(Date.parse(barrier.createdAt))
      ? barrier.createdAt
      : new Date(now).toISOString();
    return [[barrierId, {
      name: typeof barrier.name === "string" ? barrier.name : "",
      note: typeof barrier.note === "string" ? barrier.note.slice(0, 500) : "",
      figureId: typeof barrier.figureId === "string" ? barrier.figureId : barrierFigureId(barrierId),
      stoneIds: vertices,
      linkPattern: typeof barrier.linkPattern === "string" ? barrier.linkPattern : "adjacent",
      createdAt,
      guardian: normalizeGuardian(barrier.guardian, createdAt),
      rankProgress: normalizeRankProgress(barrier.rankProgress)
    }]];
  }));
}

function createMigrationSnapshotEvent(stones, barriers, now) {
  return {
    id: `barrier-snapshot-${now}`,
    type: "barrier-snapshot",
    at: new Date(now).toISOString(),
    stones: Object.entries(stones).map(([stoneId, stone]) => ({ stoneId, ...stone })),
    barriers: Object.fromEntries(Object.entries(barriers).map(([barrierId, barrier]) => [barrierId, {
      name: barrier.name,
      note: barrier.note,
      vertices: [...barrierStoneIds(barrier)],
      linkPattern: typeof barrier.linkPattern === "string" ? barrier.linkPattern : "adjacent",
      createdAt: barrier.createdAt,
      guardian: barrier.guardian,
      rankProgress: barrier.rankProgress
    }]))
  };
}

function normalizeBarriers(rawBarriers, stones, now) {
  const barriers = {};
  const usedStoneIds = new Set();
  if (!rawBarriers || typeof rawBarriers !== "object" || Array.isArray(rawBarriers)) return barriers;
  for (const [barrierId, rawBarrier] of Object.entries(rawBarriers)) {
    if (!rawBarrier || typeof rawBarrier !== "object") continue;
    const vertices = barrierStoneIds(rawBarrier);
    if (vertices.length < 3 || new Set(vertices).size !== vertices.length) continue;
    if (vertices.some((stoneId) => !stones[stoneId] || usedStoneIds.has(stoneId))) continue;
    const createdAt = typeof rawBarrier.createdAt === "string" && Number.isFinite(Date.parse(rawBarrier.createdAt))
      ? rawBarrier.createdAt
      : new Date(now).toISOString();
    barriers[barrierId] = {
      figureId: typeof rawBarrier.figureId === "string" ? rawBarrier.figureId : barrierFigureId(barrierId),
      name: typeof rawBarrier.name === "string" ? rawBarrier.name : "",
      note: typeof rawBarrier.note === "string" ? rawBarrier.note.slice(0, 500) : "",
      stoneIds: vertices,
      linkPattern: typeof rawBarrier.linkPattern === "string" ? rawBarrier.linkPattern : "adjacent",
      createdAt,
      guardian: normalizeGuardian(rawBarrier.guardian, createdAt),
      rankProgress: normalizeRankProgress(rawBarrier.rankProgress)
    };
    vertices.forEach((stoneId) => usedStoneIds.add(stoneId));
  }
  return barriers;
}

function normalizeCount(value) {
  return Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
}

function normalizeExactCount(value) {
  return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
}

function tileYToLatitude(y, scale) {
  return (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale))) * 180) / Math.PI;
}
