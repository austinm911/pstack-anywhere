#!/usr/bin/env bun
// The coupling ledger engine. One module owns loading coupling.yaml, validating
// it, deriving every status from the tree, and rendering the files that are
// derived from it.
//
//   bun scripts/coupling.mjs check     [--gate] [--refresh <upstream>] [--json]
//   bun scripts/coupling.mjs status    [--harness <id>] [--axis <id>] [--json]
//   bun scripts/coupling.mjs render    [--only <renderer>] [--dry-run] [--check]
//   bun scripts/coupling.mjs attest    <reference-path>:<line>[-<line>]
//   bun scripts/coupling.mjs probe     list | prepare <scenario> <harness> | inspect <run-id>
//
// Nothing here writes a status. implementation, parity, and verification are
// computed on every run: implementation from the working tree, parity out of the
// ledger's resolution shape, verification out of evidence/attestations.yaml. The
// loader refuses a ledger that tries to persist any of them.
//
// `probe` is the conformance half, over conformance/scenarios.yaml. It cannot
// drive a harness and does not pretend to: `prepare` writes an unexecuted run
// manifest and the artifact checklist for one scenario on one harness,
// `inspect` judges a run directory against that scenario's evidence contract.
// Neither writes an attestation, and no state `inspect` reports is itself a
// verification.
//
// Exit codes for `check`, so a caller can tell the classes apart:
//   0  clean
//   1  unported findings only, in skills the port has not reached
//   2  a regression in a ported file, or a declared occurrence gone missing
//   3  a derived file on disk no longer matches what the ledger renders
//   4  the ledger, or the evidence joined to it, does not validate
//   5  the command line is wrong
//
// `--gate` maps 1 to 0. Skills the port has not reached are counted in the
// rendered status, never gated; the gate blocks on regressions, stale
// occurrences, drift, and invalid input, which is what a change can cause.
//
// `probe inspect` reuses them for a run directory: 0 complete, 1 unexecuted or
// incomplete, 2 void, 5 no such run.

import { YAML, Glob } from "bun";
import { readFileSync, existsSync, statSync, lstatSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname, relative, basename, extname } from "node:path";
import { createHash } from "node:crypto";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const PARITY = ["native", "substitute", "degrade", "drop"];
const METHODS = ["static", "exercised", "observed_local"];
const DERIVED_KEYS = ["status", "ported", "verified", "implementation", "verification"];

const abs = (p) => join(ROOT, p);
const read = (p) => readFileSync(abs(p), "utf8");
// statSync follows symlinks, so a link to a file outside the repo would satisfy
// presence, content, and digest checks while nothing under this tree holds the
// bytes. Every path the ledger reasons about is a real file or a real directory
// here, so both predicates read the link itself.
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

const DERIVED_WHY = "is derived and must not be written into the ledger";

function loadLedger() {
  const ledger = YAML.parse(read("coupling.yaml"));
  const errors = [];
  if (ledger.version !== 2) {
    errors.push(`coupling.yaml: version must be 2, found ${JSON.stringify(ledger.version)}`);
  }
  rejectKeys(ledger.axes, "axes", DERIVED_KEYS, DERIVED_WHY, errors);
  rejectKeys(ledger.harnesses, "harnesses", DERIVED_KEYS, DERIVED_WHY, errors);
  return { ledger, errors };
}

