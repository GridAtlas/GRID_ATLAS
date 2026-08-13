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

  it("treats endpoint snapshots with different ids as the same geometric vertex", () => {
    const points = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 1, y: 0 },
      { id: "c", x: 1, y: 1 },
      { id: "d", x: 0, y: 1 }
    ];
    const result = analyzeSegmentShape([
      { a: points[0], b: points[1] },
      { a: { ...points[1], id: "b-snapshot" }, b: points[2] },
      { a: points[2], b: { ...points[3], id: "d-snapshot" } },
      { a: points[3], b: { ...points[0], id: "a-snapshot" } }
    ]);

    expect(result.valid).toBe(true);
    expect(result.vertexCount).toBe(4);
    expect(result.edgeCount).toBe(4);
  });

  it("tolerates tiny coordinate differences when an endpoint returns to a vertex", () => {
    const points = [
      { id: "a", x: 0, y: 0, geo: { lat: 35, lng: 135 } },
      { id: "b", x: 1000, y: 0, geo: { lat: 35, lng: 135.01 } },
      { id: "c", x: 1000, y: 1000, geo: { lat: 35.01, lng: 135.01 } },
      { id: "d", x: 0, y: 1000, geo: { lat: 35.01, lng: 135 } }
    ];
    const result = analyzeSegmentShape([
      { a: points[0], b: points[1] },
      { a: { ...points[1], id: "b-returned", geo: { lat: 35.0000004, lng: 135.0100004 } }, b: points[2] },
      { a: points[2], b: { ...points[3], id: "d-returned", geo: { lat: 35.0100004, lng: 134.9999996 } } },
      { a: points[3], b: { ...points[0], id: "a-returned", geo: { lat: 35.0000004, lng: 135.0000004 } } }
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
