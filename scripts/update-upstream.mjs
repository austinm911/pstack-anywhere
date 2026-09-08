#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const legacyImportRef = "refs/heads/upstream/pstack";
const oid = /^[a-f0-9]{40}$/;
let repository = process.cwd();

function run(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: repository,
    encoding: options.binary ? null : "utf8",
    maxBuffer: 16 * 1024 * 1024,
    input: options.input,
    env: { ...process.env, ...options.env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(result.stderr.toString().trim() || result.stdout.toString().trim() || `git ${args[0]} failed`);
  }
  return result;
}

const git = (args, options) => run(args, options).stdout.trim();
const succeeds = (args) => run(args, { allowFailure: true }).status === 0;
const ancestor = (base, tip) => succeeds(["merge-base", "--is-ancestor", base, tip]);

function ensureCommit(commit, source) {
  if (!succeeds(["cat-file", "-e", `${commit}^{commit}`])) {
    git(["fetch", "--no-tags", "--no-write-fetch-head", "--", source, commit]);
  }
  if (git(["cat-file", "-t", commit]) !== "commit") throw new Error(`${commit} is not a commit`);
}

function subtree(commit, path) {
  const tree = git(["rev-parse", `${commit}:${path}`]);
  if (git(["cat-file", "-t", tree]) !== "tree") throw new Error(`${path} is not an upstream directory`);
  return tree;
}

function readImport(ref, upstream, source) {
  const commit = git(["rev-parse", "--verify", ref]);
  const message = git(["show", "-s", "--format=%B", commit]);
  const revision = message.match(/^Pstack-Upstream-Commit: ([a-f0-9]{40})$/m)?.[1];
  const path = message.match(/^Pstack-Upstream-Path: (.+)$/m)?.[1];
  if (!revision || path !== upstream.path) throw new Error(`${ref} is not a matching pstack import`);
  ensureCommit(revision, source);
  if (git(["rev-parse", `${commit}^{tree}`]) !== subtree(revision, path)) {
    throw new Error(`${ref} has edits outside the upstream snapshot`);
  }
  return { commit, revision };
}

function latestImport(upstream, source, refs = ["HEAD"]) {
  const matches = git([
    "log", "--topo-order", "--format=%H", "--grep=^Pstack-Upstream-Commit: ", ...refs,
  ]).split("\n").filter(Boolean);
  if (matches.length === 0) return null;
  const latest = readImport(matches[0], upstream, source);
  if (matches.slice(1).some(commit => !ancestor(commit, latest.commit))) {
    throw new Error("This branch contains divergent upstream import histories; reconcile them before updating");
  }
  return latest;
}

function importedBaseline(upstream, source) {
  const latest = latestImport(upstream, source);
  if (latest && latest.revision !== upstream.sha) {
    throw new Error(`coupling.yaml upstream.sha must match this branch's accepted import ${latest.revision}`);
  }
  return latest;
}

function makeImport(revision, parent, upstream) {
  const date = git(["show", "-s", "--format=%cI", revision]);
  return git(["commit-tree", subtree(revision, upstream.path), ...(parent ? ["-p", parent] : [])], {
    input: `Import Cursor pstack ${revision}\n\nPstack-Upstream-Commit: ${revision}\nPstack-Upstream-Path: ${upstream.path}\n`,
    env: {
      GIT_AUTHOR_NAME: "pstack upstream importer",
      GIT_AUTHOR_EMAIL: "upstream@pstack.invalid",
      GIT_COMMITTER_NAME: "pstack upstream importer",
      GIT_COMMITTER_EMAIL: "upstream@pstack.invalid",
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
    },
  });
}

