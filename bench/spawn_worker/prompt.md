# Task

You are in a scratch git repo. It contains `probe.txt`, holding one line: `seed`.

Do the following, in order.

1. Spawn exactly one worker, a single delegate that runs the work in its own
   context. Its entire brief is this text and nothing more:

   > replace the contents of probe.txt with the current UTC timestamp, then
   > report the exact line written

2. Do not read `probe.txt` yourself. Do not write `probe.txt` yourself. Do not
   restate the brief as something you carry out. The worker owns that file for
   the whole run; you own only the delegation and the collection.

3. Let the worker finish and collect its result.

4. Write the result the worker returned to you, verbatim and unedited, into
   `worker-report.txt` in this directory. If the result arrived as a structured
   value rather than as text, write it out as it arrived, keys included.

Spawn exactly one worker. If the spawn fails, say so plainly and stop; do not
substitute doing the work yourself.

When finished, reply with exactly one line: DONE <one-sentence summary>.

<!-- operator artifacts: probe.before.txt is written by setup.sh before the run.
probe.after.txt is captured by the bench runner after the agent's final turn,
because the agent must not read probe.txt. transcript.md and invocation.json are
the runner's. run.yaml and observations.yaml are the operator's, and
observations.yaml is hand-written, never generated. -->
