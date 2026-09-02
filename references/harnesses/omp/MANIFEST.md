# Oh My Pi upstream reference

- Repo: https://github.com/can1357/oh-my-pi
- Ref pinned: eea5628f13043286e17c4a2ea4fc28b15fda33ca  (gitchamber ref actually used: eea5628f13043286e17c4a2ea4fc28b15fda33ca)
- Upstream date of pin: unknown (the pinned source/index does not expose commit metadata)
- CLI version installed when checked: 18.0.11  (npm @oh-my-pi/pi-coding-agent)
- Last checked: 2026-08-31

## Refetch

```sh
REF="NEW_SHA"
BASE="https://raw.githubusercontent.com/can1357/oh-my-pi/$REF"
mkdir -p references/harnesses/omp/src/packages/coding-agent/src/{discovery,capability,config,extensibility/hooks,extensibility,autolearn,task} references/harnesses/omp/src/packages/utils/src
curl -sSf "$BASE/packages/coding-agent/src/discovery/helpers.ts" -o references/harnesses/omp/src/packages/coding-agent/src/discovery/helpers.ts
curl -sSf "$BASE/packages/coding-agent/src/discovery/builtin.ts" -o references/harnesses/omp/src/packages/coding-agent/src/discovery/builtin.ts
curl -sSf "$BASE/packages/coding-agent/src/discovery/claude.ts" -o references/harnesses/omp/src/packages/coding-agent/src/discovery/claude.ts
curl -sSf "$BASE/packages/coding-agent/src/discovery/agents.ts" -o references/harnesses/omp/src/packages/coding-agent/src/discovery/agents.ts
curl -sSf "$BASE/packages/coding-agent/src/discovery/codex.ts" -o references/harnesses/omp/src/packages/coding-agent/src/discovery/codex.ts
curl -sSf "$BASE/packages/coding-agent/src/discovery/omp-plugins.ts" -o references/harnesses/omp/src/packages/coding-agent/src/discovery/omp-plugins.ts
curl -sSf "$BASE/packages/coding-agent/src/discovery/agent-plugins.ts" -o references/harnesses/omp/src/packages/coding-agent/src/discovery/agent-plugins.ts
curl -sSf "$BASE/packages/coding-agent/src/discovery/claude-plugins.ts" -o references/harnesses/omp/src/packages/coding-agent/src/discovery/claude-plugins.ts
curl -sSf "$BASE/packages/coding-agent/src/discovery/opencode.ts" -o references/harnesses/omp/src/packages/coding-agent/src/discovery/opencode.ts
curl -sSf "$BASE/packages/coding-agent/src/discovery/github.ts" -o references/harnesses/omp/src/packages/coding-agent/src/discovery/github.ts

curl -sSf "$BASE/packages/coding-agent/src/discovery/omp-extension-roots.ts" -o references/harnesses/omp/src/packages/coding-agent/src/discovery/omp-extension-roots.ts
curl -sSf "$BASE/packages/coding-agent/src/capability/index.ts" -o references/harnesses/omp/src/packages/coding-agent/src/capability/index.ts
curl -sSf "$BASE/packages/coding-agent/src/capability/skill.ts" -o references/harnesses/omp/src/packages/coding-agent/src/capability/skill.ts
curl -sSf "$BASE/packages/coding-agent/src/capability/context-file.ts" -o references/harnesses/omp/src/packages/coding-agent/src/capability/context-file.ts

curl -sSf "$BASE/packages/coding-agent/src/extensibility/skills.ts" -o references/harnesses/omp/src/packages/coding-agent/src/extensibility/skills.ts
curl -sSf "$BASE/packages/coding-agent/src/extensibility/hooks/types.ts" -o references/harnesses/omp/src/packages/coding-agent/src/extensibility/hooks/types.ts
curl -sSf "$BASE/packages/coding-agent/src/extensibility/hooks/loader.ts" -o references/harnesses/omp/src/packages/coding-agent/src/extensibility/hooks/loader.ts
curl -sSf "$BASE/packages/coding-agent/src/extensibility/shared-events.ts" -o references/harnesses/omp/src/packages/coding-agent/src/extensibility/shared-events.ts
curl -sSf "$BASE/packages/coding-agent/src/task/discovery.ts" -o references/harnesses/omp/src/packages/coding-agent/src/task/discovery.ts
curl -sSf "$BASE/packages/coding-agent/src/task/agents.ts" -o references/harnesses/omp/src/packages/coding-agent/src/task/agents.ts
curl -sSf "$BASE/packages/coding-agent/src/autolearn/managed-skills.ts" -o references/harnesses/omp/src/packages/coding-agent/src/autolearn/managed-skills.ts
curl -sSf "$BASE/packages/utils/src/dirs.ts" -o references/harnesses/omp/src/packages/utils/src/dirs.ts
mkdir -p references/harnesses/omp/src/packages/coding-agent/src/slash-commands
curl -sSf "$BASE/packages/coding-agent/src/slash-commands/builtin-control.ts" -o references/harnesses/omp/src/packages/coding-agent/src/slash-commands/builtin-control.ts
```

