import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const kindIndex = process.argv.indexOf("--kind");
const kind = kindIndex >= 0 ? process.argv[kindIndex + 1] : "";
const increments = { patch: 0.0001, feature: 0.001, milestone: 0.01 };

if (!(kind in increments)) {
  console.error("Usage: npm run version:web -- --kind patch|feature|milestone");
  process.exit(1);
}

const mainPath = path.join(root, "src", "main.js");
const readmePath = path.join(root, "README.md");
const indexPath = path.join(root, "index.html");
const serviceWorkerPath = path.join(root, "service-worker.js");
const main = fs.readFileSync(mainPath, "utf8");
const readme = fs.readFileSync(readmePath, "utf8");
const index = fs.readFileSync(indexPath, "utf8");
const serviceWorker = fs.readFileSync(serviceWorkerPath, "utf8");

const versionMatch = main.match(/const WEB_VERSION = "(\d+\.\d{4})";/);
const readmeMatch = readme.match(/現在のWeb版は `(\d+\.\d{4})` です。/);
const indexAssetMatch = index.match(/src\/main\.js\?v=(\d+)/);
const workerAssetMatch = serviceWorker.match(/src\/main\.js\?v=(\d+)/);
const cacheMatch = serviceWorker.match(/const CACHE_NAME = "grid-atlas-static-v(\d+)";/);
if (!versionMatch) throw new Error("WEB_VERSION was not found in src/main.js");
if (!readmeMatch) throw new Error("Web version line was not found in README.md");
if (!indexAssetMatch || !workerAssetMatch || !cacheMatch) {
  throw new Error("Asset cache versions were not found");
}
if (readmeMatch[1] !== versionMatch[1]) {
  throw new Error(`Version mismatch: src/main.js=${versionMatch[1]}, README.md=${readmeMatch[1]}`);
}
if (indexAssetMatch[1] !== workerAssetMatch[1]) {
  throw new Error(`Asset mismatch: index.html=${indexAssetMatch[1]}, service-worker.js=${workerAssetMatch[1]}`);
}

const nextVersion = (Number(versionMatch[1]) + increments[kind]).toFixed(4);
const nextAsset = Number(indexAssetMatch[1]) + 1;
const nextCache = Number(cacheMatch[1]) + 1;
const updatedMain = main.replace(versionMatch[0], `const WEB_VERSION = "${nextVersion}";`);
const updatedReadme = readme.replace(readmeMatch[0], `現在のWeb版は \`${nextVersion}\` です。`);
const updatedIndex = index.replace(indexAssetMatch[0], `src/main.js?v=${nextAsset}`);
const updatedServiceWorker = serviceWorker
  .replace(cacheMatch[0], `const CACHE_NAME = "grid-atlas-static-v${nextCache}";`)
  .replace(workerAssetMatch[0], `src/main.js?v=${nextAsset}`);

fs.writeFileSync(mainPath, updatedMain);
fs.writeFileSync(readmePath, updatedReadme);
fs.writeFileSync(indexPath, updatedIndex);
fs.writeFileSync(serviceWorkerPath, updatedServiceWorker);
console.log(`Web version ${versionMatch[1]} -> ${nextVersion} (${kind}); asset v${nextAsset}; cache v${nextCache}`);
