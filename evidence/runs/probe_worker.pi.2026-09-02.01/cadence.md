# Line cadence, probe-activity.log

Written by bench/probe_worker/drive.mjs from the log's own timestamps.
Spawn turn done at 2026-09-02T22:45:36.736Z; 0 line(s) in the log at the end, 0 without a readable timestamp.
The worker's brief was one line every 10 seconds, so an interval near 10 s is the
expected cadence, a gap is a stall, and a burst or duplicate stamp is a restart or resume.

| window | from | to | lines | intervals |
|---|---|---|---|---|
| unprobed | start | 2026-09-02T22:46:06.756Z | 0 | n/a |
| probed | 2026-09-02T22:46:06.756Z | 2026-09-02T22:47:04.181Z | 0 | n/a |
| after third probe | 2026-09-02T22:47:04.181Z | 2026-09-02T22:49:06.750Z | 0 | n/a |
| after fourth probe | 2026-09-02T22:49:06.750Z | end | 0 | n/a |

Duplicate consecutive timestamps: 0.

## Probe times

- probe 1: sent 2026-09-02T22:46:06.756Z, replied 2026-09-02T22:46:14.185Z, log lines 0 -> 0
- probe 2: sent 2026-09-02T22:46:34.197Z, replied 2026-09-02T22:46:38.934Z, log lines 0 -> 0
- probe 3: sent 2026-09-02T22:46:58.945Z, replied 2026-09-02T22:47:04.171Z, log lines 0 -> 0
- probe 4: sent 2026-09-02T22:49:06.750Z, replied 2026-09-02T22:49:13.411Z, log lines 0 -> 0

## Every line with its interval from the previous

| line | interval |
|---|---|
| (log absent or empty) | |
