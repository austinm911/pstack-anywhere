// Driver for conformance scenario worker_durability. The runner (bench/run.mjs)
// calls drive(ctx) once the agent is settled; the contract for ctx is in
// bench/README.md.
//
// Timeline, about 9 minutes of wall time:
//   1. record the harness pid before anything is spawned
//   2. turn one: the agent spawns the heartbeat worker and replies DONE at once
//   3. poll heartbeat.log until two lines exist, at most 120 s
//   4. end the parent with the harness's own quit command, note the clock
//   5. wait until 5 minutes after the spawn plus a 2 minute margin
//   6. read heartbeat.log and done.txt, write termination.yaml
//   7. restart the harness in the same pane and scratch, turn two asks it to
//      reach the worker and write reattach-attempt.md
//
// heartbeat.log is the worker's file and is never touched here; the runner
// harvests it as it lies.

import { YAML } from "bun";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const WORKER_RUN_MS = 5 * 60 * 1000;
const MARGIN_MS = 2 * 60 * 1000;
const HEARTBEAT_WAIT_MS = 120 * 1000;
const POLL_MS = 10 * 1000;

const now = () => new Date().toISOString();

const REATTACH_PROMPT = `# Task

You are in a scratch git repo. An earlier session of this same harness, in
this same directory, spawned one background worker with the brief: append a UTC
timestamp line to \`heartbeat.log\` every 30 seconds for 5 minutes, then write
\`done.txt\` and report. That session was then ended. You are the fresh session.

Try to reach that worker or its output through whatever this harness offers:
list or enumerate background workers, jobs, tasks, or subagents; read a worker's
state or result by its handle; resume or reattach to the earlier session; or
search this harness's own session or log files under \`$HOME\`. Try every path
you know of, including the ones you expect to fail.

Write \`reattach-attempt.md\` in this directory holding, verbatim, every
command, tool call, or handle you tried and exactly what came back, failures
included. Then state on its last line which of these applied: the worker was
enumerated and its state read; its final report text was collected, and from
where; only its files (\`heartbeat.log\`, \`done.txt\`) were reachable; or
nothing of it was reachable at all. Do not modify \`heartbeat.log\` or
\`done.txt\`.

When finished, reply with exactly one line: DONE <one-sentence summary>.
`;

const heartbeatLines = (scratch) =>
  existsSync(join(scratch, "heartbeat.log"))
    ? readFileSync(join(scratch, "heartbeat.log"), "utf8").split("\n").filter((l) => l.trim())
    : [];

// The worker writes `date -u +%Y-%m-%dT%H:%M:%SZ` lines, so a line parses as a
// clock; one that does not is quoted but never counted as after termination.
const laterThan = (lines, iso) => {
  const cutoff = Date.parse(iso);
  return lines.filter((l) => {
    const t = Date.parse(l.trim());
    return !Number.isNaN(t) && t > cutoff;
  });
};

export default async function drive(ctx) {
  // 1. The comparison point for everything else: the parent's pid, before the spawn.
  const pid = await ctx.pid();
  ctx.note("parent_pid", pid);
  ctx.note("parent_pid_source", `herdr pane process-info --pane ${ctx.pane}, taken ${now()}`);

  // 2. The spawn. The prompt tells the agent to reply without waiting on the
  // worker, so this turn should return within a minute; 3 minutes is generous.
  const spawnedAt = now();
  ctx.note("spawn_prompted_at", spawnedAt);
  const first = await ctx.prompt(ctx.promptText, { timeoutMs: 180000 });
  ctx.note("spawn_turn", first);

  // 3. Two lines prove the worker is running on its own clock, not a single
  // write at spawn time. Polling stops early; the worker keeps going.
  let lines = [];
  for (const until = Date.now() + HEARTBEAT_WAIT_MS; Date.now() < until; await ctx.sleep(POLL_MS)) {
    lines = heartbeatLines(ctx.scratch);
    if (lines.length >= 2) break;
  }
  ctx.note("heartbeats_before_termination", lines.length);
  ctx.note("heartbeat_lines_before_termination", lines);
  if (lines.length < 2) ctx.note("warning", `only ${lines.length} heartbeat line(s) after ${HEARTBEAT_WAIT_MS / 1000}s; the worker was not demonstrably mid-run`);

  // 4. A clean quit is the method most likely to drain workers, so it is the
  // one the ledger asks about first; the exact command is what ctx.quit used.
  const aliveBefore = (await ctx.shell(`kill -0 ${pid}`)).code === 0;
  const quit = await ctx.quit({ method: "command" });
  ctx.note("terminated", quit);
  await ctx.sleep(5000);
  const aliveAfter = (await ctx.shell(`kill -0 ${pid}`)).code === 0;
  ctx.note("parent_pid_alive_after_quit", aliveAfter);

  // 5. The worker's own schedule, from the spawn, plus the scenario's margin.
  const deadline = Date.parse(spawnedAt) + WORKER_RUN_MS + MARGIN_MS;
  ctx.note("waiting_until", new Date(deadline).toISOString());
  await ctx.sleep(Math.max(0, deadline - Date.now()));

  // 6. The survival reading, taken by the driver so the fresh session's reading is a separate one.
  const after = heartbeatLines(ctx.scratch);
  const survived = laterThan(after, quit.at);
  const doneText = existsSync(join(ctx.scratch, "done.txt")) ? readFileSync(join(ctx.scratch, "done.txt"), "utf8") : null;
  ctx.note("heartbeats_total", after.length);
  ctx.note("heartbeats_after_termination", survived.length);
  ctx.note("done_txt", doneText);
  writeFileSync(
    join(ctx.scratch, "termination.yaml"),
    YAML.stringify(
      {
        method: quit.method,
        pid,
        pid_source: `herdr pane process-info --pane ${ctx.pane}, foreground process group of the agent pane, read before the spawn`,
        pid_alive_before_quit: aliveBefore,
        pid_alive_5s_after_quit: aliveAfter,
        terminated_at: quit.at,
        clock: "UTC, Date.toISOString on the bench host, read by drive.mjs when ctx.quit returned",
        spawn_prompted_at: spawnedAt,
        heartbeats_before_termination: lines,
        read_after_wait_at: now(),
        heartbeats_total: after.length,
        heartbeats_after_termination: survived.length,
        heartbeat_lines_after_termination: survived,
        done_txt: doneText,
      },
      null,
      2,
    ),
  );

  // 7. Reattachment is a separate question from survival, answered by a session that never saw the spawn.
  const fresh = await ctx.restart();
  ctx.note("restarted", { name: fresh, at: now() });
  const second = await ctx.prompt(REATTACH_PROMPT, { timeoutMs: 300000 });
  ctx.note("reattach_turn", second);
  if (!existsSync(join(ctx.scratch, "reattach-attempt.md")))
    writeFileSync(join(ctx.scratch, "reattach-attempt.md"), `The fresh session (${fresh}) replied without writing this file; its attempt, if any, is in transcript.md.\n`);
}
