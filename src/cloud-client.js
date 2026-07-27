const DEFAULT_TIMEOUT_MS = 15000;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export class CloudApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "CloudApiError";
    this.status = options.status ?? 0;
    this.payload = options.payload ?? null;
  }
}

export function createCloudClient({ baseUrl, getAccessToken, fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const endpoint = normalizeCloudBaseUrl(baseUrl);
  if (typeof fetchImpl !== "function") throw new CloudApiError("通信機能を利用できません");

  async function request(path, options = {}) {
    const token = String(await getAccessToken?.() || "").trim();
    if (!token) throw new CloudApiError("アクセスコードを入力してください", { status: 401 });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(new URL(path, endpoint), {
        method: options.method || "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.body === undefined ? {} : { "Content-Type": "application/json" })
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        cache: "no-store",
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new CloudApiError("クラウドへの接続がタイムアウトしました");
      }
      throw new CloudApiError("クラウドへ接続できません");
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 204) return null;
    const payload = await readJsonResponse(response);
    if (!response.ok) {
      throw new CloudApiError(
        typeof payload?.error === "string" ? payload.error : `クラウド操作に失敗しました (${response.status})`,
        { status: response.status, payload }
      );
    }
    return payload;
  }

  return {
    listLists: () => request("v1/me/lists"),
    getList: (listId) => request(`v1/me/lists/${encodeURIComponent(listId)}`),
    createList: (payload) => request("v1/me/lists", { method: "POST", body: { payload } }),
    updateList: (listId, expectedRevision, payload) => request(`v1/me/lists/${encodeURIComponent(listId)}`, {
      method: "PUT",
      body: { expectedRevision, payload }
    }),
    deleteList: (listId, expectedRevision) => request(`v1/me/lists/${encodeURIComponent(listId)}`, {
      method: "DELETE",
      body: { expectedRevision }
    })
  };
}

export function normalizeCloudBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new CloudApiError("Cloud API URLを確認してください");
  }

  const localHttp = url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !localHttp) {
    throw new CloudApiError("Cloud APIはHTTPSで接続してください");
  }
  if (url.username || url.password) {
    throw new CloudApiError("Cloud API URLに認証情報を含めないでください");
  }

  url.hash = "";
  url.search = "";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  return url;
}

export function resolveCloudApiUrlSetting(storedValue, { defaultUrl, pageUrl } = {}) {
  const fallback = String(defaultUrl || "").trim();
  const stored = String(storedValue || "").trim();
  if (!stored) return { url: fallback, replaced: false };

  let endpoint;
  let page;
  try {
    endpoint = normalizeCloudBaseUrl(stored);
    page = new URL(String(pageUrl || ""));
  } catch {
    return { url: fallback, replaced: true };
  }

  const publishedPage = !LOCAL_HOSTS.has(page.hostname);
  const localEndpoint = LOCAL_HOSTS.has(endpoint.hostname);
  if (publishedPage && (endpoint.protocol !== "https:" || localEndpoint)) {
    return { url: fallback, replaced: true };
  }

  return { url: stored, replaced: false };
}

export function pointListToCloudPayload(list, getCoordinates) {
  if (!list || typeof list !== "object") throw new CloudApiError("保存する地点リストがありません");
  const now = new Date().toISOString();
  const listId = typeof list.cloudId === "string" && list.cloudId ? list.cloudId : list.id;
  if (typeof listId !== "string" || !listId) throw new CloudApiError("地点リストIDがありません");

  const points = Array.isArray(list.points) ? list.points.map((point) => {
    const geo = typeof getCoordinates === "function" ? getCoordinates(point) : point?.geo;
    if (!geo || !Number.isFinite(geo.lat) || !Number.isFinite(geo.lng)) {
      throw new CloudApiError(`地点「${point?.title || "名称なし"}」の緯度経度を確認できません`);
    }
    return {
      id: String(point.id || ""),
      name: String(point.title || "Point"),
      latitude: geo.lat,
      longitude: geo.lng,
      ...(typeof point.note === "string" && point.note ? { comment: point.note } : {})
    };
  }) : [];

  return {
    type: "grid-atlas-share",
    schemaVersion: 1,
    kind: "point-list",
    list: {
      id: listId,
      name: String(list.name || "地点リスト"),
      ...(typeof list.description === "string" && list.description ? { description: list.description } : {}),
      createdAt: validTimestamp(list.createdAt) || now,
      updatedAt: now
    },
    points
  };
}

export function cloudPayloadToPointList(payload, options = {}) {
  assertCloudPointListPayload(payload);
  const now = new Date().toISOString();
  return {
    id: options.localId || payload.list.id,
    cloudId: payload.list.id,
    cloudRevision: Number.isInteger(options.revision) ? options.revision : null,
    cloudUpdatedAt: payload.list.updatedAt || now,
    name: payload.list.name,
    description: payload.list.description || "",
    author: "",
    visible: true,
    editable: options.editable === true,
    source: "cloud",
    importedAt: now,
    createdAt: payload.list.createdAt || now,
    updatedAt: payload.list.updatedAt || now,
    points: payload.points.map((point) => ({
      id: point.id,
      title: point.name,
      note: point.comment || "",
      photo: "",
      photoName: "",
      geo: { lat: point.latitude, lng: point.longitude },
      createdAt: payload.list.createdAt || now,
      updatedAt: payload.list.updatedAt || now
    }))
  };
}

export function assertCloudPointListPayload(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    payload.type !== "grid-atlas-share" ||
    payload.schemaVersion !== 1 ||
    payload.kind !== "point-list" ||
    !payload.list ||
    typeof payload.list.id !== "string" ||
    typeof payload.list.name !== "string" ||
    !Array.isArray(payload.points)
  ) {
    throw new CloudApiError("クラウドの地点リスト形式を確認できません");
  }

  for (const point of payload.points) {
    if (
      !point ||
      typeof point.id !== "string" ||
      typeof point.name !== "string" ||
      !Number.isFinite(point.latitude) ||
      !Number.isFinite(point.longitude)
    ) {
      throw new CloudApiError("クラウドの地点情報を確認できません");
    }
  }
  return payload;
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new CloudApiError("クラウドから不正な応答を受信しました", { status: response.status });
  }
}

function validTimestamp(value) {
  if (typeof value !== "string") return "";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}
