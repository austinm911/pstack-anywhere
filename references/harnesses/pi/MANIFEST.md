# pi upstream reference

- Repo: https://github.com/earendil-works/pi
- Ref pinned: 853a80d26c90a14c1886f0ebb8ffaae133ca2185  (gitchamber ref actually used: 853a80d26c90a14c1886f0ebb8ffaae133ca2185)
- Upstream date of pin: 2026-08-28
- CLI version installed when checked: 0.84.4  (npm @earendil-works/pi-coding-agent)
- Last checked: 2026-08-31

## Refetch

```sh
REF=NEW_SHA
BASE="https://raw.githubusercontent.com/earendil-works/pi/$REF"
mkdir -p references/harnesses/pi/src/packages/coding-agent/src/core/extensions references/harnesses/pi/src/packages/coding-agent/src/utils references/harnesses/pi/src/packages/coding-agent/docs
curl -sSf "$BASE/packages/coding-agent/src/core/skills.ts" -o references/harnesses/pi/src/packages/coding-agent/src/core/skills.ts
curl -sSf "$BASE/packages/coding-agent/src/core/resource-loader.ts" | sed -n '1,547p' > references/harnesses/pi/src/packages/coding-agent/src/core/resource-loader.L1-L547.ts
curl -sSf "$BASE/packages/coding-agent/src/config.ts" -o references/harnesses/pi/src/packages/coding-agent/src/config.ts
curl -sSf "$BASE/packages/coding-agent/src/utils/paths.ts" -o references/harnesses/pi/src/packages/coding-agent/src/utils/paths.ts
curl -sSf "$BASE/packages/coding-agent/src/core/settings-manager.ts" | sed -n '1,420p' > references/harnesses/pi/src/packages/coding-agent/src/core/settings-manager.L1-L420.ts
curl -sSf "$BASE/packages/coding-agent/src/core/extensions/loader.ts" -o references/harnesses/pi/src/packages/coding-agent/src/core/extensions/loader.ts
curl -sSf "$BASE/packages/coding-agent/src/core/extensions/types.ts" | sed -n '1,1500p' > references/harnesses/pi/src/packages/coding-agent/src/core/extensions/types.L1-L1500.ts
curl -sSf "$BASE/packages/coding-agent/src/core/prompt-templates.ts" -o references/harnesses/pi/src/packages/coding-agent/src/core/prompt-templates.ts
curl -sSf "$BASE/packages/coding-agent/src/core/package-manager.ts" | sed -n '1,490p' > references/harnesses/pi/src/packages/coding-agent/src/core/package-manager.L1-L490.ts
curl -sSf "$BASE/packages/coding-agent/docs/skills.md" -o references/harnesses/pi/src/packages/coding-agent/docs/skills.md
curl -sSf "https://api.github.com/repos/earendil-works/pi/commits?per_page=1" | jq -r '.[0].sha'
```

## Saved files

| Local path | Upstream path | Lines saved | What it defines |
|---|---|---:|---|
| `src/packages/coding-agent/src/core/skills.ts` | `packages/coding-agent/src/core/skills.ts` | 1-507 | Skill file discovery, frontmatter validation, prompt formatting, and collision handling. |
| `src/packages/coding-agent/src/core/resource-loader.L1-L547.ts` | `packages/coding-agent/src/core/resource-loader.ts` | 1-547 | Context-file discovery and resource reload orchestration. |
| `src/packages/coding-agent/src/config.ts` | `packages/coding-agent/src/config.ts` | 1-575 | `.pi/agent` path computation, settings path, and `PI_CODING_AGENT_DIR` override. |
| `src/packages/coding-agent/src/utils/paths.ts` | `packages/coding-agent/src/utils/paths.ts` | 1-139 | Tilde, relative, `file://`, and canonical path resolution. |
| `src/packages/coding-agent/src/core/settings-manager.L1-L420.ts` | `packages/coding-agent/src/core/settings-manager.ts` | 1-420 | Settings schema, global/project JSON storage paths, parsing, trust gating, and merge behavior. |
| `src/packages/coding-agent/src/core/extensions/loader.ts` | `packages/coding-agent/src/core/extensions/loader.ts` | 1-806 | TypeScript/JavaScript extension loading, discovery roots, entry-point rules, and one-level scan. |
| `src/packages/coding-agent/src/core/extensions/types.L1-L1500.ts` | `packages/coding-agent/src/core/extensions/types.ts` | 1-1500 | Extension handler type, event payload/result contracts, and all `ExtensionAPI.on` events. |
| `src/packages/coding-agent/src/core/prompt-templates.ts` | `packages/coding-agent/src/core/prompt-templates.ts` | 1-285 | Prompt-template format, non-recursive directory scan, argument expansion, and global/project roots. |
| `src/packages/coding-agent/src/core/package-manager.L1-L490.ts` | `packages/coding-agent/src/core/package-manager.ts` | 1-490 | Package resource types, precedence ranks, recursive package skill collection, and `.agents/skills` ancestor computation. |
| `src/packages/coding-agent/docs/skills.md` | `packages/coding-agent/docs/skills.md` | 1-232 | Upstream-documented skill roots, discovery rules, frontmatter fields, and toggles. |

