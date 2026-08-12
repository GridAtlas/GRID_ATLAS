import { AuthError, authenticateRequest, requestedCloudScope } from "./auth.js";

const MAX_BODY_BYTES = 256 * 1024;
const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const ALLOWED_ASSET_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_POINTS = 5000;
const MAX_LIST_ORDER_ITEMS = 1000;
const ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: cors ? 204 : 403,
        headers: responseHeaders(cors || {})
      });
    }
    if (!cors && origin) {
      return jsonResponse({ error: "許可されていない接続元です" }, 403, {});
    }

    try {
      const route = parseRoute(new URL(request.url).pathname);
      if (!route) return jsonResponse({ error: "Not found" }, 404, cors);

      const user = await authenticateRequest(request, env);
      if (!env.DB) return jsonResponse({ error: "データベースが未設定です" }, 503, cors);

      if (route.assetId) {
        return await handleAsset(request, env, cors, user, route.listId, route.assetId);
      }
      if (route.listOrder) {
        return await handleListOrder(request, env, cors, user);
      }
      return route.listId
        ? await handleListItem(request, env, cors, user, route.listId)
        : await handleListCollection(request, env, cors, user);
    } catch (error) {
      if (error instanceof AuthError || error instanceof HttpError) {
        return jsonResponse({ error: error.message }, error.status, cors);
      }
      console.error(JSON.stringify({
        message: "cloud API request failed",
        path: new URL(request.url).pathname,
        error: error instanceof Error ? error.message : String(error)
      }));
      return jsonResponse({ error: "サーバーエラーが発生しました" }, 500, cors);
    }
  }
};

function parseRoute(pathname) {
  const parts = pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (parts.length === 6 && parts[0] === "v1" && parts[1] === "me" && parts[2] === "lists" && parts[3] && parts[4] === "assets" && parts[5]) {
    let listId;
    let assetId;
    try {
      listId = decodeURIComponent(parts[3]);
      assetId = decodeURIComponent(parts[5]);
    } catch {
      throw new HttpError("画像IDが不正です", 400);
    }
    validateId(listId, "リストID");
    validateId(assetId, "画像ID");
    return { listId, assetId };
  }
  if (parts.length === 3 && parts[0] === "v1" && parts[1] === "me" && parts[2] === "lists") {
    return { listId: null };
  }
  if (parts.length === 4 && parts[0] === "v1" && parts[1] === "me" && parts[2] === "lists" && parts[3] === "order") {
    return { listId: null, listOrder: true };
  }
  if (parts.length === 4 && parts[0] === "v1" && parts[1] === "me" && parts[2] === "lists" && parts[3]) {
    let listId;
    try {
      listId = decodeURIComponent(parts[3]);
    } catch {
      throw new HttpError("リストIDが不正です", 400);
    }
    validateId(listId, "リストID");
    return { listId };
  }
  return null;
}

async function orderedCloudListIds(db, ownerId) {
  const result = await db.prepare(
    `SELECT id
     FROM cloud_lists
     WHERE owner_id = ?1 AND deleted_at IS NULL
     ORDER BY sort_order ASC, updated_at DESC, id ASC`
  ).bind(ownerId).all();
  return result.results.map((row) => row.id);
}

function authorizedOwnerIds(user) {
  return [...new Set([
    user.canUseMine ? user.id : null,
    user.isTester ? user.testerOwnerId : null
  ].filter(Boolean))];
}

function writeOwnerId(user, scope = "mine") {
  if (scope === "testerShared") return user.isTester ? user.testerOwnerId : null;
  return user.canUseMine ? user.id : null;
}

function scopeForOwner(user, ownerId) {
  return user.canUseMine && ownerId === user.id ? "mine" : "testerShared";
}

