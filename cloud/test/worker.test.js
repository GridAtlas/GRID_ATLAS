import { env } from "cloudflare:workers";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../worker.js";
import { authenticateRequest } from "../auth.js";

const JWKS_URL = "https://auth.test/.well-known/jwks.json";
const ISSUER = "https://auth.test/";
const AUDIENCE = "grid-atlas-test";
let signingKey;
let publicJwk;

beforeAll(async () => {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  signingKey = keyPair.privateKey;
  publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  publicJwk.alg = "ES256";
  publicJwk.kid = "test-key";
  publicJwk.use = "sig";

  vi.stubGlobal("fetch", vi.fn(async (input) => {
    const url = typeof input === "string" ? input : input.url;
    if (url !== JWKS_URL) throw new Error(`Unexpected outbound request: ${url}`);
    return new Response(JSON.stringify({ keys: [publicJwk] }), {
      headers: { "Content-Type": "application/json" }
    });
  }));
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM cloud_lists").run();
  await env.DB.prepare("DELETE FROM cloud_assets").run();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("GRID ATLAS Cloud API", () => {
  it("maps personal and friend access codes to separate owners", async () => {
    const personalEnv = {
      PERSONAL_ACCESS_CODE: "ga_personal_test",
      PERSONAL_OWNER_ID: "personal-test",
      FRIEND_ACCESS_CODE: "ga_friend_test",
      FRIEND_OWNER_ID: "friend-test"
    };
    const authorized = await authenticateRequest(new Request("https://api.test/v1/me/lists", {
      headers: { Authorization: "Bearer ga_personal_test" }
    }), personalEnv);
    expect(authorized).toEqual({ id: "personal-test" });

    const friend = await authenticateRequest(new Request("https://api.test/v1/me/lists", {
      headers: { Authorization: "Bearer ga_friend_test" }
    }), personalEnv);
    expect(friend).toEqual({ id: "friend-test" });

    await expect(authenticateRequest(new Request("https://api.test/v1/me/lists", {
      headers: { Authorization: "Bearer wrong-code" }
    }), personalEnv)).rejects.toMatchObject({ status: 401, message: "アクセスコードが違います" });
  });

  it("allows JWT users during access-code migration", async () => {
    const mixedEnv = {
      PERSONAL_ACCESS_CODE: "ga_personal_test",
      PERSONAL_OWNER_ID: "personal-test",
      AUTH_JWKS_URL: JWKS_URL,
      AUTH_ISSUER: ISSUER,
      AUTH_AUDIENCE: AUDIENCE
    };
    const authorized = await authenticateRequest(new Request("https://api.test/v1/me/lists", {
      headers: { Authorization: "Bearer " + await issueToken("jwt-owner") }
    }), mixedEnv);
    expect(authorized).toEqual({ id: "jwt-owner" });
  });
  it("keeps personal and friend access-code data separate", async () => {
    const accessEnv = {
      DB: env.DB,
      WEB_ORIGINS: "https://gridatlas.github.io",
      PERSONAL_ACCESS_CODE: "ga_personal_test",
      PERSONAL_OWNER_ID: "personal-test",
      FRIEND_ACCESS_CODE: "ga_friend_test",
      FRIEND_OWNER_ID: "friend-test"
    };
    const request = (token, method = "GET", body) => worker.fetch(new Request("https://api.test/v1/me/lists", {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" })
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    }), accessEnv);

    expect((await request("ga_personal_test", "POST", samplePayload({ name: "個人用" }))).status).toBe(201);
    expect((await request("ga_friend_test", "POST", samplePayload({ name: "友達用" }))).status).toBe(201);

    const personalLists = await (await request("ga_personal_test")).json();
    const friendLists = await (await request("ga_friend_test")).json();
    expect(personalLists.lists).toHaveLength(1);
    expect(personalLists.lists[0].name).toBe("個人用");
    expect(friendLists.lists).toHaveLength(1);
    expect(friendLists.lists[0].name).toBe("友達用");
  });
  it("handles authentication, CORS, malformed routes, and private response headers", async () => {
    const unauthenticated = await api("/v1/me/lists", { token: null });
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.headers.get("Cache-Control")).toBe("no-store");
    expect(unauthenticated.headers.get("X-Content-Type-Options")).toBe("nosniff");

    const preflight = await worker.fetch(new Request("https://api.test/v1/me/lists", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:4173",
        "Access-Control-Request-Method": "POST"
      }
    }), env);
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:4173");

    const disallowed = await api("/v1/me/lists", { token: null, origin: "https://evil.test" });
    expect(disallowed.status).toBe(403);

    const malformed = await api("/v1/me/lists/%ZZ", { token: null });
    expect(malformed.status).toBe(400);
  });

  it("isolates owners and protects updates with revisions", async () => {
    const ownerAToken = await issueToken("owner-a");
    const ownerBToken = await issueToken("owner-b");
    const payload = samplePayload();

    const created = await api("/v1/me/lists", { method: "POST", token: ownerAToken, body: payload });
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.revision).toBe(1);
    expect(createdBody.list.list.scope).toBe("mine");
    expect(createdBody.list.list.createdAt).toBe("2026-07-23T15:00:00.000Z");
    expect(createdBody.list).not.toHaveProperty("currentLocation");
    expect(createdBody.list.points[0]).not.toHaveProperty("selected");

    const hiddenFromOtherOwner = await api("/v1/me/lists/list-1", { token: ownerBToken });
    expect(hiddenFromOtherOwner.status).toBe(404);

    const otherOwnerCreate = await api("/v1/me/lists", {
      method: "POST",
      token: ownerBToken,
      body: samplePayload({ name: "別ユーザーのリスト" })
    });
    expect(otherOwnerCreate.status).toBe(201);

    const collection = await api("/v1/me/lists", { token: ownerAToken });
    const collectionBody = await collection.json();
    expect(collectionBody.lists).toHaveLength(1);
    expect(collectionBody.lists[0]).toMatchObject({
      scope: "mine",
      id: "list-1",
      revision: 1,
      createdAt: "2026-07-23T15:00:00.000Z"
    });

    const updatedPayload = samplePayload({ name: "更新後のリスト" });
    updatedPayload.list.createdAt = "2020-01-01T00:00:00Z";
    const updated = await api("/v1/me/lists/list-1", {
      method: "PUT",
      token: ownerAToken,
      body: { expectedRevision: 1, payload: updatedPayload }
    });
    expect(updated.status).toBe(200);
    const updatedBody = await updated.json();
    expect(updatedBody.revision).toBe(2);
    expect(updatedBody.list.list.createdAt).toBe("2026-07-23T15:00:00.000Z");

    const stale = await api("/v1/me/lists/list-1", {
      method: "PUT",
      token: ownerAToken,
      body: { expectedRevision: 1, payload }
    });
    expect(stale.status).toBe(409);
    const staleBody = await stale.json();
    expect(staleBody.revision).toBe(2);
    expect(staleBody.current.list.name).toBe("更新後のリスト");

    const staleDelete = await api("/v1/me/lists/list-1", {
      method: "DELETE",
      token: ownerAToken,
      body: { expectedRevision: 1 }
    });
    expect(staleDelete.status).toBe(409);

    const deleted = await api("/v1/me/lists/list-1", {
      method: "DELETE",
      token: ownerAToken,
      body: { expectedRevision: 2 }
    });
    expect(deleted.status).toBe(204);

    const missing = await api("/v1/me/lists/list-1", { token: ownerAToken });
    expect(missing.status).toBe(404);
  });

  it("stores cloud list order per owner and returns it consistently", async () => {
    const token = await issueToken("owner-order");
    for (const [id, name] of [["list-a", "先に作ったリスト"], ["list-b", "後に作ったリスト"]]) {
      const payload = samplePayload({ name });
      payload.list.id = id;
      expect((await api("/v1/me/lists", { method: "POST", token, body: payload })).status).toBe(201);
    }

    const initial = await api("/v1/me/lists", { token });
    expect((await initial.json()).lists.map((list) => list.id)).toEqual(["list-a", "list-b"]);

    const reordered = await api("/v1/me/lists/order", {
      method: "PUT",
      token,
      body: { listIds: ["list-b", "list-a"] }
    });
    expect(reordered.status).toBe(200);
    expect((await reordered.json()).listIds).toEqual(["list-b", "list-a"]);

    const collection = await api("/v1/me/lists", { token });
    expect((await collection.json()).lists.map((list) => list.id)).toEqual(["list-b", "list-a"]);

    const duplicate = await api("/v1/me/lists/order", {
      method: "PUT",
      token,
      body: { listIds: ["list-b", "list-b"] }
    });
    expect(duplicate.status).toBe(400);
  });

  it("normalizes legacy cloud scope and allows update and deletion", async () => {
    const token = await issueToken("owner-legacy-scope");
    const legacyPayload = samplePayload({ name: "クラウドリスト" });
    legacyPayload.list.scope = "public";
    const created = await api("/v1/me/lists", { method: "POST", token, body: legacyPayload });
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.list.list.scope).toBe("mine");

    const update = await api("/v1/me/lists/list-1", {
      method: "PUT",
      token,
      body: { expectedRevision: 1, payload: samplePayload({ name: "更新後" }) }
    });
    expect(update.status).toBe(200);
    const updateBody = await update.json();
    expect(updateBody.list.list.scope).toBe("mine");

    const deleted = await api("/v1/me/lists/list-1", {
      method: "DELETE",
      token,
      body: { expectedRevision: 2 }
    });
    expect(deleted.status).toBe(204);
  });
  it("stores private image assets in R2 and removes them with the list", async () => {
    const token = await issueToken("owner-assets");
    const accessEnv = {
      DB: env.DB,
      ASSETS: env.ASSETS,
      AUTH_JWKS_URL: JWKS_URL,
      AUTH_ISSUER: ISSUER,
      AUTH_AUDIENCE: AUDIENCE,
      WEB_ORIGINS: "https://gridatlas.github.io",
    };
    const created = await api("/v1/me/lists", {
      method: "POST",
      token,
      body: samplePayload(),
      environment: accessEnv
    });
    expect(created.status).toBe(201);

    const bytes = new TextEncoder().encode("test image");
    const assetId = await sha256Hex(bytes);
    const assetPath = "/v1/me/lists/list-1/assets/" + assetId;
    const uploaded = await worker.fetch(new Request("https://api.test" + assetPath, {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "image/png",
        "X-Asset-Name": "pin.png"
      },
      body: bytes
    }), accessEnv);
    expect(uploaded.status).toBe(201);

    const payload = samplePayload();
    payload.points[0].photo = {
      assetId,
      mediaType: "image/png",
      name: "pin.png",
      byteLength: bytes.byteLength
    };
    const updated = await api("/v1/me/lists/list-1", {
      method: "PUT",
      token,
      body: { expectedRevision: 1, payload },
      environment: accessEnv
    });
    expect(updated.status).toBe(200);

    const downloaded = await worker.fetch(new Request("https://api.test" + assetPath, {
      headers: { Authorization: "Bearer " + token }
    }), accessEnv);
    expect(downloaded.status).toBe(200);
    expect(new TextDecoder().decode(await downloaded.arrayBuffer())).toBe("test image");

    const otherOwner = await worker.fetch(new Request("https://api.test" + assetPath, {
      headers: { Authorization: "Bearer " + await issueToken("owner-other") }
    }), accessEnv);
    expect(otherOwner.status).toBe(404);

    const deleted = await api("/v1/me/lists/list-1", {
      method: "DELETE",
      token,
      body: { expectedRevision: 2 },
      environment: accessEnv
    });
    expect(deleted.status).toBe(204);
    expect(await env.ASSETS.get("assets/owner-assets/list-1/" + assetId)).toBeNull();
  });
  it("rejects malformed tokens, payloads, oversized bodies, and unsupported methods", async () => {
    const expiredToken = await issueToken("owner-a", { expiresIn: -1 });
    expect((await api("/v1/me/lists", { token: expiredToken })).status).toBe(401);

    const validToken = await issueToken("owner-a");
    const tokenParts = validToken.split(".");
    tokenParts[2] = `${tokenParts[2][0] === "A" ? "B" : "A"}${tokenParts[2].slice(1)}`;
    expect((await api("/v1/me/lists", { token: tokenParts.join(".") })).status).toBe(401);
    expect((await api("/v1/me/lists", {
      token: await issueToken("owner-a", { audience: "another-app" })
    })).status).toBe(401);

    const missingContentType = await api("/v1/me/lists", {
      method: "POST",
      token: validToken,
      body: samplePayload(),
      contentType: null
    });
    expect(missingContentType.status).toBe(415);

    const primitive = await api("/v1/me/lists", { method: "POST", token: validToken, body: null });
    expect(primitive.status).toBe(400);

    const invalidTimestamp = samplePayload();
    invalidTimestamp.list.createdAt = "not-a-date";
    expect((await api("/v1/me/lists", {
      method: "POST",
      token: validToken,
      body: invalidTimestamp
    })).status).toBe(400);

    const dateWithoutTime = samplePayload();
    dateWithoutTime.list.createdAt = "2026-07-24";
    expect((await api("/v1/me/lists", {
      method: "POST",
      token: validToken,
      body: dateWithoutTime
    })).status).toBe(400);

    const impossibleDate = samplePayload();
    impossibleDate.list.createdAt = "2026-02-30T00:00:00Z";
    expect((await api("/v1/me/lists", {
      method: "POST",
      token: validToken,
      body: impossibleDate
    })).status).toBe(400);

    const duplicatePoint = samplePayload();
    duplicatePoint.points.push({ ...duplicatePoint.points[0] });
    expect((await api("/v1/me/lists", {
      method: "POST",
      token: validToken,
      body: duplicatePoint
    })).status).toBe(400);

    const oversized = samplePayload();
    oversized.list.description = "x".repeat(256 * 1024);
    expect((await api("/v1/me/lists", {
      method: "POST",
      token: validToken,
      body: oversized
    })).status).toBe(413);

    const unsupported = await api("/v1/me/lists", { method: "PATCH", token: validToken });
    expect(unsupported.status).toBe(405);
    expect(unsupported.headers.get("Allow")).toBe("GET, POST");
  });
});

