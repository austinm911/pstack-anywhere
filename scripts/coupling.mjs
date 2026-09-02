#!/usr/bin/env bun
// The coupling ledger engine. One module owns loading coupling.yaml, validating
// it, deriving every status from the tree, and rendering the derived files.
//
//   bun scripts/coupling.mjs check     [--gate] [--refresh <upstream>] [--json]
//   bun scripts/coupling.mjs status    [--harness <id>] [--axis <id>] [--json]
//   bun scripts/coupling.mjs render    [--only <renderer>] [--dry-run] [--check]
//   bun scripts/coupling.mjs attest    <reference-path>:<line>[-<line>]
//   bun scripts/coupling.mjs probe     list | prepare <scenario> <harness> | inspect <run-id>
//
// Nothing here writes a status. implementation, parity, and verification are
// computed on every run out of the working tree, the ledger's resolution shape,
// and evidence/attestations.yaml. The loader refuses a ledger that persists any.
//
// `probe` is the conformance half, over conformance/scenarios.yaml. It cannot
// drive a harness and does not pretend to: `prepare` writes an unexecuted run
// manifest and the artifact checklist for one scenario on one harness, `inspect`
// judges a run directory against that scenario's evidence contract. Neither
// writes an attestation, and no state `inspect` reports is a verification.
//
// Exit codes for `check`, so a caller can tell the classes apart:
//   0  clean
//   1  unported findings only, in skills the port has not reached
//   2  a regression in a ported file, or a declared occurrence gone missing
//   3  a derived file on disk no longer matches what the ledger renders
//   4  the ledger, or the evidence joined to it, does not validate
//   5  the command line is wrong
//
// `--gate` maps 1 to 0: skills the port has not reached count in the rendered
// status but never gate. The gate blocks on regressions, stale occurrences,
// drift, and invalid input, which is what a change can cause.
//
// `probe inspect` reuses them for a run directory: 0 complete, 1 unexecuted or
// incomplete, 2 void, 5 no such run.

import { YAML, Glob } from "bun";
import { readFileSync, existsSync, lstatSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname, relative, basename, extname } from "node:path";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const PARITY = ["native", "substitute", "extension", "degrade", "drop"];
// The grounding each method carries. A key belonging to another method is a
// record grounded two ways at once, where only one of them is ever checked.
const METHOD_KEYS = {
  static: ["sources"],
  exercised: ["scenario", "run", "artifacts"],
  observed_local: ["sources", "observation"],
};
const METHODS = Object.keys(METHOD_KEYS);
const DERIVED_KEYS = ["status", "ported", "verified", "implementation", "verification"];

const abs = (p) => join(ROOT, p);
const read = (p) => readFileSync(abs(p), "utf8");
// lstat, not stat: a link out of the repo would satisfy presence,
// content, and digest checks while nothing under this tree holds the bytes.
const lstatOf = (p) => {
  try {
    return lstatSync(abs(p));
  } catch {
    return null;
  }
};
const isFile = (p) => lstatOf(p)?.isFile() === true;
const isDir = (p) => lstatOf(p)?.isDirectory() === true;
const digestOf = (p) => createHash("sha256").update(readFileSync(abs(p))).digest("hex");
const trim = (s) => String(s ?? "").trim();
// One flat map keys every (path, axis) pair the lint attributes.
const cellKey = (path, axis) => `${path}\u0000${axis}`;
// Single root, no fallback: a bare `SKILL.md` would resolve into poteto-mode
// and misattribute the moment a second skill is ported.
const unrooted = (p) => p.startsWith("/") || p.startsWith("./") || p.split("/").includes("..");

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

// A key persisted where it does not belong is hand-authored status under a new
// name, so the loader rejects it by name rather than trusting it.
function rejectKeys(node, path, banned, why, errors) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => rejectKeys(item, `${path}[${i}]`, banned, why, errors));
    return;
  }
  if (node === null || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (banned.includes(key)) errors.push(`${path}.${key}: ${key} ${why}`);
    rejectKeys(value, `${path}.${key}`, banned, why, errors);
  }
}

const rejectDerived = (node, path, errors) =>
  rejectKeys(node, path, DERIVED_KEYS, "is derived and must not be written into the ledger", errors);

function loadLedger() {
  const ledger = YAML.parse(read("coupling.yaml"));
  const errors = [];
  if (ledger.version !== 2) {
    errors.push(`coupling.yaml: version must be 2, found ${JSON.stringify(ledger.version)}`);
  }
  rejectDerived(ledger.axes, "axes", errors);
  rejectDerived(ledger.harnesses, "harnesses", errors);
  return { ledger, errors };
}

