# Harness upstream references

Pinned upstream source for each harness this pack installs into, saved so a
future session can answer "what does this harness actually do" without a clone,
and can tell what changed since the last check.

One directory per harness id in `harnesses.yaml`:

```
<id>/MANIFEST.md   pin, refetch block, saved-file table, line-cited findings, field verification, gaps
<id>/src/...       the upstream files themselves, verbatim, upstream paths preserved
```

## Pins

| id | Repo | Ref | Ref date | CLI when checked | Source available |
|---|---|---|---|---|---|
| claude | anthropics/claude-code | `f275fa282e76c5e5456912268f2c367a7f4f4797` | 2026-08-31 | 2.1.234 | docs and example plugins only, CLI ships bundled |
| codex | openai/codex | `e017e93aceafb2fe04bed1c926e448a5fb4f913d` | 2026-09-01 | 0.151.0 | full Rust source |
| pi | earendil-works/pi | `853a80d26c90a14c1886f0ebb8ffaae133ca2185` | 2026-08-28 | 0.84.4 | full TypeScript source |
| omp | can1357/oh-my-pi | `eea5628f13043286e17c4a2ea4fc28b15fda33ca` | 2026-09-01 | 18.0.11 | full TypeScript source |

Last checked 2026-08-31. Total saved 1.1MB.

## What each manifest answers

Skills discovery roots and scan depth, the required `SKILL.md` filename and
frontmatter keys, duplicate-name resolution, hooks or extension mechanism with
its event names, settings file and format, context file discovery including
walk-up, and subagent and command directories. Every claim carries a
`src/<path>:<line>` citation into a file saved next to it.

## Re-checking a harness

```sh
# 1. is the pin stale
curl -s "https://api.github.com/repos/<owner>/<repo>/commits?per_page=1" | jq -r '.[0].sha'

# 2. re-pull at the new sha, using the Refetch block in <id>/MANIFEST.md
#    (set REF at the top of that block first)

# 3. what moved
git diff -- references/harnesses/<id>/src
```

A non-empty diff means re-read the changed region and update the findings, the
field verification, and `harnesses.yaml` if a path or mechanism moved. Then bump
`Ref pinned`, `Upstream date of pin`, and `Last checked` in the manifest, and
`references.lastChecked` plus that harness's `upstream:` block in
`harnesses.yaml`.

## Fetch conventions

Discovery and reading go through GitChamber, which indexes markdown by default
and needs a narrow `?glob=` for source, reused across list, read, and search.
Saving bytes goes through the pinned raw URL instead, because GitChamber source
responses can carry line-number prefixes:

```sh
curl -sSf "https://raw.githubusercontent.com/<owner>/<repo>/<SHA>/<path>" -o <dest>
```

A file saved as `<name>.L<start>-L<end>.<ext>` is a clipped region of a large
upstream file; cited line numbers still refer to the full upstream file. One
Codex file, `codex-rs/ext/skills/src/host_roots.rs`, 404s on the raw CDN and was
fetched through the git blob API, blob
`ac2bf3e9cdf8ccf0c396f011f3dbb8f515db39c7`, verified with `git hash-object`.
