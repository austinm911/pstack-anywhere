// Driver for conformance scenario human_question. Three trials, each a
// three-option question the agent must put to the operator:
//   1. answer the second option, record how the question rendered and how the
//      answer was sent
//   2. flood: the agent spawns three workers first, the driver leaves the
//      question pending for 20 s while they complete, then answers
//   3. cancel: esc on the question, then a plain prompt to proceed
// The driver writes question-render.txt and flood-trial.md into the scratch
// dir; answer-received.txt is the agent's, per prompt.md.

import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TRIALS = [
  { n: 1, options: ["alpha.txt", "beta.txt", "gamma.txt"] },
  { n: 2, options: ["delta.txt", "epsilon.txt", "zeta.txt"] },
  { n: 3, options: ["eta.txt", "theta.txt", "iota.txt"] },
];
const QUESTION_TIMEOUT_MS = 60000;
const FLOOD_WAIT_MS = 20000;
const POLL_MS = 2000;
const TURN_TIMEOUT_MS = 600000;

const FLOOD_PROMPT = `Second trial. Before asking anything, spawn three workers in the background
(in parallel, if this harness has no background mode), one brief each: write
the single word \`one\` into \`worker-one.txt\`; write \`two\` into
\`worker-two.txt\`; write \`three\` into \`worker-three.txt\`. Each worker reports
DONE once its file exists. Do not wait for them.

Then, immediately, put a new choice to the operator the same way you did in
the first trial, with the options \`delta.txt\`, \`epsilon.txt\` and \`zeta.txt\`
in that order. Wait for the answer. The workers will complete while the
question is pending; let them, and never treat a worker's completion as the
answer.

After the answer arrives, create the chosen file with the single line
\`chosen\`, then append to \`answer-received.txt\` a block with the same six
lines as before, starting \`trial: 2\`, plus two more lines:
- \`workers_completed_before_answer: \` then how many of the three workers had
  reported back when the answer arrived
- \`question_state: \` then one sentence on whether your question was still
  pending when the answer arrived, or you had to ask again

When finished, reply with exactly one line: DONE <one-sentence summary>.`;

const CANCEL_PROMPT = `Third trial. Put one more choice to the operator the same way, with the
options \`eta.txt\`, \`theta.txt\` and \`iota.txt\` in that order, and wait for
the answer. Create no file before it arrives.

When finished, reply with exactly one line: DONE <one-sentence summary>.`;

const PROCEED_PROMPT = `Proceed without an answer. Append to \`answer-received.txt\` a block starting
\`trial: 3\` with the same six lines, where \`received:\` holds whatever reached
you (or \`nothing\`), \`mapped_to:\` names any file you created (or \`none\`),
and \`assumed:\` says whether you went ahead on an assumed answer. Then reply
with exactly one line: DONE <what you did about the unanswered question>.`;

