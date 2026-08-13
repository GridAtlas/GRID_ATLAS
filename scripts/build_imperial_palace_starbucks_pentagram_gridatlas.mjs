import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildGridAtlasArchive, parseGridAtlasArchive } from "../src/gridatlas-import.js";

const sourcePath = resolve(process.argv[2] || "docs/data/starbucks-japan-2026/starbucks-japan-stores-2026.gridatlas");
const outputPath = resolve(process.argv[3] || "docs/data/starbucks-japan-2026/imperial-palace-starbucks-pentagram-2026.gridatlas");
const analysisPath = resolve(process.argv[4] || "docs/data/starbucks-japan-2026/imperial-palace-starbucks-pentagram-2026.json");
const capturedAt = process.argv[5] || new Date().toISOString();

// 皇居は敷地全体を一地点に代表させるため、皇居の代表中心座標を固定する。
// 宮内庁所在地: 東京都千代田区千代田1-1
const IMPERIAL_PALACE = {
  latitude: 35.68518,
  longitude: 139.7528
};
const MAX_RADIUS_METERS = 80_000;
const MIN_RADIUS_METERS = 5_000;
const SAMPLE_COUNT = 1_000_000;
const KEEP_COUNT = 20;
const LOCAL_SEARCH_ROUNDS = 6;

const EARTH_RADIUS_METERS = 6_371_008.8;
const toRadians = (value) => value * Math.PI / 180;
const toDegrees = (value) => value * 180 / Math.PI;

