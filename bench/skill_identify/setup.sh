#!/usr/bin/env bash
# Preconditions for conformance scenario skill_identify: a clean scratch git
# repo. The poteto-mode skill is installed by bench/run.mjs --skill, not here.
set -euo pipefail

dir="$(mktemp -d)"
cd "$dir"

git init -q
git config user.name "pstack-anywhere bench"
git config user.email "bench@localhost"

git commit -q --allow-empty -m "skill_identify preconditions"

printf '%s\n' "$dir"