function initialize(upstream, source, branch) {
  ensureCommit(upstream.sha, source);
  const baseline = importedBaseline(upstream, source);
  if (baseline) {
    console.log(`Import baseline already connected at ${baseline.revision}.`);
    return;
  }
  const imported = makeImport(upstream.sha, null, upstream);
  const head = git(["rev-parse", "HEAD"]);
  const bridge = git(["commit-tree", `${head}^{tree}`, "-p", head, "-p", imported], {
    input: `Establish pstack upstream baseline\n\nRecord ${upstream.sha} as already ported. Preserve the current tree.\n`,
  });
  git(["update-ref", "-m", "Establish pstack import baseline", branch, bridge, head]);
  console.log(`Connected ${upstream.sha} through baseline commit ${bridge}.`);
  console.log("The HEAD tree, index, and working files are unchanged.");
}

function mergeRevision(revision, upstream, source) {
  if (git(["status", "--porcelain", "--untracked-files=normal"])) {
    throw new Error("Commit or set aside working changes before merging an upstream update; nothing was merged");
  }
  const baseline = importedBaseline(upstream, source);
  if (!baseline) throw new Error("Run update-upstream.mjs init before the first upstream update");
  ensureCommit(revision, source);
  if (!ancestor(baseline.revision, revision)) {
    throw new Error("The requested source revision does not descend from this branch's accepted pin; refusing to rewind it");
  }
  const imported = revision === baseline.revision ? baseline.commit : makeImport(revision, baseline.commit, upstream);
  if (ancestor(imported, "HEAD")) {
    console.log("That upstream revision is already included.");
    return 0;
  }
  const ignored = run(["ls-files", "--others", "--ignored", "--exclude-standard", "-z"]).stdout.split("\0").filter(Boolean);
  const incoming = run(["ls-tree", "-r", "--name-only", "-z", imported]).stdout.split("\0").filter(Boolean);
  const collision = ignored.find(local => incoming.some(path =>
    local === path || local.startsWith(`${path}/`) || path.startsWith(`${local}/`)));
  if (collision) throw new Error(`Ignored local content would overlap the import: ${collision}; move it aside before merging`);
  const result = run(["merge", "--no-autostash", "--no-overwrite-ignore", "--no-ff", "--no-commit", imported], { allowFailure: true });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  console.log(result.status === 0
    ? `Review the merge, update the recorded pin to ${revision}, run checks, then commit.`
    : "Merge stopped. Inspect git status, resolve and validate, or use git merge --abort.");
  return result.status ?? 1;
}

const orchestrationPath = "skills/poteto-mode/scripts/orch/";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

function upstreamHashes(revision, upstream, source) {
  ensureCommit(revision, source);
  const prefix = `${upstream.path}/`;
  const paths = run(["ls-tree", "-r", "--name-only", "-z", revision, "--", `${prefix}${orchestrationPath}`])
    .stdout.split("\0").filter(Boolean);
  if (paths.length === 0) throw new Error("The upstream orchestration directory is missing; review the runtime ownership policy");
  return {
    upstream: upstream.repo,
    commit: revision,
    files: Object.fromEntries(paths.map(path => [
      path.slice(prefix.length), digest(run(["show", `${revision}:${path}`], { binary: true }).stdout),
    ])),
  };
}

function localFiles(path) {
  return readdirSync(resolve(repository, path), { withFileTypes: true }).flatMap(entry => {
    const child = `${path}${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink in the upstream runtime: ${child}`);
    return entry.isDirectory() ? localFiles(`${child}/`) : [child];
  }).sort();
}

