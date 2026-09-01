#!/usr/bin/env bun
// Renders skills/poteto-mode/capabilities.md from coupling.yaml.
// Table rendering is mechanical, so this generation is safe. Prose is not
// generated anywhere; the playbooks are hand-ported.

import { YAML } from "bun";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

const root = join(dirname(new URL(import.meta.url).pathname), "..");
const ledger = YAML.parse(readFileSync(join(root, "coupling.yaml"), "utf8"));
const target = join(root, "skills/poteto-mode/capabilities.md");

const { harnesses } = ledger;
const row = (cells) => `| ${cells.join(" | ")} |`;
const head = (cells) => [row(cells), row(cells.map(() => "---"))].join("\n");

const marks = { native: "", substitute: "", degrade: "degraded, ", drop: "absent, " };

function capabilityTable() {
  const rows = ledger.capabilities
    .filter((c) => !c.parameters)
    .map((c) =>
      row([`\`${c.id}\``, ...harnesses.map((h) => `${marks[c[h].gap]}${c[h].use}`)])
    );
  return [head(["capability", ...harnesses]), ...rows].join("\n");
}

function parameterTable() {
  const withParams = ledger.capabilities.filter((c) => c.parameters);
  return withParams
    .map((c) => {
      const rows = Object.entries(c.parameters).map(([name, byHarness]) =>
        row([`\`${name}\``, ...harnesses.map((h) => byHarness[h] ?? "-")])
      );
      return [head(["parameter", ...harnesses]), ...rows].join("\n");
    })
    .join("\n\n");
}

function consequences() {
  const items = ledger.capabilities
    .filter((c) => c.consequence)
    .map((c) => `- **\`${c.id}\`.** ${c.consequence.trim()}`);
  return items.join("\n");
}

function roleList() {
  return ledger.roles
    .map((r) => {
      const slots = r.slots ? ` Slots: ${r.slots.map((s) => `\`${s}\``).join(", ")}.` : "";
      return `- **${r.id}.** ${r.what.trim()}${slots}\n  Absent: ${r.absent.trim()}`;
    })
    .join("\n");
}

function prerequisiteList() {
  return ledger.prerequisites
    .map((p) => `- **\`${p.binary}\`.** ${p.what.trim()} Absent: ${p.absent.trim()}`)
    .join("\n");
}

const out = `<!-- Generated from coupling.yaml by scripts/render-capabilities.mjs. Do not edit. -->

# Capabilities

Read your own harness column. Everything upstream resolved through a Cursor
primitive resolves here instead.

Cursor is one column, not the baseline. If you are running in Cursor, its column
is upstream's original behavior.

## Capabilities

${capabilityTable()}

### Parameters on every delegate call

${parameterTable()}

### What the gaps cost

${consequences()}

## Roles

The pack names the role, never a vendor. Values come from the override file
\`/setup-pstack-anywhere\` writes. When a role has no value, use the absent path
and say which verification you did not perform. Never imply a capability you do
not have.

${roleList()}

## Prerequisites

Tools, not harness features. Missing one removes the playbooks that depend on it.

${prerequisiteList()}

## Paths

${ledger.path_assumptions.map((p) => `- **${p.id}.** Upstream used \`${p.was}\`. ${p.resolution.trim()}`).join("\n")}
`;

writeFileSync(target, out);
console.log(`wrote ${target}`);
