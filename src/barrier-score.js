import { BARRIER_CONFIG, stoneDisplayCount, stoneExactCount } from "./barrier.js";

export const BARRIER_SCORE_CONFIG = Object.freeze({
  earthRadiusKm: 6371.0088,
  dataZoom: BARRIER_CONFIG.dataZoom,
  beautyMin: 0.5,
  // The shiniki threshold remains 102,400; rank gates now determine which
  // shapes and sight radii can actually approach it.
  beautyMax: 3,
  beautyTolerance: 0.05,
  beautyToleranceTiles: 1,
  beautyGamma: 3,
  scaleL0: 30,
  shapeCoefficients: Object.freeze({
    triangle: 1,
    quadrilateral: 1.2,
    pentagon: 1.5,
    hexagon: 1.8,
    heptagon: 2.1,
    octagon: 2.4,
    star: 3,
    octagram: 4,
    other: 1.8
  }),
  rankNames: Object.freeze(["標", "注連", "垣", "結界", "霊域", "聖域", "神域", "天域"]),
  rankReadings: Object.freeze(["しるべ", "しめ", "かき", "けっかい", "れいいき", "せいいき", "しんいき", "てんいき"]),
  rankThresholds: Object.freeze([0, 25, 100, 400, 1600, 6400, 102400, 409600])
});

export function scoreBarrier(log, barrierId, config = BARRIER_SCORE_CONFIG) {
  const barrier = log?.barriers?.[barrierId];
  if (!barrier) return null;
  const stones = (barrier.vertices || []).map((stoneId) => log.stones?.[stoneId]).filter(Boolean);
  const geos = stones.map((stone) => tileCenterGeo(stone.tile)).filter(Boolean);
  if (geos.length < 3) return null;

  const selfIntersecting = polygonSelfIntersects(geos);
  const areaKm2 = selfIntersecting
    ? nonZeroPolygonAreaKm2(geos, config.earthRadiusKm)
    : sphericalPolygonAreaKm2(geos, config.earthRadiusKm);
  const shape = shapeCoefficient(geos.length, selfIntersecting, config.shapeCoefficients, barrier.linkPattern);
  const beauty = beautyCoefficient(geos, config);
  const scale = scaleCoefficient(areaKm2, config);
  const stoneCount = stones.reduce((sum, stone) => sum + stoneDisplayCount(stone), 0);
  const effectiveStoneCountValue = effectiveStoneCount(stones);
  const power = effectiveStoneCountValue * shape * beauty * scale;
  const density = areaKm2 > 0 ? power / areaKm2 : 0;
  return {
    barrierId,
    name: barrier.name || "",
    vertexCount: geos.length,
    stoneCount,
    effectiveStoneCount: effectiveStoneCountValue,
    areaKm2,
    shapeCoefficient: shape,
    beautyCoefficient: beauty,
    scaleCoefficient: scale,
    power,
    density,
    selfIntersecting,
    guardian: null,
    rank: rankForScore(power, config)
  };
}

export function effectiveStoneCount(stones) {
  if (!Array.isArray(stones) || stones.length === 0) return 0;
  const product = stones.reduce((value, stone) => value * Math.max(1, stoneExactCount(stone)), 1);
  return stones.length * (product ** (1 / stones.length));
}

