#!/usr/bin/env bash
# Preconditions for conformance scenario worker_defaults_identity: a clean
# scratch git repo for the agent to write its report files into. The other
# precondition, the poteto-probe definition in the harness's subagent directory,
# is seeded into the scratch HOME by bench/run.mjs from home/<harness>/ next to
# this script, and drive.mjs records where it landed.
set -euo pipefail

dir="$(mktemp -d)"
cd "$dir"

git init -q
git config user.name "pstack-anywhere bench"
git config user.email "bench@localhost"

printf 'worker_defaults_identity scratch\n' > .bench-scratch
git add .bench-scratch
git commit -q -m "worker_defaults_identity preconditions"

printf '%s\n' "$dir"