## Findings

### Skills discovery

Pi's documented roots are global `~/.pi/agent/skills/` and `~/.agents/skills/`, trusted project `.pi/skills/`, trusted `.agents/skills/` in `cwd` and ancestors through the Git repository root (or filesystem root outside a repository), package `skills/` directories or `pi.skills` package manifest entries, settings `skills` entries, and repeated CLI `--skill <path>` entries. Explicit CLI paths remain active with `--no-skills`. (`src/packages/coding-agent/docs/skills.md:24-42`)

The implementation treats a directory containing a literal `SKILL.md` as a skill root and stops at that directory. Otherwise it scans direct Markdown files at the root and recursively visits non-hidden subdirectories, skipping `node_modules` and ignored paths. (`src/packages/coding-agent/src/core/skills.ts:160-170`, `src/packages/coding-agent/src/core/skills.ts:191-271`) In package resource discovery, `SKILL.md` is likewise the declared file, `mode: "pi"` permits root Markdown files, and `mode: "agents"` permits only nested Markdown grouping files. (`src/packages/coding-agent/src/core/package-manager.L1-L490.ts:363-445`)

The parsed skill frontmatter has literal keys `name`, `description`, and `disable-model-invocation`, plus an index signature for other fields. `description` is required and non-empty, `name` falls back to the parent directory name, and name validation warns for names over 64 characters, non-lowercase-alphanumeric-hyphen characters, leading/trailing hyphens, or consecutive hyphens. (`src/packages/coding-agent/src/core/skills.ts:67-72`, `src/packages/coding-agent/src/core/skills.ts:92-126`, `src/packages/coding-agent/src/core/skills.ts:277-342`) The documented optional frontmatter keys are `license`, `compatibility`, `metadata`, `allowed-tools`, and `disable-model-invocation`. (`src/packages/coding-agent/docs/skills.md:138-150`)

Duplicate names keep the first loaded skill and emit a collision diagnostic naming the winner and loser. Exact duplicate files reached through symlinks are skipped silently. (`src/packages/coding-agent/src/core/skills.ts:414-447`) Package resources have numeric precedence ranks, lower first: `0` project settings, `1` project auto-discovered, `2` user settings, `3` user auto-discovered, and `4` package resources. (`src/packages/coding-agent/src/core/package-manager.L1-L490.ts:176-192`)

The toggles are literal `--no-skills`, `enableSkillCommands`, and `disable-model-invocation`. `--no-skills` disables default discovery but not explicit `--skill` paths, `enableSkillCommands` controls `/skill:name` registration, and `disable-model-invocation: true` hides a skill from the system prompt while leaving explicit invocation available. (`src/packages/coding-agent/docs/skills.md:42-42`, `src/packages/coding-agent/docs/skills.md:74-90`, `src/packages/coding-agent/src/core/skills.ts:347-356`)

### Hooks

