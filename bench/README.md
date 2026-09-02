# bench

Drives a conformance scenario against one harness, inside a herdr session.

```sh
bun bench/run.mjs <scenario> <harness> <model>   # e.g. spawn_worker omp opus
```

Scenario ids come from `bun scripts/coupling.mjs probe list`. Each needs a
`bench/<scenario>/` holding `prompt.md`, the exact text sent to the agent, and
`setup.sh`, which prepares a scratch dir and prints its path. Launch flags come
from the `cli:` block in `harnesses.yaml`.

The runner refuses to start outside herdr (`HERDR_ENV=1`), splits a pane on the
scratch dir, starts the harness there, sends the prompt, and waits. The pane is
left open so you can read the session yourself.

Before prompting it waits for the split pane's shell to go idle, and if herdr
misdetects the harness kind it waits for `agent get` to agree and renames the
pane instead of failing. A `startup:` list in a `cli:` block answers first-run
dialogs: each entry is a regex plus the keys to send (Claude's folder-trust
prompt is `keys: [down, enter]`), and the ones that fired land in
`invocation.json` as `startup_answers`.

## What gets written

Into `evidence/runs/<run-id>/`, created by `probe prepare`:

- `run.yaml`, the prepared manifest with every field filled from the run
- `transcript.md`, `herdr agent read --source recent-unwrapped`. It may be a
  viewport rather than the whole session if the harness uses the alternate screen
- `invocation.json`, the herdr start, prompt, get, and explain responses plus the
  harness argv, its version output, the model, the scratch dir, and `calls`, every
  assistant tool call parsed out of the session log with its arguments
  (`calls_workers` holds one entry per subagent log)
- `session/`, the harness's own session files written during the run, copied from
  the `session_dir` in `harnesses.yaml`. `NONE.txt` there means none were found
- every file the scenario declares as an artifact that setup.sh or the agent left
  in the scratch dir, plus `probe.after.txt` copied from `probe.txt`

`observations.yaml` is yours to write, and nothing here scores a run. Then run
`bun scripts/coupling.mjs probe inspect <run-id>`.
