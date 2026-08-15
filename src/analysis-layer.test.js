import { describe, expect, it } from "vitest";
import {
  ANALYSIS_LAYER_VERSION,
  analysisLineEndpointIdentityKey,
  analysisLineEndpointPairKey,
  canonicalAnalysisVertexKey,
  createAnalysisFigure,
  createAnalysisLine,
  figureEdges,
  normalizeAnalysisLayer,
  normalizeAnalysisLine,
  normalizeAnalysisVertex,
  removeAnalysisFigureVertex,
  setAnalysisFigureClosed
} from "./analysis-layer.js";
import { analyzeSegmentShape } from "./shape-analysis.js";

function vertex(lat, lng, name, placeRef = null) {
  return { lat, lng, name, placeRef };
}

describe("analysis layer model", () => {
  it("normalizes a vertex to a coordinate key and keeps its creation snapshot", () => {
    const result = normalizeAnalysisVertex({
      geo: { lat: "35.5", lng: "135.25" },
      id: "point-1",
      title: "古社"
    });

    expect(result).toEqual({
      lat: 35.5,
      lng: 135.25,
      key: "geo:35.5:135.25",
      name: "古社",
      placeRef: "point-1"
    });
    expect(canonicalAnalysisVertexKey(result.lat, result.lng)).toBe(result.key);
  });

  it("ignores legacy endpoint fields instead of maintaining a second line model", () => {
    const result = normalizeAnalysisLine({
      id: "legacy-line",
      a: "point-a",
      b: "point-b",
      aEndpoint: { id: "point-a", title: "A", geo: { lat: 35, lng: 135 } },
      bEndpoint: { id: "point-b", title: "B", geo: { lat: 35.1, lng: 135.1 } },
      strokeId: "stroke-1"
    });

    expect(result).toBeNull();
  });

  it("keeps line geometry usable when both place references are null", () => {
    const result = createAnalysisLine({
      id: "snapshot-line",
      a: vertex(35, 135, "A"),
      b: vertex(35.1, 135.1, "B")
    });

    expect(result.a.placeRef).toBeNull();
    expect(result.b.placeRef).toBeNull();
    expect(result.a.key).not.toBe(result.b.key);
  });

  it("does not change a line snapshot when the source point is moved or renamed", () => {
    const sourceA = vertex(35, 135, "A", "a");
    const sourceB = vertex(35.1, 135.1, "B", "b");
    const line = createAnalysisLine({ id: "line-1", a: sourceA, b: sourceB });

    sourceA.name = "A moved";
    sourceA.lat = 36;
    sourceA.lng = 136;

    expect(line.a).toMatchObject({ lat: 35, lng: 135, name: "A", placeRef: "a" });
  });

  it("stores ordered figure vertices and derives only its edges", () => {
    const figure = createAnalysisFigure({
      id: "figure-1",
      closed: true,
      name: "四点",
      color: "#AABBCC",
      vertices: [vertex(35, 135, "A"), vertex(35, 135.1, "B"), vertex(35.1, 135.1, "C")]
    });

    expect(figure).toEqual({
      id: "figure-1",
      vertices: expect.any(Array),
      closed: true,
      name: "四点",
      color: "#aabbcc"
    });
    expect(figure).not.toHaveProperty("area");
    expect(figure).not.toHaveProperty("perimeter");
    expect(figureEdges(figure)).toHaveLength(3);
    expect(figureEdges(figure).at(-1)).toMatchObject({
      a: { name: "C" },
      b: { name: "A" }
    });
  });

  it("normalizes canonical sibling lines and figures without reading legacy links", () => {
    const layer = normalizeAnalysisLayer({
      id: "layer-1",
      name: "保存済み",
      links: [{
        id: "line-1",
        a: "a",
        b: "b",
        aEndpoint: { id: "a", geo: { lat: 35, lng: 135 } },
        bEndpoint: { id: "b", geo: { lat: 35.1, lng: 135.1 } }
      }],
      lines: [createAnalysisLine({ id: "line-1", a: vertex(35, 135, "A"), b: vertex(35.1, 135.1, "B") })],
      figures: [{ id: "figure-1", closed: true, vertices: [vertex(35, 135, "A"), vertex(35.1, 135.1, "B"), vertex(35.2, 135, "C")] }]
    });

    expect(layer.version).toBe(ANALYSIS_LAYER_VERSION);
    expect(layer.lines).toHaveLength(1);
    expect(layer.figures).toHaveLength(1);
    expect(layer).not.toHaveProperty("links");
  });

  it("uses coordinate pair identity only for duplicate-line prevention", () => {
    const first = createAnalysisLine({
      id: "line-1",
      a: vertex(35, 135, "A", "point-a"),
      b: vertex(35.1, 135.1, "B", "point-b")
    });
    const second = createAnalysisLine({
      id: "line-2",
      a: vertex(35, 135, "A copy", "point-a-copy"),
      b: vertex(35.1, 135.1, "B copy", "point-b-copy")
    });

    expect(analysisLineEndpointPairKey(first)).toBe(analysisLineEndpointPairKey(second));
    expect(analysisLineEndpointIdentityKey(first, "a")).toBe("geo:35:135");
    expect(first.id).not.toBe(second.id);
  });

  it("survives a near Ise endpoint swap and swap-back without using point identity", () => {
    const points = [
      vertex(34.4550, 136.7252, "伊勢内宮", "naiku"),
      vertex(34.4552, 136.7254, "A", "a"),
      vertex(34.4554, 136.7254, "B", "b"),
      vertex(34.4554, 136.7252, "空蔵寺", "kuzoji")
    ];
    const lines = [
      createAnalysisLine({ id: "ab", a: points[0], b: points[1] }),
      createAnalysisLine({ id: "bc", a: points[2], b: points[1] }),
      createAnalysisLine({ id: "cd", a: points[2], b: points[3] }),
      createAnalysisLine({ id: "da", a: points[0], b: points[3] })
    ];
    const toRuntime = (line) => ({
      a: { ...line.a, x: line.a.lng, y: line.a.lat, geo: { lat: line.a.lat, lng: line.a.lng }, endpointKey: line.a.key },
      b: { ...line.b, x: line.b.lng, y: line.b.lat, geo: { lat: line.b.lat, lng: line.b.lng }, endpointKey: line.b.key }
    });
    const analyze = (items) => analyzeSegmentShape(items.map(toRuntime));
    const swapped = normalizeAnalysisLine({ ...lines[0], a: lines[0].b, b: lines[0].a });
    const swappedBack = normalizeAnalysisLine({ ...swapped, a: swapped.b, b: swapped.a });

    expect(analyze(lines).valid).toBe(true);
    expect(analyze([swapped, ...lines.slice(1)]).valid).toBe(true);
    expect(analyze([swappedBack, ...lines.slice(1)]).valid).toBe(true);
    expect(analysisLineEndpointIdentityKey(lines[0], "a")).toBe("geo:34.455:136.7252");
  });

  it("keeps figures independent when lines are removed", () => {
    const layer = normalizeAnalysisLayer({
      lines: [createAnalysisLine({ id: "line-1", a: vertex(35, 135, "A"), b: vertex(35.1, 135.1, "B") })],
      figures: [createAnalysisFigure({ id: "figure-1", closed: true, vertices: [vertex(35, 135, "A"), vertex(35, 135.1, "B"), vertex(35.1, 135, "C")] })]
    });
    const afterLineDeletion = { ...layer, lines: layer.lines.filter((line) => line.id !== "line-1") };

    expect(afterLineDeletion.lines).toHaveLength(0);
    expect(afterLineDeletion.figures).toHaveLength(1);
  });

  it("allows reopening a closed figure but only closes figures with at least three vertices", () => {
    const triangle = createAnalysisFigure({
      id: "triangle",
      closed: true,
      vertices: [vertex(35, 135, "A"), vertex(35, 135.1, "B"), vertex(35.1, 135, "C")]
    });
    const open = setAnalysisFigureClosed(triangle, false);
    const reopened = setAnalysisFigureClosed(open, true);
    const line = createAnalysisFigure({
      id: "line-figure",
      closed: false,
      vertices: [vertex(35, 135, "A"), vertex(35, 135.1, "B")]
    });

    expect(open.closed).toBe(false);
    expect(reopened.closed).toBe(true);
    expect(setAnalysisFigureClosed(line, true).closed).toBe(false);
  });

  it("demotes a figure to one independent line when vertex deletion leaves two vertices", () => {
    const figure = createAnalysisFigure({
      id: "triangle",
      closed: true,
      vertices: [
        vertex(35, 135, "A", "a"),
        vertex(35, 135.1, "B", "b"),
        vertex(35.1, 135, "C", "c")
      ]
    });

    const result = removeAnalysisFigureVertex(figure, 1, { lineId: "demoted-line" });

    expect(result.figure).toBeNull();
    expect(result.line).toMatchObject({
      id: "demoted-line",
      a: { lat: 35, lng: 135, name: "A", placeRef: "a" },
      b: { lat: 35.1, lng: 135, name: "C", placeRef: "c" }
    });
  });

  it("does not delete a vertex from a two-vertex figure", () => {
    const figure = createAnalysisFigure({
      id: "two-vertex",
      vertices: [vertex(35, 135, "A"), vertex(35, 135.1, "B")]
    });

    const result = removeAnalysisFigureVertex(figure, 0, { lineId: "unused" });

    expect(result.figure).toEqual(figure);
    expect(result.line).toBeNull();
  });
});
