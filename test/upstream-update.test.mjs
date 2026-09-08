import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const script = resolve(import.meta.dir, "../scripts/update-upstream.mjs");
const scratch = [];
afterEach(() => {
  for (const path of scratch.splice(0)) rmSync(path, { recursive: true, force: true });
});

function run(cwd, command, args) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout: 20000 });
  if (result.error) throw result.error;
  return result;
}
function git(cwd, ...args) {
  const result = run(cwd, "git", args);
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}
function write(root, path, body) {
  mkdirSync(resolve(root, path, ".."), { recursive: true });
  writeFileSync(join(root, path), body);
}
function commit(root, message) {
  git(root, "add", ".");
  git(root, "commit", "-qm", message);
  return git(root, "rev-parse", "HEAD");
}
function repository(path) {
  mkdirSync(path);
  git(path, "init", "-q", "-b", "main");
  git(path, "config", "user.name", "Fixture");
  git(path, "config", "user.email", "fixture@example.invalid");
  git(path, "config", "commit.gpgsign", "false");
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "pstack-upstream-test-"));
  scratch.push(root);
  const source = join(root, "source");
  const port = join(root, "port");
  repository(source);
  repository(port);
  const skill = "skills/example/SKILL.md";
  const body = "# Example\n\nLocal choice: upstream\n\n" +
    Array.from({ length: 20 }, (_, i) => `Shared line ${i}\n`).join("") + "\nUpstream behavior: old\n";
  write(source, `pstack/${skill}`, body);
  const runtimePath = "skills/poteto-mode/scripts/orch/store.ts";
  const runtime = "export const upstream = true;\n";
  write(source, `pstack/${runtimePath}`, runtime);
  write(source, "other-plugin/private.txt", "not part of this import\n");
  const pin = commit(source, "upstream baseline");
  write(port, skill, body.replace("Local choice: upstream", "Local choice: portable"));
  write(port, runtimePath, runtime);
  const ledger = { upstream: { repo: source, path: "pstack", sha: pin } };
  write(port, "coupling.yaml", JSON.stringify(ledger));
  write(port, "conformance/upstream-orch.json", JSON.stringify({
    upstream: source, commit: pin,
    files: { [runtimePath]: createHash("sha256").update(runtime).digest("hex") },
  }));
  write(port, "port-only.txt", "keep me\n");
  commit(port, "independent port history");
  const cli = (...args) => run(port, process.execPath, [script, ...args, "--source", source]);
  return { root, source, port, skill, body, pin, ledger, cli };
}

test("baseline connects histories without changing HEAD tree, staged edits, or working files", () => {
  const f = fixture();
  const oldHead = git(f.port, "rev-parse", "HEAD");
  const oldTree = git(f.port, "rev-parse", "HEAD^{tree}");
  write(f.port, "port-only.txt", "staged work\n");
  git(f.port, "add", "port-only.txt");
  write(f.port, "port-only.txt", "unstaged work\n");
  write(f.port, "untracked.txt", "untracked work\n");
  const status = git(f.port, "status", "--porcelain");
  const index = git(f.port, "write-tree");
  expect(f.cli("init").status).toBe(0);
  const head = git(f.port, "rev-parse", "HEAD");
  const imported = git(f.port, "rev-parse", "HEAD^2");
  expect(git(f.port, "show", "-s", "--format=%P", head)).toBe(`${oldHead} ${imported}`);
  expect(git(f.port, "rev-parse", "HEAD^{tree}")).toBe(oldTree);
  expect(git(f.port, "write-tree")).toBe(index);
  expect(git(f.port, "status", "--porcelain")).toBe(status);
  expect(readFileSync(join(f.port, "port-only.txt"), "utf8")).toBe("unstaged work\n");
  expect(git(f.port, "rev-parse", `${imported}^{tree}`)).toBe(git(f.source, "rev-parse", `${f.pin}:pstack`));
  expect(f.cli("init").status).toBe(0);
  expect(git(f.port, "rev-parse", "HEAD")).toBe(head);
});

