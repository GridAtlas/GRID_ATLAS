const DAY_MS = 24 * 60 * 60 * 1000;

export const BARRIER_CONFIG = Object.freeze({
  dataZoom: 18,
  dailyGrant: 3,
  stockCap: 20,
  accuracyThresholdMeters: 100,
  guardianEnabled: true,
  guardianLabelInImage: false
});

export const BARRIER_LOG_SCHEMA_VERSION = 2;

export function createBarrierLog(now = Date.now()) {
  return {
    type: "barrier-log",
    schemaVersion: BARRIER_LOG_SCHEMA_VERSION,
    stones: {},
    barriers: {},
    events: [],
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

  const isBarrierLog = raw.type === "barrier-log" && [1, BARRIER_LOG_SCHEMA_VERSION].includes(raw.schemaVersion);
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
    createdAt: typeof barrier.createdAt === "string" ? barrier.createdAt : new Date().toISOString(),
    guardian: normalizeGuardian(barrier.guardian, barrier.createdAt)
  };
  appendBarrierEvent(log, {
    type: "barrier-created",
    at: log.barriers[barrier.id].createdAt,
    barrierId: barrier.id,
    name: log.barriers[barrier.id].name,
    vertices: [...log.barriers[barrier.id].vertices],
    guardian: log.barriers[barrier.id].guardian
  });
  return { ok: true, barrier: log.barriers[barrier.id] };
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
          name: typeof barrier.name === "string" ? barrier.name : "",
          vertices: Array.isArray(barrier.vertices) ? [...barrier.vertices] : [],
          createdAt: typeof barrier.createdAt === "string" ? barrier.createdAt : event.at
        };
      }
      continue;
    }
    if (event.type === "barrier-created" && typeof event.barrierId === "string") {
      barriers[event.barrierId] = {
        name: typeof event.name === "string" ? event.name : "",
        vertices: Array.isArray(event.vertices) ? [...event.vertices] : [],
        createdAt: event.at,
        guardian: normalizeGuardian(event.guardian, event.at)
      };
      continue;
    }
    if (event.type === "guardian-placed" && typeof event.barrierId === "string") {
      if (barriers[event.barrierId]) barriers[event.barrierId].guardian = normalizeGuardian(event.guardian, event.at);
      continue;
    }
    if (event.type === "guardian-label-updated" && typeof event.barrierId === "string") {
      if (barriers[event.barrierId]?.guardian) barriers[event.barrierId].guardian.label = typeof event.label === "string" ? event.label.slice(0, 120) : "";
      continue;
    }
    if (event.type === "guardian-removed" && typeof event.barrierId === "string") {
      if (barriers[event.barrierId]) barriers[event.barrierId].guardian = null;
      continue;
    }
    if (!event.tile || !event.stoneId) continue;
    const stone = stones[event.stoneId] || {
      tile: event.tile,
      lat: null,
      lng: null,
      count: 0,
      firstAt: event.at,
      lastAt: event.at
    };
    if (event.type === "stone-placed") {
      stone.count += Math.max(1, Number(event.amount) || 1);
      stone.firstAt ||= event.at;
      stone.lastAt = event.at;
      stones[event.stoneId] = stone;
    } else if (event.type === "stone-picked") {
      stone.count = Math.max(0, stone.count - Math.max(1, Number(event.amount) || 1));
      stone.lastAt = event.at;
      if (stone.count > 0) stones[event.stoneId] = stone;
      else delete stones[event.stoneId];
    }
  }
  return { stones, barriers };
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
      vertices,
      guardian: normalizeGuardian(event.guardian, at)
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
  if (![
    "stone-placed",
    "stone-picked"
  ].includes(event.type)) return null;
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
    amount: Math.max(1, Math.floor(Number(event.amount) || 1))
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
    const vertices = Array.isArray(barrier.vertices) ? barrier.vertices.filter((value) => typeof value === "string") : [];
    if (vertices.length < 3 || new Set(vertices).size !== vertices.length) return [];
    const createdAt = typeof barrier.createdAt === "string" && Number.isFinite(Date.parse(barrier.createdAt))
      ? barrier.createdAt
      : new Date(now).toISOString();
    return [[barrierId, {
      name: typeof barrier.name === "string" ? barrier.name : "",
      vertices,
      createdAt,
      guardian: normalizeGuardian(barrier.guardian, createdAt)
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
      vertices: [...barrier.vertices],
      createdAt: barrier.createdAt,
      guardian: barrier.guardian
    }]))
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
      createdAt,
      guardian: normalizeGuardian(rawBarrier.guardian, createdAt)
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
