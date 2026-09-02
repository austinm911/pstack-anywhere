#!/usr/bin/env bash
# Preconditions for conformance scenario human_question: a clean scratch git
# repo holding none of the option files, so a file appearing is the agent's
# answer to the operator and nothing else. The three workers of the flood trial
# are spawned by the agent from the turn-2 prompt in drive.mjs, not here.
set -euo pipefail

dir="$(mktemp -d)"
cd "$dir"

git init -q
git config user.name "pstack-anywhere bench"
git config user.email "bench@localhost"

printf 'human_question scratch\n' > .bench-scratch
git add .bench-scratch
git commit -q -m "human_question preconditions"

rm -f alpha.txt beta.txt gamma.txt delta.txt epsilon.txt zeta.txt eta.txt theta.txt iota.txt
rm -f answer-received.txt worker-one.txt worker-two.txt worker-three.txt

printf '%s\n' "$dir"
