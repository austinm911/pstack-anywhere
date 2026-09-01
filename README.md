# pstack-anywhere

**pstack for Codex, Claude Code, OMP, pi, and other agent harnesses.**

[pstack](https://github.com/cursor/plugins/tree/main/pstack) by
[Lauren Tan (@poteto)](https://x.com/poteto) is a pack of skills and principles
for rigorous AI-assisted engineering: 21 principle skills, a `/poteto-mode`
router, and playbooks for stacked PRs and subagent fleets. It ships as a Cursor
plugin and assumes Cursor primitives throughout.

This is a port. Same skills, same mode names, same playbook vocabulary, with the
Cursor-specific parts moved behind a capability shim so one adapter file adds a
harness.

## pstack for Codex? pstack for Claude Code?

Yes, that is what this repo is. See `adapters/`.

## Layout

```
skills/     canonical pack, skill names byte-identical to upstream
shims/      the four capabilities that carry the Cursor coupling
adapters/   claude/ codex/ pi/ omp/ — per-harness placement + shim impls
scripts/    orch + watch-pr, harness-neutral bun/TypeScript
docs/       upstream guide, mirrored
UPSTREAM.md pinned SHA, divergence log, coupling map
```

## Status

Scaffold. Skills copied verbatim at upstream `b9ddc83`. Shim contracts and the
Claude adapter are the next step; nothing is projected to a harness yet.

## Credit

MIT, same as upstream. All skill content is Lauren Tan's work unless a file says
otherwise. Divergence is tracked in `UPSTREAM.md`.
