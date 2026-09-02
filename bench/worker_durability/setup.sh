#!/usr/bin/env bash
# Preconditions for conformance scenario worker_durability: a clean scratch git
# repo with no heartbeat.log and no done.txt, so every line that appears in
# either was written by the worker during this run. The remaining
# preconditions, the parent pid recorded before the spawn and nothing else
# writing here, are the driver's (drive.mjs) and the operator's.
set -euo pipefail

dir="$(mktemp -d)"
cd "$dir"

git init -q
git config user.name "pstack-anywhere bench"
git config user.email "bench@localhost"

printf 'worker_durability scratch\n' > .bench-scratch
git add .bench-scratch
git commit -q -m "worker_durability preconditions"

rm -f heartbeat.log done.txt

printf '%s\n' "$dir"
