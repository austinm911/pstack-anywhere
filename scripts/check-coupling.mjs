#!/usr/bin/env bun
// Fails when a Cursor-coupled token reappears in the ported skills, and reports
// when a coupling site named in coupling.yaml no longer exists.
//
// Markdown prose only. Scripts are excluded: watch-pr detects review-automation
// authors by name, worktree-audit.sh uses shell -gt comparisons, and neither is
// a coupling. Word boundaries, so `-gt` and `target` never match `gt`.
//
// Usage: bun scripts/check-coupling.mjs [--refresh <path-to-upstream-pstack>]

import { YAML } from "bun";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { Glob } from "bun";

const root = join(dirname(new URL(import.meta.url).pathname), "..");
const ledger = YAML.parse(readFileSync(join(root, "coupling.yaml"), "utf8"));

const BANNED = [
  { pattern: /\bBugbot\b/i, why: "review_automation is a role, not a vendor" },
  { pattern: /cursor-team-kit/i, why: "slop_strip, ui_driver, and cli_driver are roles" },
  { pattern: /\bcontrol-(ui|cli)\b/, why: "use the ui_driver and cli_driver roles" },
  { pattern: /\bcreate-skill\b/, why: "use the skill_authoring role" },
  { pattern: /(^|[\s(`])\/loop\b/, why: "use the wake_on_event capability" },
  { pattern: /\bAskQuestion\b/, why: "use the human_question capability" },
  { pattern: /\brun_in_background\b/, why: "use the worker_defaults background row" },
  { pattern: /\bsubagent_type\b/, why: "use the worker_defaults identity row" },
  { pattern: /environment:\s*"cloud"/, why: "use spawn_worker and worker_durability" },
  { pattern: /\bpstack\/skills\b/, why: "use harness-relative skill addressing" },
  { pattern: /git show origin\/main:/, why: "trunk re-read is replaced by a plain re-read" },
  { pattern: /\bagent-transcripts\b/, why: "use the transcript_dir resolution" },
  { pattern: /\b(grok|gpt|claude)-[a-z0-9.-]*(max|xhigh|thinking)[a-z0-9.-]*\b/i, why: "model slugs are role slots" },
  { pattern: /\/setup-pstack\b(?!-anywhere)/, why: "the skill is /setup-pstack-anywhere" },
];

// `Cursor` itself is legitimate in a harness column and in a real disk path, so
// it is checked separately against the ledger's allowlist.
const CURSOR = /\bCursor\b|\.cursor\//;

const allow = ledger.lint_allowlist.map((entry) => entry.path);
const allowed = (file) => allow.some((prefix) => file === prefix || file.startsWith(prefix));

const failures = [];
const files = [...new Glob("skills/**/*.md").scanSync(root)].sort();

for (const file of files) {
  if (allowed(file)) continue;
  const lines = readFileSync(join(root, file), "utf8").split("\n");
  lines.forEach((line, index) => {
    // A reference to the triage file by name is not a Bugbot mention.
    const text = line.replaceAll("references/bugbot-triage.md", "");
    for (const { pattern, why } of BANNED) {
      if (pattern.test(text)) failures.push({ file, line: index + 1, hit: pattern.source, why });
    }
    if (CURSOR.test(text) && !/\bharness\b|column|upstream/i.test(text)) {
      failures.push({ file, line: index + 1, hit: "Cursor", why: "name the capability, or allowlist the path in coupling.yaml" });
    }
  });
}

// Every site the ledger names must still exist, otherwise the ledger is stale.
const sites = new Set();
for (const group of ["capabilities", "roles", "prerequisites", "path_assumptions"]) {
  for (const entry of ledger[group] ?? []) for (const site of entry.sites ?? []) sites.add(site);
}
const missing = [...sites].filter((site) => {
  const inSkill = join(root, "skills/poteto-mode", site);
  return !existsSync(inSkill) && !existsSync(join(root, site));
});

for (const { file, line, hit, why } of failures) {
  console.error(`${file}:${line}: ${hit} — ${why}`);
}
for (const site of missing) {
  console.error(`coupling.yaml: site ${site} does not exist, the ledger is stale`);
}

const refreshFlag = process.argv.indexOf("--refresh");
if (refreshFlag !== -1) {
  const upstream = process.argv[refreshFlag + 1];
  if (!upstream || !existsSync(upstream)) {
    console.error(`--refresh needs a path to an upstream pstack checkout`);
    process.exit(2);
  }
  console.log(`\nUpstream sweep against ${relative(process.cwd(), upstream)}:`);
  for (const file of [...new Glob("skills/**/*.md").scanSync(upstream)].sort()) {
    const text = readFileSync(join(upstream, file), "utf8");
    const hits = BANNED.filter(({ pattern }) => pattern.test(text)).map(({ pattern }) => pattern.source);
    if (hits.length > 0 && !sites.has(file.replace("skills/poteto-mode/", ""))) {
      console.log(`  new coupling site ${file}: ${hits.join(", ")}`);
    }
  }
}

const count = failures.length + missing.length;
console.log(count === 0 ? `clean, ${files.length} markdown files` : `\n${count} problems in ${files.length} markdown files`);
process.exit(count === 0 ? 0 : 1);
