# Task

You are in a scratch git repo. Two model identifiers valid on this harness are
given below. Do the following, in order, and do not skip a step because an
earlier one failed.

The worker brief, used verbatim for every spawn, is:

> Reply with exactly two lines. Line 1: the single word `alpha`. Line 2: the
> model identifier you believe you are running as, or `unknown`.

1. Spawn worker A, a single delegate, selecting the model `{{MODEL_A}}` on the
   spawn. Use this harness's own model selection for a worker: an argument on
   the spawn call if the spawn primitive takes one, otherwise a worker
   definition in this directory's project config that names the model, and
   spawn through that definition. Give it the brief above.

2. Spawn worker B the same way, selecting the model `{{MODEL_B}}`, with the
   same brief.

3. Negative trial: spawn worker C the same way, selecting the model
   `poteto-nonexistent-model`, with the same brief. Write the verbatim outcome
   into `negative-trial.txt`: the error text character for character if it
   errored, the worker's reply if it ran anyway, and on the first line whether
   it was a hard error, a warning plus fallback, or a silent fallback. If it
   produced no output at all, write one line saying so and naming the spawn
   call you made.

4. Write `self-reports.txt` with the first line
   `self-report, not authoritative: what each worker said about its own model`
   followed by one line per worker, A and B (and C if it ran), each holding
   the model you selected and then the worker's line 2 verbatim.

5. Write `spawn-args.txt` holding, for all three spawns, the exact spawn call
   you made: the tool or command name and its arguments verbatim, including
   the argument that named the model. If the model was named in a worker
   definition file instead, quote that file's full contents here.

Do not write `usage-record.txt`; the harness-side model record is read out of
band from the harness's own session log after this turn. Do not run a shell
listing of your own session or configuration directories.

When finished, reply with exactly one line: DONE <one-sentence summary>.

<!-- operator artifacts: usage-record.txt is drive.mjs's, extracted from the
harness session log under the scratch HOME, never from a worker's words.
transcript.md and invocation.json are the runner's. run.yaml and
observations.yaml are the operator's, and observations.yaml is hand-written,
never generated. -->
