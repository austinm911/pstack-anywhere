#!/usr/bin/env bun
// Drives one conformance scenario against one harness inside a herdr session.
//
//   bun bench/run.mjs <scenario> <harness> <model>
//
// It prepares the evidence run directory with `probe prepare`, runs the
// scenario's setup.sh, launches the harness in a new pane, sends
// bench/<scenario>/prompt.md, and harvests the transcript, the herdr responses,
// and whatever files the scenario declares as artifacts.
//
// It never writes observations.yaml. Reading the run is the operator's job, and
// tooling that filled that file in would be scoring its own run.
//
// Exit codes: 2 usage, 3 not inside herdr, 4 missing input, 6 agent start failed.
// Anything else is passed through from the command that failed.

import { YAML } from "bun";
import { existsSync, readFileSync, writeFileSync, copyFileSync, statSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { hostname, platform, release } from "node:os";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const USAGE = "usage: bun bench/run.mjs <scenario> <harness> <model>";
const TRANSCRIPT_HEADER =
  "<!-- captured by bench/run.mjs via herdr agent read, recent-unwrapped; may be a viewport if the agent uses the alternate screen -->";
// Written by the tooling itself, so never copied out of the scratch dir.
const TOOLING_ARTIFACTS = new Set(["run.yaml", "observations.yaml", "invocation.json", "transcript.md"]);

const decoder = new TextDecoder();
const die = (code, message) => (console.error(message), process.exit(code));

// Every subprocess goes through here: one decode, one cwd, and no shell, so
// prompt text and scratch paths are argv elements rather than words.
const exec = (argv, cwd = ROOT) => {
  const p = Bun.spawnSync(argv, { cwd, stdout: "pipe", stderr: "pipe" });
  return { code: p.exitCode, out: decoder.decode(p.stdout), err: decoder.decode(p.stderr) };
};

// herdr answers a JSON envelope on stdout for every command here except
// `agent read --format text`, which answers raw terminal text.
const herdr = (...args) => {
  const r = exec(["herdr", ...args]);
  if (r.code !== 0) throw new Error(`herdr ${args[0]} ${args[1]} failed (${r.code}): ${r.err.trim() || r.out.trim()}`);
  return JSON.parse(r.out);
};

// A pane whose agent start failed hosts no agent, so `agent read` has no target
// there. `pane read` is the same scrollback without that requirement.
const readText = (target, lines) => {
  const args = [target, "--source", "recent-unwrapped", "--lines", String(lines), "--format", "text"];
  const r = exec(["herdr", "agent", "read", ...args]);
  return r.code === 0 ? r.out : exec(["herdr", "pane", "read", ...args]).out;
};

const harnessCli = (harness) => {
  const ledger = YAML.parse(readFileSync(join(ROOT, "harnesses.yaml"), "utf8"));
  const entry = (ledger.harnesses ?? []).find((h) => h.id === harness);
  if (!entry) die(4, `no harness ${harness} in harnesses.yaml`);
  if (!entry.cli) die(4, `harness ${harness} carries no cli block in harnesses.yaml`);
  return entry.cli;
};

// `probe prepare` refuses to overwrite, and an unexecuted directory from today
// is the one we should be filling rather than a reason to stop.
const prepareRun = (scenario, harness) => {
  const r = exec(["bun", "scripts/coupling.mjs", "probe", "prepare", scenario, harness]);
  if (r.code === 0) {
    const prepared = r.out.split("\n")[0].match(/^prepared (\S+)$/);
    if (!prepared) die(4, `probe prepare printed no run dir:\n${r.out}`);
    return prepared[1];
  }
  const reuse = r.err.match(/^(\S+) is already prepared and unexecuted/m);
  if (r.code === 5 && reuse) {
    console.log(`reusing ${reuse[1]}`);
    return reuse[1];
  }
  console.error(r.err.trim() || r.out.trim());
  process.exit(r.code);
};

const setupScratch = (scenario) => {
  const script = join("bench", scenario, "setup.sh");
  if (!existsSync(join(ROOT, script))) die(4, `no ${script}`);
  const r = exec(["bash", script]);
  if (r.code !== 0) die(r.code, `${script} failed (${r.code}):\n${r.err.trim() || r.out.trim()}`);
  const dir = r.out.trim().split("\n").pop().trim();
  if (!dir || !existsSync(dir)) die(4, `${script} printed no usable scratch dir: ${JSON.stringify(dir)}`);
  return dir;
};

const harnessVersion = (cli) => {
  const argv = cli.version_command.split(/\s+/).filter(Boolean);
  const r = exec(argv);
  return { command: cli.version_command, raw: r.out + r.err };
};

const agentName = (scenario) => `bench-${scenario.replaceAll("_", "-")}`.slice(0, 32).toLowerCase();

const startAgent = (name, cli, pane, model) => {
  const args = [
    ...cli.model_flag.replace("{model}", model).split(/\s+/).filter(Boolean),
    ...(cli.extra_args ?? []),
  ];
  const argv = ["agent", "start", name, "--kind", cli.kind, "--pane", pane, "--timeout", "60000", "--", ...args];
  try {
    return { start: herdr(...argv), argv };
  } catch (error) {
    console.error(error.message);
    console.error(readText(pane, 60));
    process.exit(6);
  }
};

const scenarioArtifacts = (scenario) => {
  const r = exec(["bun", "scripts/coupling.mjs", "probe", "list", "--json"]);
  if (r.code !== 0) die(r.code, `probe list failed:\n${r.err.trim()}`);
  const found = JSON.parse(r.out).scenarios.find((s) => s.scenario === scenario);
  if (!found) die(4, `no scenario ${scenario} in conformance/scenarios.yaml`);
  return found.artifacts;
};

// The scenario's side-effect target is probe.txt in the scratch dir. Its
// after-state is ours to read, because the prompt forbids the agent touching it.
const harvestArtifacts = (scratch, runDir, artifacts) => {
  const written = [];
  const take = (from, to) => (copyFileSync(join(scratch, from), join(ROOT, runDir, to)), written.push(to));
  if (existsSync(join(scratch, "probe.txt")) && artifacts.includes("probe.after.txt")) take("probe.txt", "probe.after.txt");
  for (const name of readdirSync(scratch)) {
    if (TOOLING_ARTIFACTS.has(name) || !artifacts.includes(name)) continue;
    if (!statSync(join(scratch, name)).isFile()) continue;
    take(name, name);
  }
  return written;
};

// The prepared manifest's header explains why the nulls are there. Keep it, and
// fill the nulls rather than rewriting the file from scratch.
const rewriteManifest = (path, fields) => {
  const text = readFileSync(path, "utf8");
  const header = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("#")) break;
    header.push(line);
  }
  const manifest = { ...YAML.parse(text), ...fields };
  writeFileSync(path, [...header, header.length ? "" : null, YAML.stringify(manifest)].filter((l) => l !== null).join("\n"));
};