export function scaleCoefficient(areaKm2, config = BARRIER_SCORE_CONFIG) {
  const representativeDistance = Math.sqrt(Math.max(0, Number(areaKm2) || 0));
  const l0 = Math.max(0.0001, Number(config.scaleL0) || 30);
  return representativeDistance / (1 + representativeDistance / l0);
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

// Self-intersecting polygons use the non-zero rule: every bounded region with
// a non-zero winding number contributes once, while the area remains spherical.
export function nonZeroPolygonAreaKm2(geos, earthRadiusKm = BARRIER_SCORE_CONFIG.earthRadiusKm) {
  if (!Array.isArray(geos) || geos.length < 3) return 0;
  const basis = projectionBasis(geos);
  const projectedVertices = geos.map((geo) => projectUnitVector(unitVector(geo), basis));
  if (projectedVertices.some((point) => !point)) return sphericalPolygonAreaKm2(geos, earthRadiusKm);

  const edgeSplits = geos.map((_, index) => [
    { t: 0, x: projectedVertices[index].x, y: projectedVertices[index].y, vector: unitVector(geos[index]) },
    { t: 1, x: projectedVertices[(index + 1) % geos.length].x, y: projectedVertices[(index + 1) % geos.length].y, vector: unitVector(geos[(index + 1) % geos.length]) }
  ]);
  let intersectionCount = 0;

  for (let first = 0; first < geos.length; first += 1) {
    const firstNext = (first + 1) % geos.length;
    for (let second = first + 1; second < geos.length; second += 1) {
      const secondNext = (second + 1) % geos.length;
      if (first === second || firstNext === second || secondNext === first) continue;
      const intersection = segmentIntersection(
        projectedVertices[first],
        projectedVertices[firstNext],
        projectedVertices[second],
        projectedVertices[secondNext]
      );
      if (!intersection) continue;
      const vector = inverseProject(intersection.x, intersection.y, basis);
      edgeSplits[first].push({ t: intersection.t, x: intersection.x, y: intersection.y, vector });
      edgeSplits[second].push({ t: intersection.u, x: intersection.x, y: intersection.y, vector });
      intersectionCount += 1;
    }
  }
  if (intersectionCount === 0) return sphericalPolygonAreaKm2(geos, earthRadiusKm);

  const nodes = new Map();
  const adjacency = new Map();
  const getNode = (point) => {
    const key = pointKey(point.x, point.y);
    if (!nodes.has(key)) nodes.set(key, { key, x: point.x, y: point.y, vector: point.vector });
    return nodes.get(key);
  };
  const addEdge = (from, to) => {
    if (from.key === to.key) return;
    if (!adjacency.has(from.key)) adjacency.set(from.key, []);
    if (!adjacency.has(to.key)) adjacency.set(to.key, []);
    const outgoing = adjacency.get(from.key);
    if (!outgoing.some((edge) => edge.to === to.key)) outgoing.push({ to: to.key });
    const reverse = adjacency.get(to.key);
    if (!reverse.some((edge) => edge.to === from.key)) reverse.push({ to: from.key });
  };

  edgeSplits.forEach((splits) => {
    const ordered = splits
      .sort((a, b) => a.t - b.t)
      .filter((point, index, all) => index === 0 || Math.abs(point.t - all[index - 1].t) > 1e-9);
    for (let index = 0; index < ordered.length - 1; index += 1) {
      addEdge(getNode(ordered[index]), getNode(ordered[index + 1]));
    }
  });

  for (const [from, outgoing] of adjacency.entries()) {
    const origin = nodes.get(from);
    outgoing.sort((left, right) => {
      const leftNode = nodes.get(left.to);
      const rightNode = nodes.get(right.to);
      return Math.atan2(leftNode.y - origin.y, leftNode.x - origin.x)
        - Math.atan2(rightNode.y - origin.y, rightNode.x - origin.x);
    });
  }

  let area = 0;
  for (const face of extractFaces(nodes, adjacency)) {
    if (face.length < 3 || planarSignedArea(face) <= 1e-12) continue;
    const sample = face.reduce((sum, node) => ({ x: sum.x + node.x, y: sum.y + node.y }), { x: 0, y: 0 });
    sample.x /= face.length;
    sample.y /= face.length;
    if (planarWindingNumber(sample, projectedVertices) === 0) continue;
    const faceGeos = face.map((node) => vectorToGeo(node.vector));
    area += sphericalPolygonAreaKm2(faceGeos, earthRadiusKm);
  }
  return area;
}

function projectionBasis(geos) {
  const center = normalizedVector(geos.map(unitVector).reduce(addVector, { x: 0, y: 0, z: 0 }));
  const reference = Math.abs(center.z) > 0.9 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
  const east = normalizedVector(cross(reference, center));
  const north = normalizedVector(cross(center, east));
  return { center, east, north };
}

function projectUnitVector(vector, basis) {
  const denominator = dot(vector, basis.center);
  if (denominator <= 1e-9) return null;
  return {
    x: dot(vector, basis.east) / denominator,
    y: dot(vector, basis.north) / denominator
  };
}

function inverseProject(x, y, basis) {
  return normalizedVector({
    x: basis.center.x + x * basis.east.x + y * basis.north.x,
    y: basis.center.y + x * basis.east.y + y * basis.north.y,
    z: basis.center.z + x * basis.east.z + y * basis.north.z
  });
}

function vectorToGeo(vector) {
  return {
    lat: Math.atan2(vector.z, Math.hypot(vector.x, vector.y)) * 180 / Math.PI,
    lng: Math.atan2(vector.y, vector.x) * 180 / Math.PI
  };
}

function pointKey(x, y) {
  return `${x.toFixed(10)}:${y.toFixed(10)}`;
}

function cross2d(a, b) {
  return a.x * b.y - a.y * b.x;
}

function segmentIntersection(a, b, c, d) {
  const direction = { x: b.x - a.x, y: b.y - a.y };
  const otherDirection = { x: d.x - c.x, y: d.y - c.y };
  const denominator = cross2d(direction, otherDirection);
  if (Math.abs(denominator) <= 1e-12) return null;
  const offset = { x: c.x - a.x, y: c.y - a.y };
  const t = cross2d(offset, otherDirection) / denominator;
  const u = cross2d(offset, direction) / denominator;
  if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) return null;
  return {
    t,
    u,
    x: a.x + direction.x * t,
    y: a.y + direction.y * t
  };
}

