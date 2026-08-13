import { describe, expect, it } from "vitest";
import { analyzeLineIntersection, analyzeRegularPolygon, analyzeSegmentShape, vincentyDistanceMeters } from "./shape-analysis.js";

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

  it("uses a stable endpoint key when copied points have different ids", () => {
    const points = [
      { id: "a", endpointKey: "geo:35:135", x: 0, y: 0 },
      { id: "b", endpointKey: "geo:35:135.01", x: 1, y: 0 },
      { id: "c", endpointKey: "geo:35.01:135.01", x: 1, y: 1 },
      { id: "d", endpointKey: "geo:35.01:135", x: 0, y: 1 }
    ];
    const result = analyzeSegmentShape([
      { a: points[0], b: points[1] },
      { a: { ...points[1], id: "b-copy" }, b: points[2] },
      { a: points[2], b: { ...points[3], id: "d-copy" } },
      { a: points[3], b: { ...points[0], id: "a-copy" } }
    ]);

    expect(result.valid).toBe(true);
    expect(result.vertexCount).toBe(4);
    expect(result.edgeCount).toBe(4);
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
});
