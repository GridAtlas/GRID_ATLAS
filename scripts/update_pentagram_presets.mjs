import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { buildGridAtlasAnalysisLayer, GRIDATLAS_ANALYSIS_EXTENSION } from "../src/gridatlas-analysis.js";
import { buildGridAtlasArchive } from "../src/gridatlas-import.js";

const PRESETS = [
  {
    path: "presets/kinki-pentagram-kurazoji.gridatlas",
    exportedAt: "2026-09-01T12:00:00.000Z",
    order: [
      "izanagi-jingu",
      "kinki-shrine-temple-sites-v5-nested-027",
      "6fee750f-f995-460c-a7ef-3e5f1003f962",
      "kumano-hongu-taisha",
      "mt-ibuki"
    ]
  },
  {
    path: "presets/kinki-pentagram-rank1-of-500.gridatlas",
    exportedAt: "2026-09-01T12:00:01.000Z",
    order: [
      "kinki-shrine-temple-sites-v5-nested-118",
      "kinki-shrine-temple-sites-v5-nested-169",
      "kinki-shrine-temple-sites-v5-nested-496",
      "kinki-shrine-temple-sites-v5-nested-035",
      "kinki-shrine-temple-sites-v5-nested-442"
    ]
  }
];

for (const preset of PRESETS) {
  const outputPath = resolve(preset.path);
  const entries = unzipSync(await readFile(outputPath));
  const document = JSON.parse(strFromU8(entries["document.json"]));
  const placesById = new Map(document.places.map((place) => [place.id, place]));
  const vertices = preset.order.map((id) => {
    const place = placesById.get(id);
    if (!place) throw new Error(`${preset.path}: 地点 ${id} がありません`);
    return {
      id,
      lat: place.position.latitude,
      lng: place.position.longitude,
      name: place.name,
      placeRef: id
    };
  });
  const lines = vertices.map((a, index) => ({
    id: `pentagram-stroke-${index + 1}`,
    a,
    b: vertices[(index + 1) % vertices.length],
    strokeId: "pentagram-stroke"
  }));

  document.description = `${document.description} 外周の五角形は含めず、五芒星だけを一筆書きの連続線として表示する。`;
  const extensions = { ...(document.extensions || {}) };
  delete extensions["io.gridatlas.lines"];
  extensions[GRIDATLAS_ANALYSIS_EXTENSION] = buildGridAtlasAnalysisLayer(lines, []);
  document.extensions = extensions;

  const archive = await buildGridAtlasArchive(document, [], { exportedAt: preset.exportedAt });
  await writeFile(outputPath, archive.bytes);
  console.log(`${preset.path}: 5-point pentagram stroke written`);
}
