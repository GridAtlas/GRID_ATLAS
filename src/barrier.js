const DAY_MS = 24 * 60 * 60 * 1000;

export const BARRIER_CONFIG = Object.freeze({
  dataZoom: 18,
  dailyGrant: 3,
  stockCap: 20,
  accuracyThresholdMeters: 100
});

export function createBarrierLog(now = Date.now()) {
  return {
    type: "barrier-log",
    schemaVersion: 1,
    stones: {},
    barriers: {},
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

export function sanitizeBarrierLog(raw, now = Date.now()) {
  if (!raw || typeof raw !== "object") {
    return { log: createBarrierLog(now), changed: true };
  }

  const isBarrierLog = raw.type === "barrier-log" && raw.schemaVersion === 1;
  const isLegacyLog = raw.type === "traverse-log" && [1, 2].includes(raw.schemaVersion);
  if (!isBarrierLog && !isLegacyLog) {
    return { log: createBarrierLog(now), changed: true };
  }

  const sourceStock = raw.stock && typeof raw.stock === "object" ? raw.stock : {};
  const amount = Number.isFinite(Number(sourceStock.amount))
    ? Math.min(BARRIER_CONFIG.stockCap, Math.max(0, Math.floor(Number(sourceStock.amount))))
    : BARRIER_CONFIG.dailyGrant;
  const parsedLastGrantAt = Date.parse(sourceStock.lastGrantAt);
  const lastGrantAt = Number.isFinite(parsedLastGrantAt) ? parsedLastGrantAt : now;
  const stones = isLegacyLog
    ? normalizeLegacyStones(raw.tiles, now)
    : normalizeStones(raw.stones, now);
  const barriers = normalizeBarriers(raw.barriers, stones, now);
  const log = {
    type: "barrier-log",
    schemaVersion: 1,
    stones,
    barriers,
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
  if (!Number.isFinite(lastGrantAt) || now <= lastGrantAt) return false;
  const days = Math.floor((now - lastGrantAt) / DAY_MS);
  if (days < 1) return false;

  log.stock.amount = Math.min(
    BARRIER_CONFIG.stockCap,
    Math.max(0, Math.floor(Number(log.stock.amount) || 0)) + days * BARRIER_CONFIG.dailyGrant
  );
  log.stock.lastGrantAt = new Date(lastGrantAt + days * DAY_MS).toISOString();
  return true;
}

export function validateBarrierVertices(log, vertices) {
  if (!Array.isArray(vertices) || vertices.length < 3) {
    return { ok: false, reason: "too-few" };
  }
  if (new Set(vertices).size !== vertices.length) {
    return { ok: false, reason: "duplicate" };
  }
  if (vertices.some((stoneId) => !log?.stones?.[stoneId])) {
    return { ok: false, reason: "missing" };
  }
  const usedStoneIds = new Set(Object.values(log.barriers || {}).flatMap((barrier) => barrier.vertices || []));
  const usedStoneId = vertices.find((stoneId) => usedStoneIds.has(stoneId));
  if (usedStoneId) {
    return { ok: false, reason: "used", stoneId: usedStoneId };
  }
  return { ok: true };
}

export function registerBarrier(log, barrier) {
  const validation = validateBarrierVertices(log, barrier?.vertices);
  if (!validation.ok) return validation;
  if (!barrier?.id || typeof barrier.id !== "string") {
    return { ok: false, reason: "missing-id" };
  }
  log.barriers[barrier.id] = {
    name: typeof barrier.name === "string" ? barrier.name : "",
    vertices: [...barrier.vertices],
    createdAt: typeof barrier.createdAt === "string" ? barrier.createdAt : new Date().toISOString()
  };
  return { ok: true, barrier: log.barriers[barrier.id] };
}

export function parseTileId(tileId) {
  if (typeof tileId !== "string") return null;
  const parts = tileId.split("/").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return null;
  const [z, x, y] = parts;
  const scale = 2 ** z;
  if (z < 0 || z > 24 || x < 0 || x >= scale || y < 0 || y >= scale) return null;
  return { z, x, y };
}

export function formatTileId(x, y, z = BARRIER_CONFIG.dataZoom) {
  return `${z}/${x}/${y}`;
}

export function tileIdFromGeo(geo, zoom = BARRIER_CONFIG.dataZoom) {
  const lat = Math.max(-85.05112878, Math.min(85.05112878, Number(geo?.lat)));
  const lng = Number(geo?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const scale = 2 ** zoom;
  const normalizedLng = ((((lng + 180) % 360) + 360) % 360) - 180;
  const latRadians = (lat * Math.PI) / 180;
  const x = Math.floor(((normalizedLng + 180) / 360) * scale);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRadians) + 1 / Math.cos(latRadians)) / Math.PI) / 2) * scale
  );
  return formatTileId(Math.max(0, Math.min(scale - 1, x)), Math.max(0, Math.min(scale - 1, y)), zoom);
}

export function tileBounds(tileId) {
  const parsed = parseTileId(tileId);
  if (!parsed) return null;
  const scale = 2 ** parsed.z;
  const west = (parsed.x / scale) * 360 - 180;
  const east = ((parsed.x + 1) / scale) * 360 - 180;
  const north = tileYToLatitude(parsed.y, scale);
  const south = tileYToLatitude(parsed.y + 1, scale);
  return { west, east, north, south, z: parsed.z, x: parsed.x, y: parsed.y };
}

export function tileCenterGeo(tileId) {
  const bounds = tileBounds(tileId);
  if (!bounds) return null;
  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.west + bounds.east) / 2
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
    const count = normalizeCount(stone.count);
    if (!stoneId || count < 1) continue;
    stones[stoneId] = normalizeStone(stoneId, tileId, count, stone, now);
  }
  return stones;
}

function normalizeStone(stoneId, tileId, count, source, now) {
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
    count,
    firstAt,
    lastAt
  };
}

function normalizeBarriers(rawBarriers, stones, now) {
  const barriers = {};
  const usedStoneIds = new Set();
  if (!rawBarriers || typeof rawBarriers !== "object" || Array.isArray(rawBarriers)) return barriers;
  for (const [barrierId, rawBarrier] of Object.entries(rawBarriers)) {
    if (!rawBarrier || typeof rawBarrier !== "object") continue;
    const vertices = Array.isArray(rawBarrier.vertices) ? rawBarrier.vertices.filter((id) => typeof id === "string") : [];
    if (vertices.length < 3 || new Set(vertices).size !== vertices.length) continue;
    if (vertices.some((stoneId) => !stones[stoneId] || usedStoneIds.has(stoneId))) continue;
    const createdAt = typeof rawBarrier.createdAt === "string" && Number.isFinite(Date.parse(rawBarrier.createdAt))
      ? rawBarrier.createdAt
      : new Date(now).toISOString();
    barriers[barrierId] = {
      name: typeof rawBarrier.name === "string" ? rawBarrier.name : "",
      vertices,
      createdAt
    };
    vertices.forEach((stoneId) => usedStoneIds.add(stoneId));
  }
  return barriers;
}

function normalizeCount(value) {
  return Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
}

function tileYToLatitude(y, scale) {
  return (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale))) * 180) / Math.PI;
}
