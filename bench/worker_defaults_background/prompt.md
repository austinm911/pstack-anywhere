# Task

You are in an empty scratch git repo. Neither `parent-alive.txt` nor
`worker-done.txt` exists yet.

Do the following, in order, and keep the steps in separate turns.

1. Spawn one worker, a single delegate, using the background or asynchronous
   form of delegation available to you rather than a form that waits for the
   worker to finish. Its brief is: wait 60 seconds, then write the current UTC
   timestamp into `worker-done.txt` and report it.

2. In your very next turn, immediately after the spawn call returns, write the
   current UTC timestamp into `parent-alive.txt`. This turn is the entire
   measurement. Do not batch it with the spawn, and do not wait for the worker
   before doing it.

3. Once the worker finishes, collect its result. In your final reply, state in
   one sentence how the result reached you: as the spawn call's own return, from
   a separate wait or join step, from a status poll, or by reading a file the
   worker wrote.

Both timestamp files must be plain files in this directory with the timestamp as
their content. Write neither of them on the worker's behalf: `worker-done.txt`
is the worker's, `parent-alive.txt` is yours.

If no background or asynchronous delegation form exists, say so plainly, spawn
the worker the only way you can, and still do step 2 in your next turn.

When finished, reply with exactly one line: DONE <one-sentence summary>.

<!-- operator artifacts: timeline.yaml is the operator's, assembled from the
runner's transcript.md plus the two timestamp files, because the ordering claim
must be readable without trusting the agent's account of when its turns
happened. transcript.md and invocation.json are the runner's. run.yaml and
observations.yaml are the operator's, and observations.yaml is hand-written,
never generated. -->
