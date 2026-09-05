# Recovery across sessions

Use the existing orchestration store at `<repo>/.pstack/runs/<run-id>/`.
Ignore `.pstack/` in Git and pass the absolute store path to upstream orch with
`--store` or `ORCH_STORE`. Do not mirror `units.tsv` into another task database.
These are portable operating instructions. Upstream orchestration scripts are unchanged.

Before dispatch, save the exact assignment to `briefs/<unit>-<attempt>.md` and
register its absolute path with `orch unit add --brief`. The brief names the
repository, starting revision, allowed changes, verifier, and absolute result
path `reports/<unit>-<attempt>.md`. Never overwrite an earlier attempt. Write
`dispatching` to the unit before launch and `running` after a worker identifier
is returned. Record the parent session ID, worker ID, and supported resume command in the result trail. An ID may restore saved history without reconnecting to a still-running process.

Write the full worker result to the promised report file before pushing or
collecting any completion pointer. The inbox is only a notification queue;
upstream `inbox drain` deletes collected pointers. Reports and briefs must live
outside it. Keep unresolved human questions in the existing `gates.md` through
`orch gates`. A proposed default is never approval.

After interruption:

1. Read `units.tsv`, `gates.md`, and each nonterminal unit's exact saved brief.
   Read the report at the path in that brief even if the inbox is empty.
2. Reconcile the report with actual checkout changes, commits, or the external
   destination through read-only tools. A missing message is not missing work.
3. If the result exists and its verifier passes, mark the unit accepted without
   repeating its action. Record the evidence in the existing report trail.
4. If completion is uncertain, mark `reconcile-needed` and investigate. Never
   automatically replay an uncertain external write.
5. For incomplete work, prefer native resume of the saved session or eligible
   subagent after inspecting liveness. Resumption must still reconcile actual
   effects. Only when native resume is unavailable or unsuitable, write a new
   brief containing the remaining scope before spawning a fresh worker.

Inspect native liveness before using resume to avoid accidentally starting
another run. Parent-session resume alone does not prove every child can resume. This protocol preserves evidence, not live
workers or exactly-once execution. Human gates remain pending until answered.