// Volatile inputs. The attestation registry may be absent: every cell then
// derives unverified, which is the honest default. The scenario file may not,
// because its absence leaves every high-risk domain with no procedure at all and
// the coverage check below says so rather than passing vacuously.
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
// covers several axes without being scanned twice, so a hit is counted once and
// attributed to all of them.
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
      for (const other of token.also ?? []) {
        if (!ids.has(other)) errors.push(`${where}.also: no axis ${other}`);
      }
      if (token.parameter) {
        const names = (axis.parameters ?? []).map((p) => p.id);
        if (!names.includes(token.parameter)) {
          errors.push(`${where}.parameter: ${axis.id} has no parameter ${token.parameter}`);
        }
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

function resolutionShape(axis) {
  const shapes = ["resolution", "invariant", "parameters"].filter((k) => axis[k] !== undefined);
  return shapes;
}

function validate(ledger, tokens, errors) {
  const harnessIds = ledger.harnesses.map((h) => h.id);
  const known = new Set(harnessIds);

  if (new Set(harnessIds).size !== harnessIds.length) {
    errors.push("harnesses: duplicate id");
  }
  const baselines = ledger.harnesses.filter((h) => h.baseline);
  if (baselines.length !== 1) {
    errors.push(`harnesses: exactly one baseline required, found ${baselines.length}`);
  }
  for (const harness of ledger.harnesses) {
    if (harness.evidence_dir && !existsSync(abs(harness.evidence_dir))) {
      errors.push(`harnesses.${harness.id}.evidence_dir: ${harness.evidence_dir} does not exist`);
    }
  }

  const axisIds = ledger.axes.map((a) => a.id);
  if (new Set(axisIds).size !== axisIds.length) errors.push("axes: duplicate id");

  const checkCells = (cells, where) => {
    for (const id of known) {
      if (!cells[id]) errors.push(`${where}: no cell for harness ${id}`);
    }
    for (const [id, cell] of Object.entries(cells)) {
      if (!known.has(id)) errors.push(`${where}.${id}: unknown harness`);
      if (!PARITY.includes(cell?.parity)) {
        errors.push(`${where}.${id}.parity: must be one of ${PARITY.join(", ")}`);
      }
      if (!trim(cell?.use)) errors.push(`${where}.${id}.use: empty, name the path explicitly`);
    }
  };

  for (const axis of ledger.axes) {
    const where = `axes.${axis.id}`;
    const shapes = resolutionShape(axis);
    if (axis.portable) {
      if (shapes.length > 0) {
        errors.push(`${where}: portable axes carry no resolution, found ${shapes.join(" and ")}`);
      }
    } else if (shapes.length !== 1) {
      errors.push(`${where}: exactly one of resolution, invariant, parameters, found ${shapes.length}`);
    }

    if (axis.resolution) checkCells(axis.resolution, `${where}.resolution`);
    if (axis.invariant) {
      if (!PARITY.includes(axis.invariant.parity)) {
        errors.push(`${where}.invariant.parity: must be one of ${PARITY.join(", ")}`);
      }
      if (!trim(axis.invariant.use)) errors.push(`${where}.invariant.use: empty`);
    }
    if (axis.parameters) {
      const names = axis.parameters.map((p) => p.id);
      if (new Set(names).size !== names.length) errors.push(`${where}.parameters: duplicate id`);
      for (const parameter of axis.parameters) {
        checkCells(parameter.resolution ?? {}, `${where}.parameters.${parameter.id}.resolution`);
      }
    }

    // Every axis is anchored: either it names occurrences, or it says why it
    // cannot. An unanchored axis is invisible to a refresh diff.
    const occurrences = axis.occurrences ?? [];
    if (occurrences.length === 0 && !trim(axis.no_occurrences)) {
      errors.push(`${where}: no occurrences and no no_occurrences reason`);
    }
    if (occurrences.length > 0 && trim(axis.no_occurrences)) {
      errors.push(`${where}: declares both occurrences and no_occurrences`);
    }

    const paths = new Set();
    for (const [i, occurrence] of occurrences.entries()) {
      const at = `${where}.occurrences[${i}]`;
      const path = occurrence.path;
      if (typeof path !== "string" || path.length === 0) {
        errors.push(`${at}.path: missing`);
        continue;
      }
      // Single root, no fallback. A bare `SKILL.md` would resolve into
      // poteto-mode and misattribute the moment a second skill is ported.
      if (path.startsWith("/") || path.startsWith("./") || path.includes("..")) {
        errors.push(`${at}.path: ${path} must be plain repo-relative`);
      }
      if (paths.has(path)) errors.push(`${at}.path: ${path} declared twice on this axis`);
      paths.add(path);
    }
  }

  for (const [i, entry] of (ledger.lint?.allowlist ?? []).entries()) {
    const path = entry.path;
    const target = abs(path);
    if (!existsSync(target)) {
      errors.push(`lint.allowlist[${i}].path: ${path} does not exist`);
    } else if (path.endsWith("/") !== statSync(target).isDirectory()) {
      errors.push(`lint.allowlist[${i}].path: ${path} directory prefixes end with a slash`);
    }
  }

  for (const [i, entry] of (ledger.generated ?? []).entries()) {
    const at = `generated[${i}]`;
    if (!RENDERERS[entry.renderer]) errors.push(`${at}.renderer: no renderer ${entry.renderer}`);
    if (!["rendered", "planned"].includes(entry.state)) {
      errors.push(`${at}.state: must be rendered or planned`);
    }
    if (entry.state === "rendered" && !isFile(entry.path)) {
      errors.push(`${at}: state rendered but ${entry.path} is not on disk`);
    }
    // A markered target replaces one region of a hand-written file. Without the
    // region the renderer has nowhere to write, which is a ledger error rather
    // than something to discover at write time.
    if (entry.marker && isFile(entry.path)) {
      const { begin, end } = marker(entry.marker);
      const text = read(entry.path);
      if (!text.includes(begin) || !text.includes(end)) {
        errors.push(`${at}.marker: ${entry.path} has no \`${begin}\` … \`${end}\` region`);
      }
    }
  }

  if (tokens.length === 0) errors.push("axes: no tokens, the lint would pass vacuously");
}

// A prose claim about the tree, counted rather than asserted.
function checkAsserts(ledger, errors) {
  for (const axis of ledger.axes) {
    const assertion = axis.assert;
    if (!assertion) continue;
    const where = `axes.${axis.id}.assert`;
    if (assertion.kind !== "frontmatter_key_count") {
      errors.push(`${where}.kind: unknown assertion ${assertion.kind}`);
      continue;
    }
    const skills = readdirSync(abs("skills"))
      .filter((name) => isFile(`skills/${name}/SKILL.md`))
      .sort();
    const spellings = assertion.spellings ?? [assertion.key];
    const pattern = new RegExp(`^(${spellings.join("|")}):`, "m");
    let hits = 0;
    for (const name of skills) {
      const front = read(`skills/${name}/SKILL.md`).match(/^---\n([\s\S]*?)\n---/);
      if (front && pattern.test(front[1])) hits += 1;
    }
    if (hits !== assertion.expect || skills.length !== assertion.of) {
      errors.push(
        `${where}: claims ${assertion.expect} of ${assertion.of}, tree has ${hits} of ${skills.length}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Lint
// ---------------------------------------------------------------------------

function allowMatcher(ledger) {
  const prefixes = (ledger.lint?.allowlist ?? []).map((entry) => entry.path);
  return (file) => prefixes.some((prefix) => file === prefix || file.startsWith(prefix));
}

function maskLine(ledger, line) {
  let text = line;
  for (const entry of ledger.lint?.ignore_substrings ?? []) {
    text = text.replaceAll(entry.value, "");
  }
  return text;
}

// A finding is a token hit, attributed to the axes that own the token. The
// cursor_mentions pattern belongs to no axis, so its findings carry none.
function scan(ledger, tokens) {
  const allowed = allowMatcher(ledger);
  const files = [...new Glob(ledger.lint.scan).scanSync(ROOT)].sort();
  const cursor = ledger.lint.cursor_mentions;
  const cursorRegex = new RegExp(cursor.pattern, cursor.flags ?? "");
  const exemptRegex = new RegExp(cursor.context_exempt, cursor.context_exempt_flags ?? "");

  const findings = [];
  const hitsByFile = new Map();

  for (const file of files) {
    if (allowed(file)) continue;
    const lines = read(file).split("\n");
    lines.forEach((line, index) => {
      const text = maskLine(ledger, line);
      for (const token of tokens) {
        if (!token.regex.test(text)) continue;
        findings.push({
          file,
          line: index + 1,
          hit: token.source,
          why: token.why,
          axes: token.axes,
          parameter: token.parameter,
        });
        for (const axis of token.axes) {
          const key = `${file}\u0000${axis}`;
          if (!hitsByFile.has(key)) hitsByFile.set(key, []);
          hitsByFile.get(key).push(token.source);
        }
      }
      if (cursorRegex.test(text) && !exemptRegex.test(text)) {
        findings.push({
          file,
          line: index + 1,
          hit: "Cursor",
          why: cursor.why,
          axes: [],
          parameter: null,
        });
      }
    });
  }
  return { files, findings, hitsByFile, allowed, scannable: new Set(files) };
}

// ---------------------------------------------------------------------------
// Derive
// ---------------------------------------------------------------------------

const worstParity = (values) =>
  values.reduce((worst, value) => (PARITY.indexOf(value) > PARITY.indexOf(worst) ? value : worst), PARITY[0]);

function axisParity(axis, harnessId) {
  if (axis.portable) return { parity: null, class: "portable-unchanged", use: null };
  if (axis.invariant) {
    return { parity: axis.invariant.parity, class: "invariant", use: trim(axis.invariant.use) };
  }
  if (axis.resolution) {
    const cell = axis.resolution[harnessId];
    if (!cell) return { parity: null, class: "unknown", use: null };
    return { parity: cell.parity, class: "coupled", use: trim(cell.use) };
  }
  const cells = axis.parameters.map((p) => p.resolution[harnessId]).filter(Boolean);
  if (cells.length === 0) return { parity: null, class: "unknown", use: null };
  return {
    parity: worstParity(cells.map((c) => c.parity)),
    class: "coupled",
    use: null,
    parameters: Object.fromEntries(
      axis.parameters.map((p) => [p.id, p.resolution[harnessId] ?? null]),
    ),
  };
}

// The port reached a skill when the ledger declares at least one occurrence in
// it. A token hit inside such a skill is a regression; the same hit in a skill
// the port has not reached is unported work, which is a different fact.
function portedSkills(ledger) {
  const set = new Set();
  for (const axis of ledger.axes) {
    for (const occurrence of axis.occurrences ?? []) {
      const parts = occurrence.path.split("/");
      if (parts[0] === "skills" && parts.length > 1) set.add(parts[1]);
    }
  }
  return set;
}

const skillOf = (file) => {
  const parts = file.split("/");
  return parts[0] === "skills" && parts.length > 1 ? parts[1] : null;
};

function deriveOccurrences(ledger, scanned, errors) {
  const rows = [];
  const declared = new Set();

  for (const axis of ledger.axes) {
    for (const occurrence of axis.occurrences ?? []) {
      const path = occurrence.path;
      declared.add(`${path}\u0000${axis.id}`);
      const reachable = scanned.scannable.has(path) && !scanned.allowed(path);
      const hits = [...new Set(scanned.hitsByFile.get(`${path}\u0000${axis.id}`) ?? [])];
      let implementation;
      if (!isFile(path)) {
        implementation = "missing";
      } else if (!reachable) {
        // Declared but outside the lint's reach. That must be stated on the
        // occurrence, otherwise the ledger is claiming a check nobody runs.
        if (!trim(occurrence.unscannable)) {
          errors.push(
            `axes.${axis.id}.occurrences: ${path} is not reachable by lint.scan, declare \`unscannable\` with the reason`,
          );
        }
        implementation = "unverifiable";
      } else {
        implementation = hits.length > 0 ? "unported" : "ported";
      }
      rows.push({
        axis: axis.id,
        kind: axis.kind,
        path,
        declared: true,
        implementation,
        hits,
        note: trim(occurrence.unscannable) || null,
      });
    }
  }

  // Attributed hits at paths the ledger does not declare. Synthesized rather
  // than hand-written, so the unported surface stays a measurement.
  for (const [key, hits] of scanned.hitsByFile) {
    if (declared.has(key)) continue;
    const [path, axisId] = key.split("\u0000");
    rows.push({
      axis: axisId,
      kind: ledger.axes.find((a) => a.id === axisId)?.kind ?? null,
      path,
      declared: false,
      implementation: "unported",
      hits: [...new Set(hits)],
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

const filled = (value) => trim(value).length > 0;
const listed = (value) => Array.isArray(value) && value.length > 0;
const cellLabel = ({ axis, parameter }) => (parameter ? `${axis}.${parameter}` : axis);

// Bun's YAML hands back a Date for some unquoted timestamps, and a Date
// stringifies to something no reader would recognise as the recorded day.
const asDay = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : trim(value));
const asStamp = (value) =>
  value instanceof Date ? value.toISOString().replace(/\.\d+Z$/, "Z") : trim(value);

// A scenario is a procedure and a rubric. Any key that could hold what happened
// is rejected by name: an outcome stored beside the procedure is an outcome
// nothing recomputes, which is the failure the whole file exists to stop.
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
// changes what a playbook does instead of failing loudly. That is exactly the
// capability axes and the parameters of a parameter set, so the scope is
// derived from the ledger rather than restated. A new capability axis arrives
// uncovered and the coverage check names it. These are domains, not cells: a
// domain is an axis plus, for a parameter set, one parameter, with no harness
// in it. Each one spans every harness, so the harness cells they cover is this
// count multiplied by the harness list.
function highRiskDomains(ledger) {
  const domains = [];
  for (const axis of ledger.axes) {
    if (axis.kind === "capability") {
      domains.push({ axis: axis.id, parameter: null, kind: axis.kind });
    } else if (axis.kind === "parameter_set") {
      for (const parameter of axis.parameters ?? []) {
        domains.push({ axis: axis.id, parameter: parameter.id, kind: axis.kind });
      }
    }
  }
  return domains;
}

// A path plus what it holds, and nothing else. An artifact with no `holds` is a
// filename whose contents an operator has to guess.
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
    if (path.startsWith("/") || path.startsWith("./") || path.includes("..")) {
      errors.push(`${at}.path: ${path} must be plain run-relative`);
      continue;
    }
    if (seen.has(path)) errors.push(`${at}.path: ${path} declared twice`);
    seen.add(path);
    if (!filled(entry.holds)) errors.push(`${at}.holds: ${path} needs to say what it holds`);
    artifacts.push({ path, holds: trim(entry.holds) });
  }
  return artifacts;
}

