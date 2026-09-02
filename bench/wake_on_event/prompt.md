# Task

You are in a scratch git repo. `event.flag` does not exist in it. At some
moment the operator will create it. Your job is to wait for that moment
without spending turns.

Do the following, in order.

1. Before you start waiting, write `wait-call.txt` in this directory. Line one:
   the exact wait primitive you are about to use, with its arguments, quoted as
   you will invoke it. Line two: one of `harness primitive`, `extension`, or
   `shell command`, whichever it is. Line three: the event kinds that primitive
   accepts, as documented, separated by commas.

2. Enter a wait for `event.flag` to appear, using whatever this harness offers
   that sleeps until an event rather than checking on a timer: a blocking wait
   or hook primitive, a peer or event wait, or as the weakest option a single
   blocking shell command. Give the wait a bound of 20 minutes if it takes one.
   Do not end your turn to check again later, and do not run a check, sleep,
   and check again from your side; if that is the only way you can wait, do it
   with one check every 30 seconds and say so in your reply.

3. The instant the wait returns, run `date -u +%FT%TZ > woke-at.txt` as your
   first action. Then append one line to `woke-at.txt` saying what the wait
   returned, verbatim.

4. If the wait returns without `event.flag` existing (a timeout, an error, or
   anything else), still write `woke-at.txt` as in step 3, and make the second
   line say that the file is absent and what the wait returned.

In your final reply, name the wait primitive again and say whether it returned
because of the file, a timeout, or something else.

When finished, reply with exactly one line: DONE <one-sentence summary>.
