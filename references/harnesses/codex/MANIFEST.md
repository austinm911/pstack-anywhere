# Codex upstream reference

- Repo: https://github.com/openai/codex
- Ref pinned: e017e93aceafb2fe04bed1c926e448a5fb4f913d  (gitchamber ref actually used: e017e93aceafb2fe04bed1c926e448a5fb4f913d)
- Upstream date of pin: 2026-09-01
- CLI version installed when checked: 0.151.0  (npm @openai/codex)
- Last checked: 2026-08-31

## Refetch

```sh
REF="e017e93aceafb2fe04bed1c926e448a5fb4f913d"
BASE="https://raw.githubusercontent.com/openai/codex/$REF"
mkdir -p references/harnesses/codex/src/codex-rs/{core/src,core/src/tools/handlers,config/src/loader,config/src,hooks/src/engine,hooks/src/events,protocol/src,skills/src,ext/skills/src/loader,ext/skills/src,utils/home-dir/src,tui/src}
curl -sSf "$BASE/codex-rs/core/src/agents_md.rs" -o references/harnesses/codex/src/codex-rs/core/src/agents_md.rs
curl -sSf "$BASE/codex-rs/core/src/tools/handlers/request_user_input.rs" -o references/harnesses/codex/src/codex-rs/core/src/tools/handlers/request_user_input.rs
curl -sSf "$BASE/codex-rs/core/src/tools/handlers/request_user_input_spec.rs" -o references/harnesses/codex/src/codex-rs/core/src/tools/handlers/request_user_input_spec.rs
curl -sSf "$BASE/codex-rs/config/src/hook_config.rs" -o references/harnesses/codex/src/codex-rs/config/src/hook_config.rs
curl -sSf "$BASE/codex-rs/config/src/lib.rs" -o references/harnesses/codex/src/codex-rs/config/src/lib.rs
curl -sSf "$BASE/codex-rs/config/src/loader/mod.rs" | sed -n '94,646p' > references/harnesses/codex/src/codex-rs/config/src/loader/mod.rs.L94-L646.rs
curl -sSf "$BASE/codex-rs/tui/src/slash_command.rs" -o references/harnesses/codex/src/codex-rs/tui/src/slash_command.rs
curl -sSf "$BASE/codex-rs/ext/skills/src/loader/discovery.rs" -o references/harnesses/codex/src/codex-rs/ext/skills/src/loader/discovery.rs
curl -sSf "$BASE/codex-rs/ext/skills/src/loader/environment.rs" -o references/harnesses/codex/src/codex-rs/ext/skills/src/loader/environment.rs
curl -sSf "$BASE/codex-rs/ext/skills/src/loader/mod.rs" -o references/harnesses/codex/src/codex-rs/ext/skills/src/loader/mod.rs
curl -sSf "$BASE/codex-rs/ext/skills/src/loader/host_merge.rs" -o references/harnesses/codex/src/codex-rs/ext/skills/src/loader/host_merge.rs
curl -sSf "$BASE/codex-rs/hooks/src/events/common.rs" -o references/harnesses/codex/src/codex-rs/hooks/src/events/common.rs
curl -sSf "$BASE/codex-rs/utils/home-dir/src/lib.rs" -o references/harnesses/codex/src/codex-rs/utils/home-dir/src/lib.rs
curl -sSf "$BASE/codex-rs/protocol/src/protocol.rs" | sed -n '1570,1585p' > references/harnesses/codex/src/codex-rs/protocol/src/protocol.rs.L1570-L1585.rs
curl -sSf "$BASE/codex-rs/hooks/src/schema.rs" -o references/harnesses/codex/src/codex-rs/hooks/src/schema.rs
curl -sSf "$BASE/codex-rs/hooks/src/events/pre_tool_use.rs" -o references/harnesses/codex/src/codex-rs/hooks/src/events/pre_tool_use.rs
curl -sSf "$BASE/codex-rs/hooks/src/engine/discovery.rs" | sed -n '93,399p' > references/harnesses/codex/src/codex-rs/hooks/src/engine/discovery.rs.L93-L399.rs
curl -sSf "$BASE/codex-rs/hooks/src/engine/discovery.rs" | sed -n '634,653p' > references/harnesses/codex/src/codex-rs/hooks/src/engine/discovery.rs.L634-L653.rs
curl -sSf "$BASE/codex-rs/skills/src/parser.rs" -o references/harnesses/codex/src/codex-rs/skills/src/parser.rs
# host_roots.rs is read by blob SHA because the raw CDN returns 404 for this valid tree path.
BLOB=$(curl -sSf "https://api.github.com/repos/openai/codex/git/trees/$REF?recursive=1" | jq -r '.tree[] | select(.path=="codex-rs/ext/skills/src/host_roots.rs") | .sha')
curl -sSf "https://api.github.com/repos/openai/codex/git/blobs/$BLOB" | jq -r '.content' | tr -d '\n' | base64 --decode > references/harnesses/codex/src/codex-rs/ext/skills/src/host_roots.rs
echo "$BLOB"  # expected ac2bf3e9cdf8ccf0c396f011f3dbb8f515db39c7
# Current head SHA:
curl -s "https://api.github.com/repos/openai/codex/commits?per_page=1" | jq -r '.[0].sha'
```

