// Both scripts are CLIs that read HOME, so the tests give each case a scratch
// HOME and assert on exit code and printed lines.
import { describe, test, expect, afterEach } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";

const REPO = join(dirname(new URL(import.meta.url).pathname), "..");
const SKILLS = join(REPO, "skills");
const INSTALL = join(REPO, "scripts/install.mjs");
const DOCTOR = "setup-pstack-anywhere/scripts/doctor.mjs";

const skillNames = readdirSync(SKILLS).filter((name) => existsSync(join(SKILLS, name, "SKILL.md")));

const temps = [];

function scratchHome() {
  const dir = mkdtempSync(join(tmpdir(), "install-home-"));
  temps.push(dir);
  return dir;
}

function run(home, script, ...args) {
  const proc = Bun.spawnSync([process.execPath, script, ...args], { env: { ...process.env, HOME: home }, cwd: REPO });
  return { code: proc.exitCode, out: proc.stdout.toString(), err: proc.stderr.toString() };
}

const lines = (out, prefix) => out.split("\n").filter((line) => line.startsWith(prefix));

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("install", () => {
  test("--dry-run prints one link per skill per root and writes nothing", () => {
    const home = scratchHome();
    const { code, out } = run(home, INSTALL, "--dry-run");
    expect(code).toBe(0);
    expect(lines(out, "link ").length).toBe(skillNames.length * 2);
    expect(lines(out, "collision ")).toEqual([]);
    expect(existsSync(join(home, ".agents"))).toBe(false);
    expect(existsSync(join(home, ".claude"))).toBe(false);
  });

  test("links every skill into both default roots and the doctor passes", () => {
    const home = scratchHome();
    const { code, out } = run(home, INSTALL);
    expect(code).toBe(0);
    for (const root of [join(home, ".agents/skills"), join(home, ".claude/skills")]) {
      for (const name of skillNames) {
        expect(realpathSync(join(root, name))).toBe(realpathSync(join(SKILLS, name)));
      }
    }
    expect(lines(out, "missing ")).toEqual([]);
    expect(out).toMatch(new RegExp(`^ok ${join(home, ".agents/skills")}: ${skillNames.length} skills, [1-9]\\d* siblings resolved$`, "m"));
  });

  test("a foreign entry at a skill's name is a collision and nothing is written", () => {
    const home = scratchHome();
    mkdirSync(join(home, ".agents/skills/tdd"), { recursive: true });
    const { code, out } = run(home, INSTALL);
    expect(code).toBe(2);
    expect(lines(out, "collision ")).toEqual([`collision ${join(home, ".agents/skills/tdd")}`]);
    expect(readdirSync(join(home, ".agents/skills"))).toEqual(["tdd"]);
    expect(existsSync(join(home, ".claude"))).toBe(false);
  });
});

describe("doctor", () => {
  test("an explicit optional skip preserves a foreign skill but cannot skip a dependency", () => {
    const home = scratchHome();
    const root = join(home, ".agents/skills");
    expect(run(home, INSTALL).code).toBe(0);
    rmSync(join(root, "setup-pstack-anywhere"));
    mkdirSync(join(root, "setup-pstack-anywhere"));
    copyFileSync(join(SKILLS, "setup-pstack-anywhere/SKILL.md"), join(root, "setup-pstack-anywhere/SKILL.md"));
    const policy = join(root, "setup-pstack-anywhere/install-policy.json");
    rmSync(join(root, "tdd"));
    mkdirSync(join(root, "tdd"));
    writeFileSync(join(root, "tdd/SKILL.md"), "foreign tdd\n");
    const doctor = join(SKILLS, DOCTOR);
    expect(run(home, doctor, root).code).toBe(1);
    writeFileSync(policy, JSON.stringify({ version: 1, skipped: ["tdd"] }));
    const accepted = run(home, doctor, root);
    expect(accepted.code).toBe(0);
    expect(accepted.out).toContain(`skipped ${join(root, "tdd")}`);
    writeFileSync(join(root, "setup-pstack-anywhere/SKILL.md"), "manager overlay\n");
    expect(run(home, doctor, root).code).toBe(1);
    writeFileSync(policy, JSON.stringify({ version: 1, skipped: ["tdd"], definitions: {
      "setup-pstack-anywhere": createHash("sha256").update("manager overlay\n").digest("hex"),
    } }));
    expect(run(home, doctor, root).code).toBe(0);
    writeFileSync(policy, JSON.stringify({ version: 1, skipped: ["poteto-mode"] }));
    expect(run(home, doctor, root).code).toBe(1);
  });
  test("a root holding only the setup skill is missing its siblings", () => {
    const home = scratchHome();
    const root = join(home, ".agents/skills");
    mkdirSync(root, { recursive: true });
    symlinkSync(join(SKILLS, "setup-pstack-anywhere"), join(root, "setup-pstack-anywhere"));
    const { code, out } = run(home, join(root, DOCTOR));
    expect(code).toBe(1);
    expect(lines(out, "missing ")).toContain(`missing ${join(root, "poteto-mode")}`);
    expect(lines(out, "ok ")).toEqual([]);
  });
});
