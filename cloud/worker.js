import { AuthError, authenticateRequest } from "./auth.js";

const MAX_BODY_BYTES = 256 * 1024;
const MAX_POINTS = 5000;
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

      return route.listId
        ? await handleListItem(request, env, cors, user.id, route.listId)
        : await handleListCollection(request, env, cors, user.id);
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
  if (parts.length === 3 && parts[0] === "v1" && parts[1] === "me" && parts[2] === "lists") {
    return { listId: null };
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

async function handleListCollection(request, env, cors, ownerId) {
  if (request.method === "GET") {
    const result = await env.DB.prepare(
      `SELECT id, name, description, revision, created_at, updated_at
       FROM cloud_lists
       WHERE owner_id = ?1 AND deleted_at IS NULL
       ORDER BY updated_at DESC`
    ).bind(ownerId).all();
    return jsonResponse({ lists: result.results.map(toListMeta) }, 200, cors);
  }

  if (request.method === "POST") {
    const payload = await readPayload(request);
    const now = new Date().toISOString();
    const normalized = normalizePayload(payload, now);
    try {
      await env.DB.prepare(
        `INSERT INTO cloud_lists
          (id, owner_id, name, description, payload_json, revision, created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?6, NULL)`
      ).bind(
        normalized.list.id,
        ownerId,
        normalized.list.name,
        normalized.list.description || "",
        JSON.stringify(normalized),
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

async function handleListItem(request, env, cors, ownerId, listId) {
  if (request.method === "GET") {
    const row = await findList(env.DB, ownerId, listId);
    return row
      ? jsonResponse({ list: JSON.parse(row.payload_json), revision: row.revision }, 200, cors)
      : jsonResponse({ error: "リストが見つかりません" }, 404, cors);
  }

  if (request.method === "PUT") {
    const body = await readJsonObject(request);
    if (!Number.isInteger(body.expectedRevision) || body.expectedRevision < 1) {
      throw new HttpError("expectedRevisionが必要です", 400);
    }
    const now = new Date().toISOString();
    const normalized = normalizePayload(body.payload, now);
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

function normalizePayload(payload, now) {
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
    return {
      id: point.id,
      name: point.name,
      latitude: point.latitude,
      longitude: point.longitude,
      ...(point.comment === undefined ? {} : { comment: point.comment })
    };
  });

  return {
    type: "grid-atlas-share",
    schemaVersion: 1,
    kind: "point-list",
    list: {
      id: payload.list.id,
      name: payload.list.name,
      ...(payload.list.description === undefined ? {} : { description: payload.list.description }),
      ...(payload.list.createdAt
        ? { createdAt: validateTimestamp(payload.list.createdAt, "作成日時") }
        : { createdAt: now }),
      updatedAt: now
    },
    points
  };
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

function toListMeta(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function corsHeaders(origin, env) {
  const allowed = new Set((env.WEB_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean));
  if (!origin || !allowed.has(origin)) {
    return origin ? null : {
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type"
    };
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
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
