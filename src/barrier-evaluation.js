import { BARRIER_CONFIG, appendBarrierEvent, stoneDisplayCount, stoneExactCount } from "./barrier.js";
import { BARRIER_SCORE_CONFIG, scoreBarrier } from "./barrier-score.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const BARRIER_EVALUATION_CONFIG = Object.freeze({
  windowDays: BARRIER_CONFIG.windowDays,
  powerThresholds: Object.freeze([0, 25, 100, 400, 1600, 6400, 102400, 409600]),
  daysRequired: Object.freeze([0, 7, 30, 90, 180, 365, 730, 1095]),
  rankNames: Object.freeze(["標", "注連", "垣", "結界", "霊域", "聖域", "神域", "天域"]),
  rankReadings: Object.freeze(["しるべ", "しめ", "かき", "けっかい", "れいいき", "せいいき", "しんいき", "てんいき"]),
  kekkaishiLifetimeThresholds: Object.freeze([0, 800, 8000, 40000, 160000, 800000, 4000000, 20000000, 100000000]),
  kekkaishiRankNames: Object.freeze(["F", "E", "D", "C", "B", "A", "S", "SS", "SSS"])
});

export function createKekkaishiStatus(now = Date.now(), barrierCount = 0, config = BARRIER_EVALUATION_CONFIG) {
  const iso = new Date(now).toISOString();
  return {
    lifetimeOutput: 0,
    dailyHistory: Array(config.windowDays).fill(0),
    peakAverage: 0,
    peakAchievedAt: "",
    lastEvaluatedAt: iso,
    lastDailyPower: 0,
    kekkaiCreatedCount: Math.max(0, Math.floor(Number(barrierCount) || 0)),
    startedAt: iso,
    rankAchievedAt: Array.from({ length: config.kekkaishiRankNames.length }, (_, index) => index === 0 ? iso : null)
  };
}

export function normalizeKekkaishiStatus(raw, now = Date.now(), barrierCount = 0, config = BARRIER_EVALUATION_CONFIG, barriers = {}) {
  const fallback = createKekkaishiStatus(now, barrierCount, config);
  if (!raw || typeof raw !== "object") return fallback;
  const parsedLast = Date.parse(raw.lastEvaluatedAt);
  const trimmedHistory = Array.isArray(raw.dailyHistory)
    ? raw.dailyHistory.map((value) => Math.max(0, Number(value) || 0)).slice(-config.windowDays)
    : [];
  const history = [
    ...Array(Math.max(0, config.windowDays - trimmedHistory.length)).fill(0),
    ...trimmedHistory
  ];
  const historyAverage = history.reduce((sum, value) => sum + value, 0) / config.windowDays;
  const savedPeak = Math.max(0, Number(raw.peakAverage) || 0);
  const startedAt = validIso(raw.startedAt)
    ? new Date(raw.startedAt).toISOString()
    : oldestBarrierDate(barriers) || fallback.startedAt;
  const savedAchievements = Array.isArray(raw.rankAchievedAt) ? raw.rankAchievedAt : [];
  const rankAchievedAt = Array.from({ length: config.kekkaishiRankNames.length }, (_, index) => {
    if (index === 0) return startedAt;
    return validIso(savedAchievements[index]) ? new Date(savedAchievements[index]).toISOString() : null;
  });
  return {
    lifetimeOutput: Math.max(0, Number(raw.lifetimeOutput) || 0),
    dailyHistory: history,
    peakAverage: Math.max(savedPeak, historyAverage),
    peakAchievedAt: typeof raw.peakAchievedAt === "string" && Number.isFinite(Date.parse(raw.peakAchievedAt))
      ? raw.peakAchievedAt
      : historyAverage > savedPeak ? new Date(now).toISOString() : "",
    lastEvaluatedAt: Number.isFinite(parsedLast) ? new Date(parsedLast).toISOString() : fallback.lastEvaluatedAt,
    lastDailyPower: Math.max(0, Number(raw.lastDailyPower) || 0),
    kekkaiCreatedCount: Math.max(0, Math.floor(Number(raw.kekkaiCreatedCount) || 0)),
    startedAt,
    rankAchievedAt
  };
}

