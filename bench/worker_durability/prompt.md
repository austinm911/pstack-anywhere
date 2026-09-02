# Task

You are in a scratch git repo. `heartbeat.log` and `done.txt` do not exist in it.

Spawn exactly one background worker, using the background or asynchronous
delegate primitive this harness provides, and hand it this brief verbatim:

> Every 30 seconds, for 5 minutes, append one line to `heartbeat.log` in the
> current directory holding only the current UTC time, produced by
> `date -u +%Y-%m-%dT%H:%M:%SZ`. Start with a line right away, so the log
> holds 11 lines when you finish. Do not shorten the interval or the duration,
> and do not batch the lines: each one is written when its time comes. When the
> 5 minutes are up, write the word `finished` and the same UTC timestamp into
> `done.txt`, then report the line count of `heartbeat.log`.

Then reply immediately. Do not wait for the worker, do not poll its state, and
do not read `heartbeat.log` or `done.txt` yourself: the worker must still be
running when you reply. In your reply, name the handle the spawn gave you (an
agent id, job id, task id, or the pane or process it runs in), or say that it
gave none.

If the harness has no background primitive and the only delegate blocks until
it returns, spawn it anyway and say so in your reply: that fact is the finding.

When finished, reply with exactly one line: DONE <one-sentence summary>.

<!-- operator artifacts: heartbeat.log is the worker's and is harvested unedited.
termination.yaml is written by bench/worker_durability/drive.mjs from the pid,
the quit method, and the clock it read. reattach-attempt.md is written by the
fresh session in the driver's second turn. transcript.md and invocation.json are
the runner's. run.yaml and observations.yaml are the operator's, and
observations.yaml is hand-written, never generated. -->
