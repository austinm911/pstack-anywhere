// Driver for conformance scenario worker_defaults_model.
//
// Fills the two preconditions the prompt cannot: the two model ids for this
// harness go into prompt.md through {{MODEL_A}} and {{MODEL_B}}, and after the
// turn the harness-side model record is read out of the harness's own session
// log under the scratch HOME and written to usage-record.txt in the scratch
// dir, where the runner harvests it. The workers' own words never reach that
// file; self-reports.txt is theirs and is labelled as such by the prompt.

import { YAML } from "bun";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "../..");

// Each pair: the id every existing run of this harness launched with, and a
// second id the same provider exposes. `source` names where each id was read.
// A `b` id not yet seen through this harness's own model flag is marked so;
// the run is what verifies it.
const MODELS = {
  claude: {
    a: "opus",
    b: "sonnet",
    source: {
      a: "run.yaml model of every claude run (evidence/runs/spawn_worker.claude.2026-09-02.01); that run's session/*.jsonl records message.model claude-opus-5 for it",
      b: "Agent tool `model` argument in evidence/runs/worker_defaults_readonly.claude.2026-09-02.01/invocation.json calls; that run's session/<sid>/subagents/agent-*.jsonl records message.model claude-sonnet-5 for it",
    },
  },
  codex: {
    a: "gpt-5.6-terra",
    b: "gpt-5.6-luna",
    source: {
      a: "run.yaml model of every codex run (evidence/runs/spawn_worker.codex.2026-09-02.01); session rollout-*.jsonl turn_context.model records the same slug per thread",
      b: "the openai-codex provider model every pi run used on this same OpenAI account (evidence/runs/spawn_worker.pi.2026-09-02.01 session model_change provider openai-codex modelId gpt-5.6-luna); not yet seen through codex -m, verified by this run",
    },
  },
  pi: {
    a: "openai-codex/gpt-5.6-luna",
    b: "openai-codex/gpt-5.6-terra",
    source: {
      a: "run.yaml model of every pi run (evidence/runs/spawn_worker.pi.2026-09-02.01); session model_change records provider openai-codex, modelId gpt-5.6-luna",
      b: "the slug every codex run used on the same openai-codex provider (evidence/runs/spawn_worker.codex.2026-09-02.01); not yet seen through pi --model, verified by this run",
    },
  },
  omp: {
    a: "opus",
    b: "sonnet",
    source: {
      a: "every omp run launched as opus:low (evidence/runs/spawn_worker.omp.2026-09-02.01), the CLI form appending a thinking level; session model_change resolves it to anthropic/claude-opus-5. An agent definition's `model` is a bare pattern list with thinkingLevel separate (references/harnesses/omp/src/packages/coding-agent/src/task/agents.ts:21-31, discovery/helpers.ts:226-241), so the bare alias is the id",
      b: "same alias syntax, the sibling Anthropic model; not yet seen through omp, verified by this run",
    },
  },
};

// Where each harness's session log lives under HOME, from harnesses.yaml; the
// {cwd_slug} tail is dropped because the record is found by mtime, not by slug.
const sessionRoot = (harness, home) => {
  const ledger = YAML.parse(readFileSync(join(ROOT, "harnesses.yaml"), "utf8"));
  const template = (ledger.harnesses ?? []).find((h) => h.id === harness)?.cli?.session_dir;
  if (!template) throw new Error(`harnesses.yaml has no cli.session_dir for ${harness}`);
  return template.replace(/\/?\{cwd_slug\}.*$/, "").replace(/^~(?=$|\/)/, home);
};

// The record is every `"model":"..."` (claude message.model, codex
// turn_context.model, omp model_change.model) or `"modelId":"..."` (pi
// model_change) token in a session file written during the turn, counted per
// file. Worker logs are their own files on every harness that has native
// workers: claude subagents/agent-*.jsonl, codex a second rollout-*.jsonl,
// omp <session>/<Worker>.jsonl. Values are quoted from the log, never typed.
const RECORD_CMD = (root, marker) =>
  `find ${JSON.stringify(root)} -type f -name '*.jsonl' -newer ${JSON.stringify(marker)} -print0 | sort -z | ` +
  `while IFS= read -r -d '' f; do printf '%s\\n' "== $f"; grep -oE '"model(Id)?":"[^"]*"' "$f" | sort | uniq -c; done`;

export default async function drive(ctx) {
  const models = MODELS[ctx.harness];
  if (!models) throw new Error(`worker_defaults_model has no model pair for harness ${ctx.harness}`);
  ctx.note("models", models);
  ctx.note("harness_record", `session log under ${sessionRoot(ctx.harness, ctx.home)}, files newer than the turn start; the run dir's session/ is the same capture`);

  // Files newer than this marker are the turn's; the harness may have written
  // its log header at startup, which is before the workers ran and is harmless.
  const marker = join(ctx.home, ".bench-drive-marker");
  writeFileSync(marker, "");
  const prompt = ctx.promptText.replaceAll("{{MODEL_A}}", models.a).replaceAll("{{MODEL_B}}", models.b);
  const turn = await ctx.prompt(prompt);
  ctx.note("turn", turn);

  const root = sessionRoot(ctx.harness, ctx.home);
  const record = ctx.shell(RECORD_CMD(root, marker));
  const lines = record.out.trim();
  const header = [
    `source: harness session log, ${root}, every *.jsonl written after the prompt was sent (find -newer), tokens "model"/"modelId" counted per file with grep -oE | sort | uniq -c`,
    `selections: A=${models.a} B=${models.b} C=poteto-nonexistent-model`,
    `harness: ${ctx.harness}`,
    ...(ctx.harness === "pi"
      ? ["note: pi has no native worker; a pi-herdr delegate runs in a pane opened from the operator's real HOME, so its log is not under the scratch HOME and cannot appear here. Only the parent's own record is below."]
      : []),
  ];
  const body = lines || `no session file newer than the turn under ${root}; command: ${RECORD_CMD(root, marker)}${record.err.trim() ? `\nstderr: ${record.err.trim()}` : ""}`;
  writeFileSync(join(ctx.scratch, "usage-record.txt"), `${header.join("\n")}\n\n${body}\n`);
  ctx.note("usage_record", lines ? `${lines.split("\n").filter((l) => l.startsWith("== ")).length} session file(s)` : "none found");

  // spawn-args.txt is not a declared artifact, so its content rides in run.yaml.
  const spawnArgs = ctx.shell("cat spawn-args.txt 2>/dev/null");
  ctx.note("spawn_args", spawnArgs.code === 0 ? spawnArgs.out : "spawn-args.txt not written");
}