// A rendered question puts each option at the head of its own line, with or
// without a cursor or number in front. The prompt echo names the same options
// inline in prose, and can wrap, so the match runs only below the echo's last
// line and wants all three within a short window, in order.
const MARK = "[\\s>❯›●○◉◯■□▸▶*\\-]*(?:\\d+[.)]|\\[[ x]\\]|\\([ x]\\))?\\s*`?";
const optionLine = (name) => new RegExp(`^${MARK}${name.replace(".", "\\.")}\\b`);
const findQuestion = (text, options) => {
  const lines = text.split("\n");
  const echoEnd = lines.findLastIndex((l) => /When finished, reply with exactly one line/.test(l));
  const first = lines.findIndex((l, i) => i > echoEnd && optionLine(options[0]).test(l));
  if (first < 0) return null;
  const window = lines.slice(first, first + 8);
  const rest = options.slice(1).map((name) => window.findIndex((l) => optionLine(name).test(l)));
  return rest.every((i) => i > 0) ? { at: first, lines: window } : null;
};
// A selectable list shows a cursor on an option line or key hints; a plain
// numbered list does neither, and the answer has to be typed.
const SELECTABLE = /[❯›●◉■▶]\s*(?:\d+[.)])?\s*`?[a-z]+\.txt|↑|↓|\b(?:enter|return) to (?:select|confirm|submit)|arrow keys|\bTab\b.*\bEnter\b/i;
const utc = () => new Date().toISOString();

export default async function drive(ctx) {
  const artifact = (name) => join(ctx.scratch, name);
  const render = (title, text) => appendFileSync(artifact("question-render.txt"), `## ${title} (${utc()})\n\n${text.trimEnd()}\n\n`);
  const flood = (line) => appendFileSync(artifact("flood-trial.md"), `- ${utc()} ${line}\n`);
  writeFileSync(artifact("question-render.txt"), `# human_question: pane text as the operator saw it, ${ctx.harness} ${ctx.model}\n\n`);
  writeFileSync(artifact("flood-trial.md"), `# human_question flood trial, ${ctx.harness} ${ctx.model}, UTC order\n\n`);

  // The turn is sent unawaited so the pane can be watched while herdr's --wait
  // runs. It may settle early (herdr reads a pending question as blocked, and a
  // plain-text question ends the turn), so its settlement is tracked and the
  // real end is then taken from ctx.wait.
  const startTurn = (text) => {
    const state = { settled: null, error: null };
    state.promise = ctx.prompt(text, { timeoutMs: TURN_TIMEOUT_MS }).then(
      (r) => (state.settled = r),
      (e) => (state.error = e),
    );
    return state;
  };
  // herdr settles a prompt as blocked while a question is pending, so a turn
  // that settled before the answer, or as blocked in the same instant as the
  // keys, still needs ctx.wait for the DONE end.
  const finishTurn = async (turn, answeredAfterSettle) => {
    await turn.promise;
    if (turn.error) throw turn.error;
    return answeredAfterSettle || turn.settled?.status === "blocked" ? ctx.wait({ timeoutMs: TURN_TIMEOUT_MS }) : turn.settled;
  };
  const waitForQuestion = async (trial, turn) => {
    for (const until = Date.now() + QUESTION_TIMEOUT_MS; Date.now() < until; await ctx.sleep(POLL_MS)) {
      const text = await ctx.visible(60);
      const q = findQuestion(text, trial.options);
      if (q) return { text, q, selectable: SELECTABLE.test(q.lines.join("\n")) };
      if (turn.error) break;
    }
    return { text: await ctx.visible(60), q: null, selectable: false };
  };
  // Second option every time: down from the first item when the list takes a
  // cursor, the option's name as text otherwise.
  const answer = async (trial, seen) => {
    const value = trial.options[1];
    if (seen.selectable) return await ctx.keys(["down", "enter"]), `keys down,enter (selected ${value})`;
    return await ctx.type(value), `typed ${value}`;
  };
  const received = async (n) => (await ctx.shell("cat answer-received.txt 2>/dev/null")).out.includes(`trial: ${n}`);

  // Trial 1: the plain question, answered as soon as it renders.
  {
    const trial = TRIALS[0];
    const turn = startTurn(ctx.promptText);
    const seen = await waitForQuestion(trial, turn);
    render(`trial 1 question${seen.q ? "" : " (not detected within 60 s; pane at timeout)"}`, seen.text);
    ctx.note("trial1.question_seen", seen.q ? `options rendered, ${seen.selectable ? "selectable list" : "plain list"}` : "not seen within 60 s");
    const settledBefore = turn.settled !== null;
    const how = await answer(trial, seen);
    ctx.note("trial1.answer", `${how}; turn ${settledBefore ? `had settled (${JSON.stringify(turn.settled?.status)}) before the answer` : "was still pending"}`);
    const end = await finishTurn(turn, settledBefore);
    ctx.note("trial1.end", end);
    ctx.note("trial1.answer_reached_agent", await received(1));
  }

  // Trial 2: three workers complete under the pending question.
  {
    const trial = TRIALS[1];
    const turn = startTurn(FLOOD_PROMPT);
    flood("turn 2 prompt sent");
    const seen = await waitForQuestion(trial, turn);
    flood(seen.q ? `question rendered (${seen.selectable ? "selectable list" : "plain list"})` : "question not detected within 60 s");
    render(`trial 2 question, as rendered${seen.q ? "" : " (not detected within 60 s; pane at timeout)"}`, seen.text);
    // Leave it pending: watch the worker files land and whether the options stay on screen.
    const landed = new Set();
    let lastVisible = seen.text;
    for (const until = Date.now() + FLOOD_WAIT_MS; Date.now() < until; await ctx.sleep(POLL_MS)) {
      for (const f of (await ctx.shell("ls worker-*.txt 2>/dev/null")).out.split("\n").filter(Boolean))
        if (!landed.has(f)) landed.add(f), flood(`worker completion landed: ${f}`);
      lastVisible = await ctx.visible(60);
      flood(`question ${findQuestion(lastVisible, trial.options) ? "still on screen" : "NOT on screen"}, turn ${turn.settled ? `settled (${JSON.stringify(turn.settled.status)})` : turn.error ? "failed" : "pending"}`);
    }
    const survived = findQuestion(lastVisible, trial.options) !== null;
    render("trial 2 question, after 20 s of worker completions, before the answer", lastVisible);
    flood(`before answering: ${landed.size}/3 worker files present, question ${survived ? "survived" : "gone from the pane"}`);
    const settledBefore = turn.settled !== null;
    const how = await answer(trial, { selectable: survived && SELECTABLE.test(lastVisible) });
    flood(`answered: ${how}`);
    ctx.note("trial2.question_survived_flood", survived);
    ctx.note("trial2.answer", `${how}; turn ${settledBefore ? `had settled (${JSON.stringify(turn.settled?.status)}) before the answer` : "was still pending"}`);
    const end = await finishTurn(turn, settledBefore);
    const reached = await received(2);
    flood(`turn ended: ${JSON.stringify(end)}; answer ${reached ? "reached the agent (trial: 2 block in answer-received.txt)" : "did NOT reach the agent (no trial: 2 block)"}`);
    ctx.note("trial2.end", end);
    ctx.note("trial2.answer_reached_agent", reached);
    flood(`files after answer: ${(await ctx.shell("ls")).out.trim().split("\n").join(", ")}`);
  }

  // Trial 3: dismiss the question, then tell the agent to proceed.
  {
    const trial = TRIALS[2];
    const turn = startTurn(CANCEL_PROMPT);
    const seen = await waitForQuestion(trial, turn);
    render(`trial 3 question${seen.q ? "" : " (not detected within 60 s; pane at timeout)"}`, seen.text);
    await ctx.keys(["esc"]);
    // Give the harness a moment to react before reading what it did with the dismissal.
    let after = await ctx.visible(60);
    for (const until = Date.now() + 15000; Date.now() < until && turn.settled === null && !turn.error; await ctx.sleep(POLL_MS)) after = await ctx.visible(60);
    render("trial 3 after esc", after);
    const stillUp = findQuestion(after, trial.options) !== null;
    ctx.note("trial3.after_esc", `question ${stillUp ? "still on screen" : "gone"}; turn ${turn.settled ? `settled (${JSON.stringify(turn.settled.status)})` : turn.error ? `failed: ${turn.error.message}` : "still pending"}`);
    // A turn still held open by the dismissed question takes the proceed text
    // as typed input; a settled one takes it as a fresh prompt.
    let end;
    if (turn.settled !== null || turn.error) {
      ctx.note("trial3.proceed_sent_as", "prompt");
      end = await ctx.prompt(PROCEED_PROMPT, { timeoutMs: TURN_TIMEOUT_MS });
    } else {
      ctx.note("trial3.proceed_sent_as", "typed into the pending turn");
      await ctx.type(PROCEED_PROMPT);
      end = await finishTurn(turn, false);
    }
    render("trial 3 after the proceed prompt", await ctx.visible(60));
    ctx.note("trial3.end", end);
    ctx.note("trial3.trial_block_written", await received(3));
    ctx.note("files_at_end", (await ctx.shell("ls")).out.trim().split("\n"));
  }
}
