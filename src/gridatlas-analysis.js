import {
  normalizeAnalysisFigure,
  normalizeAnalysisLine
} from "./analysis-layer.js";

export const GRIDATLAS_ANALYSIS_EXTENSION = "io.gridatlas.analysis";
export const GRIDATLAS_ANALYSIS_LAYER_VERSION = 1;

export function normalizeGridAtlasLineColor(color) {
  return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)
    ? color.toLowerCase()
    : "";
}

function serializableLine(line) {
  const normalized = normalizeAnalysisLine(line);
  if (!normalized) return null;

  const result = {
    id: normalized.id,
    a: normalized.a,
    b: normalized.b
  };
  const color = normalizeGridAtlasLineColor(normalized.color);
  if (color) result.color = color;
  if (normalized.strokeId) result.strokeId = normalized.strokeId;
  return result;
}

function serializableFigure(figure) {
  const normalized = normalizeAnalysisFigure(figure);
  if (!normalized) return null;

  const result = {
    id: normalized.id,
    vertices: normalized.vertices
  };
  if (normalized.name) result.name = normalized.name;
  const color = normalizeGridAtlasLineColor(normalized.color);
  if (color) result.color = color;
  if (normalized.createdAt) result.createdAt = normalized.createdAt;
  return result;
}

export function buildGridAtlasAnalysisLayer(lines, figures) {
  const normalizedLines = (Array.isArray(lines) ? lines : [])
    .map(serializableLine)
    .filter(Boolean);
  const normalizedFigures = (Array.isArray(figures) ? figures : [])
    .map(serializableFigure)
    .filter(Boolean);

  if (normalizedLines.length === 0 && normalizedFigures.length === 0) return null;
  return {
    version: GRIDATLAS_ANALYSIS_LAYER_VERSION,
    lines: normalizedLines,
    figures: normalizedFigures
  };
}

export function readGridAtlasAnalysisLayer(document) {
  const layer = document?.extensions?.[GRIDATLAS_ANALYSIS_EXTENSION];
  if (
    !layer
    || typeof layer !== "object"
    || layer.version !== GRIDATLAS_ANALYSIS_LAYER_VERSION
    || !Array.isArray(layer.lines)
    || !Array.isArray(layer.figures)
  ) {
    return { lines: [], figures: [] };
  }

  return {
    lines: layer.lines.map(normalizeAnalysisLine).filter(Boolean),
    figures: layer.figures.map(normalizeAnalysisFigure).filter(Boolean)
  };
}

export function withoutGridAtlasAnalysisLayer(extensions) {
  if (!extensions || typeof extensions !== "object" || Array.isArray(extensions)) return {};
  const next = structuredClone(extensions);
  delete next[GRIDATLAS_ANALYSIS_EXTENSION];
  return next;
}
