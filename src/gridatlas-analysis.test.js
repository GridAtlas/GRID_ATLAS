import { describe, expect, it } from "vitest";
import {
  GRIDATLAS_ANALYSIS_EXTENSION,
  buildGridAtlasAnalysisLayer,
  readGridAtlasAnalysisLayer,
  withoutGridAtlasAnalysisLayer
} from "./gridatlas-analysis.js";

function vertex(lat, lng, name, placeRef = null) {
  return { lat, lng, name, placeRef };
}

describe("GRID ATLAS analysis extension", () => {
  it("builds a figure-only extension when the shared document has no places", () => {
    const layer = buildGridAtlasAnalysisLayer([], [{
      id: "figure-only",
      vertices: [vertex(35, 135, "A"), vertex(35.1, 135.1, "B"), vertex(35.2, 135, "C")],
      closed: true
    }]);

    expect(layer).toEqual({
      version: 1,
      lines: [],
      figures: [{
        id: "figure-only",
        vertices: [
          { lat: 35, lng: 135, key: "geo:35:135", name: "A", placeRef: null },
          { lat: 35.1, lng: 135.1, key: "geo:35.1:135.1", name: "B", placeRef: null },
          { lat: 35.2, lng: 135, key: "geo:35.2:135", name: "C", placeRef: null }
        ],
      }]
    });
  });

  it("serializes explicitly selected lines and figures without requiring points", () => {
    expect(buildGridAtlasAnalysisLayer([
      {
        id: "line-1",
        a: vertex(35, 135, "A", "place-a"),
        b: vertex(35.1, 135.1, "B", "place-b"),
        strokeId: "stroke-1",
        color: "#D95F8A",
        createdAt: "2026-08-11T00:00:00.000Z"
      }
    ], [
      {
        id: "figure-1",
        vertices: [vertex(35, 135, "A", "place-a"), vertex(35.1, 135.1, "B", "place-b"), vertex(35.2, 135, "C")],
        name: "三角形",
        color: "#AABBCC",
        createdAt: "2026-08-11T00:00:00.000Z"
      }
    ])).toEqual({
      version: 1,
      lines: [{
        id: "line-1",
        a: { lat: 35, lng: 135, key: "geo:35:135", name: "A", placeRef: "place-a" },
        b: { lat: 35.1, lng: 135.1, key: "geo:35.1:135.1", name: "B", placeRef: "place-b" },
        color: "#d95f8a",
        strokeId: "stroke-1"
      }],
      figures: [{
        id: "figure-1",
        vertices: [
          { lat: 35, lng: 135, key: "geo:35:135", name: "A", placeRef: "place-a" },
          { lat: 35.1, lng: 135.1, key: "geo:35.1:135.1", name: "B", placeRef: "place-b" },
          { lat: 35.2, lng: 135, key: "geo:35.2:135", name: "C", placeRef: null }
        ],
        name: "三角形",
        color: "#aabbcc",
        createdAt: "2026-08-11T00:00:00.000Z"
      }]
    });
  });

  it("reads only io.gridatlas.analysis and keeps vertex snapshots independent of places", () => {
    const document = {
      places: [],
      extensions: {
        [GRIDATLAS_ANALYSIS_EXTENSION]: {
          version: 1,
          lines: [{
            id: "line-1",
            a: vertex(35, 135, "A", "missing-a"),
            b: vertex(35.1, 135.1, "B", "missing-b")
          }],
          figures: [{
            id: "figure-1",
            vertices: [vertex(35, 135, "A"), vertex(35.1, 135.1, "B"), vertex(35.2, 135, "C")],
            closed: true
          }]
        },
        "io.gridatlas.lines": {
          version: 1,
          items: [{ id: "old-line", a: "missing-a", b: "missing-b" }]
        }
      }
    };

    expect(readGridAtlasAnalysisLayer(document)).toEqual({
      lines: [{
        id: "line-1",
        a: { lat: 35, lng: 135, key: "geo:35:135", name: "A", placeRef: "missing-a" },
        b: { lat: 35.1, lng: 135.1, key: "geo:35.1:135.1", name: "B", placeRef: "missing-b" }
      }],
      figures: [{
        id: "figure-1",
        vertices: [
          { lat: 35, lng: 135, key: "geo:35:135", name: "A", placeRef: null },
          { lat: 35.1, lng: 135.1, key: "geo:35.1:135.1", name: "B", placeRef: null },
          { lat: 35.2, lng: 135, key: "geo:35.2:135", name: "C", placeRef: null }
        ],
      }]
    });
  });

  it("ignores the retired io.gridatlas.lines extension", () => {
    expect(readGridAtlasAnalysisLayer({
      extensions: {
        "io.gridatlas.lines": {
          version: 1,
          items: [{ id: "old-line", a: "a", b: "b" }]
        }
      }
    })).toEqual({ lines: [], figures: [] });
  });

  it("removes only the new extension and preserves the old extension as unknown data", () => {
    expect(withoutGridAtlasAnalysisLayer({
      [GRIDATLAS_ANALYSIS_EXTENSION]: { version: 1, lines: [], figures: [] },
      "io.gridatlas.lines": { version: 1, items: [] },
      "example.custom": { enabled: true }
    })).toEqual({
      "io.gridatlas.lines": { version: 1, items: [] },
      "example.custom": { enabled: true }
    });
  });
});