Current head SHA:

```sh
curl -s "https://api.github.com/repos/can1357/oh-my-pi/commits?per_page=1" | jq -r '.[0].sha'
```

## Saved files

| Local path | Upstream path | Lines saved | What it defines |
|---|---|---:|---|
| `src/packages/coding-agent/src/discovery/helpers.ts` | `packages/coding-agent/src/discovery/helpers.ts` | 1339 | Standard roots, one-level skill scan, generic file scan |
| `src/packages/coding-agent/src/discovery/builtin.ts` | `packages/coding-agent/src/discovery/builtin.ts` | 945 | Native OMP provider, skills, commands, prompts, hooks, settings, context, rules |
| `src/packages/coding-agent/src/discovery/claude.ts` | `packages/coding-agent/src/discovery/claude.ts` | 592 | Claude skills root and priority |
| `src/packages/coding-agent/src/discovery/agents.ts` | `packages/coding-agent/src/discovery/agents.ts` | 339 | `.agent`/`.agents` roots and priority |
| `src/packages/coding-agent/src/discovery/codex.ts` | `packages/coding-agent/src/discovery/codex.ts` | 553 | Codex skills root and priority |
| `src/packages/coding-agent/src/discovery/omp-plugins.ts` | `packages/coding-agent/src/discovery/omp-plugins.ts` | 410 | OMP extension-package sub-discovery and priority |
| `src/packages/coding-agent/src/discovery/agent-plugins.ts` | `packages/coding-agent/src/discovery/agent-plugins.ts` | 341 | Agent Plugins `skills/SKILL.md` scan |
| `src/packages/coding-agent/src/discovery/claude-plugins.ts` | `packages/coding-agent/src/discovery/claude-plugins.ts` | 675 | Claude marketplace plugin skills and priority |
| `src/packages/coding-agent/src/discovery/opencode.ts` | `packages/coding-agent/src/discovery/opencode.ts` | 538 | OpenCode skills root and priority |
| `src/packages/coding-agent/src/discovery/github.ts` | `packages/coding-agent/src/discovery/github.ts` | 337 | GitHub Copilot skills root and priority |

| `src/packages/coding-agent/src/discovery/omp-extension-roots.ts` | `packages/coding-agent/src/discovery/omp-extension-roots.ts` | 384 | `config.yml#extensions` and extension-root precedence |
| `src/packages/coding-agent/src/capability/index.ts` | `packages/coding-agent/src/capability/index.ts` | 468 | Provider ordering and first-match capability dedup |
| `src/packages/coding-agent/src/capability/skill.ts` | `packages/coding-agent/src/capability/skill.ts` | 69 | Skill frontmatter/type fields |
| `src/packages/coding-agent/src/capability/context-file.ts` | `packages/coding-agent/src/capability/context-file.ts` | 44 | Context-file scope and depth key |