## Saved files

| Local path | Upstream path | Lines saved | What it defines |
|---|---|---:|---|
| `src/codex-rs/core/src/agents_md.rs` | `codex-rs/core/src/agents_md.rs` | 1-513 | AGENTS.md project discovery, ancestor walk-up, candidate names, user-instruction assembly |
| `src/codex-rs/core/src/tools/handlers/request_user_input.rs` | `codex-rs/core/src/tools/handlers/request_user_input.rs` | 1-160 | `request_user_input` tool handler: root-thread check, collaboration-mode gate, blocking flag |
| `src/codex-rs/core/src/tools/handlers/request_user_input_spec.rs` | `codex-rs/core/src/tools/handlers/request_user_input_spec.rs` | 1-146 | `request_user_input` tool spec, schema, unavailable-mode message, option validation |
| `src/codex-rs/config/src/hook_config.rs` | `codex-rs/config/src/hook_config.rs` | 1-256 | JSON/TOML hook structures, event map, matcher groups, handler variants |
| `src/codex-rs/config/src/lib.rs` | `codex-rs/config/src/lib.rs` | 1-200 | `CONFIG_TOML_FILE` constant and config crate exports |
| `src/codex-rs/config/src/loader/mod.rs.L94-L646.rs` | `codex-rs/config/src/loader/mod.rs` | 94-646 | Config layer order and `config.toml` parsing/loading |
| `src/codex-rs/ext/skills/src/host_roots.rs` | `codex-rs/ext/skills/src/host_roots.rs` | 1-278 | Host, user, system, admin, plugin, and ancestor `.agents/skills` roots; blob `ac2bf3e9cdf8ccf0c396f011f3dbb8f515db39c7` |
| `src/codex-rs/ext/skills/src/loader/discovery.rs` | `codex-rs/ext/skills/src/loader/discovery.rs` | 1-224 | Filesystem walk depth, `SKILL.md` matching, hidden-directory and symlink policies |
| `src/codex-rs/ext/skills/src/loader/mod.rs` | `codex-rs/ext/skills/src/loader/mod.rs` | 1-32 | Skill discovery constants and scan limits |
| `src/codex-rs/ext/skills/src/loader/host_merge.rs` | `codex-rs/ext/skills/src/loader/host_merge.rs` | 1-273 | Host skill deduplication and scope ordering |
| `src/codex-rs/ext/skills/src/loader/environment.rs` | `codex-rs/ext/skills/src/loader/environment.rs` | 1-409 | Recursive environment discovery, metadata parsing, namespace qualification, ordering |
| `src/codex-rs/protocol/src/protocol.rs.L1570-L1585.rs` | `codex-rs/protocol/src/protocol.rs` | 1570-1585 | `HookEventName` enum |
| `src/codex-rs/hooks/src/events/common.rs` | `codex-rs/hooks/src/events/common.rs` | 1-306 | Hook matcher dispatch rules |
| `src/codex-rs/hooks/src/engine/discovery.rs.L93-L399.rs` | `codex-rs/hooks/src/engine/discovery.rs` | 93-399 | Hook source-layer discovery, exact `hooks.json` loading, TOML hook loading |
| `src/codex-rs/hooks/src/engine/discovery.rs.L634-L653.rs` | `codex-rs/hooks/src/engine/discovery.rs` | 634-653 | Unsupported prompt/agent handler behavior |
| `src/codex-rs/hooks/src/events/pre_tool_use.rs` | `codex-rs/hooks/src/events/pre_tool_use.rs` | 1-819 | PreToolUse input request and output/block/update contract |
| `src/codex-rs/hooks/src/schema.rs` | `codex-rs/hooks/src/schema.rs` | 1-1254 | Command stdin/output JSON wire structs and schema field names |
| `src/codex-rs/skills/src/parser.rs` | `codex-rs/skills/src/parser.rs` | 1-225 | `SKILL.md` YAML frontmatter keys and validation |
| `src/codex-rs/tui/src/slash_command.rs` | `codex-rs/tui/src/slash_command.rs` | 1-331 | Built-in `/agents`, `/subagents`, `/init`, and `/hooks` command names |
| `src/codex-rs/utils/home-dir/src/lib.rs` | `codex-rs/utils/home-dir/src/lib.rs` | 1-134 | `CODEX_HOME` override and default `~/.codex` resolution |

