# Claude Code upstream reference

- Repo: https://github.com/anthropics/claude-code
- Ref pinned: f275fa282e76c5e5456912268f2c367a7f4f4797  (gitchamber ref actually used: f275fa282e76c5e5456912268f2c367a7f4f4797)
- Upstream date of pin: 2026-08-31
- CLI version installed when checked: 2.1.234  (npm @anthropic-ai/claude-code)
- Last checked: 2026-08-31

This repository publishes a bundled/minified Claude Code CLI rather than readable runtime implementation source. The saved upstream material is therefore authoring documentation, examples, and JSON configuration examples. It is authoritative evidence for the documented contracts, not a copy of the CLI's internal loader or resolver implementation.

## Refetch

```sh
ref="$(curl -sSf 'https://api.github.com/repos/anthropics/claude-code/commits?per_page=1' | jq -r '.[0].sha')"
base="https://raw.githubusercontent.com/anthropics/claude-code/${ref}"
curl -sSf "$base/plugins/plugin-dev/skills/skill-development/SKILL.md" -o references/harnesses/claude/src/plugins/plugin-dev/skills/skill-development/SKILL.md
curl -sSf "$base/plugins/plugin-dev/skills/plugin-structure/SKILL.md" -o references/harnesses/claude/src/plugins/plugin-dev/skills/plugin-structure/SKILL.md
curl -sSf "$base/plugins/plugin-dev/skills/plugin-structure/references/manifest-reference.md" -o references/harnesses/claude/src/plugins/plugin-dev/skills/plugin-structure/references/manifest-reference.md
curl -sSf "$base/plugins/plugin-dev/skills/hook-development/SKILL.md" -o references/harnesses/claude/src/plugins/plugin-dev/skills/hook-development/SKILL.md
curl -sSf "$base/plugins/plugin-dev/skills/hook-development/scripts/README.md" -o references/harnesses/claude/src/plugins/plugin-dev/skills/hook-development/scripts/README.md
curl -sSf "$base/plugins/plugin-dev/skills/plugin-settings/SKILL.md" -o references/harnesses/claude/src/plugins/plugin-dev/skills/plugin-settings/SKILL.md
curl -sSf "$base/plugins/plugin-dev/skills/agent-development/SKILL.md" -o references/harnesses/claude/src/plugins/plugin-dev/skills/agent-development/SKILL.md
curl -sSf "$base/plugins/plugin-dev/skills/command-development/SKILL.md" -o references/harnesses/claude/src/plugins/plugin-dev/skills/command-development/SKILL.md
curl -sSf "$base/examples/settings/README.md" -o references/harnesses/claude/src/examples/settings/README.md
curl -sSf "$base/plugins/README.md" -o references/harnesses/claude/src/plugins/README.md
curl -sSf "$base/plugins/plugin-dev/README.md" -o references/harnesses/claude/src/plugins/plugin-dev/README.md
curl -sSf "$base/plugins/code-review/commands/code-review.md" -o references/harnesses/claude/src/plugins/code-review/commands/code-review.md
curl -sSf "$base/plugins/security-guidance/hooks/hooks.json" -o references/harnesses/claude/src/plugins/security-guidance/hooks/hooks.json
curl -sSf "$base/plugins/hookify/hooks/hooks.json" -o references/harnesses/claude/src/plugins/hookify/hooks/hooks.json
curl -sSf "$base/examples/settings/settings-strict.json" -o references/harnesses/claude/src/examples/settings/settings-strict.json
curl -sSf "$base/examples/mdm/managed-settings.json" -o references/harnesses/claude/src/examples/mdm/managed-settings.json
curl -sSf "$base/CHANGELOG.md" | sed -n '482,535p' > references/harnesses/claude/src/CHANGELOG.md.L482-L535.md
curl -sSf "$base/CHANGELOG.md" | sed -n '1298,1306p' > references/harnesses/claude/src/CHANGELOG.md.L1298-L1306.md
```

Current head SHA, independently:

```sh
curl -s "https://api.github.com/repos/anthropics/claude-code/commits?per_page=1" | jq -r '.[0].sha'
```

## Saved files