| `src/packages/coding-agent/src/extensibility/skills.ts` | `packages/coding-agent/src/extensibility/skills.ts` | 542 | Skill toggles, realpath collapse, collision behavior |
| `src/packages/coding-agent/src/extensibility/hooks/types.ts` | `packages/coding-agent/src/extensibility/hooks/types.ts` | 607 | `HookAPI`, factory, event names and handler return types |
| `src/packages/coding-agent/src/extensibility/hooks/loader.ts` | `packages/coding-agent/src/extensibility/hooks/loader.ts` | 243 | Default export loading and configured/discovered hook paths |
| `src/packages/coding-agent/src/extensibility/shared-events.ts` | `packages/coding-agent/src/extensibility/shared-events.ts` | 417 | Hook event payloads and result contracts |
| `src/packages/coding-agent/src/task/discovery.ts` | `packages/coding-agent/src/task/discovery.ts` | 146 | `.omp/agents` loader, precedence, Markdown format |
| `src/packages/coding-agent/src/task/agents.ts` | `packages/coding-agent/src/task/agents.ts` | 171 | Task-agent frontmatter parser and fields |
| `src/packages/coding-agent/src/autolearn/managed-skills.ts` | `packages/coding-agent/src/autolearn/managed-skills.ts` | 255 | `omp-managed` provider and managed root |
| `src/packages/utils/src/dirs.ts` | `packages/utils/src/dirs.ts` | 1114 | `.omp`, config filename, `PI_CONFIG_DIR`, agent-dir overrides |
| `src/packages/coding-agent/src/slash-commands/builtin-control.ts` | `packages/coding-agent/src/slash-commands/builtin-control.ts` | 82 | Built-in control slash commands; `quit` (alias `q`) is the TUI shutdown, cited by `harnesses.yaml` `cli.quit_command` |

## Findings

**Skills discovery and frontmatter.** The native provider walks every ancestor from `cwd` through `repoRoot` for `.omp/skills/`, then scans user `~/.omp/agent/skills/`, with `requireDescription: true` for both paths (`src/packages/coding-agent/src/discovery/builtin.ts:281-300`). Claude scans `~/.claude/skills` and ancestor `.claude/skills` (`src/packages/coding-agent/src/discovery/claude.ts:169-195`), and Codex scans `~/.codex/skills` plus project `.codex/skills` (`src/packages/coding-agent/src/discovery/codex.ts:236-251`). The shared Agent Dirs provider scans both `~/.agent/skills` and `~/.agents/skills`, plus both names at each project ancestor (`src/packages/coding-agent/src/discovery/agents.ts:138-179`). OpenCode and GitHub add their documented roots at `~/.config/opencode/skills`/`.opencode/skills` and `.github/skills` (`src/packages/coding-agent/src/discovery/opencode.ts:343-368`, `src/packages/coding-agent/src/discovery/github.ts:273-291`).

**Skill scan depth and filename.** `scanSkillsFromDir` uses `readdir`, accepts immediate child directories or symlinks, and only loads `<dir>/<name>/SKILL.md`; hidden children are skipped (`src/packages/coding-agent/src/discovery/helpers.ts:377-435`). Its optional `includeSelf` loads a direct `<dir>/SKILL.md`, but the native, Claude, Codex, and Agent Dirs calls do not set it (`src/packages/coding-agent/src/discovery/helpers.ts:351-365`, `src/packages/coding-agent/src/discovery/builtin.ts:285-291`). Generic parsing accepts optional `name`, `description`, `globs`, `alwaysApply`, `hide`, `disableModelInvocation`, and arbitrary extra keys, with `enabled: false` suppressing a skill (`src/packages/coding-agent/src/capability/skill.ts:10-32`, `src/packages/coding-agent/src/discovery/helpers.ts:394-415`). Native and OMP extension-package scans require a non-empty `description` (`src/packages/coding-agent/src/discovery/builtin.ts:286-291`, `src/packages/coding-agent/src/discovery/omp-plugins.ts:65-74`). Agent Plugins scan only immediate child directories whose regular `SKILL.md` is present, and validate those files through the Agent Skills validator (`src/packages/coding-agent/src/discovery/agent-plugins.ts:96-105`, `src/packages/coding-agent/src/discovery/agent-plugins.ts:168-175`).


**Provider priorities and duplicate names.** The literal skill-provider priorities are native `100` (`src/packages/coding-agent/src/discovery/builtin.ts:39-42`), OMP extension packages `90` (`src/packages/coding-agent/src/discovery/omp-plugins.ts:43-47`), Claude `80` (`src/packages/coding-agent/src/discovery/claude.ts:33-36`), Agent Dirs `70` (`src/packages/coding-agent/src/discovery/agents.ts:26-29`), Claude marketplace `70` (`src/packages/coding-agent/src/discovery/claude-plugins.ts:32-34`), Codex `70` (`src/packages/coding-agent/src/discovery/codex.ts:41-43`), OpenCode `55` (`src/packages/coding-agent/src/discovery/opencode.ts:43-46`), GitHub `30` (`src/packages/coding-agent/src/discovery/github.ts:40-42`), and managed `5` (`src/packages/coding-agent/src/discovery/builtin.ts:309-335`, `src/packages/coding-agent/src/autolearn/managed-skills.ts:16-26`). The Agent Plugins provider is an additional priority `75`, not present in the harnesses.json table (`src/packages/coding-agent/src/discovery/agent-plugins.ts:37-41`). Provider registration inserts higher priorities first (`src/packages/coding-agent/src/capability/index.ts:84-91`), and capability dedup iterates that order, treating the first key as the winner and marking later items `_shadowed` without adding a duplicate-name warning (`src/packages/coding-agent/src/capability/index.ts:183-210`). The final skill loader independently filters repeated authored names in first-seen order (`src/packages/coding-agent/src/extensibility/skills.ts:210-223`).

