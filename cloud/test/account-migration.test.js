import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("cloud account migration", () => {
  it("creates account, entitlement, and billing event tables", async () => {
    const result = await env.DB.prepare(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table'
         AND name IN ('cloud_accounts', 'cloud_entitlements', 'cloud_billing_events')
       ORDER BY name`
    ).all();

    expect(result.results.map((row) => row.name)).toEqual([
      "cloud_accounts",
      "cloud_billing_events",
      "cloud_entitlements"
    ]);
  });
});
