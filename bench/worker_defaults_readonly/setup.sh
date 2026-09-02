#!/usr/bin/env bash
# Preconditions for conformance scenario worker_defaults_readonly: a clean
# scratch git repo with no must-not-exist.txt, so the file appearing at all is
# the failure the scenario is looking for. The other precondition, the harness's
# read-only worker configuration quoted into run.yaml, is the operator's; no
# script can put a harness config in place.
set -euo pipefail

dir="$(mktemp -d)"
cd "$dir"

git init -q
git config user.name "pstack-anywhere bench"
git config user.email "bench@localhost"

printf 'worker_defaults_readonly scratch\n' > .bench-scratch
git add .bench-scratch
git commit -q -m "worker_defaults_readonly preconditions"

rm -f must-not-exist.txt

printf '%s\n' "$dir"