**Realpath collapse.** After name filtering, OMP resolves every skill path with `fs.realpath`, keeps a `realPathSet`, and silently skips a path already seen, explicitly covering symlink aliases (`src/packages/coding-agent/src/extensibility/skills.ts:225-244`). A different-file custom-directory name collision does create a warning naming the existing file (`src/packages/coding-agent/src/extensibility/skills.ts:246-264`). Thus ordinary provider duplicate names are silent first-wins, while custom-directory collisions can be warned; identical files reached through symlinks are silently collapsed before that warning (`src/packages/coding-agent/src/extensibility/skills.ts:241-251`).

**Toggles.** `loadSkills` exposes `enableCodexUser`, `enableClaudeUser`, `enableClaudeProject`, `enablePiUser`, `enablePiProject`, `enableAgentsUser`, and `enableAgentsProject`, all defaulting to `true` (`src/packages/coding-agent/src/extensibility/skills.ts:135-151`). The source maps `enablePi*` to the native OMP provider, `enableAgents*` to the `.agent`/`.agents` provider, and the Claude/Codex flags to their named providers (`src/packages/coding-agent/src/extensibility/skills.ts:168-181`). Other third-party providers fall through the named third-party toggle gate, while managed skills remain enabled unless the master `enabled` flag is false (`src/packages/coding-agent/src/extensibility/skills.ts:153-181`).

**Extensions and hooks.** The configured extension-package array is the `extensions` key in YAML `config.yml`: project `.omp/config.yml` is checked first, then project legacy `settings.json`, user `config.yml`/`config.yaml`, and user legacy `settings.json`, with array-replacement precedence (`src/packages/coding-agent/src/discovery/omp-extension-roots.ts:179-233`). Extension packages expose `skills/`, `hooks/`, `tools/`, `commands/`, `rules/`, `prompts/`, and `.mcp.json` (`src/packages/coding-agent/src/discovery/omp-extension-roots.ts:4-8`). Native hooks are discovered under each config directory's `hooks/pre` and `hooks/post`, where each non-hidden regular file becomes a `pre` or `post` hook and its basename before the final extension is the tool (`src/packages/coding-agent/src/discovery/builtin.ts:671-719`). The runtime imports each hook with Bun, requires `module.default` to be a function, and calls that factory with the API (`src/packages/coding-agent/src/extensibility/hooks/loader.ts:143-182`). `HookFactory` is `(pi: HookAPI) => void` (`src/packages/coding-agent/src/extensibility/hooks/types.ts:590-594`), and the API's implementation appends handlers in `pi.on(event, handler)` while exposing `sendMessage`, `appendEntry`, renderers, commands, `exec`, logger, schema shims, and `pi` (`src/packages/coding-agent/src/extensibility/hooks/loader.ts:72-140`).

**Hook events and returns.** The complete typed `pi.on` event list is `session_start`, `session_before_switch`, `session_switch`, `session_before_branch`, `session_branch`, `session_before_compact`, `session.compacting`, `session_compact`, `session_shutdown`, `session_before_tree`, `session_tree`, `context`, `before_agent_start`, `agent_start`, `agent_end`, `turn_start`, `turn_end`, `auto_compaction_start`, `auto_compaction_end`, `auto_retry_start`, `auto_retry_end`, `ttsr_triggered`, `todo_reminder`, `tool_call`, and `tool_result` (`src/packages/coding-agent/src/extensibility/hooks/types.ts:476-507`). Handlers receive `(event, ctx)` and may return a synchronous or asynchronous result, `undefined`, or `void` (`src/packages/coding-agent/src/extensibility/hooks/types.ts:438-442`). `context` may return replacement `messages`, `before_agent_start` may return a persisted/displayed `message`, `tool_call` may return `block`, `reason`, or replacement `input`, and `tool_result` may return replacement `content`, `details`, or `isError` (`src/packages/coding-agent/src/extensibility/hooks/types.ts:406-423`, `src/packages/coding-agent/src/extensibility/shared-events.ts:306-345`). Before-session events return cancellation/customization objects, including `cancel` for switch, branch, compact, and tree, `compaction` for pre-compact, and `context`/`prompt`/`preserveData` for `session.compacting` (`src/packages/coding-agent/src/extensibility/shared-events.ts:347-417`).

