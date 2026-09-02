// Driver for conformance scenario worker_defaults_identity.
//
// Records the seeded poteto-probe definition (path and verbatim contents) into
// definition.txt before the agent is prompted, so the artifact exists even when
// the agent never gets that far. A harness whose subagentsDir is null in
// harnesses.yaml gets no seed; the note names the line and the prompt is sent
// with step 1 struck, leaving the negative trial only.

import { YAML } from "bun";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..", "..");

// The subagentsDir entry and its line number inside this harness's block, so
// the null case can be cited the way the scenario's precondition asks.
const subagentsDir = (harness) => {
  const text = readFileSync(join(ROOT, "harnesses.yaml"), "utf8");
  const entry = YAML.parse(text).harnesses.find((h) => h.id === harness);
  if (!entry) throw new Error(`no harness ${harness} in harnesses.yaml`);
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.trim() === `- id: ${harness}`);
  const at = lines.findIndex((l, i) => i > start && /^\s+subagentsDir:/.test(l));
  return { dir: entry.subagentsDir ?? null, line: at + 1 };
};

export default async function drive(ctx) {
  const { dir, line } = subagentsDir(ctx.harness);
  const cite = `harnesses.yaml:${line}`;
  let promptText = ctx.promptText;

  if (dir === null) {
    ctx.note("definition_path", `null: harnesses.yaml records subagentsDir: null for ${ctx.harness} (${cite})`);
    writeFileSync(
      join(ctx.scratch, "definition.txt"),
      `no definition installed: harnesses.yaml records subagentsDir: null for ${ctx.harness} (${cite})\nnegative trial only\n`,
    );
    promptText =
      `Note from the operator: this harness has no subagent definition directory, so skip step 1 entirely. ` +
      `Instead write one line into positive-report.txt: ` +
      `\`skipped: no subagent definition directory (${cite})\`. Then do steps 2 and 3.\n\n${promptText}`;
  } else {
    const installDir = dir.replace(/^~(?=$|\/)/, ctx.home);
    // Every seeded file under the dir, so a harness with more than one
    // candidate form (codex) has all of them on record.
    const files = existsSync(installDir) ? readdirSync(installDir).filter((n) => n.startsWith("poteto-probe.")).sort() : [];
    if (files.length === 0) throw new Error(`no poteto-probe definition seeded under ${installDir}; expected bench/worker_defaults_identity/home/${ctx.harness}/`);
    const paths = files.map((n) => join(installDir, n));
    ctx.note("definition_path", paths.join(", "));
    ctx.note("subagents_dir_source", `${dir} (${cite})`);
    writeFileSync(
      join(ctx.scratch, "definition.txt"),
      [`subagentsDir ${dir} (${cite})`, ...paths.flatMap((p) => ["", `=== ${p} ===`, readFileSync(p, "utf8").replace(/\n$/, "")]), ""].join("\n"),
    );
  }

  const { status, settled_by } = await ctx.prompt(promptText);
  ctx.note("prompt_status", settled_by ? `${status} (${settled_by})` : status);
  for (const name of ["positive-report.txt", "negative-trial.txt"]) ctx.note(name, existsSync(join(ctx.scratch, name)) ? "written" : "missing");
}
