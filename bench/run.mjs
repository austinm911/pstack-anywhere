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
import { existsSync, readFileSync, writeFileSync, copyFileSync, statSync, readdirSync, mkdirSync, realpathSync } from "node:fs";
import { join, dirname, basename, relative, isAbsolute } from "node:path";
import { hostname, platform, release, homedir, tmpdir } from "node:os";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const USAGE = "usage: bun bench/run.mjs <scenario> <harness> <model>";
const TRANSCRIPT_HEADER =
  "<!-- captured by bench/run.mjs via herdr agent read, recent-unwrapped; may be a viewport if the agent uses the alternate screen -->";
// Written by the tooling itself, so never copied out of the scratch dir.
const TOOLING_ARTIFACTS = new Set(["run.yaml", "observations.yaml", "invocation.json", "transcript.md"]);

const decoder = new TextDecoder();
const die = (code, message) => (console.error(message), process.exit(code));
// Reading another program's files: a bad line or a vanished path never loses a
// run. A function fallback sees the error, a value fallback replaces it.
const tryOr = (fn, fallback) => {
  try {
    return fn();
  } catch (error) {
    return typeof fallback === "function" ? fallback(error) : fallback;
  }
};

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
  if (r.code !== 0) {
    const detail = r.err.trim() || r.out.trim();
    // herdr answers a failure as {"error":{"code":...}} on stderr, and startup recovery branches on that code.
    const code = tryOr(() => JSON.parse(detail).error.code, null);
    throw Object.assign(new Error(`herdr ${args[0]} ${args[1]} failed (${r.code}): ${detail}`), { code });
  }
  return JSON.parse(r.out);
};

