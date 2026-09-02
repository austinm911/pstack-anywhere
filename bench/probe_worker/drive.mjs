// Driver for conformance scenario probe_worker. prompt.md spawns the worker;
// from there the operator steps are timed, so the runner cannot do them with
// one prompt-and-wait. Four probe turns, each a prompt the parent answers about
// its worker, with the log's line cadence read around them. The parent is
// never asked to resume the worker; whether it did anyway is what cadence.md
// exists to show.
//
// Wall time after the spawn turn: 30 s unprobed, three probes ~20 s apart, then
// a wait to the worker's 3 minute mark plus slack before the fourth probe.
// Roughly 4 to 5 minutes, plus however long each probe turn takes.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const LOG = "probe-activity.log";
const WORKER_RUN_MS = 180000;
// The worker starts inside the spawn turn, so its 3 minutes run from before
// the first DONE; the slack covers a loop that started late or sleeps long.
const FINISH_SLACK_MS = 30000;
const UNPROBED_MS = 30000;
const PROBE_GAP_MS = 20000;

const PROBE_TEXT = [
  "Check on the worker you spawned without resuming or re-prompting it: report",
  "its liveness verbatim as your harness reports it, and name the primitive you",
  "used, with its arguments. Do not read probe-activity.log to answer.",
  "",
  "When finished, reply with exactly one line: DONE <one-sentence summary>.",
].join("\n");
// The reply is what follows the prompt's echo in the transcript.
const ANCHOR = "resuming or re-prompting it";

const now = () => new Date().toISOString();

// A line's timestamp, if the worker wrote one Date can read. Anything else is
// kept as text so the cadence report shows exactly what the file held.
const parseLine = (line) => {
  const iso = line.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/)?.[0];
  const ms = Date.parse(iso ?? line);
  return { line, ms: Number.isNaN(ms) ? null : ms };
};

// YAML block scalar with every line indented, so verbatim text of any shape
// (colons, hashes, leading dashes) survives a parser.
const block = (text, indent) => {
  const pad = " ".repeat(indent);
  return `|-\n${text.replace(/\s+$/, "").split("\n").map((l) => (l.length ? pad + l : "")).join("\n")}`;
};
const yamlQuote = (s) => JSON.stringify(s);

export default async function drive(ctx) {
  const readLog = () => {
    const r = ctx.shell(`[ -f ${LOG} ] && cat ${LOG}`);
    return r.code === 0 ? r.out.split("\n").filter((l) => l.trim()) : [];
  };

  // The spawn turn is prompt.md; its DONE is where the clock starts.
  const spawn = await ctx.prompt(ctx.promptText);
  const spawnedAt = now();
  ctx.note("spawn", { at: spawnedAt, ...spawn });
  const spawnReply = ctx.read(200);

  await ctx.sleep(UNPROBED_MS);
  const unprobed = readLog();
  ctx.note("unprobed_window", { at: now(), lines: unprobed.length, last: unprobed.at(-1) ?? null });

  // A harness that hides the prompt echo leaves the whole tail, marked so the
  // reader knows the reply was not cut out.
  const probes = [];
  const probe = async (n) => {
    const at = now();
    const linesBefore = readLog().length;
    const result = await ctx.prompt(PROBE_TEXT);
    const after = ctx.read(400);
    const idx = after.lastIndexOf(ANCHOR);
    const reply = (idx >= 0 ? after.slice(idx + ANCHOR.length) : after).trim() || "(no transcript text after this probe)";
    const done = reply.match(/^\s*(?:⏺\s*)?DONE\b.*$/m)?.[0].trim() ?? null;
    const entry = { n, at, ended: now(), lines_before: linesBefore, lines_after: readLog().length, result, reply, done, anchored: idx >= 0 };
    probes.push(entry);
    ctx.note(`probe_${n}`, { at, ended: entry.ended, done, status: result.status, lines_before: linesBefore, lines_after: entry.lines_after });
  };

  for (let n = 1; n <= 3; n += 1) {
    if (n > 1) await ctx.sleep(PROBE_GAP_MS);
    await probe(n);
  }
  const probedEnd = now();

  // Let the worker finish before the last probe.
  const remaining = Date.parse(spawnedAt) + WORKER_RUN_MS + FINISH_SLACK_MS - Date.now();
  if (remaining > 0) await ctx.sleep(remaining);
  const beforeFinal = readLog();
  ctx.note("before_final_probe", { at: now(), lines: beforeFinal.length, last: beforeFinal.at(-1) ?? null });
  await probe(4);

  const log = readLog().map(parseLine);
  ctx.note("log_final", { lines: log.length, unparsed: log.filter((l) => l.ms === null).length });

  writeFileSync(
    join(ctx.scratch, "probes.yaml"),
    [
      "# Written by bench/probe_worker/drive.mjs. Each probe is one prompt turn to the",
      "# parent; `reply` is the transcript text that followed it, verbatim. Times are",
      "# UTC from the bench host.",
      `spawn_done_at: ${spawnedAt}`,
      `spawn_reply: ${block(spawnReply.trim().split("\n").slice(-40).join("\n"), 2)}`,
      `probe_prompt: ${block(PROBE_TEXT, 2)}`,
      `unprobed_window_end: ${probes[0].at}`,
      `probed_window_end: ${probedEnd}`,
      "probes:",
      ...probes.flatMap((p) => [
        `  - n: ${p.n}`,
        `    sent_at: ${p.at}`,
        `    replied_at: ${p.ended}`,
        `    herdr_status: ${yamlQuote(String(p.result.status))}`,
        `    settled_by: ${yamlQuote(String(p.result.settled_by ?? ""))}`,
        `    log_lines_before: ${p.lines_before}`,
        `    log_lines_after: ${p.lines_after}`,
        `    reply_anchored_to_prompt_echo: ${p.anchored}`,
        `    done_line: ${p.done === null ? "null" : yamlQuote(p.done)}`,
        `    reply: ${block(p.reply, 6)}`,
      ]),
      "",
    ].join("\n"),
  );
  writeFileSync(join(ctx.scratch, "cadence.md"), cadenceReport(log, spawnedAt, probes, probedEnd));
}

