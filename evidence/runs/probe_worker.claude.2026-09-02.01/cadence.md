# Line cadence, probe-activity.log

Written by bench/probe_worker/drive.mjs from the log's own timestamps.
Spawn turn done at 2026-09-02T21:53:58.542Z; 18 line(s) in the log at the end, 0 without a readable timestamp.
The worker's brief was one line every 10 seconds, so an interval near 10 s is the
expected cadence, a gap is a stall, and a burst or duplicate stamp is a restart or resume.

| window | from | to | lines | intervals |
|---|---|---|---|---|
| unprobed | start | 2026-09-02T21:54:28.567Z | 18 | min 10s, median 10s, max 10s |
| probed | 2026-09-02T21:54:28.567Z | 2026-09-02T21:55:49.103Z | 0 | n/a |
| after third probe | 2026-09-02T21:55:49.103Z | 2026-09-02T21:57:28.557Z | 0 | n/a |
| after fourth probe | 2026-09-02T21:57:28.557Z | end | 0 | n/a |

Duplicate consecutive timestamps: 0.

## Probe times

- probe 1: sent 2026-09-02T21:54:28.567Z, replied 2026-09-02T21:54:35.152Z, log lines 18 -> 18
- probe 2: sent 2026-09-02T21:54:55.173Z, replied 2026-09-02T21:55:13.740Z, log lines 18 -> 18
- probe 3: sent 2026-09-02T21:55:33.751Z, replied 2026-09-02T21:55:49.089Z, log lines 18 -> 18
- probe 4: sent 2026-09-02T21:57:28.557Z, replied 2026-09-02T21:57:36.550Z, log lines 18 -> 18

## Every line with its interval from the previous

| line | interval |
|---|---|
| 2026-09-02T21:50:57Z | first |
| 2026-09-02T21:51:07Z | 10s |
| 2026-09-02T21:51:17Z | 10s |
| 2026-09-02T21:51:27Z | 10s |
| 2026-09-02T21:51:37Z | 10s |
| 2026-09-02T21:51:47Z | 10s |
| 2026-09-02T21:51:57Z | 10s |
| 2026-09-02T21:52:07Z | 10s |
| 2026-09-02T21:52:17Z | 10s |
| 2026-09-02T21:52:27Z | 10s |
| 2026-09-02T21:52:37Z | 10s |
| 2026-09-02T21:52:47Z | 10s |
| 2026-09-02T21:52:57Z | 10s |
| 2026-09-02T21:53:07Z | 10s |
| 2026-09-02T21:53:17Z | 10s |
| 2026-09-02T21:53:27Z | 10s |
| 2026-09-02T21:53:37Z | 10s |
| 2026-09-02T21:53:47Z | 10s |
