#!/usr/bin/env bun
// Compatibility shim. The lint moved into scripts/coupling.mjs, which owns the
// whole ledger: schema validation, derived occurrence state, unported findings,
// and generated-file drift. This name stays because README documents it.
//
// Usage: bun scripts/check-coupling.mjs [--refresh <path-to-upstream-pstack>]
//
// Exit codes collapse to the old contract: 0 clean, 1 problems, 2 a --refresh
// usage error. Run `bun scripts/coupling.mjs check` to get the class of problem
// in the exit code instead.

import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";

const engine = join(dirname(new URL(import.meta.url).pathname), "coupling.mjs");
const { status } = spawnSync(process.execPath, [engine, "check", ...process.argv.slice(2)], {
  stdio: "inherit",
});

process.exit(status === 0 ? 0 : status === 5 ? 2 : 1);