async function handleListOrder(request, env, cors, user) {
  if (request.method !== "PUT") return methodNotAllowed(["PUT"], cors);

  const body = await readJsonObject(request);
  if (!Array.isArray(body.listIds) || body.listIds.length > MAX_LIST_ORDER_ITEMS) {
    throw new HttpError("listIdsの形式が不正です", 400);
  }

  const requestedIds = [];
  const seen = new Set();
  for (const id of body.listIds) {
    validateId(id, "リストID");
    if (seen.has(id)) throw new HttpError("listIdsに重複があります", 400);
    seen.add(id);
    requestedIds.push(id);
  }

  const ownerIds = authorizedOwnerIds(user);
  const ownerGroups = await Promise.all(ownerIds.map(async (ownerId) => ({
    ownerId,
    ids: await orderedCloudListIds(env.DB, ownerId)
  })));
  const currentIds = ownerGroups.flatMap((group) => group.ids);
  const sameSet = currentIds.length === requestedIds.length
    && currentIds.every((id) => seen.has(id));
  if (!sameSet) {
    return jsonResponse({
      error: "クラウドリストが更新されています",
      listIds: currentIds
    }, 409, cors);
  }

  const updates = [];
  for (const group of ownerGroups) {
    const groupIds = new Set(group.ids);
    const requestedGroup = requestedIds.filter((id) => groupIds.has(id));
    if (!group.ids.every((id, index) => id === requestedGroup[index])) {
      updates.push(...requestedGroup.map((id, index) => (
        env.DB.prepare(
          `UPDATE cloud_lists
           SET sort_order = ?1
           WHERE owner_id = ?2 AND id = ?3 AND deleted_at IS NULL`
        ).bind(index, group.ownerId, id)
      )));
    }
  }
  if (updates.length > 0) await env.DB.batch(updates);

  return jsonResponse({ listIds: requestedIds }, 200, cors);
}
async function handleListCollection(request, env, cors, user) {
  if (request.method === "GET") {
    const lists = [];
    for (const ownerId of authorizedOwnerIds(user)) {
      const result = await env.DB.prepare(
        `SELECT id, name, description, payload_json, revision, sort_order, created_at, updated_at
         FROM cloud_lists
         WHERE owner_id = ?1 AND deleted_at IS NULL
         ORDER BY sort_order ASC, updated_at DESC, id ASC`
      ).bind(ownerId).all();
      lists.push(...result.results.map((row) => toListMeta(row, scopeForOwner(user, ownerId))));
    }
    return jsonResponse({
      lists,
      permissions: {
        mine: user.canUseMine,
        tester: user.isTester
      }
    }, 200, cors);
  }

  if (request.method === "POST") {
    const scope = request.headers.has("X-Cloud-Scope")
      ? requestedCloudScope(request)
      : user.legacyTester ? "testerShared" : "mine";
    const ownerId = writeOwnerId(user, scope);
    if (!ownerId) throw new AuthError("個別ログインまたはテスター権限が必要です", 403);
    const payload = await readPayload(request);
    const now = new Date().toISOString();
    const normalized = normalizePayload(payload, now);
    await ensurePayloadAssets(env, ownerId, normalized);
    const nextOrder = await env.DB.prepare(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
       FROM cloud_lists
       WHERE owner_id = ?1 AND deleted_at IS NULL`
    ).bind(ownerId).first();
    const sortOrder = Number(nextOrder?.next_sort_order ?? 0);
    try {
      await env.DB.prepare(
        `INSERT INTO cloud_lists
          (id, owner_id, name, description, payload_json, revision, sort_order, created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?7, ?8, NULL)`
      ).bind(
        normalized.list.id,
        ownerId,
        normalized.list.name,
        normalized.list.description || "",
        JSON.stringify(normalized),
        sortOrder,
        normalized.list.createdAt,
        now
      ).run();
    } catch (error) {
      if (String(error.message || error).toLowerCase().includes("constraint")) {
        return jsonResponse({ error: "同じIDのリストがすでに存在します" }, 409, cors);
      }
      throw error;
    }
    return jsonResponse({ list: normalized, revision: 1 }, 201, cors);
  }

  return methodNotAllowed(["GET", "POST"], cors);
}

async function handleListItem(request, env, cors, user, listId) {
  if (request.method === "GET") {
    const row = await findAuthorizedList(env.DB, user, listId);
    return row
      ? jsonResponse({ list: JSON.parse(row.payload_json), revision: row.revision }, 200, cors)
      : jsonResponse({ error: "リストが見つかりません" }, 404, cors);
  }

  if (request.method === "PUT") {
    const body = await readJsonObject(request);
    if (!Number.isInteger(body.expectedRevision) || body.expectedRevision < 1) {
      throw new HttpError("expectedRevisionが必要です", 400);
    }
    const existing = await findAuthorizedList(env.DB, user, listId);
    if (!existing) return jsonResponse({ error: "リストが見つかりません" }, 404, cors);
    const ownerId = existing.owner_id;

    const existingPayload = parseStoredPayload(existing.payload_json);
    const now = new Date().toISOString();
    const normalized = normalizePayload(body.payload, now, {
      createdAt: existingPayload?.list?.createdAt || existing.created_at
    });
    await ensurePayloadAssets(env, ownerId, normalized);
    if (normalized.list.id !== listId) throw new HttpError("リストIDが一致しません", 400);

    const result = await env.DB.prepare(
      `UPDATE cloud_lists
       SET name = ?1, description = ?2, payload_json = ?3,
           revision = revision + 1, updated_at = ?4
       WHERE owner_id = ?5 AND id = ?6 AND deleted_at IS NULL AND revision = ?7`
    ).bind(
      normalized.list.name,
      normalized.list.description || "",
      JSON.stringify(normalized),
      now,
      ownerId,
      listId,
      body.expectedRevision
    ).run();

    if (!result.meta.changes) {
      const current = await findList(env.DB, ownerId, listId);
      if (!current) return jsonResponse({ error: "リストが見つかりません" }, 404, cors);
      return jsonResponse({
        error: "クラウド側が更新されています",
        current: JSON.parse(current.payload_json),
        revision: current.revision
      }, 409, cors);
    }
    return jsonResponse({ list: normalized, revision: body.expectedRevision + 1 }, 200, cors);
  }

  if (request.method === "DELETE") {
    const body = await readJsonObject(request);
    if (!Number.isInteger(body.expectedRevision) || body.expectedRevision < 1) {
      throw new HttpError("expectedRevisionが必要です", 400);
    }
    const existing = await findAuthorizedList(env.DB, user, listId);
    if (!existing) return jsonResponse({ error: "リストが見つかりません" }, 404, cors);
    const ownerId = existing.owner_id;
    const result = await env.DB.prepare(
      `UPDATE cloud_lists SET deleted_at = ?1, updated_at = ?1
       WHERE owner_id = ?2 AND id = ?3 AND deleted_at IS NULL AND revision = ?4`
    ).bind(new Date().toISOString(), ownerId, listId, body.expectedRevision).run();
    if (!result.meta.changes) {
      const current = await findList(env.DB, ownerId, listId);
      return current
        ? jsonResponse({ error: "クラウド側が更新されています", revision: current.revision }, 409, cors)
        : jsonResponse({ error: "リストが見つかりません" }, 404, cors);
    }
    await deleteListAssets(env, ownerId, listId);
    return new Response(null, { status: 204, headers: responseHeaders(cors) });
  }

  return methodNotAllowed(["GET", "PUT", "DELETE"], cors);
}

async function handleAsset(request, env, cors, user, listId, assetId) {
  if (!env.ASSETS) {
    return jsonResponse({ error: "画像ストレージが未設定です" }, 503, cors);
  }

  const list = await findAuthorizedList(env.DB, user, listId);
  if (!list) return jsonResponse({ error: "リストが見つかりません" }, 404, cors);
  const ownerId = list.owner_id;
  const key = assetKey(ownerId, listId, assetId);

  if (request.method === "PUT") {
    const mediaType = (request.headers.get("Content-Type") || "").split(";", 1)[0].trim().toLowerCase();
    if (!ALLOWED_ASSET_TYPES.has(mediaType)) {
      throw new HttpError("対応していない画像形式です", 415);
    }
    const contentLength = Number(request.headers.get("Content-Length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_ASSET_BYTES) {
      throw new HttpError("画像が大きすぎます", 413);
    }
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_ASSET_BYTES) {
      throw new HttpError("画像サイズが不正です", 413);
    }
    const digest = await sha256Hex(bytes);
    if (digest !== assetId) {
      throw new HttpError("画像IDと内容が一致しません", 400);
    }

    let name = "";
    const encodedName = request.headers.get("X-Asset-Name");
    if (encodedName) {
      try { name = decodeURIComponent(encodedName).slice(0, 200); } catch {}
    }
    const now = new Date().toISOString();
    await env.ASSETS.put(key, bytes, {
      httpMetadata: { contentType: mediaType }
    });
    await env.DB.prepare(
      "INSERT INTO cloud_assets " +
        "(owner_id, list_id, asset_id, media_type, name, byte_length, created_at, updated_at) " +
        "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7) " +
        "ON CONFLICT(owner_id, list_id, asset_id) DO UPDATE SET " +
        "media_type = excluded.media_type, name = excluded.name, " +
        "byte_length = excluded.byte_length, updated_at = excluded.updated_at"
    ).bind(ownerId, listId, assetId, mediaType, name, bytes.byteLength, now).run();
    return jsonResponse({
      asset: { id: assetId, mediaType, name, byteLength: bytes.byteLength }
    }, 201, cors);
  }

  const metadata = await findAsset(env.DB, ownerId, listId, assetId);
  if (!metadata) return jsonResponse({ error: "画像が見つかりません" }, 404, cors);

  if (request.method === "GET") {
    const object = await env.ASSETS.get(key);
    if (!object) return jsonResponse({ error: "画像が見つかりません" }, 404, cors);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Cache-Control", "private, max-age=300");
    headers.set("ETag", object.httpEtag);
    for (const [name, value] of Object.entries(cors || {})) {
      headers.set(name, value);
    }
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(object.body, { status: 200, headers });
  }

  if (request.method === "DELETE") {
    await env.ASSETS.delete(key);
    await env.DB.prepare(
      "DELETE FROM cloud_assets WHERE owner_id = ?1 AND list_id = ?2 AND asset_id = ?3"
    ).bind(ownerId, listId, assetId).run();
    return new Response(null, { status: 204, headers: responseHeaders(cors) });
  }

  return methodNotAllowed(["GET", "PUT", "DELETE"], cors);
}

async function findList(db, ownerId, listId) {
  return db.prepare(
    `SELECT id, name, description, payload_json, revision, created_at, updated_at
     FROM cloud_lists WHERE owner_id = ?1 AND id = ?2 AND deleted_at IS NULL`
  ).bind(ownerId, listId).first();
}

async function findAuthorizedList(db, user, listId) {
  const ownerIds = authorizedOwnerIds(user);
  if (ownerIds.length === 0) return null;
  const placeholders = ownerIds.map((_, index) => `?${index + 1}`).join(", ");
  const result = await db.prepare(
    `SELECT id, owner_id, name, description, payload_json, revision, created_at, updated_at
     FROM cloud_lists
     WHERE owner_id IN (${placeholders}) AND id = ?${ownerIds.length + 1} AND deleted_at IS NULL`
  ).bind(...ownerIds, listId).all();
  if (!result.results.length) return null;
  return result.results.find((row) => user.canUseMine && row.owner_id === user.id)
    || result.results[0];
}

async function readPayload(request) {
  const body = await readJsonObject(request);
  return Object.hasOwn(body, "payload") ? body.payload : body;
}

async function readJsonObject(request) {
  const body = await readJson(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError("JSONオブジェクトが必要です", 400);
  }
  return body;
}

async function readJson(request) {
  const contentType = (request.headers.get("Content-Type") || "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json" && !contentType.endsWith("+json")) {
    throw new HttpError("Content-Typeはapplication/jsonにしてください", 415);
  }
  const contentLengthValue = request.headers.get("Content-Length");
  if (contentLengthValue) {
    const contentLength = Number(contentLengthValue);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      throw new HttpError("リクエストが大きすぎます", 413);
    }
  }
  const text = await readLimitedText(request);
  if (!text.trim()) throw new HttpError("JSON形式が不正です", 400);
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError("JSON形式が不正です", 400);
  }
}

async function readLimitedText(request) {
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      try {
        await reader.cancel();
      } catch {
        // The size error below is actionable even if stream cancellation fails.
      }
      throw new HttpError("リクエストが大きすぎます", 413);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function normalizePayload(payload, now, options = {}) {
  if (!payload || typeof payload !== "object") throw new HttpError("地点リストがありません", 400);
  if (payload.type !== "grid-atlas-share" || payload.schemaVersion !== 1 || payload.kind !== "point-list") {
    throw new HttpError("対応していない地点リスト形式です", 400);
  }
  if (!payload.list || typeof payload.list !== "object") throw new HttpError("リスト情報がありません", 400);
  validateId(payload.list.id, "リストID");
  validateText(payload.list.name, "リスト名", 120);
  if (payload.list.description !== undefined) validateText(payload.list.description, "説明", 2000, true);
  if (!Array.isArray(payload.points) || payload.points.length > MAX_POINTS) {
    throw new HttpError("地点数が上限を超えています", 400);
  }

  const pointIds = new Set();
  const points = payload.points.map((point) => {
    if (!point || typeof point !== "object") throw new HttpError("地点形式が不正です", 400);
    validateId(point.id, "地点ID");
    if (pointIds.has(point.id)) throw new HttpError("地点IDが重複しています", 400);
    pointIds.add(point.id);
    validateText(point.name, "地点名", 200);
    if (!Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90) {
      throw new HttpError("緯度が不正です", 400);
    }
    if (!Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180) {
      throw new HttpError("経度が不正です", 400);
    }
    if (point.comment !== undefined) validateText(point.comment, "コメント", 4000, true);
    const photo = normalizePhotoDescriptor(point.photo);
    return {
      id: point.id,
      name: point.name,
      latitude: point.latitude,
      longitude: point.longitude,
      ...(point.comment === undefined ? {} : { comment: point.comment }),
      ...(photo ? { photo } : {})
    };
  });

  return {
    type: "grid-atlas-share",
    schemaVersion: 1,
    kind: "point-list",
    list: {
      id: payload.list.id,
      name: payload.list.name,
      scope: "mine",
      ...(payload.list.description === undefined ? {} : { description: payload.list.description }),
      createdAt: validateTimestamp(options.createdAt || payload.list.createdAt || now, "作成日時"),
      updatedAt: now
    },
    points
  };
}

function normalizePhotoDescriptor(value) {
  if (!value || typeof value !== "object") return null;
  validateId(value.assetId, "画像ID");
  const mediaType = String(value.mediaType || "").toLowerCase();
  if (!ALLOWED_ASSET_TYPES.has(mediaType)) throw new HttpError("画像形式が不正です", 400);
  const byteLength = Number(value.byteLength);
  if (!Number.isInteger(byteLength) || byteLength < 1 || byteLength > MAX_ASSET_BYTES) {
    throw new HttpError("画像サイズが不正です", 400);
  }
  const name = typeof value.name === "string" ? value.name.slice(0, 200) : "";
  return { assetId: value.assetId, mediaType, byteLength, ...(name ? { name } : {}) };
}

async function ensurePayloadAssets(env, ownerId, payload) {
  const photos = payload.points.map((point) => point.photo).filter(Boolean);
  if (photos.length === 0) return;
  if (!env.ASSETS) throw new HttpError("画像ストレージが未設定です", 503);
  for (const photo of photos) {
    const metadata = await findAsset(env.DB, ownerId, payload.list.id, photo.assetId);
    if (!metadata || metadata.media_type !== photo.mediaType || metadata.byte_length !== photo.byteLength) {
      throw new HttpError("画像がアップロードされていません", 400);
    }
  }
}

async function findAsset(db, ownerId, listId, assetId) {
  return db.prepare(
    "SELECT owner_id, list_id, asset_id, media_type, name, byte_length " +
      "FROM cloud_assets WHERE owner_id = ?1 AND list_id = ?2 AND asset_id = ?3"
  ).bind(ownerId, listId, assetId).first();
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function assetKey(ownerId, listId, assetId) {
  return "assets/" + encodeURIComponent(ownerId) + "/" + listId + "/" + assetId;
}

async function deleteListAssets(env, ownerId, listId) {
  const assets = await env.DB.prepare(
    "SELECT asset_id FROM cloud_assets WHERE owner_id = ?1 AND list_id = ?2"
  ).bind(ownerId, listId).all();
  if (env.ASSETS && assets.results.length > 0) {
    await env.ASSETS.delete(assets.results.map((asset) => assetKey(ownerId, listId, asset.asset_id)));
  }
  await env.DB.prepare(
    "DELETE FROM cloud_assets WHERE owner_id = ?1 AND list_id = ?2"
  ).bind(ownerId, listId).run();
}

function validateId(value, label) {
  if (typeof value !== "string" || !ID_PATTERN.test(value) || value.length > 200) {
    throw new HttpError(`${label}が不正です`, 400);
  }
}

function validateText(value, label, maxLength, allowEmpty = false) {
  if (typeof value !== "string" || value.length > maxLength || (!allowEmpty && !value.trim())) {
    throw new HttpError(`${label}が不正です`, 400);
  }
}

function validateTimestamp(value, label) {
  const match = typeof value === "string"
    ? value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i)
    : null;
  if (!match) {
    throw new HttpError(`${label}が不正です`, 400);
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (
    month < 1 || month > 12 ||
    day < 1 || day > daysInMonth(year, month) ||
    hour > 23 || minute > 59 || second > 59
  ) {
    throw new HttpError(`${label}が不正です`, 400);
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new HttpError(`${label}が不正です`, 400);
  }
  return new Date(timestamp).toISOString();
}

function daysInMonth(year, month) {
  if (month === 2) {
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leapYear ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function toListMeta(row, scope = "mine") {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    scope,
    revision: row.revision,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function parseStoredPayload(value) {
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Stored cloud list payload is invalid");
  }
  return parsed;
}

function corsHeaders(origin, env) {
  const allowed = new Set((env.WEB_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean));
  if (!origin || !allowed.has(origin)) {
    return origin ? null : {
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Asset-Name, X-Tester-Code, X-Cloud-Scope"
    };
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Asset-Name, X-Tester-Code, X-Cloud-Scope",
    "Access-Control-Max-Age": "600",
    Vary: "Origin"
  };
}

function methodNotAllowed(allowedMethods, cors) {
  return jsonResponse(
    { error: "この操作には対応していません" },
    405,
    { ...cors, Allow: allowedMethods.join(", ") }
  );
}

function responseHeaders(headers) {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers
  };
}

function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders({ "Content-Type": "application/json; charset=utf-8", ...headers })
  });
}

class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}
