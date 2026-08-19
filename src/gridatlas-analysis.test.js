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

  it("restores the retired line extension from its referenced places", () => {
    expect(readGridAtlasAnalysisLayer({
      places: [
        { id: "a", name: "A", position: { latitude: 35, longitude: 135 } },
        { id: "b", name: "B", position: { latitude: 35.1, longitude: 135.1 } }
      ],
      extensions: {
        "io.gridatlas.lines": {
          version: 1,
          items: [{ id: "old-line", a: "a", b: "b" }]
        }
      }
    })).toEqual({
      lines: [{
        id: "old-line",
        a: { lat: 35, lng: 135, key: "geo:35:135", name: "A", placeRef: "a" },
        b: { lat: 35.1, lng: 135.1, key: "geo:35.1:135.1", name: "B", placeRef: "b" }
      }],
      figures: []
    });
  });

  it("restores every valid legacy line without treating it as an unknown extension", () => {
    const places = ["a", "b", "c", "d", "e", "f"].map((id, index) => ({
      id,
      name: id.toUpperCase(),
      position: { latitude: 35 + index / 10, longitude: 135 + index / 10 }
    }));
    const items = [
      { id: "legacy-1", a: "a", b: "b" },
      { id: "legacy-2", a: "b", b: "c" },
      { id: "legacy-3", a: "c", b: "d" },
      { id: "legacy-4", a: "d", b: "e" },
      { id: "legacy-5", a: "e", b: "a" }
    ];

    const layer = readGridAtlasAnalysisLayer({
      places,
      extensions: { "io.gridatlas.lines": { version: 1, items } }
    });

    expect(layer.lines.map((line) => line.id)).toEqual(items.map((item) => item.id));
    expect(layer.lines.every((line) => line.a.placeRef && line.b.placeRef)).toBe(true);
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