| Local path | Upstream path | Lines saved | What it defines |
|---|---|---:|---|
| `src/plugins/plugin-dev/skills/skill-development/SKILL.md` | `plugins/plugin-dev/skills/skill-development/SKILL.md` | 1-637 | Skill anatomy, required frontmatter, progressive disclosure, and plugin skill discovery. |
| `src/plugins/plugin-dev/skills/plugin-structure/SKILL.md` | `plugins/plugin-dev/skills/plugin-structure/SKILL.md` | 1-476 | Plugin directories, component auto-discovery, command/agent/skill/hook locations, and event names. |
| `src/plugins/plugin-dev/skills/plugin-structure/references/manifest-reference.md` | `plugins/plugin-dev/skills/plugin-structure/references/manifest-reference.md` | 1-552 | `plugin.json` component path fields and default paths, including commands, agents, and hooks. |
| `src/plugins/plugin-dev/skills/hook-development/SKILL.md` | `plugins/plugin-dev/skills/hook-development/SKILL.md` | 1-712 | Hook formats, event list, stdin fields, output contracts, exit codes, environment variables, and script paths. |
| `src/plugins/plugin-dev/skills/hook-development/scripts/README.md` | `plugins/plugin-dev/skills/hook-development/scripts/README.md` | 1-164 | Hook utility scripts, expected hook script layout, validation, and testing workflow. |
| `src/plugins/plugin-dev/skills/plugin-settings/SKILL.md` | `plugins/plugin-dev/skills/plugin-settings/SKILL.md` | 1-544 | `.claude/<plugin>.local.md` project settings pattern and YAML frontmatter examples. |
| `src/plugins/plugin-dev/skills/agent-development/SKILL.md` | `plugins/plugin-dev/skills/agent-development/SKILL.md` | 1-415 | Agent file format, frontmatter fields, and agent prompt contract. |
| `src/plugins/plugin-dev/skills/command-development/SKILL.md` | `plugins/plugin-dev/skills/command-development/SKILL.md` | 1-834 | Project, personal, and plugin command directories, Markdown format, and command frontmatter. |
| `src/examples/settings/README.md` | `examples/settings/README.md` | 1-35 | Settings hierarchy pointers, managed-only setting notes, and settings example guidance. |
| `src/examples/settings/settings-strict.json` | `examples/settings/settings-strict.json` | 1-28 | Concrete managed settings keys including `allowManagedHooksOnly` and permission controls. |
| `src/examples/mdm/managed-settings.json` | `examples/mdm/managed-settings.json` | 1-5 | Minimal managed-settings JSON example. |
| `src/plugins/security-guidance/hooks/hooks.json` | `plugins/security-guidance/hooks/hooks.json` | 1-71 | Real plugin hook wrapper shape, event map, command hooks, matchers, and hook options. |
| `src/plugins/hookify/hooks/hooks.json` | `plugins/hookify/hooks/hooks.json` | 1-49 | Real plugin hook wrapper shape and command hook registrations. |
| `src/plugins/code-review/commands/code-review.md` | `plugins/code-review/commands/code-review.md` | 1-109 | In-repo CLAUDE.md handling example for root and path-parent project guidance. |
| `src/plugins/plugin-dev/README.md` | `plugins/plugin-dev/README.md` | 1-402 | Scope of the plugin-dev material as guidance for the seven authoring capabilities. |
| `src/plugins/README.md` | `plugins/README.md` | 1-77 | Plugin component overview and installation/configuration pointers. |
| `src/CHANGELOG.md.L482-L535.md` | `CHANGELOG.md` | 482-535 | Pinned CLI 2.1.234 release entry and changes affecting settings, skills, hooks, and agents. |
| `src/CHANGELOG.md.L1298-L1306.md` | `CHANGELOG.md` | 1298-1306 | 2.1.203 entries naming `/exit` as the session-ending command (line 1302); the CLI source is not published, so this is the pin's only mention, cited by `harnesses.yaml` `cli.quit_command` |

## Findings

The plugin-dev README describes these files as a toolkit of expert guidance, not the CLI implementation: it lists seven specialized authoring skills and calls out progressive disclosure, references, examples, and utility scripts (`src/plugins/plugin-dev/README.md:1-17`). The saved upstream material consequently documents contracts and examples, but does not expose the bundled CLI's readable discovery or settings-loader implementation (`src/plugins/plugin-dev/README.md:1-17`).

### 1. Skills discovery

Claude Code plugin skills live under the plugin's `skills/` directory, with one subdirectory per skill and a required `SKILL.md`; the documented scanner finds subdirectories containing `SKILL.md`, loads `name` and `description` metadata first, loads the body when the skill triggers, and loads bundled references or examples as needed (`src/plugins/plugin-dev/skills/skill-development/SKILL.md:251-276`). The required frontmatter keys are `name` and `description`, and the documented example also supports `version` (`src/plugins/plugin-dev/skills/skill-development/SKILL.md:27-40`, `src/plugins/plugin-dev/skills/skill-development/SKILL.md:162-170`).

The plugin structure guide separately says skills are discovered from `skills/` subdirectories containing `SKILL.md` and are activated from task context matching the description (`src/plugins/plugin-dev/skills/plugin-structure/SKILL.md:164-198`). It does not state whether the scan is recursive beyond those subdirectories, how duplicate skill names resolve, any provider or priority ordering, or a core enable/disable toggle (`src/plugins/plugin-dev/skills/skill-development/SKILL.md:269-276`). Custom component paths supplement default directories rather than replacing them (`src/plugins/plugin-dev/skills/plugin-structure/SKILL.md:86-106`).

