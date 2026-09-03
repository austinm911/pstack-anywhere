# Line cadence, probe-activity.log

Written by bench/probe_worker/drive.mjs from the log's own timestamps.
Spawn turn done at 2026-09-03T04:51:28.872Z; 18 line(s) in the log at the end, 0 without a readable timestamp.
The worker's brief was one line every 10 seconds, so an interval near 10 s is the
expected cadence, a gap is a stall, and a burst or duplicate stamp is a restart or resume.

| window | from | to | lines | intervals |
|---|---|---|---|---|
| unprobed | start | 2026-09-03T04:51:58.891Z | 4 | min 10s, median 10s, max 10s |
| probed | 2026-09-03T04:51:58.891Z | 2026-09-03T04:53:06.533Z | 6 | min 10s, median 10s, max 10s |
| after third probe | 2026-09-03T04:53:06.533Z | 2026-09-03T04:54:58.883Z | 8 | min 10s, median 10s, max 10s |
| after fourth probe | 2026-09-03T04:54:58.883Z | end | 0 | n/a |

Duplicate consecutive timestamps: 0.

## Probe times

- probe 1: sent 2026-09-03T04:51:58.891Z, replied 2026-09-03T04:52:09.178Z, log lines 4 -> 5
- probe 2: sent 2026-09-03T04:52:29.190Z, replied 2026-09-03T04:52:39.552Z, log lines 7 -> 8
- probe 3: sent 2026-09-03T04:52:59.564Z, replied 2026-09-03T04:53:06.523Z, log lines 10 -> 10
- probe 4: sent 2026-09-03T04:54:58.883Z, replied 2026-09-03T04:55:06.444Z, log lines 18 -> 18

## Every line with its interval from the previous

| line | interval |
|---|---|
| 2026-09-03T04:51:28Z | first |
| 2026-09-03T04:51:38Z | 10s |
| 2026-09-03T04:51:48Z | 10s |
| 2026-09-03T04:51:58Z | 10s |
| 2026-09-03T04:52:08Z | 10s |
| 2026-09-03T04:52:18Z | 10s |
| 2026-09-03T04:52:28Z | 10s |
| 2026-09-03T04:52:38Z | 10s |
| 2026-09-03T04:52:48Z | 10s |
| 2026-09-03T04:52:58Z | 10s |
| 2026-09-03T04:53:08Z | 10s |
| 2026-09-03T04:53:18Z | 10s |
| 2026-09-03T04:53:28Z | 10s |
| 2026-09-03T04:53:38Z | 10s |
| 2026-09-03T04:53:48Z | 10s |
| 2026-09-03T04:53:58Z | 10s |
| 2026-09-03T04:54:08Z | 10s |
| 2026-09-03T04:54:18Z | 10s |
