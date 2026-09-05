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
// Exit 1 for missing or unexpected definitions in the selected root. Managers
// can declare optional skips and expected overlay body hashes in install-policy.json.

import { existsSync, readdirSync, realpathSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
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
// A skill is the same definition when its SKILL.md body matches, frontmatter
// excluded. Path identity does not survive a skill manager that rebuilds
// each directory as per-file links and materializes SKILL.md to inject its own
// frontmatter, so realpath differs for a byte-identical skill.
const body = (text) => text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
const definition = (dir) => {
  const path = join(dir, "SKILL.md");
  if (!existsSync(path)) return null;
  return createHash("sha256").update(body(readFileSync(path, "utf8"))).digest("hex");
};
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
const policyAt = (root) => {
  const path = join(root, "setup-pstack-anywhere/install-policy.json");
  if (!existsSync(path)) return { skipped: new Set(), definitions: {} };
  const policy = JSON.parse(readFileSync(path, "utf8"));
  if (policy.version !== 1 || !Array.isArray(policy.skipped) ||
      policy.skipped.some((name) => !packSet.has(name) || siblings.has(name))) {
    throw new Error(`invalid install policy ${path}: skips must name optional pack skills`);
  }
  const definitions = policy.definitions ?? {};
  if (typeof definitions !== "object" || definitions === null || Array.isArray(definitions) ||
      Object.entries(definitions).some(([name, hash]) => !packSet.has(name) ||
        policy.skipped.includes(name) || typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash))) {
    throw new Error(`invalid install policy ${path}: definitions must map skill names to body SHA-256 hashes`);
  }
  return { skipped: new Set(policy.skipped), definitions };
};
for (const root of roots) {
  const { skipped, definitions } = policyAt(root);
  for (const name of packNames) {
    if (skipped.has(name)) {
      console.log(`skipped ${join(root, name)} (install policy; existing definition preserved)`);
      continue;
    }
    if (definition(join(root, name)) !== null) continue;
    console.log(`missing ${join(root, name)}`);
    missing++;
  }
  for (const name of packNames) {
    if (skipped.has(name)) continue;
    const found = definition(join(root, name));
    if (found === null || found === (definitions[name] ?? definition(join(PACK, name)))) continue;
    console.log(`shadowed ${join(root, name)} -> ${realOrNull(join(root, name, "SKILL.md"))}`);
    missing++;
  }
}

const checked = new Set([...roots, PACK]);
let commonDuplicate = false;
for (const [harness, root] of KNOWN_ROOTS) {
  if (checked.has(root) || !isDir(root)) continue;
  checked.add(root);
  const { skipped, definitions } = policyAt(root);
  for (const name of packNames) {
    if (skipped.has(name)) continue;
    const found = definition(join(root, name));
    if (found === null || found === (definitions[name] ?? definition(join(PACK, name)))) continue;
    console.log(`duplicate ${join(root, name)} -> ${realOrNull(join(root, name, "SKILL.md"))} (${harness} root)`);
    if (COMMON_NAMES.includes(name)) commonDuplicate = true;
  }
}
if (commonDuplicate) {
  console.log(`note: ${COMMON_NAMES.join(", ")} are common skill names; the other definition wins or collides depending on the harness`);
}

if (missing > 0) process.exit(1);
for (const root of roots) console.log(`ok ${root}: ${packNames.length} skills, ${siblings.size} siblings resolved`);
