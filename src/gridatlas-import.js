import { strFromU8, strToU8, unzipSync, zipSync } from "./fflate.js";

export const GRIDATLAS_MIME_TYPE = "application/vnd.gridatlas+zip";
export const GRIDATLAS_URL_PARAMETER = "gridatlas";
export const GRIDATLAS_DOCUMENT_MEDIA_TYPE = "application/vnd.gridatlas.place-list+json";

const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 200 * 1024 * 1024;
const MAX_ENTRY_BYTES = 25 * 1024 * 1024;
const MAX_ENTRY_COUNT = 512;
const MAX_URL_JSON_BYTES = 2 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SUPPORTED_REQUIRED_EXTENSIONS = new Set();
const EXTENSION_KEY_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/i;

export class GridAtlasImportError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "GridAtlasImportError";
  }
}

export async function buildGridAtlasArchive(document, resources = [], options = {}) {
  assertGridAtlasDocument(document);
  const normalizedResources = resources.map(normalizeExportResource);
  const documentBytes = strToU8(JSON.stringify(document, null, 2));
  const requiredExtensions = Array.isArray(options.requiredExtensions) ? options.requiredExtensions : [];
  assertRequiredExtensions(requiredExtensions);

  const manifest = {
    format: "gridatlas-package",
    formatVersion: 1,
    exportedAt: options.exportedAt || new Date().toISOString(),
    document: {
      path: "document.json",
      mediaType: GRIDATLAS_DOCUMENT_MEDIA_TYPE,
      byteLength: documentBytes.byteLength,
      sha256: await sha256Hex(documentBytes)
    },
    resources: [],
    requiredExtensions,
    extensions: validExtensions(options.extensions) ? structuredClone(options.extensions) : {}
  };
  const entries = { "document.json": documentBytes };
  for (const resource of normalizedResources) {
    const metadata = {
      id: resource.id,
      path: resource.path,
      mediaType: resource.mediaType,
      byteLength: resource.bytes.byteLength,
      sha256: await sha256Hex(resource.bytes)
    };
    if (resource.image) metadata.image = structuredClone(resource.image);
    manifest.resources.push(metadata);
    entries[resource.path] = resource.bytes;
  }
  assertGridAtlasManifest(manifest);
  entries["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  return {
    bytes: zipSync(entries, { level: 6 }),
    manifest,
    document: structuredClone(document),
    documentDigest: await gridAtlasDocumentDigest(document)
  };
}

export async function gridAtlasDocumentDigest(document) {
  assertGridAtlasDocument(document);
  return sha256Hex(strToU8(JSON.stringify(canonicalize(document))));
}

export async function readGridAtlasFile(file) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new GridAtlasImportError(".gridatlasファイルを読み取れません");
  }
  if (Number.isFinite(file.size) && file.size > MAX_ARCHIVE_BYTES) {
    throw new GridAtlasImportError(".gridatlasファイルが大きすぎます");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  return parseGridAtlasArchive(bytes);
}

export async function parseGridAtlasArchive(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > MAX_ARCHIVE_BYTES) {
    throw new GridAtlasImportError(".gridatlasファイルのサイズを確認できません");
  }

  let expandedBytes = 0;
  let entryCount = 0;
  let entries;
  try {
    entries = unzipSync(bytes, {
      filter(entry) {
        assertSafeArchivePath(entry.name);
        entryCount += 1;
        expandedBytes += entry.originalSize;
        if (
          entryCount > MAX_ENTRY_COUNT
          || entry.originalSize > MAX_ENTRY_BYTES
          || expandedBytes > MAX_EXPANDED_BYTES
        ) {
          throw new GridAtlasImportError(".gridatlasファイルの展開サイズが上限を超えています");
        }
        return !entry.name.endsWith("/");
      }
    });
  } catch (error) {
    if (error instanceof GridAtlasImportError) throw error;
    throw new GridAtlasImportError(".gridatlasファイルを展開できません", { cause: error });
  }

  const manifestBytes = entries["manifest.json"];
  if (!manifestBytes) {
    throw new GridAtlasImportError("manifest.jsonがありません");
  }
  const manifest = parseJsonBytes(manifestBytes, "manifest.json");
  assertGridAtlasManifest(manifest);

  const documentPath = manifest.document.path;
  const documentBytes = entries[documentPath];
  if (!documentBytes) {
    throw new GridAtlasImportError(`${documentPath}がありません`);
  }
  if (manifest.document.byteLength !== undefined && documentBytes.byteLength !== manifest.document.byteLength) {
    throw new GridAtlasImportError("document.jsonのサイズが一致しません");
  }
  await assertSha256(documentBytes, manifest.document.sha256, documentPath);

  const document = parseJsonBytes(documentBytes, documentPath);
  assertGridAtlasDocument(document);

  const resources = new Map();
  for (const resource of manifest.resources) {
    const resourceBytes = entries[resource.path];
    if (!resourceBytes) {
      throw new GridAtlasImportError(`画像ファイルがありません: ${resource.path}`);
    }
    if (resourceBytes.byteLength !== resource.byteLength) {
      throw new GridAtlasImportError(`画像サイズが一致しません: ${resource.path}`);
    }
    await assertSha256(resourceBytes, resource.sha256, resource.path);
    resources.set(resource.id, {
      metadata: structuredClone(resource),
      bytes: resourceBytes
    });
  }

  assertReferencedResources(document, resources);
  return {
    manifest: structuredClone(manifest),
    document: structuredClone(document),
    documentDigest: await gridAtlasDocumentDigest(document),
    resources
  };
}