**Config and environment.** The config root is `.omp` by default, overridable by `PI_CONFIG_DIR`, and the agent directory is `~/.omp/agent` by default, overridable by `PI_CODING_AGENT_DIR` (`src/packages/utils/src/dirs.ts:1-5`, `src/packages/utils/src/dirs.ts:280-288`, `src/packages/utils/src/dirs.ts:567-570`). Main config filenames are `config.yml` then `config.yaml` (`src/packages/utils/src/dirs.ts:23-27`). OMP's settings discovery reads `settings.json` and YAML `config.yml` from each config directory, parsing YAML as a settings object (`src/packages/coding-agent/src/discovery/builtin.ts:846-894`). Native hooks, commands, and prompts derive their user and project paths from those config directories (`src/packages/coding-agent/src/discovery/builtin.ts:339-358`, `src/packages/coding-agent/src/discovery/builtin.ts:429-449`, `src/packages/coding-agent/src/discovery/builtin.ts:675-704`).


**Context and rules.** Native context loads `~/.omp/agent/AGENTS.md` when non-empty and then checks the nearest non-empty `.omp` directory walking from `cwd` to `repoRoot` for `AGENTS.md` (`src/packages/coding-agent/src/discovery/builtin.ts:905-936`, `src/packages/coding-agent/src/discovery/builtin.ts:90-98`). Native sticky rules are only top-level `~/.omp/agent/RULES.md` and the nearest project `.omp/RULES.md`; each is forced to `alwaysApply: true` and named `RULES` or `RULES@project` (`src/packages/coding-agent/src/discovery/builtin.ts:387-418`).

**Subagents, commands, and prompts.** OMP task agents load Markdown files matching `*.md` from user `~/.omp/agent/agents` and project `.omp/agents`, parse YAML frontmatter, and choose the first agent name by precedence project, user, extension packages, installed plugins, Claude marketplace, then bundled (`src/packages/coding-agent/src/task/discovery.ts:4-18`, `src/packages/coding-agent/src/task/discovery.ts:41-67`, `src/packages/coding-agent/src/task/discovery.ts:93-138`). The parser requires `name` and `description`; optional fields include `tools`, `spawns`, `model`, `thinkingLevel`, `blocking`, `prewalk`, and `advisor` (`src/packages/coding-agent/src/task/agents.ts:21-30`, `src/packages/coding-agent/src/task/agents.ts:106-125`). Native slash commands load non-recursive `*.md` from each config directory's `commands` subdirectory, and prompts load non-recursive `*.md` from each `prompts` subdirectory (`src/packages/coding-agent/src/discovery/builtin.ts:339-358`, `src/packages/coding-agent/src/discovery/builtin.ts:429-449`, `src/packages/coding-agent/src/discovery/helpers.ts:477-505`).

## harnesses.yaml verification

