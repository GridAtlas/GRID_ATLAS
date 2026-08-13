import { describe, expect, it } from "vitest";
import {
  TRAVERSE_CONFIG,
  createTraverseLog,
  sanitizeTraverseLog,
  tileAreaSquareMeters,
  tileIdFromGeo,
  traverseLevelForCount
} from "./traverse.js";

describe("traverse helpers", () => {
  it("uses fixed Web Mercator tile ids without retaining coordinates", () => {
    const tileId = tileIdFromGeo({ lat: 35.681236, lng: 139.767125 });
    expect(tileId).toMatch(/^18\/\d+\/\d+$/);
    const { log } = sanitizeTraverseLog({
      type: "traverse-log",
      schemaVersion: 1,
      tiles: { [tileId]: { count: 2, lat: 35.6, lng: 139.7 } },
      stock: { amount: 2, lastGrantAt: new Date().toISOString(), lat: 35.6 }
    });
    expect(JSON.stringify(log)).not.toContain("35.6");
    expect(log.tiles[tileId].count).toBe(2);
  });

  it("starts with the daily grant and caps delayed grants", () => {
    const now = Date.parse("2026-08-13T00:00:00Z");
    const { log } = sanitizeTraverseLog(null, now);
    expect(log.stock.amount).toBe(TRAVERSE_CONFIG.dailyGrant);
    const delayed = sanitizeTraverseLog({
      ...createTraverseLog(now),
      stock: { amount: 1, lastGrantAt: "2026-08-01T00:00:00Z" }
    }, now);
    expect(delayed.log.stock.amount).toBe(TRAVERSE_CONFIG.stockCap);
  });

  it("reports increasing levels and next-level progress", () => {
    expect(traverseLevelForCount(1)).toMatchObject({ level: 1, nextLevel: 2, remaining: 1 });
    expect(traverseLevelForCount(2)).toMatchObject({ level: 2, nextLevel: 3, remaining: 2 });
    expect(traverseLevelForCount(4)).toMatchObject({ level: 3, nextLevel: 4, remaining: 3 });
  });

  it("estimates a positive area for a tile", () => {
    expect(tileAreaSquareMeters("18/232798/103246")).toBeGreaterThan(0);
  });
});
