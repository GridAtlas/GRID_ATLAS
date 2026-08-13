import { BARRIER_CONFIG } from "./barrier.js";

export const BARRIER_SCORE_CONFIG = Object.freeze({
  earthRadiusKm: 6371.0088,
  beautyMin: 0.5,
  beautyMax: 3,
  beautyGamma: 1,
  shapeCoefficients: Object.freeze({
    triangle: 1,
    quadrilateral: 1.2,
    pentagon: 1.5,
    hexagon: 1.8,
    star: 3,
    other: 1.8
  }),
  rankNames: Object.freeze(["標", "注連", "垣", "結界", "霊域", "聖域", "神域"]),
  rankReadings: Object.freeze(["しるべ", "しめ", "かき", "けっかい", "れいいき", "せいいき", "しんいき"]),
  rankThresholds: Object.freeze([0, 25, 100, 400, 1600, 6400, 102400])
});

export function scoreBarrier(log, barrierId, config = BARRIER_SCORE_CONFIG) {
  const barrier = log?.barriers?.[barrierId];
  if (!barrier) return null;
  const stones = (barrier.vertices || []).map((stoneId) => log.stones?.[stoneId]).filter(Boolean);
  const geos = stones.map((stone) => tileCenterGeo(stone.tile)).filter(Boolean);
  if (geos.length < 3) return null;

  const areaKm2 = sphericalPolygonAreaKm2(geos, config.earthRadiusKm);
  const selfIntersecting = polygonSelfIntersects(geos);
  const shape = shapeCoefficient(geos.length, selfIntersecting, config.shapeCoefficients);
  const guardian = BARRIER_CONFIG.guardianEnabled ? barrier.guardian : null;
  const beauty = beautyCoefficient(geos, config, guardian);
  const scale = 1 + Math.sqrt(Math.max(0, areaKm2)) / 10;
  const stoneCount = stones.reduce((sum, stone) => sum + Math.max(0, Number(stone.count) || 0), 0);
  const power = stoneCount * shape * beauty * scale;
  const density = areaKm2 > 0 ? power / areaKm2 : 0;
  return {
    barrierId,
    name: barrier.name || "",
    vertexCount: geos.length,
    stoneCount,
    areaKm2,
    shapeCoefficient: shape,
    beautyCoefficient: beauty,
    scaleCoefficient: scale,
    power,
    density,
    selfIntersecting,
    guardian: guardian || null,
    rank: rankForScore(power, config)
  };
}

export function sphericalPolygonAreaKm2(geos, earthRadiusKm = BARRIER_SCORE_CONFIG.earthRadiusKm) {
  if (!Array.isArray(geos) || geos.length < 3) return 0;
  const origin = unitVector(geos[0]);
  let signedArea = 0;
  for (let index = 1; index < geos.length - 1; index += 1) {
    signedArea += signedTriangleArea(origin, unitVector(geos[index]), unitVector(geos[index + 1]));
  }
  return Math.abs(signedArea) * earthRadiusKm ** 2;
}

export function beautyCoefficient(geos, config = BARRIER_SCORE_CONFIG, guardian = null) {
  const minimum = Number.isFinite(Number(config.beautyMin)) ? Number(config.beautyMin) : 0.5;
  const maximum = Number.isFinite(Number(config.beautyMax)) ? Number(config.beautyMax) : 3;
  const gamma = Math.max(0.0001, Number(config.beautyGamma) || 1);
  if (!Array.isArray(geos) || geos.length < 3) return minimum;
  const base = validGeo(guardian) ? guardian : centroidGeo(geos);
  const polar = geos.map((geo) => polarCoordinates(base, geo));
  const radii = polar.map((point) => point.distanceMeters);
  const radialMean = radii.reduce((sum, value) => sum + value, 0) / radii.length;
  const radialVariance = radii.reduce((sum, value) => sum + (value - radialMean) ** 2, 0) / radii.length;
  const radialCv = radialMean > 0 ? Math.sqrt(radialVariance) / radialMean : 0;
  const radialQuality = clamp01(1 - radialCv);
  const angles = polar.map((point) => point.bearing).sort((a, b) => a - b);
  const gaps = angles.map((angle, index) => {
    const next = angles[(index + 1) % angles.length];
    return (next - angle + 360) % 360;
  });
  const ideal = 360 / geos.length;
  const error = gaps.reduce((sum, gap) => sum + Math.abs(gap - ideal), 0);
  const maxError = 720 * (geos.length - 1) / geos.length;
  const angularQuality = clamp01(maxError > 0 ? 1 - error / maxError : 0);
  const combinedQuality = Math.max(0, radialQuality * angularQuality) ** gamma;
  return minimum + (maximum - minimum) * combinedQuality;
}

