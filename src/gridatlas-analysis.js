export const GRIDATLAS_LINE_LAYER_EXTENSION = "io.gridatlas.lines";
export const GRIDATLAS_LINE_LAYER_VERSION = 1;

export function buildGridAtlasLineLayer(links, toSharedPointId) {
  const items = [];
  const seenPairs = new Set();
  const seenIds = new Set();

  for (const link of Array.isArray(links) ? links : []) {
    const a = toSharedPointId(link?.a);
    const b = toSharedPointId(link?.b);
    if (!a || !b || a === b) continue;

    const pairKey = [a, b].sort().join("\u0000");
    if (seenPairs.has(pairKey)) continue;

    let id = typeof link?.id === "string" && link.id ? link.id : `line-${items.length + 1}`;
    while (seenIds.has(id)) id = `${id}-${items.length + 1}`;
    seenPairs.add(pairKey);
    seenIds.add(id);

    const item = { id, a, b };
    if (typeof link?.createdAt === "string" && link.createdAt) item.createdAt = link.createdAt;
    items.push(item);
  }

  return items.length > 0
    ? { version: GRIDATLAS_LINE_LAYER_VERSION, items }
    : null;
}

export function readGridAtlasLineLayer(document, toLocalPointId, createLocalId) {
  const layer = document?.extensions?.[GRIDATLAS_LINE_LAYER_EXTENSION];
  if (
    !layer
    || typeof layer !== "object"
    || layer.version !== GRIDATLAS_LINE_LAYER_VERSION
    || !Array.isArray(layer.items)
  ) {
    return [];
  }

  const links = [];
  const seenPairs = new Set();
  for (const item of layer.items) {
    const a = toLocalPointId(item?.a);
    const b = toLocalPointId(item?.b);
    if (!a || !b || a === b) continue;

    const pairKey = [a, b].sort().join("\u0000");
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    links.push({
      id: createLocalId(),
      a,
      b,
      ...(typeof item?.createdAt === "string" && item.createdAt ? { createdAt: item.createdAt } : {})
    });
  }
  return links;
}

export function withoutGridAtlasLineLayer(extensions) {
  if (!extensions || typeof extensions !== "object" || Array.isArray(extensions)) return {};
  const next = structuredClone(extensions);
  delete next[GRIDATLAS_LINE_LAYER_EXTENSION];
  return next;
}