// Volatile inputs. The attestation registry may be absent: every cell then
// derives unverified, which is the honest default. The scenario file may not, or
// the coverage check below would pass vacuously with no procedure anywhere.
function loadEvidence(ledger) {
  const paths = ledger.evidence ?? {};
  const pick = (p) => (p && isFile(p) ? YAML.parse(read(p)) : null);
  const scenarioDoc = pick(paths.scenarios);
  const attestationDoc = pick(paths.attestations);
  return {
    paths,
    scenarioDoc,
    attestationDoc,
    scenarios: scenarioDoc?.scenarios ?? [],
    attestations: attestationDoc?.attestations ?? [],
    present: { scenarios: Boolean(scenarioDoc), attestations: Boolean(attestationDoc) },
  };
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

// Every banned pattern belongs to at least one axis. `also` is how one pattern
// covers several axes without being scanned twice: counted once, attributed to all.
function buildTokens(ledger, errors) {
  const ids = new Set(ledger.axes.map((a) => a.id));
  const tokens = [];
  const seen = new Map();
  for (const axis of ledger.axes) {
    for (const [i, token] of (axis.tokens ?? []).entries()) {
      const where = `axes.${axis.id}.tokens[${i}]`;
      let regex;
      try {
        regex = new RegExp(token.pattern, token.flags ?? "");
      } catch (error) {
        errors.push(`${where}: pattern does not compile, ${error.message}`);
        continue;
      }
      // `test` on a /g or /y regex advances lastIndex, and scan reuses one
      // compiled token across every line, so half the hits would vanish.
      if (/[gy]/.test(token.flags ?? "")) {
        errors.push(`${where}.flags: g and y are stateful across lines, drop them`);
      }
      for (const other of token.also ?? []) {
        if (!ids.has(other)) errors.push(`${where}.also: no axis ${other}`);
      }
      if (token.parameter && !(axis.parameters ?? []).some((p) => p.id === token.parameter)) {
        errors.push(`${where}.parameter: ${axis.id} has no parameter ${token.parameter}`);
      }
      const key = `${token.pattern}\u0000${token.flags ?? ""}`;
      if (seen.has(key)) {
        errors.push(`${where}: pattern already owned by ${seen.get(key)}, use \`also\` instead`);
        continue;
      }
      seen.set(key, where);
      tokens.push({
        regex,
        source: token.pattern,
        why: token.why,
        parameter: token.parameter ?? null,
        axes: [axis.id, ...(token.also ?? [])],
      });
    }
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

const dupes = (xs) => new Set(xs).size !== xs.length;

function validate(ledger, tokens, errors) {
  const known = new Set(ledger.harnesses.map((h) => h.id));
  if (known.size !== ledger.harnesses.length) errors.push("harnesses: duplicate id");
  const baselines = ledger.harnesses.filter((h) => h.baseline).length;
  if (baselines !== 1) errors.push(`harnesses: exactly one baseline required, found ${baselines}`);
  for (const h of ledger.harnesses.filter((x) => x.evidence_dir && !isDir(x.evidence_dir))) {
    errors.push(`harnesses.${h.id}.evidence_dir: ${h.evidence_dir} is not a directory`);
  }

  if (dupes(ledger.axes.map((a) => a.id))) errors.push("axes: duplicate id");

  const oneOf = `must be one of ${PARITY.join(", ")}`;
  // `fallback` belongs to extension cells alone: they name a tool that is
  // available but off by default, so the path without it must be spelled out.
  const checkFallback = (cell, at) => {
    const has = trim(cell?.fallback);
    if (cell?.parity === "extension" && !has) {
      errors.push(`${at}.fallback: required on an extension cell, name the path when the extension is absent`);
    } else if (cell?.parity !== "extension" && cell?.fallback !== undefined) {
      errors.push(`${at}.fallback: only an extension cell carries a fallback`);
    }
  };
  const checkCells = (cells, where) => {
    for (const id of known) if (!Object.hasOwn(cells, id)) errors.push(`${where}: no cell for harness ${id}`);
    for (const [id, cell] of Object.entries(cells)) {
      if (!known.has(id)) errors.push(`${where}.${id}: unknown harness`);
      if (!PARITY.includes(cell?.parity)) errors.push(`${where}.${id}.parity: ${oneOf}`);
      if (!trim(cell?.use)) errors.push(`${where}.${id}.use: empty, name the path explicitly`);
      checkFallback(cell, `${where}.${id}`);
    }
  };

  for (const axis of ledger.axes) {
    const where = `axes.${axis.id}`;
    const shapes = ["resolution", "invariant", "parameters"].filter((k) => axis[k] !== undefined);
    if (axis.portable && shapes.length > 0) {
      errors.push(`${where}: portable axes carry no resolution, found ${shapes.join(" and ")}`);
    } else if (!axis.portable && shapes.length !== 1) {
      errors.push(`${where}: exactly one of resolution, invariant, parameters, found ${shapes.length}`);
    }

    if (axis.resolution) checkCells(axis.resolution, `${where}.resolution`);
    if (axis.invariant) {
      if (!PARITY.includes(axis.invariant.parity)) errors.push(`${where}.invariant.parity: ${oneOf}`);
      if (!trim(axis.invariant.use)) errors.push(`${where}.invariant.use: empty`);
      checkFallback(axis.invariant, `${where}.invariant`);
    }
    if (axis.parameters) {
      if (dupes(axis.parameters.map((p) => p.id))) errors.push(`${where}.parameters: duplicate id`);
      for (const p of axis.parameters) {
        checkCells(p.resolution ?? {}, `${where}.parameters.${p.id}.resolution`);
      }
    }

    // Every axis is anchored: either it names occurrences, or it says why it
    // cannot. An unanchored axis is invisible to a refresh diff.
    const occ = axis.occurrences ?? [];
    const reason = trim(axis.no_occurrences);
    if (occ.length === 0 && !reason) errors.push(`${where}: no occurrences and no no_occurrences reason`);
    if (occ.length > 0 && reason) errors.push(`${where}: declares both occurrences and no_occurrences`);
    const paths = new Set();
    for (const [i, { path }] of occ.entries()) {
      const at = `${where}.occurrences[${i}]`;
      if (typeof path !== "string" || path.length === 0) {
        errors.push(`${at}.path: missing`);
        continue;
      }
      if (unrooted(path)) errors.push(`${at}.path: ${path} must be plain repo-relative`);
      if (paths.has(path)) errors.push(`${at}.path: ${path} declared twice on this axis`);
      paths.add(path);
    }
  }

  for (const [i, { path }] of (ledger.lint?.allowlist ?? []).entries()) {
    const dir = path.endsWith("/");
    if (!(dir ? isDir(path) : isFile(path))) {
      errors.push(`lint.allowlist[${i}].path: ${path} ${dir ? "is not a directory" : "is not a file"}`);
    }
  }

  for (const [i, entry] of (ledger.generated ?? []).entries()) {
    const at = `generated[${i}]`;
    if (!RENDERERS[entry.renderer]) errors.push(`${at}.renderer: no renderer ${entry.renderer}`);
    if (!["rendered", "planned"].includes(entry.state)) errors.push(`${at}.state: must be rendered or planned`);
    if (entry.state === "rendered" && !isFile(entry.path)) {
      errors.push(`${at}: state rendered but ${entry.path} is not on disk`);
    }
    // A markered target replaces one region of a hand-written file. Without the
    // region the renderer has nowhere to write, a ledger error rather than a
    // surprise at write time.
    if (entry.marker && isFile(entry.path)) {
      const { begin, end } = marker(entry.marker);
      const text = read(entry.path);
      if (!text.includes(begin) || !text.includes(end)) {
        errors.push(`${at}.marker: ${entry.path} has no \`${begin}\` … \`${end}\` region`);
      }
    }
  }

  // `scan` dereferences all four unguarded. A missing cursor pattern is worse
  // than a crash: `new RegExp(undefined)` compiles to /undefined/, which matches
  // nothing real and passes silently.
  if (!trim(ledger.lint?.scan)) errors.push("lint.scan: missing, the lint would have nothing to walk");
  for (const key of ["pattern", "context_exempt", "why"]) {
    if (!trim(ledger.lint?.cursor_mentions?.[key])) errors.push(`lint.cursor_mentions.${key}: missing`);
  }
  if (tokens.length === 0) errors.push("axes: no tokens, the lint would pass vacuously");
}

// A prose claim about the tree, counted rather than asserted.
function checkAsserts(ledger, errors) {
  const skills = readdirSync(abs("skills")).filter((n) => isFile(`skills/${n}/SKILL.md`)).sort();
  for (const axis of ledger.axes) {
    const claim = axis.assert;
    if (!claim) continue;
    const where = `axes.${axis.id}.assert`;
    if (claim.kind !== "frontmatter_key_count") {
      errors.push(`${where}.kind: unknown assertion ${claim.kind}`);
      continue;
    }
    // Without a guard `[claim.key]` yields `[undefined]`, which compiles to
    // /^(undefined):/ and counts nothing while looking like a real assertion.
    const spellings = claim.spellings ?? (claim.key ? [claim.key] : null);
    if (!listed(spellings)) {
      errors.push(`${where}: needs key or spellings`);
      continue;
    }
    const pattern = new RegExp(`^(${spellings.join("|")}):`, "m");
    let hits = 0;
    for (const name of skills) {
      const front = read(`skills/${name}/SKILL.md`).match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (front && pattern.test(front[1])) hits += 1;
    }
    if (hits !== claim.expect || skills.length !== claim.of) {
      errors.push(`${where}: claims ${claim.expect} of ${claim.of}, tree has ${hits} of ${skills.length}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Lint
// ---------------------------------------------------------------------------

// A finding is a token hit, attributed to the axes that own the token. The
// cursor_mentions pattern belongs to no axis, so its findings carry none.
function scan(ledger, tokens) {
  // A directory allowlist entry ends with a slash and exempts its whole subtree;
  // a file entry must match exactly, or `capabilities.md` would also exempt
  // `capabilities.md.bak`.
  const allowlist = (ledger.lint?.allowlist ?? []).map((entry) => entry.path);
  const allowed = (file) => allowlist.some((p) => (p.endsWith("/") ? file.startsWith(p) : file === p));
  const ignores = (ledger.lint.ignore_substrings ?? []).map((entry) => entry.value);
  const files = [...new Glob(ledger.lint.scan).scanSync(ROOT)].sort();
  const cursor = ledger.lint.cursor_mentions;
  const cursorRegex = new RegExp(cursor.pattern, cursor.flags ?? "");
  const exemptRegex = new RegExp(cursor.context_exempt, cursor.context_exempt_flags ?? "");

  const findings = [];

  for (const file of files) {
    if (allowed(file)) continue;
    const lines = read(file).split("\n");
    lines.forEach((line, index) => {
      const text = ignores.reduce((masked, value) => masked.replaceAll(value, ""), line);
      const at = (hit, why, axes, parameter) =>
        findings.push({ file, line: index + 1, hit, why, axes, parameter });
      for (const token of tokens) {
        if (token.regex.test(text)) at(token.source, token.why, token.axes, token.parameter);
      }
      if (cursorRegex.test(text) && !exemptRegex.test(text)) at("Cursor", cursor.why, [], null);
    });
  }

  // A cell's hits are the findings that named its axis, projected: the pattern
  // for machine consumers, the token's `why` so a reader-facing table can print a
  // human label, the parameter a parameter_set occurrence touched, and the line.
  const hitsByFile = new Map();
  for (const { file, line, hit, why, axes, parameter } of findings) {
    for (const axis of axes) {
      const key = cellKey(file, axis);
      if (!hitsByFile.has(key)) hitsByFile.set(key, []);
      hitsByFile.get(key).push({ source: hit, why, parameter, line });
    }
  }
  return { files, findings, hitsByFile, allowed, scannable: new Set(files) };
}

// ---------------------------------------------------------------------------
// Derive
// ---------------------------------------------------------------------------

// Only the class and the axis-level parity are read. A parameter axis reports
// parity per parameter at the call site, so folding one here displays nothing.
function axisParity(axis, harnessId) {
  if (axis.portable) return { parity: null, class: "portable-unchanged" };
  if (axis.invariant) return { parity: axis.invariant.parity, class: "invariant" };
  if (axis.resolution) {
    const cell = axis.resolution[harnessId];
    return cell ? { parity: cell.parity, class: "coupled" } : { parity: null, class: "unknown" };
  }
  const covered = axis.parameters.some((p) => p.resolution[harnessId]);
  return { parity: null, class: covered ? "coupled" : "unknown" };
}

// The port reached a skill when the ledger declares an occurrence in it. A token
// hit there is a regression; the same hit in an unreached skill is unported work.
function portedSkills(ledger) {
  const named = ledger.axes.flatMap((a) => (a.occurrences ?? []).map((o) => skillOf(o.path)));
  return new Set(named.filter(Boolean));
}

const skillOf = (file) => {
  const parts = file.split("/");
  return parts[0] === "skills" && parts.length > 1 ? parts[1] : null;
};

// One occurrence, whatever the lint found in it. `hits` stays the list of
// patterns so machine consumers read what they always read; `parameters` is what
// makes a parameter_set occurrence say `worker_defaults.identity` rather than
// claiming the whole set.
function summarizeHits(axis, entries) {
  const order = (axis.parameters ?? []).map((p) => p.id);
  const uniq = (values) => [...new Set(values.filter(Boolean))];
  return {
    hits: uniq(entries.map((e) => e.source)),
    reasons: uniq(entries.map((e) => e.why)),
    parameters: uniq(entries.map((e) => e.parameter)).sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    lines: [...new Set(entries.map((e) => e.line))].sort((a, b) => a - b),
  };
}

function deriveOccurrences(ledger, scanned, errors) {
  const axisById = new Map(ledger.axes.map((a) => [a.id, a]));
  const rows = [];
  const declared = new Set();

  for (const axis of ledger.axes) {
    for (const { path, unscannable } of axis.occurrences ?? []) {
      const key = cellKey(path, axis.id);
      declared.add(key);
      const reachable = scanned.scannable.has(path) && !scanned.allowed(path);
      const found = summarizeHits(axis, scanned.hitsByFile.get(key) ?? []);
      let implementation = found.hits.length > 0 ? "unported" : "ported";
      if (!isFile(path)) implementation = "missing";
      else if (!reachable) {
        // Declared but outside the lint's reach. Left unstated, the ledger is
        // claiming a check nobody runs.
        implementation = "unverifiable";
        if (!trim(unscannable)) {
          errors.push(
            `axes.${axis.id}.occurrences: ${path} is not reachable by lint.scan, declare \`unscannable\` with the reason`,
          );
        }
      }
      rows.push({
        axis: axis.id,
        kind: axis.kind,
        path,
        declared: true,
        implementation,
        ...found,
        note: trim(unscannable) || null,
      });
    }
  }

  // Attributed hits at paths the ledger does not declare. Synthesized rather
  // than hand-written, so the unported surface stays a measurement.
  for (const [key, entries] of scanned.hitsByFile) {
    if (declared.has(key)) continue;
    const [path, axisId] = key.split("\u0000");
    const axis = axisById.get(axisId);
    rows.push({
      axis: axisId,
      kind: axis.kind,
      path,
      declared: false,
      implementation: "unported",
      ...summarizeHits(axis, entries),
      note: null,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Conformance: the scenario contract
// ---------------------------------------------------------------------------

const SHA256 = /^[0-9a-f]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UTC_STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const RUN_ID = /^([a-z0-9_]+)\.([a-z0-9_]+)\.(\d{4}-\d{2}-\d{2})\.(\d{2,})$/;

// The regex is the enforcement; scenarios.yaml states the same shape as prose
// under `run_id.form`, and validateContract holds the two to each other.
const RUN_ID_FORM = "<scenario-id>.<harness-id>.<YYYY-MM-DD>.<counter>";

// What the engine requires of every manifest whatever the contract adds.
const RUN_STAMPS = ["started_at", "ended_at"];
const RUN_IDENTITY = ["operator", "machine", "os", "harness_version"];
const runDir = (ledger, runId) => join(ledger.evidence.runs, runId);

const filled = (value) => trim(value).length > 0;
const listed = (value) => Array.isArray(value) && value.length > 0;
const requireFilled = (at, obj, fields, errors) => {
  for (const f of fields) if (!filled(obj?.[f])) errors.push(`${at}.${f}: missing`);
};
const requireListed = (at, obj, fields, errors, why = "missing") => {
  for (const f of fields) if (!listed(obj?.[f])) errors.push(`${at}.${f}: ${why}`);
};
const rejectUnknown = (at, node, keys, what, errors) => {
  for (const key of Object.keys(node ?? {})) {
    if (!keys.includes(key)) errors.push(`${at}.${key}: not part of the ${what} schema`);
  }
};
const cellLabel = ({ axis, parameter }) => (parameter ? `${axis}.${parameter}` : axis);

// Bun's YAML hands back a Date for some unquoted timestamps, and a Date
// stringifies to something no reader would recognise as the recorded day.
const asDay = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : trim(value));
const asStamp = (value) =>
  value instanceof Date ? value.toISOString().replace(/\.\d+Z$/, "Z") : trim(value);

// A scenario is a procedure and a rubric. Any key that could hold what happened
// is rejected by name: an outcome stored beside the procedure recomputes nothing.
const SCENARIO_KEYS = [
  "id",
  "axis",
  "parameter",
  "applies_to",
  "risk",
  "question",
  "setup",
  "observations",
  "parity",
  "parity_criteria",
  "evidence",
];
const OBSERVATION_KEYS = ["id", "observe", "grounds", "unsatisfiable_when"];
const OUTCOME_KEYS = [
  "result",
  "results",
  "outcome",
  "pass",
  "passed",
  "failed",
  "satisfied",
  "verdict",
  "run",
  "runs",
];
const OUTCOME_WHY =
  "would hold what happened; a scenario is a procedure, and results live under evidence/runs/";

// The scope conformance/scenarios.yaml claims: the axes where a wrong cell
// changes what a playbook does instead of failing loudly, derived from the
// ledger so a new capability axis arrives uncovered and the coverage check
// names it. These are domains, not cells: an axis plus, for a parameter set,
// one parameter, with no harness in it, so each spans every harness.
const highRiskDomains = (ledger) =>
  ledger.axes.flatMap((axis) =>
    axis.kind === "capability"
      ? [{ axis: axis.id, parameter: null, kind: axis.kind }]
      : axis.kind === "parameter_set"
        ? (axis.parameters ?? []).map((p) => ({ axis: axis.id, parameter: p.id, kind: axis.kind }))
        : [],
  );

// An artifact with no `holds` is a filename whose contents an operator guesses.
function readArtifacts(where, list, errors) {
  const artifacts = [];
  const seen = new Set();
  for (const [i, entry] of (list ?? []).entries()) {
    const at = `${where}[${i}]`;
    const path = trim(entry?.path);
    if (!path) {
      errors.push(`${at}.path: missing`);
      continue;
    }
    if (unrooted(path)) {
      errors.push(`${at}.path: ${path} must be plain run-relative`);
      continue;
    }
    if (seen.has(path)) {
      errors.push(`${at}.path: ${path} declared twice`);
      continue;
    }
    seen.add(path);
    if (!filled(entry.holds)) errors.push(`${at}.holds: ${path} needs to say what it holds`);
    artifacts.push({ path, holds: trim(entry.holds) });
  }
  return artifacts;
}

// The contract every run extends. Each `required_metadata` entry is one
// `field: what it holds` pair, and the field name is what the engine then
// requires in a run's manifest; prose here would be a rule nothing checks.
function validateContract(where, contract, errors) {
  const at = `${where}.evidence_contract`;
  if (!contract) {
    errors.push(`${at}: missing, so no run has an artifact set to be complete against`);
    return null;
  }
  if (!filled(contract.run_dir)) errors.push(`${at}.run_dir: missing`);
  if (!filled(contract.run_id?.form)) errors.push(`${at}.run_id.form: missing`);
  else if (trim(contract.run_id.form) !== RUN_ID_FORM) {
    errors.push(`${at}.run_id.form: the engine enforces ${RUN_ID_FORM}, and a declared form it does not read is a rule that only prints`);
  }

  const artifacts = readArtifacts(`${at}.required_artifacts`, contract.required_artifacts, errors);
  if (artifacts.length === 0) {
    errors.push(`${at}.required_artifacts: a run with no required artifact proves nothing`);
  }
  // inspectRun reads both by name, so a contract that stops requiring them
  // makes every manifest and observation check optional.
  for (const path of ["run.yaml", "observations.yaml"].filter((p) => !artifacts.some((a) => a.path === p))) {
    errors.push(`${at}.required_artifacts: ${path} is read by name and has to be required here`);
  }

  const metadata = [];
  for (const [i, entry] of (contract.required_metadata ?? []).entries()) {
    const mat = `${at}.required_metadata[${i}]`;
    const keys = entry && typeof entry === "object" && !Array.isArray(entry) ? Object.keys(entry) : [];
    if (keys.length !== 1) {
      errors.push(`${mat}: must be one \`field: what it holds\` pair`);
      continue;
    }
    if (!filled(entry[keys[0]])) errors.push(`${mat}.${keys[0]}: missing`);
    if (metadata.includes(keys[0])) errors.push(`${mat}.${keys[0]}: declared twice`);
    metadata.push(keys[0]);
  }
  if (metadata.length === 0) errors.push(`${at}.required_metadata: missing`);

  if (contract.digests?.algorithm !== "sha256") {
    errors.push(`${at}.digests.algorithm: must be sha256, the only algorithm the engine computes`);
  }
  requireFilled(`${at}.digests`, contract.digests, ["covers", "authored_by"], errors);
  requireFilled(at, contract, ["unsatisfiable_observations", "supersession"], errors);

  return {
    runIdForm: trim(contract.run_id?.form),
    artifacts: artifacts.map((a) => a.path),
    holds: new Map(artifacts.map((a) => [a.path, a.holds])),
    metadata,
  };
}

// The observations a scenario declares, in its own order, plus the ids it
// licenses a run to waive. A run's observations.yaml is judged against this.
function readObservations(where, scenario, errors) {
  const observations = [];
  // An observation may only be waived where the scenario says when that is
  // legal, or the engine cannot tell a declared waiver from a free-text excuse.
  const waivable = new Set();
  if (!listed(scenario.observations)) errors.push(`${where}.observations: a scenario observes nothing`);
  for (const [j, observation] of (scenario.observations ?? []).entries()) {
    const oat = `${where}.observations[${j}]`;
    rejectUnknown(oat, observation, OBSERVATION_KEYS, "observation", errors);
    const oid = trim(observation?.id);
    if (!oid) errors.push(`${oat}.id: missing`);
    else if (observations.includes(oid)) errors.push(`${oat}.id: ${oid} declared twice`);
    requireFilled(oat, observation, ["observe", "grounds"], errors);
    // The condition is the licence, so it has to be written. A bare `true`
    // stringifies to something non-empty and would enroll the id as waivable.
    if ("unsatisfiable_when" in (observation ?? {})) {
      const when = observation.unsatisfiable_when;
      if (typeof when !== "string" || !filled(when)) {
        errors.push(`${oat}.unsatisfiable_when: name the condition, an empty waiver licenses every excuse`);
      } else if (oid) waivable.add(oid);
    }
    if (oid) observations.push(oid);
  }
  // A scenario whose every observation may be waived is one a run completes by
  // observing nothing. The waiver is a narrow licence, never a way out.
  if (observations.length > 0 && waivable.size === observations.length) {
    errors.push(`${where}.observations: every observation declares unsatisfiable_when, so a run could complete this scenario while observing nothing`);
  }
  return { observations, waivable };
}

// Run and record paths are joined against these three; a missing one would reach node:path as undefined.
function validateEvidencePaths(ledger, errors) {
  for (const key of ["runs", "scenarios", "attestations"]) {
    if (!filled(ledger.evidence?.[key])) {
      errors.push(`coupling.yaml.evidence.${key}: name a path, every ${key} path is joined against it`);
    }
  }
}

// Everything a scenario has to declare before a run of it could mean anything,
// plus the coverage join back onto the ledger. Coverage is per domain, and
// `applies_to` spreads one scenario over that domain's harness cells. No axis,
// no scenario, or two scenarios over one domain: the set and the ledger disagree.
function validateScenarios(ledger, evidence, errors) {
  validateEvidencePaths(ledger, errors);
  const at = ledger.evidence?.scenarios;
  const empty = { byId: new Map(), contract: null, coverage: [], voidConditions: [] };
  if (!at) {
    errors.push("coupling.yaml.evidence.scenarios: no conformance file declared");
    return empty;
  }
  const doc = evidence.scenarioDoc;
  if (!doc) {
    errors.push(`${at}: declared in coupling.yaml and not on disk, so no high-risk domain has a procedure`);
    return empty;
  }

  if (doc.version !== 1) {
    errors.push(`${at}.version: must be 1, found ${JSON.stringify(doc.version ?? null)}`);
  }
  rejectKeys(doc.scenarios, "scenarios", [...DERIVED_KEYS, ...OUTCOME_KEYS], OUTCOME_WHY, errors);

  const ledgerHarnesses = ledger.harnesses.map((h) => h.id);
  const harnesses = doc.harnesses ?? [];
  if (!listed(harnesses)) errors.push(`${at}.harnesses: name the harnesses a scenario may apply to`);
  for (const id of harnesses) {
    if (!ledgerHarnesses.includes(id)) errors.push(`${at}.harnesses: unknown harness ${id}`);
  }
  for (const id of ledgerHarnesses) {
    if (!harnesses.includes(id)) {
      errors.push(`${at}.harnesses: coupling.yaml declares ${id} and this file exempts it`);
    }
  }

  // A rubric arm missing is a parity value no run could ever earn, which reads
  // in a report as a harness that never degrades.
  requireFilled(`${at}.parity_rubric`, doc.parity_rubric, PARITY, errors);

  const voidConditions = [];
  if (!listed(doc.void_conditions)) {
    errors.push(`${at}.void_conditions: a run that cannot be voided cannot fail`);
  }
  for (const [i, condition] of (doc.void_conditions ?? []).entries()) {
    const cat = `${at}.void_conditions[${i}]`;
    const id = trim(condition?.id);
    if (!id) errors.push(`${cat}.id: missing`);
    else if (voidConditions.some((c) => c.id === id)) errors.push(`${cat}.id: ${id} declared twice`);
    requireFilled(cat, condition, ["when", "why"], errors);
    voidConditions.push({ id, when: trim(condition?.when), why: trim(condition?.why) });
  }

  const contract = validateContract(at, doc.evidence_contract, errors);
  const byId = new Map();
  const axisById = new Map(ledger.axes.map((a) => [a.id, a]));

  for (const [i, scenario] of (contract ? (doc.scenarios ?? []) : []).entries()) {
    const sat = `${at}.scenarios[${i}]`;
    rejectUnknown(sat, scenario, SCENARIO_KEYS, "scenario", errors);
    const id = trim(scenario?.id);
    if (!id) {
      errors.push(`${sat}.id: missing`);
      continue;
    }
    const where = `${at}.scenarios.${id}`;
    if (byId.has(id)) {
      errors.push(`${where}: declared twice`);
      continue;
    }

    const axis = axisById.get(scenario.axis);
    if (!axis) {
      errors.push(`${where}.axis: no axis ${scenario.axis}`);
      continue;
    }
    if (!["capability", "parameter_set"].includes(axis.kind)) {
      errors.push(
        `${where}.axis: ${axis.id} is a ${axis.kind}; a scenario covers a capability or a parameter of a parameter set`,
      );
    }
    const parameter = scenario.parameter ?? null;
    if (axis.kind === "parameter_set") {
      const names = (axis.parameters ?? []).map((p) => p.id);
      if (!parameter) errors.push(`${where}.parameter: ${axis.id} is a parameter set, name the parameter`);
      else if (!names.includes(parameter)) {
        errors.push(`${where}.parameter: ${axis.id} has no parameter ${parameter}`);
      }
    } else if (parameter) {
      errors.push(`${where}.parameter: ${axis.id} takes no parameter`);
    }

    const appliesTo = scenario.applies_to ?? [];
    if (!listed(appliesTo)) errors.push(`${where}.applies_to: a scenario that applies to no harness is unrunnable`);
    if (new Set(appliesTo).size !== appliesTo.length) errors.push(`${where}.applies_to: duplicate harness`);
    for (const harness of appliesTo) {
      if (!harnesses.includes(harness)) errors.push(`${where}.applies_to: ${harness} is not in ${at}.harnesses`);
    }

    requireFilled(where, scenario, ["risk", "question"], errors);
    requireListed(`${where}.setup`, scenario.setup, ["preconditions", "steps"], errors);

    const { observations, waivable } = readObservations(where, scenario, errors);

    requireListed(`${where}.parity`, scenario.parity, ["allowed", "prohibited"], errors, "enumerate them, an unenumerated difference is a finding");
    requireFilled(`${where}.parity_criteria`, scenario.parity_criteria, PARITY, errors);

    if (scenario.evidence?.extends !== "evidence_contract") {
      errors.push(`${where}.evidence.extends: must be evidence_contract`);
    }
    const extra = readArtifacts(`${where}.evidence.artifacts`, scenario.evidence?.artifacts, errors);
    for (const artifact of extra) {
      if (contract.artifacts.includes(artifact.path)) {
        errors.push(`${where}.evidence.artifacts: ${artifact.path} is already required by evidence_contract`);
      }
    }

    byId.set(id, {
      id,
      axis: axis.id,
      parameter,
      appliesTo,
      observations,
      waivable,
      artifacts: [...contract.artifacts, ...extra.map((a) => a.path)],
      holds: new Map([...contract.holds, ...extra.map((a) => [a.path, a.holds])]),
    });
  }

  const scenarios = [...byId.values()];
  const coverage = highRiskDomains(ledger).map((domain) => {
    const covering = scenarios.filter((s) => s.axis === domain.axis && s.parameter === domain.parameter);
    if (covering.length === 0) {
      errors.push(
        `${at}.scenarios: nothing covers ${cellLabel(domain)}, which coupling.yaml declares as a ${domain.kind}`,
      );
    }
    if (covering.length > 1) {
      errors.push(
        `${at}.scenarios: ${covering.map((s) => s.id).join(" and ")} both cover ${cellLabel(domain)}, a domain has one procedure`,
      );
    }
    return { ...domain, scenario: covering[0] ?? null };
  });

  return { byId, contract, coverage, voidConditions };
}

// ---------------------------------------------------------------------------
// Conformance: runs
// ---------------------------------------------------------------------------

// Every regular file under a run directory, run-relative and sorted. Digests
// cover every file and not just the declared artifacts, so a file that appeared
// after the record was written is something the record has to answer for.
// A Dirent never resolves a symlink, so a link to a directory reports
// isDirectory() === false and digestOf would throw EISDIR on it, taking the
// whole check down: anything that is neither a real directory nor a real file
// is returned separately and reported, never hashed.
function runFiles(dir) {
  const found = [];
  const irregular = [];
  const walk = (rel) => {
    const entries = readdirSync(abs(rel ? join(dir, rel) : dir), { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(next);
      else if (entry.isFile()) found.push(next);
      else irregular.push(next);
    }
  };
  walk("");
  return { files: found, irregular };
}

// The two legal shapes of one observations.yaml entry, as sorted key lists. An
// entry is compared whole, so there is no blend for a check order to resolve.
const SATISFIED_SHAPE = "id, observed, source";
const WAIVED_SHAPE = "id, unsatisfiable";

// One judgement of a run directory, shared by `probe inspect` and by every
// attestation that cites a run, so the two cannot disagree. States, ordered by
// how much a reader may conclude from them: absent (no directory), unexecuted
// (prepared, what `probe prepare` leaves behind), incomplete (run, and the
// contract is not satisfied), void (a void_condition fired, so re-execute),
// complete (the contract is satisfied, and still not a verification: a record
// has to exist, validate, and carry fresh digests). Also the report shape, so
// the enumeration and the absent case cannot drift apart.
function blankRun(ledger, runId) {
  return {
    runId,
    dir: runDir(ledger, runId),
    scenario: null,
    harness: null,
    state: "absent",
    voided: null,
    problems: [],
    missing: [],
    empty: [],
    irregular: [],
    supersedes: null,
    supersededBy: null,
    files: [],
    digests: [],
  };
}

function absentRun(ledger, runId) {
  const out = blankRun(ledger, runId);
  out.problems.push(
    existsSync(abs(out.dir)) ? `${out.dir} is not a run directory` : `${out.dir} does not exist`,
  );
  return out;
}

function inspectRun(ledger, conformance, runId) {
  const dir = runDir(ledger, runId);
  if (!isDir(dir)) return absentRun(ledger, runId);
  const out = blankRun(ledger, runId);

  const walked = runFiles(dir);
  out.files = walked.files;
  out.irregular = walked.irregular;
  out.digests = out.files.map((path) => ({ path, digest: digestOf(join(dir, path)) }));
  if (out.irregular.length > 0) {
    out.problems.push(`not regular files, so nothing here digests them: ${out.irregular.join(", ")}`);
  }

  const voidRun = (condition, message) => {
    out.state = "void";
    out.voided = condition;
    out.problems.push(message);
    return out;
  };

  const parsed = RUN_ID.exec(runId);
  if (!parsed) {
    return voidRun(null, `run id does not match ${conformance.contract?.runIdForm ?? "the run id form"}`);
  }
  const [, scenarioId, harnessId] = parsed;
  out.scenario = scenarioId;
  out.harness = harnessId;

  const scenario = conformance.byId.get(scenarioId);
  if (!scenario) return voidRun(null, `no scenario ${scenarioId} in ${ledger.evidence.scenarios}`);
  if (!scenario.appliesTo.includes(harnessId)) {
    return voidRun(null, `${scenarioId} applies to ${scenario.appliesTo.join(", ")}, not ${harnessId}`);
  }

  // Presence and content are read together so every exit describes the same
  // directory. The walk above listed every regular file, so nothing re-stats.
  const present = new Set(out.files);
  for (const path of scenario.artifacts) {
    if (!present.has(path)) out.missing.push(path);
    else if (!filled(read(join(dir, path)))) out.empty.push(path);
  }

  // Emptiness is judged before the manifest parses: a whitespace-only run.yaml
  // parses to null and would otherwise read as unexecuted, the softer state.
  const manifestPath = join(dir, "run.yaml");
  const manifestText = isFile(manifestPath) ? read(manifestPath) : null;
  if (!filled(manifestText)) {
    const why = manifestText === null ? "is absent" : "holds nothing";
    out.state = "incomplete";
    out.problems.push(`run.yaml ${why}, so nothing says what this directory is`);
    return out;
  }
  let manifest = null;
  try {
    manifest = YAML.parse(manifestText);
  } catch (error) {
    return voidRun(null, `run.yaml does not parse, ${error.message}`);
  }
  // A scalar or a list parses fine and carries no field at all, so without this
  // the timestamp test below reads the emptiest run.yaml there is as prepared.
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return voidRun(null, "run.yaml is not a map, so nothing in it says what this directory holds");
  }
  const stamps = RUN_STAMPS.map((field) => asStamp(manifest?.[field]));
  const [started, ended] = stamps;

  // A prepared manifest carries no timestamps: that is the whole difference
  // between a directory waiting for a run and one that holds one.
  if (!filled(started) && !filled(ended)) {
    out.state = "unexecuted";
    out.problems.push("started_at and ended_at are unset: prepared, not run");
    return out;
  }

  for (const [field, expected] of [
    ["scenario", scenarioId],
    ["harness", harnessId],
    ["run_id", runId],
  ]) {
    if (trim(manifest?.[field]) !== expected) {
      out.problems.push(`run.yaml.${field}: must be ${expected}, found ${JSON.stringify(manifest?.[field] ?? null)}`);
    }
  }
  if (manifest?.coupling_version !== ledger.version) {
    out.problems.push(
      `run.yaml.coupling_version: authored against ${JSON.stringify(manifest?.coupling_version ?? null)}, the ledger is v${ledger.version}`,
    );
  }
  for (const field of [...RUN_IDENTITY, ...conformance.contract.metadata]) {
    if (!filled(manifest?.[field])) out.problems.push(`run.yaml.${field}: required by the evidence contract`);
  }
  for (const [i, field] of RUN_STAMPS.entries()) {
    if (!UTC_STAMP.test(stamps[i])) out.problems.push(`run.yaml.${field}: needs a UTC timestamp with an offset`);
  }
  if (UTC_STAMP.test(started) && UTC_STAMP.test(ended) && Date.parse(ended) < Date.parse(started)) {
    out.problems.push("run.yaml: ended_at precedes started_at");
  }
  // A correction replaces one earlier run of the same scenario on the same
  // harness, and comes after it. Without both halves `supersedes` is an erasure
  // primitive; strict ordering on (date, counter) makes a cycle unrepresentable.
  const supersedes = trim(manifest?.supersedes);
  if (supersedes) {
    out.supersedes = supersedes;
    const target = RUN_ID.exec(supersedes);
    if (supersedes === runId) {
      out.problems.push("run.yaml.supersedes: a run cannot supersede itself");
    } else if (!target) {
      out.problems.push(
        `run.yaml.supersedes: ${supersedes} does not match ${conformance.contract?.runIdForm ?? "the run id form"}`,
      );
    } else if (!isDir(runDir(ledger, supersedes))) {
      out.problems.push(`run.yaml.supersedes: no run ${supersedes}`);
    } else if (target[1] !== scenarioId || target[2] !== harnessId) {
      out.problems.push(
        `run.yaml.supersedes: ${supersedes} is a run of ${target[1]} on ${target[2]}; a correction replaces a run of ${scenarioId} on ${harnessId}`,
      );
    } else if (target[3] > parsed[3] || (target[3] === parsed[3] && Number(target[4]) >= Number(parsed[4]))) {
      out.problems.push(
        `run.yaml.supersedes: ${supersedes} is not earlier than ${runId}; a correction comes after the run it corrects`,
      );
    }
  }

  if (out.missing.length > 0) out.problems.push(`missing required artifacts: ${out.missing.join(", ")}`);
  if (out.empty.length > 0) out.problems.push(`required artifacts are empty: ${out.empty.join(", ")}`);

  // Silence is the cheapest way to manufacture a pass, so an observation set
  // that is not the scenario's own set, in its own order, voids. An empty file
  // is already listed by the artifact pass, so it stops here instead of voiding.
  const observationsPath = join(dir, "observations.yaml");
  const observationsText = isFile(observationsPath) ? read(observationsPath) : null;
  if (filled(observationsText)) {
    const voidObs = (message) => voidRun("missing_observation", message);
    let doc = null;
    try {
      doc = YAML.parse(observationsText);
    } catch (error) {
      return voidObs(`observations.yaml does not parse, ${error.message}`);
    }
    // Anything but a list records no observation, and mapping over it would take
    // down every command rather than void one run.
    if (!Array.isArray(doc?.observations)) {
      return voidObs("observations.yaml: observations is not a list, so the file records nothing");
    }
    const entries = doc.observations;
    const ids = entries.map((entry) => trim(entry?.id));
    if (ids.join("\u0000") !== scenario.observations.join("\u0000")) {
      return voidObs(
        `observations.yaml: needs one entry per declared observation, in scenario order (${scenario.observations.join(", ")}), found ${ids.length > 0 ? ids.join(", ") : "none"}`,
      );
    }
    // An entry is one shape or the other and never a blend: anything else argues
    // both ways, and the reading that wins would be an accident of check order.
    for (const [i, entry] of entries.entries()) {
      const oat = `observations.yaml[${i}] ${ids[i]}`;
      const shape =
        entry && typeof entry === "object" && !Array.isArray(entry) ? Object.keys(entry).sort().join(", ") : null;
      if (shape !== SATISFIED_SHAPE && shape !== WAIVED_SHAPE) {
        return voidObs(`${oat}: an entry is exactly {${SATISFIED_SHAPE}} or exactly {${WAIVED_SHAPE}}, found {${shape ?? "not a map"}}`);
      }
      if (shape === WAIVED_SHAPE) {
        // `unsatisfiable: false` stringifies to something non-empty, so the type
        // check is what stops a run waiving an observation by writing the word no.
        if (typeof entry.unsatisfiable !== "string" || !filled(entry.unsatisfiable)) {
          return voidObs(`${oat}: unsatisfiable carries the reason as text, found ${JSON.stringify(entry.unsatisfiable ?? null)}`);
        }
        // A waiver is legal only where the scenario declared the condition under
        // which it is; otherwise every observation is waivable by assertion.
        if (!scenario.waivable.has(ids[i])) {
          return voidObs(`${oat}: the scenario declares no unsatisfiable_when for this observation, so it cannot be waived`);
        }
        continue;
      }
      // `observed` is the raw reading, so `false` is a result and has to survive:
      // two scenarios record exactly that. `source` is a locator, so it is text;
      // `source: true` locates nothing and would pass an emptiness test.
      const recorded = entry.observed;
      const scalar =
        typeof recorded === "string" || typeof recorded === "number" || typeof recorded === "boolean";
      if (!scalar || !filled(recorded)) {
        return voidObs(`${oat}: observed carries the recorded value, found ${JSON.stringify(recorded ?? null)}`);
      }
      if (typeof entry.source !== "string" || !filled(entry.source)) {
        return voidObs(`${oat}: source names the artifact and where in it, as text, found ${JSON.stringify(entry.source ?? null)}`);
      }
    }
  }

  out.state = out.problems.length > 0 ? "incomplete" : "complete";
  return out;
}

// Supersession is a property of the set, not of one directory: a run that a
// later complete run corrects proves nothing, whatever its own directory says.
// Only a complete correction withdraws anything, or one manifest line plus
// `probe prepare` would erase real evidence. A correction is strictly later
// than its target, so a chain resolves front to back and no cycle can exist.
function inspectRuns(ledger, conformance, errors) {
  const base = ledger.evidence.runs;
  const runs = new Map();
  if (!base || !isDir(base)) return runs;
  const ids = readdirSync(abs(base), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const id of ids) runs.set(id, inspectRun(ledger, conformance, id));

  // Authority is read from the per-directory states before any is rewritten, so
  // a corrector that is itself corrected still corrects, whatever the order.
  const correctors = new Map();
  for (const run of runs.values()) {
    if (run.state !== "complete" || !run.supersedes) continue;
    const named = correctors.get(run.supersedes) ?? [];
    named.push(run.runId);
    correctors.set(run.supersedes, named);
  }
  for (const [target, by] of correctors) {
    // One run has one corrector. Two complete runs both claiming it is a
    // contradiction with no reading, so nothing is withdrawn and the check stops.
    if (by.length > 1) {
      errors.push(`${base}: ${by.join(" and ")} both supersede ${target}; a run has one corrector`);
      continue;
    }
    const prior = runs.get(target);
    if (!prior) continue;
    prior.supersededBy = by[0];
    prior.state = "void";
    // An already-void directory keeps its own reason for being unusable.
    prior.voided ??= "superseded";
    prior.problems.unshift(`superseded by ${by[0]}, which corrects it`);
  }
  return runs;
}

// ---------------------------------------------------------------------------
// Evidence: citation resolution, digests, verification
// ---------------------------------------------------------------------------

// Saved upstream files may be line slices named `<stem>.L<a>-L<b>.<ext>` (stem
// with or without its extension). Citations use upstream line numbers, so the
// slice's start is the offset to subtract, or a cited line lands on unrelated code.
function resolveCitation(path) {
  if (isFile(path)) return { file: path, offset: 0, truncated: false };
  const dir = dirname(path);
  if (!existsSync(abs(dir))) return null;
  const name = basename(path);
  const ext = extname(name);
  const entries = readdirSync(abs(dir));
  // The stem keeping its extension is more specific, so it wins over the bare stem whatever readdir's order.
  for (const stem of ext ? [name, name.slice(0, -ext.length)] : [name]) {
    for (const entry of entries) {
      if (!entry.startsWith(`${stem}.L`)) continue;
      const match = entry.slice(stem.length).match(/^\.L(\d+)-L(\d+)\.[^.]+$/);
      if (!match) continue;
      return {
        file: join(dir, entry),
        offset: Number(match[1]) - 1,
        span: [Number(match[1]), Number(match[2])],
        truncated: true,
      };
    }
  }
  return null;
}

// Several sources cite the same saved slice and nothing rewrites references/ mid-run.
// A file ending in a newline splits into a trailing "" that is not a line.
const sliceCache = new Map();
const sliceLines = (file) =>
  sliceCache.get(file) ?? sliceCache.set(file, read(file).replace(/\n$/, "").split("\n")).get(file);

// A range past the end of a saved slice, or before its start, resolves to null
// rather than to clamped neighbouring lines: no caller gets unrelated code under a cited line.
function citationText(resolved, from, to) {
  const lines = sliceLines(resolved.file);
  const start = from - resolved.offset;
  const end = (to ?? from) - resolved.offset;
  if (start < 1 || end > lines.length || end < start) return null;
  return lines.slice(start - 1, end).join("\n");
}

// RANK is display precedence, and also the legend's key set: tierLegend renders
// one line per key, so an entry no cell can reach is still a rendered line. A
// record whose grounding stopped holding ranks at or below unverified rather
// than carrying a tier it no longer earns: void, superseded, stale.
const RANK = {
  void: 0,
  superseded: 0,
  unverified: 0,
  stale: 0.5,
  static: 1,
  observed_local: 2,
  exercised: 3,
};

// An observation is never verified, so only static and exercised count.
const VERIFIED = ["static", "exercised"];

const RECORD_KEYS = ["id", "method", "axis", "parameter", "harness", "scenario", "run", "artifacts",
  "sources", "observation", "recorded", "note", "supersedes"];

const OBSERVATION_FIELDS = ["machine", "os", "cli_version", "cli_version_command", "date", "excerpt"];

// A cited file is checked four ways: pinned under references/ and not generated
// here, digest still matching on disk, cited range inside the file, expected
// substring at that range. A digest mismatch is stale rather than wrong: the ground moved.
function validateSources(ctx, record, at, errors) {
  const harness = ctx.harnessById.get(record.harness);
  const generated = (ctx.ledger.generated ?? []).map((entry) => entry.path);
  let stale = false;
  for (const [j, source] of (record.sources ?? []).entries()) {
    const sat = `${at}.sources[${j}]`;
    const path = trim(source?.path);
    // A `..` segment climbs out of the repo, and a prefix test would not notice it.
    if (!path.startsWith("references/") || path.split("/").includes("..")) {
      errors.push(`${sat}.path: ${path || "missing"} must be a pinned file saved under references/`);
      continue;
    }
    // Citing a file the ledger renders is the ledger citing itself.
    if (generated.includes(path)) {
      errors.push(`${sat}.path: ${path} is generated from the ledger, so citing it grounds nothing`);
      continue;
    }
    const foreign = ctx.ledger.harnesses.find(
      (h) => h.id !== harness.id && h.evidence_dir && path.startsWith(`${h.evidence_dir}/`),
    );
    if (foreign) {
      errors.push(`${sat}.path: ${path} is ${foreign.id}'s saved source and this record is about ${harness.id}`);
    }
    if (!filled(source.upstream)) errors.push(`${sat}.upstream: name the repo and ref this file was saved at`);

    const resolved = resolveCitation(path);
    if (!resolved) {
      errors.push(`${sat}.path: ${path} is not saved under references/`);
      continue;
    }
    if (!SHA256.test(trim(source.digest))) {
      errors.push(`${sat}.digest: needs the sha256 of ${resolved.file}, from \`coupling.mjs attest\``);
      continue;
    }
    // Per-file digest, so a refetch localizes staleness to the files that
    // actually changed instead of invalidating every row at once.
    if (digestOf(resolved.file) !== trim(source.digest)) {
      stale = true;
      continue;
    }
    const [from, to] = String(source.lines ?? "").split("-").map(Number);
    // `94-` parses to a zero `to` that slices to nothing, and a reversed range checks only its first line.
    if (!from || (to !== undefined && !(to >= from))) {
      errors.push(`${sat}.lines: needs <from>[-<to>] in the original upstream numbering`);
      continue;
    }
    if (!filled(source.expect)) {
      errors.push(`${sat}.expect: a citation the engine cannot confirm is not a citation`);
      continue;
    }
    const text = citationText(resolved, from, to);
    if (text === null) {
      errors.push(
        `${sat}.lines: ${source.lines} is outside ${resolved.file}, which holds ${sliceLines(resolved.file).length} lines` +
          (resolved.truncated ? ` of upstream L${resolved.span[0]}-L${resolved.span[1]}` : ""),
      );
      continue;
    }
    if (!text.includes(source.expect)) {
      errors.push(
        `${sat}: ${JSON.stringify(source.expect)} is not at ${path}:${source.lines}` +
          (resolved.truncated ? ` (slice ${resolved.file}, offset ${resolved.offset})` : ""),
      );
    }
  }
  return stale;
}

function validateObservation(record, at, errors) {
  const observation = record.observation;
  if (!observation || typeof observation !== "object" || Array.isArray(observation)) {
    errors.push(`${at}.observation: observed_local needs the machine it was seen on and what was seen`);
    return;
  }
  rejectUnknown(`${at}.observation`, observation, OBSERVATION_FIELDS, "observation", errors);
  requireFilled(`${at}.observation`, observation, OBSERVATION_FIELDS, errors);
  if (filled(observation.date) && !ISO_DATE.test(asDay(observation.date))) {
    errors.push(`${at}.observation.date: needs a UTC YYYY-MM-DD date`);
  }
}

// exercised is the only tier a run can earn, and it earns it only from a run
// directory that is complete against its own scenario's contract, cited by a
// record whose digests still match every file in it.
function validateExercised(ctx, record, at, errors) {
  const scenario = ctx.conformance.byId.get(trim(record.scenario));
  if (!scenario) {
    errors.push(`${at}.scenario: no scenario ${trim(record.scenario) || "named"} in ${ctx.ledger.evidence.scenarios}`);
    return;
  }
  if (scenario.axis !== record.axis || scenario.parameter !== (record.parameter ?? null)) {
    errors.push(
      `${at}.scenario: ${scenario.id} covers ${cellLabel(scenario)}, this record is about ${cellLabel(record)}`,
    );
  }
  if (!scenario.appliesTo.includes(record.harness)) {
    errors.push(`${at}.harness: ${scenario.id} does not apply to ${record.harness}`);
  }

  const runId = trim(record.run);
  if (!runId) {
    errors.push(`${at}.run: exercised needs a run directory under ${ctx.ledger.evidence.runs}`);
    return;
  }
  // The enumeration holds real directories only, so re-inspecting a name it left
  // out would judge by path exactly the entries it refused.
  const run = ctx.runs.get(runId);
  if (!run) {
    errors.push(
      `${at}.run: ${ctx.ledger.evidence.runs}/${runId} is not a run directory; a citation resolves against the same set probe inspect reads`,
    );
    return;
  }
  if (run.scenario !== scenario.id || run.harness !== record.harness) {
    errors.push(`${at}.run: ${runId} is a run of ${run.scenario ?? "nothing"} on ${run.harness ?? "nothing"}`);
    return;
  }
  if (run.state !== "complete") {
    errors.push(`${at}.run: ${runId} is ${run.state}${run.problems.length > 0 ? `, ${run.problems[0]}` : ""}`);
    return;
  }

  const claimed = new Map();
  for (const [j, artifact] of (record.artifacts ?? []).entries()) {
    const aat = `${at}.artifacts[${j}]`;
    const path = trim(artifact?.path);
    if (!path) {
      errors.push(`${aat}.path: missing`);
      continue;
    }
    if (claimed.has(path)) errors.push(`${aat}.path: ${path} listed twice`);
    if (!SHA256.test(trim(artifact.digest))) {
      errors.push(`${aat}.digest: needs the sha256 of ${join(run.dir, path)}`);
      continue;
    }
    claimed.set(path, trim(artifact.digest));
  }
  const onDisk = new Map(run.digests.map((entry) => [entry.path, entry.digest]));
  for (const [path, digest] of onDisk) {
    if (!claimed.has(path)) {
      errors.push(`${at}.artifacts: ${path} is in the run dir and not in this record; digests cover every file`);
    } else if (claimed.get(path) !== digest) {
      errors.push(`${at}.artifacts: ${path} no longer matches its recorded digest (void_conditions.digest_mismatch)`);
    }
  }
  for (const path of claimed.keys()) if (!onDisk.has(path)) errors.push(`${at}.artifacts: ${path} is recorded and not in the run dir`);
}

// A record that does not validate grounds nothing, so it returns void rather
// than its own method. There is no tier a malformed record can fall back to.
function validateRecord(ctx, record, at, errors) {
  const before = errors.length;
  rejectUnknown(at, record, RECORD_KEYS, "record", errors);
  if (!filled(record?.id)) errors.push(`${at}.id: missing`);

  const method = trim(record?.method);
  if (!METHODS.includes(method)) {
    errors.push(`${at}.method: must be one of ${METHODS.join(", ")}`);
    return "void";
  }
  // sources belongs to two methods, so a foreign key is attributed to its first owner and reported once.
  const own = METHOD_KEYS[method];
  const owner = new Map();
  for (const [other, keys] of Object.entries(METHOD_KEYS)) {
    if (other === method) continue;
    for (const key of keys) if (!own.includes(key) && !owner.has(key)) owner.set(key, other);
  }
  for (const [key, other] of owner) {
    if (record[key] === undefined) continue;
    errors.push(`${at}.${key}: ${method} does not take ${key}, it is how ${other} grounds a claim`);
  }

  const axis = ctx.axisById.get(record.axis);
  if (!axis) {
    errors.push(`${at}.axis: no axis ${record.axis}`);
    return "void";
  }
  if (axis.kind === "parameter_set") {
    if (!record.parameter) errors.push(`${at}.parameter: ${axis.id} is a parameter set, name the parameter`);
    else if (!(axis.parameters ?? []).some((p) => p.id === record.parameter)) {
      errors.push(`${at}.parameter: ${axis.id} has no parameter ${record.parameter}`);
    }
  } else if (record.parameter) {
    errors.push(`${at}.parameter: ${axis.id} takes no parameter`);
  }

  const harness = ctx.harnessById.get(record.harness);
  if (!harness) {
    errors.push(`${at}.harness: unknown harness ${record.harness}`);
    return "void";
  }

  const recorded = record.recorded;
  if (!recorded || typeof recorded !== "object" || Array.isArray(recorded)) {
    errors.push(`${at}.recorded: needs { date, by }`);
  } else {
    if (!ISO_DATE.test(asDay(recorded.date))) errors.push(`${at}.recorded.date: needs a UTC YYYY-MM-DD date`);
    if (!filled(recorded.by)) errors.push(`${at}.recorded.by: name who wrote this record`);
  }
  if (filled(record.supersedes) && !filled(record.note)) {
    errors.push(`${at}.note: a superseding record carries its reason`);
  }

  let stale = false;
  if (method === "static") {
    // Cursor is upstream's own target and has no saved source, so no cell of its can reach static.
    if (!harness.evidence_dir) {
      errors.push(`${at}.method: ${harness.id} has no saved source, so no cell of its can reach static`);
    }
    if (!listed(record.sources)) errors.push(`${at}.sources: static needs at least one cited source`);
  }
  if (method !== "exercised") stale = validateSources(ctx, record, at, errors);
  if (method === "observed_local") validateObservation(record, at, errors);
  if (method === "exercised") validateExercised(ctx, record, at, errors);

  if (errors.length > before) return "void";
  return stale ? "stale" : method;
}

function deriveVerification(ledger, evidence, conformance, runs, errors) {
  const at = ledger.evidence.attestations;
  const ctx = {
    ledger,
    conformance,
    runs,
    axisById: new Map(ledger.axes.map((a) => [a.id, a])),
    harnessById: new Map(ledger.harnesses.map((h) => [h.id, h])),
  };

  const doc = evidence.attestationDoc;
  if (doc) {
    if (doc.version !== 1) errors.push(`${at}.version: must be 1, found ${JSON.stringify(doc.version ?? null)}`);
    const documented = (doc.methods ?? []).map((m) => trim(m?.id));
    for (const method of METHODS) {
      if (!documented.includes(method)) errors.push(`${at}.methods: ${method} is derived here and documented nowhere`);
    }
    for (const method of documented) {
      if (!METHODS.includes(method)) errors.push(`${at}.methods: ${method} is documented and the engine derives nothing from it`);
    }
    if (!Array.isArray(doc.attestations)) errors.push(`${at}.attestations: must be a list; empty is correct until a run exists`);
  }

  const entries = [];
  const byId = new Map();
  for (const [i, record] of evidence.attestations.entries()) {
    const rat = `${at}:attestations[${i}]`;
    const tier = validateRecord(ctx, record, rat, errors);
    const id = trim(record?.id);
    const entry = { id, at: rat, record, tier };
    if (id && byId.has(id)) errors.push(`${rat}.id: ${id} declared twice`);
    else if (id) byId.set(id, entry);
    entries.push(entry);
  }

  const key = (axis, harness, parameter) => `${axis}\u0000${harness}\u0000${parameter ?? ""}`;
  const cellOf = (record) => key(record.axis, record.harness, record.parameter);

  // A superseded record stays readable and counts for nothing: that is the whole
  // difference from deleting it. A void record grounds nothing, so it cannot take
  // a valid record's standing away.
  for (const entry of entries) {
    if (entry.tier === "void") continue;
    const target = trim(entry.record?.supersedes);
    if (!target) continue;
    if (target === entry.id) {
      errors.push(`${entry.at}.supersedes: a record cannot supersede itself`);
      continue;
    }
    const prior = byId.get(target);
    if (!prior) {
      errors.push(`${entry.at}.supersedes: no record ${target}`);
      continue;
    }
    if (cellOf(prior.record) !== cellOf(entry.record)) {
      errors.push(`${entry.at}.supersedes: ${target} is about ${cellLabel(prior.record)} on ${prior.record.harness}`);
      continue;
    }
    prior.tier = "superseded";
  }

  const cells = new Map();
  for (const entry of entries) {
    if (!entry.record?.axis || !entry.record?.harness) continue;
    const ck = cellOf(entry.record);
    let cell = cells.get(ck);
    if (!cell) cells.set(ck, (cell = { tier: "void", rank: -1, verified: false, exercised: false }));
    const rank = RANK[entry.tier] ?? 0;
    if (rank > cell.rank) Object.assign(cell, { tier: entry.tier, rank });
    // Eligibility folds over every record, so an observed_local note added beside
    // a valid static citation raises what the cell displays without taking away
    // what the citation already established.
    if (VERIFIED.includes(entry.tier)) cell.verified = true;
    if (entry.tier === "exercised") cell.exercised = true;
  }
  const cellAt = (axisId, harnessId, parameterId) => cells.get(key(axisId, harnessId, parameterId)) ?? null;

  return {
    lookup: (axisId, harnessId, parameterId) => cellAt(axisId, harnessId, parameterId)?.tier ?? "unverified",
    verified: (axisId, harnessId, parameterId) => cellAt(axisId, harnessId, parameterId)?.verified ?? false,
    exercised: (axisId, harnessId, parameterId) => cellAt(axisId, harnessId, parameterId)?.exercised ?? false,
    tiers: entries.map((entry) => entry.tier),
    count: cells.size,
  };
}

// ---------------------------------------------------------------------------
// The model every command reads
// ---------------------------------------------------------------------------

function build() {
  const { ledger, errors } = loadLedger();
  if (errors.length > 0) return { ledger, errors };

  const tokens = buildTokens(ledger, errors);
  validate(ledger, tokens, errors);
  checkAsserts(ledger, errors);
  if (errors.length > 0) return { ledger, errors };

  const scanned = scan(ledger, tokens);
  const occurrences = deriveOccurrences(ledger, scanned, errors);
  const evidence = loadEvidence(ledger);
  const conformance = validateScenarios(ledger, evidence, errors);
  const runs = inspectRuns(ledger, conformance, errors);
  const verification = deriveVerification(ledger, evidence, conformance, runs, errors);
  if (errors.length > 0) return { ledger, errors };

  const ported = portedSkills(ledger);
  const findings = scanned.findings.map((finding) => ({
    ...finding,
    kind: ported.has(skillOf(finding.file)) ? "regression" : "unported",
  }));

  const model = {
    ledger,
    tokens,
    errors,
    scanned,
    occurrences,
    conformance,
    runs,
    verification,
    findings,
    portedSkills: ported,
    harnesses: ledger.harnesses.map((h) => h.id),
  };
  // Every renderer reads these, so they are folded once; tally folds the domain rows, so the rows land first.
  model.domains = domainRows(model);
  model.counts = tally(model);
  model.skillIndex = skillIndex();
  model.skills = deriveSkills(model, model.skillIndex);
  model.baseline = ledger.harnesses.find((h) => h.baseline);
  return model;
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

const row = (cells) => `| ${cells.join(" | ")} |`;
const head = (cells) => [row(cells), row(cells.map(() => "---"))].join("\n");
// Only the lossy parities earn a prefix; the replacement carries the rest. An
// extension cell also names the path when the tool is not installed.
const parityText = (cell) => {
  if (cell.parity === "extension") return `not on by default: ${cell.use}, else ${cell.fallback}`;
  if (cell.parity === "degrade") return `degraded, ${cell.use}`;
  return cell.use;
};

const byKind = (model, kind) => model.ledger.axes.filter((a) => a.kind === kind);

function renderCapabilities(model) {
  const { harnesses } = model;
  const capabilityTable = [
    head(["capability", ...harnesses]),
    ...byKind(model, "capability").map((axis) =>
      row([
        `\`${axis.id}\``,
        ...harnesses.map((h) => parityText(axis.resolution[h])),
      ]),
    ),
  ].join("\n");

  const parameterTables = byKind(model, "parameter_set")
    .map((axis) =>
      [
        `### \`${axis.id}\``,
        "",
        trim(axis.what),
        "",
        head(["parameter", ...harnesses]),
        ...axis.parameters.map((parameter) =>
          row([`\`${parameter.id}\``, ...harnesses.map((h) => (parameter.resolution[h] ? parityText(parameter.resolution[h]) : "-"))]),
        ),
      ].join("\n"),
    )
    .join("\n\n");

  const consequences = model.ledger.axes
    .filter((a) => ["capability", "parameter_set"].includes(a.kind) && a.consequence)
    .map((a) => `- **\`${a.id}\`.** ${trim(a.consequence)}`)
    .join("\n");

  const roles = byKind(model, "role")
    .map((axis) => {
      const slots = axis.slots ? ` Slots: ${axis.slots.map((s) => `\`${s}\``).join(", ")}.` : "";
      return `- **${axis.id}.** ${trim(axis.what)}${slots}\n  Absent: ${trim(axis.invariant.use)}`;
    })
    .join("\n");

  const prerequisites = byKind(model, "prerequisite")
    .map((axis) => `- **\`${axis.binary}\`.** ${trim(axis.what)} Absent: ${trim(axis.invariant.use)}`)
    .join("\n");

  const paths = byKind(model, "path_assumption")
    .map((axis) => `- **${axis.id}.** Upstream used \`${axis.was}\`. ${trim(axis.invariant.use)}`)
    .join("\n");

  return `<!-- Generated from coupling.yaml by scripts/coupling.mjs render. Do not edit. -->

# Capability map

Read your own harness column. Everything upstream resolved through a Cursor
primitive resolves here instead.

Cursor is one column, not the baseline. If you are running in Cursor, its column
is upstream's original behavior.

Your column is the default, not a ceiling. If your tool list already has a tool
that does the job, use it and skip the fallback.

## Capabilities

${capabilityTable}

${parameterTables}

### What the gaps cost

${consequences}

## Roles

The pack names the role, never a vendor. Values come from the override file
\`/setup-pstack-anywhere\` writes. When a role has no value, use the absent path
and say which verification you did not perform. Never imply a capability you do
not have.

${roles}

## Prerequisites

Tools, not harness features. Missing one removes the playbooks that depend on it.

${prerequisites}

## Paths

${paths}
`;
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

// A table cell renders one line, and a pipe inside it would open a column that is
// not there. Prose outside a table needs the reflow without the escape, because a
// backslash renders literally there.
const flow = (text) => trim(text).replace(/\s+/g, " ");
const cellText = (text) => flow(text).replace(/\|/g, "\\|");

// Skill descriptions that lead with a list of quoted trigger phrases have no
// sentence break until the end, so the cap is what keeps them one line.
const DESCRIPTION_CAP = 140;

const firstSentence = (text) => {
  const match = text.match(/[\s\S]*?[.!?](?=\s|$)/);
  const sentence = cellText(match ? match[0] : text);
  if (sentence.length <= DESCRIPTION_CAP) return sentence;
  // Cut at a clause boundary, and never inside a quoted phrase: half a trigger
  // phrase reads as a phrase the skill does not answer to. A word boundary is the
  // last resort, and the punctuation that opened the next clause goes with it.
  const balanced = (upto) => (sentence.slice(0, upto).match(/"/g) ?? []).length % 2 === 0;
  const clauses = [...sentence.matchAll(/[,;:]\s/g)]
    .map((found) => found.index)
    .filter((at) => at > 40 && at <= DESCRIPTION_CAP);
  let cut = clauses.findLast(balanced);
  if (cut === undefined) {
    cut = sentence.lastIndexOf(" ", DESCRIPTION_CAP);
    if (!balanced(cut)) cut = sentence.lastIndexOf('"', cut);
  }
  return `${sentence.slice(0, cut > 40 ? cut : DESCRIPTION_CAP).replace(/[\s,;:]+$/, "")}...`;
};

// A skill already describes itself in its own frontmatter. The report reads the
// description there rather than carrying a second copy that drifts.
function skillIndex() {
  const index = new Map();
  for (const name of readdirSync(abs("skills")).sort()) {
    const path = `skills/${name}/SKILL.md`;
    if (!isFile(path)) continue;
    const front = read(path).match(/^---\n([\s\S]*?)\n---/);
    let doc = null;
    try {
      doc = front ? YAML.parse(front[1]) : null;
    } catch {
      doc = null;
    }
    index.set(name, {
      id: name,
      label: trim(doc?.name) || name,
      description: firstSentence(trim(doc?.description)),
    });
  }
  return index;
}

// Every skill the ledger or the lint has something to say about: its occurrences,
// the findings inside it, and the Cursor mentions no axis owns. Grouping is
// derived, so a skill enters the report the moment a token lands in it.
function deriveSkills(model, index) {
  const groups = new Map();
  const at = (id) => {
    if (!groups.has(id)) {
      groups.set(id, {
        ...(index.get(id) ?? { id, label: id, description: "" }),
        id,
        ported: model.portedSkills.has(id),
        occurrences: [],
        findings: [],
        mentions: [],
        domains: [],
      });
    }
    return groups.get(id);
  };

  for (const occurrence of model.occurrences) {
    const id = skillOf(occurrence.path);
    if (id) at(id).occurrences.push(occurrence);
  }
  for (const finding of model.findings) {
    const id = skillOf(finding.file);
    if (!id) continue;
    const group = at(id);
    group.findings.push(finding);
    if (finding.axes.length === 0) group.mentions.push(finding);
  }

  // A skill's domains are the ones its own occurrences name, parameter and all, so
  // a section that only touched `subagent_type` says `worker_defaults.identity`
  // instead of claiming the whole parameter set. The order is the resolution
  // table's order, so the two join by eye.
  const parameters = parameterIndex(model.ledger);
  const rank = new Map(model.domains.map((entry, i) => [entry.label, i]));
  for (const group of groups.values()) {
    group.domains = [
      ...new Set(group.occurrences.flatMap((occurrence) => occurrenceDomains(occurrence, parameters))),
    ].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0) || a.localeCompare(b));
  }

  return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------
// The portability report
// ---------------------------------------------------------------------------

// One row per domain. A parameter_set spreads into a row per parameter, because
// that is where its resolution actually lives.
function axisRows(axis, harnesses) {
  if (axis.portable) return [{ parameter: null, resolution: null }];
  if (axis.resolution) return [{ parameter: null, resolution: axis.resolution }];
  if (axis.parameters) return axis.parameters.map((p) => ({ parameter: p.id, resolution: p.resolution }));
  return [
    { parameter: null, resolution: Object.fromEntries(harnesses.map((h) => [h.id, axis.invariant])) },
  ];
}

// The report's unit of resolution: an axis, or for a parameter set an axis plus
// one parameter. An axis and a cell are different units from this one, so every
// table walks this same list and no header can disagree with its own rows.
function domainRows(model) {
  return model.ledger.axes.flatMap((axis) =>
    axisRows(axis, model.ledger.harnesses).map((spec) => ({
      axis,
      spec,
      label: cellLabel({ axis: axis.id, parameter: spec.parameter }),
    })),
  );
}

// A domain earns five columns only when the five would differ. A portable domain
// has nothing to resolve, and an invariant one fills every harness with the same
// cell, so a row of identical cells tells the reader the opposite of what it means.
function domainVaries({ spec }, harnesses) {
  if (!spec.resolution) return false;
  const cells = harnesses.map((h) => {
    const cell = spec.resolution[h.id];
    return cell ? `${cell.parity}\u0000${flow(cell.use)}` : "unknown";
  });
  return new Set(cells).size > 1;
}

// What the saved evidence says about a domain's cells. The baseline harness is
// looked up like every other one: a state that appears in a single column reads
// as a different measurement, and the baseline is already explained in prose.
function domainVerification(model, { axis, spec }) {
  return model.ledger.harnesses.map((h) => [h, model.verification.lookup(axis.id, h.id, spec.parameter)]);
}

// What an invariant resolution means depends on the kind: a role or a
// prerequisite names the absent path, everything else names the replacement.
const INVARIANT_LEAD = {
  role: "With no value for the role",
  prerequisite: "Without the binary",
};

// Every resolution in the ledger, rendered once. Skill sections name their
// domains and link here, so the same table no longer appears fourteen times
// with a different subset of its rows.
function domainResolutions(model) {
  const harnesses = model.ledger.harnesses;
  const rows = model.domains;
  const tiers = new Set(rows.flatMap((entry) => domainVerification(model, entry).map(([, tier]) => tier)));
  // One tier across the whole matrix makes the third fact in every cell a constant.
  const shared = tiers.size === 1 ? [...tiers][0] : null;
  const varying = rows.filter((entry) => domainVaries(entry, harnesses));
  const uniform = rows.filter((entry) => !domainVaries(entry, harnesses));

  const cell = (entry, harness) => {
    const resolved = entry.spec.resolution[harness.id];
    if (!resolved) return "unknown";
    const use = resolved.parity === "extension" ? `${resolved.use}, else ${resolved.fallback}` : resolved.use;
    const text = `${resolved.parity}, ${cellText(use)}`;
    return shared
      ? text
      : `${text}, ${model.verification.lookup(entry.axis.id, harness.id, entry.spec.parameter)}`;
  };

  const verificationNote = (entry) =>
    shared
      ? ""
      : ` Verification: ${domainVerification(model, entry)
          .map(([h, tier]) => `${h.label} ${tier}`)
          .join(", ")}.`;

  const bullet = (entry) => {
    const { axis, spec } = entry;
    const what = flow(axis.what);
    if (!spec.resolution) {
      // A portable axis has no parity: the engine derives none for it, and a word
      // in the parity slot would read as one of the five it can derive.
      const keys = (axis.keys ?? []).map((key) => `\`${key}\``).join(", ");
      return `- **\`${entry.label}\`** (${axis.kind}${keys ? `: ${keys}` : ""}). ${what} Unchanged on every harness, so there is nothing to resolve.${verificationNote(entry)}`;
    }
    // A domain with no cell for the first harness has none anywhere, or it would
    // be varying instead.
    const resolved = spec.resolution[harnesses[0].id];
    if (!resolved) {
      return `- **\`${entry.label}\`** (${axis.kind}). ${what} No harness has a resolution recorded for it.${verificationNote(entry)}`;
    }
    const lead = INVARIANT_LEAD[axis.kind] ?? "Same on every harness";
    return `- **\`${entry.label}\`** (${axis.kind}, ${resolved.parity}). ${what} ${lead}: ${flow(resolved.use)}${verificationNote(entry)}`;
  };

  const table = [
    head(["domain", ...harnesses.map((h) => `${h.label}${h.baseline ? " (upstream)" : ""}`)]),
    ...varying.map((entry) =>
      row([`\`${entry.label}\` (${entry.axis.kind})`, ...harnesses.map((h) => cell(entry, h))]),
    ),
  ].join("\n");

  return [
    `${plural(varying.length, "domain")} of ${rows.length} resolve differently depending on the ` +
      `harness. Each cell reads \`parity, replacement${shared ? "" : ", verification"}\`, and an ` +
      "`extension` cell adds `, else <fallback>` after the replacement for when the tool is not installed." +
      (shared ? ` Every cell in the matrix is \`${shared}\`.` : "") +
      ` ${model.baseline.label} is the upstream column: its resolutions are what upstream already ` +
      "does, not a substitution this port made.",
    "",
    table,
    "",
    `The other ${plural(uniform.length, "domain")} resolve the same way on every harness:`,
    "",
    uniform.map(bullet).join("\n"),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Occurrences
// ---------------------------------------------------------------------------

// The parameters each parameter_set axis spreads into, in declaration order.
const parameterIndex = (ledger) =>
  new Map(
    ledger.axes.filter((axis) => axis.parameters).map((axis) => [axis.id, axis.parameters.map((p) => p.id)]),
  );

// The domains an occurrence names. A detected occurrence names only the
// parameters its own hits touched; a declared one claims its whole axis, which
// for a parameter set expands to every parameter rather than a bare axis id no
// resolution row answers to. Display only: identity stays file plus axis.
const occurrenceDomains = (occurrence, parameters) => {
  const own = occurrence.parameters ?? [];
  const spread = own.length > 0 ? own : (parameters.get(occurrence.axis) ?? []);
  return spread.length > 0
    ? spread.map((parameter) => `${occurrence.axis}.${parameter}`)
    : [occurrence.axis];
};

// Explain the occurrence state without reusing "ported", which is reserved for
// whole skills here. The legend is this table read back.
const OCCURRENCE_LABEL = {
  ported: "resolved",
  unported: "unresolved",
  missing: "missing",
  unverifiable: "not checked",
};

const OCCURRENCE_MEANING = {
  ported: "no coupling token remains in the file",
  unported: "a coupling token is still there",
  missing: "the declared file is gone, so the ledger is stale",
  unverifiable: "the file is outside `lint.scan` or whole-file allowlisted, so no check reads it",
};

// Why the lint flagged the occurrence, in the token's own words. What to do about
// it is in the Next block, because that depends on the shape of the domain and
// because two rows can share one reason where they would not share one instruction.
const occurrenceReason = (occurrence) =>
  occurrence.reasons.length > 0 ? occurrence.reasons.join("; ") : "unattributed";

const occurrenceNote = (occurrence) =>
  occurrence.implementation === "missing"
    ? "the file is gone, so the ledger is stale here"
    : (occurrence.note ?? "outside `lint.scan`, so no check reads this file");

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Everything left to do in one place, with the three counts that feed it named
// against each other: they measure different units, and a reader who meets them
// one section apart cannot tell that.
function workRemaining(model) {
  const attributed = model.findings.filter((finding) => finding.axes.length > 0);
  const mentions = model.findings.filter((finding) => finding.axes.length === 0);
  const regressions = model.findings.filter((finding) => finding.kind === "regression");
  const bySite = (a, b) => a.path.localeCompare(b.path) || a.axis.localeCompare(b.axis);
  const unresolved = model.occurrences.filter((o) => o.implementation === "unported").sort(bySite);
  const blocked = model.occurrences
    .filter((o) => ["missing", "unverifiable"].includes(o.implementation))
    .sort(bySite);
  const mentionFiles = [...new Set(mentions.map((finding) => finding.file))].sort((a, b) =>
    a.localeCompare(b),
  );

  // The instruction a row needs depends on the shape of its domain, not on the
  // row. A role is a rewrite; a domain that varies by harness has five
  // replacements and no single string to substitute into a harness-neutral
  // SKILL.md; only the rest is a literal swap.
  const parameters = parameterIndex(model.ledger);
  const varying = new Set(
    model.domains
      .filter((entry) => domainVaries(entry, model.ledger.harnesses))
      .map((entry) => entry.label),
  );
  const axisOf = new Map(model.ledger.axes.map((axis) => [axis.id, axis]));
  const bucketOf = (occurrence) =>
    axisOf.get(occurrence.axis)?.kind === "role"
      ? "role"
      : occurrenceDomains(occurrence, parameters).some((domain) => varying.has(domain))
        ? "varies"
        : "fixed";

  // The regression claim is a fact about token hits and nothing else, so it has
  // to sit against the hit total rather than after the declarations that carry
  // no hit. Every declaration is inside a reached skill by construction; saying
  // so here stops the reader from reading the regression sentence as a claim
  // about where those declarations live. Why each one is exempt is in Exclusions.
  const stale = blocked.filter((o) => o.implementation === "missing");
  const unread = blocked.filter((o) => o.implementation === "unverifiable");

  const bridge = [
    `${plural(attributed.length, "token hit")} carry a domain and collapse into ` +
      `${plural(unresolved.length, "unresolved occurrence")}, one per file and domain.`,
    `${plural(mentions.length, "hit")} name Cursor in prose with no domain to resolve into, ` +
      `across ${plural(mentionFiles.length, "file")}.`,
    `That is ${plural(model.findings.length, "diagnostic")} in total, and ` +
      (regressions.length === 0
        ? "not one of them lands in a skill the port already reached, so not one is a regression."
        : `${regressions.length} of them land in a skill the port already reached, which makes ` +
          "them regressions rather than remaining work."),
    unread.length > 0 &&
      `${plural(unread.length, "further declaration")} ` +
        `${unread.length === 1 ? "sits" : "sit"} inside ${unread.length === 1 ? "a skill" : "skills"} the port reached, as every ` +
        `declaration does, but no check reads ${unread.length === 1 ? "its file" : "their files"}, ` +
        `so ${unread.length === 1 ? "it yields" : "they yield"} no diagnostic either way and the ` +
        "count above neither covers nor clears them.",
    stale.length > 0 &&
      `${plural(stale.length, "declaration")} ${stale.length === 1 ? "points" : "point"} at a ` +
        `file that is gone, so the ledger is stale ${stale.length === 1 ? "there" : "at those rows"}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const section = (lead, columns, rows) =>
    rows.length === 0 ? [] : [lead, "", [head(columns), ...rows].join("\n"), ""];

  const parts = [
    bridge,
    "",
    ...section(
      "Attributed work, one row per file and domain:",
      ["file", "domain", "reason", "lines"],
      unresolved.map((occurrence) =>
        row([
          `\`${occurrence.path}\``,
          occurrenceDomains(occurrence, parameters).map((d) => `\`${d}\``).join(", "),
          cellText(occurrenceReason(occurrence)),
          occurrence.lines.join(", "),
        ]),
      ),
    ),
    ...section(
      "Unattributed Cursor mentions. Each is either a legitimate reference to the " +
        "Cursor column or a coupling that needs an axis to own it:",
      ["file", "lines"],
      mentionFiles.map((file) =>
        row([`\`${file}\``, mentions.filter((f) => f.file === file).map((f) => f.line).join(", ")]),
      ),
    ),
    ...section(
      "Declared occurrences no check reads. These are the only claims in the ledger " +
        "the lint cannot confirm or contradict:",
      ["file", "domain", "status", "why"],
      blocked.map((occurrence) =>
        row([
          `\`${occurrence.path}\``,
          `\`${occurrence.axis}\``,
          OCCURRENCE_LABEL[occurrence.implementation],
          cellText(occurrenceNote(occurrence)),
        ]),
      ),
    ),
  ];

  const RESOLUTIONS = "[Domain resolutions](#domain-resolutions)";
  const instruction = {
    fixed: (n) =>
      `${n} of the ${unresolved.length} rows name a domain that resolves the same way on every ` +
      `harness. Replace the token with that resolution from ${RESOLUTIONS}.`,
    varies: (n) =>
      `${n} rows name a domain whose resolution differs per harness, and a SKILL.md is ` +
      "harness-neutral, so there is no single string to substitute. Carry the domain's whole " +
      `row from ${RESOLUTIONS} as harness-conditional prose rather than picking one column.`,
    role: (n) =>
      `${n} rows name a role. Name the role in the prose and leave its value to the override ` +
      "file `/setup-pstack-anywhere` writes; the row's no-value fallback is what the prose " +
      "says when the role has none.",
  };
  const buckets = groupCount(unresolved, bucketOf);
  const next = [
    ...["fixed", "varies", "role"].filter((b) => buckets.get(b)).map((b) => instruction[b](buckets.get(b))),
    mentionFiles.length > 0 &&
      `Decide each of the ${mentions.length} Cursor mentions: keep it, or give the coupling ` +
        "an axis in `coupling.yaml` so the lint can attribute it.",
    // A deleted file cannot be brought inside `lint.scan`, only retired.
    unread.length > 0 &&
      `Bring the ${unread.length} unchecked occurrences inside \`lint.scan\`, or retire them ` +
        "from the ledger.",
    stale.length > 0 &&
      `Retire the ${plural(stale.length, "declaration")} whose file is gone, or restore the ` +
        `${stale.length === 1 ? "file" : "files"}.`,
    "Run `bun scripts/coupling.mjs check` as the gate. Cells earn a verification through " +
      "`probe list`, `probe prepare <scenario> <harness>`, and `probe inspect <run-id>`; " +
      "none of those drive a harness or write an attestation.",
  ].filter(Boolean);
  parts.push("Next:", "", next.map((line) => `- ${line}`).join("\n"));

  return parts.join("\n");
}

// One row per file and state, not one per occurrence. Every declared file and
// domain pair is still here to audit, without sixty-odd copies of `resolved`.
function coverageTable(model, group) {
  const parameters = parameterIndex(model.ledger);
  const byFile = new Map();
  for (const occurrence of [...group.occurrences].sort((a, b) => a.path.localeCompare(b.path))) {
    const key = `${occurrence.path}\u0000${occurrence.implementation}`;
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key).push(occurrence);
  }
  return [
    head(["file", "status", "domains"]),
    ...[...byFile].map(([key, list]) => {
      const [path, state] = key.split("\u0000");
      return row([
        `\`${path}\``,
        OCCURRENCE_LABEL[state],
        [...new Set(list.flatMap((occurrence) => occurrenceDomains(occurrence, parameters)))]
          .map((domain) => `\`${domain}\``)
          .join(", "),
      ]);
    }),
  ].join("\n");
}

function skillSection(model, group) {
  const description = (group.description || "No description in frontmatter.").replaceAll(" — ", ": ");
  const parts = [`### \`${group.id}\``, "", description, ""];
  const domains =
    group.domains.length > 0
      ? `Domains: ${group.domains.map((domain) => `\`${domain}\``).join(", ")}. Resolutions are in [Domain resolutions](#domain-resolutions).`
      : null;

  if (group.ported) {
    // Derived from the occurrence states, so a section cannot claim a port its own table denies.
    const states = groupCount(group.occurrences, (o) => o.implementation);
    const breakdown = ORDER.filter((state) => states.has(state))
      .map((state) => `${states.get(state)} ${OCCURRENCE_LABEL[state]}`)
      .join(", ");
    // A detected occurrence comes from a token hit, not from the ledger, so a
    // regression inside a reached skill must not be counted as a declaration.
    const declared = group.occurrences.filter((o) => o.declared).length;
    parts.push(
      `Reached: ${plural(declared, "declared occurrence")} across ` +
        `${plural(new Set(group.occurrences.map((o) => o.path)).size, "file")}, ${breakdown}.`,
      "",
    );
    if (domains) parts.push(domains, "");
    parts.push(coverageTable(model, group), "");
    const open = group.occurrences.filter((o) => o.implementation !== "ported");
    if (open.length > 0) {
      // The reason lives once, in the work-remaining table.
      const states = [...new Set(open.map((o) => OCCURRENCE_LABEL[o.implementation]))]
        .map((label) => `\`${label}\``)
        .join(", ");
      parts.push(
        `${plural(open.length, "row")} above ${open.length === 1 ? "reads" : "read"} ${states}; ` +
          "the reason is in [Work remaining](#work-remaining).",
        "",
      );
    }
    return parts.join("\n").trimEnd();
  }

  const attributed = group.findings.length - group.mentions.length;
  const hitFiles = new Set(group.findings.map((finding) => finding.file));
  const claims = [];
  if (attributed > 0) claims.push(`${plural(attributed, "token hit")} attributed to a domain`);
  if (group.mentions.length > 0) {
    claims.push(plural(group.mentions.length, "unattributed Cursor mention"));
  }
  parts.push(`Not reached: ${claims.join(" and ")}, across ${plural(hitFiles.size, "file")}.`, "");
  parts.push(
    domains
      ? `${domains} The rows are in [Work remaining](#work-remaining).`
      : "No domain owns anything here, so there is nothing to resolve into yet. The lines are listed in [Work remaining](#work-remaining).",
    "",
  );
  return parts.join("\n").trimEnd();
}

// One row per high-risk domain. Harness results collapse into one cell when
// they match, which keeps an all-unverified report readable. Differences are
// named per harness.
function conformanceTable(model) {
  const harnesses = model.ledger.harnesses;
  const coverage = model.conformance.coverage;
  const slug = (entry) => cellLabel(entry).replaceAll(".", "_");
  // A scenario is named after its domain in the usual case, so a column that
  // repeats the domain with underscores earns its place only when one differs.
  const named = coverage.some(({ scenario, ...entry }) => scenario && scenario.id !== slug(entry));
  // A row with no scenario must not match a run whose own scenario is unset.
  const runsByScenario = Map.groupBy([...model.runs.values()], (run) => run.scenario);
  const shown = new Set();

  const entries = coverage.map(({ axis, parameter, scenario }) => {
    const runs = scenario ? (runsByScenario.get(scenario.id) ?? []) : [];
    const byHarness = harnesses.map((harness) => {
      if (!scenario) return [harness.label, "uncovered"];
      if (!scenario.appliesTo.includes(harness.id)) return [harness.label, "n/a"];
      return [harness.label, model.verification.lookup(axis, harness.id, parameter)];
    });
    for (const [, state] of byHarness) shown.add(state);
    return { axis, parameter, scenario, runs, byHarness, distinct: new Set(byHarness.map(([, s]) => s)) };
  });

  // One state across every cell makes the column a constant, and a constant column
  // crowds out the two that vary. The scenario column collapses for the same reason.
  const uniform = shown.size === 1 ? [...shown][0] : null;
  const note = !uniform
    ? null
    : uniform === "unverified"
      ? `No cell in this table has accepted evidence, ${model.baseline.label} included, so the ` +
        `verification column would read \`${uniform}\` in all ${coverage.length * harnesses.length} ` +
        "of them and is omitted."
      : `Every cell in this table reads \`${uniform}\`, so the verification column is omitted.`;

  const rows = entries.map((entry) => {
    const cells = [`\`${cellLabel(entry)}\``];
    if (named) cells.push(entry.scenario ? `\`${entry.scenario.id}\`` : "none");
    cells.push(
      entry.scenario ? String(entry.scenario.observations.length) : "-",
      String(entry.runs.length),
    );
    if (!uniform) {
      cells.push(
        entry.distinct.size === 1
          ? `all harnesses: ${entry.byHarness[0][1]}`
          : entry.byHarness.map(([harness, state]) => `${harness}: ${state}`).join("; "),
      );
    }
    return row(cells);
  });

  const columns = ["domain", ...(named ? ["scenario"] : []), "observations", "runs"];
  if (!uniform) columns.push("verification");
  return { text: [head(columns), ...rows].join("\n"), shown, note };
}

function freshnessTable(model) {
  const counts = model.counts;
  const runStates = groupCount([...model.runs.values()], (run) => run.state);
  const tiers = groupCount(model.verification.tiers, (tier) => tier);
  const spread = (map) => [...map].map(([state, n]) => `${n} ${state}`).join(", ");

  // Coverage arithmetic has one owner, the Conformance preamble. What this row
  // adds is the identity between the scenario count and the high-risk domains.
  const rows = [
    row([
      "scenarios",
      counts.scenarios === counts.highRiskDomains
        ? `${counts.scenarios} defined, one per high-risk domain`
        : `${counts.scenarios} defined`,
    ]),
  ];
  // Two rows that both read "none" say one thing twice.
  if (counts.attestations === 0 && tiers.size === 0) {
    rows.push(row(["attestations", `none under \`${model.ledger.evidence.attestations}\``]));
  } else {
    rows.push(row(["attestations", `${counts.attestations} recorded`]));
    rows.push(row(["evidence classes", spread(tiers)]));
  }
  rows.push(
    row([
      "run directories",
      runStates.size === 0 ? `none under \`${model.ledger.evidence.runs}\`` : spread(runStates),
    ]),
    row([
      "cells exercised",
      `${counts.exercised} of ${counts.cells}, a subset of the ${counts.verified} verified cells in Totals`,
    ]),
  );
  return [head(["measure", "value"]), ...rows].join("\n");
}

// The tiers a cell can print, ordered by the precedence the engine applies, so
// the legend cannot fall behind the states the tables show.
const TIER_MEANING = {
  exercised: "a complete run against the scenario, an attestation, and matching file digests",
  observed_local: "one machine on one day, which never counts as verified",
  static: "a citation into a file in this repo that still matches its digest",
  stale: "the cited file moved, so a human has to look again",
  void: "the grounding does not hold, so the record counts for nothing",
  superseded: "a later record replaced it; it stays readable and counts for nothing",
  unverified: "no saved evidence covers the cell",
};

const tierLegend = () =>
  Object.keys(RANK)
    .sort((a, b) => RANK[b] - RANK[a] || a.localeCompare(b))
    .map(
      (tier) =>
        `- \`${tier}\`: ${TIER_MEANING[tier] ?? "no meaning recorded"}.` +
        (VERIFIED.includes(tier) ? " Counts as verified." : ""),
    )
    .join("\n");

// Explain only the evidence state that needs interpretation.
function freshnessNote(model) {
  const runs = [...model.runs.values()];
  const tiers = model.verification.tiers;
  const lines = [];

  if (runs.length === 0 && tiers.length === 0) {
    lines.push(
      "No runs or attestations exist, so no cell has accepted evidence. This says " +
        "nothing about whether the substitutions work.",
    );
  } else {
    const unfinished = runs.filter((run) => run.state !== "complete");
    if (unfinished.length > 0) {
      lines.push(
        `${unfinished.length} of ${runs.length} run directories are not complete against their scenario's evidence contract, so nothing may be attested from them: ${unfinished
          .map((run) => `\`${run.runId}\` (${run.state})`)
          .join(", ")}.`,
      );
    }
    // `stale` and `void` mean the grounding no longer holds, so the fallback
    // below would claim the opposite of what those records say.
    const broken = tiers.filter((tier) => ["stale", "void"].includes(tier));
    if (broken.length > 0) {
      const spread = [...groupCount(broken, (tier) => tier)].map(([tier, n]) => `${n} ${tier}`).join(", ");
      lines.push(
        `${plural(broken.length, "record")} no longer ${broken.length === 1 ? "holds" : "hold"} against the files on disk (${spread}), so ${broken.length === 1 ? "it counts" : "they count"} for nothing until a human looks again.`,
      );
    }
    if (lines.length === 0) lines.push("Every recorded grounding still holds against the files on disk.");
  }

  lines.push("Every digest is sha256, recomputed from disk on each run.");
  return lines.join("\n\n");
}

// The reached skills are gated by the lint, so the report must not promise a
// gate wider than the lint's reach. Every allowlist entry inside a reached skill
// is a hole in that gate, named here with the mechanism that opened it.
function exclusions(model, reached) {
  const ids = new Set(reached.map((group) => group.id));
  return (model.ledger.lint?.allowlist ?? [])
    .filter((entry) => ids.has(skillOf(entry.path)))
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((entry) => {
      const directory = entry.path.endsWith("/");
      const reachable = directory
        ? model.scanned.files.some((file) => file.startsWith(entry.path))
        : model.scanned.scannable.has(entry.path);
      const mechanism = directory
        ? "allowlisted directory prefix" +
          (reachable ? "" : ", and nothing under it is Markdown, so `lint.scan` never reaches it either")
        : "allowlisted whole-file" + (reachable ? "" : ", and outside `lint.scan`");
      return row([`\`${entry.path}\``, mechanism, cellText(entry.why)]);
    });
}

