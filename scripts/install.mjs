#!/usr/bin/env bun
// Fallback install: one symlink per skill from the roots the harnesses read
// back to this repo's skills/. Use a skill manager or a plugin manifest when
// you have one; this is for the machine that has neither.
//
//   bun scripts/install.mjs [--dry-run] [--root <dir>]...
//
// Default roots are ~/.agents/skills (codex, pi, omp) and ~/.claude/skills.
// Anything already at <root>/<name> that is not a link to our copy is a
// collision: every collision is listed, nothing is written, exit 2. Resolve
// them by hand, the doctor's note on common names says why. On success the
// doctor runs against the first root and its exit code is ours.
//
// Exit codes: 2 collision, 5 usage, otherwise the doctor's.

import { existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, symlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { parseArgs } from "node:util";

const REPO = join(dirname(new URL(import.meta.url).pathname), "..");
const SKILLS = join(REPO, "skills");
const HOME = process.env.HOME;

let parsed;
try {
  parsed = parseArgs({
    args: process.argv.slice(2),
    options: { "dry-run": { type: "boolean", default: false }, root: { type: "string", multiple: true } },
    strict: true,
  });
} catch (error) {
  console.error(error.message);
  console.error("usage: bun scripts/install.mjs [--dry-run] [--root <dir>]...");
  process.exit(5);
}
const dryRun = parsed.values["dry-run"];
const roots = parsed.values.root ?? [join(HOME, ".agents/skills"), join(HOME, ".claude/skills")];

const names = readdirSync(SKILLS).filter((name) => existsSync(join(SKILLS, name, "SKILL.md")));

// lstat sees a dangling symlink where existsSync does not, and a dangling link
// at the target path is still something in the way.
const present = (path) => {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
};
const linksToOurs = (path, target) => existsSync(path) && realpathSync(path) === realpathSync(target);

const links = [];
const collisions = [];
for (const root of roots) {
  for (const name of names) {
    const target = join(SKILLS, name);
    const path = join(root, name);
    if (!present(path)) links.push([path, target]);
    else if (!linksToOurs(path, target)) collisions.push(path);
  }
}

for (const [path, target] of links) console.log(`link ${path} -> ${target}`);
for (const path of collisions) console.log(`collision ${path}`);
if (collisions.length > 0) process.exit(2);
if (dryRun) process.exit(0);

for (const [path, target] of links) {
  mkdirSync(dirname(path), { recursive: true });
  symlinkSync(target, path);
}

const doctor = Bun.spawnSync([process.execPath, join(roots[0], "setup-pstack-anywhere/scripts/doctor.mjs"), roots[0]], {
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(doctor.exitCode);
