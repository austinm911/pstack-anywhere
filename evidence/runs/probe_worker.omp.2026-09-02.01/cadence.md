# Line cadence, probe-activity.log

Written by bench/probe_worker/drive.mjs from the log's own timestamps.
Spawn turn done at 2026-09-02T22:44:55.084Z; 18 line(s) in the log at the end, 0 without a readable timestamp.
The worker's brief was one line every 10 seconds, so an interval near 10 s is the
expected cadence, a gap is a stall, and a burst or duplicate stamp is a restart or resume.

| window | from | to | lines | intervals |
|---|---|---|---|---|
| unprobed | start | 2026-09-02T22:45:25.099Z | 4 | min 10s, median 10s, max 10s |
| probed | 2026-09-02T22:45:25.099Z | 2026-09-02T22:46:22.859Z | 5 | min 10s, median 10s, max 10s |
| after third probe | 2026-09-02T22:46:22.859Z | 2026-09-02T22:48:25.101Z | 9 | min 10s, median 10s, max 10s |
| after fourth probe | 2026-09-02T22:48:25.101Z | end | 0 | n/a |

Duplicate consecutive timestamps: 0.

## Probe times

- probe 1: sent 2026-09-02T22:45:25.099Z, replied 2026-09-02T22:45:31.237Z, log lines 3 -> 4
- probe 2: sent 2026-09-02T22:45:51.248Z, replied 2026-09-02T22:45:56.922Z, log lines 6 -> 7
- probe 3: sent 2026-09-02T22:46:16.931Z, replied 2026-09-02T22:46:22.847Z, log lines 9 -> 9
- probe 4: sent 2026-09-02T22:48:25.101Z, replied 2026-09-02T22:48:31.539Z, log lines 18 -> 18

## Every line with its interval from the previous

| line | interval |
|---|---|
| 2026-09-02T22:44:55Z | first |
| 2026-09-02T22:45:05Z | 10s |
| 2026-09-02T22:45:15Z | 10s |
| 2026-09-02T22:45:25Z | 10s |
| 2026-09-02T22:45:35Z | 10s |
| 2026-09-02T22:45:45Z | 10s |
| 2026-09-02T22:45:55Z | 10s |
| 2026-09-02T22:46:05Z | 10s |
| 2026-09-02T22:46:15Z | 10s |
| 2026-09-02T22:46:25Z | 10s |
| 2026-09-02T22:46:35Z | 10s |
| 2026-09-02T22:46:45Z | 10s |
| 2026-09-02T22:46:55Z | 10s |
| 2026-09-02T22:47:05Z | 10s |
| 2026-09-02T22:47:15Z | 10s |
| 2026-09-02T22:47:25Z | 10s |
| 2026-09-02T22:47:35Z | 10s |
| 2026-09-02T22:47:45Z | 10s |
