import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildGridAtlasArchive } from "../src/gridatlas-import.js";

const defaultCsvPath = "docs/data/candidate-sites-200-v3/candidate-sites-200-shrines-temples-v3.csv";
const defaultOutputPath = "docs/data/candidate-sites-200-v3/kinki-pentagram-sites-v3-200.gridatlas";
const csvPath = resolve(process.argv[2] || defaultCsvPath);
const outputPath = resolve(process.argv[3] || defaultOutputPath);

function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }

  fields.push(field);
  return fields;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

const rows = parseCsv(await readFile(csvPath, "utf8"));
if (rows.length !== 200) {
  throw new Error(`最新版CSVは200地点ではありません: ${rows.length}件`);
}

const requiredColumns = ["no", "id", "name", "category", "designation", "prefecture", "latitude", "longitude", "selection_role"];
for (const column of requiredColumns) {
  if (!Object.hasOwn(rows[0], column)) throw new Error(`CSV列がありません: ${column}`);
}

const places = rows.map((row) => ({
  id: row.id,
  name: row.name,
  position: {
    latitude: Number(row.latitude),
    longitude: Number(row.longitude)
  },
  note: [row.category, row.designation, row.prefecture, row.selection_role]
    .filter(Boolean)
    .join(" / ")
}));

if (places.some((place) => !Number.isFinite(place.position.latitude) || !Number.isFinite(place.position.longitude))) {
  throw new Error("緯度経度に数値でない地点があります");
}

const document = {
  type: "place-list",
  schemaVersion: 1,
  id: "kinki-pentagram-sites-v3-200",
  name: "近畿五芒星 検証地点200 v3",
  description: "神社建築104地点・寺院建築91地点と、近畿五芒星の固定5地点を合わせた検証用リスト。",
  attribution: {
    name: "文化庁 国指定文化財等データベース／GRID ATLAS",
    url: "https://kunishitei.bunka.go.jp/bsys/index"
  },
  places,
  extensions: {
    "io.gridatlas.lines": {
      version: 1,
      items: [
        ["kinki-shrine-temple-sites-v5-nested-001", "kinki-shrine-temple-sites-v5-nested-003"],
        ["kinki-shrine-temple-sites-v5-nested-003", "kinki-shrine-temple-sites-v5-nested-005"],
        ["kinki-shrine-temple-sites-v5-nested-005", "kinki-shrine-temple-sites-v5-nested-002"],
        ["kinki-shrine-temple-sites-v5-nested-002", "kinki-shrine-temple-sites-v5-nested-004"],
        ["kinki-shrine-temple-sites-v5-nested-004", "kinki-shrine-temple-sites-v5-nested-001"]
      ].map(([a, b], index) => ({ id: `pentagram-line-${index + 1}`, a, b }))
    }
  }
};

const archive = await buildGridAtlasArchive(document, [], {
  exportedAt: "2026-08-11T00:00:00.000Z"
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, archive.bytes);
console.log(`出力: ${outputPath}`);
console.log(`地点数: ${document.places.length}`);
console.log(`ファイルサイズ: ${archive.bytes.byteLength} bytes`);
