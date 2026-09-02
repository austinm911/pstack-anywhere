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

## What gets written

Into `evidence/runs/<run-id>/`, created by `probe prepare`:

- `run.yaml`, the prepared manifest with every field filled from the run
- `transcript.md`, `herdr agent read --source recent-unwrapped`. It may be a
  viewport rather than the whole session if the harness uses the alternate screen
- `invocation.json`, the herdr start, prompt, get, and explain responses plus the
  harness argv, its version output, the model, and the scratch dir
- every file the scenario declares as an artifact that setup.sh or the agent left
  in the scratch dir, plus `probe.after.txt` copied from `probe.txt`

`observations.yaml` is yours to write, and nothing here scores a run. Then run
`bun scripts/coupling.mjs probe inspect <run-id>`.