### 2. Hooks

Plugin hooks are documented at `hooks/hooks.json` or inline in `plugin.json` and register when the plugin enables (`src/plugins/plugin-dev/skills/plugin-structure/SKILL.md:200-205`). The plugin-specific file form uses an optional `description` and a required `hooks` wrapper containing the event map (`src/plugins/plugin-dev/skills/hook-development/SKILL.md:60-100`), which is also demonstrated by real `security-guidance` and `hookify` files (`src/plugins/security-guidance/hooks/hooks.json:1-10`, `src/plugins/hookify/hooks/hooks.json:1-10`).

For settings, the hook guide documents a direct top-level event map in `.claude/settings.json`, with no wrapper and no `description` field (`src/plugins/plugin-dev/skills/hook-development/SKILL.md:102-119`). Each event entry contains matcher data and a `hooks` array of hook objects, while command hooks use `type: "command"` and a command string (`src/plugins/plugin-dev/skills/hook-development/SKILL.md:342-381`). Command hooks receive JSON on stdin with `session_id`, `transcript_path`, `cwd`, `permission_mode`, and `hook_event_name`, plus event-specific fields such as `tool_name`, `tool_input`, `tool_result`, `user_prompt`, or `reason` (`src/plugins/plugin-dev/skills/hook-development/SKILL.md:300-320`).

The documented standard output fields are `continue`, `suppressOutput`, and `systemMessage`; exit code 0 shows stdout, exit code 2 feeds stderr back to Claude, and other exit codes are non-blocking (`src/plugins/plugin-dev/skills/hook-development/SKILL.md:278-298`). PreToolUse may return `hookSpecificOutput.permissionDecision` as `allow`, `deny`, or `ask`, plus `updatedInput` and `systemMessage` (`src/plugins/plugin-dev/skills/hook-development/SKILL.md:121-153`). The documented event list is `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Stop`, `SubagentStop`, `SessionStart`, `SessionEnd`, `PreCompact`, and `Notification` (`src/plugins/plugin-dev/skills/hook-development/SKILL.md:630-644`). `SubagentStart` is not present in that documented list, so the local eventsSeen entry is only partially supported by this source.

Hook scripts are expected to be referenced through `${CLAUDE_PLUGIN_ROOT}` and can use `$CLAUDE_PROJECT_DIR`, `$CLAUDE_PLUGIN_ROOT`, `$CLAUDE_ENV_FILE` for SessionStart persistence, and `$CLAUDE_CODE_REMOTE` (`src/plugins/plugin-dev/skills/hook-development/SKILL.md:322-337`). The saved utility guide shows plugin scripts being tested under a plugin's `scripts/` path and hooks being registered from `my-plugin/hooks/hooks.json` (`src/plugins/plugin-dev/skills/hook-development/scripts/README.md:92-127`).

### 3. Config and settings

The settings examples point to the settings hierarchy and say snippets may be applied at any level, while `strictKnownMarketplaces`, `allowManagedHooksOnly`, and `allowManagedPermissionRulesOnly` only take effect in enterprise settings (`src/examples/settings/README.md:1-6`). The concrete strict example contains `allowManagedHooksOnly: true` and `allowManagedPermissionRulesOnly: true` (`src/examples/settings/settings-strict.json:1-14`). The source does not document the user config directory, an environment variable overriding it, or the exact local CLI settings filename beyond examples of `.claude/settings.json` and `settings.local.json` (`src/examples/settings/README.md:23-27`).

### 4. Context file

The repository has no core context-loader implementation or context-file reference in the saved documentation. The closest upstream workflow example asks an agent to gather the root `CLAUDE.md` plus `CLAUDE.md` files in directories containing modified files, and says compliance uses files that share a path or parent with the reviewed file (`src/plugins/code-review/commands/code-review.md:24-34`). This documents ancestor-aware guidance for that code-review workflow, but does not specify the CLI's general loader, a user-scope path, or `CLAUDE.local.md`; no saved source names `CLAUDE.local.md`.

### 5. Subagents and commands/prompts

Plugin agents live in `agents/` and are Markdown files with YAML frontmatter (`src/plugins/plugin-dev/skills/plugin-structure/SKILL.md:136-162`). The documented agent format has `name`, `description`, `model`, `color`, and optional `tools` frontmatter, with the Markdown body becoming the agent's system prompt (`src/plugins/plugin-dev/skills/agent-development/SKILL.md:20-58`, `src/plugins/plugin-dev/skills/agent-development/SKILL.md:60-164`).

