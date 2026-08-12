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

  it("accepts both point objects and raw geographies for shared distance calculations", () => {
    const first = { geo: { lat: 35.681236, lng: 139.767125 } };
    const second = { lat: 35.689592, lng: 139.700413 };

    expect(vincentyDistanceMeters(first, second)).toBeCloseTo(vincentyDistanceMeters(first.geo, second), 6);
  });
});
