# Task

The poteto-mode skill is installed in this harness's skill root. Nothing else
from the operator's setup is reachable.

Do the following, in order.

1. Read poteto-mode's `capabilities.md` through whatever skill addressing this
   harness supports (the skill root this harness loads skills from; every harness
   here installs it as a directory under that root). Do not search the filesystem
   for a copy outside the skill, and do not consult anything outside the skill
   and this session for the column choice.

2. From that file, identify your own harness column (the column header that
   names this harness) and the `spawn_worker` cell for that column.

3. Write a file `identify.txt` in this working directory containing exactly
   three lines, nothing else:

   harness: <column name as it appears in the table header>
   spawn_worker: <the full cell text for that column, verbatim>
   evidence: <one sentence naming what told you which harness you are>

   Do not guess. If you cannot tell which harness you are, write
   `harness: unknown` and leave the other two lines filled as best you can.

4. Reply with exactly one line: DONE <the harness line>

<!-- operator artifacts: identify.txt is written by the agent. transcript.md
and invocation.json are the runner's. run.yaml and observations.yaml are the
operator's, and observations.yaml is hand-written, never generated. -->
