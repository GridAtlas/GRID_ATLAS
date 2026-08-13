import { describe, expect, it } from "vitest";
import {
  TRAVERSE_CONFIG,
  createTraverseLog,
  sanitizeTraverseLog,
  tileBounds,
  tileIdFromGeo
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
    expect(log.schemaVersion).toBe(2);
    expect(log.tileOrder).toEqual([tileId]);
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

  it("provides bounds for drawing a barrier tile", () => {
    const bounds = tileBounds("18/232798/103246");
    expect(bounds.east).toBeGreaterThan(bounds.west);
    expect(bounds.north).toBeGreaterThan(bounds.south);
  });
});