Commands are Markdown files. Project commands load from `.claude/commands/`, personal commands from `~/.claude/commands/`, and plugin commands from `plugin-name/commands/` (`src/plugins/plugin-dev/skills/command-development/SKILL.md:54-73`). A command may omit frontmatter, while supported documented fields include `description`, `allowed-tools`, `model`, `argument-hint`, and `disable-model-invocation` (`src/plugins/plugin-dev/skills/command-development/SKILL.md:74-110`, `src/plugins/plugin-dev/skills/command-development/SKILL.md:112-193`).

## harnesses.yaml verification

- `configDir: ~/.claude`: **unverifiable from this repo.** The upstream docs describe plugin-root paths, not the Claude user configuration directory (`src/plugins/plugin-dev/skills/plugin-structure/SKILL.md:20-44`).
- `skillsRoot: ~/.claude/skills`: **unverifiable from this repo.** The saved discovery contract is for a plugin's `skills/` directory and does not specify the user skills root (`src/plugins/plugin-dev/skills/skill-development/SKILL.md:251-276`).
- `contextFile: ~/.claude/CLAUDE.md`: **unverifiable from this repo.** The code-review command refers to a repository root `CLAUDE.md`, but does not define a user-scope context path (`src/plugins/code-review/commands/code-review.md:24-34`).
- `settings: ~/.claude/settings.json`: **unverifiable from this repo.** The settings guide shows project `.claude/settings.json` and `settings.local.json`, not the user-scope path (`src/plugins/plugin-dev/skills/hook-development/SKILL.md:102-119`, `src/examples/settings/README.md:23-27`).
- `hooks.config: ~/.claude/settings.json#hooks`: **contradicted for the documented settings form.** The upstream guide says settings use direct top-level event keys with no `hooks` wrapper, while the `hooks` wrapper is the plugin-specific form (`src/plugins/plugin-dev/skills/hook-development/SKILL.md:60-119`).
- `hooks.form: event map of { matcher, hooks: [{type: "command", command}] }`: **confirmed for the event-entry shape, but scope differs.** The event-entry examples show `matcher` and nested `hooks` objects with `type` and `command` (`src/plugins/plugin-dev/skills/hook-development/SKILL.md:342-381`). The real plugin files confirm the same command object shape (`src/plugins/hookify/hooks/hooks.json:3-12`).
- `hooks.scriptDir: ~/.claude/hooks`: **unverifiable from this repo.** The docs only establish plugin-relative scripts and `${CLAUDE_PLUGIN_ROOT}` (`src/plugins/plugin-dev/skills/hook-development/SKILL.md:322-337`).
- `hooks.eventsSeen: PreToolUse, PreCompact, SessionStart, SubagentStart`: **partially contradicted.** `PreToolUse`, `PreCompact`, and `SessionStart` are in the documented event list, but `SubagentStart` is absent from it (`src/plugins/plugin-dev/skills/hook-development/SKILL.md:630-644`).
- `subagentsDir: ~/.claude/agents`: **unverifiable from this repo.** The docs define plugin `agents/`, not the user-scope directory (`src/plugins/plugin-dev/skills/plugin-structure/SKILL.md:136-162`).
- `commandsDir: ~/.claude/commands`: **confirmed.** The command guide explicitly defines personal commands at `~/.claude/commands/` (`src/plugins/plugin-dev/skills/command-development/SKILL.md:62-66`).
- `projectDir: .claude`: **confirmed for documented project components.** Project commands use `.claude/commands/`, and project plugin settings use `.claude/<plugin>.local.md` (`src/plugins/plugin-dev/skills/command-development/SKILL.md:54-60`, `src/plugins/plugin-dev/skills/plugin-settings/SKILL.md:9-18`).
- Note `Project context is <cwd>/.claude/CLAUDE.md with no ancestor walk-up.` **Contradicted for the documented code-review workflow, otherwise general runtime behavior is unverifiable.** That workflow explicitly gathers root and nested `CLAUDE.md` files and applies parent-path guidance (`src/plugins/code-review/commands/code-review.md:24-34`). It does not mention `CLAUDE.local.md`, so no conclusion about that filename is available from this repo.

## Gaps

The bundled CLI's implementation source is not published here, so the following require runtime inspection or official external CLI documentation: user config directory resolution and override environment variables, user skills root loading, duplicate skill precedence, recursive versus one-level user skill scanning, settings merge precedence, the exact `settings.json#hooks` nesting used by the installed CLI, the user hook script directory, the `SubagentStart` hook contract, the general CLAUDE.md ancestor walk-up algorithm, and any `CLAUDE.local.md` behavior (`src/plugins/plugin-dev/README.md:1-17`). The JSON index contains configuration examples but no formal plugin/settings/hooks JSON Schema file, so the saved JSON files are examples rather than schemas (`src/examples/settings/settings-strict.json:1-28`, `src/plugins/security-guidance/hooks/hooks.json:1-71`).