export function recordKekkaishiRankAchievements(status, achievedAt = Date.now(), config = BARRIER_EVALUATION_CONFIG) {
  if (!status || typeof status !== "object") return false;
  const normalized = normalizeKekkaishiStatus(status, achievedAt, status.kekkaiCreatedCount, config);
  const timestamp = new Date(achievedAt).toISOString();
  let changed = false;
  if (status.startedAt !== normalized.startedAt) {
    status.startedAt = normalized.startedAt;
    changed = true;
  }
  if (!Array.isArray(status.rankAchievedAt) || status.rankAchievedAt.length !== normalized.rankAchievedAt.length) {
    status.rankAchievedAt = [...normalized.rankAchievedAt];
    changed = true;
  } else {
    if (status.rankAchievedAt[0] !== status.startedAt) changed = true;
    status.rankAchievedAt[0] = status.startedAt;
    for (let index = 1; index < status.rankAchievedAt.length; index += 1) {
      if (!validIso(status.rankAchievedAt[index]) && status.rankAchievedAt[index] !== null) {
        status.rankAchievedAt[index] = null;
        changed = true;
      }
    }
  }
  const rank = rankForKekkaishi(status, config);
  for (let index = 1; index <= rank.index; index += 1) {
    if (status.rankAchievedAt[index] !== null) continue;
    status.rankAchievedAt[index] = timestamp;
    changed = true;
  }
  return changed;
}

export function rankAchievementDays(status, rankIndex, config = BARRIER_EVALUATION_CONFIG) {
  const index = Math.max(0, Math.min(config.kekkaishiRankNames.length - 1, Math.floor(Number(rankIndex) || 0)));
  const startedAt = Date.parse(status?.startedAt);
  const achievedAt = Date.parse(status?.rankAchievedAt?.[index]);
  if (!Number.isFinite(startedAt) || !Number.isFinite(achievedAt)) return null;
  return Math.max(0, Math.floor((achievedAt - startedAt) / DAY_MS));
}

export function rankForActiveDays(activeDays, config = BARRIER_EVALUATION_CONFIG) {
  const values = Array.isArray(activeDays) ? activeDays : [];
  let index = 0;
  for (let rank = 0; rank < config.daysRequired.length; rank += 1) {
    if ((Number(values[rank]) || 0) >= config.daysRequired[rank]) index = rank;
  }
  return {
    index,
    name: config.rankNames[index],
    reading: config.rankReadings[index],
    days: Number(values[index]) || 0,
    daysRequired: config.daysRequired[index],
    powerThreshold: config.powerThresholds[index]
  };
}

export function rankForBarrier(log, barrierId, config = BARRIER_EVALUATION_CONFIG) {
  return rankForActiveDays(log?.barriers?.[barrierId]?.rankProgress?.activeDays, config);
}

export function recentAverage(status, config = BARRIER_EVALUATION_CONFIG) {
  const history = Array.isArray(status?.dailyHistory) ? status.dailyHistory : [];
  return history.reduce((sum, value) => sum + (Number(value) || 0), 0) / config.windowDays;
}

export function currentBarrierPower(log) {
  return Object.keys(log?.barriers || {}).reduce((total, barrierId) => {
    const score = scoreBarrier(log, barrierId);
    return total + Math.max(0, Number(score?.power) || 0);
  }, 0);
}

export function liveCumulativeBarrierSpirit(log, now = Date.now()) {
  const status = log?.kekkaishi;
  const base = Math.max(0, Number(status?.lifetimeOutput) || 0);
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(nowMs)) return base;

  const evaluatedAt = Date.parse(status?.lastEvaluatedAt);
  let total = base;
  for (const [barrierId, barrier] of Object.entries(log?.barriers || {})) {
    const score = scoreBarrier(log, barrierId);
    const power = Math.max(0, Number(score?.power) || 0);
    if (power <= 0) continue;
    const createdAt = Date.parse(barrier?.createdAt);
    const startAt = Number.isFinite(evaluatedAt)
      ? Math.max(evaluatedAt, Number.isFinite(createdAt) ? createdAt : evaluatedAt)
      : createdAt;
    if (!Number.isFinite(startAt) || nowMs <= startAt) continue;
    total += power * (nowMs - startAt) / DAY_MS;
  }
  return total;
}

