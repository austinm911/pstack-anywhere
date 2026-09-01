#!/usr/bin/env bun
// Compatibility shim. Rendering moved into scripts/coupling.mjs, which renders
// every file derived from coupling.yaml rather than just this one. This name
// stays because it is the name written into the generated file's header.
//
// Usage: bun scripts/render-capabilities.mjs [--dry-run|--check]

import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";

const engine = join(dirname(new URL(import.meta.url).pathname), "coupling.mjs");
const { status } = spawnSync(
  process.execPath,
  [engine, "render", "--only", "capabilities", ...process.argv.slice(2)],
  { stdio: "inherit" },
);

process.exit(status === 0 ? 0 : 1);