async function api(path, { method = "GET", token, body, origin, contentType = "application/json", environment = env } = {}) {
  const headers = new Headers();
  const bearer = token === undefined ? await issueToken("owner-a") : token;
  if (bearer) headers.set("Authorization", `Bearer ${bearer}`);
  if (origin) headers.set("Origin", origin);
  if (body !== undefined && contentType) headers.set("Content-Type", contentType);
  return worker.fetch(new Request(`https://api.test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  }), environment);
}

async function issueToken(subject, { expiresIn = 3600, audience = AUDIENCE } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const encodedHeader = base64UrlEncode(JSON.stringify({ alg: "ES256", kid: "test-key", typ: "JWT" }));
  const encodedClaims = base64UrlEncode(JSON.stringify({
    iss: ISSUER,
    aud: audience,
    sub: subject,
    iat: now,
    exp: now + expiresIn
  }));
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function base64UrlEncode(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function samplePayload({ name = "テスト地点リスト" } = {}) {
  return {
    type: "grid-atlas-share",
    schemaVersion: 1,
    kind: "point-list",
    list: {
      id: "list-1",
      name,
      scope: "mine",
      description: "API統合テスト",
      createdAt: "2026-07-24T00:00:00+09:00"
    },
    points: [
      {
        id: "point-1",
        name: "東京駅",
        latitude: 35.681236,
        longitude: 139.767125,
        comment: "集合地点",
        selected: true
      }
    ],
    currentLocation: { latitude: 35, longitude: 139 }
  };
}