// The contract every run extends. `required_metadata` is the interesting half:
// each entry is one `field: what it holds` pair, and the field name is what the
// engine then requires in a run's manifest. Prose here would be a requirement
// nothing checks.
function validateContract(where, contract, errors) {
  const at = `${where}.evidence_contract`;
  if (!contract) {
    errors.push(`${at}: missing, so no run has an artifact set to be complete against`);
    return null;
  }
  if (!filled(contract.run_dir)) errors.push(`${at}.run_dir: missing`);
  if (!filled(contract.run_id?.form)) errors.push(`${at}.run_id.form: missing`);

  const artifacts = readArtifacts(`${at}.required_artifacts`, contract.required_artifacts, errors);
  if (artifacts.length === 0) {
    errors.push(`${at}.required_artifacts: a run with no required artifact proves nothing`);
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
  for (const field of ["covers", "authored_by"]) {
    if (!filled(contract.digests?.[field])) errors.push(`${at}.digests.${field}: missing`);
  }
  for (const field of ["unsatisfiable_observations", "supersession"]) {
    if (!filled(contract[field])) errors.push(`${at}.${field}: missing`);
  }

  return {
    runIdForm: trim(contract.run_id?.form),
    artifacts: artifacts.map((a) => a.path),
    holds: new Map(artifacts.map((a) => [a.path, a.holds])),
    metadata,
  };
}

// Everything a scenario has to declare before a run of it could mean anything,
// plus the coverage join back onto the ledger. Coverage is per domain, and
// `applies_to` is what spreads one scenario over that domain's harness cells. A
// scenario that resolves to no axis, a domain with no scenario, and two
// scenarios over one domain are all the same class of error: the conformance
// set and the ledger disagree about what is being settled.
function validateScenarios(ledger, evidence, errors) {
  const at = ledger.evidence?.scenarios;
  const empty = { byId: new Map(), contract: null, coverage: [], voidConditions: [], harnesses: [] };
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
  for (const parity of PARITY) {
    if (!filled(doc.parity_rubric?.[parity])) errors.push(`${at}.parity_rubric.${parity}: missing`);
  }

  const voidConditions = [];
  if (!listed(doc.void_conditions)) {
    errors.push(`${at}.void_conditions: a run that cannot be voided cannot fail`);
  }
  for (const [i, condition] of (doc.void_conditions ?? []).entries()) {
    const cat = `${at}.void_conditions[${i}]`;
    const id = trim(condition?.id);
    if (!id) errors.push(`${cat}.id: missing`);
    else if (voidConditions.some((c) => c.id === id)) errors.push(`${cat}.id: ${id} declared twice`);
    for (const field of ["when", "why"]) {
      if (!filled(condition?.[field])) errors.push(`${cat}.${field}: missing`);
    }
    voidConditions.push({ id, when: trim(condition?.when), why: trim(condition?.why) });
  }

  const contract = validateContract(at, doc.evidence_contract, errors);
  const byId = new Map();
  const axisById = new Map(ledger.axes.map((a) => [a.id, a]));

  for (const [i, scenario] of (contract ? (doc.scenarios ?? []) : []).entries()) {
    const sat = `${at}.scenarios[${i}]`;
    for (const key of Object.keys(scenario ?? {})) {
      if (!SCENARIO_KEYS.includes(key)) errors.push(`${sat}.${key}: not part of the scenario schema`);
    }
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

    for (const field of ["risk", "question"]) {
      if (!filled(scenario[field])) errors.push(`${where}.${field}: missing`);
    }
    for (const field of ["preconditions", "steps"]) {
      if (!listed(scenario.setup?.[field])) errors.push(`${where}.setup.${field}: missing`);
    }

    const observations = [];
    // An observation may only be waived at run time where the scenario itself
    // says when that is legal. Dropping `unsatisfiable_when` here would leave
    // the engine unable to tell a declared waiver from a free-text excuse.
    const waivable = new Set();
    if (!listed(scenario.observations)) errors.push(`${where}.observations: a scenario observes nothing`);
    for (const [j, observation] of (scenario.observations ?? []).entries()) {
      const oat = `${where}.observations[${j}]`;
      for (const key of Object.keys(observation ?? {})) {
        if (!OBSERVATION_KEYS.includes(key)) errors.push(`${oat}.${key}: not part of the observation schema`);
      }
      const oid = trim(observation?.id);
      if (!oid) errors.push(`${oat}.id: missing`);
      else if (observations.includes(oid)) errors.push(`${oat}.id: ${oid} declared twice`);
      for (const field of ["observe", "grounds"]) {
        if (!filled(observation?.[field])) errors.push(`${oat}.${field}: missing`);
      }
      // The condition is the licence, so it has to be a written condition. A
      // bare `true` stringifies to something non-empty and would enroll the id
      // as waivable with nothing said about when.
      if ("unsatisfiable_when" in (observation ?? {})) {
        const when = observation.unsatisfiable_when;
        if (typeof when !== "string" || !filled(when)) {
          errors.push(`${oat}.unsatisfiable_when: name the condition, an empty waiver licenses every excuse`);
        } else if (oid) {
          waivable.add(oid);
        }
      }
      if (oid) observations.push(oid);
    }
    // A scenario every one of whose observations may be waived is a scenario a
    // run completes by observing nothing. The waiver is a narrow licence on one
    // observation, never a way out of the whole procedure.
    if (observations.length > 0 && waivable.size === observations.length) {
      errors.push(
        `${where}.observations: every observation declares unsatisfiable_when, so a run could complete this scenario while observing nothing`,
      );
    }

    for (const field of ["allowed", "prohibited"]) {
      if (!listed(scenario.parity?.[field])) {
        errors.push(`${where}.parity.${field}: enumerate them, an unenumerated difference is a finding`);
      }
    }
    for (const parity of PARITY) {
      if (!filled(scenario.parity_criteria?.[parity])) errors.push(`${where}.parity_criteria.${parity}: missing`);
    }

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

  return { byId, contract, coverage, voidConditions, harnesses };
}

// ---------------------------------------------------------------------------
// Conformance: runs
// ---------------------------------------------------------------------------

// Every regular file under a run directory, run-relative and sorted. The
// contract's digests cover every file and not just the declared artifacts, so a
// file that appeared after the record was written is something the record has
// to answer for.
//
// A Dirent never resolves a symlink, so a link to a directory reports
// isDirectory() === false and would be walked into the file list, where
// digestOf throws EISDIR and takes the whole check down. Anything that is not a
// real directory to descend into or a real file to digest is returned
// separately and reported, never silently dropped and never hashed.
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
// entry is compared against these whole rather than key by key, so there is no
// blend of the two for a check order to resolve.
const SATISFIED_SHAPE = "id, observed, source";
const WAIVED_SHAPE = "id, unsatisfiable";

// One judgement of a run directory, shared by `probe inspect` and by every
// attestation that cites a run, so the two cannot disagree. States, ordered by
// how much a reader may conclude from them:
//
//   absent      no directory
//   unexecuted  prepared and not yet run. What `probe prepare` leaves behind.
//   incomplete  run, and the evidence contract is not satisfied.
//   void        a void_condition fired. The run proves nothing; re-execute.
//   complete    the contract is satisfied. This is the only state an exercised
//               attestation may cite, and it is still not a verification: a
//               record has to exist, validate, and carry fresh digests.
// The report shape, so the enumeration and the absent case cannot drift apart.
function blankRun(ledger, runId) {
  return {
    runId,
    dir: join(ledger.evidence.runs, runId),
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
  const out = blankRun(ledger, runId);
  const { dir } = out;
  if (!isDir(dir)) return absentRun(ledger, runId);

  const walked = runFiles(dir);
  out.files = walked.files;
  out.irregular = walked.irregular;
  out.digests = out.files.map((path) => ({ path, digest: digestOf(join(dir, path)) }));
  if (out.irregular.length > 0) {
    out.problems.push(
      `not regular files, so nothing here digests them: ${out.irregular.join(", ")}`,
    );
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

  // Presence is not content, and the two are read together so that every exit
  // from here describes the same directory: a required artifact is missing, or
  // it is there and holds only whitespace, which records nothing either way.
  const survey = () => {
    out.missing = scenario.artifacts.filter((path) => !isFile(join(dir, path)));
    out.empty = scenario.artifacts.filter(
      (path) => !out.missing.includes(path) && !filled(read(join(dir, path))),
    );
  };

  const manifestPath = join(dir, "run.yaml");
  if (!isFile(manifestPath)) {
    survey();
    out.state = "incomplete";
    out.problems.push("run.yaml is absent, so nothing says what this directory is");
    return out;
  }
  // Emptiness is judged before the manifest is read, because a whitespace-only
  // run.yaml parses to null and would otherwise read as unexecuted. Unexecuted
  // is the softer state: it says a run is still waiting, where an empty
  // required artifact says the contract was broken.
  const manifestText = read(manifestPath);
  if (!filled(manifestText)) {
    survey();
    out.state = "incomplete";
    out.problems.push("run.yaml holds nothing, so nothing says what this directory is");
    return out;
  }
  let manifest = null;
  try {
    manifest = YAML.parse(manifestText);
  } catch (error) {
    return voidRun(null, `run.yaml does not parse, ${error.message}`);
  }

  // A prepared manifest carries no timestamps. That is the whole difference
  // between a directory that is waiting for a run and one that holds one. It
  // has fields in it, so the emptiness rule above never reclassifies it.
  if (!filled(asStamp(manifest?.started_at)) && !filled(asStamp(manifest?.ended_at))) {
    survey();
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
  for (const field of ["operator", "machine", "os", "harness_version", ...conformance.contract.metadata]) {
    if (!filled(manifest?.[field])) out.problems.push(`run.yaml.${field}: required by the evidence contract`);
  }
  for (const field of ["started_at", "ended_at"]) {
    const stamp = asStamp(manifest?.[field]);
    if (!UTC_STAMP.test(stamp)) out.problems.push(`run.yaml.${field}: needs a UTC timestamp with an offset`);
  }
  const started = asStamp(manifest?.started_at);
  const ended = asStamp(manifest?.ended_at);
  if (UTC_STAMP.test(started) && UTC_STAMP.test(ended) && Date.parse(ended) < Date.parse(started)) {
    out.problems.push("run.yaml: ended_at precedes started_at");
  }
  // A correction replaces one earlier run of the same scenario on the same
  // harness, and it comes after the run it replaces. Without both halves,
  // `supersedes` is an erasure primitive: one manifest line would void a run of
  // an unrelated cell, and two runs could void each other in a cycle. Strict
  // ordering on (date, counter) is what makes a cycle unrepresentable.
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
    } else if (!isDir(join(ledger.evidence.runs, supersedes))) {
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

  survey();
  if (out.missing.length > 0) {
    out.problems.push(`missing required artifacts: ${out.missing.join(", ")}`);
  }
  if (out.empty.length > 0) {
    out.problems.push(`required artifacts are empty: ${out.empty.join(", ")}`);
  }

  // Silence is the cheapest way to manufacture a pass, so an observation set
  // that is not the scenario's own set, in the scenario's own order, voids.
  // Emptiness is the contract failure `survey` already listed, so a
  // whitespace-only observations.yaml leaves the run incomplete and stops here.
  // void:missing_observation is for a file that has bytes and contradicts the
  // scenario's set; judging the set first would report an unwritten file as a
  // self-contradicting one.
  const observationsPath = join(dir, "observations.yaml");
  const observationsText = isFile(observationsPath) ? read(observationsPath) : null;
  if (filled(observationsText)) {
    let doc = null;
    try {
      doc = YAML.parse(observationsText);
    } catch (error) {
      return voidRun("missing_observation", `observations.yaml does not parse, ${error.message}`);
    }
    const entries = doc?.observations ?? [];
    const ids = entries.map((entry) => trim(entry?.id));
    if (ids.join("\u0000") !== scenario.observations.join("\u0000")) {
      return voidRun(
        "missing_observation",
        `observations.yaml: needs one entry per declared observation, in scenario order (${scenario.observations.join(", ")}), found ${ids.length > 0 ? ids.join(", ") : "none"}`,
      );
    }
    // An entry is one shape or the other and never a blend: `{id, observed,
    // source}` says the observation was made, `{id, unsatisfiable}` says it
    // could not be. Anything else is an entry that argues both ways, and the
    // reading that wins would be an accident of check order.
    for (const [i, entry] of entries.entries()) {
      const oat = `observations.yaml[${i}] ${ids[i]}`;
      const shape =
        entry && typeof entry === "object" && !Array.isArray(entry) ? Object.keys(entry).sort().join(", ") : null;
      if (shape !== SATISFIED_SHAPE && shape !== WAIVED_SHAPE) {
        return voidRun(
          "missing_observation",
          `${oat}: an entry is exactly {${SATISFIED_SHAPE}} or exactly {${WAIVED_SHAPE}}, found {${shape ?? "not a map"}}`,
        );
      }
      if (shape === WAIVED_SHAPE) {
        // The reason is the waiver. `unsatisfiable: false` and
        // `unsatisfiable: 0` stringify to something non-empty, so a type check
        // is what stops a run waiving an observation by writing the word no.
        if (typeof entry.unsatisfiable !== "string" || !filled(entry.unsatisfiable)) {
          return voidRun(
            "missing_observation",
            `${oat}: unsatisfiable carries the reason as text, found ${JSON.stringify(entry.unsatisfiable ?? null)}`,
          );
        }
        // A waiver is legal only where the scenario declared the condition
        // under which it is. Otherwise every observation is waivable by
        // assertion.
        if (!scenario.waivable.has(ids[i])) {
          return voidRun(
            "missing_observation",
            `${oat}: the scenario declares no unsatisfiable_when for this observation, so it cannot be waived`,
          );
        }
        continue;
      }
      // `observed` is the raw reading, so `false` is a result and has to
      // survive: two scenarios record exactly that. A list or a map is not a
      // reading. `source` is a locator, so it is text; `source: true` locates
      // nothing and would pass a stringified emptiness test.
      const recorded = entry.observed;
      const scalar =
        typeof recorded === "string" || typeof recorded === "number" || typeof recorded === "boolean";
      if (!scalar || !filled(recorded)) {
        return voidRun(
          "missing_observation",
          `${oat}: observed carries the recorded value, found ${JSON.stringify(recorded ?? null)}`,
        );
      }
      if (typeof entry.source !== "string" || !filled(entry.source)) {
        return voidRun(
          "missing_observation",
          `${oat}: source names the artifact and where in it, as text, found ${JSON.stringify(entry.source ?? null)}`,
        );
      }
    }
  }

  out.state = out.problems.length > 0 ? "incomplete" : "complete";
  return out;
}

// Supersession is a property of the set, not of one directory, so it is settled
// here: a run that a later complete run declares it corrects proves nothing,
// whatever its own directory says. `probe inspect` and every attestation citing
// the run then read the same void, and the correction cannot be ignored by
// citing the run it corrects.
//
// Only a complete correction withdraws anything. A prepared, incomplete, or
// void directory naming `supersedes` is a correction that has not been made,
// and letting it void its target would turn one manifest line plus
// `probe prepare` into a way to erase real evidence. Run ids sort in run order
// within a scenario and harness, and a correction is strictly later than its
// target, so a chain resolves front to back and no cycle can exist.
function inspectRuns(ledger, conformance, errors) {
  const base = ledger.evidence?.runs;
  const runs = new Map();
  if (!base || !isDir(base)) return runs;
  const ids = readdirSync(abs(base), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const id of ids) runs.set(id, inspectRun(ledger, conformance, id));

  // Authority is read from the per-directory states before any of them is
  // rewritten, so a corrector that is itself corrected still corrects, and a
  // chain resolves the same way whatever order the directories enumerate in.
  const correctors = new Map();
  for (const run of runs.values()) {
    if (run.state !== "complete" || !run.supersedes) continue;
    const named = correctors.get(run.supersedes) ?? [];
    named.push(run.runId);
    correctors.set(run.supersedes, named);
  }
  for (const [target, by] of correctors) {
    // One run has one corrector. Two complete runs both claiming to correct it
    // is a contradiction with no reading, and letting the first by directory
    // sort win would make the target's state an accident of its siblings'
    // names. Nothing is withdrawn; the check stops instead.
    if (by.length > 1) {
      errors.push(`${base}: ${by.join(" and ")} both supersede ${target}; a run has one corrector`);
      continue;
    }
    const prior = runs.get(target);
    if (!prior) continue;
    prior.supersededBy = by[0];
    prior.state = "void";
    prior.voided = "superseded";
    prior.problems.unshift(`superseded by ${by[0]}, which corrects it`);
  }
  return runs;
}

// ---------------------------------------------------------------------------
// Evidence: citation resolution, digests, verification
// ---------------------------------------------------------------------------

// Saved upstream files are sometimes line slices, named `<stem>.L<a>-L<b>.<ext>`
// where the stem may or may not keep its original extension. A citation carries
// upstream line numbers, so the slice's start line is the offset to subtract.
// Without this a cited line lands on unrelated code and manufactures evidence.
function resolveCitation(path) {
  if (isFile(path)) return { file: path, offset: 0, truncated: false };
  const dir = dirname(path);
  if (!existsSync(abs(dir))) return null;
  const name = basename(path);
  const ext = extname(name);
  const stems = [name, ext ? name.slice(0, -ext.length) : name];
  for (const entry of readdirSync(abs(dir))) {
    for (const stem of stems) {
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

function citationText(resolved, from, to) {
  const lines = read(resolved.file).split("\n");
  const start = Math.max(1, from - resolved.offset);
  const end = Math.max(start, (to ?? from) - resolved.offset);
  return lines.slice(start - 1, end).join("\n");
}

// RANK is display precedence, and nothing else. exercised outranks a local
// observation, which outranks source reading, which outranks nothing, so a cell
// shows the strongest thing anyone recorded about it. A record whose grounding
// stopped holding ranks at or below unverified rather than carrying a tier it no
// longer earns: void, superseded, and stale.
//
// Eligibility is a separate question, folded over every record on the cell
// rather than over the strongest one. Precedence is about what to print;
// recording a weaker note must never subtract a stronger record's standing.
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

const RECORD_KEYS = [
  "id",
  "method",
  "axis",
  "parameter",
  "harness",
  "scenario",
  "run",
  "artifacts",
  "sources",
  "observation",
  "recorded",
  "note",
  "supersedes",
];

// The grounding each method carries. A key belonging to another method is a
// record grounded two ways at once, where only one of them is ever checked.
const METHOD_KEYS = {
  static: ["sources"],
  observed_local: ["sources", "observation"],
  exercised: ["scenario", "run", "artifacts"],
};

const OBSERVATION_FIELDS = ["machine", "os", "cli_version", "cli_version_command", "date", "excerpt"];

// A cited file is checked four ways: it is a pinned upstream file saved under
// references/ and not one this repo generates, its digest still matches the
// bytes on disk, the cited range lands inside the file, and the expected
// substring is at that range. A digest that no longer matches is stale rather
// than wrong: the ground moved and a human has to look again.
function validateSources(ctx, record, at, errors, harness) {
  const generated = (ctx.ledger.generated ?? []).map((entry) => entry.path);
  let stale = false;
  for (const [j, source] of (record.sources ?? []).entries()) {
    const sat = `${at}.sources[${j}]`;
    const path = trim(source?.path);
    // A `..` segment climbs out of the repo, and a prefix test on the raw
    // string would not notice it.
    if (!path.startsWith("references/") || path.split("/").includes("..")) {
      errors.push(`${sat}.path: ${path || "missing"} must be a pinned file saved under references/`);
      continue;
    }
    // Citing a file the ledger renders is the ledger citing itself.
    if (generated.includes(path)) {
      errors.push(`${sat}.path: ${path} is generated from the ledger, so citing it grounds nothing`);
      continue;
    }
    const foreign = ctx.evidenceDirs.find((d) => d.id !== harness.id && path.startsWith(`${d.dir}/`));
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
    if (!from) {
      errors.push(`${sat}.lines: needs <from>[-<to>] in the original upstream numbering`);
      continue;
    }
    if (!filled(source.expect)) {
      errors.push(`${sat}.expect: a citation the engine cannot confirm is not a citation`);
      continue;
    }
    // A range past the end, or one landing before the start of a saved slice,
    // resolves to nothing and would confirm any `expect` at all.
    const total = read(resolved.file).split("\n").length;
    if (from - resolved.offset < 1 || (to ?? from) - resolved.offset > total) {
      errors.push(
        `${sat}.lines: ${source.lines} is outside ${resolved.file}, which holds ${total} lines` +
          (resolved.truncated ? ` of upstream L${resolved.span[0]}-L${resolved.span[1]}` : ""),
      );
      continue;
    }
    if (!citationText(resolved, from, to).includes(source.expect)) {
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
  for (const key of Object.keys(observation)) {
    if (!OBSERVATION_FIELDS.includes(key)) errors.push(`${at}.observation.${key}: not part of the observation schema`);
  }
  for (const field of OBSERVATION_FIELDS) {
    if (!filled(observation[field])) errors.push(`${at}.observation.${field}: missing`);
  }
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
  // The enumeration is the only list of run directories there is, and it holds
  // real directories only. Re-inspecting a name it left out would judge, by
  // path, exactly the entries it refused: a symlinked run dir, or a regular
  // file named like a run id.
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
    errors.push(
      `${at}.run: ${runId} is ${run.state}${run.problems.length > 0 ? `, ${run.problems[0]}` : ""}`,
    );
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
  for (const path of claimed.keys()) {
    if (!onDisk.has(path)) errors.push(`${at}.artifacts: ${path} is recorded and not in the run dir`);
  }
}

// A record that does not validate grounds nothing, so it returns void rather
// than its own method. There is no tier a malformed record can fall back to.
function validateRecord(ctx, record, at, errors) {
  const before = errors.length;
  for (const key of Object.keys(record ?? {})) {
    if (!RECORD_KEYS.includes(key)) errors.push(`${at}.${key}: not part of the record schema`);
  }
  if (!filled(record?.id)) errors.push(`${at}.id: missing`);

  const method = trim(record?.method);
  if (!METHODS.includes(method)) {
    errors.push(`${at}.method: must be one of ${METHODS.join(", ")}`);
    return "void";
  }
  for (const [other, keys] of Object.entries(METHOD_KEYS)) {
    if (other === method) continue;
    for (const key of keys) {
      if (record[key] !== undefined && !METHOD_KEYS[method].includes(key)) {
        errors.push(`${at}.${key}: ${method} does not take ${key}, it is how ${other} grounds a claim`);
      }
    }
  }

  const axis = ctx.axisById.get(record.axis);
  if (!axis) {
    errors.push(`${at}.axis: no axis ${record.axis}`);
    return "void";
  }
  if (axis.kind === "parameter_set") {
    const names = (axis.parameters ?? []).map((p) => p.id);
    if (!record.parameter) errors.push(`${at}.parameter: ${axis.id} is a parameter set, name the parameter`);
    else if (!names.includes(record.parameter)) {
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
    // Cursor is upstream's own target and has no saved source, so no cell of
    // its can reach static however the citation is written.
    if (!harness.evidence_dir) {
      errors.push(`${at}.method: ${harness.id} has no saved source, so no cell of its can reach static`);
    }
    if (!listed(record.sources)) errors.push(`${at}.sources: static needs at least one cited source`);
    if (filled(record.scenario)) {
      errors.push(`${at}.scenario: static grounds no scenario, reading a dispatcher is not running one`);
    }
    stale = validateSources(ctx, record, at, errors, harness);
  }
  if (method === "observed_local") {
    validateObservation(record, at, errors);
    stale = validateSources(ctx, record, at, errors, harness) || stale;
  }
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
    evidenceDirs: ledger.harnesses
      .filter((h) => h.evidence_dir)
      .map((h) => ({ id: h.id, dir: h.evidence_dir })),
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
    if (!Array.isArray(doc.attestations)) {
      errors.push(`${at}.attestations: must be a list; empty is correct until a run exists`);
    }
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

  // A superseded record stays readable and counts for nothing. That is the
  // whole difference between superseding a record and deleting one.
  for (const entry of entries) {
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
    const cellKey = cellOf(entry.record);
    const rank = RANK[entry.tier] ?? 0;
    let cell = cells.get(cellKey);
    if (!cell) {
      cell = { tier: entry.tier, rank, verified: false, exercised: false };
      cells.set(cellKey, cell);
    } else if (rank > cell.rank) {
      cell.tier = entry.tier;
      cell.rank = rank;
    }
    // Eligibility folds over every record, so an observed_local note added
    // beside a valid static citation raises what the cell displays without
    // taking away what the citation already established.
    if (VERIFIED.includes(entry.tier)) cell.verified = true;
    if (entry.tier === "exercised") cell.exercised = true;
  }
  const cellAt = (axisId, harnessId, parameterId) => cells.get(key(axisId, harnessId, parameterId)) ?? null;

  return {
    lookup: (axisId, harnessId, parameterId) => cellAt(axisId, harnessId, parameterId)?.tier ?? "unverified",
    verified: (axisId, harnessId, parameterId) => cellAt(axisId, harnessId, parameterId)?.verified ?? false,
    exercised: (axisId, harnessId, parameterId) => cellAt(axisId, harnessId, parameterId)?.exercised ?? false,
    records: entries.map((entry) => ({
      id: entry.id,
      tier: entry.tier,
      axis: entry.record?.axis ?? null,
      parameter: entry.record?.parameter ?? null,
      harness: entry.record?.harness ?? null,
    })),
    count: cells.size,
  };
}

// ---------------------------------------------------------------------------
// The model every command reads
// ---------------------------------------------------------------------------

function build() {
  const { ledger, errors } = loadLedger();
  if (errors.length > 0) return { ledger, errors, fatal: true };

  const tokens = buildTokens(ledger, errors);
  validate(ledger, tokens, errors);
  checkAsserts(ledger, errors);
  if (errors.length > 0) return { ledger, errors, fatal: true };

  const scanned = scan(ledger, tokens);
  const occurrences = deriveOccurrences(ledger, scanned, errors);
  const evidence = loadEvidence(ledger);
  const conformance = validateScenarios(ledger, evidence, errors);
  const runs = inspectRuns(ledger, conformance, errors);
  const verification = deriveVerification(ledger, evidence, conformance, runs, errors);

  const ported = portedSkills(ledger);
  const findings = scanned.findings.map((finding) => ({
    ...finding,
    kind: ported.has(skillOf(finding.file)) ? "regression" : "unported",
  }));

  return {
    ledger,
    tokens,
    errors,
    fatal: false,
    scanned,
    occurrences,
    evidence,
    conformance,
    runs,
    verification,
    findings,
    portedSkills: ported,
    harnesses: ledger.harnesses.map((h) => h.id),
  };
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

const row = (cells) => `| ${cells.join(" | ")} |`;
const head = (cells) => [row(cells), row(cells.map(() => "---"))].join("\n");
const MARKS = { native: "", substitute: "", degrade: "degraded, ", drop: "absent, " };

function byKind(model, kind) {
  return model.ledger.axes.filter((a) => a.kind === kind);
}

function renderCapabilities(model) {
  const { harnesses } = model;
  const capabilities = byKind(model, "capability");
  const parameterSets = byKind(model, "parameter_set");

  const capabilityTable = [
    head(["capability", ...harnesses]),
    ...capabilities.map((axis) =>
      row([
        `\`${axis.id}\``,
        ...harnesses.map((h) => `${MARKS[axis.resolution[h].parity]}${axis.resolution[h].use}`),
      ]),
    ),
  ].join("\n");

  const parameterTables = parameterSets
    .map((axis) =>
      [
        `### \`${axis.id}\``,
        "",
        trim(axis.what),
        "",
        head(["parameter", ...harnesses]),
        ...axis.parameters.map((parameter) =>
          row([`\`${parameter.id}\``, ...harnesses.map((h) => parameter.resolution[h]?.use ?? "-")]),
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

  return `<!-- Generated from coupling.yaml by scripts/render-capabilities.mjs. Do not edit. -->

# Capability map

Read your own harness column. Everything upstream resolved through a Cursor
primitive resolves here instead.

Cursor is one column, not the baseline. If you are running in Cursor, its column
is upstream's original behavior.

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

const cellText = (text) => trim(text).replace(/\s+/g, " ").replace(/\|/g, "\\|");

const firstSentence = (text) => {
  const match = text.match(/[\s\S]*?[.!?](?=\s|$)/);
  return cellText(match ? match[0] : text);
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
    if (front) {
      try {
        doc = YAML.parse(front[1]);
      } catch {
        doc = null;
      }
    }
    index.set(name, {
      id: name,
      label: trim(doc?.name) || name,
      description: firstSentence(trim(doc?.description)),
    });
  }
  return index;
}

// Every skill the ledger or the lint has something to say about: its
// occurrences, the axes those belong to, the findings inside it, and the Cursor
// mentions no axis owns. Grouping is derived, so a skill enters the report the
// moment a token lands in it.
function deriveSkills(model) {
  const index = skillIndex();
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
        axes: [],
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

  const rank = new Map(model.ledger.axes.map((axis, i) => [axis.id, i]));
  for (const group of groups.values()) {
    group.axes = [...new Set(group.occurrences.map((o) => o.axis))].sort(
      (a, b) => rank.get(a) - rank.get(b),
    );
  }

  return [...groups.values()].sort(
    (a, b) => Number(b.ported) - Number(a.ported) || a.id.localeCompare(b.id),
  );
}

// ---------------------------------------------------------------------------
// The portability report
// ---------------------------------------------------------------------------

// One row per domain. A parameter_set spreads into a row per parameter, because
// that is where its resolution actually lives. An invariant axis resolves the
// same way everywhere, so its replacement is named once under the table instead
// of five times inside it.
function axisRows(axis, harnesses) {
  if (axis.portable) return [{ parameter: null, resolution: null, invariant: false }];
  if (axis.resolution) return [{ parameter: null, resolution: axis.resolution, invariant: false }];
  if (axis.parameters) {
    return axis.parameters.map((p) => ({ parameter: p.id, resolution: p.resolution, invariant: false }));
  }
  return [
    {
      parameter: null,
      resolution: Object.fromEntries(harnesses.map((h) => [h.id, axis.invariant])),
      invariant: true,
    },
  ];
}

// parity, the replacement, and the verification of that cell. Cursor is
// upstream's own target, so with no evidence its cell reports upstream
// behavior. A record that names cursor is shown rather than hidden: the tally
// counts every cell the same way, and a verification the table does not print
// is one nobody can audit.
function parityCell(model, axis, harness, { resolution, parameter, invariant }) {
  if (!resolution) return "portable, standard field, unchanged";
  const cell = resolution[harness.id];
  if (!cell) return "unknown";
  const replacement = invariant ? "harness-independent" : cellText(cell.use);
  const verification = model.verification.lookup(axis.id, harness.id, parameter);
  if (harness.baseline && verification === "unverified") {
    return `${cell.parity}, ${replacement}, upstream behavior`;
  }
  return `${cell.parity}, ${replacement}, ${verification}`;
}

// What an invariant resolution means depends on the kind: a role or a
// prerequisite names the absent path, everything else names the replacement.
const INVARIANT_LEAD = {
  role: "with no value for the role",
  prerequisite: "without the binary",
};

function domainBlock(model, axes) {
  const harnesses = model.ledger.harnesses;
  const rows = [];
  for (const axis of axes) {
    for (const spec of axisRows(axis, harnesses)) {
      rows.push(
        row([
          `\`${axis.id}${spec.parameter ? `.${spec.parameter}` : ""}\` (${axis.kind})`,
          ...harnesses.map((h) => parityCell(model, axis, h, spec)),
        ]),
      );
    }
  }
  const table = [
    head(["domain", ...harnesses.map((h) => `${h.label}${h.baseline ? " (upstream)" : ""}`)]),
    ...rows,
  ].join("\n");

  const notes = axes
    .filter((axis) => axis.invariant)
    .map((axis) => {
      const lead = INVARIANT_LEAD[axis.kind];
      return `- \`${axis.id}\`${lead ? `, ${lead}` : ""}: ${cellText(axis.invariant.use)}`;
    });

  if (notes.length === 0) return table;
  return `${table}\n\nThe harness-independent replacements above, named once:\n\n${notes.join("\n")}`;
}

// Why a cell reads the way it does, from the same inputs that derived it. Every
// unported and unverifiable row names its reason rather than leaving the state
// to be interpreted.
function occurrenceReason(occurrence) {
  if (occurrence.implementation === "missing") {
    return "the file is gone, so the ledger is stale here";
  }
  if (occurrence.implementation === "unverifiable") {
    return occurrence.note ?? "outside `lint.scan`, so no check reads this file";
  }
  const hits = (occurrence.hits ?? []).map((hit) => `\`${hit}\``).join(", ");
  if (occurrence.implementation === "unported") {
    return occurrence.declared
      ? `a token of this domain still matches: ${hits || "unattributed"}`
      : `token hit at a path the ledger does not declare: ${hits || "unattributed"}`;
  }
  return "no token of this domain matches the file";
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function skillSection(model, group) {
  const axes = group.axes.map((id) => model.ledger.axes.find((a) => a.id === id));
  const files = new Set(group.occurrences.map((o) => o.path));
  const hitFiles = new Set(group.findings.map((f) => f.file));
  const lead = group.ported
    ? `Reached by the port. ${plural(group.occurrences.length, "occurrence")} across ${plural(files.size, "file")} and ${plural(axes.length, "domain")}.`
    : `Not reached by the port. ${plural(group.findings.length, "token hit")} across ${plural(hitFiles.size, "file")}, none of them a regression: the rows below are the resolution a port would inherit and the sites it would have to reach.`;

  const occurrenceRows = [...group.occurrences]
    .sort((a, b) => a.path.localeCompare(b.path) || a.axis.localeCompare(b.axis))
    .map((occurrence) =>
      row([
        `\`${occurrence.path}\``,
        `\`${occurrence.axis}\``,
        occurrence.declared ? "declared" : "detected",
        occurrence.implementation,
        // A token pattern is regex, so it carries pipes that would otherwise
        // split the row into extra columns.
        cellText(occurrenceReason(occurrence)),
      ]),
    );

  const parts = [`### \`${group.id}\``, "", group.description || "No description in frontmatter.", "", lead, ""];
  parts.push(
    axes.length > 0
      ? domainBlock(model, axes)
      : "No axis owns a token here. The only coupling is prose that names Cursor directly, which the lint counts but cannot attribute to a domain.",
    "",
  );
  if (occurrenceRows.length > 0) {
    parts.push([head(["file", "domain", "source", "implementation", "reason"]), ...occurrenceRows].join("\n"), "");
  }
  if (group.mentions.length > 0) {
    const cites = group.mentions.map((m) => `\`${m.file}:${m.line}\``).join(", ");
    parts.push(`Unattributed Cursor mentions, port work with no domain to resolve into: ${cites}`, "");
  }
  return parts.join("\n").trimEnd();
}

// One row per high-risk domain, not per cell: the scenario that covers the
// domain, and per harness the verification that domain's cell on that harness
// currently carries. A harness column reads what the evidence says, never
// whether the scenario was attempted, so `unverified` there means nobody has
// run it and not that it failed.
function conformanceTable(model) {
  const harnesses = model.ledger.harnesses;
  const rows = model.conformance.coverage.map(({ axis, parameter, scenario }) => {
    const runs = [...model.runs.values()].filter((run) => run.scenario === scenario?.id);
    return row([
      scenario ? `\`${scenario.id}\`` : "none",
      `\`${cellLabel({ axis, parameter })}\``,
      scenario ? String(scenario.observations.length) : "-",
      scenario ? String(scenario.artifacts.length) : "-",
      String(runs.length),
      ...harnesses.map((harness) => {
        if (!scenario) return "uncovered";
        if (!scenario.appliesTo.includes(harness.id)) return "n/a";
        return model.verification.lookup(axis, harness.id, parameter);
      }),
    ]);
  });
  return [
    head(["scenario", "domain", "observations", "artifacts", "runs", ...harnesses.map((h) => h.label)]),
    ...rows,
  ].join("\n");
}

function freshnessTable(model) {
  const counts = tally(model);
  const runStates = groupCount([...model.runs.values()], (run) => run.state);
  const tiers = groupCount(model.verification.records, (record) => record.tier);
  const spread = (map) => [...map].map(([state, n]) => `${n} ${state}`).join(", ");

  return [
    head(["measure", "value"]),
    row([
      "scenarios",
      `${counts.scenarios} defined, covering ${counts.highRiskDomains} high-risk domains, ` +
        `${counts.scenarioCells} of ${counts.highRiskCells} harness cells`,
    ]),
    row(["attestations", counts.attestations === 0 ? "none recorded" : `${counts.attestations} recorded`]),
    row(["evidence classes", tiers.size === 0 ? "none" : spread(tiers)]),
    row([
      "run directories",
      runStates.size === 0 ? `none under \`${model.ledger.evidence.runs}\`` : spread(runStates),
    ]),
    row(["cells exercised", `${counts.exercised} of ${counts.cells}`]),
    row(["digests", "sha256, recomputed from disk on every run"]),
  ].join("\n");
}

// What the freshness numbers mean, from the same inputs that produced them. An
// empty registry is said out loud rather than left to read as a clean bill.
function freshnessNote(model) {
  const runs = [...model.runs.values()];
  const records = model.verification.records;
  const lines = [];

  if (runs.length === 0 && records.length === 0) {
    lines.push(
      "No run directory exists and no attestation has been recorded, so every cell " +
        "above is `unverified`. That is a statement about what has been done, not " +
        "about what is true: nothing here has been looked at.",
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
    for (const [tier, meaning] of [
      ["void", "their grounding does not hold, and they count for nothing"],
      ["stale", "the cited file moved, and a human has to look again"],
      ["superseded", "a later record replaced them; they stay readable and count for nothing"],
    ]) {
      const group = records.filter((record) => record.tier === tier);
      if (group.length === 0) continue;
      lines.push(`${group.length} records are ${tier}: ${meaning}. ${group.map((r) => `\`${r.id}\``).join(", ")}.`);
    }
    if (lines.length === 0) lines.push("Every recorded grounding still holds against the files on disk.");
  }

  lines.push(
    "`observed_local` never counts as verified, at any count: it is one machine on " +
      "one day, recorded so it stops being mistaken for proof.",
  );
  lines.push(
    "`bun scripts/coupling.mjs probe list` names the scenarios, `probe prepare " +
      "<scenario> <harness>` writes an unexecuted run manifest and its artifact " +
      "checklist, and `probe inspect <run-id>` judges a run directory against the " +
      "contract. None of the three drives a harness, and none of them writes an " +
      "attestation.",
  );
  return lines.join("\n\n");
}

function renderReport(model) {
  const counts = tally(model);
  const groups = deriveSkills(model);
  const reached = groups.filter((g) => g.ported);
  const unreached = groups.filter((g) => !g.ported);
  const orphans = model.ledger.axes.filter((a) => (a.occurrences ?? []).length === 0);

  const totals = [
    head(["measure", "value"]),
    row(["ledger", `v${model.ledger.version}, upstream \`${model.ledger.upstream.sha.slice(0, 7)}\``]),
    row(["axes", String(model.ledger.axes.length)]),
    row(["harness cells", `${counts.verified} verified of ${counts.cells}`]),
    row(["occurrences", ORDER.map((state) => `${counts.occurrences[state]} ${state}`).join(", ")]),
    row(["skills reached", `${reached.length}: ${reached.map((g) => `\`${g.id}\``).join(", ")}`]),
    row(["skills not reached", `${unreached.length}, ${counts.unported} token hits`]),
    row(["regressions", String(counts.regressions)]),
    row([
      "conformance",
      `${counts.scenarios} scenarios over ${counts.highRiskDomains} high-risk domains, ` +
        `${counts.scenarioCells} of ${counts.highRiskCells} harness cells, ` +
        `${counts.runs} run directories, ${counts.attestations} attestations`,
    ]),
  ].join("\n");

  const orphanReasons = orphans
    .map((axis) => `- \`${axis.id}\` (${axis.kind}). ${trim(axis.no_occurrences)}`)
    .join("\n");

  return `<!-- Generated from coupling.yaml by \`bun scripts/coupling.mjs render\`. Do not edit. -->

# Portability report

Every value below is derived on each run. \`parity\` and the replacement come from
the ledger's resolution for that harness. \`implementation\` comes from the working
tree: an occurrence whose file still matches a token of its own domain is
unported, one whose file is gone is missing, one the lint cannot reach is
unverifiable. Verification comes from \`${model.ledger.evidence.attestations}\`, and
\`unverified\` is the default rather than a failure: it means no saved evidence
names that cell yet. An \`observed_local\` record is one machine's observation and
never counts as verified.

Cursor is upstream's own target. It has no harness registry entry and no saved
source, so its column reports upstream behavior and no Cursor cell can reach
\`static\`, which is the parity method that reads a saved source. A Cursor cell
can still reach \`exercised\`, on the same conformance run contract as every
other harness.

A cell reads \`parity, replacement, verification\`.

## Totals

${totals}

## Conformance

A domain is an axis and, for a parameter set, one of its parameters, with no
harness in it: one domain is one row below and one cell per harness. The
${counts.highRiskDomains} domains that carry a conformance scenario, defined in
\`${model.ledger.evidence.scenarios}\`, are ${counts.highRiskCells} of the ${counts.cells}
harness cells in the tables above, and the scenarios apply to ${counts.scenarioCells}
of them. Those are the domains where a wrong cell changes what a playbook does
instead of failing loudly, which is every capability axis and every parameter of
a parameter set. A scenario is a procedure and a rubric: it records no outcome,
and it asserts no parity value.

${conformanceTable(model)}

\`n/a\` is a harness the scenario does not apply to. No column reaches
\`exercised\` without a run directory that is complete against that scenario's
evidence contract and a record citing it whose per-file digests still match the
bytes on disk. Cursor is no exception: upstream's own target earns a run on the
same artifacts as everyone else.

### Evidence freshness

${freshnessTable(model)}

${freshnessNote(model)}

## Skills the port reached

A token hit in one of these is a regression, because the ledger declares
occurrences here and the port resolved them.

${reached.map((group) => skillSection(model, group)).join("\n\n")}

## Skills the port has not reached

No occurrence is declared in any of these, so their hits are unported work
rather than regressions. Each domain table is the resolution a port would
inherit; each occurrence row is detected on this run, not maintained by hand.

${unreached.map((group) => skillSection(model, group)).join("\n\n")}

## Domains with no occurrence

These resolve without a tracked site in the tree. Each one says why, so a
refresh diff against upstream has nothing silently exempt.

${domainBlock(model, orphans)}

${orphanReasons}
`;
}

// The README block. It lives inside a bounded marker region in a hand-written
// file, so it stays a summary and links out for the detail.
function renderSummary(model) {
  const counts = tally(model);
  const groups = deriveSkills(model);
  const reached = groups.filter((g) => g.ported).map((g) => `\`${g.id}\``);
  const unreached = groups.filter((g) => !g.ported).length;
  const upstream = model.ledger.upstream;

  return [
    "<!-- Generated from coupling.yaml by `bun scripts/coupling.mjs render`. Do not edit. -->",
    "",
    head(["measure", "value"]),
    row(["upstream pin", `\`${upstream.sha.slice(0, 7)}\`, path \`${upstream.path}\``]),
    row(["ported skills", `${reached.length}: ${reached.join(", ")}`]),
    row(["skills not reached", `${unreached}, in ${counts.unported} places the lint counts`]),
    row(["occurrences", ORDER.map((state) => `${counts.occurrences[state]} ${state}`).join(", ")]),
    row([
      "verification",
      `${counts.verified} of ${counts.cells} cells verified, ${counts.attestations} attestations, ${counts.scenarios} scenarios defined`,
    ]),
    "",
    "`bun scripts/coupling.mjs check` is the gate. Per-skill parity, replacement, and",
    "verification tables, including every skill the port has not reached, are in",
    "[PORTABILITY.md](PORTABILITY.md).",
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
    missing: model.occurrences.filter((o) => o.implementation === "missing").length,
    occurrences: byState,
    files: model.scanned.files.length,
    cells: cells.length,
    verified: cells.filter((c) => c.verified).length,
    exercised: cells.filter((c) => c.exercised).length,
    attestations: model.evidence.attestations.length,
    scenarios: model.conformance.byId.size,
    // A domain is axis plus parameter with no harness in it, so the cells those
    // domains span is the domain count times the harness list. `scenarioCells`
    // is narrower: the cells a scenario actually applies to.
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
// write are the same comparison and neither can touch the prose around it.
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

    if (!entry.marker) {
      const state =
        current === null ? (entry.state === "planned" ? "pending" : "absent") : current === body ? "current" : "drifted";
      targets.push({ ...entry, expected: body, current, state });
      continue;
    }
    if (current === null) {
      targets.push({ ...entry, expected: null, current, state: "absent" });
      continue;
    }
    const expected = spliceRegion(current, entry.marker, body.trim());
    targets.push({
      ...entry,
      expected,
      current,
      state: expected === null ? "unmarked" : current === expected ? "current" : "drifted",
    });
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
  console.error(`\n${errors.length} ledger problems`);
}

function commandCheck(argv) {
  const model = build();
  if (model.fatal || model.errors.length > 0) {
    reportErrors(model.errors);
    return 4;
  }

  const counts = tally(model);
  const drift = driftOf(model);
  const json = argv.includes("--json");

  const regressions = model.findings.filter((f) => f.kind === "regression");
  const unported = model.findings.filter((f) => f.kind === "unported");
  const missing = model.occurrences.filter((o) => o.implementation === "missing");
  const drifted = drift.filter((d) => BLOCKED.includes(d.state));

  if (json) {
    console.log(
      JSON.stringify(
        {
          regressions,
          unported,
          missing: missing.map((o) => ({ axis: o.axis, path: o.path })),
          generated: drift,
          counts,
        },
        null,
        2,
      ),
    );
  } else {
    for (const finding of regressions) {
      console.error(`${finding.file}:${finding.line}: ${finding.hit} — ${finding.why} [regression]`);
    }
    for (const occurrence of missing) {
      console.error(
        `coupling.yaml: ${occurrence.axis} occurrence ${occurrence.path} does not exist, the ledger is stale`,
      );
    }
    for (const finding of unported) {
      console.error(`${finding.file}:${finding.line}: ${finding.hit} — ${finding.why}`);
    }
    for (const entry of drift) {
      if (entry.state === "drifted") {
        console.error(`${entry.path}: no longer matches the ledger, re-run render`);
      } else if (entry.state === "absent") {
        console.error(`${entry.path}: declared rendered but absent`);
      } else if (entry.state === "unmarked") {
        console.error(`${entry.path}: its generated marker region is gone, restore it`);
      }
    }

    const parts = [];
    if (regressions.length > 0) parts.push(`${regressions.length} regressions`);
    if (missing.length > 0) parts.push(`${missing.length} stale occurrences`);
    if (unported.length > 0) parts.push(`${unported.length} unported findings`);
    if (drifted.length > 0) parts.push(`${drifted.length} generated files out of date`);
    const pending = drift.filter((d) => d.state === "pending").map((d) => d.path);
    console.log(
      parts.length === 0
        ? `clean, ${counts.files} markdown files`
        : `\n${parts.join(", ")} in ${counts.files} markdown files`,
    );
    if (pending.length > 0) console.log(`pending render: ${pending.join(", ")}`);
    const runStates = groupCount([...model.runs.values()], (run) => run.state);
    if (runStates.size > 0) {
      console.log(`runs: ${[...runStates].map(([state, n]) => `${n} ${state}`).join(", ")}`);
    }
    if (model.verification.count === 0) {
      console.log(
        `no attestations, every cell derives unverified, ${counts.scenarios} scenarios defined and none exercised`,
      );
    }
  }

  refresh(model, argv);

  if (regressions.length > 0 || missing.length > 0) return 2;
  if (drifted.length > 0) return 3;
  if (unported.length > 0) return argv.includes("--gate") ? 0 : 1;
  return 0;
}

// Sweep an upstream checkout for token hits at paths the ledger does not name.
// Occurrence paths are repo-relative, and upstream's are too, so the comparison
// is a straight set membership with no prefix surgery.
function refresh(model, argv) {
  const flag = argv.indexOf("--refresh");
  if (flag === -1) return;
  const upstream = argv[flag + 1];
  if (!upstream || !existsSync(upstream)) {
    console.error("--refresh needs a path to an upstream pstack checkout");
    process.exit(5);
  }
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

function commandStatus(argv) {
  const model = build();
  if (model.fatal || model.errors.length > 0) {
    reportErrors(model.errors);
    return 4;
  }

  const at = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? null : argv[i + 1];
  };
  const onlyHarness = at("--harness");
  const onlyAxis = at("--axis");
  if (onlyHarness && !model.harnesses.includes(onlyHarness)) {
    console.error(`--harness: unknown harness ${onlyHarness}`);
    return 5;
  }
  if (onlyAxis && !model.ledger.axes.some((a) => a.id === onlyAxis)) {
    console.error(`--axis: unknown axis ${onlyAxis}`);
    return 5;
  }

  const harnesses = onlyHarness ? [onlyHarness] : model.harnesses;
  const axes = model.ledger.axes.filter((a) => !onlyAxis || a.id === onlyAxis);
  const counts = tally(model);

  const cells = enumerateCells(model, harnesses, axes);

  const occurrences = model.occurrences.filter((o) => !onlyAxis || o.axis === onlyAxis);
  const drift = driftOf(model);

  if (argv.includes("--json")) {
    console.log(JSON.stringify({ cells, occurrences, generated: drift, counts }, null, 2));
    return 0;
  }

  console.log(`ledger v${model.ledger.version}, upstream ${model.ledger.upstream.sha.slice(0, 7)}`);
  console.log(
    `axes ${model.ledger.axes.length}, harnesses ${model.harnesses.length}, cells ${cells.length}`,
  );
  console.log("");
  for (const [state, n] of Object.entries(counts.occurrences)) {
    const detected = occurrences.filter((o) => o.implementation === state && !o.declared).length;
    console.log(`  occurrences ${state.padEnd(13)} ${String(n).padStart(4)}  (detected ${detected})`);
  }
  console.log("");
  for (const [verification, n] of groupCount(cells, (c) => c.verification)) {
    console.log(`  verification ${verification.padEnd(12)} ${String(n).padStart(4)}`);
  }
  console.log("");
  for (const [parity, n] of groupCount(cells, (c) => c.parity ?? "n/a")) {
    console.log(`  parity ${parity.padEnd(18)} ${String(n).padStart(4)}`);
  }
  console.log("");
  console.log(`  findings regression ${String(counts.regressions).padStart(5)}`);
  console.log(`  findings unported   ${String(counts.unported).padStart(5)}`);
  console.log("");
  for (const entry of drift) console.log(`  generated ${entry.state.padEnd(9)} ${entry.path}`);
  return 0;
}

function commandRender(argv) {
  const model = build();
  if (model.fatal || model.errors.length > 0) {
    reportErrors(model.errors);
    return 4;
  }

  const i = argv.indexOf("--only");
  const only = i === -1 ? null : argv[i + 1];
  const dryRun = argv.includes("--dry-run");
  const checkOnly = argv.includes("--check");

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
function commandAttest(argv) {
  const target = argv.find((a) => !a.startsWith("--"));
  if (!target) {
    console.error("attest needs <reference-path>[:<from>[-<to>]]");
    return 5;
  }
  const match = target.match(/^(.*?)(?::(\d+)(?:-(\d+))?)?$/);
  const [, path, from, to] = match;
  const resolved = resolveCitation(path);
  if (!resolved) {
    console.error(`${path} is not saved under references/`);
    return 5;
  }
  console.log(`path: ${path}`);
  console.log(`file: ${resolved.file}`);
  if (resolved.truncated) {
    console.log(`slice: L${resolved.span[0]}-L${resolved.span[1]}, offset ${resolved.offset}`);
  }
  console.log(`digest: ${digestOf(resolved.file)}`);
  if (from) {
    console.log(`lines: ${from}${to ? `-${to}` : ""}`);
    console.log("---");
    console.log(citationText(resolved, Number(from), to ? Number(to) : undefined));
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
  console.log(
    `${rows.length} high-risk domains, ${scenarioCells} of ${domainCells} harness cells, ` +
      `${model.conformance.byId.size} scenarios`,
  );
  for (const entry of rows) {
    console.log("");
    console.log(`${entry.scenario ?? "UNCOVERED"}  ${entry.domain}`);
    console.log(`  applies to    ${entry.applies_to.join(", ") || "-"}`);
    console.log(`  observations  ${entry.observations.length}: ${entry.observations.join(", ")}`);
    console.log(`  artifacts     ${entry.artifacts.length}: ${entry.artifacts.join(", ")}`);
    console.log(
      `  verification  ${Object.entries(entry.verification)
        .map(([harness, tier]) => `${harness}=${tier}`)
        .join(" ")}`,
    );
    console.log(
      entry.runs.length === 0
        ? "  runs          none"
        : `  runs          ${entry.runs.map((run) => `${run.run} (${run.state})`).join(", ")}`,
    );
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
  if (!scenarioId || !harnessId) {
    console.error("probe prepare needs <scenario> <harness>");
    return 5;
  }
  const scenario = model.conformance.byId.get(scenarioId);
  if (!scenario) {
    console.error(`no scenario ${scenarioId}; \`probe list\` names them`);
    return 5;
  }
  if (!scenario.appliesTo.includes(harnessId)) {
    console.error(`${scenarioId} applies to ${scenario.appliesTo.join(", ")}, not ${harnessId}`);
    return 5;
  }

  const contract = model.conformance.contract;
  const day = new Date().toISOString().slice(0, 10);
  const prefix = `${scenarioId}.${harnessId}.${day}.`;
  const sameDay = [...model.runs.values()].filter((run) => run.runId.startsWith(prefix));
  // Preparing twice in one day is nearly always the operator re-reading the
  // checklist, so an unexecuted directory is handed back instead of duplicated.
  // A counter bump is what a genuine second run gets.
  const prepared = sameDay.find((run) => run.state === "unexecuted");
  if (prepared) {
    console.error(`${prepared.dir} is already prepared and unexecuted; run it, or inspect it`);
    return 5;
  }
  const runId = `${prefix}${String(sameDay.length + 1).padStart(2, "0")}`;
  const dir = join(model.ledger.evidence.runs, runId);

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
    "started_at: null",
    "ended_at: null",
    "operator: null",
    "machine: null",
    "os: null",
    "harness_version: null",
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
  console.log(`  run.yaml      unexecuted manifest, ${contract.metadata.length + 6} fields to fill`);
  console.log(
    `  CHECKLIST.md  ${scenario.artifacts.length} required artifacts, ${scenario.observations.length} observations`,
  );
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
  if (!target) {
    console.error("probe inspect needs <run-id>");
    return 5;
  }
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
  console.log(
    report.state === "complete"
      ? `Complete against ${report.scenario}'s evidence contract. That is not a verification: a record in ${model.ledger.evidence.attestations} has to cite this run and carry the digests above.`
      : report.supersededBy
        ? `${report.state}: ${report.supersededBy} corrects this run, so cite that one. Nothing here may be attested.`
        : `${report.state}: nothing here may be attested.`,
  );
  console.log("inspect wrote nothing.");
  return PROBE_EXIT[report.state];
}

function commandProbe(argv) {
  const model = build();
  if (model.fatal || model.errors.length > 0) {
    reportErrors(model.errors);
    return 4;
  }
  const json = argv.includes("--json");
  const [sub, ...rest] = argv.filter((arg) => !arg.startsWith("--"));
  if (sub === "list") return probeList(model, json);
  if (sub === "prepare") return probePrepare(model, rest);
  if (sub === "inspect") return probeInspect(model, rest, json);
  console.error(PROBE_USAGE);
  return 5;
}

const COMMANDS = {
  check: commandCheck,
  status: commandStatus,
  render: commandRender,
  attest: commandAttest,
  probe: commandProbe,
};

const [command, ...argv] = process.argv.slice(2);
if (!COMMANDS[command]) {
  console.error(`usage: bun scripts/coupling.mjs <${Object.keys(COMMANDS).join("|")}> [options]`);
  process.exit(5);
}
process.exit(COMMANDS[command](argv));
