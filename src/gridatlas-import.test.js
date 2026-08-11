import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "./fflate.js";
import {
  GridAtlasImportError,
  buildGridAtlasArchive,
  decodeGridAtlasUrlPayload,
  encodeGridAtlasUrlPayload,
  gridAtlasDocumentDigest,
  parseGridAtlasArchive
} from "./gridatlas-import.js";

describe("GRID ATLAS import format", () => {
  it("reads a .gridatlas ZIP package and its image resource", async () => {
    const document = sampleDocument({
      media: [{ resourceId: "image-1", role: "cover" }],
      places: [
        samplePlace({
          media: [{ resourceId: "image-1", role: "photo", caption: "入口" }]
        })
      ]
    });
    const documentBytes = strToU8(JSON.stringify(document));
    const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const manifest = {
      format: "gridatlas-package",
      formatVersion: 1,
      exportedAt: "2026-07-29T10:00:00.000Z",
      document: {
        path: "document.json",
        mediaType: "application/vnd.gridatlas.place-list+json",
        sha256: await sha256Hex(documentBytes)
      },
      resources: [
        {
          id: "image-1",
          path: "assets/image-1.jpg",
          mediaType: "image/jpeg",
          byteLength: imageBytes.byteLength,
          sha256: await sha256Hex(imageBytes),
          image: { width: 1, height: 1 }
        }
      ],
      requiredExtensions: [],
      extensions: {}
    };
    const archive = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
      "document.json": documentBytes,
      "assets/image-1.jpg": imageBytes
    });

    const parsed = await parseGridAtlasArchive(archive);

    expect(parsed.document.name).toBe("東京ラーメン30選");
    expect(parsed.resources.get("image-1")?.bytes).toEqual(imageBytes);
  });

  it("builds and reads the canonical .gridatlas package", async () => {
    const document = sampleDocument({
      places: [samplePlace({ media: [{ resourceId: "photo-resource", role: "photo" }] })]
    });
    const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const built = await buildGridAtlasArchive(document, [{
      id: "photo-resource",
      path: "assets/photo.jpg",
      mediaType: "image/jpeg",
      bytes: imageBytes
    }], { exportedAt: "2026-07-29T10:00:00.000Z" });

    const parsed = await parseGridAtlasArchive(built.bytes);

    expect(parsed.document).toEqual(document);
    expect(parsed.documentDigest).toBe(await gridAtlasDocumentDigest(document));
    expect(parsed.resources.get("photo-resource")?.bytes).toEqual(imageBytes);
  });

  it("accepts the minimal RC1 document without timestamps", () => {
    const minimal = {
      type: "place-list",
      schemaVersion: 1,
      id: "list-minimal",
      name: "Minimal list",
      places: [{
        id: "place-minimal",
        name: "Minimal place",
        position: { latitude: 35, longitude: 139 }
      }]
    };

    expect(decodeGridAtlasUrlPayload(encodeGridAtlasUrlPayload(minimal))).toEqual(minimal);
  });

  it("canonicalizes object key order for document identity", async () => {
    const document = sampleDocument();
    const reordered = Object.fromEntries(Object.entries(document).reverse());

    expect(await gridAtlasDocumentDigest(reordered)).toBe(await gridAtlasDocumentDigest(document));
  });

  it("rejects an unsupported required extension", async () => {
    await expect(buildGridAtlasArchive(sampleDocument(), [], {
      requiredExtensions: ["com.example.routing"]
    })).rejects.toThrow(GridAtlasImportError);
  });

  it("round-trips the canonical URL payload", () => {
    const document = sampleDocument();
    const encoded = encodeGridAtlasUrlPayload(document);

    expect(encoded.startsWith("v1.")).toBe(true);
    expect(encoded).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
    expect(decodeGridAtlasUrlPayload(encoded)).toEqual(document);
  });

  it("round-trips an optional analysis line layer without changing the core document", async () => {
    const document = sampleDocument({
      places: [
        samplePlace({ id: "place-a", name: "地点A" }),
        samplePlace({ id: "place-b", name: "地点B" })
      ],
      extensions: {
        "io.gridatlas.lines": {
          version: 1,
          items: [{ id: "line-1", a: "place-a", b: "place-b" }]
        }
      }
    });

    const urlDocument = decodeGridAtlasUrlPayload(encodeGridAtlasUrlPayload(document));
    const parsed = await parseGridAtlasArchive((await buildGridAtlasArchive(document)).bytes);

    expect(urlDocument.extensions["io.gridatlas.lines"].items).toHaveLength(1);
    expect(parsed.document.extensions["io.gridatlas.lines"]).toEqual(document.extensions["io.gridatlas.lines"]);
  });

  it("rejects URL documents that reference unavailable images", () => {
    const document = sampleDocument({
      places: [samplePlace({ media: [{ resourceId: "missing", role: "photo" }] })]
    });

    expect(() => decodeGridAtlasUrlPayload(encodeRawUrlPayload(document))).toThrow(GridAtlasImportError);
  });

  it("rejects unsafe ZIP paths", async () => {
    const archive = zipSync({
      "../manifest.json": strToU8("{}")
    });

    await expect(parseGridAtlasArchive(archive)).rejects.toThrow(GridAtlasImportError);
  });
});

function sampleDocument(overrides = {}) {
  return {
    type: "place-list",
    schemaVersion: 1,
    id: "019bbb12-3456-7890-abcd-ef1234567890",
    name: "東京ラーメン30選",
    description: "再訪したい店",
    attribution: { name: "Kazki" },
    createdAt: "2026-07-20T12:00:00.000Z",
    updatedAt: "2026-07-29T09:30:00.000Z",
    places: [samplePlace()],
    extensions: {},
    ...overrides
  };
}

function samplePlace(overrides = {}) {
  return {
    id: "019ccc12-3456-7890-abcd-ef1234567890",
    name: "サンプル店",
    position: {
      latitude: 35.681236,
      longitude: 139.767125
    },
    note: "夜がおすすめ",
    createdAt: "2026-07-20T12:30:00.000Z",
    updatedAt: "2026-07-28T18:00:00.000Z",
    extensions: {},
    ...overrides
  };
}

function encodeRawUrlPayload(document) {
  const bytes = new TextEncoder().encode(JSON.stringify(document));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `v1.${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