function extractFaces(nodes, adjacency) {
  const visited = new Set();
  const faces = [];
  for (const [from, outgoing] of adjacency.entries()) {
    for (const edge of outgoing) {
      const startKey = `${from}>${edge.to}`;
      if (visited.has(startKey)) continue;
      const face = [];
      let currentFrom = from;
      let currentTo = edge.to;
      let closed = false;
      for (let step = 0; step <= nodes.size * 4; step += 1) {
        const key = `${currentFrom}>${currentTo}`;
        if (visited.has(key)) {
          closed = currentFrom === from && currentTo === edge.to;
          break;
        }
        visited.add(key);
        face.push(nodes.get(currentFrom));
        const next = nextFaceEdge(currentFrom, currentTo, adjacency);
        if (!next) break;
        currentFrom = currentTo;
        currentTo = next;
        if (currentFrom === from && currentTo === edge.to) {
          closed = true;
          break;
        }
      }
      if (closed) faces.push(face);
    }
  }
  return faces;
}

function nextFaceEdge(from, to, adjacency) {
  const outgoing = adjacency.get(to) || [];
  const reverseIndex = outgoing.findIndex((edge) => edge.to === from);
  if (reverseIndex < 0 || outgoing.length < 2) return null;
  return outgoing[(reverseIndex - 1 + outgoing.length) % outgoing.length].to;
}

function planarSignedArea(points) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

function planarWindingNumber(point, polygon) {
  let winding = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const crossing = cross2d(
      { x: next.x - current.x, y: next.y - current.y },
      { x: point.x - current.x, y: point.y - current.y }
    );
    if (current.y <= point.y) {
      if (next.y > point.y && crossing > 0) winding += 1;
    } else if (next.y <= point.y && crossing < 0) {
      winding -= 1;
    }
  }
  return winding;
}

export function beautyCoefficient(geos, config = BARRIER_SCORE_CONFIG) {
  const minimum = Number.isFinite(Number(config.beautyMin)) ? Number(config.beautyMin) : 0.5;
  const maximum = Number.isFinite(Number(config.beautyMax)) ? Number(config.beautyMax) : 3;
  const gamma = Math.max(0.0001, Number(config.beautyGamma) || 1);
  if (!Array.isArray(geos) || geos.length < 3) return minimum;
  const base = centroidGeo(geos);
  const polar = geos.map((geo) => polarCoordinates(base, geo));
  const radii = polar.map((point) => point.distanceMeters);
  const radialMean = radii.reduce((sum, value) => sum + value, 0) / radii.length;
  const tolerance = effectiveBeautyTolerance(base, radialMean, config);
  const radialVariance = radii.reduce((sum, value) => sum + (value - radialMean) ** 2, 0) / radii.length;
  const radialResidualVariance = radii.reduce((sum, value) => {
    const residual = Math.max(0, Math.abs(value - radialMean) - tolerance * radialMean);
    return sum + residual ** 2;
  }, 0) / radii.length;
  const radialCv = radialMean > 0 ? Math.sqrt(radialResidualVariance) / radialMean : 0;
  const radialQuality = clamp01(1 - radialCv);
  const angles = polar.map((point) => point.bearing).sort((a, b) => a - b);
  const gaps = angles.map((angle, index) => {
    const next = angles[(index + 1) % angles.length];
    return (next - angle + 360) % 360;
  });
  const ideal = 360 / geos.length;
  const angularToleranceDegrees = tolerance * 180 / Math.PI;
  const error = gaps.reduce((sum, gap) => sum + Math.max(0, Math.abs(gap - ideal) - angularToleranceDegrees), 0);
  const maxError = 720 * (geos.length - 1) / geos.length;
  const angularQuality = clamp01(maxError > 0 ? 1 - error / maxError : 0);
  const combinedQuality = Math.max(0, radialQuality * angularQuality) ** gamma;
  return minimum + (maximum - minimum) * combinedQuality;
}