// A pane whose agent start failed hosts no agent, so `agent read` has no target
// there. `pane read` is the same scrollback without that requirement.
const readText = (target, lines, source = "recent-unwrapped") => {
  const args = [target, "--source", source, "--lines", String(lines), "--format", "text"];
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

// Herdr names are unique among live agents, and the last run's pane may still
// be open, so the name carries harness and counter, not only the scenario.
const agentName = (runId) => {
  const [scenario, harness, , counter] = runId.split(".");
  const tail = `-${harness}-${counter}`;
  return `b-${scenario.replaceAll("_", "-")}`.slice(0, 32 - tail.length).toLowerCase() + tail;
};

// `agent start` rejects a pane that is not an available shell, and a pane split a second ago is still loading its shell prompt, so wait until the shell is its own foreground process.
const waitForShell = (pane) => {
  let info = null;
  for (const until = Date.now() + 15000; Date.now() < until; Bun.sleepSync(250)) {
    info = tryOr(() => herdr("pane", "process-info", "--pane", pane).result.process_info, null);
    if (info?.foreground_processes?.length === 1 && info.foreground_processes[0].pid === info.shell_pid) return;
  }
  die(6, `pane ${pane} never became an idle shell within 15s; last process-info:\n${JSON.stringify(info)}`);
};

const startAgent = (name, cli, pane, model) => {
  waitForShell(pane);
  const args = [...cli.model_flag.replace("{model}", model).split(/\s+/).filter(Boolean), ...(cli.extra_args ?? [])];
  const argv = ["agent", "start", name, "--kind", cli.kind, "--pane", pane, "--timeout", "60000", "--", ...args];
  // herdr's own shell-availability check lags process-info by a second or two
  // after a split, so a busy answer gets a few more tries before it counts.
  let error;
  for (let tries = 0; tries < 12; tries += 1, Bun.sleepSync(1000)) {
    try {
      return { start: herdr(...argv), argv, recovered: false };
    } catch (caught) {
      error = caught;
      if (error.code !== "agent_pane_busy") break;
    }
  }
  // A blocked startup (a dialog) answers agent_not_ready but keeps the name, so
  // the dialog step that follows can use it. A wrong first detection of the kind
  // leaves the agent running but unnamed: wait for detection to agree, then name it.
  if (error.code === "agent_not_ready") return { start: { error: error.message }, argv, recovered: true };
  for (const until = Date.now() + 30000; error.code === "agent_kind_mismatch" && Date.now() < until; Bun.sleepSync(500)) {
    const got = tryOr(() => herdr("agent", "get", pane), null);
    if (got?.result?.agent?.agent === cli.kind) return herdr("agent", "rename", pane, name), { start: got, argv, recovered: true };
  }
  die(6, `${error.message}\n${readText(pane, 60)}`);
};

// A harness meeting a directory for the first time can open a dialog that would swallow the prompt. The wording lives in harnesses.yaml, matched case-insensitively, so a new dialog is a config line.
const answerStartup = (name, dialogs) => {
  const answered = [];
  for (let round = 0; dialogs.length && round < 6; round += 1) {
    const text = readText(name, 60, "visible");
    const hit = dialogs.find((d) => new RegExp(d.match, "i").test(text));
    if (!hit) break;
    herdr("agent", "send-keys", name, ...hit.keys);
    answered.push(hit.match);
    Bun.sleepSync(1000);
  }
  return answered;
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

// Each harness keys its session store by working directory with its own slug
// rule, all read off disk and written down in harnesses.yaml, so try every
// observed form, on the scratch path and on its realpath.
const resolveSessionDir = (template, scratch) => {
  const base = template.replace(/^~(?=$|\/)/, homedir());
  if (!base.includes("{cwd_slug}")) return existsSync(base) ? base : null;
  const dash = (p) => p.replace(/[/\\:]/g, "-");
  const under = (rel) => rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  const slugs = [scratch, tryOr(() => realpathSync(scratch), scratch)].flatMap((dir) => {
    const [home, tmp] = [relative(homedir(), dir), relative(tmpdir(), dir)];
    const abs = [dir.replace(/[^a-zA-Z0-9]/g, "-"), `--${dash(dir.replace(/^\//, ""))}--`];
    return [...abs, under(home) ? `-${dash(home)}` : null, under(tmp) ? (tmp ? `-tmp-${dash(tmp)}` : "-tmp") : null];
  });
  const slug = [...new Set(slugs.filter(Boolean))].find((s) => existsSync(base.replace("{cwd_slug}", s)));
  return slug ? base.replace("{cwd_slug}", slug) : null;
};

// Assistant tool calls as each harness records them, every shape read off disk:
//   omp, pi  {message: {role: assistant, content: [{type: toolCall, name, arguments}]}}
//   claude   {type: assistant, message: {content: [{type: tool_use, name, input}]}}
//   codex    {type: response_item, payload: {type: function_call | custom_tool_call, name, arguments | input}}, a JSON string
const TOOL_CALL_TYPES = new Set(["toolCall", "tool_use", "function_call", "custom_tool_call"]);
const extractCalls = (text) => {
  let [calls, known] = [[], false];
  for (const line of text.split("\n")) {
    const entry = line.trim() ? tryOr(() => JSON.parse(line), null) : null;
    const parts = Array.isArray(entry?.message?.content) ? entry.message.content : [];
    const payload = entry?.type === "response_item" ? entry.payload : null;
    if (parts.length > 0 || payload) known = true;
    const ts = typeof entry?.timestamp === "string" ? entry.timestamp : null;
    for (const part of payload ? [...parts, payload] : parts)
      if (TOOL_CALL_TYPES.has(part?.type)) calls.push({ name: part.name, arguments: part.arguments ?? part.input ?? null, ts });
  }
  return { calls, known };
};

// The transcript only shows the TUI's collapsed tool boxes, so the arguments an agent really sent come from the harness's own session log.
const captureSession = (runDir, template, scratch, startedAt) => {
  const dest = join(ROOT, runDir, "session");
  const since = Date.parse(startedAt) - 5000; // slack for a header written just before our clock
  const dir = template ? resolveSessionDir(template, scratch) : null;
  const where = dir ?? `${template ?? "no session_dir in harnesses.yaml"} (nothing matched ${scratch})`;
  const all = (dir ? readdirSync(dir, { recursive: true }) : []).map((rel) => ({ rel, s: statSync(join(dir, rel), { throwIfNoEntry: false }) }));
  const rels = all.filter(({ s }) => s?.isFile() && s.mtimeMs >= since).map(({ rel }) => rel).sort();
  let [calls, known, workers] = [[], false, {}];
  mkdirSync(dest, { recursive: true });
  for (const rel of rels) {
    mkdirSync(dirname(join(dest, rel)), { recursive: true });
    copyFileSync(join(dir, rel), join(dest, rel));
    if (!rel.endsWith(".jsonl")) continue;
    const parsed = extractCalls(readFileSync(join(dir, rel), "utf8"));
    known ||= parsed.known;
    // A file in a subdirectory is a subagent's log, named after the worker.
    if (rel.includes("/")) workers[basename(rel, ".jsonl")] = parsed.calls;
    else calls = calls.concat(parsed.calls);
  }
  if (rels.length === 0) writeFileSync(join(dest, "NONE.txt"), `searched ${where}; nothing newer than ${startedAt}\n`);
  const note = rels.length === 0 ? `no session files under ${where}` : known ? null : `copied from ${dir} but not parsed: unrecognised line shape`;
  return { dir, files: rels.length, calls: known ? calls : null, workers, note };
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
  writeFileSync(path, [...header, header.length ? "" : null, YAML.stringify(manifest, null, 2)].filter((l) => l !== null).join("\n"));
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
const name = agentName(runId);
const { start, argv, recovered } = startAgent(name, cli, pane, model);
const startupAnswers = answerStartup(name, cli.startup ?? []);
// Prompting a blocked agent types the prompt into whatever dialog is still up, so a pane that will not settle stops the run here.
const settled = tryOr(() => herdr("agent", "wait", name, "--timeout", "30000").result?.agent?.agent_status ?? "unknown", (error) => `wait failed: ${error.code ?? error.message}`);
if (!["idle", "working", "unknown"].includes(settled)) die(6, `agent ${name} is not ready to prompt (${settled}):\n${readText(name, 60, "visible")}`);

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

// An agent that exited (a crash, a self-update, a bad model flag) has no name
// to read through, so the pane is read instead and the run stays unexecuted.
const gone = tryOr(() => (herdr("agent", "get", name), false), true);
writeFileSync(join(ROOT, runDir, "transcript.md"), `${TRANSCRIPT_HEADER}\n\n${gone ? readText(pane, 2000) : readText(name, 2000)}`);
if (gone) die(6, `agent ${name} is gone from pane ${pane}; transcript.md holds the pane text, run.yaml is left unexecuted\n${readText(pane, 40, "visible")}`);
const get = herdr("agent", "get", name);
const explain = herdr("agent", "explain", name, "--json");

// Session capture is best effort: a run with no session log is still a run.
const failed = (error) => ({ dir: null, files: 0, calls: null, workers: {}, note: `session capture failed: ${error.message}` });
const session = tryOr(() => captureSession(runDir, cli.session_dir ?? null, scratch, startedAt), failed);

writeFileSync(
  join(ROOT, runDir, "invocation.json"),
  `${JSON.stringify(
    {
      herdr: { start, ...(recovered ? { start_recovered: true } : {}), prompt: prompted, get, explain, startup_answers: startupAnswers },
      // herdr reports the argv it handed the harness; the herdr call is the fallback.
      cli: { command: start.result?.argv ?? ["herdr", ...argv], version: version.raw },
      model,
      scratch_dir: scratch,
      session_dir: session.dir,
      calls: session.calls,
      calls_workers: session.workers,
      ...(session.note ? { calls_note: session.note } : {}),
    },
    null,
    2,
  )}\n`,
);

const artifacts = scenarioArtifacts(scenario);
const written = harvestArtifacts(scratch, runDir, artifacts);
const endedAt = new Date().toISOString();

// A failed prompt leaves the manifest unexecuted so the next attempt reuses
// this directory instead of bumping the counter for a run that never happened.
if (status.startsWith("prompt failed")) {
  die(6, `${status}\nrun dir ${runDir} kept unexecuted; transcript.md and invocation.json hold what the pane showed`);
}
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
const calls = (session.calls?.length ?? 0) + Object.values(session.workers).reduce((n, c) => n + c.length, 0);
console.log(`session    ${session.files} file(s) copied, ${calls} call(s) extracted${session.note ? ` (${session.note})` : ""}`);
console.log(`next: write observations.yaml by hand, then bun scripts/coupling.mjs probe inspect ${runId}`);
// Harvest is done, and a column of finished panes squeezes every later split
// into unreadable widths. BENCH_KEEP_PANE=1 leaves it for a look.
if (process.env.BENCH_KEEP_PANE !== "1") tryOr(() => herdr("pane", "close", pane), null);