## Findings

### Skills discovery

Codex has two discovery modes. `Recursive` walks to `MAX_SCAN_DEPTH = 6`, while `DirectChildren` walks to depth `2`; each scan is capped at `MAX_SKILLS_DIRS_PER_ROOT = 2000` directories and `MAX_SKILLS_ENTRIES_PER_ROOT = 20_000` entries (`src/codex-rs/ext/skills/src/loader/discovery.rs:65-84`, `src/codex-rs/ext/skills/src/loader/mod.rs:18-32`). A file is a skill only when its basename is the literal `SKILL.md`; recursive mode accepts it anywhere in the walk, while direct-children mode requires its parent to be an immediate child of the root (`src/codex-rs/ext/skills/src/loader/discovery.rs:143-155`).

The normal host loader follows directory symlinks and includes hidden directories for environment discovery, and it uses `SkillDiscoveryMode::Recursive` (`src/codex-rs/ext/skills/src/loader/environment.rs:112-129`). Discovery can also be configured to ignore symlinks or prune hidden directories through `DirectorySymlinkPolicy` and `HiddenDirectoryPolicy` (`src/codex-rs/ext/skills/src/loader/discovery.rs:20-34`).

Skill frontmatter is YAML delimited by lines whose trimmed value is `---`. The accepted keys are top-level `name`, top-level `description`, and `metadata.short-description`; `description` is required, `name` defaults to the directory name when absent, and `name` is limited to 64 characters (`src/codex-rs/skills/src/parser.rs:6-20`, `src/codex-rs/skills/src/parser.rs:43-85`).

The merge keeps the first skill encountered for a duplicate `SKILL.md` path, then removes later duplicate paths and sorts retained skills by scope rank `Repo = 0`, `User = 1`, `System = 2`, `Admin = 3`, followed by name and path (`src/codex-rs/ext/skills/src/loader/host_merge.rs:201-249`, `src/codex-rs/ext/skills/src/loader/host_merge.rs:262-268`). There is no name-based winner in this implementation. Environment results are sorted by qualified `name`, then path (`src/codex-rs/ext/skills/src/loader/environment.rs:192-200`). No skill enable/disable toggle appears in these discovery files.

### Hooks

The actual JSON hook file loaded by source is literally `hooks.json`, not `config.json` and not a file inside a `hooks` script directory. For each config folder, `load_hooks_json` joins `hooks.json`, checks `is_file()`, reads it as text, and parses it as `HooksFile` JSON (`src/codex-rs/hooks/src/engine/discovery.rs.L93-L399.rs:338-367`, upstream lines). The JSON shape is `{ "hooks": { "PreToolUse": [{ "matcher": ..., "hooks": [...] }] } }`: `HooksFile` has an optional `description` and a `hooks: HookEventsToml` field, `MatcherGroup` has optional `matcher` plus `hooks`, and handlers are tagged with `type` (`src/codex-rs/config/src/hook_config.rs:10-17`, `src/codex-rs/config/src/hook_config.rs:153-163`).