export function decodeGridAtlasUrlPayload(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new GridAtlasImportError("URLにGRID ATLASデータがありません");
  }

  const trimmed = value.trim();
  let jsonText;
  if (trimmed.startsWith("{")) {
    jsonText = trimmed;
  } else {
    const encoded = trimmed.startsWith("v1.") ? trimmed.slice(3) : trimmed;
    jsonText = decodeBase64UrlUtf8(encoded);
  }

  if (new TextEncoder().encode(jsonText).byteLength > MAX_URL_JSON_BYTES) {
    throw new GridAtlasImportError("URLのGRID ATLASデータが大きすぎます");
  }

  let document;
  try {
    document = JSON.parse(jsonText);
  } catch (error) {
    throw new GridAtlasImportError("URLのGRID ATLASデータがJSONではありません", { cause: error });
  }
  assertGridAtlasDocument(document);
  assertReferencedResources(document, new Map());
  return structuredClone(document);
}

export function encodeGridAtlasUrlPayload(document) {
  assertGridAtlasDocument(document);
  assertReferencedResources(document, new Map());
  const bytes = new TextEncoder().encode(JSON.stringify(document));
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `v1.${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
}

export function assertGridAtlasDocument(document) {
  if (
    !isPlainObject(document)
    || document.type !== "place-list"
    || document.schemaVersion !== 1
    || !nonEmptyString(document.id)
    || !nonEmptyString(document.name)
    || !Array.isArray(document.places)
  ) {
    throw new GridAtlasImportError("地点リストの形式を確認できません");
  }

  const placeIds = new Set();
  for (const place of document.places) {
    if (
      !isPlainObject(place)
      || !nonEmptyString(place.id)
      || placeIds.has(place.id)
      || !nonEmptyString(place.name)
      || !isPlainObject(place.position)
      || !Number.isFinite(place.position.latitude)
      || place.position.latitude < -90
      || place.position.latitude > 90
      || !Number.isFinite(place.position.longitude)
      || place.position.longitude < -180
      || place.position.longitude > 180
      || (place.note !== undefined && typeof place.note !== "string")
      || !validDateTimeOptional(place.createdAt)
      || !validDateTimeOptional(place.updatedAt)
      || !validMediaReferences(place.media)
      || !validExtensions(place.extensions)
    ) {
      throw new GridAtlasImportError(`地点情報の形式を確認できません: ${place?.name || place?.id || "名称なし"}`);
    }
    placeIds.add(place.id);
  }

  if (
    (document.description !== undefined && typeof document.description !== "string")
    || (document.attribution !== undefined
      && (!isPlainObject(document.attribution) || !nonEmptyString(document.attribution.name)))
    || !validDateTimeOptional(document.createdAt)
    || !validDateTimeOptional(document.updatedAt)
    || !validMediaReferences(document.media)
    || !validExtensions(document.extensions)
  ) {
    throw new GridAtlasImportError("地点リストの補足情報を確認できません");
  }
  return document;
}

function assertGridAtlasManifest(manifest) {
  if (
    !isPlainObject(manifest)
    || manifest.format !== "gridatlas-package"
    || manifest.formatVersion !== 1
    || !isPlainObject(manifest.document)
    || manifest.document.path !== "document.json"
    || manifest.document.mediaType !== GRIDATLAS_DOCUMENT_MEDIA_TYPE
    || !validSha256(manifest.document.sha256)
    || (manifest.document.byteLength !== undefined
      && (!Number.isInteger(manifest.document.byteLength)
        || manifest.document.byteLength < 0
        || manifest.document.byteLength > MAX_ENTRY_BYTES))
    || !Array.isArray(manifest.resources)
    || !validExtensions(manifest.extensions)
  ) {
    throw new GridAtlasImportError("manifest.jsonの形式を確認できません");
  }
  assertRequiredExtensions(manifest.requiredExtensions ?? []);

  const resourceIds = new Set();
  const resourcePaths = new Set();
  for (const resource of manifest.resources) {
    if (
      !isPlainObject(resource)
      || !nonEmptyString(resource.id)
      || resourceIds.has(resource.id)
      || !safeArchivePath(resource.path)
      || !resource.path.startsWith("assets/")
      || resourcePaths.has(resource.path)
      || !SUPPORTED_IMAGE_TYPES.has(resource.mediaType)
      || !Number.isInteger(resource.byteLength)
      || resource.byteLength < 0
      || resource.byteLength > MAX_ENTRY_BYTES
      || !validSha256(resource.sha256)
      || !validImageMetadata(resource.image)
    ) {
      throw new GridAtlasImportError("manifest.jsonの画像情報を確認できません");
    }
    resourceIds.add(resource.id);
    resourcePaths.add(resource.path);
  }
}

function assertReferencedResources(document, resources) {
  for (const media of [...(document.media ?? []), ...document.places.flatMap((place) => place.media ?? [])]) {
    if (!resources.has(media.resourceId)) {
      throw new GridAtlasImportError(`参照画像がありません: ${media.resourceId}`);
    }
  }
}

function validMediaReferences(media) {
  return media === undefined || (
    Array.isArray(media)
    && media.every((item) => (
      isPlainObject(item)
      && nonEmptyString(item.resourceId)
      && nonEmptyString(item.role)
      && (item.caption === undefined || typeof item.caption === "string")
    ))
  );
}

function normalizeExportResource(resource) {
  const bytes = resource?.bytes instanceof Uint8Array
    ? resource.bytes
    : resource?.bytes instanceof ArrayBuffer
      ? new Uint8Array(resource.bytes)
      : null;
  if (
    !isPlainObject(resource)
    || !nonEmptyString(resource.id)
    || !safeArchivePath(resource.path)
    || !resource.path.startsWith("assets/")
    || !SUPPORTED_IMAGE_TYPES.has(resource.mediaType)
    || !bytes
    || bytes.byteLength > MAX_ENTRY_BYTES
    || !validImageMetadata(resource.image)
  ) {
    throw new GridAtlasImportError("書き出す画像情報を確認できません");
  }
  return { ...resource, bytes };
}

function assertRequiredExtensions(requiredExtensions) {
  if (
    !Array.isArray(requiredExtensions)
    || new Set(requiredExtensions).size !== requiredExtensions.length
    || requiredExtensions.some((key) => !EXTENSION_KEY_PATTERN.test(key))
  ) {
    throw new GridAtlasImportError("必須拡張情報を確認できません");
  }
  const unsupported = requiredExtensions.find((key) => !SUPPORTED_REQUIRED_EXTENSIONS.has(key));
  if (unsupported) {
    throw new GridAtlasImportError(`未対応の必須拡張です: ${unsupported}`);
  }
}

function validExtensions(extensions) {
  return extensions === undefined || (
    isPlainObject(extensions)
    && Object.keys(extensions).every((key) => EXTENSION_KEY_PATTERN.test(key))
  );
}

function validImageMetadata(image) {
  return image === undefined || (
    isPlainObject(image)
    && Number.isInteger(image.width)
    && image.width > 0
    && Number.isInteger(image.height)
    && image.height > 0
  );
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function parseJsonBytes(bytes, label) {
  try {
    return JSON.parse(strFromU8(bytes));
  } catch (error) {
    throw new GridAtlasImportError(`${label}がJSONではありません`, { cause: error });
  }
}

async function assertSha256(bytes, expected, label) {
  const actual = await sha256Hex(bytes);
  if (actual !== expected.toLowerCase()) {
    throw new GridAtlasImportError(`${label}の整合性を確認できません`);
  }
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function decodeBase64UrlUtf8(encoded) {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) {
    throw new GridAtlasImportError("URLのGRID ATLASデータをデコードできません");
  }
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new GridAtlasImportError("URLのGRID ATLASデータをデコードできません", { cause: error });
  }
}

function assertSafeArchivePath(path) {
  if (!safeArchivePath(path)) {
    throw new GridAtlasImportError(".gridatlas内に安全でないパスがあります");
  }
}

function safeArchivePath(path) {
  if (typeof path !== "string" || !path || path.includes("\\") || path.startsWith("/")) return false;
  const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
  if (!normalized) return false;
  const segments = normalized.split("/");
  return segments.every((segment) => segment && segment !== "." && segment !== "..");
}

function validSha256(value) {
  return typeof value === "string" && /^[a-fA-F0-9]{64}$/.test(value);
}

function validDateTime(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validDateTimeOptional(value) {
  return value === undefined || validDateTime(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
