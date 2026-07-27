import { describe, expect, it, vi } from "vitest";
import {
  CloudApiError,
  cloudPayloadToPointList,
  createCloudClient,
  normalizeCloudBaseUrl,
  pointListToCloudPayload,
  resolveCloudApiUrlSetting
} from "./cloud-client.js";

describe("Cloud client", () => {
  it("allows HTTPS and local HTTP but rejects insecure remote endpoints", () => {
    expect(normalizeCloudBaseUrl("https://api.example.com/base").href).toBe("https://api.example.com/base/");
    expect(normalizeCloudBaseUrl("http://127.0.0.1:8787").href).toBe("http://127.0.0.1:8787/");
    expect(() => normalizeCloudBaseUrl("http://api.example.com")).toThrowError(CloudApiError);
  });

  it("replaces stale local or insecure API settings on the published app", () => {
    const options = {
      defaultUrl: "https://cloud.example.com",
      pageUrl: "https://gridatlas.github.io/GRID_ATLAS/"
    };

    expect(resolveCloudApiUrlSetting("http://127.0.0.1:8787", options)).toEqual({
      url: "https://cloud.example.com",
      replaced: true
    });
    expect(resolveCloudApiUrlSetting("not a url", options)).toEqual({
      url: "https://cloud.example.com",
      replaced: true
    });
    expect(resolveCloudApiUrlSetting("https://custom.example.com", options)).toEqual({
      url: "https://custom.example.com",
      replaced: false
    });
    expect(resolveCloudApiUrlSetting("http://127.0.0.1:8787", {
      ...options,
      pageUrl: "http://127.0.0.1:5177/"
    })).toEqual({
      url: "http://127.0.0.1:8787",
      replaced: false
    });
  });

  it("adds bearer auth and sends JSON requests", async () => {
    const fetchImpl = vi.fn(async (url, init) => new Response(JSON.stringify({
      list: samplePayload(),
      revision: 1
    }), { status: 201, headers: { "Content-Type": "application/json" } }));
    const client = createCloudClient({
      baseUrl: "https://api.example.com/atlas",
      getAccessToken: () => "test-token",
      fetchImpl
    });

    const response = await client.createList(samplePayload());
    expect(response.revision).toBe(1);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url.href).toBe("https://api.example.com/atlas/v1/me/lists");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(JSON.parse(init.body).payload.type).toBe("grid-atlas-share");
  });

  it("keeps conflict details for the UI", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      error: "クラウド側が更新されています",
      revision: 3
    }), { status: 409, headers: { "Content-Type": "application/json" } }));
    const client = createCloudClient({
      baseUrl: "https://api.example.com",
      getAccessToken: () => "test-token",
      fetchImpl
    });

    await expect(client.updateList("list-1", 2, samplePayload())).rejects.toMatchObject({
      name: "CloudApiError",
      status: 409,
      payload: { revision: 3 }
    });
  });

  it("converts Web point lists without photos or transient state and restores them", () => {
    const webList = {
      id: "local",
      cloudId: "ramen-list",
      name: "ラーメン店",
      description: "候補",
      createdAt: "2026-07-24T00:00:00Z",
      points: [{
        id: "point-1",
        title: "東京駅",
        note: "集合",
        photo: "data:image/png;base64,secret",
        selected: true,
        geo: { lat: 35.681236, lng: 139.767125 }
      }]
    };

    const payload = pointListToCloudPayload(webList, (point) => point.geo);
    expect(payload.list.id).toBe("ramen-list");
    expect(payload.points[0]).toEqual({
      id: "point-1",
      name: "東京駅",
      latitude: 35.681236,
      longitude: 139.767125,
      comment: "集合"
    });
    expect(payload.points[0]).not.toHaveProperty("photo");
    expect(payload.points[0]).not.toHaveProperty("selected");

    const restored = cloudPayloadToPointList(payload, { localId: "local", revision: 4, editable: true });
    expect(restored).toMatchObject({
      id: "local",
      cloudId: "ramen-list",
      cloudRevision: 4,
      editable: true,
      source: "cloud"
    });
    expect(restored.points[0]).toMatchObject({
      id: "point-1",
      title: "東京駅",
      note: "集合",
      geo: { lat: 35.681236, lng: 139.767125 },
      photo: ""
    });
  });
});

function samplePayload() {
  return {
    type: "grid-atlas-share",
    schemaVersion: 1,
    kind: "point-list",
    list: {
      id: "list-1",
      name: "テスト地点",
      createdAt: "2026-07-24T00:00:00.000Z",
      updatedAt: "2026-07-24T00:00:00.000Z"
    },
    points: []
  };
}