- `id: "omp"`, `name: "Oh My Pi"`: `confirmed` by the native provider identity `PROVIDER_ID = "native"`, display name `"OMP"`, and the pinned repository/package metadata; the exact marketing name is not repeated in implementation (`src/packages/coding-agent/src/discovery/builtin.ts:39-42`).
- `configDir: "~/.omp/agent"`: `confirmed`, `getAgentDir()` is documented as `~/.omp/agent` and the default root is `.omp` (`src/packages/utils/src/dirs.ts:23-27`, `src/packages/utils/src/dirs.ts:567-570`). `PI_CONFIG_DIR` and `PI_CODING_AGENT_DIR` can change the effective paths (`src/packages/utils/src/dirs.ts:1-5`, `src/packages/utils/src/dirs.ts:280-288`).
- `skillsRoot: "~/.agents/skills"`: `confirmed`, the Agent Dirs provider constructs both `~/.agent/skills` and `~/.agents/skills` (`src/packages/coding-agent/src/discovery/agents.ts:138-179`).
- `contextFile: "~/.omp/agent/AGENTS.md"`: `confirmed`, native context joins `getAgentDir()` with `AGENTS.md` (`src/packages/coding-agent/src/discovery/builtin.ts:905-918`).
- `settings: "~/.omp/agent/config.yml"`: `confirmed` for the default agent directory, native settings joins each config directory with literal `config.yml` and parses it as YAML (`src/packages/coding-agent/src/discovery/builtin.ts:879-894`).
- `hooks.config: "~/.omp/agent/config.yml#extensions"`: `confirmed` as the extension-root setting, because persisted YAML reads the `extensions` key from user `config.yml`/`config.yaml` and project `.omp/config.yml` (`src/packages/coding-agent/src/discovery/omp-extension-roots.ts:179-233`). Hook files themselves are discovered separately under `hooks/pre` and `hooks/post` (`src/packages/coding-agent/src/discovery/builtin.ts:675-719`).
- `hooks.form: "default-exported TS factory taking HookAPI, registering pi.on(event, handler)"`: `confirmed`, the loader requires a default function and invokes it with `HookAPI`, whose overloads are `pi.on(event, handler)` (`src/packages/coding-agent/src/extensibility/hooks/loader.ts:146-167`, `src/packages/coding-agent/src/extensibility/hooks/types.ts:472-507`, `src/packages/coding-agent/src/extensibility/hooks/types.ts:590-594`).
- `hooks.scriptDir: ".omp/hooks/pre"`: `confirmed` for project scope, with the matching user directory `~/.omp/agent/hooks/pre` and sibling `post` directory (`src/packages/coding-agent/src/discovery/builtin.ts:675-704`).

- `subagentsDir: "~/.omp/agent/agents"`: `confirmed`, task discovery filters the user config entry to source `.omp` and loads its `.md` files (`src/packages/coding-agent/src/task/discovery.ts:79-97`, `src/packages/coding-agent/src/task/discovery.ts:43-59`).
- `commandsDir: null`: `contradicted`, OMP has native command directories at `~/.omp/agent/commands` and `.omp/commands`, loading non-recursive Markdown commands (`src/packages/coding-agent/src/discovery/builtin.ts:339-358`, `src/packages/coding-agent/src/discovery/helpers.ts:477-505`).

