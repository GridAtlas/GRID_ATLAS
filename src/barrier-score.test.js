import { describe, expect, it } from "vitest";
import {
  BARRIER_SCORE_CONFIG,
  barrierFitsPerimeter,
  barrierLimitPerimeterKm,
  barrierPerimeterKm,
  beautyCoefficient,
  effectiveBeautyTolerance,
  effectiveStoneCount,
  geoDistanceKm,
  nonZeroPolygonAreaKm2,
  polygonSelfIntersects,
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

function regularPolygon(radiusKm, vertexCount) {
  const center = { lat: 35, lng: 139 };
  return Array.from({ length: vertexCount }, (_, index) => (
    destinationGeo(center, radiusKm, 90 + index * 360 / vertexCount)
  ));
}

function regularOctagram(radiusKm) {
  const center = { lat: 35, lng: 139 };
  const outer = Array.from({ length: 8 }, (_, index) => destinationGeo(center, radiusKm, 90 + index * 45));
  return [0, 3, 6, 1, 4, 7, 2, 5].map((index) => outer[index]);
}

function irregularOctagram(radiusKm, perturbation = 0.05) {
  const center = { lat: 35, lng: 139 };
  const radiusFactors = [
    1,
    1 + perturbation,
    1 - perturbation * 0.7,
    1 + perturbation * 0.4,
    1 - perturbation * 0.9,
    1 + perturbation * 0.6,
    1 - perturbation * 0.5,
    1 + perturbation * 0.8
  ];
  const bearingOffsets = [0, 1.2, -0.8, 1.7, -1.1, 0.9, -1.5, 0.6];
  const outer = radiusFactors.map((factor, index) => (
    destinationGeo(center, radiusKm * factor, 90 + index * 45 + bearingOffsets[index] * perturbation / 0.05)
  ));
  return [0, 3, 6, 1, 4, 7, 2, 5].map((index) => outer[index]);
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

  it("uses the non-zero area rule for regular octagrams", () => {
    const expectedCoefficient = 1.657;
    for (const radiusKm of [10, 30]) {
      const area = nonZeroPolygonAreaKm2(regularOctagram(radiusKm));
      expect(relativeDifference(area, expectedCoefficient * radiusKm ** 2)).toBeLessThan(0.01);
    }
  });

  it("keeps the octagram area ratio stable at the SSS scale", () => {
    const referenceCoefficient = nonZeroPolygonAreaKm2(regularOctagram(30)) / 30 ** 2;
    const sssCoefficient = nonZeroPolygonAreaKm2(regularOctagram(300)) / 300 ** 2;

    expect(Math.abs(sssCoefficient - referenceCoefficient) / referenceCoefficient).toBeLessThan(0.02);
  });

  it("keeps perturbed octagram area finite and continuous", () => {
    const areas = [0, 0.03, 0.06, 0.1].map((perturbation) => (
      nonZeroPolygonAreaKm2(irregularOctagram(30, perturbation))
    ));
    const baseline = areas[0];
    expect(baseline).toBeGreaterThan(0);
    for (const area of areas) {
      expect(Number.isFinite(area)).toBe(true);
      expect(area).toBeGreaterThan(baseline * 0.5);
      expect(area).toBeLessThan(baseline * 1.5);
    }
    for (let index = 1; index < areas.length; index += 1) {
      expect(Math.abs(areas[index] - areas[index - 1])).toBeLessThan(baseline * 0.25);
    }
  });

  it("handles an asymmetric eight-vertex self-intersection", () => {
    const polygon = irregularOctagram(30, 0.1);
    const area = nonZeroPolygonAreaKm2(polygon);
    const signedFanArea = sphericalPolygonAreaKm2(polygon);
    expect(polygonSelfIntersects(polygon)).toBe(true);
    expect(Number.isFinite(area)).toBe(true);
    expect(area).toBeGreaterThan(0);
    expect(Math.abs(area - signedFanArea)).toBeGreaterThan(area * 0.01);
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
    const existingHexagon = [
      { lat: 35.01, lng: 139 },
      { lat: 35.005, lng: 139.009 },
      { lat: 34.995, lng: 139.009 },
      { lat: 34.99, lng: 139 },
      { lat: 34.995, lng: 138.991 },
      { lat: 35.005, lng: 138.991 }
    ];
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
      existingHexagon,
      regularPolygon(10, 7),
      regularPolygon(10, 8)
    ];
    for (const polygon of polygons) {
      expect(nonZeroPolygonAreaKm2(polygon)).toBeCloseTo(sphericalPolygonAreaKm2(polygon), 8);
    }
  });

  it("preserves the existing six-vertex area result", () => {
    const hexagon = [
      { lat: 35.01, lng: 139 },
      { lat: 35.005, lng: 139.009 },
      { lat: 34.995, lng: 139.009 },
      { lat: 34.99, lng: 139 },
      { lat: 34.995, lng: 138.991 },
      { lat: 35.005, lng: 138.991 }
    ];
    expect(nonZeroPolygonAreaKm2(hexagon)).toBeCloseTo(sphericalPolygonAreaKm2(hexagon), 8);
  });

  it("keeps degenerate crossings finite without defining new fill semantics", () => {
    const concurrent = [
      { lat: 35, lng: 138.99 },
      { lat: 35, lng: 139.01 },
      { lat: 35.01, lng: 138.99 },
      { lat: 34.99, lng: 139.01 },
      { lat: 34.99, lng: 138.99 },
      { lat: 35.01, lng: 139.01 }
    ];
    const overlapping = [
      { lat: 34.99, lng: 138.99 },
      { lat: 35.01, lng: 139.01 },
      { lat: 35.01, lng: 138.99 },
      { lat: 34.99, lng: 139.01 },
      { lat: 35.01, lng: 139.01 },
      { lat: 34.99, lng: 138.99 }
    ];
    for (const polygon of [concurrent, overlapping]) {
      expect(() => nonZeroPolygonAreaKm2(polygon)).not.toThrow();
      expect(Number.isFinite(nonZeroPolygonAreaKm2(polygon))).toBe(true);
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

  it("uses a latitude- and zoom-aware tile tolerance floor", () => {
    const small = effectiveBeautyTolerance({ lat: 35, lng: 139 }, 500, {
      ...BARRIER_SCORE_CONFIG,
      beautyTolerance: 0.05,
      beautyToleranceTiles: 1,
      dataZoom: 18
    });
    const large = effectiveBeautyTolerance({ lat: 35, lng: 139 }, 10000, BARRIER_SCORE_CONFIG);
    expect(small).toBeGreaterThan(0.05);
    expect(large).toBeCloseTo(0.05, 6);
    expect(effectiveBeautyTolerance({ lat: 26, lng: 127 }, 500, BARRIER_SCORE_CONFIG))
      .toBeGreaterThan(effectiveBeautyTolerance({ lat: 43, lng: 141 }, 500, BARRIER_SCORE_CONFIG));
  });

  it("keeps perimeter validation separate from scoring", () => {
    const center = { lat: 35, lng: 139 };
    const within = [0, 120, 240].map((bearing) => destinationGeo(center, 1.1, bearing));
    const outside = [0, 120, 240].map((bearing) => destinationGeo(center, 1.2, bearing));
    expect(barrierFitsPerimeter(within, 0).ok).toBe(true);
    expect(barrierFitsPerimeter(outside, 0).ok).toBe(false);
    expect(barrierPerimeterKm(within)).toBeCloseTo(3 * 1.1 * Math.sqrt(3), 1);
    expect(geoDistanceKm(center, within[0])).toBeCloseTo(1.1, 2);
  });

  it("uses the ordered closing edge in the perimeter", () => {
    const center = { lat: 35, lng: 139 };
    const geos = [0, 120, 240].map((bearing) => destinationGeo(center, 2 / Math.sqrt(3), bearing));
    expect(barrierFitsPerimeter(geos, 0, BARRIER_CONFIG).perimeterKm).toBeCloseTo(6, 2);
    expect(barrierFitsPerimeter(geos, 0, BARRIER_CONFIG).ok).toBe(true);
  });

  it("measures crossing barriers by their convex-hull perimeter", () => {
    const pentagon = regularPolygon(120, 5);
    const pentagram = regularPentagram(120);
    const octagon = regularPolygon(280, 8);
    const octagram = regularOctagram(280);

    expect(polygonSelfIntersects(pentagram)).toBe(true);
    expect(barrierPerimeterKm(pentagram)).toBeGreaterThan(barrierPerimeterKm(pentagon));
    expect(barrierLimitPerimeterKm(pentagram)).toBeCloseTo(barrierPerimeterKm(pentagon), 6);
    expect(barrierFitsPerimeter(pentagram, 6)).toMatchObject({ ok: true, limitKm: 720 });

    expect(polygonSelfIntersects(octagram)).toBe(true);
    expect(barrierPerimeterKm(octagram)).toBeGreaterThan(barrierPerimeterKm(octagon));
    expect(barrierLimitPerimeterKm(octagram)).toBeCloseTo(barrierPerimeterKm(octagon), 6);
    expect(barrierFitsPerimeter(octagram, 8)).toMatchObject({ ok: true, limitKm: 1800 });
  });

  it("supports seven/eight vertices and the octagram coefficient", () => {
    expect(shapeCoefficient(7, false)).toBe(2.1);
    expect(shapeCoefficient(8, false)).toBe(2.4);
    expect(shapeCoefficient(8, true)).toBe(4);
  });

  it("uses rank thresholds from configuration", () => {
    expect(rankForScore(0).name).toBe("標");
    expect(rankForScore(BARRIER_SCORE_CONFIG.rankThresholds.at(-1)).name).toBe("天域");
  });

  it("uses the saturating scale coefficient reference values", () => {
    expect(scaleCoefficient(0.3)).toBeCloseTo(0.54, 2);
    expect(scaleCoefficient(3.9)).toBeCloseTo(1.85, 2);
    expect(scaleCoefficient(112)).toBeCloseTo(7.83, 1);
    expect(scaleCoefficient(1010)).toBeCloseTo(15.43, 2);
    expect(scaleCoefficient(60000)).toBeCloseTo(26.73, 2);
    expect(scaleCoefficient(Number.MAX_VALUE)).toBeLessThanOrEqual(BARRIER_SCORE_CONFIG.scaleL0);
  });

  it("uses the vertex centroid as the beauty reference point", () => {
    const square = [
      { lat: 35.01, lng: 139 },
      { lat: 35, lng: 139.01 },
      { lat: 34.99, lng: 139 },
      { lat: 35, lng: 138.99 }
    ];
    expect(beautyCoefficient(square, BARRIER_SCORE_CONFIG)).toBeGreaterThan(2.5);
    expect(shapeCoefficient(5, false)).toBe(1.5);
    expect(shapeCoefficient(5, true)).toBe(3);
  });

  it("keeps the pentagram above every pre-SS convex polygon", () => {
    const polygonMetrics = Array.from({ length: 6 - 2 }, (_, index) => {
      const vertexCount = index + 3;
      return vertexCount * BARRIER_CONFIG.stoneCapVertex * shapeCoefficient(vertexCount, false);
    });
    const pentagramMetric = 5 * BARRIER_CONFIG.stoneCapVertex * shapeCoefficient(5, true);
    expect(pentagramMetric).toBeGreaterThan(Math.max(...polygonMetrics));
    expect(8 * BARRIER_CONFIG.stoneCapVertex * shapeCoefficient(8, false)).toBeGreaterThan(pentagramMetric);
  });

  it("keeps shiniki gated and teniki reachable through the octagram upper bound", () => {
    const shiniki = BARRIER_EVALUATION_CONFIG.powerThresholds.at(-2);
    const teniki = BARRIER_EVALUATION_CONFIG.powerThresholds.at(-1);
    const upperBound = (vertexCount, selfIntersecting = false, stoneCap = BARRIER_CONFIG.stoneCapVertex) => (
      vertexCount
      * stoneCap
      * shapeCoefficient(vertexCount, selfIntersecting)
      * BARRIER_SCORE_CONFIG.beautyMax
      * BARRIER_SCORE_CONFIG.scaleL0
    );
    expect(upperBound(5, true)).toBeGreaterThan(shiniki);
    for (let vertexCount = 3; vertexCount <= 6; vertexCount += 1) {
      expect(upperBound(vertexCount)).toBeLessThan(shiniki);
    }
    expect(upperBound(5, true)).toBeGreaterThanOrEqual(shiniki * 1.2);
    expect(upperBound(8, true, 300)).toBeGreaterThanOrEqual(teniki * 1.2);
  });

  it("keeps configuration-derived rank limits and maximum barrier power in balance", () => {
    const powerForShape = (rankIndex, vertices, crossing = false) => {
      const perimeterLimit = BARRIER_CONFIG.perimeterLimitKm[rankIndex];
      const stoneCap = BARRIER_CONFIG.stoneCapVertexByRank[rankIndex];
      const makeVertices = (radiusKm) => {
        const polygon = regularPolygon(radiusKm, vertices);
        if (!crossing) return polygon;
        return vertices === 5
          ? [0, 2, 4, 1, 3].map((index) => polygon[index])
          : [0, 3, 6, 1, 4, 7, 2, 5].map((index) => polygon[index]);
      };
      let minimumRadius = 0;
      let maximumRadius = perimeterLimit;
      for (let attempt = 0; attempt < 48; attempt += 1) {
        const radius = (minimumRadius + maximumRadius) / 2;
        if (barrierFitsPerimeter(makeVertices(radius), rankIndex).ok) minimumRadius = radius;
        else maximumRadius = radius;
      }
      const geos = makeVertices(minimumRadius);
      const selfIntersecting = polygonSelfIntersects(geos);
      const areaKm2 = selfIntersecting ? nonZeroPolygonAreaKm2(geos) : sphericalPolygonAreaKm2(geos);
      return vertices
        * stoneCap
        * shapeCoefficient(vertices, selfIntersecting)
        * BARRIER_SCORE_CONFIG.beautyMax
        * scaleCoefficient(areaKm2);
    };
    const maxPowerForRank = (rankIndex) => {
      const maximumVertices = BARRIER_CONFIG.maxVerticesByRank[rankIndex];
      const candidates = Array.from({ length: maximumVertices - 2 }, (_, index) => ({
        vertices: index + 3,
        crossing: false
      }));
      if (rankIndex >= BARRIER_CONFIG.crossLinkFromRank && maximumVertices >= 5) {
        candidates.push({ vertices: 5, crossing: true });
      }
      if (rankIndex === BARRIER_CONFIG.maxVerticesByRank.length - 1 && maximumVertices >= 8) {
        candidates.push({ vertices: 8, crossing: true });
      }

      return Math.max(...candidates.map(({ vertices, crossing }) => powerForShape(rankIndex, vertices, crossing)));
    };
    const maxima = BARRIER_CONFIG.perimeterLimitKm.map((_, rankIndex) => maxPowerForRank(rankIndex));
    const shiniki = BARRIER_EVALUATION_CONFIG.powerThresholds.at(-2);
    const teniki = BARRIER_EVALUATION_CONFIG.powerThresholds.at(-1);

    expect(BARRIER_CONFIG.perimeterLimitKm).toEqual([...BARRIER_CONFIG.perimeterLimitKm].sort((left, right) => left - right));
    expect(maxima.every((power, index) => index === 0 || power >= maxima[index - 1])).toBe(true);
    expect(powerForShape(6, 5, true)).toBeGreaterThan(Math.max(...[3, 4, 5, 6].map((vertices) => powerForShape(6, vertices))));
    expect(maxima[5]).toBeLessThan(shiniki);
    expect(maxima[7]).toBeLessThan(teniki);
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

  it("uses the geometric mean of vertex stone counts as the effective count", () => {
    expect(effectiveStoneCount([{ count: 20 }, { count: 20 }, { count: 20 }, { count: 20 }, { count: 20 }]))
      .toBeCloseTo(100, 8);
    expect(effectiveStoneCount([{ count: 40 }, { count: 15 }, { count: 15 }, { count: 15 }, { count: 15 }]))
      .toBeCloseTo(5 * Math.pow(40 * 15 ** 4, 1 / 5), 8);
    expect(effectiveStoneCount([{ count: 40 }, { count: 15 }, { count: 15 }, { count: 15 }, { count: 15 }]))
      .toBeLessThan(100);
  });

  it("ignores retired guardian data while preserving score geometry", () => {
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
    expect(guarded.guardian).toBeNull();
    expect(guarded.stoneCount).toBe(plain.stoneCount);
    expect(guarded.areaKm2).toBeCloseTo(plain.areaKm2, 8);
    expect(guarded.shapeCoefficient).toBe(plain.shapeCoefficient);
  });
});
