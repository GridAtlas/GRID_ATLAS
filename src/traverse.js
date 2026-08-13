const DAY_MS = 24 * 60 * 60 * 1000;

export const TRAVERSE_CONFIG = Object.freeze({
  dataZoom: 18,
  dailyGrant: 5,
  stockCap: 20,
  accuracyThresholdMeters: 100
});

export function createTraverseLog(now = Date.now()) {
  return {
    type: "traverse-log",
    schemaVersion: 2,
    tiles: {},
    tileOrder: [],
    stock: {
      amount: TRAVERSE_CONFIG.dailyGrant,
      lastGrantAt: new Date(now).toISOString()
    }
  };
}

export function sanitizeTraverseLog(raw, now = Date.now()) {
  if (!raw || typeof raw !== "object" || raw.type !== "traverse-log" || ![1, 2].includes(raw.schemaVersion)) {
    return { log: createTraverseLog(now), changed: true };
  }

  const sourceStock = raw.stock && typeof raw.stock === "object" ? raw.stock : {};
  const amount = Number.isFinite(Number(sourceStock.amount))
    ? Math.min(TRAVERSE_CONFIG.stockCap, Math.max(0, Math.floor(Number(sourceStock.amount))))
    : TRAVERSE_CONFIG.dailyGrant;
  const parsedLastGrantAt = Date.parse(sourceStock.lastGrantAt);
  const lastGrantAt = Number.isFinite(parsedLastGrantAt) ? parsedLastGrantAt : now;
  const tiles = {};

  if (raw.tiles && typeof raw.tiles === "object" && !Array.isArray(raw.tiles)) {
    for (const [tileId, tile] of Object.entries(raw.tiles)) {
      const parsed = parseTileId(tileId);
      if (!parsed || !tile || typeof tile !== "object") continue;
      const count = Number.isFinite(Number(tile.count)) ? Math.max(1, Math.floor(Number(tile.count))) : 0;
      if (count < 1) continue;
      const firstAt = typeof tile.firstAt === "string" && Number.isFinite(Date.parse(tile.firstAt))
        ? tile.firstAt
        : new Date(now).toISOString();
      const lastAt = typeof tile.lastAt === "string" && Number.isFinite(Date.parse(tile.lastAt))
        ? tile.lastAt
        : firstAt;
      tiles[formatTileId(parsed.x, parsed.y, parsed.z)] = { count, firstAt, lastAt };
    }
  }

  const tileOrder = [];
  const rawOrder = Array.isArray(raw.tileOrder) ? raw.tileOrder : [];
  for (const tileId of rawOrder) {
    if (typeof tileId === "string" && tiles[tileId] && !tileOrder.includes(tileId)) tileOrder.push(tileId);
  }
  Object.keys(tiles)
    .filter((tileId) => !tileOrder.includes(tileId))
    .sort((a, b) => Date.parse(tiles[a].firstAt) - Date.parse(tiles[b].firstAt))
    .forEach((tileId) => tileOrder.push(tileId));

  const log = {
    type: "traverse-log",
    schemaVersion: 2,
    tiles,
    tileOrder,
    stock: {
      amount,
      lastGrantAt: new Date(lastGrantAt).toISOString()
    }
  };
  const granted = grantTraverseStock(log, now);
  return { log, changed: granted || JSON.stringify(raw) !== JSON.stringify(log) };
}

export function grantTraverseStock(log, now = Date.now()) {
  const lastGrantAt = Date.parse(log.stock.lastGrantAt);
  if (!Number.isFinite(lastGrantAt) || now <= lastGrantAt) return false;
  const days = Math.floor((now - lastGrantAt) / DAY_MS);
  if (days < 1) return false;

  log.stock.amount = Math.min(
    TRAVERSE_CONFIG.stockCap,
    Math.max(0, Math.floor(Number(log.stock.amount) || 0)) + days * TRAVERSE_CONFIG.dailyGrant
  );
  log.stock.lastGrantAt = new Date(lastGrantAt + days * DAY_MS).toISOString();
  return true;
}

export function tileIdFromGeo(geo, zoom = TRAVERSE_CONFIG.dataZoom) {
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

export function parseTileId(tileId) {
  if (typeof tileId !== "string") return null;
  const parts = tileId.split("/").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return null;
  const [z, x, y] = parts;
  const scale = 2 ** z;
  if (z < 0 || z > 24 || x < 0 || x >= scale || y < 0 || y >= scale) return null;
  return { z, x, y };
}

export function formatTileId(x, y, z = TRAVERSE_CONFIG.dataZoom) {
  return `${z}/${x}/${y}`;
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

function tileYToLatitude(y, scale) {
  return (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale))) * 180) / Math.PI;
}
