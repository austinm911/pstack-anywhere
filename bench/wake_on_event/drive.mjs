// Driver for conformance scenario wake_on_event. The prompt asks the agent to
// wait for event.flag; this file decides when the flag appears, so the wait
// window is the operator's and not the agent's. Trial one: leave the wait
// alone for 120 s, then trigger and time the wake. Trial two: the same wait,
// never triggered, watched for at least twice the first trial's observed wait,
// then aborted if it is still going.
//
// herdr's agent state carries no turn or token counter (agent get answers
// agent_status, revision, state_change_seq), so the turn accounting the
// scenario asks for is read from the harness's own session log under the
// scratch HOME: assistant entries counted and the last usage object seen,
// with every file that was read named in wait-accounting.yaml.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const tryOr = (fn, fallback) => {
  try {
    return fn();
  } catch (error) {
    return typeof fallback === "function" ? fallback(error) : fallback;
  }
};

const now = () => new Date().toISOString();
const readScratch = (ctx, name) => tryOr(() => readFileSync(join(ctx.scratch, name), "utf8").trim(), null);

// Assistant entries in every jsonl under the scratch HOME, in the shapes
// run.mjs already parses: omp/pi {message:{role}}, claude {type:"assistant"},
// codex {type:"response_item", payload:{type:"message", role}}. Usage is
// whichever object the harness put beside the message; the last one seen wins,
// since claude and pi report per-turn totals and codex reports a running total.
const sessionAccounting = (home) => {
  const files = tryOr(() => readdirSync(home, { recursive: true }), []).filter((rel) => rel.endsWith(".jsonl"));
  let [assistant, usage, lines] = [0, null, 0];
  for (const rel of files) {
    const text = tryOr(() => readFileSync(join(home, rel), "utf8"), "");
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      lines += 1;
      const entry = tryOr(() => JSON.parse(line), null);
      if (!entry) continue;
      const payload = entry.type === "response_item" ? entry.payload : null;
      const role = entry.message?.role ?? payload?.role ?? (entry.type === "assistant" ? "assistant" : null);
      if (role === "assistant") assistant += 1;
      const seen = entry.message?.usage ?? entry.usage ?? entry.payload?.info?.total_token_usage ?? entry.payload?.info?.last_token_usage ?? null;
      if (seen && typeof seen === "object") usage = seen;
    }
  }
  return { at: now(), files, lines, assistant_entries: assistant, usage };
};

// herdr's counters plus the session log, taken together so one timestamp covers both.
const snapshot = (ctx, label) => {
  const agent = tryOr(() => ctx.status(), null);
  const s = {
    label,
    ...sessionAccounting(ctx.home),
    herdr: agent ? { agent_status: agent.agent_status, revision: agent.revision, state_change_seq: agent.state_change_seq } : null,
  };
  ctx.note(`accounting.${label}`, `${s.at} assistant_entries=${s.assistant_entries} seq=${s.herdr?.state_change_seq ?? "?"} status=${s.herdr?.agent_status ?? "?"}`);
  return s;
};

const yaml = (obj) => JSON.stringify(obj, null, 2);

const FIRST_WAIT_MS = 120_000;
const SETTLE_POLL_MS = 5_000;

