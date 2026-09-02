# bench

Drives a conformance scenario against one harness, inside a herdr session.

```sh
bun bench/run.mjs <scenario> <harness> <model> [--extension] [--skill <name>]   # e.g. spawn_worker omp opus:low
```

Scenario ids come from `bun scripts/coupling.mjs probe list`. Each needs a
`bench/<scenario>/` holding `prompt.md`, the exact text sent to the agent, and
`setup.sh`, which prepares a scratch dir and prints its path; a scenario with
more than one step adds `drive.mjs`, and one that needs a file in the harness's
config tree adds `home/<harness>/` (both below). Launch flags come from the
`cli:` block in `harnesses.yaml`.

## The launch is stock

Every harness runs under a scratch `HOME` that holds only what its `cli.home`
block in `harnesses.yaml` lists: the auth files copied from the real home, a
seeded config where the harness needs one (codex's `multi_agent`, omp's
setup-done flag), and herdr's own state-reporting integration, without which
herdr cannot see the agent. No user skill, rule, hook, MCP server, or context
file is reachable, and the evidence contains none of the operator's setup. The
scratch home is removed after the pane closes. `run.yaml` records exactly what
was seeded under `environment_deltas`.

`--extension` adds the harness's `cli.extension` to the launch and records it in
`run.yaml` under `extension`, which is how an extension-tier cell gets its run.
Note the limit: an extension that delegates through herdr (pi-herdr) opens the
worker's pane from herdr's own environment, the real home, so only the parent
session is captured, and anything the parent reads back from that pane comes
from the operator's setup.

`--skill <name>` symlinks `skills/<name>` into the harness's `skillsRoot` under
the scratch HOME (the path from `harnesses.yaml`, with `~` expanded to that
HOME), records `{name, root, digest}` under `skills` in `run.yaml` and
`invocation.json`, and names the link in `environment_deltas`. Nothing else
from the operator's skill tree is reachable.

The environment is cleared too. The pane's shell is the operator's own, so a
harness that reads `env` would see every API key loaded into that shell, and
`herdr agent start` can only add variables. So the runner writes
`<scratch HOME>/bin/<cli.kind>`, a wrapper that execs the real binary through
`env -i` with `HOME`, `PATH`, `TERM`, `COLORTERM`, `LANG`, `LC_ALL`,
`LC_CTYPE`, `TMPDIR`, `SHELL`, `USER`, `LOGNAME` and the `HERDR_*` variables
herdr needs to see the agent's state, and nothing else. That wrapper dir goes
first on the pane's `PATH`, which is what `agent start` resolves the harness
name through, and `run.yaml` names the allowlist under `environment_deltas`
while `invocation.json` lists it under `env_allowlist`. After the harvest the
runner scans every file in the run dir for `NAME=value` pairs whose name ends
in `KEY`, `TOKEN`, `SECRET`, or `PASSWORD` and for `sk-` API keys. A hit
deletes `session/` and `transcript.md`, leaves `run.yaml` unexecuted, prints
`leak <file>:<line> <name>` with the value never printed, and exits 7. The
engine repeats the same check: a run directory carrying a secret inspects as
void under `secret_leak`, so it can never be attested.

The runner refuses to start outside herdr (`HERDR_ENV=1`), splits a pane on the
scratch dir, starts the harness there, sends the prompt, and waits. A run that
fails partway is left unexecuted so the next attempt reuses its directory.

Before prompting it waits for the split pane's shell to go idle, and if herdr
misdetects the harness kind it waits for `agent get` to agree and renames the
pane instead of failing. A `startup:` list in a `cli:` block answers first-run
dialogs: each entry is a regex plus the keys to send (Claude's folder-trust
prompt is `keys: [down, enter]`), and the ones that fired land in
`invocation.json` as `startup_answers`. A prompt herdr calls stalled is checked
against the agent's state counter for 30 s first, since a harness cold-starting
under a fresh home can take longer than herdr's 5 s window to show a token.

The pane closes after harvest, on failure too; a column of finished panes
squeezes every later split until dialogs render unreadably. `BENCH_KEEP_PANE=1`
keeps the pane and its scratch home for a look.

## A scenario that needs more than one prompt

