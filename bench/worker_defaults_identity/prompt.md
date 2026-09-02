# Task

You are in a scratch git repo. A worker definition named `poteto-probe` was
installed in this harness's own subagent directory before you started. You do
not need to find it or read it; select it by name only.

Do the following, in order.

1. Spawn one worker, selecting the `poteto-probe` definition by name. Its
   brief is exactly: `Reply with the word hello.` Do not put anything else in
   the brief, and in particular do not mention any token or expected first
   line. Write the worker's report verbatim into `positive-report.txt` in this
   directory, its first line first, and nothing before it. If the spawn itself
   fails, write the verbatim error text into that file instead, and label it
   `spawn error:` on the first line.

2. Negative trial: spawn once more with the same brief, this time selecting
   `poteto-absent` by name. No definition of that name exists. Write exactly
   what happened into `negative-trial.txt`: the verbatim error, warning, or
   report that came back. If the spawn produced no output at all, write one
   line saying so and naming the command or tool call you used. Do not retry
   with a different name and do not fall back to an unnamed worker yourself.

3. In your final reply, state in one sentence which argument selected the
   definition: quote the argument name and the value you passed, for both
   spawns.

Do not write `POTETO-PROBE-OK` anywhere yourself, and do not create or edit any
worker definition.

When finished, reply with exactly one line: DONE <one-sentence summary>.
