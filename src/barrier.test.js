import { describe, expect, it } from "vitest";
import {
  BARRIER_CONFIG,
  BARRIER_LOG_SCHEMA_VERSION,
  appendBarrierEvent,
  createBarrierLog,
  dissolveBarrier,
  grantBarrierStock,
  replayBarrierEvents,
  normalizeGuardian,
  maxVerticesForRank,
  registerBarrier,
  ryumyakuScatterForRank,
  sanitizeBarrierLog,
  sightRadiusKmForRank,
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
      schemaVersion: BARRIER_LOG_SCHEMA_VERSION,
      stones: {},
      barriers: {},
      events: [],
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
    expect(log).not.toHaveProperty("tiles");
    expect(log).not.toHaveProperty("stock.lat");
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
    expect(log.events).toHaveLength(1);
    expect(log.events[0]).toMatchObject({ type: "barrier-snapshot" });
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
    expect(log.events).toContainEqual(expect.objectContaining({
      type: "barrier-created",
      barrierId: "first",
      vertices
    }));
    expect(validateBarrierVertices(log, vertices)).toMatchObject({ ok: false, reason: "used" });
    expect(validateBarrierVertices(log, [vertices[0], vertices[0], vertices[1]])).toMatchObject({ ok: false, reason: "duplicate" });
  });

  it("dissolves a barrier while leaving its stones available", () => {
    const log = createBarrierLog();
    const vertices = ["18/232798/103246", "18/232799/103246", "18/232800/103246"]
      .map(stoneIdFromTile);
    vertices.forEach((stoneId, index) => {
      log.stones[stoneId] = {
        tile: `18/${232798 + index}/103246`,
        count: 1,
        countExact: 1,
        firstAt: "2026-08-13T00:00:00Z",
        lastAt: "2026-08-13T00:00:00Z"
      };
    });
    registerBarrier(log, { id: "first", vertices });

    expect(dissolveBarrier(log, "first", Date.parse("2026-08-14T00:00:00Z"))).toMatchObject({ ok: true });
    expect(log.barriers).toEqual({});
    expect(Object.keys(log.stones)).toHaveLength(3);
    expect(log.events.at(-1)).toMatchObject({ type: "barrier-dissolved", barrierId: "first" });
    expect(replayBarrierEvents(log.events).barriers).toEqual({});
  });

  it("limits newly created barriers to the configured vertex cap", () => {
    const log = createBarrierLog();
    const vertices = Array.from({ length: BARRIER_CONFIG.maxVertices + 1 }, (_, index) => {
      const tile = `18/${232798 + index}/103246`;
      const stoneId = stoneIdFromTile(tile);
      log.stones[stoneId] = { tile, count: 1, countExact: 1, firstAt: "2026-08-13T00:00:00Z", lastAt: "2026-08-13T00:00:00Z" };
      return stoneId;
    });
    expect(validateBarrierVertices(log, vertices.slice(0, 2))).toMatchObject({ ok: false, reason: "too-few" });
    expect(validateBarrierVertices(log, vertices.slice(0, 3))).toEqual({ ok: true });
    expect(validateBarrierVertices(log, vertices.slice(0, BARRIER_CONFIG.maxVertices))).toEqual({ ok: true });
    expect(validateBarrierVertices(log, vertices)).toMatchObject({ ok: false, reason: "too-many", maxVertices: BARRIER_CONFIG.maxVertices });
  });

  it("exposes monotonic rank gates for vertices, sight, and Dragon Eye scatter", () => {
    expect(BARRIER_CONFIG.maxVertices).toBe(8);
    expect(maxVerticesForRank(0)).toBe(3);
    expect(maxVerticesForRank(8)).toBe(8);
    expect(sightRadiusKmForRank(0)).toBe(1);
    expect(sightRadiusKmForRank(8)).toBe(300);
    expect(ryumyakuScatterForRank(0)).toBeCloseTo(0.15);
    expect(ryumyakuScatterForRank(8)).toBeCloseTo(0.05);
  });

  it("grants one stone at 12:00, 20:00, and 04:00 in local time", () => {
    const firstCheck = new Date(2026, 7, 13, 11, 59).getTime();
    const log = createBarrierLog(firstCheck);
    log.stock.amount = 0;

    expect(grantBarrierStock(log, firstCheck)).toBe(false);
    expect(grantBarrierStock(log, new Date(2026, 7, 13, 12, 0).getTime())).toBe(true);
    expect(log.stock.amount).toBe(1);
    expect(grantBarrierStock(log, new Date(2026, 7, 13, 19, 59).getTime())).toBe(false);
    expect(grantBarrierStock(log, new Date(2026, 7, 13, 20, 0).getTime())).toBe(true);
    expect(log.stock.amount).toBe(2);
    expect(grantBarrierStock(log, new Date(2026, 7, 14, 3, 59).getTime())).toBe(false);
    expect(grantBarrierStock(log, new Date(2026, 7, 14, 4, 0).getTime())).toBe(true);
    expect(log.stock.amount).toBe(3);
    expect(log.stock.lastGrantAt).toBe(new Date(2026, 7, 14, 4, 0).toISOString());
  });

  it("catches up missed grant times without exceeding the stock cap", () => {
    const lastGrantAt = new Date(2026, 7, 1, 0, 0).getTime();
    const now = new Date(2026, 7, 13, 0, 0).getTime();
    const log = createBarrierLog(lastGrantAt);
    log.stock.amount = 1;
    expect(grantBarrierStock(log, now)).toBe(true);
    expect(log.stock.amount).toBe(BARRIER_CONFIG.stockCap);
    expect(log.stock.lastGrantAt).toBe(new Date(2026, 7, 12, 20, 0).toISOString());
  });

  it("normalizes an optional fixed guardian point on a barrier", () => {
    const log = createBarrierLog();
    const vertices = ["18/232798/103246", "18/232799/103246", "18/232800/103246"].map(stoneIdFromTile);
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
    registerBarrier(log, {
      id: "guarded",
      name: "守護付き",
      vertices,
      guardian: { lat: 35.681, lng: 139.767, label: "皇居", placedAt: "2026-08-13T01:00:00Z" }
    });
    expect(log.barriers.guarded.guardian).toMatchObject({ lat: 35.681, lng: 139.767, label: "皇居" });
  });

  it("provides bounds for drawing a barrier tile", () => {
    const bounds = tileBounds("18/232798/103246");
    expect(bounds.east).toBeGreaterThan(bounds.west);
    expect(bounds.north).toBeGreaterThan(bounds.south);
  });

  it("preserves stone placement inputs and replays them", () => {
    const log = createBarrierLog();
    const tile = "18/232798/103246";
    const stoneId = stoneIdFromTile(tile);
    appendBarrierEvent(log, {
      type: "stone-placed",
      at: "2026-08-13T09:00:00Z",
      tile,
      stoneId,
      barrierId: null,
      amount: 1
    });
    appendBarrierEvent(log, {
      type: "stone-placed",
      at: "2026-08-14T09:00:00Z",
      tile,
      stoneId,
      barrierId: "barrier-1",
      amount: 2
    });
    appendBarrierEvent(log, {
      type: "stone-picked",
      at: "2026-08-15T09:00:00Z",
      tile,
      stoneId,
      barrierId: "barrier-1",
      amount: 1
    });
    const replayed = replayBarrierEvents(log.events);
    expect(log.events).toMatchObject([
      { type: "stone-placed", tile, at: "2026-08-13T09:00:00Z", barrierId: null },
      { type: "stone-placed", tile, at: "2026-08-14T09:00:00Z", barrierId: "barrier-1", amount: 2 },
      { type: "stone-picked", tile, at: "2026-08-15T09:00:00Z", barrierId: "barrier-1", amount: 1 }
    ]);
    expect(replayed.stones[stoneId]).toMatchObject({ tile, count: 2, firstAt: "2026-08-13T09:00:00Z", lastAt: "2026-08-15T09:00:00Z" });
  });

  it("rebuilds current stones from v2 events when loading", () => {
    const tile = "18/232798/103246";
    const stoneId = stoneIdFromTile(tile);
    const raw = {
      type: "barrier-log",
      schemaVersion: BARRIER_LOG_SCHEMA_VERSION,
      stones: {},
      barriers: {},
      events: [
        { id: "event-1", type: "stone-placed", at: "2026-08-13T09:00:00Z", tile, stoneId, barrierId: null, amount: 1 },
        { id: "event-2", type: "stone-placed", at: "2026-08-14T09:00:00Z", tile, stoneId, barrierId: null, amount: 1 }
      ],
      stock: { amount: 1, lastGrantAt: "2026-08-14T09:00:00Z" }
    };
    const { log } = sanitizeBarrierLog(raw, Date.parse("2026-08-14T12:00:00Z"));
    expect(log.stones[stoneId]).toMatchObject({ tile, count: 2 });
    expect(log.events).toHaveLength(2);
  });

  it("replays guardian placement, label changes, and removal", () => {
    const vertices = ["a", "b", "c"];
    const events = [
      { type: "barrier-created", at: "2026-08-13T09:00:00Z", barrierId: "barrier-1", name: "守護", vertices },
      { type: "guardian-placed", at: "2026-08-13T09:01:00Z", barrierId: "barrier-1", guardian: { lat: 35, lng: 139, label: "最初", placedAt: "2026-08-13T09:01:00Z" } },
      { type: "guardian-label-updated", at: "2026-08-13T09:02:00Z", barrierId: "barrier-1", label: "変更後" }
    ];
    const replayed = replayBarrierEvents(events);
    expect(replayed.barriers["barrier-1"].guardian).toBeNull();
    expect(normalizeGuardian({ lat: 91, lng: 139 })).toBeNull();
    const removed = replayBarrierEvents([...events, { type: "guardian-removed", at: "2026-08-13T09:03:00Z", barrierId: "barrier-1" }]);
    expect(removed.barriers["barrier-1"].guardian).toBeNull();
  });
});
