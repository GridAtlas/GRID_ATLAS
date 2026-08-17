import { describe, expect, it } from "vitest";
import { chooseAnalysisHit } from "./analysis-hit-priority.js";

describe("analysis hit priority", () => {
  it("prefers a line endpoint over a figure vertex at the same location", () => {
    const result = chooseAnalysisHit([
      { kind: "figure-vertex", value: { figureId: "figure-1" } },
      { kind: "line-endpoint", value: { linkId: "line-1", side: "a" } }
    ]);

    expect(result).toEqual({
      kind: "line-endpoint",
      value: { linkId: "line-1", side: "a" }
    });
  });

  it("keeps the point, line, and surface ordering explicit", () => {
    const result = chooseAnalysisHit([
      { kind: "figure-surface", value: "surface" },
      { kind: "line", value: "line" },
      { kind: "point", value: "point" },
      { kind: "figure-edge", value: "edge" }
    ]);

    expect(result.value).toBe("point");
  });
});
