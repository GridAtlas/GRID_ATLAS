import { describe, expect, it } from "vitest";
import {
  BARRIER_SCORE_CONFIG,
  beautyCoefficient,
  rankForScore,
  scoreBarrier,
  shapeCoefficient,
  sphericalPolygonAreaKm2
} from "./barrier-score.js";

const triangle = [
  { lat: 35.681236, lng: 139.767125 },
  { lat: 35.6895, lng: 139.6917 },
  { lat: 35.6586, lng: 139.7454 }
];

describe("barrier score helpers", () => {
  it("calculates a positive spherical area", () => {
    expect(sphericalPolygonAreaKm2(triangle)).toBeGreaterThan(0);
  });

  it("keeps beauty continuous and bounded", () => {
    const regular = [
      { lat: 35.68, lng: 139.76 },
      { lat: 35.70, lng: 139.78 },
      { lat: 35.68, lng: 139.80 },
      { lat: 35.66, lng: 139.78 }
    ];
    const uneven = [...regular, { lat: 35.66, lng: 139.75 }];
    expect(beautyCoefficient(regular)).toBeGreaterThanOrEqual(0.5);
    expect(beautyCoefficient(regular)).toBeLessThanOrEqual(3);
    expect(beautyCoefficient(regular)).toBeGreaterThan(beautyCoefficient(uneven));
  });

  it("uses rank thresholds from configuration", () => {
    expect(rankForScore(0).name).toBe("標");
    expect(rankForScore(BARRIER_SCORE_CONFIG.rankThresholds.at(-1)).name).toBe("神域");
  });

  it("uses a guardian as the beauty reference point without changing shape", () => {
    const square = [
      { lat: 35.01, lng: 139 },
      { lat: 35, lng: 139.01 },
      { lat: 34.99, lng: 139 },
      { lat: 35, lng: 138.99 }
    ];
    const centered = beautyCoefficient(square, BARRIER_SCORE_CONFIG, { lat: 35, lng: 139 });
    const offset = beautyCoefficient(square, BARRIER_SCORE_CONFIG, { lat: 35.005, lng: 139 });
    expect(centered).toBeGreaterThan(2.5);
    expect(offset).toBeLessThan(centered);
    expect(shapeCoefficient(5, false)).toBe(1.5);
    expect(shapeCoefficient(5, true)).toBe(3);
  });

  it("scores each barrier independently from its stones", () => {
    const log = {
      stones: {
        a: { tile: "18/232798/103246", count: 2 },
        b: { tile: "18/232799/103246", count: 3 },
        c: { tile: "18/232798/103247", count: 1 }
      },
      barriers: { first: { name: "三角", vertices: ["a", "b", "c"] } }
    };
    const score = scoreBarrier(log, "first");
    expect(score.stoneCount).toBe(6);
    expect(score.power).toBeGreaterThan(0);
    expect(score.rank.name).toBeTruthy();
  });

  it("keeps guardian data local to scoring and leaves other factors unchanged", () => {
    const baseLog = {
      stones: {
        a: { tile: "18/232798/103246", count: 2 },
        b: { tile: "18/232799/103246", count: 3 },
        c: { tile: "18/232798/103247", count: 1 }
      },
      barriers: {
        plain: { name: "無守護", vertices: ["a", "b", "c"] },
        guarded: { name: "守護あり", vertices: ["a", "b", "c"], guardian: { lat: 35.681, lng: 139.767, label: "自宅", placedAt: "2026-08-13T00:00:00Z" } }
      }
    };
    const plain = scoreBarrier(baseLog, "plain");
    const guarded = scoreBarrier(baseLog, "guarded");
    expect(guarded.guardian).toMatchObject({ lat: 35.681, lng: 139.767, label: "自宅" });
    expect(guarded.stoneCount).toBe(plain.stoneCount);
    expect(guarded.areaKm2).toBeCloseTo(plain.areaKm2, 8);
    expect(guarded.shapeCoefficient).toBe(plain.shapeCoefficient);
  });
});
