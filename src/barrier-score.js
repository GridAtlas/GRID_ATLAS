export const BARRIER_SCORE_CONFIG = Object.freeze({
  earthRadiusKm: 6371.0088,
  beautyTolerance: 0.05,
  beautyDecayRange: 0.25,
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
  const beauty = beautyCoefficient(geos, config);
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

export function beautyCoefficient(geos, config = BARRIER_SCORE_CONFIG) {
  if (!Array.isArray(geos) || geos.length < 3) return 0.5;
  const centroid = normalizedVector(geos.map(unitVector).reduce(addVector, { x: 0, y: 0, z: 0 }));
  const radii = geos.map((geo) => angularDistance(centroid, unitVector(geo)));
  const radialQuality = qualityFromRelativeSpread(radii, config);
  const angles = geos.map((geo, index) => interiorAngle(
    unitVector(geo),
    unitVector(geos[(index + geos.length - 1) % geos.length]),
    unitVector(geos[(index + 1) % geos.length])
  ));
  const angleQuality = qualityFromRelativeSpread(angles, config);
  return 0.5 + 2.5 * ((radialQuality + angleQuality) / 2);
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

function qualityFromRelativeSpread(values, config) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (!Number.isFinite(mean) || mean <= 1e-12) return 1;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const relativeSpread = Math.sqrt(variance) / mean;
  if (relativeSpread <= config.beautyTolerance) return 1;
  return Math.max(0, 1 - (relativeSpread - config.beautyTolerance) / config.beautyDecayRange);
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
