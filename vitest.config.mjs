import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(path.join(projectRoot, "cloud", "migrations"));
      return {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            AUTH_JWKS_URL: "https://auth.test/.well-known/jwks.json",
            AUTH_ISSUER: "https://auth.test/",
            AUTH_AUDIENCE: "grid-atlas-test",
            TEST_MIGRATIONS: migrations
          }
        }
      };
    })
  ],
  test: {
    include: ["cloud/test/**/*.test.js"],
    setupFiles: ["./cloud/test/setup.js"]
  }
});
