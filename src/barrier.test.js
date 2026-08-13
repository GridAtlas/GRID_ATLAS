import { describe, expect, it } from "vitest";
import {
  BARRIER_CONFIG,
  createBarrierLog,
  grantBarrierStock,
  registerBarrier,
  sanitizeBarrierLog,
  stoneIdFromTile,
  tileBounds,
  tileIdFromGeo,
  validateBarrierVertices
} from "./barrier.js";

describe("barrier data helpers", () => {
  it("creates the barrier-log v1 schema", () => {
    const log = createBarrierLog(Date.parse("2026-08-13T00:00:00Z"));
    expect(log).toMatchObject({
      type: "barrier-log",
      schemaVersion: 1,
      stones: {},
      barriers: {},
      stock: { amount: BARRIER_CONFIG.dailyGrant }
    });
  });

  it("migrates the existing traverse log without retaining coordinates", () => {
    const tileId = tileIdFromGeo({ lat: 35.681236, lng: 139.767125 });
    const { log, changed } = sanitizeBarrierLog({
      type: "traverse-log",
      schemaVersion: 2,
      tiles: { [tileId]: { count: 2, lat: 35.6, lng: 139.7 } },
      stock: { amount: 2, lastGrantAt: new Date().toISOString(), lat: 35.6 }
    });
    const stoneId = stoneIdFromTile(tileId);
    expect(changed).toBe(true);
    expect(log.type).toBe("barrier-log");
    expect(log.stones[stoneId]).toMatchObject({ tile: tileId, lat: null, lng: null, count: 2 });
    expect(JSON.stringify(log)).not.toContain("35.6");
  });

  it("normalizes stones and rejects invalid or overlapping barriers", () => {
    const tileA = "18/232798/103246";
    const tileB = "18/232799/103246";
    const tileC = "18/232800/103246";
    const stoneA = stoneIdFromTile(tileA);
    const stoneB = stoneIdFromTile(tileB);
    const stoneC = stoneIdFromTile(tileC);
    const { log } = sanitizeBarrierLog({
      type: "barrier-log",
      schemaVersion: 1,
      stones: {
        [stoneA]: { tile: tileA, count: 2, lat: 35, lng: 139 },
        [stoneB]: { tile: tileB, count: 1 },
        [stoneC]: { tile: tileC, count: 1 }
      },
      barriers: {
        valid: { name: "三角", vertices: [stoneA, stoneB, stoneC], createdAt: "2026-08-13T00:00:00Z" },
        duplicate: { name: "重複", vertices: [stoneA, stoneA, stoneB] },
        shared: { name: "共有", vertices: [stoneA, stoneB, stoneC] }
      },
      stock: { amount: 1, lastGrantAt: "2026-08-13T00:00:00Z" }
    });
    expect(log.stones[stoneA].lat).toBeNull();
    expect(Object.keys(log.barriers)).toEqual(["valid"]);
  });

  it("validates and registers a barrier without sharing stones", () => {
    const log = createBarrierLog();
    const vertices = ["18/232798/103246", "18/232799/103246", "18/232800/103246"]
      .map(stoneIdFromTile);
    vertices.forEach((stoneId, index) => {
      log.stones[stoneId] = {
        tile: `18/${232798 + index}/103246`,
        lat: null,
        lng: null,
        count: 1,
        firstAt: "2026-08-13T00:00:00Z",
        lastAt: "2026-08-13T00:00:00Z"
      };
    });
    expect(validateBarrierVertices(log, vertices)).toEqual({ ok: true });
    expect(registerBarrier(log, { id: "first", name: "三角", vertices })).toMatchObject({ ok: true });
    expect(validateBarrierVertices(log, vertices)).toMatchObject({ ok: false, reason: "used" });
    expect(validateBarrierVertices(log, [vertices[0], vertices[0], vertices[1]])).toMatchObject({ ok: false, reason: "duplicate" });
  });

  it("grants three stones per elapsed day up to the cap", () => {
    const now = Date.parse("2026-08-13T00:00:00Z");
    const log = createBarrierLog(Date.parse("2026-08-01T00:00:00Z"));
    log.stock.amount = 1;
    expect(grantBarrierStock(log, now)).toBe(true);
    expect(log.stock.amount).toBe(BARRIER_CONFIG.stockCap);
  });

  it("provides bounds for drawing a barrier tile", () => {
    const bounds = tileBounds("18/232798/103246");
    expect(bounds.east).toBeGreaterThan(bounds.west);
    expect(bounds.north).toBeGreaterThan(bounds.south);
  });
});