// A reached skill is not a checked skill: an occurrence the lint cannot read is
// declared, not confirmed. The ratio travels with the count, so the number never
// stands alone in Totals or in the README.
const CHECKED = ["ported", "unported"];

const reachedLabel = (group) =>
  `\`${group.id}\` (${group.occurrences.filter((o) => CHECKED.includes(o.implementation)).length} ` +
  `of ${group.occurrences.length} checked)`;

const occurrencesRow = (counts) =>
  row(["occurrences", ORDER.map((state) => `${counts.occurrences[state]} ${OCCURRENCE_LABEL[state]}`).join(", ")]);

const reachedRow = (index, reached) =>
  row(["skills reached", `${reached.length} of ${index.size}: ${reached.map(reachedLabel).join(", ")}`]);

function renderReport(model) {
  const counts = model.counts;
  const index = model.skillIndex;
  const reached = model.skills.filter((g) => g.ported);
  const unreached = model.skills.filter((g) => !g.ported);
  // A group can name a skill directory with no `SKILL.md` of its own, so the
  // quiet skills are the indexed ones no group claims, not a subtraction.
  const quiet = [...index.keys()].filter((id) => !model.skills.some((g) => g.id === id)).length;
  const orphans = model.ledger.axes.filter((a) => (a.occurrences ?? []).length === 0);
  const conformance = conformanceTable(model);

  const spreadAxes = model.ledger.axes.filter((a) => a.parameters);
  const asserts = model.ledger.axes
    .filter((axis) => axis.assert?.kind === "frontmatter_key_count")
    .map((axis) =>
      row([
        `\`${axis.id}\` assert`,
        `${axis.assert.expect} of ${axis.assert.of} skills carry \`${axis.assert.key}\`, ` +
          "counted from the tree on every run",
      ]),
    );

  const totals = [
    head(["measure", "value"]),
    row(["ledger", `v${model.ledger.version}, upstream \`${model.ledger.upstream.sha.slice(0, 7)}\``]),
    row([
      "domains",
      `${counts.domains}, from ${model.ledger.axes.length} axes` +
        (spreadAxes.length > 0
          ? `, because ${spreadAxes.map((a) => `\`${a.id}\``).join(" and ")} resolves per parameter`
          : ""),
    ]),
    row([
      "harness cells",
      `${counts.verified} verified of ${counts.cells} ` +
        `(${counts.domains} domains x ${model.ledger.harnesses.length} harnesses)`,
    ]),
    occurrencesRow(counts),
    row([
      "token hits",
      `${counts.attributedHits} attributed to a domain, ${counts.mentionHits} unattributed ` +
        `Cursor mentions, ${counts.attributedHits + counts.mentionHits} in total`,
    ]),
    reachedRow(index, reached),
    row([
      "skills with work left",
      `${unreached.length} of ${index.size}; the other ${quiet} carry neither a declared ` +
        "occurrence nor a token hit",
    ]),
    row(["regressions", String(counts.regressions)]),
    ...asserts,
  ].join("\n");

  const occurrenceLegend = ORDER.map(
    (state) => `- \`${OCCURRENCE_LABEL[state]}\`: ${OCCURRENCE_MEANING[state]}.`,
  ).join("\n");

  const { scenarios, attestations, runs } = model.ledger.evidence;
  const evidencePaths = [scenarios, attestations, runs].filter(Boolean).map((p) => `\`${p}\``);

  const conformanceLegend = [
    conformance.shown.has("n/a") ? "`n/a` means the scenario does not apply to that harness." : null,
    conformance.shown.has("uncovered") ? "`uncovered` means the domain has no scenario at all." : null,
    `${model.baseline.label} follows the same evidence rules as ` +
      "every other harness, and cannot reach `static` only because this repo has no saved " +
      `${model.baseline.label} source to cite.`,
  ]
    .filter(Boolean)
    .join("\n");

  // `counts.scenarios` is every scenario in the file; the claim below is about
  // the ones that cover a high-risk domain, which is a narrower count.
  const covered = model.conformance.coverage.filter((entry) => entry.scenario).length;
  const conformanceLead = [
    `Conformance scenarios cover the ${counts.highRiskDomains} of ${counts.domains} domains judged high-risk.`,
    counts.scenarioCells === counts.highRiskCells
      ? `Every scenario applies to all ${model.ledger.harnesses.length} harnesses, so the ${covered} of them cover every one of the ${counts.highRiskCells} high-risk cells, which is ${counts.scenarioCells} of the ${counts.cells} in the matrix.`
      : `The ${covered} of them cover ${counts.scenarioCells} of the ${counts.highRiskCells} high-risk cells, which is ${counts.scenarioCells} of the ${counts.cells} in the matrix.`,
    `The other ${plural(counts.domains - counts.highRiskDomains, "domain")} are resolved in prose on purpose.`,
    "A scenario defines what to run and what to inspect; it does not claim a result.",
  ].join("\n");

  const conformanceBlock = [conformanceLead, "", conformance.text, ""]
    .concat(conformance.note ? [conformance.note, ""] : [], [conformanceLegend])
    .join("\n");

  const holes = exclusions(model, reached);
  const reachedBlock = [
    "The ledger declares occurrences in these skills, so a token hit here is a",
    "regression rather than work left." +
      (holes.length === 0 ? " The lint reads every file in them, so no path is exempt." : ""),
  ];
  if (holes.length > 0) {
    reachedBlock.push(
      `${plural(holes.length, "path")} inside them ${holes.length === 1 ? "sits" : "sit"} outside the`,
      "lint's reach, so no hit can arise there either way:",
      "",
      [head(["path", "mechanism", "why it is exempt"]), ...holes].join("\n"),
    );
  }

  const orphanTable = [
    head(["domain", "why no site is tracked"]),
    ...orphans.map((axis) => row([`\`${axis.id}\` (${axis.kind})`, cellText(axis.no_occurrences)])),
  ].join("\n");

  return `<!-- Generated from coupling.yaml by \`bun scripts/coupling.mjs render\`. Do not edit. -->

# Portability report

Built from \`coupling.yaml\`, the current skill files, and the evidence under
${evidencePaths.join(", ")}. Every number below is
counted on each run rather than asserted in prose.

Three units run through the report. A **domain** is one axis, or for a parameter
set one axis plus one parameter, which is why ${model.ledger.axes.length} axes make ${counts.domains} domains. A
**cell** is one domain on one harness, so the matrix is ${counts.cells} cells. An
**occurrence** is one domain in one file, and its status column reads:

${occurrenceLegend}

A cell has no status. It carries a verification instead, which is the strongest
saved evidence for it:

${tierLegend()}

## Totals

${totals}

## Work remaining

${workRemaining(model)}

## Domain resolutions

${domainResolutions(model)}

## Conformance

${conformanceBlock}

### Evidence freshness

${freshnessTable(model)}

${freshnessNote(model)}

## Skills the port reached

${reachedBlock.join("\n")}

${reached.map((group) => skillSection(model, group)).join("\n\n")}

## Skills the port has not reached

These are the skills the lint found coupling in. Their hits are porting work,
not regressions. The ${quiet} skills with neither a declared occurrence nor a token
hit are not listed.

${unreached.map((group) => skillSection(model, group)).join("\n\n")}

## Domains with no occurrence

No file-level check can catch a regression in these, because there is no
tracked site to check. Their resolutions are in
[Domain resolutions](#domain-resolutions).

${orphanTable}
`;
}

// The README block. It lives inside a bounded marker region in a hand-written
// file, so it stays a summary and links out for the detail.
function renderSummary(model) {
  const counts = model.counts;
  const index = model.skillIndex;
  const reached = model.skills.filter((g) => g.ported);
  const unreached = model.skills.filter((g) => !g.ported).length;
  const upstream = model.ledger.upstream;

  return [
    "<!-- Generated from coupling.yaml by `bun scripts/coupling.mjs render`. Do not edit. -->",
    "",
    head(["measure", "value"]),
    row(["upstream pin", `\`${upstream.sha.slice(0, 7)}\`, path \`${upstream.path}\``]),
    reachedRow(index, reached),
    row(["skills with work left", `${unreached} of ${index.size}`]),
    occurrencesRow(counts),
    row([
      "token hits",
      `${counts.attributedHits} attributed to a domain, ${counts.mentionHits} unattributed Cursor mentions`,
    ]),
    row([
      "verification",
      `${counts.verified} of ${counts.cells} cells verified, ${counts.attestations} attestations, ${counts.scenarios} scenarios defined`,
    ]),
    "",
    "`bun scripts/coupling.mjs check` is the gate. The work left, the per-harness",
    "resolutions, and the evidence state are in [PORTABILITY.md](PORTABILITY.md).",
  ].join("\n");
}

const RENDERERS = {
  capabilities: renderCapabilities,
  report: renderReport,
  summary: renderSummary,
};

// ---------------------------------------------------------------------------
// Tally
// ---------------------------------------------------------------------------

const ORDER = ["ported", "unported", "missing", "unverifiable"];

function groupCount(items, keyOf) {
  const map = new Map();
  for (const item of items) {
    const key = keyOf(item);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

// One cell per axis, harness, and parameter. Both `status` and the renderers
// count the same enumeration, so a total cannot disagree with a table.
// `verification` is what the cell displays; `verified` and `exercised` are what
// it earned, which is a fold over every record rather than the strongest one.
function enumerateCells(model, harnesses = model.harnesses, axes = model.ledger.axes) {
  const cells = [];
  const state = (axisId, harness, parameterId) => ({
    verification: model.verification.lookup(axisId, harness, parameterId),
    verified: model.verification.verified(axisId, harness, parameterId),
    exercised: model.verification.exercised(axisId, harness, parameterId),
  });
  for (const axis of axes) {
    for (const harness of harnesses) {
      const derived = axisParity(axis, harness);
      if (axis.parameters) {
        for (const parameter of axis.parameters) {
          cells.push({
            axis: axis.id,
            parameter: parameter.id,
            harness,
            parity: parameter.resolution[harness]?.parity ?? null,
            ...state(axis.id, harness, parameter.id),
            class: derived.class,
          });
        }
        continue;
      }
      cells.push({
        axis: axis.id,
        parameter: null,
        harness,
        parity: derived.parity,
        ...state(axis.id, harness, null),
        class: derived.class,
      });
    }
  }
  return cells;
}

function tally(model) {
  const byState = Object.fromEntries(
    ORDER.map((state) => [state, model.occurrences.filter((o) => o.implementation === state).length]),
  );
  const cells = enumerateCells(model);
  return {
    regressions: model.findings.filter((f) => f.kind === "regression").length,
    unported: model.findings.filter((f) => f.kind === "unported").length,
    // A token hit belongs to an axis; a bare Cursor mention belongs to none.
    // Summing them under one word is what makes a total unreconcilable.
    attributedHits: model.findings.filter((f) => f.axes.length > 0).length,
    mentionHits: model.findings.filter((f) => f.axes.length === 0).length,
    missing: model.occurrences.filter((o) => o.implementation === "missing").length,
    occurrences: byState,
    files: model.scanned.files.length,
    domains: model.domains.length,
    cells: cells.length,
    verified: cells.filter((c) => c.verified).length,
    exercised: cells.filter((c) => c.exercised).length,
    attestations: model.verification.tiers.length,
    scenarios: model.conformance.byId.size,
    // A domain is axis plus parameter with no harness in it. `scenarioCells` is
    // narrower: the cells a scenario actually applies to.
    highRiskDomains: model.conformance.coverage.length,
    highRiskCells: model.conformance.coverage.length * model.ledger.harnesses.length,
    scenarioCells: model.conformance.coverage.reduce(
      (n, entry) => n + (entry.scenario?.appliesTo.length ?? 0),
      0,
    ),
    runs: model.runs.size,
  };
}

// ---------------------------------------------------------------------------
// Generated targets
// ---------------------------------------------------------------------------

const marker = (name) => ({
  begin: `<!-- BEGIN GENERATED ${name} -->`,
  end: `<!-- END GENERATED ${name} -->`,
});

// A markered target owns one bounded region of a hand-written file. The expected
// text is the whole file with that region replaced, so drift detection and the
// write are the same comparison. `validate` already fails a markered target whose
// file is missing a marker, so the only null this can return in practice is the
// reversed pair, end before begin, which nothing else checks.
function spliceRegion(current, name, body) {
  const { begin, end } = marker(name);
  const from = current.indexOf(begin);
  const to = current.indexOf(end);
  if (from === -1 || to === -1 || to < from) return null;
  return `${current.slice(0, from)}${begin}\n\n${body}\n\n${end}${current.slice(to + end.length)}`;
}

function targetsOf(model, only = null) {
  const targets = [];
  for (const entry of model.ledger.generated ?? []) {
    if (only && only !== entry.renderer && only !== entry.path) continue;
    const body = RENDERERS[entry.renderer](model);
    const current = isFile(entry.path) ? read(entry.path) : null;
    const expected = !entry.marker
      ? body
      : current === null
        ? null
        : spliceRegion(current, entry.marker, body.trim());
    const state = current === null
      ? (!entry.marker && entry.state === "planned" ? "pending" : "absent")
      : expected === null ? "unmarked" : current === expected ? "current" : "drifted";
    targets.push({ ...entry, expected, current, state });
  }
  return targets;
}

const BLOCKED = ["drifted", "absent", "unmarked"];

const driftOf = (model) => targetsOf(model).map(({ path, state }) => ({ path, state }));

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function reportErrors(errors) {
  for (const error of errors) console.error(error);
  console.error(`\n${errors.length} ledger problem${errors.length === 1 ? "" : "s"}`);
}

// Every command reports a bad flag or argument the same way: one line, exit 5.
const usageError = (message) => (console.error(message), 5);

function commandCheck(model, opts) {
  // Caught before the report: rejecting a bad path at the end hands the caller a complete report and
  // then discards check's own exit class.
  if (opts.refresh !== undefined && !existsSync(opts.refresh)) return usageError("--refresh needs a path to an upstream pstack checkout");

  const counts = model.counts;
  const drift = driftOf(model);

  const regressions = model.findings.filter((f) => f.kind === "regression");
  const unported = model.findings.filter((f) => f.kind === "unported");
  const missing = model.occurrences.filter((o) => o.implementation === "missing");
  const drifted = drift.filter((d) => BLOCKED.includes(d.state));

  if (opts.json) {
    const brief = missing.map((o) => ({ axis: o.axis, path: o.path }));
    console.log(JSON.stringify({ regressions, unported, missing: brief, generated: drift, counts }, null, 2));
  } else {
    for (const finding of regressions) {
      console.error(`${finding.file}:${finding.line}: ${finding.hit} — ${finding.why} [regression]`);
    }
    for (const o of missing) console.error(`coupling.yaml: ${o.axis} occurrence ${o.path} does not exist, the ledger is stale`);
    for (const finding of unported) {
      console.error(`${finding.file}:${finding.line}: ${finding.hit} — ${finding.why}`);
    }
    const WHY = {
      drifted: "no longer matches the ledger, re-run render",
      absent: "declared rendered but absent",
      unmarked: "its generated marker region is gone, restore it",
    };
    for (const e of drift) if (WHY[e.state]) console.error(`${e.path}: ${WHY[e.state]}`);

    const parts = [];
    if (regressions.length > 0) parts.push(`${regressions.length} regressions`);
    if (missing.length > 0) parts.push(`${missing.length} stale occurrences`);
    if (unported.length > 0) parts.push(`${unported.length} unported findings`);
    if (drifted.length > 0) parts.push(`${drifted.length} generated files out of date`);
    const pending = drift.filter((d) => d.state === "pending").map((d) => d.path);
    const summary = `\n${parts.join(", ")} in ${counts.files} markdown files`;
    console.log(parts.length === 0 ? `clean, ${counts.files} markdown files` : summary);
    if (pending.length > 0) console.log(`pending render: ${pending.join(", ")}`);
    const runStates = groupCount([...model.runs.values()], (run) => run.state);
    if (runStates.size > 0) console.log(`runs: ${[...runStates].map(([s, n]) => `${n} ${s}`).join(", ")}`);
    if (model.verification.count === 0) {
      console.log(`no attestations, every cell derives unverified, ${counts.scenarios} scenarios defined and none exercised`);
    }
  }

  // The sweep is prose, so it would corrupt the JSON stream it follows.
  if (opts.refresh !== undefined && !opts.json) refresh(model, opts.refresh);

  if (regressions.length > 0 || missing.length > 0) return 2;
  if (drifted.length > 0) return 3;
  if (unported.length > 0) return opts.gate ? 0 : 1;
  return 0;
}

// Sweep an upstream checkout for token hits at paths the ledger does not name.
// Occurrence paths and upstream's are both repo-relative, so this is set membership, no prefix surgery.
function refresh(model, upstream) {
  const declared = new Set(
    model.ledger.axes.flatMap((a) => (a.occurrences ?? []).map((o) => o.path)),
  );
  console.log(`\nUpstream sweep against ${relative(process.cwd(), upstream)}:`);
  for (const file of [...new Glob(model.ledger.lint.scan).scanSync(upstream)].sort()) {
    const text = readFileSync(join(upstream, file), "utf8");
    const hits = model.tokens.filter((t) => t.regex.test(text));
    if (hits.length === 0 || declared.has(file)) continue;
    console.log(`  new coupling site ${file}: ${hits.map((t) => t.source).join(", ")}`);
  }
}

function commandStatus(model, opts) {
  const onlyHarness = opts.harness;
  const onlyAxis = opts.axis;
  if (onlyHarness && !model.harnesses.includes(onlyHarness)) return usageError(`--harness: unknown harness ${onlyHarness}`);
  if (onlyAxis && !model.ledger.axes.some((a) => a.id === onlyAxis)) return usageError(`--axis: unknown axis ${onlyAxis}`);
  const harnesses = onlyHarness ? [onlyHarness] : model.harnesses;
  const axes = model.ledger.axes.filter((a) => !onlyAxis || a.id === onlyAxis);
  const counts = model.counts;
  const cells = enumerateCells(model, harnesses, axes);
  const occurrences = model.occurrences.filter((o) => !onlyAxis || o.axis === onlyAxis);
  const drift = driftOf(model);
  if (opts.json) {
    console.log(JSON.stringify({ cells, occurrences, generated: drift, counts }, null, 2));
    return 0;
  }

  console.log(`ledger v${model.ledger.version}, upstream ${model.ledger.upstream.sha.slice(0, 7)}`);
  console.log(`axes ${model.ledger.axes.length}, harnesses ${model.harnesses.length}, cells ${cells.length}`);
  console.log("");
  const bar = (label, key, w, n, tail = "") =>
    console.log(`  ${label} ${key.padEnd(w)} ${String(n).padStart(4)}${tail}`);
  for (const [state, n] of Object.entries(counts.occurrences)) {
    const detected = occurrences.filter((o) => o.implementation === state && !o.declared).length;
    bar("occurrences", state, 13, n, `  (detected ${detected})`);
  }
  console.log("");
  for (const [v, n] of groupCount(cells, (c) => c.verification)) bar("verification", v, 12, n);
  console.log("");
  for (const [p, n] of groupCount(cells, (c) => c.parity ?? "n/a")) bar("parity", p, 18, n);
  console.log("");
  console.log(`  findings regression ${String(counts.regressions).padStart(5)}`);
  console.log(`  findings unported   ${String(counts.unported).padStart(5)}`);
  console.log("");
  for (const entry of drift) console.log(`  generated ${entry.state.padEnd(9)} ${entry.path}`);
  return 0;
}

function commandRender(model, opts) {
  const only = opts.only;
  // targetsOf filters on renderer name or output path, so an unknown --only
  // matches nothing and the command would exit 0 having rendered nothing.
  if (only !== undefined) {
    const names = (model.ledger.generated ?? []).flatMap((e) => [e.renderer, e.path]);
    if (!names.includes(only)) return usageError(`--only: unknown renderer ${only}`);
  }
  const dryRun = opts["dry-run"];
  const checkOnly = opts.check;

  let blocked = 0;
  for (const target of targetsOf(model, only)) {
    // --check compares every target, markered or whole-file, and writes nothing.
    if (checkOnly) {
      const line = `${target.state.padEnd(8)} ${target.path}`;
      if (BLOCKED.includes(target.state)) {
        console.error(line);
        blocked += 1;
      } else {
        console.log(line);
      }
      continue;
    }
    if (target.expected === null) {
      console.error(
        target.state === "unmarked"
          ? `${target.path}: no \`${marker(target.marker).begin}\` region to write into`
          : `${target.path}: a markered target needs its host file on disk`,
      );
      blocked += 1;
      continue;
    }
    if (dryRun) {
      console.log(
        `would write ${target.path} (${target.expected.length} bytes, ${target.state === "current" ? "unchanged" : "changed"})`,
      );
      continue;
    }
    if (target.state === "current") {
      console.log(`current ${target.path}`);
      continue;
    }
    writeFileSync(abs(target.path), target.expected);
    console.log(`wrote ${target.path}`);
  }
  return blocked > 0 ? 3 : 0;
}

// Resolve a citation and print the digest and the lines it actually lands on, so
// nobody hand-writes a sha256 or a line number that a slice offset has moved.
function commandAttest(model /* null, attest reads saved references only */, opts, args) {
  const target = args[0];
  if (!target) return usageError("attest needs <reference-path>[:<from>[-<to>]]");
  // Every group is optional and `.*?` can absorb the whole string, so this can
  // never fail to match. The lazy quantifier is what makes a trailing `:N` win
  // over a colon earlier in the path.
  const [, path, from, to] = target.match(/^(.*?)(?::(\d+)(?:-(\d+))?)?$/);
  const resolved = resolveCitation(path);
  if (!resolved) return usageError(`${path} is not saved under references/`);
  console.log(`path: ${path}`);
  console.log(`file: ${resolved.file}`);
  if (resolved.truncated) {
    console.log(`slice: L${resolved.span[0]}-L${resolved.span[1]}, offset ${resolved.offset}`);
  }
  console.log(`digest: ${digestOf(resolved.file)}`);
  if (from) {
    const text = citationText(resolved, Number(from), to ? Number(to) : undefined);
    if (text === null) {
      const span = resolved.truncated ? ` (slice L${resolved.span[0]}-L${resolved.span[1]})` : "";
      return usageError(`${path}:${from}${to ? `-${to}` : ""} is outside ${resolved.file}${span}`);
    }
    console.log(`lines: ${from}${to ? `-${to}` : ""}`);
    console.log("---");
    console.log(text);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// probe: the conformance half
// ---------------------------------------------------------------------------

const PROBE_USAGE = [
  "usage: bun scripts/coupling.mjs probe list [--json]",
  "       bun scripts/coupling.mjs probe prepare <scenario> <harness>",
  "       bun scripts/coupling.mjs probe inspect <run-id> [--json]",
].join("\n");

function probeList(model, json) {
  const rows = model.conformance.coverage.map(({ axis, parameter, scenario }) => ({
    scenario: scenario?.id ?? null,
    domain: cellLabel({ axis, parameter }),
    applies_to: scenario?.appliesTo ?? [],
    observations: scenario?.observations ?? [],
    artifacts: scenario?.artifacts ?? [],
    verification: Object.fromEntries(
      (scenario?.appliesTo ?? []).map((harness) => [harness, model.verification.lookup(axis, harness, parameter)]),
    ),
    runs: [...model.runs.values()]
      .filter((run) => run.scenario === scenario?.id)
      .map((run) => ({ run: run.runId, harness: run.harness, state: run.state })),
  }));

  if (json) {
    console.log(JSON.stringify({ scenarios: rows }, null, 2));
    return 0;
  }

  const scenarioCells = rows.reduce((n, entry) => n + entry.applies_to.length, 0);
  const domainCells = rows.length * model.ledger.harnesses.length;
  console.log(`${rows.length} high-risk domains, ${scenarioCells} of ${domainCells} harness cells, ${model.conformance.byId.size} scenarios`);
  for (const entry of rows) {
    console.log("");
    console.log(`${entry.scenario ?? "UNCOVERED"}  ${entry.domain}`);
    console.log(`  applies to    ${entry.applies_to.join(", ") || "-"}`);
    console.log(`  observations  ${entry.observations.length}: ${entry.observations.join(", ")}`);
    console.log(`  artifacts     ${entry.artifacts.length}: ${entry.artifacts.join(", ")}`);
    const tiers = Object.entries(entry.verification).map(([harness, tier]) => `${harness}=${tier}`);
    console.log(`  verification  ${tiers.join(" ")}`);
    const runs = entry.runs.map((run) => `${run.run} (${run.state})`).join(", ");
    console.log(entry.runs.length === 0 ? "  runs          none" : `  runs          ${runs}`);
  }
  console.log("");
  console.log("No harness was contacted. Every tier above comes from a saved record.");
  return 0;
}

// The two things a run needs before it starts, and nothing else: a manifest
// with every required field present and unset, and the checklist of what the
// operator has to produce. This command cannot drive a harness, so it writes no
// artifact, no observation, and no attestation.
function probePrepare(model, [scenarioId, harnessId]) {
  if (!scenarioId || !harnessId) return usageError("probe prepare needs <scenario> <harness>");
  const scenario = model.conformance.byId.get(scenarioId);
  if (!scenario) return usageError(`no scenario ${scenarioId}; \`probe list\` names them`);
  if (!scenario.appliesTo.includes(harnessId)) {
    return usageError(`${scenarioId} applies to ${scenario.appliesTo.join(", ")}, not ${harnessId}`);
  }

  const contract = model.conformance.contract;
  const day = new Date().toISOString().slice(0, 10);
  const prefix = `${scenarioId}.${harnessId}.${day}.`;
  const sameDay = [...model.runs.values()].filter((run) => run.runId.startsWith(prefix));
  // Preparing twice in one day is nearly always the operator re-reading the
  // checklist, so an unexecuted directory is handed back instead of duplicated.
  // A counter bump is what a genuine second run gets.
  const prepared = sameDay.find((run) => run.state === "unexecuted");
  if (prepared) return usageError(`${prepared.dir} is already prepared and unexecuted; run it, or inspect it`);
  // sameDay counts directories that exist now, so a deleted .01 would reissue an
  // id a surviving .02 owns and prepare would overwrite a real run. Use the
  // highest counter still present, and refuse if the target already exists.
  const next = Math.max(0, ...sameDay.map((run) => Number(RUN_ID.exec(run.runId)?.[4] ?? 0))) + 1;
  const runId = `${prefix}${String(next).padStart(2, "0")}`;
  const dir = runDir(model.ledger, runId);
  if (existsSync(abs(dir))) return usageError(`${dir} already exists; probe prepare overwrites nothing`);

  const manifest = [
    "# Unexecuted run manifest, written by `bun scripts/coupling.mjs probe prepare`.",
    "#",
    "# started_at and ended_at are null, so `probe inspect` reports this run as",
    "# unexecuted and no attestation may cite it. Fill every null from the run",
    "# itself: a value typed from memory is not a value.",
    "",
    `scenario: ${scenario.id}`,
    `harness: ${harnessId}`,
    `run_id: ${runId}`,
    `coupling_version: ${model.ledger.version}`,
    "",
    ...[...RUN_STAMPS, ...RUN_IDENTITY].map((field) => `${field}: null`),
    "",
    "# Required by the evidence contract's required_metadata.",
    ...contract.metadata.map((field) => `${field}: null`),
    "",
    "# The run id this one corrects, or null. A run is never edited after its",
    "# digests are recorded; a correction is a new run. It has to name an",
    `# earlier run of ${scenario.id} on ${harnessId}, and it only takes effect`,
    "# once this run itself is complete.",
    "supersedes: null",
    "",
  ].join("\n");

  const checklist = [
    `# Run checklist: ${scenario.id} on ${harnessId}`,
    "",
    `Run id \`${runId}\`. Nothing below has been done. This directory holds a`,
    "manifest and this checklist; every other line is something the run has to",
    "produce.",
    "",
    "## Required artifacts",
    "",
    "Every one of them, with content in it. A required artifact that is absent,",
    "empty, whitespace-only, or a symlink rather than a file of this run's own",
    "leaves the run incomplete. Where the honest result is no output, say so in",
    "one line inside the artifact; an empty file always means nobody looked.",
    "",
    head(["artifact", "holds"]),
    ...scenario.artifacts.map((path) => row([`\`${path}\``, cellText(scenario.holds.get(path) ?? "")])),
    "",
    "## Observations",
    "",
    "`observations.yaml` carries one entry per id below, in this order. An entry",
    "is exactly `{id, observed, source}` or exactly `{id, unsatisfiable}`, never a",
    "blend and never with another key. An omitted entry voids the run. An id",
    "marked waivable below may take the second shape, with the reason written out",
    "as text, because the scenario declares the condition under which the",
    "observation cannot be made; no other id may, and `false` or `0` is not a",
    "reason.",
    "",
    ...scenario.observations.map(
      (id, i) => `${i + 1}. \`${id}\`${scenario.waivable.has(id) ? " — waivable" : ""}`,
    ),
    "",
    "## Void conditions",
    "",
    ...model.conformance.voidConditions.map((condition) => `- \`${condition.id}\`: ${cellText(condition.when)}`),
    "",
    "## After the run",
    "",
    "```",
    `bun scripts/coupling.mjs probe inspect ${runId}`,
    "```",
    "",
    "`inspect` judges this directory and writes nothing. A verification needs a",
    `record in \`${model.ledger.evidence.attestations}\` that cites a complete run`,
    "and carries the sha256 of every file in it.",
    "",
  ].join("\n");

  mkdirSync(abs(dir), { recursive: true });
  writeFileSync(abs(join(dir, "run.yaml")), manifest);
  writeFileSync(abs(join(dir, "CHECKLIST.md")), checklist);

  console.log(`prepared ${dir}`);
  console.log(`  run.yaml      unexecuted manifest, ${RUN_STAMPS.length + RUN_IDENTITY.length + contract.metadata.length} fields to fill`);
  console.log(`  CHECKLIST.md  ${scenario.artifacts.length} required artifacts, ${scenario.observations.length} observations`);
  console.log("");
  console.log("No harness was contacted and no artifact, observation, or attestation was");
  console.log("written. This run is unexecuted until run.yaml carries real timestamps, and");
  console.log("unverified until a record cites it.");
  console.log(`next: bun scripts/coupling.mjs probe inspect ${runId}`);
  console.log("      bun scripts/coupling.mjs render   # the report counts run directories");
  return 0;
}

const PROBE_EXIT = { complete: 0, unexecuted: 1, incomplete: 1, void: 2, absent: 5 };

function probeInspect(model, [target], json) {
  if (!target) return usageError("probe inspect needs <run-id>");
  const runId = basename(target.replace(/\/+$/, ""));
  const report = model.runs.get(runId) ?? absentRun(model.ledger, runId);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return PROBE_EXIT[report.state];
  }

  console.log(`run ${report.runId}`);
  console.log(`  state     ${report.state}`);
  console.log(`  scenario  ${report.scenario ?? "-"}`);
  console.log(`  harness   ${report.harness ?? "-"}`);
  if (report.voided) console.log(`  voided    ${report.voided}`);
  if (report.supersedes) console.log(`  corrects  ${report.supersedes}`);
  if (report.supersededBy) console.log(`  corrected ${report.supersededBy}`);
  const scenario = model.conformance.byId.get(report.scenario);
  if (scenario) {
    const present = scenario.artifacts.length - report.missing.length - report.empty.length;
    console.log(`  artifacts ${present} of ${scenario.artifacts.length} required present and non-empty`);
  }
  for (const entry of report.digests) console.log(`  sha256    ${entry.digest}  ${entry.path}`);
  for (const path of report.missing) console.log(`  missing   ${path}`);
  for (const path of report.empty) console.log(`  empty     ${path}`);
  for (const path of report.irregular) console.log(`  not-file  ${path}`);
  for (const problem of report.problems) console.log(`  problem   ${problem}`);
  console.log("");
  const attestable = report.supersededBy
    ? `${report.state}: ${report.supersededBy} corrects this run, so cite that one. Nothing here may be attested.`
    : `${report.state}: nothing here may be attested.`;
  console.log(report.state === "complete"
    ? `Complete against ${report.scenario}'s evidence contract. That is not a verification: a record in ${model.ledger.evidence.attestations} has to cite this run and carry the digests above.`
    : attestable);
  console.log("inspect wrote nothing.");
  return PROBE_EXIT[report.state];
}

function commandProbe(model, opts, args) {
  const [sub, ...rest] = args;
  if (sub === "list" && rest.length === 0) return probeList(model, opts.json);
  // An extra positional is a mistyped command, not something to silently drop.
  if (sub === "prepare" && rest.length <= 2) return probePrepare(model, rest);
  if (sub === "inspect" && rest.length <= 1) return probeInspect(model, rest, opts.json);
  return usageError(PROBE_USAGE);
}

const JSON_FLAG = { json: { type: "boolean" } };

// One table so every command shares one flag parser, one build-and-report step,
// and one exit path. `attest` reads saved references only, so it never builds.
const COMMANDS = {
  check: { model: true, options: { ...JSON_FLAG, gate: { type: "boolean" }, refresh: { type: "string" } }, run: commandCheck },
  status: { model: true, options: { ...JSON_FLAG, harness: { type: "string" }, axis: { type: "string" } }, run: commandStatus },
  render: { model: true, options: { only: { type: "string" }, "dry-run": { type: "boolean" }, check: { type: "boolean" } }, run: commandRender },
  attest: { model: false, options: {}, run: commandAttest },
  probe: { model: true, options: { ...JSON_FLAG }, run: commandProbe },
};

const [command, ...args] = process.argv.slice(2);
// Object.hasOwn, not a bare lookup: `coupling.mjs toString` reaches
// Object.prototype and would dispatch a function that is not a command.
if (!Object.hasOwn(COMMANDS, command)) {
  console.error(`usage: bun scripts/coupling.mjs <${Object.keys(COMMANDS).join("|")}> [options]`);
  process.exit(5);
}
const spec = COMMANDS[command];
let parsed;
try {
  parsed = parseArgs({ args, options: spec.options, strict: true, allowPositionals: true });
} catch (error) {
  console.error(error.message);
  process.exit(5);
}
let model = null;
if (spec.model) {
  model = build();
  if (model.errors.length > 0) {
    reportErrors(model.errors);
    process.exit(4);
  }
}
process.exit(spec.run(model, parsed.values, parsed.positionals));