const [scenario, harness, model] = process.argv.slice(2);
if (!scenario || !harness || !model) die(2, USAGE);
if (process.env.HERDR_ENV !== "1") die(3, "bench/run.mjs drives herdr panes; run it inside a herdr session (HERDR_ENV=1)");

const cli = harnessCli(harness);
const runDir = prepareRun(scenario, harness);
const runId = basename(runDir);
const scratch = setupScratch(scenario);
const promptText = readFileSync(join(ROOT, "bench", scenario, "prompt.md"), "utf8");

const startedAt = new Date().toISOString();
const version = harnessVersion(cli);
const pane = herdr("pane", "split", "--current", "--direction", "right", "--cwd", scratch, "--no-focus").result.pane
  .pane_id;
const name = agentName(scenario);
const { start, argv } = startAgent(name, cli, pane, model);

// A prompt that times out still leaves a transcript worth harvesting, so the
// failure is recorded and the run continues.
let prompted = null;
let status = "unknown";
try {
  prompted = herdr("agent", "prompt", name, promptText, "--wait", "--timeout", "600000");
  status = prompted.result?.agent?.agent_status ?? "unknown";
} catch (error) {
  status = `prompt failed: ${error.message}`;
}

writeFileSync(join(ROOT, runDir, "transcript.md"), `${TRANSCRIPT_HEADER}\n\n${readText(name, 2000)}`);
const get = herdr("agent", "get", name);
const explain = herdr("agent", "explain", name, "--json");
writeFileSync(
  join(ROOT, runDir, "invocation.json"),
  `${JSON.stringify(
    {
      herdr: { start, prompt: prompted, get, explain },
      // herdr reports the argv it handed the harness; the herdr call is the fallback.
      cli: { command: start.result?.argv ?? ["herdr", ...argv], version: version.raw },
      model,
      scratch_dir: scratch,
    },
    null,
    2,
  )}\n`,
);

const artifacts = scenarioArtifacts(scenario);
const written = harvestArtifacts(scratch, runDir, artifacts);
const endedAt = new Date().toISOString();

rewriteManifest(join(ROOT, runDir, "run.yaml"), {
  scenario,
  harness,
  run_id: runId,
  coupling_version: YAML.parse(readFileSync(join(ROOT, "coupling.yaml"), "utf8")).version,
  started_at: startedAt,
  ended_at: endedAt,
  operator: process.env.USER ?? null,
  machine: hostname(),
  os: `${platform()} ${release()}`,
  harness_version: version.raw.split("\n").find((line) => line.trim()) ?? null,
  harness_version_source: `${version.command} -> ${version.raw.trim()}`,
  clock: "UTC, Date.toISOString on the bench host",
  environment_deltas: "none recorded by bench/run.mjs; fill by hand if the harness config is non-default",
});

console.log(`run dir    ${runDir}`);
console.log(`agent      ${name} on pane ${pane}, status ${status}`);
console.log(`artifacts  ${["run.yaml", "transcript.md", "invocation.json", ...written].join(", ")}`);
console.log(`next: write observations.yaml by hand, then bun scripts/coupling.mjs probe inspect ${runId}`);