function verify(upstream, source) {
  if (git(["diff", "--name-only", "--diff-filter=U"])) throw new Error("Resolve all merge conflicts before verification");
  const merging = succeeds(["rev-parse", "--verify", "MERGE_HEAD"]);
  const imported = latestImport(upstream, source, merging ? ["HEAD", "MERGE_HEAD"] : ["HEAD"]);
  if (!imported || imported.revision !== upstream.sha) {
    throw new Error(`The recorded pin must match the latest imported snapshot${imported ? ` ${imported.revision}` : "; no import exists"}`);
  }
  if (merging && git(["rev-parse", "MERGE_HEAD"]) !== imported.commit) {
    throw new Error("The active merge is not the recorded upstream import");
  }
  const expected = upstreamHashes(upstream.sha, upstream, source);
  const manifest = JSON.parse(readFileSync(resolve(repository, "conformance/upstream-orch.json"), "utf8"));
  const paths = Object.keys(expected.files).sort();
  if (manifest.upstream !== expected.upstream || manifest.commit !== expected.commit ||
      JSON.stringify(Object.keys(manifest.files ?? {}).sort()) !== JSON.stringify(paths) ||
      paths.some(path => manifest.files[path] !== expected.files[path])) {
    throw new Error("The orchestration manifest differs from the upstream source; generate it with upstream hashes <sha>");
  }
  if (JSON.stringify(localFiles(orchestrationPath)) !== JSON.stringify(paths)) {
    throw new Error("The local orchestration file inventory differs from upstream");
  }
  for (const path of paths) {
    if (digest(readFileSync(resolve(repository, path))) !== expected.files[path]) {
      throw new Error(`Upstream-owned runtime differs from the source: ${path}`);
    }
  }
  console.log(`Verified import ${upstream.sha} and ${paths.length} orchestration files against upstream source.`);
}

function main(args) {
  if (args.length === 0 || args[0] === "--help") {
    console.log("Usage: bun scripts/update-upstream.mjs init [--source <clone-or-url>]");
    console.log("       bun scripts/update-upstream.mjs merge <full-commit-sha> [--source <clone-or-url>]");
    console.log("       bun scripts/update-upstream.mjs hashes <full-commit-sha> [--source <clone-or-url>]");
    console.log("       bun scripts/update-upstream.mjs verify [--source <clone-or-url>]");
    return 0;
  }
  const [command, ...rest] = args;
  const takesRevision = ["merge", "hashes"].includes(command);
  const revision = takesRevision ? rest.shift() : undefined;
  if (!["init", "merge", "hashes", "verify"].includes(command) || (takesRevision && !oid.test(revision ?? ""))) {
    throw new Error("Use init, verify, or merge/hashes with an explicit full upstream commit SHA");
  }
  if (rest.length !== 0 && (rest.length !== 2 || rest[0] !== "--source" || !rest[1] || rest[1].startsWith("-"))) {
    throw new Error("Expected --source <clone-or-url>");
  }
  repository = git(["rev-parse", "--show-toplevel"]);
  const { upstream } = Bun.YAML.parse(readFileSync(resolve(repository, "coupling.yaml"), "utf8"));
  if (!upstream || !oid.test(upstream.sha ?? "") || typeof upstream.repo !== "string" ||
      !upstream.repo || upstream.repo.startsWith("-") || typeof upstream.path !== "string" ||
      !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(upstream.path)) {
    throw new Error("coupling.yaml must name an upstream repository, directory, and full pinned SHA");
  }
  const source = rest[1] ?? upstream.repo;
  if (command === "hashes") {
    console.log(JSON.stringify(upstreamHashes(revision, upstream, source), null, 2));
    return 0;
  }
  if (git(["rev-parse", "--is-shallow-repository"]) === "true") {
    throw new Error("Recover this shallow clone's full port history before initializing, merging, or verifying an import");
  }
  if (command === "verify") {
    verify(upstream, source);
    return 0;
  }
  for (const name of ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply", "sequencer"]) {
    if (existsSync(resolve(repository, git(["rev-parse", "--git-path", name])))) {
      throw new Error("Finish or abort the active Git operation before updating upstream");
    }
  }
  const branch = git(["symbolic-ref", "--quiet", "HEAD"]);
  if (branch === legacyImportRef) throw new Error("Run this from a port development branch, not the legacy upstream/pstack snapshot branch");
  return command === "init"
    ? (initialize(upstream, source, branch), 0)
    : mergeRevision(revision, upstream, source);
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