`bench/<scenario>/drive.mjs`, when present, replaces the single prompt. It
default-exports `async function drive(ctx)`, which the runner calls once the
startup dialogs are answered and the agent has settled; when the file is absent
nothing changes. `ctx` carries `harness`, `model`, `scratch`, `home` (the
scratch HOME), `name` (the herdr agent, updated by a restart), `pane`,
`promptText` (prompt.md) and `runDir`, plus:

- `await ctx.prompt(text, { timeoutMs = 600000 })` sends the text with `--wait`
  and applies the stall recovery and DONE-line rule above. It resolves
  `{ status, settled_by }` and never throws on a timeout: `status` is the agent
  state herdr reported, `done` when the DONE line settled it, or a string
  starting `prompt failed:`. herdr's wait also settles on `blocked`, so a
  question from the agent comes back as `status: "blocked"` before any answer
- `await ctx.wait({ timeoutMs })` waits on the turn already under way, for a
  driver that just answered a question; same result shape, failure prefix
  `wait failed:`
- `await ctx.type(text)` types the text and Enter without waiting;
  `await ctx.keys([...])` sends key names as the `startup:` blocks use them
- `await ctx.sleep(ms)`; `ctx.status()` is the agent object from `herdr agent
  get`, `null` once the harness is gone; `ctx.pid()` is the harness pid from the
  pane's foreground process group, `ctx.process()` the whole `process-info`
- `ctx.visible(lines = 60)` and `ctx.read(lines = 2000)` read the pane
- `ctx.shell(cmd)` runs `bash -c cmd` in the scratch dir under the same
  cleared environment the harness got, and returns `{ code, out, err }`
- `await ctx.quit({ method })` ends the session: `command` types the harness's
  own `cli.quit_command` from `harnesses.yaml` (`/exit` for Claude, `/quit` for
  codex, pi and OMP, each cited to its pin there), `sigterm` or `sigkill`
  signals the pid. It waits up to 30 s for the pane's shell to come back and
  returns `{ method, at, command | pid, exited }`
- `await ctx.restart()` starts a fresh agent of the same harness in the same
  pane, scratch and HOME under a new herdr name (`...r1`, `...r2`), answers
  its startup dialogs and settles it, then returns `{ name, status,
  startup_answers }`
- `ctx.note(key, value)` records a finding under `drive:` in `run.yaml`

Every call lands in `drive.log` in the run dir with its UTC time, so the run
says when the operator acted and not only what the agent showed. The run's
status is the last prompt or wait the driver made: a driver that throws, or
whose last prompt or wait failed, leaves the run unexecuted with the
transcript and log kept. A driver that quit without restarting made that exit
the last step, and the run is harvested from the pane. `invocation.json`
carries every prompt, restart and quit response under `herdr`.

`bench/<scenario>/home/<harness>/` seeds files into the scratch HOME after the
auth copies, laid out as they should land relative to HOME
(`home/claude/.claude/agents/poteto-probe.md`). Each file is named under
`environment_deltas` in `run.yaml` and `home_seed` in `invocation.json`.

## What gets written

Into `evidence/runs/<run-id>/`, created by `probe prepare`:

- `run.yaml`, the prepared manifest with every field filled from the run
- `transcript.md`, `herdr agent read --source recent-unwrapped`. It may be a
  viewport rather than the whole session if the harness uses the alternate screen
- `invocation.json`, the herdr start, prompt, get, and explain responses plus the
  harness argv, its version output, the model, the scratch dir, what the scratch
  home was seeded with, and `calls`, every assistant tool call parsed out of the
  session log with its arguments (`calls_workers` holds one entry per subagent
  log)
- `session/`, the harness's own session files written during the run, copied from
  the `session_dir` in `harnesses.yaml` resolved against the scratch home.
  `NONE.txt` there means none were found
- every file the scenario declares as an artifact that setup.sh or the agent left
  in the scratch dir, plus `probe.after.txt` copied from `probe.txt`
- `drive.log`, when a driver ran: one timestamped line per operator action

`observations.yaml` is yours to write, and nothing here scores a run. Then run
`bun scripts/coupling.mjs probe inspect <run-id>`.
