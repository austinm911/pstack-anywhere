# Line cadence, probe-activity.log

Written by bench/probe_worker/drive.mjs from the log's own timestamps.
Spawn turn done at 2026-09-02T22:50:27.779Z; 0 line(s) in the log at the end, 0 without a readable timestamp.
The worker's brief was one line every 10 seconds, so an interval near 10 s is the
expected cadence, a gap is a stall, and a burst or duplicate stamp is a restart or resume.

| window | from | to | lines | intervals |
|---|---|---|---|---|
| unprobed | start | 2026-09-02T22:50:58.085Z | 0 | n/a |
| probed | 2026-09-02T22:50:58.085Z | 2026-09-02T22:51:54.200Z | 0 | n/a |
| after third probe | 2026-09-02T22:51:54.200Z | 2026-09-02T22:53:57.792Z | 0 | n/a |
| after fourth probe | 2026-09-02T22:53:57.792Z | end | 0 | n/a |

Duplicate consecutive timestamps: 0.

## Probe times

- probe 1: sent 2026-09-02T22:50:58.085Z, replied 2026-09-02T22:51:05.591Z, log lines 0 -> 0
- probe 2: sent 2026-09-02T22:51:25.601Z, replied 2026-09-02T22:51:29.497Z, log lines 0 -> 0
- probe 3: sent 2026-09-02T22:51:49.511Z, replied 2026-09-02T22:51:54.189Z, log lines 0 -> 0
- probe 4: sent 2026-09-02T22:53:57.792Z, replied 2026-09-02T22:54:01.531Z, log lines 0 -> 0

## Every line with its interval from the previous

| line | interval |
|---|---|
| (log absent or empty) | |