test("upstream updates merge around local edits and remain uncommitted for review", () => {
  const f = fixture();
  expect(f.cli("init").status).toBe(0);
  const head = git(f.port, "rev-parse", "HEAD");
  write(f.source, `pstack/${f.skill}`, f.body.replace("Upstream behavior: old", "Upstream behavior: new"));
  write(f.source, "pstack/skills/new/SKILL.md", "new upstream skill\n");
  const next = commit(f.source, "new upstream behavior");
  const result = f.cli("merge", next);
  expect(result.status, result.stderr).toBe(0);
  expect(git(f.port, "rev-parse", "HEAD")).toBe(head);
  const text = readFileSync(join(f.port, f.skill), "utf8");
  expect(text).toContain("Local choice: portable");
  expect(text).toContain("Upstream behavior: new");
  expect(git(f.port, "rev-parse", "MERGE_HEAD^{tree}")).toBe(git(f.source, "rev-parse", `${next}:pstack`));
  expect(git(f.port, "ls-files", "other-plugin")).toBe("");
  expect(JSON.parse(readFileSync(join(f.port, "coupling.yaml"), "utf8")).upstream.sha).toBe(f.pin);
  f.ledger.upstream.sha = next;
  write(f.port, "coupling.yaml", JSON.stringify(f.ledger));
  commit(f.port, "accept reviewed update");
  expect(f.cli("init").status).toBe(0);
  expect(f.cli("merge", next).status).toBe(0);
  const previousImport = git(f.port, "rev-parse", "HEAD^2");
  write(f.source, `pstack/${f.skill}`, f.body.replace("Upstream behavior: old", "Upstream behavior: newest"));
  const later = commit(f.source, "later upstream behavior");
  expect(f.cli("merge", later).status).toBe(0);
  expect(git(f.port, "show", "-s", "--format=%P", "MERGE_HEAD")).toBe(previousImport);
  expect(readFileSync(join(f.port, f.skill), "utf8")).toContain("Local choice: portable");
  expect(readFileSync(join(f.port, f.skill), "utf8")).toContain("Upstream behavior: newest");
});

test("conflicting edits remain visible and an aborted merge can be retried", () => {
  const f = fixture();
  expect(f.cli("init").status).toBe(0);
  const head = git(f.port, "rev-parse", "HEAD");
  write(f.source, `pstack/${f.skill}`, f.body.replace("Local choice: upstream", "Local choice: changed upstream"));
  const next = commit(f.source, "conflicting upstream change");
  expect(f.cli("merge", next).status).toBe(1);
  expect(git(f.port, "diff", "--name-only", "--diff-filter=U")).toBe(f.skill);
  expect(readFileSync(join(f.port, f.skill), "utf8")).toContain("<<<<<<< HEAD");
  expect(git(f.port, "rev-parse", "HEAD")).toBe(head);
  expect(f.cli("init").status).toBe(1);
  git(f.port, "merge", "--abort");
  expect(readFileSync(join(f.port, f.skill), "utf8")).toContain("Local choice: portable");
  expect(git(f.port, "status", "--porcelain")).toBe("");
  expect(f.cli("merge", next).status).toBe(1);
});

test("a fresh clone recovers the baseline from merged ancestry without an import branch", () => {
  const f = fixture();
  expect(f.cli("init").status).toBe(0);
  const clone = join(f.root, "clone");
  git(f.root, "clone", "-q", "--single-branch", "--branch", "main", f.port, clone);
  const head = git(clone, "rev-parse", "HEAD");
  expect(run(clone, process.execPath, [script, "init", "--source", f.source]).status).toBe(0);
  expect(git(clone, "rev-parse", "HEAD")).toBe(head);
  expect(git(clone, "rev-parse", "HEAD^2")).toBe(git(f.port, "rev-parse", "HEAD^2"));
  expect(git(clone, "branch", "--list", "upstream/pstack")).toBe("");
});

test("dirty updates and unrelated revisions cannot move any branch", () => {
  const f = fixture();
  expect(f.cli("init").status).toBe(0);
  const head = git(f.port, "rev-parse", "HEAD");
  const refs = git(f.port, "show-ref");
  write(f.source, "pstack/new.txt", "upstream update\n");
  const next = commit(f.source, "next");
  write(f.port, "untracked.txt", "uncommitted\n");
  expect(f.cli("merge", next).status).toBe(1);
  expect(git(f.port, "show-ref")).toBe(refs);
  rmSync(join(f.port, "untracked.txt"));
  git(f.source, "checkout", "--orphan", "unrelated");
  const unrelated = commit(f.source, "unrelated history");
  expect(f.cli("merge", unrelated).status).toBe(1);
  expect(git(f.port, "show-ref")).toBe(refs);
  expect(git(f.port, "rev-parse", "HEAD")).toBe(head);
});

test("an aborted newer import does not prevent selecting an earlier descendant of the accepted pin", () => {
  const f = fixture();
  expect(f.cli("init").status).toBe(0);
  write(f.source, "pstack/first.txt", "first update\n");
  const first = commit(f.source, "first update");
  write(f.source, "pstack/second.txt", "second update\n");
  const second = commit(f.source, "second update");
  expect(f.cli("merge", second).status).toBe(0);
  git(f.port, "merge", "--abort");
  const result = f.cli("merge", first);
  expect(result.status, result.stderr).toBe(0);
  expect(git(f.port, "ls-files", "second.txt")).toBe("");
});

