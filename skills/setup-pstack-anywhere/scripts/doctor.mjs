#!/usr/bin/env bun
// Checks a pstack-anywhere install from wherever it landed.
//
//   bun <skills root>/setup-pstack-anywhere/scripts/doctor.mjs [<skills root>]
//
// The canonical pack is where this file really lives: the vendored or repo
// copy every link points at. Bun hands us that realpath and nothing else, so
// the root the harness sees is either the argument or, by default, every
// known root whose setup-pstack-anywhere resolves to this copy (the pack's own
// directory when none does). Every `../<name>/` a skill mentions must resolve
// in that root, or the skill reads a path that is not there.
//
// Exit 1 when a sibling is missing, 0 otherwise. Shadowed and duplicate
// copies are reported, not failed: a harness may well want the other one.

import { existsSync, readdirSync, realpathSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

const HOME = process.env.HOME;
const SELF = realpathSync(process.argv[1]);
const PACK = dirname(dirname(dirname(SELF)));

// Where each harness loads user skills from. `npx skills` uses ~/.codex/skills
// for codex and ~/.agents/skills for the rest.
const KNOWN_ROOTS = [
  ["claude", join(HOME, ".claude/skills")],
  ["codex", join(HOME, ".agents/skills")],
  ["codex", join(HOME, ".codex/skills")],
  ["pi", join(HOME, ".agents/skills")],
  ["pi", join(HOME, ".pi/agent/skills")],
  ["omp", join(HOME, ".agents/skills")],
];
// Names another pack is likely to ship too.
const COMMON_NAMES = ["tdd", "teach", "unslop"];

const isDir = (path) => existsSync(path) && statSync(path).isDirectory();
const realOrNull = (path) => (existsSync(path) ? realpathSync(path) : null);
const uniq = (paths) => [...new Set(paths)];

const known = uniq(KNOWN_ROOTS.map(([, root]) => root));
const ours = known.filter((root) => realOrNull(join(root, "setup-pstack-anywhere/scripts/doctor.mjs")) === SELF);
const roots = process.argv[2] ? [process.argv[2]] : ours.length > 0 ? ours : [PACK];

const packNames = readdirSync(PACK).filter((name) => existsSync(join(PACK, name, "SKILL.md")));
const packSet = new Set(packNames);

const markdown = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...markdown(path));
    else if (entry.name.endsWith(".md")) out.push(path);
  }
  return out;
};

const siblings = new Set();
for (const file of markdown(PACK)) {
  for (const match of readFileSync(file, "utf8").matchAll(/\.\.\/([a-z0-9-]+)\//g)) {
    if (packSet.has(match[1])) siblings.add(match[1]);
  }
}

let missing = 0;
for (const root of roots) {
  for (const name of [...siblings].sort()) {
    if (isDir(join(root, name))) continue;
    console.log(`missing ${join(root, name)}`);
    missing++;
  }
  for (const name of packNames) {
    const real = realOrNull(join(root, name));
    if (real !== null && real !== join(PACK, name)) console.log(`shadowed ${join(root, name)} -> ${real}`);
  }
}

const checked = new Set([...roots, PACK]);
let commonDuplicate = false;
for (const [harness, root] of KNOWN_ROOTS) {
  if (checked.has(root) || !isDir(root)) continue;
  checked.add(root);
  for (const name of packNames) {
    const real = realOrNull(join(root, name));
    if (real === null || real === join(PACK, name)) continue;
    console.log(`duplicate ${join(root, name)} -> ${real} (${harness} root)`);
    if (COMMON_NAMES.includes(name)) commonDuplicate = true;
  }
}
if (commonDuplicate) {
  console.log(`note: ${COMMON_NAMES.join(", ")} are common skill names; the other definition wins or collides depending on the harness`);
}

if (missing > 0) process.exit(1);
for (const root of roots) console.log(`ok ${root}: ${packNames.length} skills, ${siblings.size} siblings resolved`);
