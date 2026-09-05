#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const importRef = "refs/heads/upstream/pstack";
const oid = /^[a-f0-9]{40}$/;
let repository = process.cwd();

function run(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: repository,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    input: options.input,
    env: { ...process.env, ...options.env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `git ${args[0]} failed`);
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

function importedBaseline(upstream, source) {
  const matches = git([
    "log", "HEAD", "--format=%H", `--grep=^Pstack-Upstream-Commit: ${upstream.sha}$`,
  ]).split("\n").filter(Boolean);
  if (matches.length > 1) throw new Error("Multiple imports match the pinned revision; inspect the history");
  return matches.length === 0 ? null : readImport(matches[0], upstream, source);
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

function importTip() {
  return succeeds(["show-ref", "--verify", "--quiet", importRef])
    ? git(["rev-parse", importRef])
    : null;
}

function initialize(upstream, source, branch) {
  ensureCommit(upstream.sha, source);
  const baseline = importedBaseline(upstream, source);
  const tip = importTip();
  if (baseline) {
    if (tip) {
      readImport(tip, upstream, source);
      if (!ancestor(baseline.commit, tip)) throw new Error("The import branch diverges from the pinned baseline");
    } else {
      git(["update-ref", importRef, baseline.commit, ""]);
    }
    console.log(`Import baseline already connected at ${baseline.revision}.`);
    return;
  }

  const initial = tip ? readImport(tip, upstream, source) : null;
  if (initial && initial.revision !== upstream.sha) {
    throw new Error("The existing import branch is not at the pinned baseline");
  }
  const imported = initial?.commit ?? makeImport(upstream.sha, null, upstream);
  const head = git(["rev-parse", "HEAD"]);
  const bridge = git(["commit-tree", `${head}^{tree}`, "-p", head, "-p", imported], {
    input: `Establish pstack upstream baseline\n\nRecord ${upstream.sha} as already ported. Preserve the current tree.\n`,
  });
  git(["update-ref", "-m", "Establish pstack import baseline", "--stdin"], {
    input: [
      "start",
      tip ? `verify ${importRef} ${tip}` : `create ${importRef} ${imported}`,
      `update ${branch} ${bridge} ${head}`,
      "prepare", "commit", "",
    ].join("\n"),
  });
  console.log(`Connected ${upstream.sha} through baseline commit ${bridge}.`);
  console.log("The HEAD tree, index, and working files are unchanged.");
}

function mergeRevision(revision, upstream, source) {
  if (git(["status", "--porcelain", "--untracked-files=normal"])) {
    throw new Error("Commit or set aside working changes before merging an upstream update; nothing was merged");
  }
  const baseline = importedBaseline(upstream, source);
  if (!baseline) throw new Error("Run update-upstream.mjs init before the first upstream update");
  const previous = importTip();
  const tip = previous ? readImport(previous, upstream, source) : baseline;
  if (!ancestor(baseline.commit, tip.commit)) throw new Error("The import branch diverges from the pinned baseline");
  if (tip.revision !== upstream.sha && ancestor(tip.commit, "HEAD")) {
    throw new Error(`Update coupling.yaml upstream.sha to the reviewed import ${tip.revision} before another update`);
  }
  ensureCommit(revision, source);
  if (!ancestor(tip.revision, revision)) {
    throw new Error("The requested source revision does not descend from the latest import; refusing to rewind it");
  }
  const imported = revision === tip.revision ? tip.commit : makeImport(revision, tip.commit, upstream);
  if (ancestor(imported, "HEAD")) {
    console.log("That upstream revision is already included.");
    return 0;
  }
  if (imported !== previous) git(["update-ref", importRef, imported, previous ?? ""]);
  const result = run(["merge", "--no-autostash", "--no-ff", "--no-commit", imported], { allowFailure: true });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  console.log(result.status === 0
    ? `Review the merge, update the recorded pin to ${revision}, run checks, then commit.`
    : "Merge stopped. Inspect git status, resolve and validate, or use git merge --abort.");
  return result.status ?? 1;
}

function main(args) {
  if (args.length === 0 || args[0] === "--help") {
    console.log("Usage: bun scripts/update-upstream.mjs init [--source <clone-or-url>]");
    console.log("       bun scripts/update-upstream.mjs merge <full-commit-sha> [--source <clone-or-url>]");
    return 0;
  }
  const [command, ...rest] = args;
  const revision = command === "merge" ? rest.shift() : undefined;
  if (!["init", "merge"].includes(command) || (command === "merge" && !oid.test(revision ?? ""))) {
    throw new Error("Use init or merge with an explicit full upstream commit SHA");
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
  for (const name of ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply", "sequencer"]) {
    if (existsSync(resolve(repository, git(["rev-parse", "--git-path", name])))) {
      throw new Error("Finish or abort the active Git operation before updating upstream");
    }
  }
  const branch = git(["symbolic-ref", "--quiet", "HEAD"]);
  if (branch === importRef) throw new Error("Run this from a port development branch, not upstream/pstack");
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