function haversineMeters(first, second) {
  const latitude1 = toRadians(first.latitude);
  const latitude2 = toRadians(second.latitude);
  const deltaLatitude = latitude2 - latitude1;
  const deltaLongitude = toRadians(second.longitude - first.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

function projectAroundCenter(position) {
  const latitude0 = toRadians(IMPERIAL_PALACE.latitude);
  const latitude = toRadians(position.latitude);
  const deltaLatitude = latitude - latitude0;
  const deltaLongitude = toRadians(position.longitude - IMPERIAL_PALACE.longitude);
  const distance = haversineMeters(IMPERIAL_PALACE, position);
  const bearing = Math.atan2(
    Math.sin(deltaLongitude) * Math.cos(latitude),
    Math.cos(latitude0) * Math.sin(latitude)
      - Math.sin(latitude0) * Math.cos(latitude) * Math.cos(deltaLongitude)
  );
  return {
    x: distance * Math.sin(bearing),
    y: distance * Math.cos(bearing),
    distance,
    bearing
  };
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function coefficientOfVariationPercent(values) {
  const average = mean(values);
  const variance = mean(values.map((value) => (value - average) ** 2));
  return average > 0 ? Math.sqrt(variance) / average * 100 : Infinity;
}

function angularDifferenceDegrees(first, second) {
  const difference = Math.abs(first - second) % 360;
  return difference > 180 ? 360 - difference : difference;
}

function angleGapDegrees(first, second) {
  return (second - first + 360) % 360;
}

function scoreCombination(indices, candidates) {
  const selected = indices.map((index) => candidates[index]);
  const ordered = [...selected].sort((first, second) => first.angle - second.angle);
  const gaps = ordered.map((point, index) => angleGapDegrees(
    point.angle,
    ordered[(index + 1) % ordered.length].angle
  ));
  const gapRmsDegrees = Math.sqrt(mean(gaps.map((gap) => (gap - 72) ** 2)));
  const radii = ordered.map((point) => point.projected.distance);
  const radialCvPercent = coefficientOfVariationPercent(radii);
  const starOrder = [0, 2, 4, 1, 3];
  const starEdges = starOrder.map((vertexIndex, index) => {
    const nextVertexIndex = starOrder[(index + 1) % starOrder.length];
    const first = ordered[vertexIndex].projected;
    const second = ordered[nextVertexIndex].projected;
    return Math.hypot(first.x - second.x, first.y - second.y);
  });
  const starEdgeCvPercent = coefficientOfVariationPercent(starEdges);
  const centroidOffsetMeters = Math.hypot(
    mean(ordered.map((point) => point.projected.x)),
    mean(ordered.map((point) => point.projected.y))
  );
  const meanRadiusMeters = mean(radii);
  const centroidOffsetPercent = meanRadiusMeters > 0
    ? centroidOffsetMeters / meanRadiusMeters * 100
    : Infinity;

  // すべて同じ重みの百分率・角度誤差で、中心性と五芒星の整い方を評価する。
  const score = radialCvPercent + gapRmsDegrees + starEdgeCvPercent + centroidOffsetPercent;
  return {
    score,
    orderedIndices: ordered.map((point) => point.index),
    starOrderIndices: starOrder.map((vertexIndex) => ordered[vertexIndex].index),
    gaps,
    gapRmsDegrees,
    radialCvPercent,
    starEdgeCvPercent,
    centroidOffsetMeters,
    centroidOffsetPercent,
    meanRadiusMeters,
    starEdgeLengthsMeters: starEdges
  };
}

let seed = 0x6d2b79f5;
function randomUint() {
  seed |= 0;
  seed = Math.imul(seed ^ (seed >>> 15), seed | 1);
  seed ^= seed + Math.imul(seed ^ (seed >>> 7), seed | 61);
  return (seed ^ (seed >>> 14)) >>> 0;
}

function randomIndex(max) {
  return Math.floor((randomUint() / 4_294_967_296) * max);
}

function randomCombination(candidateCount) {
  const result = [];
  while (result.length < 5) {
    const value = randomIndex(candidateCount);
    if (!result.includes(value)) result.push(value);
  }
  return result;
}

function addBest(best, result, key) {
  if (best.some((entry) => entry.key === key)) return;
  best.push({ key, ...result });
  best.sort((first, second) => first.score - second.score);
  best.splice(KEEP_COUNT);
}

function combinationKey(indices) {
  return [...indices].sort((first, second) => first - second).join("-");
}

function localSearch(best, candidates) {
  for (const entry of best) {
    let indices = [...entry.orderedIndices];
    let current = scoreCombination(indices, candidates);
    for (let round = 0; round < LOCAL_SEARCH_ROUNDS; round += 1) {
      let improved = false;
      for (let slot = 0; slot < indices.length; slot += 1) {
        let bestIndices = indices;
        let bestScore = current.score;
        for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
          if (indices.includes(candidateIndex)) continue;
          const trial = [...indices];
          trial[slot] = candidateIndex;
          const result = scoreCombination(trial, candidates);
          if (result.score + 1e-9 < bestScore) {
            bestIndices = trial;
            bestScore = result.score;
            current = result;
            improved = true;
          }
        }
        indices = bestIndices;
      }
      if (!improved) break;
    }
    entry.key = combinationKey(indices);
    Object.assign(entry, current);
  }
  best.sort((first, second) => first.score - second.score);
  return best;
}

const sourceBytes = new Uint8Array(await readFile(sourcePath));
const source = await parseGridAtlasArchive(sourceBytes);
const sourcePlaces = source.document.places || [];
const candidates = sourcePlaces
  .map((place, index) => {
    const projected = projectAroundCenter(place.position);
    return {
      ...place,
      sourceIndex: index,
      projected,
      angle: (toDegrees(Math.atan2(projected.x, projected.y)) + 360) % 360
    };
  })
  .filter((place) => place.projected.distance >= MIN_RADIUS_METERS && place.projected.distance <= MAX_RADIUS_METERS)
  .map((place, index) => ({ ...place, index }));

if (candidates.length < 5) {
  throw new Error(`候補店舗が5件未満です: ${candidates.length}件`);
}

const best = [];
for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
  const indices = randomCombination(candidates.length);
  const result = scoreCombination(indices, candidates);
  addBest(best, result, combinationKey(indices));
}
localSearch(best, candidates);
const winner = best[0];
if (!winner) throw new Error("五芒星の候補を選べませんでした");

const selectedByIndex = new Map(candidates.map((candidate) => [candidate.index, candidate]));
const orderedStores = winner.orderedIndices.map((index) => selectedByIndex.get(index));
const starOrderStores = winner.starOrderIndices.map((index) => selectedByIndex.get(index));
const imperialPalacePlace = {
  id: "imperial-palace-tokyo-center",
  name: "皇居（中心点）",
  position: IMPERIAL_PALACE,
  note: "東京都千代田区千代田1-1 / 皇居全体を代表する中心座標"
};
const lines = starOrderStores.map((place, index) => ({
  id: `imperial-palace-pentagram-line-${index + 1}`,
  a: place.id,
  b: starOrderStores[(index + 1) % starOrderStores.length].id
}));

const document = {
  type: "place-list",
  schemaVersion: 1,
  id: "imperial-palace-starbucks-pentagram-2026",
  name: "皇居中心・スターバックス五芒星（2026-08-13）",
  description: `皇居を中心点に固定し、皇居から${MAX_RADIUS_METERS / 1000}km以内のスターバックス公式店舗から、距離・角度・五芒星5辺の整い方を総合評価して選んだ5店舗。皇居1地点と合わせて6地点を収録し、スターバックス5店舗を五芒星の順に結ぶ線を含みます。`,
  attribution: {
    name: "スターバックス コーヒー ジャパン 公式店舗検索／宮内庁 所在地",
    url: "https://store.starbucks.co.jp/",
    license: "公式サイトの利用条件に従って利用。皇居の基準住所は宮内庁所在地を参照。"
  },
  createdAt: capturedAt,
  updatedAt: capturedAt,
  places: [imperialPalacePlace, ...orderedStores],
  extensions: {
    "io.gridatlas.lines": {
      version: 1,
      items: lines
    }
  }
};

const archive = await buildGridAtlasArchive(document, [], { exportedAt: capturedAt });
const analysis = {
  method: "皇居固定中心・局所正距方位図投影・決定論的乱択100万通り＋座標降下局所探索",
  center: imperialPalacePlace,
  candidateRule: {
    source: sourcePath,
    sourcePlaceCount: sourcePlaces.length,
    minRadiusMeters: MIN_RADIUS_METERS,
    maxRadiusMeters: MAX_RADIUS_METERS,
    candidatePlaceCount: candidates.length
  },
  objective: "皇居からの距離CV(%) + 周回角度の72°からのRMS誤差(°) + 五芒星辺長CV(%) + 中心ずれ(%)",
  sampleCount: SAMPLE_COUNT,
  localSearchRounds: LOCAL_SEARCH_ROUNDS,
  winner: {
    score: winner.score,
    gapsDegrees: winner.gaps,
    gapRmsDegrees: winner.gapRmsDegrees,
    radialCvPercent: winner.radialCvPercent,
    starEdgeCvPercent: winner.starEdgeCvPercent,
    centroidOffsetMeters: winner.centroidOffsetMeters,
    centroidOffsetPercent: winner.centroidOffsetPercent,
    meanRadiusMeters: winner.meanRadiusMeters,
    orderedStoreIds: orderedStores.map((place) => place.id),
    orderedStoreNames: orderedStores.map((place) => place.name),
    starOrderStoreIds: starOrderStores.map((place) => place.id),
    starOrderStoreNames: starOrderStores.map((place) => place.name),
    starEdgeLengthsMeters: winner.starEdgeLengthsMeters
  },
  generatedAt: capturedAt
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, archive.bytes);
await writeFile(analysisPath, `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  outputPath,
  analysisPath,
  placeCount: document.places.length,
  archiveBytes: archive.bytes.byteLength,
  candidatePlaceCount: candidates.length,
  winner: analysis.winner
}, null, 2));
