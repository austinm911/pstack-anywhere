---
name: swarm
description: "Fan out N parallel workers, drain them, and return one report. Use for /swarm, 'swarm this', or parallel coverage, races, gauntlets, and exploration."
disable-model-invocation: true
---

# Swarm

Read `../poteto-mode/capabilities.md` for `spawn_worker` and `worker_defaults`. Use the delegate identity and background controls the current harness actually offers. Keep reviews read-only through their briefs and available permission controls without broadening the caller's access.

## Start

Open a todolist with one entry per phase before launching anything.

1. Frame
2. Fan out
3. Aggregate
4. Report

## Phase A: Frame

1. State the done predicate and the artifact or report the swarm must return.
2. Choose the shape. Partition into slices, race N workers on identical briefs, or mix both. For a race or mixed shape, declare `first pass`, `rank all`, or `best-of` before spawning.
4. Pick the worker model from `swarm workers` in the override block. Resolve model roles from the override block `/setup-pstack-anywhere` writes. Missing roles, `auto`, and `inherit-parent` use the parent model. An alias panel entry still creates one seat. If a configured model is rejected, discover the current tool's available models and prefer one from the same family, otherwise use the parent model. Report the substitution and any lost model diversity. Never invent a model identifier. For a model race, name each arm's model up front. Pick each subagent's reasoning level and fast or standard speed for the job, per the Subagents section of the **poteto-mode** skill.
4. Give each worker its own writable output when it writes. When workers verify or measure commits, each brief names the exact SHAs. A measurement brief also names the method (sample count, what one sample is, order). The worker records both in its result.

## Phase B: Fan out

Spawn all N workers through `spawn_worker` in the background with the step 3 model. Use the environment actually offered by the current harness. Where off-machine workers are unavailable, use isolated local outputs and report the `worker_durability` gap rather than claiming cloud execution.

When a worker must start from a non-default pushed branch, pass the harness's supported base-branch parameter or name the exact branch in its brief. Do not assume Cursor's worker parameters exist.

Every brief stands alone. Include the goal, scope, exact slice or race arm, how to verify, and what to report. Reports use `PASS`, `ISSUES`, or `BLOCKED` with evidence. A worker that can prove a defect reports `ISSUES` and lists every issue it can prove, not only the first.

If a worker drops out, proceed with N-1 and note it.

## Phase C: Aggregate

Read the terminal results. Drop a result that does not record the SHAs and method its brief names, and respawn that worker once. After a second miss, record a gap. A gap does not count as a pass. For coverage, every required slice needs a result. For a race, apply the selection rule declared up front. Use first pass, rank all, or best-of. Do not paste raw worker dumps.

## Phase D: Report

Return one consolidated in-chat report with a result table, issue one-liners, gaps or dropouts, and the race rule when used.
