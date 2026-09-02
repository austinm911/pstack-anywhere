#!/usr/bin/env bash
# Preconditions for conformance scenario spawn_worker: a clean scratch git repo
# holding probe.txt with the single line "seed", plus a copy of that initial
# state so the run can prove what probe.txt looked like at start.
set -euo pipefail

dir="$(mktemp -d)"
cd "$dir"

git init -q
git config user.name "pstack-anywhere bench"
git config user.email "bench@localhost"

printf 'seed\n' > probe.txt
cp probe.txt probe.before.txt

git add probe.txt probe.before.txt
git commit -q -m "spawn_worker preconditions"

printf '%s\n' "$dir"
