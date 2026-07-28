import { readFile } from "node:fs/promises";
import { assertGridAtlasDocument } from "../src/gridatlas-import.js";

const paths = {
  documentSchema: new URL("../docs/gridatlas-v1/schema/gridatlas-place-list.schema.json", import.meta.url),
  manifestSchema: new URL("../docs/gridatlas-v1/schema/gridatlas-package-manifest.schema.json", import.meta.url),
  minimal: new URL("../docs/gridatlas-v1/examples/minimal.document.json", import.meta.url),
  full: new URL("../docs/gridatlas-v1/examples/media-and-extensions.document.json", import.meta.url)
};

for (const path of [paths.documentSchema, paths.manifestSchema]) {
  const schema = JSON.parse(await readFile(path, "utf8"));
  if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") {
    throw new Error("Schema must use JSON Schema 2020-12");
  }
}

for (const path of [paths.minimal, paths.full]) {
  assertGridAtlasDocument(JSON.parse(await readFile(path, "utf8")));
}

console.log("GRID ATLAS v1 RC1 spec fixtures: OK");
