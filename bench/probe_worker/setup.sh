#!/usr/bin/env bash
# Preconditions for conformance scenario probe_worker: a clean scratch git repo
# with no probe-activity.log, so every line in that file is the worker's. The
# other precondition, one background worker running, is the first prompt turn's
# job; bench/probe_worker/drive.mjs takes over from there.
set -euo pipefail

dir="$(mktemp -d)"
cd "$dir"

git init -q
git config user.name "pstack-anywhere bench"
git config user.email "bench@localhost"

printf 'probe_worker scratch\n' > .bench-scratch
git add .bench-scratch
git commit -q -m "probe_worker preconditions"

rm -f probe-activity.log probes.yaml cadence.md

printf '%s\n' "$dir"