export function shapeCoefficient(vertexCount, selfIntersecting, coefficients = BARRIER_SCORE_CONFIG.shapeCoefficients) {
  if (selfIntersecting && vertexCount === 5) return coefficients.star;
  if (vertexCount === 3) return coefficients.triangle;
  if (vertexCount === 4) return coefficients.quadrilateral;
  if (vertexCount === 5) return coefficients.pentagon;
  if (vertexCount === 6) return coefficients.hexagon;
  return coefficients.other;
}

export function rankForScore(score, config = BARRIER_SCORE_CONFIG) {
  const value = Number.isFinite(Number(score)) ? Number(score) : 0;
  let index = 0;
  config.rankThresholds.forEach((threshold, thresholdIndex) => {
    if (value >= threshold) index = thresholdIndex;
  });
  return {
    index,
    name: config.rankNames[index],
    reading: config.rankReadings[index],
    threshold: config.rankThresholds[index]
  };
}

function validGeo(geo) {
  return Number.isFinite(Number(geo?.lat)) && Number.isFinite(Number(geo?.lng));
}

function centroidGeo(geos) {
  const centroid = normalizedVector(geos.map(unitVector).reduce(addVector, { x: 0, y: 0, z: 0 }));
  return {
    lat: Math.atan2(centroid.z, Math.hypot(centroid.x, centroid.y)) * 180 / Math.PI,
    lng: Math.atan2(centroid.y, centroid.x) * 180 / Math.PI
  };
}

function polarCoordinates(origin, target) {
  const earthRadiusMeters = BARRIER_SCORE_CONFIG.earthRadiusKm * 1000;
  const originLat = Number(origin.lat) * Math.PI / 180;
  const targetLat = Number(target.lat) * Math.PI / 180;
  const deltaLat = targetLat - originLat;
  const deltaLng = (Number(target.lng) - Number(origin.lng)) * Math.PI / 180;
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(originLat) * Math.cos(targetLat) * Math.sin(deltaLng / 2) ** 2;
  const distanceMeters = 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)));
  const y = Math.sin(deltaLng) * Math.cos(targetLat);
  const x = Math.cos(originLat) * Math.sin(targetLat)
    - Math.sin(originLat) * Math.cos(targetLat) * Math.cos(deltaLng);
  const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  return { distanceMeters, bearing };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function tileCenterGeo(tileId) {
  const parts = typeof tileId === "string" ? tileId.split("/").map(Number) : [];
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return null;
  const [z, x, y] = parts;
  const scale = 2 ** z;
  if (z < 0 || z > 24 || x < 0 || y < 0 || x >= scale || y >= scale) return null;
  const west = (x / scale) * 360 - 180;
  const east = ((x + 1) / scale) * 360 - 180;
  const north = tileYToLatitude(y, scale);
  const south = tileYToLatitude(y + 1, scale);
  return { lat: (north + south) / 2, lng: (west + east) / 2 };
}

function unitVector(geo) {
  const lat = Number(geo.lat) * Math.PI / 180;
  const lng = Number(geo.lng) * Math.PI / 180;
  const cosLat = Math.cos(lat);
  return { x: cosLat * Math.cos(lng), y: cosLat * Math.sin(lng), z: Math.sin(lat) };
}

function normalizedVector(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function addVector(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a, b) {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function signedTriangleArea(a, b, c) {
  const determinant = dot(a, cross(b, c));
  const denominator = 1 + dot(a, b) + dot(b, c) + dot(c, a);
  const area = 2 * Math.atan2(Math.abs(determinant), denominator);
  return Math.sign(determinant || 1) * area;
}

function angularDistance(a, b) {
  return Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
}

function interiorAngle(vertex, previous, next) {
  const previousTangent = normalizedVector({
    x: previous.x - vertex.x * dot(previous, vertex),
    y: previous.y - vertex.y * dot(previous, vertex),
    z: previous.z - vertex.z * dot(previous, vertex)
  });
  const nextTangent = normalizedVector({
    x: next.x - vertex.x * dot(next, vertex),
    y: next.y - vertex.y * dot(next, vertex),
    z: next.z - vertex.z * dot(next, vertex)
  });
  return Math.acos(Math.max(-1, Math.min(1, dot(previousTangent, nextTangent))));
}

function polygonSelfIntersects(geos) {
  const centroid = normalizedVector(geos.map(unitVector).reduce(addVector, { x: 0, y: 0, z: 0 }));
  const points = geos.map((geo) => {
    const vector = unitVector(geo);
    const east = normalizedVector({ x: -centroid.y, y: centroid.x, z: 0 });
    const north = normalizedVector(cross(centroid, east));
    return { x: dot(vector, east), y: dot(vector, north) };
  });
  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length;
    for (let second = first + 1; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length;
      if (first === second || firstNext === second || secondNext === first) continue;
      if (segmentsIntersect(points[first], points[firstNext], points[second], points[secondNext])) return true;
    }
  }
  return false;
}

function segmentsIntersect(a, b, c, d) {
  const orientation = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  return abC * abD < 0 && cdA * cdB < 0;
}

function tileYToLatitude(y, scale) {
  return (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale))) * 180) / Math.PI;
}
