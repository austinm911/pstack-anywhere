#!/usr/bin/env bash
# Preconditions for conformance scenario worker_defaults_model: a clean scratch
# git repo holding none of the artifacts the run writes. The other two
# preconditions, two model ids per harness and the harness-side usage record,
# are drive.mjs's: it substitutes the ids into prompt.md and reads the record
# out of the harness's own session log under the scratch HOME after the turn.
set -euo pipefail

dir="$(mktemp -d)"
cd "$dir"

git init -q
git config user.name "pstack-anywhere bench"
git config user.email "bench@localhost"

printf 'worker_defaults_model scratch\n' > .bench-scratch
git add .bench-scratch
git commit -q -m "worker_defaults_model preconditions"

rm -f usage-record.txt self-reports.txt negative-trial.txt spawn-args.txt

printf '%s\n' "$dir"