The pinned Pi source does not define a `hooks` settings property or a `hooks/` script directory. Its equivalent lifecycle mechanism is an extension system: configured extension paths are TypeScript or JavaScript module paths, and standard locations are `cwd/${CONFIG_DIR_NAME}/extensions/` and `agentDir/extensions/`. (`src/packages/coding-agent/src/core/settings-manager.L1-L420.ts:94-146`, `src/packages/coding-agent/src/core/extensions/loader.ts:666-719`, `src/packages/coding-agent/src/core/extensions/loader.ts:755-805`)

Extension modules are loaded with jiti, must default-export a factory function, and the factory receives `ExtensionAPI`. Registration calls such as `on`, `registerTool`, and `registerCommand` populate the extension, then registrations commit atomically. (`src/packages/coding-agent/src/core/extensions/loader.ts:490-518`, `src/packages/coding-agent/src/core/extensions/loader.ts:545-563`, `src/packages/coding-agent/src/core/extensions/loader.ts:280-305`)

The generic handler contract is `ExtensionHandler<E, R = undefined> = (event, ctx) => Promise<R | void> | R | void`. `ExtensionAPI.on` exposes these event names: `project_trust`, `resources_discover`, `session_start`, `session_info_changed`, `session_before_switch`, `session_before_fork`, `session_before_compact`, `session_compact`, `session_compact_failed`, `session_shutdown`, `session_before_tree`, `session_tree`, `context`, `before_provider_request`, `before_provider_headers`, `after_provider_response`, `before_agent_start`, `agent_start`, `agent_end`, `agent_settled`, `ui_prompt_start`, `ui_prompt_end`, `turn_start`, `turn_end`, `message_start`, `message_update`, `message_end`, `tool_execution_start`, `tool_execution_update`, `tool_execution_end`, `model_select`, `thinking_level_select`, `tool_call`, `tool_result`, `user_bash`, and `input`. (`src/packages/coding-agent/src/core/extensions/types.L1-L1500.ts:1245-1301`)

Payload and return contracts include `{ trusted: "yes" | "no" | "undecided", remember?: boolean }` for `project_trust`, resource arrays `skillPaths`, `promptPaths`, and `themePaths`, `{ cancel?: boolean }` for session switches, `{ cancel?: boolean, compaction?: CompactionResult }` for compaction, mutable `context.messages`, replaceable provider payloads, mutable provider headers where `null` deletes a header, and `before_agent_start` results containing an injected `message` and/or replacement `systemPrompt`. (`src/packages/coding-agent/src/core/extensions/types.L1-L1500.ts:521-557`, `src/packages/coding-agent/src/core/extensions/types.L1-L1500.ts:579-638`, `src/packages/coding-agent/src/core/extensions/types.L1-L1500.ts:687-727`, `src/packages/coding-agent/src/core/extensions/types.L1-L1500.ts:1119-1189`) Tool hooks expose `tool_call` with mutable `input` and `{ block?, reason?, terminate? }`, while `tool_result` can return partial `content`, `details`, `isError`, and `usage` patches. (`src/packages/coding-agent/src/core/extensions/types.L1-L1500.ts:889-964`, `src/packages/coding-agent/src/core/extensions/types.L1-L1500.ts:1125-1149`)

### Config / settings

The default package config name is `.pi`, and the default app name is `pi`. `getAgentDir()` first checks the environment variable derived as `${APP_NAME.toUpperCase()}_CODING_AGENT_DIR`, which is `PI_CODING_AGENT_DIR` for the default app, then returns `join(homedir(), CONFIG_DIR_NAME, "agent")`. (`src/packages/coding-agent/src/config.ts:496-505`, `src/packages/coding-agent/src/config.ts:519-530`) Tilde expansion uses `os.homedir()` by default and `resolvePath()` handles relative paths, leading `~`, and `file://` URLs. (`src/packages/coding-agent/src/utils/paths.ts:9-20`, `src/packages/coding-agent/src/utils/paths.ts:75-105`)

