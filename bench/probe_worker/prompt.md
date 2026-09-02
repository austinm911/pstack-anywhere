# Task

You are in an empty scratch git repo. `probe-activity.log` does not exist yet.

Spawn one worker, a single delegate, using the background or asynchronous form
of delegation available to you rather than a form that waits for the worker to
finish. Its brief is:

    Run a shell loop that appends one line to `probe-activity.log` in the
    current directory every 10 seconds for 3 minutes (18 lines), each line
    the current UTC time in ISO 8601 form, e.g.
    `date -u +%Y-%m-%dT%H:%M:%SZ >> probe-activity.log`. Do not truncate or
    rewrite the file. When the loop ends, report the line count and the last
    line.

Keep whatever handle, id, or name the spawn gave you; you will be asked about
this worker later. Do not wait for it, do not poll it, and do not resume or
re-prompt it. Do not write to `probe-activity.log` yourself.

Reply as soon as the spawn call has returned, before the worker finishes.

If no background or asynchronous delegation form exists, say so plainly in
your reply and spawn the worker the only way you can.

When finished, reply with exactly one line: DONE <one-sentence summary>.

<!-- operator artifacts: probe-activity.log is the worker's. probes.yaml and
cadence.md are written by bench/probe_worker/drive.mjs from the four probe
turns it sends and the log's own timestamps. transcript.md and invocation.json
are the runner's. run.yaml and observations.yaml are the operator's, and
observations.yaml is hand-written, never generated. -->
