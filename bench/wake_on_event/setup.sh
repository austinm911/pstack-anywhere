#!/usr/bin/env bash
# Preconditions for conformance scenario wake_on_event: a clean scratch git
# repo with no event.flag, so the file appearing is the only event the wait can
# wake on and the driver alone decides when it appears. The other precondition,
# turn and token accounting before and after the wait, is read by the driver
# from herdr's agent state and the harness's session log under the scratch HOME.
set -euo pipefail

dir="$(mktemp -d)"
cd "$dir"

git init -q
git config user.name "pstack-anywhere bench"
git config user.email "bench@localhost"

printf 'wake_on_event scratch\n' > .bench-scratch
git add .bench-scratch
git commit -q -m "wake_on_event preconditions"

rm -f event.flag

printf '%s\n' "$dir"