Global settings are `agentDir/settings.json`; project settings are `cwd/${CONFIG_DIR_NAME}/settings.json`. The settings format is JSON parsed after BOM removal, and project settings are deep-merged over global settings with nested objects merged recursively. (`src/packages/coding-agent/src/core/settings-manager.L1-L420.ts:171-174`, `src/packages/coding-agent/src/core/settings-manager.L1-L420.ts:213-222`, `src/packages/coding-agent/src/core/settings-manager.L1-L420.ts:336-348`, `src/packages/coding-agent/src/core/settings-manager.L1-L420.ts:393-409`) The settings schema includes literal arrays `extensions`, `skills`, `prompts`, and `themes`, plus `packages`, but no `hooks` or `agents` field. (`src/packages/coding-agent/src/core/settings-manager.L1-L420.ts:94-124`)

### Context file

Each searched directory chooses the first existing regular file from this ordered list: `AGENTS.override.md`, `AGENTS.md`, `AGENTS.MD`, `CLAUDE.md`, `CLAUDE.MD`. (`src/packages/coding-agent/src/core/resource-loader.L1-L547.ts:71-90`) The global user scope searches `agentDir` first, then Pi walks upward from `cwd` to the filesystem root, or stops only at the root of the discovered Git repository for project skill discovery. Ancestor files are unshifted so they are returned outermost first, and paths already seen are omitted. (`src/packages/coding-agent/src/core/resource-loader.L1-L547.ts:119-156`, `src/packages/coding-agent/src/core/package-manager.L1-L490.ts:448-480`)

### Subagents and commands/prompts

Prompt templates are Markdown files. The loader derives the command name from the `.md` basename, reads `description` and `argument-hint` frontmatter, falls back to the first non-empty body line truncated to 60 characters for a description, and scans each configured directory non-recursively. (`src/packages/coding-agent/src/core/prompt-templates.ts:104-175`) Default prompt roots are `agentDir/prompts/` and `cwd/${CONFIG_DIR_NAME}/prompts/`, followed by explicit files or directories. (`src/packages/coding-agent/src/core/prompt-templates.ts:177-203`, `src/packages/coding-agent/src/core/prompt-templates.ts:235-263`) Template expansion supports `$1`, `$2`, `$@`, `$ARGUMENTS`, `${N:-default}`, `${@:-default}`, `${@:N}`, and `${@:N:L}`. (`src/packages/coding-agent/src/core/prompt-templates.ts:57-102`)

There is no native subagent loader or `agents/` directory contract in the pinned coding-agent source. The only `agentsFiles` surface is the context-file result returned by `ResourceLoader`, while the settings schema and resource types contain `extensions`, `skills`, `prompts`, and `themes`, not subagents. (`src/packages/coding-agent/src/core/resource-loader.L1-L547.ts:40-50`, `src/packages/coding-agent/src/core/resource-loader.L1-L547.ts:119-156`, `src/packages/coding-agent/src/core/settings-manager.L1-L420.ts:94-124`) Therefore `~/.pi/agent/agents` is not confirmed as a Pi subagent directory. The `prompts` directory is the command/prompt-template directory, but Pi does not expose a separate `commands` loader in this source. (`src/packages/coding-agent/src/core/prompt-templates.ts:188-203`)

### Structural path question

`getAgentDir()` returns `join(homedir(), CONFIG_DIR_NAME, "agent")`, while `CONFIG_DIR_NAME` defaults to the literal `.pi`. This computes `~/.pi/agent`, confirming that Pi's agent state is one level below `~/.pi`, not directly in `~/.pi`. (`src/packages/coding-agent/src/config.ts:496-500`, `src/packages/coding-agent/src/config.ts:523-530`)

## harnesses.yaml verification

`configDir: "~/.pi/agent"` — **confirmed**. `CONFIG_DIR_NAME` defaults to `.pi` and `getAgentDir()` appends the literal `agent`. (`src/packages/coding-agent/src/config.ts:496-500`, `src/packages/coding-agent/src/config.ts:523-530`)

`skillsRoot: "~/.pi/agent/skills"` — **confirmed**. The default agent root is `~/.pi/agent`, and default skill loading joins `agentDir` with the literal `skills`. (`src/packages/coding-agent/src/config.ts:523-530`, `src/packages/coding-agent/src/core/skills.ts:450-453`)

