import { describe, expect, it } from "vitest";
import {
  GRIDATLAS_LINE_LAYER_EXTENSION,
  buildGridAtlasLineLayer,
  readGridAtlasLineLayer,
  withoutGridAtlasLineLayer
} from "./gridatlas-analysis.js";

describe("GRID ATLAS analysis line layer", () => {
  it("serializes only lines whose endpoints belong to the shared list", () => {
    const layer = buildGridAtlasLineLayer([
      { id: "line-1", a: "local-a", b: "local-b", createdAt: "2026-08-11T00:00:00.000Z", strokeId: "stroke-1", color: "#D95F8A" },
      { id: "line-2", a: "local-a", b: "outside" }
    ], (id) => ({ "local-a": "place-a", "local-b": "place-b" }[id] || ""));

    expect(layer).toEqual({
      version: 1,
      items: [{
        id: "line-1",
        a: "place-a",
        b: "place-b",
        createdAt: "2026-08-11T00:00:00.000Z",
        strokeId: "stroke-1",
        color: "#d95f8a"
      }]
    });
  });

  it("maps shared endpoints back to local point ids", () => {
    const document = {
      extensions: {
        [GRIDATLAS_LINE_LAYER_EXTENSION]: {
          version: 1,
          items: [{ id: "line-1", a: "place-a", b: "place-b", strokeId: "stroke-1", color: "#D95F8A" }]
        }
      }
    };

    expect(readGridAtlasLineLayer(
      document,
      (id) => ({ "place-a": "local-a", "place-b": "local-b" }[id] || ""),
      () => "local-line"
    )).toEqual([{ id: "local-line", a: "local-a", b: "local-b", strokeId: "stroke-1", color: "#d95f8a" }]);
  });

  it("removes the line extension when preserving unrelated document extensions", () => {
    expect(withoutGridAtlasLineLayer({
      "io.gridatlas.lines": { version: 1, items: [] },
      "example.custom": { enabled: true }
    })).toEqual({ "example.custom": { enabled: true } });
  });
});
