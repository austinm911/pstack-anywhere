import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

test("published evidence logs are not ignored", () => {
  const dir = mkdtempSync(join(tmpdir(), "pstack-evidence-packaging-"));
  try {
    expect(Bun.spawnSync(["git", "init", "-q", dir]).exitCode).toBe(0);
    writeFileSync(join(dir, ".gitignore"), readFileSync(join(root, ".gitignore")));
    const paths = ["drive.log", "heartbeat.log", "probe-activity.log"]
      .map(name => `evidence/runs/fixture.claude.2026-10-13.01/${name}`);
    const result = Bun.spawnSync(["git", "check-ignore", "--no-index", ...paths], { cwd: dir });
    expect(result.stdout.toString()).toBe("");
    expect(result.exitCode).toBe(1);
    expect(Bun.spawnSync(["git", "check-ignore", "debug.log"], { cwd: dir }).exitCode).toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
