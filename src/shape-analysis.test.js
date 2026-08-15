import { describe, expect, it } from "vitest";
import { createAnalysisFigure, figureEdges } from "./analysis-layer.js";
import { analyzeLineIntersection, analyzeOpenPath, analyzeRegularPolygon, analyzeSegmentShape, vincentyDistanceMeters } from "./shape-analysis.js";

describe("shape analysis", () => {
  it("finds the crossing angle of two finite segments", () => {
    const result = analyzeLineIntersection(
      { a: { x: 0, y: 0 }, b: { x: 10, y: 10 } },
      { a: { x: 0, y: 10 }, b: { x: 10, y: 0 } }
    );

    expect(result.intersects).toBe(true);
    expect(result.point.x).toBeCloseTo(5);
    expect(result.point.y).toBeCloseTo(5);
    expect(result.angle).toBeCloseTo(90);
  });

  it("scores a square as a regular quadrilateral", () => {
    const result = analyzeRegularPolygon([
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 }
    ]);

    expect(result.valid).toBe(true);
    expect(result.score).toBeCloseTo(100);
    expect(result.angles.every((angle) => Math.abs(angle - 90) < 0.001)).toBe(true);
  });

  it("keeps regular-polygon distances independent from x/y scale when geo is present", () => {
    const points = [
      { x: -1, y: -1, geo: { lat: 35.6, lng: 139.6 } },
      { x: 1, y: -1, geo: { lat: 35.6, lng: 139.7 } },
      { x: 1, y: 1, geo: { lat: 35.7, lng: 139.7 } },
      { x: -1, y: 1, geo: { lat: 35.7, lng: 139.6 } }
    ];
    const original = analyzeRegularPolygon(points);
    const scaled = analyzeRegularPolygon(points.map((point) => ({ ...point, x: point.x / 2, y: point.y / 2 })));

    expect(scaled.meanSide).toBeCloseTo(original.meanSide, 6);
  });

  it("reports when segments only meet on their extensions", () => {
    const result = analyzeLineIntersection(
      { a: { x: 0, y: 0 }, b: { x: 1, y: 0 } },
      { a: { x: 2, y: -1 }, b: { x: 2, y: 1 } }
    );

    expect(result.intersects).toBe(false);
    expect(result.reason).toBe("extension");
  });

  it("detects a five-point star from the selected segment cycle", () => {
    const points = Array.from({ length: 5 }, (_, index) => {
      const angle = (index * Math.PI * 2) / 5;
      return {
        id: `p${index}`,
        x: Math.cos(angle),
        y: Math.sin(angle),
        geo: { lat: 35 + Math.sin(angle), lng: 135 + Math.cos(angle) }
      };
    });
    const segments = [[0, 2], [2, 4], [4, 1], [1, 3], [3, 0]]
      .map(([a, b]) => ({ a: points[a], b: points[b] }));

    const result = analyzeSegmentShape(segments);

    expect(result.valid).toBe(true);
    expect(result.n).toBe(5);
    expect(result.k).toBe(2);
    expect(result.selfIntersections).toBe(5);
    expect(result.idealAngle).toBeCloseTo(36);
    expect(result.idealDiagonalToSide).toBeCloseTo(0.6180339887, 5);
  });

  it("scores the Kinki pentagram with the overlay-distance reference fit", () => {
    const points = [
      [34.4601, 134.8525],
      [33.8406, 135.7734],
      [34.4550, 136.7252],
      [35.4178, 136.4064],
      [35.4304, 135.1543]
    ].map(([lat, lng], index) => ({ id: `p${index}`, x: 0, y: 0, geo: { lat, lng } }));
    const segments = [[0, 2], [2, 4], [4, 1], [1, 3], [3, 0]]
      .map(([a, b]) => ({ a: points[a], b: points[b] }));

    const result = analyzeSegmentShape(segments);

    expect(result.valid).toBe(true);
    expect(result.k).toBe(2);
    expect(result.referenceScore).toBeCloseTo(84.9, 1);
  });

  it("keeps the reference fit independent from polygon or star traversal", () => {
    const points = [
      [34.4601, 134.8525],
      [33.8406, 135.7734],
      [34.4550, 136.7252],
      [35.4178, 136.4064],
      [35.4304, 135.1543]
    ].map(([lat, lng], index) => ({ id: `p${index}`, x: 0, y: 0, geo: { lat, lng } }));
    const polygon = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]]
      .map(([a, b]) => ({ a: points[a], b: points[b] }));
    const star = [[0, 2], [2, 4], [4, 1], [1, 3], [3, 0]]
      .map(([a, b]) => ({ a: points[a], b: points[b] }));

    const polygonResult = analyzeSegmentShape(polygon);
    const starResult = analyzeSegmentShape(star);

    expect(polygonResult.valid).toBe(true);
    expect(starResult.valid).toBe(true);
    expect(polygonResult.referenceScore).toBeCloseTo(starResult.referenceScore, 6);
  });

  it("uses the full vertex placement when equal sides are not a square", () => {
    const points = [
      { id: "a", x: -2, y: 0 },
      { id: "b", x: 0, y: 1.154700538 },
      { id: "c", x: 2, y: 0 },
      { id: "d", x: 0, y: -1.154700538 }
    ];
    const segments = [[0, 1], [1, 2], [2, 3], [3, 0]]
      .map(([a, b]) => ({ a: points[a], b: points[b] }));

    const result = analyzeSegmentShape(segments);

    expect(result.valid).toBe(true);
    expect(result.sideRangePercent).toBeCloseTo(0, 6);
    expect(result.referenceScore).toBeLessThan(100);
  });

  it("rejects selected lines that do not form a closed cycle", () => {
    const points = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 1, y: 0 },
      { id: "c", x: 1, y: 1 },
      { id: "d", x: 2, y: 1 }
    ];

    const result = analyzeSegmentShape([
      { a: points[0], b: points[1] },
      { a: points[1], b: points[2] },
      { a: points[2], b: points[3] }
    ]);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("not-simple-cycle");
  });

  it("reports general polygon measurements", () => {
    const points = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 1000, y: 0 },
      { id: "c", x: 1000, y: 1000 },
      { id: "d", x: 0, y: 1000 }
    ];
    const result = analyzeSegmentShape([
      { a: points[0], b: points[1] },
      { a: points[1], b: points[2] },
      { a: points[2], b: points[3] },
      { a: points[3], b: points[0] }
    ]);

    expect(result.vertexCount).toBe(4);
    expect(result.edgeCount).toBe(4);
    expect(result.area).toBeCloseTo(1_000_000);
    expect(result.meanSide).toBeCloseTo(1000);
    expect(result.longestSide).toBeCloseTo(1000);
    expect(result.shortestSide).toBeCloseTo(1000);
  });

  it("analyzes an independent figure when every vertex place reference is absent", () => {
    const figure = createAnalysisFigure({
      id: "figure-1",
      closed: true,
      vertices: [
        { lat: 35.0, lng: 135.0, name: "A", placeRef: null },
        { lat: 35.0, lng: 135.01, name: "B", placeRef: null },
        { lat: 35.01, lng: 135.01, name: "C", placeRef: null },
        { lat: 35.01, lng: 135.0, name: "D", placeRef: null }
      ]
    });
    const screenCoords = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const runtimeByKey = new Map(figure.vertices.map((vertex, index) => [
      vertex.key,
      { ...vertex, x: screenCoords[index][0], y: screenCoords[index][1], geo: { lat: vertex.lat, lng: vertex.lng }, title: vertex.name }
    ]));
    const segments = figureEdges(figure).map(({ a, b }) => ({
      a: runtimeByKey.get(a.key),
      b: runtimeByKey.get(b.key)
    }));

    const result = analyzeSegmentShape(segments);

    expect(result.valid).toBe(true);
    expect(result.vertexCount).toBe(4);
    expect(result.edgeCount).toBe(4);
    expect(result.area).toBeGreaterThan(0);
    expect(result.referenceScore).toBeGreaterThan(0);
    expect(figure.vertices.every((vertex) => vertex.placeRef === null)).toBe(true);
  });

  it("does not label a self-crossing five-edge cycle as a regular pentagon", () => {
    const points = [
      { id: "a", x: -1, y: -2 },
      { id: "b", x: 1, y: -2 },
      { id: "c", x: -2, y: 0 },
      { id: "d", x: 0, y: 2 },
      { id: "e", x: 2, y: 0 }
    ];
    const result = analyzeSegmentShape([
      { a: points[0], b: points[1] },
      { a: points[1], b: points[2] },
      { a: points[2], b: points[3] },
      { a: points[3], b: points[4] },
      { a: points[4], b: points[0] }
    ]);

    expect(result.valid).toBe(true);
    expect(result.k).toBe(1);
    expect(result.selfIntersections).toBe(1);
    expect(result.shapeKind).toBe("self-crossing");
  });

  it("accepts both point objects and raw geographies for shared distance calculations", () => {
    const first = { geo: { lat: 35.681236, lng: 139.767125 } };
    const second = { lat: 35.689592, lng: 139.700413 };

    expect(vincentyDistanceMeters(first, second)).toBeCloseTo(vincentyDistanceMeters(first.geo, second), 6);
  });

  it("measures a great-circle path and separates screen-line curvature", () => {
    const points = [
      [33.000000, 131.000000],
      [33.943520, 133.299728],
      [34.843005, 135.649547],
      [35.695991, 138.049695],
      [36.500000, 140.500000]
    ].map(([lat, lng], index) => ({ id: `a${index}`, x: 0, y: 0, geo: { lat, lng } }));
    const result = analyzeOpenPath(points.slice(0, -1).map((point, index) => ({ a: point, b: points[index + 1] })));

    expect(result.valid).toBe(true);
    expect(result.perpendicularPercent).toBeCloseTo(0.0022, 3);
    expect(result.spacingPercent).toBeCloseTo(0.0098, 3);
    expect(result.totalPercent).toBeCloseTo(0.0101, 3);
    expect(result.referenceScore).toBeCloseTo(99.90, 1);
    expect(result.mercator.deviationPercent).toBeCloseTo(0.4086, 2);
    expect(result.folded).toBe(false);
  });

  it("distinguishes a screen-straight latitude line from a great circle", () => {
    const points = [
      [35.366667, 132.685300],
      [35.366667, 134.607975],
      [35.366667, 136.530650],
      [35.366667, 138.453325],
      [35.366667, 140.376000]
    ].map(([lat, lng], index) => ({ id: `b${index}`, x: 0, y: 0, geo: { lat, lng } }));
    const result = analyzeOpenPath(points.slice(0, -1).map((point, index) => ({ a: point, b: points[index + 1] })));

    expect(result.valid).toBe(true);
    expect(result.perpendicularPercent).toBeCloseTo(0.4049, 3);
    expect(result.spacingPercent).toBeCloseTo(0.0080, 3);
    expect(result.totalPercent).toBeCloseTo(0.4050, 3);
    expect(result.referenceScore).toBeCloseTo(96.11, 1);
    expect(result.mercator.deviationPercent).toBeCloseTo(0, 4);
    expect(result.folded).toBe(false);
  });

  it("reports uneven spacing and a folded open path", () => {
    const uneven = [
      [33.000000, 131.000000],
      [33.192110, 131.455963],
      [33.943520, 133.299728],
      [36.023611, 139.023823],
      [36.500000, 140.500000]
    ].map(([lat, lng], index) => ({ id: `u${index}`, x: 0, y: 0, geo: { lat, lng } }));
    const folded = [
      [34.000000, 135.000000],
      [35.000000, 136.200000],
      [36.000000, 137.400000],
      [34.500000, 135.600000]
    ].map(([lat, lng], index) => ({ id: `f${index}`, x: 0, y: 0, geo: { lat, lng } }));
    const toSegments = (points) => points.slice(0, -1).map((point, index) => ({ a: point, b: points[index + 1] }));

    const unevenResult = analyzeOpenPath(toSegments(uneven));
    const foldedResult = analyzeOpenPath(toSegments(folded));

    expect(unevenResult.valid).toBe(true);
    expect(unevenResult.perpendicularPercent).toBeCloseTo(0.0016, 3);
    expect(unevenResult.spacingPercent).toBeCloseTo(12.5797, 2);
    expect(unevenResult.referenceScore).toBeCloseTo(44.29, 1);
    expect(foldedResult.valid).toBe(true);
    expect(foldedResult.folded).toBe(true);
    expect(foldedResult.pathLengthRatioPercent).toBeCloseTo(696.46, 1);
  });

  it("rejects branches, closed cycles, and paths without geography", () => {
    const a = { id: "a", x: 0, y: 0, geo: { lat: 35, lng: 135 } };
    const b = { id: "b", x: 1, y: 0, geo: { lat: 35, lng: 136 } };
    const c = { id: "c", x: 2, y: 0, geo: { lat: 35, lng: 137 } };
    const d = { id: "d", x: 1, y: 1, geo: { lat: 36, lng: 136 } };

    expect(analyzeOpenPath([{ a, b }, { a: b, b: c }, { a: b, b: d }]).reason).toBe("not-simple-path");
    expect(analyzeOpenPath([{ a, b }, { a: b, b: c }, { a: c, b: a }]).reason).toBe("not-simple-path");
    expect(analyzeOpenPath([{ a: { x: 0, y: 0 }, b: { x: 1, y: 0 } }, { a: { x: 1, y: 0 }, b: { x: 2, y: 0 } }]).reason).toBe("missing-geo");
  });
});