export default async function drive(ctx) {
  const flag = join(ctx.scratch, "event.flag");
  const before = snapshot(ctx, "before_wait");

  // Trial one. The prompt does not return until the flag exists, so it runs
  // unawaited while the driver holds the trigger back.
  const enteredAt = now();
  ctx.note("trial1.prompt_sent", enteredAt);
  const first = ctx.prompt(ctx.promptText, { timeoutMs: 30 * 60_000 });
  await ctx.sleep(FIRST_WAIT_MS);
  if (existsSync(flag)) throw new Error("event.flag appeared before the driver triggered it; the agent created its own event");
  const during = snapshot(ctx, "during_wait");
  const waitCall = readScratch(ctx, "wait-call.txt");
  ctx.note("trial1.wait_call", waitCall ?? "wait-call.txt not written before the trigger");

  const trigger = ctx.shell("date -u +%FT%TZ > trigger-at.txt && touch event.flag");
  if (trigger.code !== 0) throw new Error(`trigger failed (${trigger.code}): ${trigger.err}`);
  const triggeredAt = readScratch(ctx, "trigger-at.txt");
  ctx.note("trial1.triggered", triggeredAt);

  const firstResult = await first;
  const returnedAt = now();
  const after = snapshot(ctx, "after_wake");
  const wokeAt = readScratch(ctx, "woke-at.txt");
  ctx.note("trial1.returned", `${returnedAt} status=${firstResult.status} settled_by=${firstResult.settled_by ?? "herdr wait"}`);
  ctx.note("trial1.woke_at", wokeAt ?? "woke-at.txt not written");
  const observedWaitMs = Date.parse(returnedAt) - Date.parse(enteredAt);

  writeFileSync(
    join(ctx.scratch, "timeline.yaml"),
    [
      "# UTC. wait_entered and wait_returned are the driver's clock around ctx.prompt;",
      "# trigger is the scratch shell's `date -u` written just before touch event.flag;",
      "# woke is the agent's own `date -u` as its first post-wake action (woke-at.txt, verbatim).",
      "clock: UTC, Date.toISOString on the bench host and date -u in the scratch shell",
      `wait_entered: ${enteredAt}`,
      `held_without_action_ms: ${FIRST_WAIT_MS}`,
      `trigger: ${triggeredAt ?? "null"}`,
      `trigger_action: touch event.flag`,
      `wait_returned: ${returnedAt}`,
      `wait_returned_status: ${JSON.stringify(firstResult.status)}`,
      `wait_returned_settled_by: ${JSON.stringify(firstResult.settled_by ?? "herdr agent prompt --wait")}`,
      `observed_wait_ms: ${observedWaitMs}`,
      "first_post_wake_action: date -u +%FT%TZ > woke-at.txt, as instructed in prompt.md",
      "woke_at_txt: |",
      ...(wokeAt ?? "woke-at.txt was not written").split("\n").map((l) => `  ${l}`),
      `latency_trigger_to_woke_s: ${wokeAt && triggeredAt ? (Date.parse(wokeAt.split("\n")[0]) - Date.parse(triggeredAt)) / 1000 : "null"}`,
      "",
    ].join("\n"),
  );

  // Trial two: the same wait, never triggered, held for at least twice the
  // first trial's wait. A wait that expires on its own comes back as a settled
  // prompt; one that blocks forever is the herdr timeout, and then the agent is
  // aborted with esc so the run can end.
  ctx.shell("rm -f event.flag trigger-at.txt");
  const secondBudgetMs = Math.max(2 * observedWaitMs, 2 * FIRST_WAIT_MS);
  const secondEnteredAt = now();
  ctx.note("trial2.prompt_sent", `${secondEnteredAt} budget_ms=${secondBudgetMs}`);
  const secondText = `${ctx.promptText}\n\nThis is the second trial of the same wait. Overwrite wait-call.txt and woke-at.txt as before.\n`;
  const second = ctx.prompt(secondText, { timeoutMs: secondBudgetMs });
  // ctx.prompt resolves with "prompt failed: timeout" once the budget passes;
  // the race is a guard against a herdr wait that outlives its own timeout.
  const seenDuring = [];
  const settledSecond = await Promise.race([second, ctx.sleep(secondBudgetMs + SETTLE_POLL_MS).then(() => null)]);
  const secondReturnedAt = now();
  const secondStatus = settledSecond?.status ?? tryOr(() => ctx.status()?.agent_status, null) ?? "unknown";
  const stillWaiting = !settledSecond || String(secondStatus).startsWith("prompt failed") || secondStatus === "working";
  ctx.note("trial2.outcome", `${secondReturnedAt} status=${secondStatus} still_waiting=${stillWaiting}`);
  seenDuring.push(ctx.visible(60));

  let ended = "the wait returned on its own";
  if (stillWaiting) {
    ctx.note("trial2.abort", "esc sent: the wait was still running past the budget");
    await ctx.keys(["esc"]);
    await ctx.sleep(3_000);
    if (tryOr(() => ctx.status()?.agent_status, "unknown") === "working") {
      await ctx.keys(["esc"]);
      await ctx.sleep(3_000);
    }
    ended = "aborted by the driver with esc after the budget elapsed";
    seenDuring.push(ctx.visible(60));
    if (!settledSecond) await second.catch(() => null);
    // The run's status is the driver's last prompt, and the aborted one timed
    // out by design. A closing turn records what the agent saw of the abort and
    // ends the run settled.
    const closing = await ctx.prompt(
      "The operator aborted your second wait; the event was never triggered. Do not wait again. Append one line to woke-at.txt saying the wait was interrupted and what, if anything, it returned. Then reply with exactly one line: DONE <one-sentence summary>.",
      { timeoutMs: 120_000 },
    );
    ctx.note("trial2.closing", `${now()} status=${closing.status}`);
  }
  const secondWokeAt = readScratch(ctx, "woke-at.txt");
  const flagAfter = existsSync(flag);
  const final = snapshot(ctx, "after_trial2");

  writeFileSync(
    join(ctx.scratch, "no-trigger-trial.md"),
    [
      "# Second trial: same wait, never triggered",
      "",
      `- entered: ${secondEnteredAt}`,
      `- budget: ${secondBudgetMs} ms (first trial observed ${observedWaitMs} ms; minimum 2x)`,
      `- ended: ${secondReturnedAt}, ${ended}`,
      `- prompt status as herdr reported it: ${secondStatus}`,
      `- event.flag present at the end: ${flagAfter}`,
      "",
      "## What the agent emitted",
      "",
      secondWokeAt ? `woke-at.txt after the trial, verbatim:\n\n\`\`\`\n${secondWokeAt}\n\`\`\`` : "Nothing was written to woke-at.txt during the trial.",
      "",
      "## Pane, verbatim, at the end of the budget and after the abort",
      "",
      ...seenDuring.flatMap((text, i) => [`### capture ${i + 1}`, "", "```", text.trimEnd(), "```", ""]),
      "## Transcript tail, verbatim",
      "",
      "```",
      ctx.read(200).trimEnd(),
      "```",
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(ctx.scratch, "wait-accounting.yaml"),
    [
      "# Sources. herdr: `herdr agent get` (agent_status, revision, state_change_seq);",
      "# it exposes no turn or token counter. session_log: every *.jsonl under the",
      "# scratch HOME at the snapshot, assistant entries counted and the last usage",
      "# object seen. Zero growth in assistant_entries across during_wait minus",
      "# before_wait, beyond the single turn that entered the wait, is the claim.",
      "sources:",
      "  herdr: herdr agent get, fields agent_status, revision, state_change_seq",
      `  session_log: ${JSON.stringify(after.files)}`,
      "wait_call: |",
      ...(waitCall ?? "wait-call.txt was not written before the trigger").split("\n").map((l) => `  ${l}`),
      "snapshots:",
      ...[before, during, after, final].map((s) => `  ${s.label}: ${yaml(s).replaceAll("\n", "\n  ")}`),
      `assistant_entries_during_wait: ${during.assistant_entries - before.assistant_entries}`,
      `assistant_entries_wait_to_wake: ${after.assistant_entries - during.assistant_entries}`,
      `state_change_seq_during_wait: ${(during.herdr?.state_change_seq ?? 0) - (before.herdr?.state_change_seq ?? 0)}`,
      "",
    ].join("\n"),
  );
  ctx.note("artifacts", "wait-accounting.yaml timeline.yaml no-trigger-trial.md written to scratch");
}