export function rankForKekkaishi(status, config = BARRIER_EVALUATION_CONFIG) {
  const lifetime = Math.max(0, Number(status?.lifetimeOutput) || 0);
  const peak = Math.max(0, Number(status?.peakAverage) || 0);
  let index = 0;
  for (let rank = 0; rank < config.kekkaishiRankNames.length; rank += 1) {
    if (lifetime >= config.kekkaishiLifetimeThresholds[rank]) index = rank;
  }
  return {
    index,
    name: config.kekkaishiRankNames[index],
    lifetime,
    peak,
    nextLifetime: config.kekkaishiLifetimeThresholds[Math.min(index + 1, config.kekkaishiRankNames.length - 1)]
  };
}

export function evaluationSettingsSnapshot(config = BARRIER_EVALUATION_CONFIG) {
  return {
    weatherRate: Number(BARRIER_CONFIG.weatherRate),
    powerThresholds: [...config.powerThresholds],
    daysRequired: [...config.daysRequired],
    kekkaishiLifetimeThresholds: [...config.kekkaishiLifetimeThresholds],
    windowDays: Number(config.windowDays),
    scaleL0: Number(BARRIER_SCORE_CONFIG.scaleL0),
    shapeCoefficients: { ...BARRIER_SCORE_CONFIG.shapeCoefficients },
    stoneCapVertex: Number(BARRIER_CONFIG.stoneCapVertex),
    dailyGrant: Number(BARRIER_CONFIG.dailyGrant),
    maxVertices: Number(BARRIER_CONFIG.maxVertices),
    maxVerticesByRank: [...BARRIER_CONFIG.maxVerticesByRank],
    sightRadiusKm: [...BARRIER_CONFIG.sightRadiusKm],
    crossLinkFromRank: Number(BARRIER_CONFIG.crossLinkFromRank),
    stoneCapVertexByRank: [...BARRIER_CONFIG.stoneCapVertexByRank],
    ryumyakuScatter: [...BARRIER_CONFIG.ryumyakuScatter],
    rotationFromRank: Number(BARRIER_CONFIG.rotationFromRank),
    beautyTolerance: Number(BARRIER_SCORE_CONFIG.beautyTolerance),
    beautyToleranceTiles: Number(BARRIER_SCORE_CONFIG.beautyToleranceTiles),
    beautyGamma: Number(BARRIER_SCORE_CONFIG.beautyGamma)
  };
}

export function barrierRankStoneProgress(score, barrier, config = BARRIER_EVALUATION_CONFIG, rankIndex = 0) {
  const nextIndex = Math.min(
    Number(score?.rank?.index) + 1,
    config.powerThresholds.length - 1
  );
  if (!score || nextIndex <= Number(score?.rank?.index)) {
    return { max: true, nextIndex, requiredStoneCount: 0, missingStoneCount: 0, maxStoneCount: 0, reachable: true, maxPower: Number(score?.power) || 0 };
  }
  const coefficient = Math.max(
    0,
    Number(score.shapeCoefficient) || 0
  ) * Math.max(0, Number(score.beautyCoefficient) || 0) * Math.max(0, Number(score.scaleCoefficient) || 0);
  const nextPower = Number(config.powerThresholds[nextIndex]) || 0;
  const requiredStoneCount = coefficient > 0 ? Math.ceil(nextPower / coefficient) : Number.POSITIVE_INFINITY;
  const currentStoneCount = Math.max(0, Number(score.stoneCount) || 0);
  const capIndex = Math.max(0, Math.min(BARRIER_CONFIG.stoneCapVertexByRank.length - 1, Math.floor(Number(rankIndex) || 0)));
  const stoneCap = Number(BARRIER_CONFIG.stoneCapVertexByRank[capIndex]) || BARRIER_CONFIG.stoneCapVertex;
  const maxStoneCount = Math.max(0, Number(barrier?.vertices?.length) || 0) * Math.max(0, stoneCap);
  const maxPower = maxStoneCount * coefficient;
  return {
    max: false,
    nextIndex,
    nextPower,
    requiredStoneCount,
    missingStoneCount: Math.max(0, requiredStoneCount - currentStoneCount),
    maxStoneCount,
    maxPower,
    reachable: requiredStoneCount <= maxStoneCount
  };
}

