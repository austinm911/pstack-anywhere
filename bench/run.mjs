#!/usr/bin/env bun
// Drives one conformance scenario against one harness inside a herdr session.
//
//   bun bench/run.mjs <scenario> <harness> <model> [--extension] [--skill <name>]
//
// It prepares the evidence run directory with `probe prepare`, runs the
// scenario's setup.sh, builds a scratch HOME holding only the auth files
// harnesses.yaml lists (so no user skill, rule, hook, or context file reaches
// the run), optionally symlinks named skills into that HOME's skillsRoot,
// launches the harness in a new pane under that HOME, sends
// bench/<scenario>/prompt.md, and harvests the transcript, the herdr responses,
// and whatever files the scenario declares as artifacts. `--extension` adds the
// harness's declared extension to the launch and records it in run.yaml. A
// scenario carrying drive.mjs replaces the single prompt with its own script
// (see bench/README.md), and one carrying home/<harness>/ seeds those files
// into the scratch HOME.
//
// It never writes observations.yaml. Reading the run is the operator's job, and
// tooling that filled that file in would be scoring its own run.
//
// Exit codes: 2 usage, 3 not inside herdr, 4 missing input, 6 agent start
// failed, 7 a secret reached the run dir (the leak guard at the end deleted the
// capture that held it). Anything else is passed through from the command that
// failed.

