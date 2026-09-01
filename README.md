# pstack-anywhere

**pstack for Claude Code, Codex, pi, OMP, and other agent harnesses.**

[pstack](https://github.com/cursor/plugins/tree/main/pstack) by
[Lauren Tan (@poteto)](https://x.com/poteto) is a pack of skills and principles
for rigorous AI-assisted engineering: 21 principle skills, a `/poteto-mode`
router, and playbooks for stacked PRs and subagent fleets. It ships as a Cursor
plugin and assumes Cursor primitives throughout.

This is a port. Same skills, same mode names, same playbook vocabulary, with the
Cursor-specific parts named and replaced.

## Layout

```
skills/          the pack, one directory per skill, names byte-identical to upstream
harnesses.json   install target, context file, and hook mechanism per harness
UPSTREAM.md      pinned SHA, divergence log, Cursor coupling, open decisions
```

Every harness discovers skills the same way, `<root>/<skill-name>/SKILL.md` one
level deep, so the pack needs no per-harness transform. Skills are
self-contained: `skills/poteto-mode/scripts/` and
`skills/show-me-your-work/scripts/` travel with their skill, so a skill
directory can be copied or linked anywhere on its own.

## Status

Skills copied verbatim at upstream `b9ddc83`. Nothing is installed to a harness
yet, and the Cursor-coupled capabilities still name Cursor. Both are tracked in
`UPSTREAM.md`.

## Credit

MIT, same as upstream. All skill content is Lauren Tan's work unless a file says
otherwise.