test("init cannot bless an edited pin when this branch already has an import history", () => {
  const f = fixture();
  expect(f.cli("init").status).toBe(0);
  write(f.source, "pstack/not-imported.txt", "not imported\n");
  f.ledger.upstream.sha = commit(f.source, "not imported");
  write(f.port, "coupling.yaml", JSON.stringify(f.ledger));
  const head = commit(f.port, "incorrectly advance the pin");
  const result = f.cli("init");
  expect(result.status, result.stdout).toBe(1);
  expect(git(f.port, "rev-parse", "HEAD")).toBe(head);
});

test("an ignored file in the import's destination is preserved", () => {
  const f = fixture();
  write(f.port, ".gitignore", "collision.txt\n");
  commit(f.port, "ignore a local file");
  expect(f.cli("init").status).toBe(0);
  write(f.port, "collision.txt", "local ignored content\n");
  write(f.source, "pstack/collision.txt", "upstream content\n");
  const next = commit(f.source, "upstream adds the same path");
  const result = f.cli("merge", next);
  expect(result.status, result.stdout).not.toBe(0);
  expect(readFileSync(join(f.port, "collision.txt"), "utf8")).toBe("local ignored content\n");
});

test("source verification rejects a locally edited runtime even when its recorded hash was changed too", () => {
  const f = fixture();
  expect(f.cli("init").status).toBe(0);
  expect(f.cli("verify").status).toBe(0);
  const manifestPath = "conformance/upstream-orch.json";
  const manifest = JSON.parse(readFileSync(join(f.port, manifestPath), "utf8"));
  const path = Object.keys(manifest.files)[0];
  const changed = "export const local = true;\n";
  write(f.port, path, changed);
  manifest.files[path] = createHash("sha256").update(changed).digest("hex");
  write(f.port, manifestPath, JSON.stringify(manifest));
  expect(f.cli("verify").status).toBe(1);
});

test("verification requires the active import pin and upstream-derived runtime inventory", () => {
  const f = fixture();
  expect(f.cli("init").status).toBe(0);
  const nested = "skills/poteto-mode/scripts/orch/lib/new.ts";
  write(f.source, `pstack/${nested}`, "export const next = true;\n");
  const next = commit(f.source, "add a nested runtime module");
  expect(f.cli("merge", next).status).toBe(0);
  expect(f.cli("verify").status).toBe(1);
  f.ledger.upstream.sha = next;
  write(f.port, "coupling.yaml", JSON.stringify(f.ledger));
  expect(f.cli("verify").status).toBe(1);
  const hashes = f.cli("hashes", next);
  expect(hashes.status, hashes.stderr).toBe(0);
  write(f.port, "conformance/upstream-orch.json", hashes.stdout);
  expect(f.cli("verify").status).toBe(0);
  commit(f.port, "accept the verified import");
  expect(f.cli("verify").status).toBe(0);
  write(f.port, "skills/poteto-mode/scripts/orch/extra.ts", "extra local runtime\n");
  expect(f.cli("verify").status).toBe(1);
});

test("another worktree's prepared import cannot control this branch's next update", () => {
  const f = fixture();
  expect(f.cli("init").status).toBe(0);
  const sibling = join(f.root, "sibling");
  git(f.port, "worktree", "add", "-qb", "sibling", sibling);
  write(f.source, "pstack/first.txt", "first\n");
  const first = commit(f.source, "first");
  write(f.source, "pstack/second.txt", "second\n");
  const second = commit(f.source, "second");
  expect(run(sibling, process.execPath, [script, "merge", second, "--source", f.source]).status).toBe(0);
  const siblingMerge = git(sibling, "rev-parse", "MERGE_HEAD");
  expect(f.cli("merge", first).status).toBe(0);
  expect(git(sibling, "rev-parse", "MERGE_HEAD")).toBe(siblingMerge);
  expect(git(f.port, "ls-files", "second.txt")).toBe("");
});

test("a shallow clone cannot create a replacement baseline", () => {
  const f = fixture();
  expect(f.cli("init").status).toBe(0);
  const clone = join(f.root, "shallow");
  git(f.root, "clone", "-q", "--depth", "1", `file://${f.port}`, clone);
  const head = git(clone, "rev-parse", "HEAD");
  const result = run(clone, process.execPath, [script, "init", "--source", f.source]);
  expect(result.status, result.stdout).toBe(1);
  expect(result.stderr).toContain("shallow");
  expect(git(clone, "rev-parse", "HEAD")).toBe(head);
});
