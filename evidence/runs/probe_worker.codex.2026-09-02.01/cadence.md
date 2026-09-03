# Line cadence, probe-activity.log

Written by bench/probe_worker/drive.mjs from the log's own timestamps.
Spawn turn done at 2026-09-02T23:13:33.040Z; 18 line(s) in the log at the end, 0 without a readable timestamp.
The worker's brief was one line every 10 seconds, so an interval near 10 s is the
expected cadence, a gap is a stall, and a burst or duplicate stamp is a restart or resume.

| window | from | to | lines | intervals |
|---|---|---|---|---|
| unprobed | start | 2026-09-02T23:14:03.129Z | 3 | min 10s, median 10s, max 10s |
| probed | 2026-09-02T23:14:03.129Z | 2026-09-02T23:14:58.984Z | 5 | min 10s, median 10s, max 10s |
| after third probe | 2026-09-02T23:14:58.984Z | 2026-09-02T23:17:03.056Z | 10 | min 10s, median 10s, max 10s |
| after fourth probe | 2026-09-02T23:17:03.056Z | end | 0 | n/a |

Duplicate consecutive timestamps: 0.

## Probe times

- probe 1: sent 2026-09-02T23:14:03.129Z, replied 2026-09-02T23:14:08.198Z, log lines 3 -> 3
- probe 2: sent 2026-09-02T23:14:28.214Z, replied 2026-09-02T23:14:32.200Z, log lines 5 -> 6
- probe 3: sent 2026-09-02T23:14:52.212Z, replied 2026-09-02T23:14:58.952Z, log lines 8 -> 8
- probe 4: sent 2026-09-02T23:17:03.056Z, replied 2026-09-02T23:17:07.153Z, log lines 18 -> 18

## Every line with its interval from the previous

| line | interval |
|---|---|
| 2026-09-02T23:13:39Z | first |
| 2026-09-02T23:13:49Z | 10s |
| 2026-09-02T23:13:59Z | 10s |
| 2026-09-02T23:14:10Z | 11s |
| 2026-09-02T23:14:20Z | 10s |
| 2026-09-02T23:14:30Z | 10s |
| 2026-09-02T23:14:40Z | 10s |
| 2026-09-02T23:14:50Z | 10s |
| 2026-09-02T23:15:00Z | 10s |
| 2026-09-02T23:15:10Z | 10s |
| 2026-09-02T23:15:20Z | 10s |
| 2026-09-02T23:15:30Z | 10s |
| 2026-09-02T23:15:40Z | 10s |
| 2026-09-02T23:15:50Z | 10s |
| 2026-09-02T23:16:00Z | 10s |
| 2026-09-02T23:16:10Z | 10s |
| 2026-09-02T23:16:20Z | 10s |
| 2026-09-02T23:16:30Z | 10s |