export function applyWeathering(log, days = 0, eventAt = Date.now(), config = BARRIER_CONFIG) {
  const vertexIds = new Set(Object.values(log?.barriers || {}).flatMap((barrier) => barrier?.vertices || []));
  const elapsedDays = Math.max(0, Math.floor(Number(days) || 0));
  if (elapsedDays < 1) return false;
  const rawRate = Number(config.weatherRate);
  const rate = Number.isFinite(rawRate) ? Math.min(0.999999, Math.max(0, rawRate)) : BARRIER_CONFIG.weatherRate;
  const decay = Math.pow(1 - rate, elapsedDays);
  let changed = false;
  for (const stoneId of vertexIds) {
    const stone = log?.stones?.[stoneId];
    if (!stone || stoneExactCount(stone) <= 0) continue;
    const beforeExact = stoneExactCount(stone);
    const beforeDisplay = stoneDisplayCount(stone);
    const afterExact = Math.max(1, beforeExact * decay);
    const afterDisplay = Math.floor(afterExact);
    stone.countExact = afterExact;
    stone.count = afterDisplay;
    if (afterDisplay !== beforeDisplay) {
      appendBarrierEvent(log, {
        type: "stone-weathered",
        at: new Date(eventAt).toISOString(),
        tile: stone.tile,
        stoneId,
        barrierId: barrierIdForStone(log, stoneId),
        amount: Math.max(1, beforeDisplay - afterDisplay),
        countExact: afterExact
      });
      changed = true;
    }
  }
  return changed;
}

export function evaluateBarrierLog(log, now = Date.now(), config = BARRIER_EVALUATION_CONFIG) {
  if (!log || typeof log !== "object") return { changed: false, days: 0, dailyPower: 0 };
  const barrierCount = Object.keys(log.barriers || {}).length;
  const previousStatus = JSON.stringify(log.kekkaishi);
  log.kekkaishi = normalizeKekkaishiStatus(log.kekkaishi, now, barrierCount, config, log.barriers);
  const status = log.kekkaishi;
  const lastEvaluatedAt = Date.parse(status.lastEvaluatedAt);
  const statusNormalized = previousStatus !== JSON.stringify(status);
  if (!Number.isFinite(lastEvaluatedAt) || now <= lastEvaluatedAt) return { changed: statusNormalized, days: 0, dailyPower: status.lastDailyPower };
  const days = Math.floor((now - lastEvaluatedAt) / DAY_MS);
  if (days < 1) return { changed: statusNormalized, days: 0, dailyPower: status.lastDailyPower };

  appendEvaluationSettingsEvent(log, now, config);
  const weathered = applyWeathering(log, days, now, BARRIER_CONFIG);
  let dailyPower = 0;
  for (const [barrierId, barrier] of Object.entries(log.barriers || {})) {
    const score = scoreBarrier(log, barrierId);
    const powerNow = Math.max(0, Number(score?.power) || 0);
    const progress = normalizeRankProgress(barrier.rankProgress);
    const powerPrevious = progress.lastPower === null ? powerNow : Math.max(0, Number(progress.lastPower) || 0);
    const conservativePower = Math.min(powerPrevious, powerNow);
    dailyPower += conservativePower;
    for (let rank = 0; rank < config.powerThresholds.length; rank += 1) {
      if (conservativePower >= config.powerThresholds[rank]) progress.activeDays[rank] += days;
    }
    progress.lastPower = powerNow;
    barrier.rankProgress = progress;
  }

  status.lifetimeOutput += dailyPower * days;
  recordKekkaishiRankAchievements(status, now, config);
  status.dailyHistory.push(...Array.from({ length: Math.min(days, config.windowDays) }, () => dailyPower));
  status.dailyHistory = status.dailyHistory.slice(-config.windowDays);
  status.lastDailyPower = dailyPower;
  status.lastEvaluatedAt = new Date(lastEvaluatedAt + days * DAY_MS).toISOString();
  const average = recentAverage(status, config);
  if (average > status.peakAverage) {
    status.peakAverage = average;
    status.peakAchievedAt = new Date(now).toISOString();
  }
  appendBarrierEvent(log, {
    type: "daily-evaluation",
    at: new Date(now).toISOString(),
    elapsedDays: days,
    lastEvaluatedAt: status.lastEvaluatedAt,
    dailyPower,
    lifetimeOutput: status.lifetimeOutput
  });
  return { changed: true, days, dailyPower, average, weathered };
}

