import fs from "node:fs";

const csvPath = process.argv[2] ?? "docs/data/candidate-sites-200-v2/candidate-sites-200-v2.csv";
const sampleCount = Number(process.argv[3] ?? 2000000);
const outputPath = process.argv[4] ?? "docs/data/candidate-sites-200-v2/pentagram-sample-analysis.json";
const csv = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ""; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift();
  return rows.filter((r) => r.length === headers.length).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
}

const points = parseCsv(csv).map((row, index) => ({
  ...row,
  index,
  lat: Number(row.latitude),
  lon: Number(row.longitude),
}));
if (points.length !== 200) throw new Error(`Expected 200 points, got ${points.length}`);

const lat0 = 35 * Math.PI / 180;
for (const point of points) {
  point.x = point.lon * Math.cos(lat0);
  point.y = point.lat;
}

function shapeScore(indices) {
  const selected = indices.map((i) => points[i]);
  const cx = selected.reduce((sum, p) => sum + p.x, 0) / 5;
  const cy = selected.reduce((sum, p) => sum + p.y, 0) / 5;
  const ordered = [...selected].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  const edges = [];
  for (let i = 0; i < 5; i += 1) {
    // 五芒星の5本の短い線は、周回順の2つ先の頂点を結ぶ。
    const a = ordered[i], b = ordered[(i + 2) % 5];
    edges.push(Math.hypot(a.x - b.x, a.y - b.y));
  }
  const mean = edges.reduce((sum, value) => sum + value, 0) / 5;
  const variance = edges.reduce((sum, value) => sum + (value - mean) ** 2, 0) / 5;
  const edgeCvPercent = Math.sqrt(variance) / mean * 100;
  const angles = [];
  for (let i = 0; i < 5; i += 1) {
    const prev = ordered[(i + 4) % 5], cur = ordered[i], next = ordered[(i + 1) % 5];
    const ax = prev.x - cur.x, ay = prev.y - cur.y;
    const bx = next.x - cur.x, by = next.y - cur.y;
    const cosine = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by))));
    angles.push(Math.acos(cosine) * 180 / Math.PI);
  }
  const angleRms = Math.sqrt(angles.reduce((sum, angle) => sum + (angle - 108) ** 2, 0) / 5);
  return {
    score: edgeCvPercent + angleRms,
    edgeCvPercent,
    angleRms,
    names: ordered.map((p) => p.name),
    indices: ordered.map((p) => p.index),
  };
}

const targetNames = ["伊勢神宮 内宮", "熊野本宮大社", "伊弉諾神宮", "元伊勢皇大神社", "伊吹山"];
const targetIndices = targetNames.map((name) => points.findIndex((point) => point.name === name));
if (targetIndices.some((index) => index < 0)) throw new Error("Target anchor is missing from CSV");
const target = shapeScore(targetIndices);

let seed = 0x6d2b79f5;
function randomUint() {
  seed |= 0;
  seed = Math.imul(seed ^ (seed >>> 15), seed | 1);
  seed ^= seed + Math.imul(seed ^ (seed >>> 7), seed | 61);
  return (seed ^ (seed >>> 14)) >>> 0;
}
function randomIndex(max) { return randomUint() / 4294967296 * max | 0; }
function randomCombination() {
  const result = [];
  while (result.length < 5) {
    const value = randomIndex(points.length);
    if (!result.includes(value)) result.push(value);
  }
  return result;
}

const best = [];
const bestKeys = new Set();
let targetRank = 1;
for (let i = 0; i < sampleCount; i += 1) {
  const indices = randomCombination();
  const result = shapeScore(indices);
  if (result.score < target.score) targetRank += 1;
  const key = [...indices].sort((a, b) => a - b).join("-");
  if (best.length < 10 || result.score < best[best.length - 1].score) {
    if (!bestKeys.has(key)) {
      best.push(result);
      bestKeys.add(key);
      best.sort((a, b) => a.score - b.score);
      while (best.length > 10) {
        const removed = best.pop();
        bestKeys.delete([...removed.indices].sort((a, b) => a - b).join("-"));
      }
    }
  }
}

const output = {
  method: "deterministic seeded random sample; equirectangular projection; pentagram short-edge CV percent + RMS angle error in degrees",
  sampleCount,
  population: points.length,
  combinationCount: 2535650200,
  target,
  estimatedTargetPercentile: (1 - targetRank / (sampleCount + 1)) * 100,
  targetSampleRank: targetRank,
  best,
};
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify(output, null, 2));
