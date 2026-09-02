// The engine is a CLI, so the tests treat it as one: build a fixture repo,
// point COUPLING_ROOT at it, and assert on exit code and printed lines.
// Importing coupling.mjs is not an option, it calls process.exit at top level.
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { YAML } from "bun";

const REPO = join(dirname(new URL(import.meta.url).pathname), "..");
const ENGINE = join(REPO, "scripts/coupling.mjs");

// Everything the engine reads out of the tree. references/ and skills/ are
// walked whole, so a fixture is a copy of the real inputs, not a stub.
const INPUTS = [
  "coupling.yaml",
  "harnesses.yaml",
  "README.md",
  "PORTABILITY.md",
  "UPSTREAM.md",
  "conformance",
  "evidence",
  "references",
  "skills",
];

const temps = [];

// `overrides` mutates the parsed coupling.yaml, writes files under the fixture,
// or both. Returning nothing keeps the mutated ledger.
function fixtureRepo(overrides) {
  const dir = mkdtempSync(join(tmpdir(), "coupling-fixture-"));
  temps.push(dir);
  const copy = Bun.spawnSync(["cp", "-R", ...INPUTS.map((p) => join(REPO, p)), dir]);
  if (copy.exitCode !== 0) throw new Error(`fixture copy failed: ${copy.stderr.toString()}`);
  if (overrides) {
    const path = join(dir, "coupling.yaml");
    const ledger = YAML.parse(readFileSync(path, "utf8"));
    const replaced = overrides(ledger, dir);
    writeFileSync(path, YAML.stringify(replaced ?? ledger));
  }
  return dir;
}

function run(dir, ...args) {
  const proc = Bun.spawnSync(["bun", ENGINE, ...args], {
    env: { ...process.env, COUPLING_ROOT: dir },
    cwd: dir,
  });
  return { code: proc.exitCode, out: proc.stdout.toString(), err: proc.stderr.toString() };
}

const cellsOf = (ledger, axisId) => ledger.axes.find((a) => a.id === axisId).resolution;

// The engine stamps a run id with today's UTC date, so the tests read the date
// the same way rather than pinning one.
const today = () => new Date().toISOString().slice(0, 10);

let base;

beforeAll(() => {
  base = fixtureRepo();
});

afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe("check on an unmodified copy", () => {
  test("reports unported findings and exits 1", () => {
    const { code, out } = run(base, "check");
    expect(out).toContain("unported findings");
    expect(code).toBe(1);
  });
});

describe("ledger validation", () => {
  test("a fallback on a non-extension cell is a ledger error", () => {
    const dir = fixtureRepo((ledger) => {
      cellsOf(ledger, "human_question").codex.fallback = "x";
    });
    const { code, err } = run(dir, "check");
    expect(err).toContain(
      "axes.human_question.resolution.codex.fallback: only an extension cell carries a fallback",
    );
    expect(err).toContain("1 ledger problem");
    expect(code).toBe(4);
  });

  test("an extension cell without a fallback is a ledger error", () => {
    const dir = fixtureRepo((ledger) => {
      delete cellsOf(ledger, "human_question").pi.fallback;
    });
    const { code, err } = run(dir, "check");
    expect(err).toContain(
      "axes.human_question.resolution.pi.fallback: required on an extension cell",
    );
    expect(code).toBe(4);
  });

  test("an unknown parity value names the five it could be", () => {
    const dir = fixtureRepo((ledger) => {
      cellsOf(ledger, "human_question").codex.parity = "bogus";
    });
    const { code, err } = run(dir, "check");
    expect(err).toContain(
      "axes.human_question.resolution.codex.parity: must be one of native, substitute, extension, degrade, drop",
    );
    expect(code).toBe(4);
  });

  test("a derived key persisted into the ledger is rejected by name", () => {
    const dir = fixtureRepo((ledger) => {
      ledger.axes.find((a) => a.id === "human_question").status = "ported";
    });
    const { code, err } = run(dir, "check");
    expect(err).toContain("status: status is derived and must not be written into the ledger");
    expect(code).toBe(4);
  });
});

describe("command line", () => {
  test("an unknown flag exits 5", () => {
    const { code, err } = run(base, "check", "--bogus");
    expect(err).toContain("Unknown option '--bogus'");
    expect(code).toBe(5);
  });

  // `toString` reaches Object.prototype, so the dispatch guard is what keeps
  // this a usage error instead of calling a function that is not a command.
  test("an unknown command prints the usage line and exits 5", () => {
    const { code, err } = run(base, "toString");
    expect(err).toContain("usage: bun scripts/coupling.mjs <check|status|render|attest|probe>");
    expect(code).toBe(5);
  });
});

describe("render", () => {
  test("--check finds every generated file current in a fresh copy", () => {
    const { code, out } = run(base, "render", "--check");
    expect(out).toContain("current  skills/poteto-mode/capabilities.md");
    expect(out).toContain("current  PORTABILITY.md");
    expect(out).toContain("current  README.md");
    expect(code).toBe(0);
  });

  test("--only with an unknown renderer exits 5", () => {
    const { code, err } = run(base, "render", "--only", "nope");
    expect(err).toContain("--only: unknown renderer nope");
    expect(code).toBe(5);
  });

  // The golden test: what the ledger renders is byte-identical to the three
  // committed files, so a render writes nothing and --check still passes after.
  test("rendering into the fixture rewrites nothing", () => {
    const dir = fixtureRepo();
    const rendered = run(dir, "render");
    expect(rendered.code).toBe(0);
    expect(rendered.out).not.toContain("wrote ");
    expect(rendered.out).toContain("current skills/poteto-mode/capabilities.md");
    expect(rendered.out).toContain("current PORTABILITY.md");
    expect(rendered.out).toContain("current README.md");
    expect(run(dir, "render", "--check").code).toBe(0);
  });
});