export function shapeCoefficient(vertexCount, selfIntersecting, coefficients = BARRIER_SCORE_CONFIG.shapeCoefficients, linkPattern = "adjacent") {
  if (selfIntersecting && vertexCount === 5 && linkPattern === "pentagram") return coefficients.star;
  if (selfIntersecting && vertexCount === 8 && linkPattern === "octagram") return coefficients.octagram;
  if (selfIntersecting && vertexCount === 5) return coefficients.star;
  if (selfIntersecting && vertexCount === 8) return coefficients.octagram;
  if (vertexCount === 3) return coefficients.triangle;
  if (vertexCount === 4) return coefficients.quadrilateral;
  if (vertexCount === 5) return coefficients.pentagon;
  if (vertexCount === 6) return coefficients.hexagon;
  if (vertexCount === 7) return coefficients.heptagon;
  if (vertexCount === 8) return coefficients.octagon;
  // Defensive-only fallback for corrupt or future data outside maxVertices.
  // New barriers cannot reach this scoring path while maxVertices is 8.
  console.warn("GRID ATLAS shape coefficient fallback", { vertexCount });
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

export function tileEdgeMetersAtLatitude(latitude, dataZoom = BARRIER_SCORE_CONFIG.dataZoom) {
  const zoom = Math.max(0, Number(dataZoom) || 0);
  return 40075017 * Math.cos(Number(latitude) * Math.PI / 180) / (2 ** zoom);
}

export function effectiveBeautyTolerance(base, radialMeanMeters, config = BARRIER_SCORE_CONFIG) {
  const relative = Math.max(0, Number(config.beautyTolerance) || 0.05);
  const tileCount = Math.max(0, Number(config.beautyToleranceTiles) || 0);
  const edge = tileEdgeMetersAtLatitude(base?.lat, config.dataZoom ?? BARRIER_SCORE_CONFIG.dataZoom);
  const tileRatio = radialMeanMeters > 0 ? tileCount * edge / radialMeanMeters : 0;
  return Math.max(relative, tileRatio);
}

export function geoDistanceKm(first, second, earthRadiusKm = BARRIER_SCORE_CONFIG.earthRadiusKm) {
  if (!validGeo(first) || !validGeo(second)) return Number.POSITIVE_INFINITY;
  const lat1 = Number(first.lat) * Math.PI / 180;
  const lat2 = Number(second.lat) * Math.PI / 180;
  const dLat = lat2 - lat1;
  const dLng = (Number(second.lng) - Number(first.lng)) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export function sightRadiusForRank(rankIndex = 0, config = BARRIER_CONFIG) {
  const index = Math.max(0, Math.min(config.sightRadiusKm.length - 1, Math.floor(Number(rankIndex) || 0)));
  return Number(config.sightRadiusKm[index]) || config.sightRadiusKm[0];
}

export function barrierReferenceGeo(geos) {
  if (!Array.isArray(geos) || geos.length === 0) return null;
  return centroidGeo(geos);
}

export function barrierFitsSightRadius(geos, rankIndex = 0, config = BARRIER_CONFIG) {
  const reference = barrierReferenceGeo(geos);
  if (!reference) return { ok: false, reason: "invalid-reference" };
  const radiusKm = sightRadiusForRank(rankIndex, config);
  const distances = geos.map((geo, index) => ({ index, distanceKm: geoDistanceKm(reference, geo) }));
  const exceeded = distances.filter((entry) => entry.distanceKm > radiusKm + 1e-9);
  return {
    ok: exceeded.length === 0,
    radiusKm,
    reference,
    distances,
    exceeded
  };
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

export function polygonSelfIntersects(geos) {
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
