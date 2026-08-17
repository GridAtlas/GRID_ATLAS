import { describe, expect, it } from "vitest";
import { resolveLineBodyDragCandidate } from "./drag-hit-testing.js";

describe("line-body drag hit testing", () => {
  it("keeps an independent line candidate when a figure covers the same point", () => {
    const line = { id: "line-1" };
    const point = { x: 120, y: 80 };

    expect(resolveLineBodyDragCandidate({
      point,
      findNearestLink: () => line
    })).toBe(line);
  });

  it("does not turn a line endpoint into a drag candidate", () => {
    expect(resolveLineBodyDragCandidate({
      point: { x: 120, y: 80 },
      lineEndpoint: { link: { id: "line-1" }, side: "a" },
      findNearestLink: () => ({ id: "line-1" })
    })).toBeNull();
  });
});
