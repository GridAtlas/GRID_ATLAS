const DATABASE_NAME = "grid-atlas-assets-v1";
const DATABASE_VERSION = 1;
const STORE_NAME = "assets";

let databasePromise = null;
const objectUrls = new Map();

function openDatabase() {
  if (!("indexedDB" in globalThis)) return Promise.reject(new Error("IndexedDB is unavailable"));
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error || new Error("Could not open asset storage")));
    request.addEventListener("blocked", () => reject(new Error("Asset storage upgrade is blocked")));
  });
  return databasePromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error || new Error("Asset storage request failed")));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", resolve);
    transaction.addEventListener("abort", () => reject(transaction.error || new Error("Asset storage transaction aborted")));
    transaction.addEventListener("error", () => reject(transaction.error || new Error("Asset storage transaction failed")));
  });
}

async function sha256Hex(blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function putGridAtlasAsset(blob, options = {}) {
  if (!(blob instanceof Blob)) throw new TypeError("Asset must be a Blob");
  const id = await sha256Hex(blob);
  const record = {
    id,
    blob,
    mediaType: options.mediaType || blob.type || "application/octet-stream",
    name: typeof options.name === "string" ? options.name : "",
    byteLength: blob.size,
    storedAt: new Date().toISOString()
  };
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).put(record);
  await transactionDone(transaction);
  return { id, mediaType: record.mediaType, name: record.name, byteLength: record.byteLength };
}

export async function getGridAtlasAsset(id) {
  if (typeof id !== "string" || !id) return null;
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readonly");
  return (await requestResult(transaction.objectStore(STORE_NAME).get(id))) || null;
}

export async function gridAtlasAssetUrl(id) {
  if (objectUrls.has(id)) return objectUrls.get(id);
  const asset = await getGridAtlasAsset(id);
  if (!asset?.blob) return "";
  const url = URL.createObjectURL(asset.blob);
  objectUrls.set(id, url);
  return url;
}

export async function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    throw new TypeError("Photo data is not a data URL");
  }
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("Could not decode photo data");
  return response.blob();
}

export async function storeGridAtlasDataUrl(dataUrl, options = {}) {
  const blob = await dataUrlToBlob(dataUrl);
  const asset = await putGridAtlasAsset(blob, { ...options, mediaType: options.mediaType || blob.type });
  return { ...asset, url: await gridAtlasAssetUrl(asset.id) };
}

export async function hydrateGridAtlasAssets(pointLists) {
  let changed = false;
  for (const list of Array.isArray(pointLists) ? pointLists : []) {
    for (const point of Array.isArray(list.points) ? list.points : []) {
      try {
        if (point.photoAssetId) {
          const url = await gridAtlasAssetUrl(point.photoAssetId);
          if (url) point.photo = url;
        } else if (typeof point.photo === "string" && point.photo.startsWith("data:")) {
          const asset = await storeGridAtlasDataUrl(point.photo, { name: point.photoName });
          point.photoAssetId = asset.id;
          point.photo = asset.url;
          changed = true;
        }
      } catch (error) {
        console.warn("GRID ATLAS photo migration failed", error);
      }
    }
  }
  return changed;
}