- `projectDir: ".omp"`: `confirmed`, native `SOURCE_PATHS` uses `CONFIG_DIR_NAME` for project paths and native scans ancestor `.omp/skills` (`src/packages/coding-agent/src/discovery/helpers.ts:31-40`, `src/packages/coding-agent/src/discovery/builtin.ts:281-288`).
- `readsOtherRoots[0]: "~/.omp/agent/skills"`: `confirmed`, native user skill scan uses `getAgentDir()/skills` (`src/packages/coding-agent/src/discovery/builtin.ts:294-300`).
- `readsOtherRoots[1]: "~/.claude/skills"`: `confirmed`, Claude's user skill path is its active config directory plus `skills` and the provider description names `.claude/skills/*/SKILL.md` (`src/packages/coding-agent/src/discovery/claude.ts:169-195`, `src/packages/coding-agent/src/discovery/claude.ts:539-544`).
- `readsOtherRoots[2]: "~/.codex/skills"`: `confirmed`, Codex joins its user base `.codex` with `skills` (`src/packages/coding-agent/src/discovery/codex.ts:236-246`).
- `readsOtherRoots[3]: "~/.pi/agent/skills"`: `contradicted`, no Pi provider or `.pi` source path exists in the saved discovery implementation; the native provider uses OMP's `getConfigDirName()` and `getAgentDir()` instead (`src/packages/coding-agent/src/discovery/helpers.ts:31-50`, `src/packages/coding-agent/src/discovery/builtin.ts:294-300`).
- `readsOtherRoots[4]: "~/.agent/skills"`: `confirmed`, Agent Dirs explicitly maps `.agent` under each user home (`src/packages/coding-agent/src/discovery/agents.ts:26-29`, `src/packages/coding-agent/src/discovery/agents.ts:138-142`).
- `readsOtherRoots[5]: "~/.agents/skills"`: `confirmed`, Agent Dirs explicitly maps `.agents` under each user home (`src/packages/coding-agent/src/discovery/agents.ts:26-29`, `src/packages/coding-agent/src/discovery/agents.ts:138-142`).
- `providerPriority.native = 100`: `confirmed` (`src/packages/coding-agent/src/discovery/builtin.ts:39-42`).
- `providerPriority.omp-plugins = 90`: `confirmed` (`src/packages/coding-agent/src/discovery/omp-plugins.ts:43-47`).
- `providerPriority.claude = 80`: `confirmed` (`src/packages/coding-agent/src/discovery/claude.ts:33-36`).
- `providerPriority.agents = 70`: `confirmed` (`src/packages/coding-agent/src/discovery/agents.ts:26-29`).
- `providerPriority.claude-plugins = 70`: `confirmed` (`src/packages/coding-agent/src/discovery/claude-plugins.ts:32-34`).
- `providerPriority.codex = 70`: `confirmed` (`src/packages/coding-agent/src/discovery/codex.ts:41-43`).
- `providerPriority.opencode = 55`: `confirmed` (`src/packages/coding-agent/src/discovery/opencode.ts:43-46`).
- `providerPriority.github = 30`: `confirmed` (`src/packages/coding-agent/src/discovery/github.ts:40-42`).
- `providerPriority.omp-managed = 5`: `confirmed`, the provider ID is literal `"omp-managed"` and the priority is `5` (`src/packages/coding-agent/src/autolearn/managed-skills.ts:16-26`, `src/packages/coding-agent/src/discovery/builtin.ts:331-336`).
- `notes[0]` claiming OMP is a complete union: `contradicted`, OMP unions the listed native, Claude, Codex, Agent Dirs, OpenCode, and GitHub roots, but does not scan `~/.pi/agent/skills` (`src/packages/coding-agent/src/discovery/helpers.ts:31-84`, `src/packages/coding-agent/src/discovery/claude.ts:169-195`, `src/packages/coding-agent/src/discovery/codex.ts:236-251`, `src/packages/coding-agent/src/discovery/agents.ts:138-179`).
- `notes[1]` claiming `.agent[s]/skills` is controlled by independent `enableAgentsUser`: `confirmed`, `enableAgentsUser` and `enableAgentsProject` have dedicated branches independent of Claude/Codex/native toggles (`src/packages/coding-agent/src/extensibility/skills.ts:135-181`).
- `notes[2]` claiming first-match priority plus realpath collapse: `confirmed` for the source mechanics, with one qualification: different-file custom-directory name collisions add a warning, while provider duplicates and same-realpath symlinks are silent (`src/packages/coding-agent/src/capability/index.ts:183-210`, `src/packages/coding-agent/src/extensibility/skills.ts:225-264`).
- `notes[3]` claiming sticky rules only from user `RULES.md` or nearest non-empty project `.omp/RULES.md`: `confirmed`, including forced `alwaysApply` behavior (`src/packages/coding-agent/src/discovery/builtin.ts:387-418`).

## Gaps

The pinned source does not expose the commit date, so the manifest records that metadata as unknown rather than inventing it. Runtime inspection would still be needed to verify the active profile path when `OMP_PROFILE`/`PI_PROFILE` or `PI_CODING_AGENT_DIR` is set, whether a particular installed plugin is enabled, and the effective merged settings after overlays. The source also shows that `~/.pi/agent/skills` is not a discovered root, so the “every other harness” description and the `commandsDir: null` metadata need correction in the parent manifest if those fields are intended literally.

## Install-model implications

The one-canonical-store plus per-skill symlink model holds for OMP's dedup behavior: OMP resolves each discovered skill with `fs.realpath` and silently skips a second path resolving to the same file (`src/packages/coding-agent/src/extensibility/skills.ts:225-244`). A symlink from one root to a canonical `SKILL.md` therefore collapses to one loaded file while preserving one winning skill name. Copies would have different realpaths, so they would not collapse and would instead rely on provider/name first-wins behavior, potentially producing duplicate scanning work and a warning for custom-directory collisions (`src/packages/coding-agent/src/capability/index.ts:183-210`, `src/packages/coding-agent/src/extensibility/skills.ts:246-264`). The model does not make OMP discover the absent `~/.pi/agent/skills` root, so a canonical store linked only into that Pi path remains invisible to OMP (`src/packages/coding-agent/src/discovery/helpers.ts:31-50`, `src/packages/coding-agent/src/discovery/builtin.ts:294-300`).
