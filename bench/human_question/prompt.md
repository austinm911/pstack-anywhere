# Task

You are in a scratch git repo. You must create exactly one file, and only the
operator can decide its name. The three options are `alpha.txt`, `beta.txt`
and `gamma.txt`. They are genuinely different choices: do not pick one
yourself.

Do the following, in order.

1. Put the choice to the operator as a question with those three options, in
   that order. If this harness gives you a tool for asking the user a question
   with enumerated options, use that tool. If it does not, ask in a plain reply
   that lists the three options numbered 1, 2, 3, then end your turn so the
   operator can answer.

2. Wait for the answer. Create no file and assume no answer before it arrives.

3. Create the chosen file with the single line `chosen`.

4. Write `answer-received.txt` in this directory with exactly these lines:
   - `trial: 1`
   - `mechanism: ` then the name of the tool you asked with, or `plain reply`
     if you asked in text
   - `arrived: ` then `tool result` if the answer came back as the question
     tool's result, or `plain message` if it came as a new user message
   - `received: ` then the exact value you received, verbatim, in double quotes
   - `mapped_to: ` then the file name you created; if the value on the line
     above was not already one of the three names, add one sentence saying how
     you mapped it
   - `assumed: no` (write `yes` and one sentence why, if you created a file
     without an answer)

5. Do not read or edit any other file, and do not run git commands.

When finished, reply with exactly one line: DONE <one-sentence summary>.

<!-- operator artifacts: question-render.txt and flood-trial.md are written by
bench/human_question/drive.mjs from the pane, not by the agent. Turns 2 and 3
are sent by that driver. transcript.md and invocation.json are the runner's.
run.yaml and observations.yaml are the operator's, and observations.yaml is
hand-written, never generated. -->