`contextFile: "~/.pi/agent/AGENTS.md"` — **confirmed as a supported default candidate, with precedence caveat**. Pi searches `agentDir` and recognizes `AGENTS.md`, but `AGENTS.override.md` wins when both exist and `AGENTS.MD`, `CLAUDE.md`, or `CLAUDE.MD` are alternatives. (`src/packages/coding-agent/src/core/resource-loader.L1-L547.ts:71-90`, `src/packages/coding-agent/src/core/resource-loader.L1-L547.ts:129-133`)

`settings: "~/.pi/agent/settings.json"` — **confirmed**. `getSettingsPath()` joins the agent directory with the literal `settings.json`, and `FileSettingsStorage` uses the same path for global settings. (`src/packages/coding-agent/src/config.ts:547-549`, `src/packages/coding-agent/src/core/settings-manager.L1-L420.ts:213-222`)

`hooks.config: "~/.pi/agent/settings.json#hooks"` — **contradicted**. The `Settings` interface has no `hooks` property and instead defines `extensions?: string[]`; lifecycle handlers are registered by extension modules through `ExtensionAPI.on`. (`src/packages/coding-agent/src/core/settings-manager.L1-L420.ts:94-124`, `src/packages/coding-agent/src/core/extensions/types.L1-L1500.ts:1245-1301`)

`hooks.form: "array of TS/JS module paths, e.g. [\"~/.pi/agent/hooks/rewind/index.ts\"]"` — **contradicted**. Pi accepts extension paths in `extensions?: string[]`, and its module discovery checks `.ts` and `.js` files under `extensions/`, not a `hooks` array or `hooks/rewind/index.ts`. (`src/packages/coding-agent/src/core/settings-manager.L1-L420.ts:119-124`, `src/packages/coding-agent/src/core/extensions/loader.ts:666-719`, `src/packages/coding-agent/src/core/extensions/loader.ts:779-805`)

`hooks.scriptDir: "~/.pi/agent/hooks"` — **contradicted**. The global auto-discovery directory is `agentDir/extensions/`, which resolves to `~/.pi/agent/extensions/`. (`src/packages/coding-agent/src/core/extensions/loader.ts:755-785`)

`subagentsDir: "~/.pi/agent/agents"` — **contradicted**. The source defines no subagent directory loader or `agents` setting. `agentsFiles` refers to loaded context files, not subagents. (`src/packages/coding-agent/src/core/resource-loader.L1-L547.ts:40-50`, `src/packages/coding-agent/src/core/resource-loader.L1-L547.ts:119-156`, `src/packages/coding-agent/src/core/settings-manager.L1-L420.ts:119-124`)

`commandsDir: "~/.pi/agent/prompts"` — **confirmed for prompt templates, not a separate commands loader**. `loadPromptTemplates()` uses `agentDir/prompts/` as its global root and derives slash-command names from Markdown basenames. (`src/packages/coding-agent/src/core/prompt-templates.ts:104-129`, `src/packages/coding-agent/src/core/prompt-templates.ts:177-203`)

`projectDir: ".pi"` — **confirmed**. `CONFIG_DIR_NAME` defaults to the literal `.pi`, and project skill, prompt, settings, and extension paths join `cwd` with that name. (`src/packages/coding-agent/src/config.ts:496-500`, `src/packages/coding-agent/src/core/skills.ts:450-453`, `src/packages/coding-agent/src/core/prompt-templates.ts:202-204`, `src/packages/coding-agent/src/core/extensions/loader.ts:779-781`)

## Gaps

The pinned source does not expose a native subagent loader, a `hooks` settings key, or a `hooks/` directory convention. Runtime-only behavior such as project-trust prompts and any third-party extension's own subagent implementation would require inspecting that extension or running Pi. The saved clipped files preserve only the cited contiguous ranges: `resource-loader.ts` 1-547, `settings-manager.ts` 1-420, `extensions/types.ts` 1-1500, and `package-manager.ts` 1-490.
