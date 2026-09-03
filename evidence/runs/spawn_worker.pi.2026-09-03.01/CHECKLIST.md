# Run checklist: spawn_worker on pi

Run id `spawn_worker.pi.2026-09-03.01`. Nothing below has been done. This directory holds a
manifest and this checklist; every other line is something the run has to
produce.

## Required artifacts

Every one of them, with content in it. A required artifact that is absent,
empty, whitespace-only, or a symlink rather than a file of this run's own
leaves the run incomplete. Where the honest result is no output, say so in
one line inside the artifact; an empty file always means nobody looked.

| artifact | holds |
| --- | --- |
| `run.yaml` | The run manifest, one flat map, every field below present and filled from the run itself: `scenario`, `harness`, and `run_id`, all three equal to what the run id encodes; `coupling_version`, the coupling.yaml version the run was authored against; `started_at` and `ended_at` as UTC timestamps with an offset, in that order; `operator`, `machine`, `os`; `harness_version` as the harness itself reports it; every field named in required_metadata below; `supersedes`, naming the earlier run this one corrects or null, under the rules in `supersession`; and optionally `extension`, the name and version of the extension that supplied the primitive, required when the recorded parity is extension. A version the operator typed from memory is not a version. `probe prepare` writes this file with every field present and null, which is what makes the run read as unexecuted until it is run. |
| `observations.yaml` | `observations:`, one entry per observation id the scenario declares, in scenario order, with none added, omitted, or reordered. An entry is exactly `{id, observed, source}` or exactly `{id, unsatisfiable}` and nothing else. `observed` is the raw recorded value, a scalar, and `false` is a reading like any other: several observations are answered by not seeing the thing. `source` is which artifact and where in it, written out as text, because a locator that is not text locates nothing. Under the second shape, `unsatisfiable` is the reason, also written out as text. No entry carries both shapes, because that says both that the observation was made and that it could not be, and no entry carries any other key. The second shape is legal only where the scenario declares an `unsatisfiable_when` for that observation id; a waiver anywhere else voids the run. A missing entry voids the run; see void_conditions.missing_observation. |
| `invocation.json` | The verbatim tool name and full argument object for every primitive the run exercised, in call order, with timestamps. Argument names matter as much as values, because the parity question is usually about shape. |
| `transcript.md` | The verbatim session excerpt covering the run window, including the agent's turns, tool results, and any refusal or error text. Redact secrets in place and mark each redaction; do not summarize. |
| `probe.before.txt` | probe.txt as it stood at the recorded start timestamp. |
| `probe.after.txt` | probe.txt after the worker's report was received. |
| `worker-report.txt` | The verbatim result the parent received. |

## Observations

`observations.yaml` carries one entry per id below, in this order. An entry
is exactly `{id, observed, source}` or exactly `{id, unsatisfiable}`, never a
blend and never with another key. An omitted entry voids the run. An id
marked waivable below may take the second shape, with the reason written out
as text, because the scenario declares the condition under which the
observation cannot be made; no other id may, and `false` or `0` is not a
reason.

1. `spawn.primitive`
2. `spawn.separate_context` — waivable
3. `spawn.result_returned`
4. `spawn.side_effect_matches`
5. `spawn.parent_abstained`

## Void conditions

- `missing_observation`: A required observation is neither satisfied with a source nor recorded as unsatisfiable with a reason; or it is recorded as both observed and unsatisfiable at once; or it is recorded as unsatisfiable where the scenario declares no `unsatisfiable_when` for it.
- `self_report_only`: The only source for an observation is the agent's own narration of what it did, where the scenario names an out-of-band source.
- `setup_not_reached`: The scenario's preconditions were not all true at the recorded start timestamp.
- `operator_intervention`: The operator supplied a step not in the scenario and did not amend the scenario first.
- `digest_mismatch`: An artifact's recorded digest does not match the file in evidence/runs/.
- `secret_leak`: Any file in the run directory, transcript, session capture, or artifact, holds an environment secret: a NAME=value whose name ends in KEY, TOKEN, SECRET, or PASSWORD, or an `sk-` API key.
- `superseded`: A later complete run of the same scenario on the same harness names this run in `supersedes`. A correction is strictly later than the run it corrects, on date then counter, and a prepared, incomplete, or void directory naming `supersedes` corrects nothing.

## After the run

```
bun scripts/coupling.mjs probe inspect spawn_worker.pi.2026-09-03.01
```

`inspect` judges this directory and writes nothing. A verification needs a
record in `evidence/attestations.yaml` that cites a complete run
and carries the sha256 of every file in it.
