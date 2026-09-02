#!/usr/bin/env bash
# Preconditions for conformance scenario worker_defaults_background: a clean
# scratch git repo with neither parent-alive.txt nor worker-done.txt in it, so
# both files appearing is evidence of this run and nothing earlier. The scenario
# probes no pre-existing file, so there is no probe.before.txt to write.
set -euo pipefail

dir="$(mktemp -d)"
cd "$dir"

git init -q
git config user.name "pstack-anywhere bench"
git config user.email "bench@localhost"

# A commit so the tree is clean rather than merely empty and untracked writes
# during the run stand out in git status.
printf 'worker_defaults_background scratch\n' > .bench-scratch
git add .bench-scratch
git commit -q -m "worker_defaults_background preconditions"

rm -f parent-alive.txt worker-done.txt

printf '%s\n' "$dir"
