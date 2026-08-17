export const ANALYSIS_LAYER_VERSION = 2;

const DEFAULT_VERTEX_NAME = "Point";

function finiteCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? (Object.is(number, -0) ? 0 : number) : null;
}

function cleanText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : "";
}

function hasOwn(value, key) {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);
}

export function canonicalAnalysisVertexKey(lat, lng) {
  const normalizedLat = finiteCoordinate(lat);
  const normalizedLng = finiteCoordinate(lng);
  if (normalizedLat === null || normalizedLng === null) return "";
  return `geo:${normalizedLat}:${normalizedLng}`;
}

export function normalizeAnalysisVertex(input, options = {}) {
  if (!input || typeof input !== "object") return null;

  const sourceGeo = input.geo && typeof input.geo === "object" ? input.geo : input;
  const lat = finiteCoordinate(sourceGeo.lat);
  const lng = finiteCoordinate(sourceGeo.lng);
  if (lat === null || lng === null) return null;

  const name = cleanText(input.name) || cleanText(input.title) || DEFAULT_VERTEX_NAME;
  const legacyPlaceRef = cleanText(input.id);
  const placeRefCandidate = hasOwn(input, "placeRef") ? input.placeRef : legacyPlaceRef;
  const placeRef = cleanText(placeRefCandidate);
  const vertex = {
    lat,
    lng,
    key: canonicalAnalysisVertexKey(lat, lng),
    name
  };

  const note = cleanText(input.note);
  if (note) vertex.note = note.slice(0, 500);

  if (hasOwn(input, "placeRef") || legacyPlaceRef) {
    vertex.placeRef = placeRef || null;
  } else if (options.placeRef !== undefined) {
    vertex.placeRef = cleanText(options.placeRef) || null;
  }

  return vertex;
}

export function analysisVertexPlaceRef(vertex) {
  const normalized = normalizeAnalysisVertex(vertex);
  return normalized?.placeRef || null;
}

function lineVertexSource(line, side) {
  const direct = line?.[side];
  return direct && typeof direct === "object" ? direct : null;
}

function normalizeLineVertex(line, side) {
  const source = lineVertexSource(line, side);
  return source ? normalizeAnalysisVertex(source) : null;
}

function copyOptionalString(target, source, key) {
  const value = cleanText(source?.[key]);
  if (value) target[key] = value;
}

export function normalizeAnalysisLine(line) {
  if (!line || typeof line !== "object") return null;
  const id = cleanText(line.id);
  if (!id) return null;

  const a = normalizeLineVertex(line, "a");
  const b = normalizeLineVertex(line, "b");
  if (!a || !b || a.key === b.key) return null;

  const normalized = { id, a, b };
  const color = normalizeColor(line.color);
  if (color) normalized.color = color;
  copyOptionalString(normalized, line, "strokeId");
  copyOptionalString(normalized, line, "createdAt");
  copyOptionalString(normalized, line, "updatedAt");
  return normalized;
}

export function createAnalysisLine({ id, a, b, strokeId = "", color = "", createdAt = "", updatedAt = "" } = {}) {
  return normalizeAnalysisLine({
    id,
    a,
    b,
    ...(strokeId ? { strokeId } : {}),
    ...(color ? { color } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {})
  });
}

export function normalizeAnalysisFigure(figure) {
  if (!figure || typeof figure !== "object") return null;
  const id = cleanText(figure.id);
  if (!id || !Array.isArray(figure.vertices)) return null;

  const vertices = figure.vertices.map((vertex) => normalizeAnalysisVertex(vertex)).filter(Boolean);
  if (vertices.length < 2) return null;

  const normalized = { id, vertices };
  const name = cleanText(figure.name);
  const note = cleanText(figure.note);
  const color = normalizeColor(figure.color);
  const createdAt = cleanText(figure.createdAt);
  if (name) normalized.name = name;
  if (note) normalized.note = note.slice(0, 500);
  if (color) normalized.color = color;
  if (createdAt) normalized.createdAt = createdAt;
  const layer = cleanText(figure.layer);
  if (layer) normalized.layer = layer;
  const barrierId = cleanText(figure.barrierId);
  if (barrierId) normalized.barrierId = barrierId;
  return normalized;
}

export function createAnalysisFigure({ id, vertices, name = "", note = "", color = "", createdAt = "", layer = "", barrierId = "" } = {}) {
  return normalizeAnalysisFigure({
    id,
    vertices,
    ...(name ? { name } : {}),
    ...(note ? { note } : {}),
    ...(color ? { color } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(layer ? { layer } : {}),
    ...(barrierId ? { barrierId } : {})
  });
}

export function figureEdges(figure) {
  const normalized = normalizeAnalysisFigure(figure);
  if (!normalized || normalized.vertices.length < 2) return [];

  const edges = normalized.vertices.slice(1).map((vertex, index) => ({
    a: normalized.vertices[index],
    b: vertex
  }));
  if (normalized.vertices.length >= 3) {
    edges.push({
      a: normalized.vertices.at(-1),
      b: normalized.vertices[0]
    });
  }
  return edges;
}

export function analysisLineEndpointIdentityKey(line, side) {
  const vertex = normalizeLineVertex(line, side);
  return vertex?.key || "";
}

export function analysisLineEndpointPairKey(line) {
  return [analysisLineEndpointIdentityKey(line, "a"), analysisLineEndpointIdentityKey(line, "b")]
    .sort()
    .join("\u0000");
}

export function normalizeAnalysisLayer(layer) {
  const rawLines = Array.isArray(layer?.lines) ? layer.lines : [];
  const rawFigures = Array.isArray(layer?.figures) ? layer.figures : [];
  const normalized = {
    version: ANALYSIS_LAYER_VERSION,
    id: cleanText(layer?.id) || "analysis-layer-default",
    name: cleanText(layer?.name) || "考察レイヤー",
    lines: rawLines.map(normalizeAnalysisLine).filter(Boolean),
    figures: rawFigures.map(normalizeAnalysisFigure).filter(Boolean)
  };
  const sourceDocumentId = cleanText(layer?.sourceDocumentId);
  if (sourceDocumentId) normalized.sourceDocumentId = sourceDocumentId;
  return normalized;
}

export function removeAnalysisFigureVertex(figure, vertexIndex) {
  const normalized = normalizeAnalysisFigure(figure);
  if (!normalized || !Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= normalized.vertices.length) {
    return { figure: normalized, line: null };
  }
  if (normalized.vertices.length <= 2) {
    return { figure: normalized, line: null };
  }

  const vertices = normalized.vertices.filter((_, index) => index !== vertexIndex);
  if (vertices.length === 2) {
    return {
      figure: null,
      line: null
    };
  }

  return {
    figure: {
      ...normalized,
      vertices
    },
    line: null
  };
}
