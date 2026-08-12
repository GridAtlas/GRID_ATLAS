import fs from "node:fs";
import { unzipSync } from "fflate";
import { analyzeSegmentShape } from "../src/shape-analysis.js";

const csvPath = process.argv[2] ?? "docs/data/candidate-sites-500-v5-nested/candidate-sites-500-shrines-temples-v5-nested.csv";
const sampleCount = Number(process.argv[3] ?? 2_000_000);
const outputPath = process.argv[4] ?? "docs/data/candidate-sites-500-v5-nested/pentagon-search-analysis-v1.json";
const existingPresetPath = process.argv[5] ?? "presets/kinki-pentagram-rank1-of-500.gridatlas";

const points = parseCsv(fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "")).map((row, index) => ({
  index,
  id: row.id,
  title: row.name,
  name: row.name,
  prefecture: row.prefecture,
  lat: Number(row.latitude),
  lng: Number(row.longitude),
}));
if (points.length !== 500) throw new Error(`Expected 500 points, got ${points.length}`);

const center = meanGeo(points);
for (const point of points) {
  point.geo = { lat: point.lat, lng: point.lng };
  const projected = projectLocalAeqd(point.geo, center);
  point.x = projected.x;
  point.y = projected.y;
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (quoted) {
      if (ch === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift();
  return rows.filter((candidate) => candidate.length === headers.length)
    .map((candidate) => Object.fromEntries(headers.map((header, index) => [header, candidate[index]])));
}

function meanGeo(items) {
  let x = 0, y = 0, z = 0;
  for (const point of items) {
    const lat = radians(point.lat);
    const lng = radians(point.lng);
    x += Math.cos(lat) * Math.cos(lng);
    y += Math.cos(lat) * Math.sin(lng);
    z += Math.sin(lat);
  }
  return {
    lat: degrees(Math.atan2(z, Math.hypot(x, y))),
    lng: degrees(Math.atan2(y, x)),
  };
}

function projectLocalAeqd(geo, origin) {
  const lat = radians(geo.lat);
  const lat0 = radians(origin.lat);
  const lngDelta = radians(shortestLongitudeDelta(origin.lng, geo.lng));
  const sinLat = Math.sin(lat), cosLat = Math.cos(lat);
  const sinLat0 = Math.sin(lat0), cosLat0 = Math.cos(lat0);
  const cosC = clamp(sinLat0 * sinLat + cosLat0 * cosLat * Math.cos(lngDelta), -1, 1);
  const c = Math.acos(cosC);
  const scale = c < 1e-12 ? 1 : c / Math.sin(c);
  const earthRadius = 6371008.8;
  return {
    x: earthRadius * scale * cosLat * Math.sin(lngDelta),
    y: earthRadius * scale * (cosLat0 * sinLat - sinLat0 * cosLat * Math.cos(lngDelta)),
  };
}

function orderIndices(indices) {
  let cx = 0, cy = 0;
  for (const index of indices) { cx += points[index].x; cy += points[index].y; }
  cx /= indices.length; cy /= indices.length;
  return [...indices].sort((a, b) => Math.atan2(points[a].y - cy, points[a].x - cx) - Math.atan2(points[b].y - cy, points[b].x - cx));
}

function approximateScore(indices) {
  const ordered = orderIndices(indices);
  const sides = [];
  const angles = [];
  for (let index = 0; index < 5; index += 1) {
    const previous = points[ordered[(index + 4) % 5]];
    const current = points[ordered[index]];
    const next = points[ordered[(index + 1) % 5]];
    sides.push(distance(current, next));
    angles.push(angle(previous, current, next));
  }
  if (hasSelfIntersection(ordered)) return null;
  const mean = average(sides);
  const sideRangePercent = (Math.max(...sides) - Math.min(...sides)) / mean * 100;
  const maxAngleDeviation = Math.max(...angles.map((value) => Math.abs(value - 108)));
  const score = clamp(100 * (1 - sideRangePercent / 25), 0, 100) * 0.5
    + clamp(100 * (1 - maxAngleDeviation / 27), 0, 100) * 0.5;
  return { score, ordered, sideRangePercent, maxAngleDeviation, sides, angles };
}

function exactScore(indices) {
  const ordered = orderIndices(indices);
  const segments = ordered.map((index, position) => ({
    a: points[index],
    b: points[ordered[(position + 1) % 5]],
  }));
  const result = analyzeSegmentShape(segments);
  return result.valid && result.selfIntersections === 0
    ? { ...result, ordered }
    : null;
}

function hasSelfIntersection(ordered) {
  for (let first = 0; first < 5; first += 1) {
    for (let second = first + 1; second < 5; second += 1) {
      if (second === first + 1 || (first === 0 && second === 4)) continue;
      const a = points[ordered[first]], b = points[ordered[(first + 1) % 5]];
      const c = points[ordered[second]], d = points[ordered[(second + 1) % 5]];
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

function segmentsIntersect(a, b, c, d) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const cdx = d.x - c.x, cdy = d.y - c.y;
  const denominator = abx * cdy - aby * cdx;
  if (Math.abs(denominator) < 1e-9) return false;
  const acx = c.x - a.x, acy = c.y - a.y;
  const firstRatio = (acx * cdy - acy * cdx) / denominator;
  const secondRatio = (acx * aby - acy * abx) / denominator;
  return firstRatio > 0 && firstRatio < 1 && secondRatio > 0 && secondRatio < 1;
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function angle(previous, current, next) {
  const ax = previous.x - current.x, ay = previous.y - current.y;
  const bx = next.x - current.x, by = next.y - current.y;
  return degrees(Math.acos(clamp((ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by)), -1, 1)));
}
function average(values) { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function radians(value) { return value * Math.PI / 180; }
function degrees(value) { return value * 180 / Math.PI; }
function shortestLongitudeDelta(from, to) { return ((((to - from) + 540) % 360) + 360) % 360 - 180; }

let seed = 0x6d2b79f5;
function randomUint() {
  seed |= 0;
  seed = Math.imul(seed ^ (seed >>> 15), seed | 1);
  seed ^= seed + Math.imul(seed ^ (seed >>> 7), seed | 61);
  return (seed ^ (seed >>> 14)) >>> 0;
}
function randomIndex(max) { return (randomUint() / 4294967296 * max) | 0; }
function randomCombination() {
  const result = [];
  while (result.length < 5) {
    const index = randomIndex(points.length);
    if (!result.includes(index)) result.push(index);
  }
  return result;
}

const candidates = new Map();
function remember(indices, source) {
  const key = [...indices].sort((a, b) => a - b).join("-");
  if (candidates.has(key)) return;
  const result = approximateScore(indices);
  if (result) candidates.set(key, { ...result, indices: [...indices], source });
}

const existingBytes = fs.readFileSync(existingPresetPath);
const existingDocument = JSON.parse(new TextDecoder().decode(unzipSync(existingBytes)["document.json"]));
const existingIndices = existingDocument.places.map((place) => {
  const index = points.findIndex((point) => point.id === place.id);
  if (index < 0) throw new Error(`Preset point is missing from CSV: ${place.id}`);
  return index;
});
remember(existingIndices, "existing-rank1");

for (let index = 0; index < sampleCount; index += 1) remember(randomCombination(), "random");

function bestCandidates(limit = 25) {
  return [...candidates.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

for (let round = 0; round < 3; round += 1) {
  const seeds = bestCandidates(25);
  for (const candidate of seeds) {
    let improved = true;
    while (improved) {
      improved = false;
      let best = candidate;
      for (let position = 0; position < 5; position += 1) {
        for (let replacement = 0; replacement < points.length; replacement += 1) {
          if (candidate.indices.includes(replacement)) continue;
          const next = [...candidate.indices];
          next[position] = replacement;
          const evaluated = approximateScore(next);
          if (evaluated && evaluated.score > best.score + 1e-9) {
            best = { ...evaluated, indices: next, source: "local-search" };
          }
        }
      }
      if (best !== candidate) {
        candidate.indices = best.indices;
        candidate.score = best.score;
        candidate.ordered = best.ordered;
        candidate.sideRangePercent = best.sideRangePercent;
        candidate.maxAngleDeviation = best.maxAngleDeviation;
        candidate.sides = best.sides;
        candidate.angles = best.angles;
        candidate.source = "local-search";
        improved = true;
      }
    }
    remember(candidate.indices, candidate.source);
  }
}

const results = bestCandidates(25).map((candidate) => {
  const exact = exactScore(candidate.indices);
  return {
    approximateScore: candidate.score,
    source: candidate.source,
    indices: exact?.ordered ?? candidate.ordered,
    places: (exact?.ordered ?? candidate.ordered).map((index) => ({
      id: points[index].id,
      name: points[index].name,
      prefecture: points[index].prefecture,
      latitude: points[index].lat,
      longitude: points[index].lng,
    })),
    exact: exact ? {
      referenceScore: exact.referenceScore,
      sideRangePercent: exact.sideRangePercent,
      maxAngleDeviation: exact.maxAngleDeviation,
      maxAngleDeviationPercent: exact.maxAngleDeviationPercent,
      meanSide: exact.meanSide,
      perimeter: exact.perimeter,
      sideLengths: exact.sideLengths,
      angles: exact.angles,
    } : null,
  };
}).sort((a, b) => (b.exact?.referenceScore ?? -1) - (a.exact?.referenceScore ?? -1));

const output = {
  method: "deterministic seeded random sample plus three-round one-point local search; simple pentagon only; ranking uses the current analysis referenceScore formula",
  sampleCount,
  population: points.length,
  combinationCount: 255244687600,
  existingRank1: results.find((result) => result.places.every((place) => existingIndices.includes(points.findIndex((point) => point.id === place.id)))) ?? null,
  best: results.slice(0, 10),
};
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify(output, null, 2));
