import { describe, expect, it } from "vitest";
import { BARRIER_CONFIG, createBarrierLog, registerBarrier, replayBarrierEvents, stoneCapFor, stoneDisplayCount, stoneIdFromTile } from "./barrier.js";
import {
  BARRIER_EVALUATION_CONFIG,
  applyWeathering,
  barrierRankStoneProgress,
  createKekkaishiStatus,
  evaluationSettingsSnapshot,
  evaluateBarrierLog,
  normalizeKekkaishiStatus,
  rankAchievementDays,
  rankForKekkaishi,
  recentAverage,
  recordKekkaishiRankAchievements
} from "./barrier-evaluation.js";

function triangleLog() {
  const createdAt = "2026-08-01T00:00:00.000Z";
  const log = createBarrierLog(Date.parse(createdAt));
  const tiles = ["18/232798/103246", "18/232799/103246", "18/232798/103247"];
  const vertices = tiles.map(stoneIdFromTile);
  vertices.forEach((stoneId, index) => {
    log.stones[stoneId] = {
      tile: tiles[index],
      lat: null,
      lng: null,
      count: 1,
      firstAt: createdAt,
      lastAt: createdAt
    };
  });
  registerBarrier(log, { id: "triangle", name: "三角", vertices, createdAt });
  return log;
}

