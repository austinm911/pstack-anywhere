import { test, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

test("orchestration scripts match the recorded Cursor upstream pin", () => {
  const manifest = JSON.parse(readFileSync(resolve(root, "conformance/upstream-orch.json"), "utf8"));
  const ledger = Bun.YAML.parse(readFileSync(resolve(root, "coupling.yaml"), "utf8"));
  expect(manifest.commit).toBe(ledger.upstream.sha);
  const prefix = "skills/poteto-mode/scripts/orch/";
  expect(readdirSync(resolve(root, prefix)).sort()).toEqual(
    Object.keys(manifest.files).map(path => path.slice(prefix.length)).sort()
  );
  for (const [path, expected] of Object.entries(manifest.files)) {
    const actual = createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
    expect(actual, path).toBe(expected);
  }
});