// Line intervals per window. The worker's own clock stamps each line, so the
// windows are cut on the bench host's probe timestamps against those stamps;
// a few seconds of skew moves a line across a boundary, not the shape.
const cadenceReport = (log, spawnedAt, probes, probedEnd) => {
  const bounds = [
    ["unprobed", -Infinity, Date.parse(probes[0].at)],
    ["probed", Date.parse(probes[0].at), Date.parse(probedEnd)],
    ["after third probe", Date.parse(probedEnd), Date.parse(probes[3].at)],
    ["after fourth probe", Date.parse(probes[3].at), Infinity],
  ];
  const stamped = log.filter((l) => l.ms !== null);
  const unparsed = log.length - stamped.length;
  const gaps = (lines) => lines.slice(1).map((l, i) => (l.ms - lines[i].ms) / 1000);
  const stat = (xs) => {
    if (xs.length === 0) return "n/a";
    const s = [...xs].sort((a, b) => a - b);
    return `min ${s[0]}s, median ${s[Math.floor(s.length / 2)]}s, max ${s.at(-1)}s`;
  };
  const edge = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString() : ms < 0 ? "start" : "end");
  const dupes = stamped.filter((l, i) => i > 0 && l.ms === stamped[i - 1].ms).length;
  const out = [
    "# Line cadence, probe-activity.log",
    "",
    "Written by bench/probe_worker/drive.mjs from the log's own timestamps.",
    `Spawn turn done at ${spawnedAt}; ${log.length} line(s) in the log at the end, ${unparsed} without a readable timestamp.`,
    "The worker's brief was one line every 10 seconds, so an interval near 10 s is the",
    "expected cadence, a gap is a stall, and a burst or duplicate stamp is a restart or resume.",
    "",
    "| window | from | to | lines | intervals |",
    "|---|---|---|---|---|",
  ];
  for (const [name, from, to] of bounds) {
    const lines = stamped.filter((l) => l.ms >= from && l.ms < to);
    out.push(`| ${name} | ${edge(from)} | ${edge(to)} | ${lines.length} | ${stat(gaps(lines))} |`);
  }
  out.push("", `Duplicate consecutive timestamps: ${dupes}.`, "", "## Probe times", "");
  for (const p of probes) out.push(`- probe ${p.n}: sent ${p.at}, replied ${p.ended}, log lines ${p.lines_before} -> ${p.lines_after}`);
  out.push("", "## Every line with its interval from the previous", "", "| line | interval |", "|---|---|");
  for (const [i, l] of log.entries()) {
    const prev = log[i - 1];
    const gap = l.ms !== null && prev?.ms != null ? `${(l.ms - prev.ms) / 1000}s` : i === 0 ? "first" : "unreadable";
    out.push(`| ${l.line.replaceAll("|", "\\|")} | ${gap} |`);
  }
  if (log.length === 0) out.push("| (log absent or empty) | |");
  return `${out.join("\n")}\n`;
};