describe("barrier evaluation", () => {
  it("uses the loose cap until a stone becomes a vertex", () => {
    const log = createBarrierLog();
    const tile = "18/232798/103246";
    const stoneId = stoneIdFromTile(tile);
    log.stones[stoneId] = { tile, count: 1, firstAt: "2026-08-01T00:00:00Z", lastAt: "2026-08-01T00:00:00Z" };
    for (const otherTile of ["18/232799/103246", "18/232798/103247"]) {
      const otherId = stoneIdFromTile(otherTile);
      log.stones[otherId] = { tile: otherTile, count: 1, firstAt: "2026-08-01T00:00:00Z", lastAt: "2026-08-01T00:00:00Z" };
    }
    expect(stoneCapFor(log, stoneId)).toBe(BARRIER_CONFIG.stoneCapLoose);
    registerBarrier(log, {
      id: "triangle",
      vertices: [stoneId, stoneIdFromTile("18/232799/103246"), stoneIdFromTile("18/232798/103247")],
      createdAt: "2026-08-01T00:00:00Z"
    });
    expect(stoneCapFor(log, stoneId)).toBe(BARRIER_CONFIG.stoneCapVertex);
  });

  it("evaluates elapsed whole days once and keeps raw event history", () => {
    const log = triangleLog();
    const first = evaluateBarrierLog(log, Date.parse("2026-08-02T12:00:00.000Z"));
    expect(first.days).toBe(1);
    expect(log.kekkaishi.lastEvaluatedAt).toBe("2026-08-02T00:00:00.000Z");
    expect(log.kekkaishi.dailyHistory).toHaveLength(BARRIER_EVALUATION_CONFIG.windowDays);
    expect(log.kekkaishi.dailyHistory.at(-1)).toBeGreaterThan(0);
    expect(log.barriers.triangle.rankProgress).not.toHaveProperty("lastEvaluatedAt");
    expect(evaluateBarrierLog(log, Date.parse("2026-08-02T12:00:00.000Z")).changed).toBe(false);
    expect(log.events.some((event) => event.type === "barrier-created")).toBe(true);
  });

  it("weathers low-count vertices on the configured interval", () => {
    const log = triangleLog();
    log.stones[stoneIdFromTile("18/232798/103246")].count = 2;
    const result = evaluateBarrierLog(log, Date.parse("2026-08-16T00:00:00.000Z"));
    expect(result.weathered).toBe(true);
    expect(log.stones[stoneIdFromTile("18/232798/103246")].count).toBe(1);
    expect(log.events.findLast((event) => event.type === "stone-weathered")).toMatchObject({ type: "stone-weathered", amount: 1 });
  });

  it("uses exponential fractional weathering without a stick threshold", () => {
    const log = triangleLog();
    const vertexId = stoneIdFromTile("18/232798/103246");
    log.stones[vertexId].countExact = 100;
    log.stones[vertexId].count = 100;
    expect(applyWeathering(log, 10, Date.parse("2026-08-11T00:00:00.000Z"))).toBe(true);
    expect(stoneDisplayCount(log.stones[vertexId])).toBe(99);
    expect(log.stones[vertexId].countExact).toBeCloseTo(100 * (0.999 ** 10), 10);
    expect(log.events.at(-1)).toMatchObject({ type: "stone-weathered", countExact: log.stones[vertexId].countExact });
  });

  it("is invariant to splitting the elapsed days across evaluations", () => {
    const onePass = triangleLog();
    const splitPass = triangleLog();
    const vertexId = stoneIdFromTile("18/232798/103246");
    onePass.stones[vertexId].countExact = 100;
    onePass.stones[vertexId].count = 100;
    splitPass.stones[vertexId].countExact = 100;
    splitPass.stones[vertexId].count = 100;
    applyWeathering(onePass, 365);
    for (let day = 0; day < 365; day += 1) applyWeathering(splitPass, 1);
    expect(splitPass.stones[vertexId].countExact).toBeCloseTo(onePass.stones[vertexId].countExact, 12);
  });

  it("replays fractional weathering from the event payload", () => {
    const log = triangleLog();
    const vertexId = stoneIdFromTile("18/232798/103246");
    log.stones[vertexId].countExact = 100;
    log.stones[vertexId].count = 100;
    applyWeathering(log, 365, Date.parse("2027-08-01T00:00:00.000Z"));
    const replayed = replayBarrierEvents(log.events);
    expect(replayed.stones[vertexId].countExact).toBeCloseTo(log.stones[vertexId].countExact, 12);
  });

  it("leaves loose stones untouched and keeps a vertex above one exact stone", () => {
    const log = triangleLog();
    const looseTile = "18/232801/103246";
    const looseId = stoneIdFromTile(looseTile);
    log.stones[looseId] = { tile: looseTile, countExact: 20, count: 20 };
    const vertexId = stoneIdFromTile("18/232798/103246");
    log.stones[vertexId].countExact = 1.0001;
    log.stones[vertexId].count = 1;
    applyWeathering(log, 100000);
    expect(log.stones[looseId].countExact).toBe(20);
    expect(log.stones[vertexId].countExact).toBeGreaterThanOrEqual(1);
  });

  it("uses only lifetime output for player rank and keeps peak display data", () => {
    expect(BARRIER_EVALUATION_CONFIG.kekkaishiLifetimeThresholds).toEqual([0, 800, 8000, 40000, 160000, 800000, 4000000, 20000000, 100000000]);
    expect(BARRIER_EVALUATION_CONFIG).not.toHaveProperty("kekkaishiPeakThresholds");
    expect(BARRIER_EVALUATION_CONFIG).not.toHaveProperty("kekkaishiSustainDays");
    const status = { lifetimeOutput: BARRIER_EVALUATION_CONFIG.kekkaishiLifetimeThresholds[2], peakAverage: 0, dailyHistory: [5] };
    expect(rankForKekkaishi(status).name).toBe("D");
    status.peakAverage = 100000;
    expect(rankForKekkaishi(status).name).toBe("D");
    expect(recentAverage(status)).toBeCloseTo(5 / BARRIER_EVALUATION_CONFIG.windowDays);
    expect(BARRIER_EVALUATION_CONFIG.kekkaishiRankNames).toHaveLength(9);
  });

  it("allows E rank on the first evaluated day when lifetime threshold is met", () => {
    const lifetime = BARRIER_EVALUATION_CONFIG.kekkaishiLifetimeThresholds[1];
    expect(rankForKekkaishi({ lifetimeOutput: lifetime, peakAverage: 0 }).name).toBe("E");
  });

  it("records rank achievement timestamps once and never overwrites them", () => {
    const startedAt = "2026-08-01T00:00:00.000Z";
    const status = createKekkaishiStatus(Date.parse(startedAt));
    status.lifetimeOutput = BARRIER_EVALUATION_CONFIG.kekkaishiLifetimeThresholds[3];
    expect(recordKekkaishiRankAchievements(status, "2026-08-05T00:00:00.000Z")).toBe(true);
    const first = [...status.rankAchievedAt];
    expect(first.slice(0, 4).every(Boolean)).toBe(true);
    expect(first.slice(4).every((value) => value === null)).toBe(true);
    expect(rankAchievementDays(status, 0)).toBe(0);
    expect(rankAchievementDays(status, 3)).toBe(4);
    expect(recordKekkaishiRankAchievements(status, "2026-08-20T00:00:00.000Z")).toBe(false);
    expect(status.rankAchievedAt).toEqual(first);
  });

  it("can record multiple rank achievements on the first evaluated day", () => {
    const status = createKekkaishiStatus(Date.parse("2026-08-01T00:00:00.000Z"));
    status.lifetimeOutput = BARRIER_EVALUATION_CONFIG.kekkaishiLifetimeThresholds.at(-1);
    recordKekkaishiRankAchievements(status, "2026-08-02T00:00:00.000Z");
    expect(status.rankAchievedAt.every(Boolean)).toBe(true);
    expect(new Set(status.rankAchievedAt).size).toBe(2);
  });

  it("migrates startedAt from the oldest barrier and preserves existing achievements", () => {
    const existing = "2026-08-04T00:00:00.000Z";
    const status = normalizeKekkaishiStatus({
      lifetimeOutput: BARRIER_EVALUATION_CONFIG.kekkaishiLifetimeThresholds[2],
      rankAchievedAt: ["2026-08-02T00:00:00.000Z", existing]
    }, Date.parse("2026-08-20T00:00:00.000Z"), 1, BARRIER_EVALUATION_CONFIG, {
      old: { createdAt: "2026-08-01T00:00:00.000Z" }
    });
    expect(status.startedAt).toBe("2026-08-01T00:00:00.000Z");
    expect(status.rankAchievedAt[1]).toBe(existing);
    expect(status.rankAchievedAt).toHaveLength(BARRIER_EVALUATION_CONFIG.kekkaishiRankNames.length);
    expect(rankAchievementDays(status, 2)).toBeNull();
  });

  it("calculates barrier stone progress from the next power threshold", () => {
    const score = { power: 24, rank: { index: 0 }, stoneCount: 24, shapeCoefficient: 1, beautyCoefficient: 2, scaleCoefficient: 1 };
    const progress = barrierRankStoneProgress(score, { vertices: ["a", "b", "c"] });
    expect(progress.requiredStoneCount).toBe(13);
    expect(progress.missingStoneCount).toBe(0);
    expect(progress.reachable).toBe(true);
    expect(progress.maxPower).toBe(600);
  });

  it("records one settings event and one daily evaluation event per elapsed evaluation", () => {
    const log = triangleLog();
    const first = evaluateBarrierLog(log, Date.parse("2026-08-02T00:00:00.000Z"));
    expect(first.days).toBe(1);
    expect(log.events.filter((event) => event.type === "evaluation-settings")).toHaveLength(1);
    expect(log.events.at(-1)).toMatchObject({
      type: "daily-evaluation",
      elapsedDays: 1,
      lastEvaluatedAt: "2026-08-02T00:00:00.000Z",
      dailyPower: first.dailyPower,
      lifetimeOutput: log.kekkaishi.lifetimeOutput
    });
    evaluateBarrierLog(log, Date.parse("2026-08-03T00:00:00.000Z"));
    expect(log.events.filter((event) => event.type === "evaluation-settings")).toHaveLength(1);
    expect(log.events.filter((event) => event.type === "daily-evaluation")).toHaveLength(2);
  });

  it("records settings again only when the evaluation settings change", () => {
    const log = triangleLog();
    const changedConfig = {
      ...BARRIER_EVALUATION_CONFIG,
      powerThresholds: [...BARRIER_EVALUATION_CONFIG.powerThresholds.slice(0, -1), 102401]
    };
    evaluateBarrierLog(log, Date.parse("2026-08-02T00:00:00.000Z"));
    evaluateBarrierLog(log, Date.parse("2026-08-03T00:00:00.000Z"), changedConfig);
    const settingsEvents = log.events.filter((event) => event.type === "evaluation-settings");
    expect(settingsEvents).toHaveLength(2);
    expect(settingsEvents.at(-1).powerThresholds.at(-1)).toBe(102401);
    expect(settingsEvents.at(-1)).toMatchObject(evaluationSettingsSnapshot(changedConfig));
  });

  it("records the complete shape coefficient table with evaluation settings", () => {
    const snapshot = evaluationSettingsSnapshot();
    expect(snapshot.shapeCoefficients).toMatchObject({
      heptagon: 2.1,
      octagon: 2.4,
      star: 3,
      octagram: 4
    });
    const log = triangleLog();
    evaluateBarrierLog(log, Date.parse("2026-08-02T00:00:00Z"));
    expect(log.events.find((event) => event.type === "evaluation-settings")).toMatchObject({
      shapeCoefficients: snapshot.shapeCoefficients
    });
  });

  it("zero-fills short histories and uses a fixed 90-day average", () => {
    const status = normalizeKekkaishiStatus({ dailyHistory: [10, 20], peakAverage: 0 }, Date.parse("2026-08-14T00:00:00Z"));
    expect(status.dailyHistory).toHaveLength(BARRIER_EVALUATION_CONFIG.windowDays);
    expect(status.dailyHistory.slice(0, -2).every((value) => value === 0)).toBe(true);
    expect(recentAverage(status)).toBeCloseTo(30 / BARRIER_EVALUATION_CONFIG.windowDays);
  });

  it("never lowers peakAverage during subsequent evaluations or migration", () => {
    const migrated = normalizeKekkaishiStatus({ dailyHistory: [1], peakAverage: 50 }, Date.parse("2026-08-14T00:00:00Z"));
    expect(migrated.peakAverage).toBe(50);
    const log = triangleLog();
    evaluateBarrierLog(log, Date.parse("2026-08-02T00:00:00Z"));
    const peak = log.kekkaishi.peakAverage;
    evaluateBarrierLog(log, Date.parse("2026-08-03T00:00:00Z"));
    expect(log.kekkaishi.peakAverage).toBeGreaterThanOrEqual(peak);
  });
});