The real event names are `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `SubagentStart`, `SubagentStop`, `Stop`, and `Interrupt` (`src/codex-rs/protocol/src/protocol.rs.L1570-L1585.rs:1570-1585`, `src/codex-rs/config/src/hook_config.rs:35-61`). The source maps those same 12 enum variants to the event arrays (`src/codex-rs/config/src/hook_config.rs:133-149`). Matchers are ignored for `UserPromptSubmit`, `Stop`, and `Interrupt`, and supported for the remaining events (`src/codex-rs/hooks/src/events/common.rs:112-127`).

Supported handler `type` values are `command`, `mcp_tool`, `prompt`, and `agent`. Command handlers use `command`, optional `commandWindows`, `timeout`, `async`, `statusMessage`, and `additionalContextLimit`; MCP handlers use `server`, `tool`, `input`, `timeout`, and `statusMessage` (`src/codex-rs/config/src/hook_config.rs:161-200`). The TOML representation is the same event map flattened under `[hooks]`, with a separate `state` map whose entries have `enabled` and `trusted_hash` (`src/codex-rs/config/src/hook_config.rs:19-33`).

A command hook receives JSON stdin with `session_id`, `turn_id`, optional `agent_id` and `agent_type`, `transcript_path`, `cwd`, `hook_event_name`, `model`, `permission_mode`, `tool_name`, `tool_input`, and `tool_use_id` for PreToolUse (`src/codex-rs/hooks/src/schema.rs:275-296`). Its output uses camelCase universal keys `continue`, `stopReason`, `suppressOutput`, and `systemMessage`, with PreToolUse-specific `hookEventName`, `permissionDecision`, `permissionDecisionReason`, `updatedInput`, and `additionalContext` (`src/codex-rs/hooks/src/schema.rs:87-99`, `src/codex-rs/hooks/src/schema.rs:127-155`, `src/codex-rs/hooks/src/schema.rs:241-265`). The runtime returns `should_block`, `block_reason`, `additional_contexts`, and `updated_input`; a block suppresses input rewriting, while otherwise the latest completed rewrite wins (`src/codex-rs/hooks/src/events/pre_tool_use.rs:38-45`, `src/codex-rs/hooks/src/events/pre_tool_use.rs:115-146`, `src/codex-rs/hooks/src/events/pre_tool_use.rs:149-158`).

The other command-hook inputs are explicit structs: PermissionRequest has the PreToolUse fields without `tool_use_id`; PostToolUse adds `tool_response` and `tool_use_id`; PreCompact and PostCompact add `trigger`; SessionStart adds `source`; SessionEnd has `reason`; UserPromptSubmit has `prompt`; SubagentStart has `agent_id` and `agent_type`; SubagentStop has `agent_transcript_path`, `stop_hook_active`, `agent_id`, `agent_type`, and `last_assistant_message`; Stop has `stop_hook_active` and `last_assistant_message`; Interrupt has the session, turn, transcript, cwd, event, model, and permission fields (`src/codex-rs/hooks/src/schema.rs:298-362`, `src/codex-rs/hooks/src/schema.rs:384-523`, `src/codex-rs/hooks/src/schema.rs:546-638`).

Outputs for PreCompact and PostCompact are universal-only. PostToolUse adds optional `decision: block`, `reason`, `additionalContext`, and `updatedMCPToolOutput`; PermissionRequest adds an allow/deny `decision` plus optional message; SessionStart and SubagentStart can add `additionalContext`; UserPromptSubmit can return `decision: block`, `reason`, and `additionalContext`; Stop and SubagentStop can return `decision: block` and `reason`; Interrupt returns only optional `systemMessage` (`src/codex-rs/hooks/src/schema.rs:142-184`, `src/codex-rs/hooks/src/schema.rs:186-239`, `src/codex-rs/hooks/src/schema.rs:384-488`). PermissionRequest `updated_input`, `updated_permissions`, and `interrupt` are reserved and fail closed when present or true (`src/codex-rs/hooks/src/schema.rs:199-217`).

No source path expects hook scripts in `~/.codex/hooks`. Commands are configured inline in handler objects. Plugin command handlers receive plugin environment variables `PLUGIN_ROOT`, `CLAUDE_PLUGIN_ROOT`, `PLUGIN_DATA`, and `CLAUDE_PLUGIN_DATA` (`src/codex-rs/hooks/src/engine/discovery.rs.L93-L399.rs:243-289`).

### Config / settings

The config filename constant is exactly `config.toml` (`src/codex-rs/config/src/lib.rs:40`). The loader documents and implements layered TOML loading: system `/etc/codex/config.toml` on Unix or `%ProgramData%\\OpenAI\\Codex\\config.toml` on Windows, user `${CODEX_HOME}/config.toml`, optional `${CODEX_HOME}/<name>.config.toml`, cwd `config.toml`, ancestor `.codex/config.toml`, repository `.codex/config.toml`, and runtime overrides (`src/codex-rs/config/src/loader/mod.rs.L94-L646.rs:109-121`). It parses file text with `toml::from_str`, treats a missing config file as an empty table, and returns non-missing read or parse errors (`src/codex-rs/config/src/loader/mod.rs.L94-L646.rs:566-646`).

`CODEX_HOME` is read from the environment when non-empty, must name an existing directory, and is canonicalized; when unset, the resolver uses the home directory plus literal `.codex` (`src/codex-rs/utils/home-dir/src/lib.rs:5-23`, `src/codex-rs/utils/home-dir/src/lib.rs:37-46`). The inspected config loader has no `config.json` parser or filename constant. The JSON file in this subsystem is `hooks.json` (`src/codex-rs/config/src/lib.rs:40`, `src/codex-rs/hooks/src/engine/discovery.rs.L93-L399.rs:338-367`, upstream lines).

### Context file

The default context filename is `AGENTS.md`, with `AGENTS.override.md` preferred first (`src/codex-rs/core/src/agents_md.rs:39-46`). Project discovery finds the nearest configured project-root marker, defaults to `.git`, collects candidate files from project root through cwd inclusive, and does not walk above the project root (`src/codex-rs/core/src/agents_md.rs:8-16`, `src/codex-rs/core/src/agents_md.rs:185-235`). At each directory it checks `AGENTS.override.md`, then `AGENTS.md`, then non-empty configured fallback filenames without duplicates (`src/codex-rs/core/src/agents_md.rs:237-280`).

Project docs are skipped when the active project is untrusted, and loaded project docs consume `project_doc_max_bytes`; oversized content is truncated to the remaining byte budget (`src/codex-rs/core/src/agents_md.rs:53-65`, `src/codex-rs/core/src/agents_md.rs:138-175`). A user-level instruction is host-provided as an `Instructions` value with an explicit source path, and `LoadedAgentsMd::new_user` stores that path without discovering it itself (`src/codex-rs/core/src/agents_md.rs:294-305`). Therefore this source does not prove a hard-coded read of `~/.codex/AGENTS.md`.

### Subagents and commands/prompts

The inspected source does not implement a filesystem loader for `~/.codex/agents` or `~/.codex/prompts`. The TUI source declares `/agents` and `/subagents` as built-in commands, `/hooks` as the hooks UI command, and `/init` as the command that creates an `AGENTS.md` file, but it contains no directory scan or prompt-file parser (`src/codex-rs/tui/src/slash_command.rs:7-12`, `src/codex-rs/tui/src/slash_command.rs:28-31`, `src/codex-rs/tui/src/slash_command.rs:39-45`, `src/codex-rs/tui/src/slash_command.rs:77-83`, `src/codex-rs/tui/src/slash_command.rs:86-94`). Prompt and agent hook handler variants exist in the config enum, but the discovery implementation explicitly skips them as unsupported (`src/codex-rs/config/src/hook_config.rs:197-200`, `src/codex-rs/hooks/src/engine/discovery.rs.L634-L653.rs:634-653`, upstream lines).

### Human question

Codex has a native `request_user_input` tool. The handler rejects calls from any non-root agent with "request_user_input can only be used by the root thread" (`src/codex-rs/core/src/tools/handlers/request_user_input.rs:70-74`). It then reads the turn's collaboration mode and rejects the call when that mode is not in the handler's `available_modes`, with the message "request_user_input is unavailable in {mode} mode" (`src/codex-rs/core/src/tools/handlers/request_user_input.rs:76-79`, `src/codex-rs/core/src/tools/handlers/request_user_input_spec.rs:91-103`). The request is blocking only in plan mode, `is_blocking: mode == ModeKind::Plan` (`src/codex-rs/core/src/tools/handlers/request_user_input.rs:84-88`). Every question must carry non-empty options, and the tool forces `is_other` on so free text is always accepted (`src/codex-rs/core/src/tools/handlers/request_user_input_spec.rs:105-121`). Which modes are available is set by the caller that constructs the handler, so the source proves the gate exists and not which modes the shipped CLI enables.

## harnesses.yaml verification

- `configDir: "~/.codex"` — **confirmed**, default resolver appends `.codex` to the home directory (`src/codex-rs/utils/home-dir/src/lib.rs:5-17`, `src/codex-rs/utils/home-dir/src/lib.rs:47-57`).
- `skillsRoot: "~/.codex/skills"` — **confirmed as a compatibility root**, source explicitly loads the user config folder's `skills` directory and calls it the deprecated `$CODEX_HOME/skills` location (`src/codex-rs/ext/skills/src/host_roots.rs:95-101`). **Additional source-confirmed root:** `~/.agents/skills` is also loaded for the user scope (`src/codex-rs/ext/skills/src/host_roots.rs:103-107`).
- `contextFile: "~/.codex/AGENTS.md"` — **unverifiable from this repo as an exact hard-coded user path**. The source defines `AGENTS.md` and accepts host-provided user instructions with an explicit path (`src/codex-rs/core/src/agents_md.rs:39-42`, `src/codex-rs/core/src/agents_md.rs:294-305`), but project discovery reads repository files rather than a fixed Codex-home path (`src/codex-rs/core/src/agents_md.rs:185-235`).
- `settings: "~/.codex/config.toml"` — **confirmed**, `CONFIG_TOML_FILE` is `config.toml`, and the user layer is `${CODEX_HOME}/config.toml` (`src/codex-rs/config/src/lib.rs:40`, `src/codex-rs/config/src/loader/mod.rs.L94-L646.rs:314-325`).
- `hooks.config: "~/.codex/hooks.json"` — **confirmed for the user config folder**, source joins each config folder with literal `hooks.json` and parses that JSON file (`src/codex-rs/hooks/src/engine/discovery.rs.L93-L399.rs:338-367`, upstream lines).
- `hooks.form` — **confirmed**, `HooksFile.hooks` contains the event map, each event contains matcher groups, and each matcher group contains a `hooks` handler array (`src/codex-rs/config/src/hook_config.rs:10-17`, `src/codex-rs/config/src/hook_config.rs:35-61`, `src/codex-rs/config/src/hook_config.rs:153-163`).
- `hooks.scriptDir: "~/.codex/hooks"` — **unverifiable from this repo**. Command handlers carry inline `command` strings and no script-directory field (`src/codex-rs/config/src/hook_config.rs:164-185`); plugin handlers use environment variables instead (`src/codex-rs/hooks/src/engine/discovery.rs.L93-L399.rs:261-269`, upstream lines).
- `subagentsDir: "~/.codex/agents"` — **unverifiable from this repo**. The inspected source declares `/agents` and `/subagents` commands but no directory loader (`src/codex-rs/tui/src/slash_command.rs:39-45`, `src/codex-rs/tui/src/slash_command.rs:77-78`).
- `commandsDir: "~/.codex/prompts"` — **unverifiable from this repo**. The inspected slash-command implementation contains built-in commands and no prompt-file directory loader (`src/codex-rs/tui/src/slash_command.rs:7-12`, `src/codex-rs/tui/src/slash_command.rs:86-94`).
- `projectDir: null` — **contradicted**. Project-scoped `.codex/config.toml` and repository project layers are explicitly loaded (`src/codex-rs/config/src/loader/mod.rs.L94-L646.rs:118-120`, `src/codex-rs/config/src/loader/mod.rs.L94-L646.rs:364-438`), and project `.agents/skills` roots are discovered from project root through cwd (`src/codex-rs/ext/skills/src/host_roots.rs:137-184`).
- Note `"User-scope context only. Project context comes from a standalone AGENTS.md, not <cwd>/.codex/AGENTS.md."` — **contradicted**. Project context is loaded from `AGENTS.override.md` or `AGENTS.md` at every directory from project root through cwd, while user instructions are a separate host-provided input (`src/codex-rs/core/src/agents_md.rs:53-60`, `src/codex-rs/core/src/agents_md.rs:185-235`, `src/codex-rs/core/src/agents_md.rs:267-280`, `src/codex-rs/core/src/agents_md.rs:294-305`).
- Note `"Also carries config.json alongside config.toml."` — **contradicted**. The config crate's filename constant is only `config.toml`, and the loader parses TOML. The separate JSON filename in source is `hooks.json`, not `config.json` (`src/codex-rs/config/src/lib.rs:40`, `src/codex-rs/config/src/loader/mod.rs.L94-L646.rs:566-646`, `src/codex-rs/hooks/src/engine/discovery.rs.L93-L399.rs:338-367`, upstream lines).

## Gaps

The inspected upstream source does not expose a `~/.codex/prompts` file loader or `~/.codex/agents` file loader, so their existence, format, and precedence would require runtime inspection or a different Codex component. The exact origin of host-provided user `Instructions` is outside `codex-rs/core/src/agents_md.rs`, so this reference cannot prove that the caller reads `~/.codex/AGENTS.md`. The raw CDN returned 404 for the valid `codex-rs/ext/skills/src/host_roots.rs` path even though the pinned Git tree contains it. That file is saved from the authoritative Git blob API and verified against blob SHA `ac2bf3e9cdf8ccf0c396f011f3dbb8f515db39c7`.
