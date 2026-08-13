import { describe, expect, it } from "vitest";
import {
  BARRIER_SCORE_CONFIG,
  beautyCoefficient,
  nonZeroPolygonAreaKm2,
  rankForScore,
  scoreBarrier,
  scaleCoefficient,
  shapeCoefficient,
  sphericalPolygonAreaKm2
} from "./barrier-score.js";
import { BARRIER_CONFIG } from "./barrier.js";
import { BARRIER_EVALUATION_CONFIG } from "./barrier-evaluation.js";

const triangle = [
  { lat: 35.681236, lng: 139.767125 },
  { lat: 35.6895, lng: 139.6917 },
  { lat: 35.6586, lng: 139.7454 }
];

function destinationGeo(origin, distanceKm, bearingDegrees) {
  const earthRadiusKm = BARRIER_SCORE_CONFIG.earthRadiusKm;
  const angularDistance = distanceKm / earthRadiusKm;
  const bearing = bearingDegrees * Math.PI / 180;
  const originLat = origin.lat * Math.PI / 180;
  const originLng = origin.lng * Math.PI / 180;
  const latitude = Math.asin(
    Math.sin(originLat) * Math.cos(angularDistance)
      + Math.cos(originLat) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const longitude = originLng + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(originLat),
    Math.cos(angularDistance) - Math.sin(originLat) * Math.sin(latitude)
  );
  return { lat: latitude * 180 / Math.PI, lng: longitude * 180 / Math.PI };
}

function regularPentagram(radiusKm) {
  const center = { lat: 35, lng: 139 };
  return Array.from({ length: 5 }, (_, index) => destinationGeo(center, radiusKm, 90 + index * 144));
}

function relativeDifference(actual, expected) {
  return Math.abs(actual - expected) / expected;
}

describe("barrier score helpers", () => {
  it("calculates a positive spherical area", () => {
    expect(sphericalPolygonAreaKm2(triangle)).toBeGreaterThan(0);
  });

  it("uses the non-zero area rule for regular pentagrams", () => {
    const expectedCoefficient = 1.1226;
    for (const radiusKm of [10, 30]) {
      const area = nonZeroPolygonAreaKm2(regularPentagram(radiusKm));
      expect(relativeDifference(area, expectedCoefficient * radiusKm ** 2)).toBeLessThan(0.01);
    }
  });

  it("does not count the pentagram center twice", () => {
    const radiusKm = 10;
    const area = nonZeroPolygonAreaKm2(regularPentagram(radiusKm));
    const signedArea = 1.4695 * radiusKm ** 2;
    expect(area).toBeLessThan(signedArea);
    expect(area / signedArea).toBeCloseTo(1.1226 / 1.4695, 2);
  });

  it("adds both regions of a bow-tie polygon instead of canceling them", () => {
    const bowTie = [
      { lat: 34.99, lng: 138.99 },
      { lat: 35.01, lng: 139.01 },
      { lat: 35.01, lng: 138.99 },
      { lat: 34.99, lng: 139.01 }
    ];
    const center = { lat: 35, lng: 139 };
    const expected = sphericalPolygonAreaKm2([center, bowTie[1], bowTie[2]])
      + sphericalPolygonAreaKm2([center, bowTie[3], bowTie[0]]);
    const area = nonZeroPolygonAreaKm2(bowTie);
    expect(area).toBeGreaterThan(0);
    expect(relativeDifference(area, expected)).toBeLessThan(0.01);
  });

  it("keeps simple polygon areas unchanged", () => {
    const polygons = [
      triangle,
      [
        { lat: 35.01, lng: 139 },
        { lat: 35, lng: 139.01 },
        { lat: 34.99, lng: 139 },
        { lat: 35, lng: 138.99 }
      ],
      [
        { lat: 35.01, lng: 139 },
        { lat: 35.003, lng: 139.009 },
        { lat: 34.992, lng: 139.006 },
        { lat: 34.992, lng: 138.994 },
        { lat: 35.003, lng: 138.991 }
      ],
      [
        { lat: 35.01, lng: 139 },
        { lat: 35.005, lng: 139.009 },
        { lat: 34.995, lng: 139.009 },
        { lat: 34.99, lng: 139 },
        { lat: 34.995, lng: 138.991 },
        { lat: 35.005, lng: 138.991 }
      ]
    ];
    for (const polygon of polygons) {
      expect(nonZeroPolygonAreaKm2(polygon)).toBeCloseTo(sphericalPolygonAreaKm2(polygon), 8);
    }
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

  it("uses the saturating scale coefficient reference values", () => {
    expect(scaleCoefficient(0.3)).toBeCloseTo(0.54, 2);
    expect(scaleCoefficient(3.9)).toBeCloseTo(1.85, 2);
    expect(scaleCoefficient(112)).toBeCloseTo(7.83, 1);
    expect(scaleCoefficient(1010)).toBeCloseTo(15.43, 2);
    expect(scaleCoefficient(60000)).toBeCloseTo(26.73, 2);
    expect(scaleCoefficient(Number.MAX_VALUE)).toBeLessThanOrEqual(BARRIER_SCORE_CONFIG.scaleL0);
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

  it("keeps the pentagram above every creatable convex polygon", () => {
    const polygonMetrics = Array.from({ length: BARRIER_CONFIG.maxVertices - 2 }, (_, index) => {
      const vertexCount = index + 3;
      return vertexCount * BARRIER_CONFIG.stoneCapVertex * shapeCoefficient(vertexCount, false);
    });
    const pentagramMetric = 5 * BARRIER_CONFIG.stoneCapVertex * shapeCoefficient(5, true);
    expect(pentagramMetric).toBeGreaterThan(Math.max(...polygonMetrics));
  });

  it("keeps shiniki reachable only through the pentagram upper bound", () => {
    const shiniki = BARRIER_EVALUATION_CONFIG.powerThresholds.at(-1);
    const upperBound = (vertexCount, selfIntersecting = false) => (
      vertexCount
      * BARRIER_CONFIG.stoneCapVertex
      * shapeCoefficient(vertexCount, selfIntersecting)
      * BARRIER_SCORE_CONFIG.beautyMax
      * BARRIER_SCORE_CONFIG.scaleL0
    );
    expect(upperBound(5, true)).toBeGreaterThan(shiniki);
    for (let vertexCount = 3; vertexCount <= BARRIER_CONFIG.maxVertices; vertexCount += 1) {
      expect(upperBound(vertexCount)).toBeLessThan(shiniki);
    }
    expect(upperBound(5, true)).toBeGreaterThanOrEqual(shiniki * 1.2);
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