describe("probe", () => {
  test("prepare leaves an unexecuted run and refuses to prepare it twice", () => {
    const dir = fixtureRepo();
    const prepared = run(dir, "probe", "prepare", "spawn_worker", "omp");
    expect(prepared.code).toBe(0);
    expect(prepared.out).toContain("prepared evidence/runs/spawn_worker.omp.");
    const runId = prepared.out.match(/prepared evidence\/runs\/(\S+)/)[1];

    const inspected = run(dir, "probe", "inspect", runId);
    expect(inspected.out).toContain("unexecuted");
    expect(inspected.code).toBe(1);

    const again = run(dir, "probe", "prepare", "spawn_worker", "omp");
    expect(again.err).toContain("is already prepared and unexecuted");
    expect(again.code).toBe(5);
  });

  test("a run.yaml that is not a map is void", () => {
    const runId = `spawn_worker.omp.${today()}.99`;
    const dir = fixtureRepo((ledger, root) => {
      mkdirSync(join(root, "evidence/runs", runId), { recursive: true });
      writeFileSync(join(root, "evidence/runs", runId, "run.yaml"), "just a string\n");
    });
    const { code, out } = run(dir, "probe", "inspect", runId);
    expect(out).toContain("void");
    expect(out).toContain("run.yaml is not a map");
    expect(code).toBe(2);
  });

  // The two negatives are in the same fixture as the positive: a pattern that
  // fires on the pack's own placeholder shape or on a harnesses.yaml flag would
  // void every run in the tree, which is a worse failure than missing a leak.
  test("a run whose files carry a secret is void, and lookalikes are not", () => {
    const leaky = `spawn_worker.omp.${today()}.98`;
    const clean = `spawn_worker.omp.${today()}.97`;
    const dir = fixtureRepo((ledger, root) => {
      for (const id of [leaky, clean]) mkdirSync(join(root, "evidence/runs", id), { recursive: true });
      writeFileSync(join(root, "evidence/runs", leaky, "run.yaml"), "scenario: spawn_worker\n");
      writeFileSync(join(root, "evidence/runs", leaky, "transcript.md"), "$ env | sort\nFOO_API_KEY=abcdefghijklmnop\n");
      writeFileSync(join(root, "evidence/runs", clean, "run.yaml"), "scenario: spawn_worker\n");
      writeFileSync(join(root, "evidence/runs", clean, "transcript.md"), "placeholder $$ABC123:M$$\nmodel_flag: --model\n");
    });

    const hit = run(dir, "probe", "inspect", leaky);
    expect(hit.out).toContain("void");
    expect(hit.out).toContain("secret_leak");
    expect(hit.out).toContain("transcript.md:2 FOO_API_KEY");
    expect(hit.out).not.toContain("abcdefghijklmnop");
    expect(hit.code).toBe(2);

    const miss = run(dir, "probe", "inspect", clean);
    expect(miss.out).not.toContain("secret_leak");
    expect(miss.code).not.toBe(2);
  });

  test("a scenario on a path_assumption axis validates", () => {
    const dir = fixtureRepo((_, root) => {
      const path = join(root, "conformance/scenarios.yaml");
      const doc = YAML.parse(readFileSync(path, "utf8"));
      // skill_identify already covers pack_path in the real tree; add a second
      // path_assumption domain so the eligibility check is what this asserts.
      doc.scenarios.push({
        id: "trunk_reread_smoke",
        axis: "trunk_reread",
        applies_to: ["omp"],
        risk: "A stale playbook read is silent.",
        question: "Can the agent re-read through harness skill addressing?",
        setup: { preconditions: ["A scratch dir."], steps: ["Re-read the playbook."] },
        observations: [{ id: "trunk.opened", observe: "Whether the playbook opened.", grounds: "The re-read happened." }],
        parity: { allowed: ["skill:// addressing"], prohibited: ["git show of the pack"] },
        parity_criteria: {
          native: "Opened through harness skill loading.",
          substitute: "Opened by path under the skill root.",
          extension: "Substitute via a recorded extension.",
          degrade: "Opened, but content was paraphrased.",
          drop: "Could not open the playbook.",
        },
        evidence: { extends: "evidence_contract", artifacts: [{ path: "opened.txt", holds: "What was opened." }] },
      });
      writeFileSync(path, YAML.stringify(doc));
    });
    const listed = run(dir, "probe", "list");
    expect(listed.code).toBe(0);
    expect(listed.out).toContain("trunk_reread_smoke  trunk_reread");
    expect(listed.err).not.toContain("is a path_assumption");
    const checked = run(dir, "check");
    expect(checked.err).not.toContain("is a path_assumption");
    expect(checked.code).not.toBe(4);
  });

  test("skill_identify covers pack_path", () => {
    const { code, out } = run(base, "probe", "list");
    expect(code).toBe(0);
    expect(out).toContain("skill_identify  pack_path");
    expect(out).toMatch(/skill_identify[\s\S]*applies to\s+cursor, claude, codex, pi, omp/);
  });
});
