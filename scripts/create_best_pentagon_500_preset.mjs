import crypto from "node:crypto";
import fs from "node:fs";
import { strToU8, unzipSync, zipSync } from "fflate";

const sourcePath = process.argv[2] ?? "presets/kinki-pentagram-rank1-of-500.gridatlas";
const outputPath = process.argv[3] ?? "presets/kinki-pentagon-best-of-500.gridatlas";
const source = unzipSync(fs.readFileSync(sourcePath));
const document = JSON.parse(new TextDecoder().decode(source["document.json"]));
const lineExtension = document.extensions?.["io.gridatlas.lines"];
const pentagonLines = (lineExtension?.items ?? []).filter((item) => item.id.startsWith("pentagon-line-"));

document.id = "kinki-pentagon-best-of-500";
document.name = "⛩️500地点からの五角形・最高候補";
document.description = "500地点から、現行の分析基準（辺のばらつきと頂点角の差）で探索して得た最高候補。対象は新長谷寺釈迦堂、久能山東照宮、広徳寺大御堂、松苧神社本殿、気多神社本殿。参考整い度 88.80。全255,244,687,600通りの総当たりではなく、200万件の再現可能なランダム探索と局所改善による候補。";
if (lineExtension) lineExtension.items = pentagonLines;

const documentBytes = strToU8(`${JSON.stringify(document, null, 2)}\n`);
const manifest = {
  format: "gridatlas-package",
  formatVersion: 1,
  exportedAt: new Date().toISOString(),
  document: {
    path: "document.json",
    mediaType: "application/vnd.gridatlas.place-list+json",
    byteLength: documentBytes.byteLength,
    sha256: crypto.createHash("sha256").update(documentBytes).digest("hex"),
  },
  resources: [],
  requiredExtensions: ["io.gridatlas.lines"],
};
const manifestBytes = strToU8(`${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(outputPath, zipSync({ "manifest.json": manifestBytes, "document.json": documentBytes }));
console.log(JSON.stringify({ outputPath, places: document.places.length, lines: pentagonLines.length, sha256: manifest.document.sha256 }, null, 2));