function appendEvaluationSettingsEvent(log, now, config) {
  const settings = evaluationSettingsSnapshot(config);
  const previous = [...(Array.isArray(log?.events) ? log.events : [])]
    .reverse()
    .find((event) => event?.type === "evaluation-settings");
  const previousSettings = previous ? evaluationSettingsSnapshotFromEvent(previous) : null;
  if (previousSettings && JSON.stringify(previousSettings) === JSON.stringify(settings)) return false;
  appendBarrierEvent(log, { type: "evaluation-settings", at: new Date(now).toISOString(), ...settings });
  return true;
}

function evaluationSettingsSnapshotFromEvent(event) {
  return {
    weatherRate: Number(event.weatherRate),
    powerThresholds: Array.isArray(event.powerThresholds) ? [...event.powerThresholds] : [],
    daysRequired: Array.isArray(event.daysRequired) ? [...event.daysRequired] : [],
    kekkaishiLifetimeThresholds: Array.isArray(event.kekkaishiLifetimeThresholds) ? [...event.kekkaishiLifetimeThresholds] : [],
    windowDays: Number(event.windowDays),
    scaleL0: Number(event.scaleL0),
    shapeCoefficients: event.shapeCoefficients && typeof event.shapeCoefficients === "object"
      ? { ...event.shapeCoefficients }
      : {},
    stoneCapVertex: Number(event.stoneCapVertex),
    dailyGrant: Number(event.dailyGrant),
    maxVertices: Number(event.maxVertices),
    maxVerticesByRank: Array.isArray(event.maxVerticesByRank) ? [...event.maxVerticesByRank] : [],
    sightRadiusKm: Array.isArray(event.sightRadiusKm) ? [...event.sightRadiusKm] : [],
    crossLinkFromRank: Number(event.crossLinkFromRank),
    stoneCapVertexByRank: Array.isArray(event.stoneCapVertexByRank) ? [...event.stoneCapVertexByRank] : [],
    ryumyakuScatter: Array.isArray(event.ryumyakuScatter) ? [...event.ryumyakuScatter] : [],
    rotationFromRank: Number(event.rotationFromRank),
    beautyTolerance: Number(event.beautyTolerance),
    beautyToleranceTiles: Number(event.beautyToleranceTiles),
    beautyGamma: Number(event.beautyGamma)
  };
}

export function normalizeRankProgress(raw) {
  const activeDays = Array.from({ length: BARRIER_EVALUATION_CONFIG.daysRequired.length }, (_, index) =>
    Math.max(0, Number(raw?.activeDays?.[index]) || 0)
  );
  const parsed = Date.parse(raw?.lastEvaluatedAt);
  return {
    activeDays,
    lastPower: raw && raw.lastPower !== null && raw.lastPower !== undefined ? Math.max(0, Number(raw.lastPower) || 0) : null
  };
}

export function resetBarrierRankProgress(barrier, power = 0, now = Date.now()) {
  barrier.rankProgress = {
    activeDays: Array(BARRIER_EVALUATION_CONFIG.daysRequired.length).fill(0),
    lastPower: Math.max(0, Number(power) || 0)
  };
  return barrier.rankProgress;
}

function barrierIdForStone(log, stoneId) {
  return Object.entries(log?.barriers || {})
    .find(([, barrier]) => Array.isArray(barrier?.vertices) && barrier.vertices.includes(stoneId))?.[0] || null;
}

function validIso(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function oldestBarrierDate(barriers) {
  const dates = Object.values(barriers || {})
    .map((barrier) => Date.parse(barrier?.createdAt))
    .filter(Number.isFinite);
  return dates.length > 0 ? new Date(Math.min(...dates)).toISOString() : null;
}