import { YAML } from "bun";
import { existsSync, readFileSync, writeFileSync, appendFileSync, copyFileSync, statSync, readdirSync, mkdirSync, mkdtempSync, rmSync, realpathSync, symlinkSync } from "node:fs";
import { join, dirname, basename, relative, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { hostname, platform, release, homedir, tmpdir } from "node:os";
import { createHash } from "node:crypto";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const USAGE = "usage: bun bench/run.mjs <scenario> <harness> <model> [--extension] [--skill <name>]";
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
const herdrResult = (args, r) => {
  if (r.code !== 0) {
    const detail = r.err.trim() || r.out.trim();
    // herdr answers a failure as {"error":{"code":...}} on stderr, and startup recovery branches on that code.
    const code = tryOr(() => JSON.parse(detail).error.code, null);
    throw Object.assign(new Error(`herdr ${args[0]} ${args[1]} failed (${r.code}): ${detail}`), { code });
  }
  return JSON.parse(r.out);
};
const herdr = (...args) => herdrResult(args, exec(["herdr", ...args]));
// The waits (`prompt --wait`, `agent wait`) block for minutes, and a driver
// polls the pane meanwhile, so they run off the event loop.
const herdrAsync = async (...args) => {
  const p = Bun.spawn(["herdr", ...args], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  return herdrResult(args, { code, out, err });
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
  return { ...entry.cli, skillsRoot: entry.skillsRoot ?? null };
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

// Everything the harness is allowed to see, by name. The pane's shell is the
// operator's own, with every API key their environment loader put there, and a
// harness that prints its environment would write those into the evidence. So
// the launch goes through a wrapper that execs the real binary under `env -i`
// with these names and nothing else.
const ENV_KEEP = ["HOME", "PATH", "LANG", "LC_ALL", "LC_CTYPE", "TMPDIR", "SHELL", "USER", "LOGNAME"];
// The terminal is the pane's, not the runner's: a runner launched from a tool
// carries TERM=dumb, and codex refuses to start under it.
const PANE_KEEP = ["TERM", "COLORTERM"];
// herdr sets the pane id on the pane process, after the wrapper file exists, so
// these are read at exec time rather than written in. The names herdr uses now
// plus whatever else it already put in this process.
const HERDR_KEEP = [
  ...new Set([
    "HERDR_ENV",
    "HERDR_SOCKET_PATH",
    "HERDR_PANE_ID",
    "HERDR_TAB_ID",
    "HERDR_WORKSPACE_ID",
    "HERDR_SESSION_ID",
    ...Object.keys(process.env).filter((name) => name.startsWith("HERDR_")),
  ]),
].sort();

const shq = (s) => `'${String(s).replaceAll("'", `'\\''`)}'`;

// `herdr agent start` runs `<kind> <args>` and has no --env of its own (its
// --help lists none), so the wrapper has to be what the name resolves to: it
// goes first on the PATH the pane split carries, named after the harness. The
// PATH inside `env -i` is the operator's own without the wrapper dir, so the
// exec lands on the real binary rather than back here. Empty IFS with globbing
// off keeps each HERDR_ reference exactly one word, whatever it holds, and an
// unset one expands to no word at all.
const writeCliWrapper = (home, cli) => {
  const real = Bun.which(cli.kind);
  if (!real) die(4, `no ${cli.kind} on PATH, so there is no binary for the clean-environment wrapper to exec`);
  const bin = join(home, "bin");
  mkdirSync(bin, { recursive: true });
  // A harness that authenticates from the environment names the variable in
  // its home.env; it is the only operator value beyond the allowlist that
  // reaches the run, and it must be set or the harness cannot log in.
  const auth = cli.home?.env ?? [];
  for (const name of auth) if ((process.env[name] ?? "") === "") die(4, `harnesses.yaml home.env: ${name} is not set in this environment`);
  const values = { ...process.env, HOME: home };
  const kept = [...ENV_KEEP.filter((name) => (values[name] ?? "") !== ""), ...auth];
  writeFileSync(
    join(bin, cli.kind),
    [
      "#!/bin/sh",
      "# Written by bench/run.mjs. The harness runs with this environment and no",
      "# other, so nothing else the operator's shell holds can reach the run dir.",
      "set -f",
      "IFS=",
      "exec /usr/bin/env -i \\",
      ...kept.map((name) => `  ${name}=${shq(values[name])} \\`),
      ...[...PANE_KEEP, ...HERDR_KEEP].map((name) => `  \${${name}:+${name}=$${name}} \\`),
      `  ${shq(real)} "$@"`,
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
  // The same allowlist as an object, for a driver's own shell commands.
  const names = [...kept, ...PANE_KEEP, ...HERDR_KEEP].filter((name) => (values[name] ?? "") !== "");
  const env = { ...Object.fromEntries(names.map((name) => [name, values[name]])), PATH: `${bin}:${process.env.PATH ?? ""}` };
  return { bin, real, env, allowlist: [...kept, ...PANE_KEEP, ...HERDR_KEEP] };
};

// Where herdr expects each harness's home to be before it will install its
// state-reporting hook or extension there. This is herdr's layout, not ours.
const HERDR_HOME_DIRS = { claude: ".claude", codex: ".codex", pi: ".pi/agent/extensions", omp: ".omp/agent/extensions" };

// The scratch HOME: only the listed auth files, copied from the real HOME, the
// seeded config text, and herdr's own integration, without which herdr cannot
// see the agent's state and every prompt reads as stalled. A sqlite file
// travels with its -wal and -shm siblings, or the copy is missing whatever was
// not yet checkpointed.
const prepareHome = (cli) => {
  const home = mkdtempSync(join(tmpdir(), "bench-home-"));
  const seeded = [];
  for (const rel of cli.home?.copy ?? []) {
    for (const suffix of ["", "-wal", "-shm"]) {
      const from = join(homedir(), rel + suffix);
      if (!existsSync(from)) {
        if (suffix === "") die(4, `harnesses.yaml home.copy: ${from} does not exist`);
        continue;
      }
      mkdirSync(dirname(join(home, rel)), { recursive: true });
      copyFileSync(from, join(home, rel + suffix));
    }
    seeded.push(rel);
  }
  const written = Object.entries(cli.home?.write ?? {});
  for (const [rel, text] of written) {
    mkdirSync(dirname(join(home, rel)), { recursive: true });
    writeFileSync(join(home, rel), text);
  }
  mkdirSync(join(home, HERDR_HOME_DIRS[cli.kind] ?? "."), { recursive: true });
  const r = Bun.spawnSync(["herdr", "integration", "install", cli.kind], { env: { ...process.env, HOME: home }, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) die(6, `herdr integration install ${cli.kind} into ${home} failed:\n${decoder.decode(r.stderr)}${decoder.decode(r.stdout)}`);
  return { home, seeded, written: Object.fromEntries(written), ...writeCliWrapper(home, cli) };
};

// A scenario that needs a file in the harness's own config tree (a subagent
// definition, say) ships it under bench/<scenario>/home/<harness>/, laid out as
// it should land relative to HOME. Every file copied is named in run.yaml.
const seedHome = (home, scenario, harness) => {
  const src = join(ROOT, "bench", scenario, "home", harness);
  if (!existsSync(src)) return [];
  const files = readdirSync(src, { recursive: true })
    .filter((rel) => statSync(join(src, rel)).isFile())
    .sort();
  for (const rel of files) {
    mkdirSync(dirname(join(home, rel)), { recursive: true });
    copyFileSync(join(src, rel), join(home, rel));
  }
  return files;
};

// Symlink each named skill into the harness's skillsRoot under the scratch
// HOME. The operator's real skill tree stays unreachable; only these links
// exist. skillsRoot comes from harnesses.yaml, with ~ expanded to the scratch
// home, so Claude and pi land under their own dirs and Codex/OMP under
// ~/.agents/skills.
const installSkills = (home, skillsRootTemplate, names) => {
  if (names.length === 0) return [];
  if (!skillsRootTemplate) die(4, `harnesses.yaml has no skillsRoot for this harness`);
  const skillsRoot = skillsRootTemplate.replace(/^~(?=$|\/)/, home);
  mkdirSync(skillsRoot, { recursive: true });
  const installed = [];
  for (const name of names) {
    const canonical = join(ROOT, "skills", name);
    if (!existsSync(join(canonical, "SKILL.md"))) die(2, `no skill ${name} at skills/${name}`);
    const target = realpathSync(canonical);
    symlinkSync(target, join(skillsRoot, name));
    const digest = createHash("sha256").update(readFileSync(join(canonical, "SKILL.md"))).digest("hex");
    installed.push({ name, root: skillsRoot, digest });
  }
  return installed;
};

const harnessVersion = (cli) => {
  const argv = cli.version_command.split(/\s+/).filter(Boolean);
  const r = exec(argv);
  return { command: cli.version_command, raw: r.out + r.err };
};

// Herdr names are unique among live agents, and the last run's pane may still
// be open, so the name carries harness and counter, not only the scenario. A
// driver restart is a new agent under a new name, so the generation goes in.
const agentName = (runId, generation = 0) => {
  const [scenario, harness, , counter] = runId.split(".");
  const tail = `-${harness}-${counter}${generation ? `r${generation}` : ""}`;
  return `b-${scenario.replaceAll("_", "-")}`.slice(0, 32 - tail.length).toLowerCase() + tail;
};

const paneProcess = (pane) => tryOr(() => herdr("pane", "process-info", "--pane", pane).result.process_info, null);
const shellIdle = (info) => info?.foreground_processes?.length === 1 && info.foreground_processes[0].pid === info.shell_pid;
// The harness is the foreground process group leader: the wrapper execs into
// it, and anything else in the foreground is a child it spawned.
const harnessPid = (info) => (info && !shellIdle(info) ? (info.foreground_process_group_id ?? null) : null);

// `agent start` rejects a pane that is not an available shell, and a pane split a second ago is still loading its shell prompt, so wait until the shell is its own foreground process.
const waitForShell = (pane) => {
  let info = null;
  for (const until = Date.now() + 15000; Date.now() < until; Bun.sleepSync(250)) {
    info = paneProcess(pane);
    if (shellIdle(info)) return;
  }
  die(6, `pane ${pane} never became an idle shell within 15s; last process-info:\n${JSON.stringify(info)}`);
};

const startAgent = (name, cli, pane, model, withExtension) => {
  waitForShell(pane);
  const extension = withExtension ? (cli.extension?.args ?? []).map((a) => a.replace(/^~(?=$|\/)/, homedir())) : [];
  const args = [...cli.model_flag.replace("{model}", model).split(/\s+/).filter(Boolean), ...(cli.extra_args ?? []), ...extension];
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

// Prompting a blocked agent types the prompt into whatever dialog is still up, so a pane that will not settle stops the run here.
const settleAgent = (name) => {
  const settled = tryOr(() => herdr("agent", "wait", name, "--timeout", "30000").result?.agent?.agent_status ?? "unknown", (error) => `wait failed: ${error.code ?? error.message}`);
  if (!["idle", "done", "working", "unknown"].includes(settled)) die(6, `agent ${name} is not ready to prompt (${settled}):\n${readText(name, 60, "visible")}`);
  return settled;
};

// herdr's status never settles while a harness keeps a background shell
// alive after its reply (Claude leaves one behind a killed `find`). Every
// bench prompt ends in a reply line starting with DONE, so that line on the
// pane is the turn's end when herdr's own wait timed out.
const doneOnPane = (name, error) =>
  error.code === "timeout" && /^\s*(⏺\s*)?DONE\b/m.test(readText(name, 60, "visible"))
    ? { prompted: { result: tryOr(() => herdr("agent", "get", name).result, null), settled_by: "DONE reply line on the pane" }, status: "done", settled_by: "DONE reply line on the pane" }
    : null;

// A prompt that times out still leaves a transcript worth harvesting, so the
// failure is recorded and the run continues. herdr calls a prompt stalled when
// nothing changes within 5 s, and a harness cold-starting under a fresh HOME
// can take longer than that to show its first token, so a stall is checked
// against the state counter for a while before it counts.
const promptAgent = async (name, text, timeoutMs) => {
  try {
    const prompted = await herdrAsync("agent", "prompt", name, text, "--wait", "--timeout", String(timeoutMs));
    return { prompted, status: prompted.result?.agent?.agent_status ?? "unknown", settled_by: "herdr agent prompt --wait" };
  } catch (error) {
    let [prompted, status, settled_by] = [null, `prompt failed: ${error.message}`, null];
    const stalledAt = error.code === "agent_prompt_stalled" ? Number(error.message.match(/state_change_seq remained (\d+)/)?.[1]) : NaN;
    for (const until = Date.now() + 30000; !Number.isNaN(stalledAt) && Date.now() < until; await Bun.sleep(1000)) {
      const seq = tryOr(() => herdr("agent", "get", name).result.agent.state_change_seq, stalledAt);
      if (seq === stalledAt) continue;
      prompted = await herdrAsync("agent", "wait", name, "--timeout", String(timeoutMs)).catch(() => null);
      status = prompted?.result?.agent?.agent_status ?? `wait after stall failed`;
      prompted = { ...prompted, stalled_then_recovered: true };
      settled_by = prompted.result ? "herdr agent wait after a stall" : null;
      break;
    }
    return doneOnPane(name, error) ?? { prompted, status, settled_by };
  }
};

// For a driver that answered a question itself: the turn is already under way, so only the settle is waited on.
const waitAgent = async (name, timeoutMs) => {
  try {
    const prompted = await herdrAsync("agent", "wait", name, "--timeout", String(timeoutMs));
    return { prompted, status: prompted.result?.agent?.agent_status ?? "unknown", settled_by: "herdr agent wait" };
  } catch (error) {
    return doneOnPane(name, error) ?? { prompted: null, status: `wait failed: ${error.message}`, settled_by: null };
  }
};

// What bench/<scenario>/drive.mjs gets. Every call lands in drive.log with its
// UTC time, so the run records when the operator acted, not only what the
// agent showed. The run's status is the last prompt or wait the driver made.
const makeCtx = ({ runDir, runId, harness, model, scratch, home, env, cli, pane, name, promptText, withExtension }) => {
  const logPath = join(ROOT, runDir, "drive.log");
  writeFileSync(logPath, ""); // a reused run dir holds the previous attempt's log
  const log = (line) => appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`);
  const brief = (text) => JSON.stringify(text.length > 80 ? `${text.slice(0, 80)}…` : text) + (text.length > 80 ? ` (${text.length} chars)` : "");
  const state = { name, generation: 0, ended: false, last: null, prompts: [], restarts: [], quits: [], notes: {} };
  const settled = (r) => (state.last = r, state.prompts.push(r), { status: r.status, settled_by: r.settled_by });
  const ctx = {
    harness,
    model,
    scratch,
    home,
    pane,
    promptText,
    runDir,
    get name() {
      return state.name;
    },
    prompt: async (text, { timeoutMs = 600000 } = {}) => {
      log(`prompt ${brief(text)} timeout ${timeoutMs}`);
      const r = settled(await promptAgent(state.name, text, timeoutMs));
      log(`prompt settled: ${r.status}${r.settled_by ? ` (${r.settled_by})` : ""}`);
      return r;
    },
    wait: async ({ timeoutMs = 600000 } = {}) => {
      log(`wait timeout ${timeoutMs}`);
      const r = settled(await waitAgent(state.name, timeoutMs));
      log(`wait settled: ${r.status}${r.settled_by ? ` (${r.settled_by})` : ""}`);
      return r;
    },
    type: async (text) => {
      log(`type ${brief(text)}`);
      herdr("pane", "send-text", pane, text);
      herdr("pane", "send-keys", pane, "enter");
    },
    keys: async (keys) => {
      log(`keys ${keys.join(" ")}`);
      herdr("pane", "send-keys", pane, ...keys);
    },
    sleep: async (ms) => {
      log(`sleep ${ms}`);
      await Bun.sleep(ms);
    },
    // null once the harness is gone: herdr drops the name with the process.
    status: () => tryOr(() => herdr("agent", "get", state.name).result.agent, null),
    process: () => paneProcess(pane),
    pid: () => harnessPid(paneProcess(pane)),
    visible: (lines = 60) => readText(pane, lines, "visible"),
    read: (lines = 2000) => readText(pane, lines),
    shell: (cmd) => {
      log(`shell ${brief(cmd)}`);
      const p = Bun.spawnSync(["bash", "-c", cmd], { cwd: scratch, env, stdout: "pipe", stderr: "pipe" });
      const r = { code: p.exitCode, out: decoder.decode(p.stdout), err: decoder.decode(p.stderr) };
      log(`shell exited ${r.code}`);
      return r;
    },
    // The harness's own quit is typed like any input; a signal goes to the
    // pid the pane reports. Either way the pane's shell prompt coming back is
    // the end of the session, waited on for 30 s and reported, not required.
    quit: async ({ method = "command" } = {}) => {
      const at = new Date().toISOString();
      const record = { method, at };
      if (method === "command") {
        if (!cli.quit_command) throw new Error(`harnesses.yaml has no cli.quit_command for ${harness}`);
        record.command = cli.quit_command;
        log(`quit command ${cli.quit_command}`);
        herdr("pane", "send-text", pane, cli.quit_command);
        herdr("pane", "send-keys", pane, "enter");
      } else if (method === "sigterm" || method === "sigkill") {
        const pid = harnessPid(paneProcess(pane));
        if (!pid) throw new Error(`no harness process in the foreground of pane ${pane}`);
        record.pid = pid;
        log(`quit ${method} pid ${pid}`);
        process.kill(pid, method.toUpperCase());
      } else {
        throw new Error(`quit: unknown method ${JSON.stringify(method)}`);
      }
      for (const until = Date.now() + 30000; Date.now() < until && !shellIdle(paneProcess(pane)); await Bun.sleep(500));
      record.exited = shellIdle(paneProcess(pane));
      state.ended = true;
      state.quits.push(record);
      log(`quit ${record.exited ? "harness exited" : "harness still in the foreground after 30 s"}`);
      return record;
    },
    // Same harness, same pane, same scratch and HOME, new herdr name.
    restart: async () => {
      state.generation += 1;
      const next = agentName(runId, state.generation);
      log(`restart as ${next}`);
      const started = startAgent(next, cli, pane, model, withExtension);
      const startup_answers = answerStartup(next, cli.startup ?? []);
      const status = settleAgent(next);
      state.name = next;
      state.ended = false;
      state.restarts.push({ name: next, start: started.start, ...(started.recovered ? { start_recovered: true } : {}), startup_answers });
      log(`restart settled: ${status}`);
      return { name: next, status, startup_answers };
    },
    note: (key, value) => {
      state.notes[key] = value;
      log(`note ${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
    },
  };
  return { ctx, state, log };
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
const resolveSessionDir = (template, scratch, home) => {
  const base = template.replace(/^~(?=$|\/)/, home);
  if (!base.includes("{cwd_slug}")) return existsSync(base) ? base : null;
  const dash = (p) => p.replace(/[/\\:]/g, "-");
  const under = (rel) => rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  const slugs = [scratch, tryOr(() => realpathSync(scratch), scratch)].flatMap((dir) => {
    const [rel, tmp] = [relative(home, dir), relative(tmpdir(), dir)];
    const abs = [dir.replace(/[^a-zA-Z0-9]/g, "-"), `--${dash(dir.replace(/^\//, ""))}--`];
    return [...abs, under(rel) ? `-${dash(rel)}` : null, under(tmp) ? (tmp ? `-tmp-${dash(tmp)}` : "-tmp") : null];
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
const captureSession = (runDir, template, scratch, home, startedAt) => {
  const dest = join(ROOT, runDir, "session");
  const since = Date.parse(startedAt) - 5000; // slack for a header written just before our clock
  const dir = template ? resolveSessionDir(template, scratch, home) : null;
  const where = dir ?? `${template ?? "no session_dir in harnesses.yaml"} (nothing matched ${scratch})`;
  const all = (dir ? readdirSync(dir, { recursive: true }) : []).map((rel) => ({ rel, s: statSync(join(dir, rel), { throwIfNoEntry: false }) }));
  const rels = all.filter(({ s }) => s?.isFile() && s.mtimeMs >= since).map(({ rel }) => rel).sort();
  let [calls, known, workers] = [[], false, {}];
  // A reused run dir still holds the previous attempt's capture.
  rmSync(dest, { recursive: true, force: true });
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

const args = process.argv.slice(2);
const positional = [];
const skillNames = [];
let withExtension = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--extension") {
    withExtension = true;
  } else if (a === "--skill") {
    const name = args[++i];
    if (!name || name.startsWith("--")) die(2, USAGE);
    skillNames.push(name);
  } else if (a.startsWith("--skill=")) {
    const name = a.slice("--skill=".length);
    if (!name) die(2, USAGE);
    skillNames.push(name);
  } else if (a.startsWith("--")) {
    die(2, USAGE);
  } else {
    positional.push(a);
  }
}
const [scenario, harness, model] = positional;
if (!scenario || !harness || !model || positional.length !== 3) die(2, USAGE);
if (process.env.HERDR_ENV !== "1") die(3, "bench/run.mjs drives herdr panes; run it inside a herdr session (HERDR_ENV=1)");

const cli = harnessCli(harness);
if (withExtension && !cli.extension) die(4, `harnesses.yaml has no cli.extension for ${harness}`);
const runDir = prepareRun(scenario, harness);
const runId = basename(runDir);
const scratch = setupScratch(scenario);
const promptText = readFileSync(join(ROOT, "bench", scenario, "prompt.md"), "utf8");
// A scenario with a drive.mjs runs its own script in place of the one prompt.
const drivePath = join(ROOT, "bench", scenario, "drive.mjs");
const drive = existsSync(drivePath) ? (await import(pathToFileURL(drivePath).href)).default : null;
if (drive !== null && typeof drive !== "function") die(4, `bench/${scenario}/drive.mjs must default-export an async function drive(ctx)`);
// The scratch HOME holds auth copies, so it goes on every exit path, after the
// pane: a harness still flushing its session log on shutdown would recreate
// the directory under a removal that ran first.
const { home, seeded, written: seededText, bin, env, allowlist } = prepareHome(cli);
const homeSeed = seedHome(home, scenario, harness);
const skills = installSkills(home, cli.skillsRoot, skillNames);
let pane = null;
process.on("exit", () => {
  if (pane && process.env.BENCH_KEEP_PANE === "1") return console.error(`kept pane ${pane} and its HOME ${home}; remove it yourself`);
  if (pane) {
    tryOr(() => herdr("pane", "close", pane), null);
    for (const until = Date.now() + 10000; Date.now() < until && tryOr(() => (herdr("pane", "get", pane), true), false); Bun.sleepSync(250));
    Bun.sleepSync(1000);
  }
  rmSync(home, { recursive: true, force: true });
});

const startedAt = new Date().toISOString();
const version = harnessVersion(cli);
// A pane left behind by any exit, a failed one most of all, squeezes every
// later split until dialogs render one character per line and the startup
// matcher goes blind, so the exit handler above closes it. BENCH_KEEP_PANE=1
// leaves it for a look (and leaves the scratch HOME with it).
// `agent start` takes no env of its own, so the wrapper dir rides in on the
// split: it is first on the pane's PATH, which is what `<kind>` resolves
// through, and the harness is exec'd from there with a cleared environment.
pane = herdr(
  "pane",
  "split",
  "--current",
  "--direction",
  "right",
  "--cwd",
  scratch,
  "--env",
  `HOME=${home}`,
  "--env",
  `PATH=${bin}:${process.env.PATH ?? ""}`,
  "--no-focus",
).result.pane.pane_id;
let name = agentName(runId);
const { start, argv, recovered } = startAgent(name, cli, pane, model, withExtension);
const startupAnswers = answerStartup(name, cli.startup ?? []);
settleAgent(name);

// Without a driver the run is one prompt. With one, the driver's last prompt
// or wait is the run's status, and a driver that throws fails the run the
// way a failed prompt does, transcript still captured.
let prompted = null;
let status = "unknown";
let driven = null;
if (drive) {
  driven = makeCtx({ runDir, runId, harness, model, scratch, home, env, cli, pane, name, promptText, withExtension });
  driven.log(`drive bench/${scenario}/drive.mjs as ${name}`);
  const error = await Promise.resolve()
    .then(() => drive(driven.ctx))
    .then(() => null, (caught) => caught);
  name = driven.state.name;
  prompted = driven.state.last?.prompted ?? null;
  status = error ? `drive failed: ${error?.stack ?? String(error)}` : (driven.state.last?.status ?? "unknown");
  driven.log(error ? `drive threw: ${error?.message ?? String(error)}` : `drive returned: ${status}`);
} else {
  ({ prompted, status } = await promptAgent(name, promptText, 600000));
}

// An agent that exited (a crash, a self-update, a bad model flag) has no name
// to read through, so the pane is read instead and the run stays unexecuted.
// A driver that quit the harness and did not restart it made that exit the
// scenario's own last step, so it is recorded rather than failed.
const gone = tryOr(() => (herdr("agent", "get", name), false), true);
const ended = driven?.state.ended ?? false;
writeFileSync(join(ROOT, runDir, "transcript.md"), `${TRANSCRIPT_HEADER}\n\n${gone ? readText(pane, 2000) : readText(name, 2000)}`);
if (gone && !ended) die(6, `agent ${name} is gone from pane ${pane}; transcript.md holds the pane text, run.yaml is left unexecuted\n${readText(pane, 40, "visible")}`);
const get = gone ? null : herdr("agent", "get", name);
const explain = gone ? null : herdr("agent", "explain", name, "--json");

// Session capture is best effort: a run with no session log is still a run.
const failed = (error) => ({ dir: null, files: 0, calls: null, workers: {}, note: `session capture failed: ${error.message}` });
const session = tryOr(() => captureSession(runDir, cli.session_dir ?? null, scratch, home, startedAt), failed);

writeFileSync(
  join(ROOT, runDir, "invocation.json"),
  `${JSON.stringify(
    {
      herdr: {
        start,
        ...(recovered ? { start_recovered: true } : {}),
        prompt: prompted,
        get,
        explain,
        startup_answers: startupAnswers,
        ...(driven ? { prompts: driven.state.prompts.map((p) => p.prompted), restarts: driven.state.restarts, quits: driven.state.quits } : {}),
      },
      // herdr reports the argv it handed the harness; the herdr call is the fallback.
      cli: { command: start.result?.argv ?? ["herdr", ...argv], version: version.raw },
      model,
      scratch_dir: scratch,
      home: { seeded, written: seededText, ...(homeSeed.length ? { home_seed: homeSeed } : {}), ...(withExtension ? { extension: cli.extension } : {}), ...(skills.length ? { skills } : {}) },
      ...(driven ? { drive: { script: `bench/${scenario}/drive.mjs`, log: "drive.log", notes: driven.state.notes } } : {}),
      env_allowlist: allowlist,
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

// The wrapper is what keeps the operator's environment out of the harness;
// this is the check that it held, over everything the harvest just wrote. A
// hit cannot be edited away, because the capture is the thing carrying the
// secret: it goes, and the directory stays unexecuted for a clean re-run. Only
// the matched name is printed, never what followed the `=`.
const SECRET_FORMS = [/\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD))=\S{8,}/, /\b(sk-)[A-Za-z0-9_-]{16,}/];
const leaks = [];
for (const rel of readdirSync(join(ROOT, runDir), { recursive: true })) {
  const path = join(ROOT, runDir, rel);
  if (!statSync(path, { throwIfNoEntry: false })?.isFile()) continue;
  for (const [i, line] of tryOr(() => readFileSync(path, "utf8"), "").split("\n").entries()) {
    for (const form of SECRET_FORMS) {
      const hit = form.exec(line);
      if (hit) leaks.push(`leak ${rel}:${i + 1} ${hit[1]}`);
    }
  }
}
if (leaks.length > 0) {
  rmSync(join(ROOT, runDir, "session"), { recursive: true, force: true });
  rmSync(join(ROOT, runDir, "transcript.md"), { force: true });
  for (const line of leaks) console.error(line);
  die(
    7,
    `${leaks.length} secret(s) reached ${runDir}: session/ and transcript.md deleted, run.yaml left unexecuted; re-run under a clean environment`,
  );
}

// A failed prompt, or a driver that threw or ended on a failed prompt or wait,
// leaves the manifest unexecuted so the next attempt reuses this directory
// instead of bumping the counter for a run that never happened.
if (/^(prompt|wait|drive) failed/.test(status)) {
  die(6, `${status}\nrun dir ${runDir} kept unexecuted; transcript.md and invocation.json${driven ? " and drive.log" : ""} hold what the pane showed`);
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
  environment_deltas:
    `launched under a scratch HOME seeded only with ${seeded.join(", ")}` +
    (Object.keys(seededText).length ? ` and these written files: ${Object.entries(seededText).map(([p, t]) => `${p} = ${JSON.stringify(t)}`).join("; ")}` : "") +
    (homeSeed.length ? ` and these files from bench/${scenario}/home/${harness}: ${homeSeed.join(", ")}` : "") +
    `, plus herdr's ${cli.kind} state-reporting integration (herdr integration install ${cli.kind})` +
    (cli.extra_args?.length ? `, launched with ${cli.extra_args.join(" ")}` : "") +
    (skills.length ? `; ${skills.map((s) => `skill ${s.name} symlinked at ${s.root}`).join("; ")}` : "") +
    "; no other user skill, rule, hook, MCP server, or context file was reachable" +
    `; process environment cleared to ${allowlist.filter((name) => !name.startsWith("HERDR_")).join(", ")} plus HERDR_*` +
    `, the harness exec'd through ${bin}/${cli.kind}` +
    (driven ? `; driven by bench/${scenario}/drive.mjs, every operator action timed in drive.log` : ""),
  ...(withExtension ? { extension: `${cli.extension.name}, loaded explicitly with ${cli.extension.args.join(" ")}` } : {}),
  ...(skills.length ? { skills } : {}),
  ...(driven ? { drive: driven.state.notes } : {}),
});

console.log(`run dir    ${runDir}`);
console.log(`agent      ${name} on pane ${pane}, status ${status}`);
console.log(`artifacts  ${["run.yaml", "transcript.md", "invocation.json", ...(driven ? ["drive.log"] : []), ...written].join(", ")}`);
const calls = (session.calls?.length ?? 0) + Object.values(session.workers).reduce((n, c) => n + c.length, 0);
console.log(`session    ${session.files} file(s) copied, ${calls} call(s) extracted${session.note ? ` (${session.note})` : ""}`);
console.log(`next: write observations.yaml by hand, then bun scripts/coupling.mjs probe inspect ${runId}`);
