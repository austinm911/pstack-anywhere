import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = resolve(dirname(fileURLToPath(import.meta.url)), "../skills/poteto-mode/scripts/worktree-audit.sh");

function git(repo, ...args) {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  expect(result.status).toBe(0);
  return result.stdout;
}

function fixture(check) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "pstack-audit-")));
  const repo = join(root, "repo");
  const worktree = join(root, "worktree with [brackets]");
  const transcripts = join(root, "transcripts");
  mkdirSync(repo);
  mkdirSync(transcripts);
  try {
    git(repo, "init", "--quiet");
    writeFileSync(join(repo, "file.txt"), "baseline\n");
    git(repo, "add", "file.txt");
    git(repo, "-c", "user.name=Audit test", "-c", "user.email=audit@example.invalid", "commit", "--quiet", "-m", "baseline");
    git(repo, "worktree", "add", "--quiet", "-b", "subject", worktree);
    check({ repo, worktree, transcripts });
  } finally {
    if (existsSync(worktree)) git(repo, "worktree", "remove", worktree);
    rmSync(root, { recursive: true, force: true });
  }
}

function audit(repo, transcripts, env = {}) {
  return spawnSync("bash", [script, "-b", "HEAD", repo], {
    encoding: "utf8",
    env: { ...process.env, PSTACK_TRANSCRIPT_DIR: transcripts, ...env },
  });
}

test("worktree audit preserves literal paths and detects recent transcripts", () => {
  fixture(({ repo, worktree, transcripts }) => {
    writeFileSync(join(transcripts, "chat with spaces.jsonl"), JSON.stringify({ path: `${worktree}/file.txt` }));
    const result = audit(repo, transcripts);
    expect(result.status).toBe(0);
    const row = result.stdout.trim().split("\n").at(-1).split("\t");
    expect(row[2]).toBe("YES");
    expect(row[3]).toBe("clean");
    expect(row[6]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(row[7]).toBe("verify-recent-chat");
    expect(row[8]).toBe(worktree);
  });
});

test("worktree audit names missing transcript coverage", () => {
  fixture(({ repo, transcripts }) => {
    const result = audit(repo, join(transcripts, "missing"));
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("no transcript coverage");
    expect(result.stderr).toContain("PSTACK_TRANSCRIPT_DIR");
    const row = result.stdout.trim().split("\n").at(-1).split("\t");
    expect(row[7]).toBe("unverified-chat");
  });
});

test("worktree audit names unavailable rg as a coverage gap", () => {
  fixture(({ repo, transcripts }) => {
    const bin = join(dirname(repo), "bin");
    mkdirSync(bin);
    for (const tool of ["bash", "git", "awk", "sed", "mktemp", "date", "du", "sort", "head", "rm", "grep"]) {
      const executable = Bun.which(tool);
      if (!executable) throw new Error(`Missing test dependency: ${tool}`);
      symlinkSync(executable, join(bin, tool));
    }
    const result = audit(repo, transcripts, { PATH: bin });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("no transcript coverage (missing directory or rg)");
    const row = result.stdout.trim().split("\n").at(-1).split("\t");
    expect(row[7]).toBe("unverified-chat");
  });
});
