"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const VALIDATOR_PATH = path.join(ROOT_DIR, "overrides", "validate_manual_overrides.js");
const FIXTURES_DIR = path.join(__dirname, "fixtures");

const CANONICAL_FIXTURE_DIR = path.join(FIXTURES_DIR, "04_canonical");
const VALID_OVERRIDE_FIXTURE = path.join(FIXTURES_DIR, "05_overrides_valid", "base_valid_override.json");
const INVALID_OVERRIDE_FIXTURE = path.join(FIXTURES_DIR, "05_overrides_invalid", "base_invalid_override.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

function listFiles(dirPath, prefix) {
  return fs
    .readdirSync(dirPath)
    .filter((name) => name.startsWith(prefix))
    .map((name) => path.join(dirPath, name));
}

function createTempRunDirs() {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "bdb-manual-overrides-test-"));
  const canonicalDir = path.join(baseDir, "04_canonical");
  const overridesDir = path.join(baseDir, "05_overrides");
  const manifestDir = path.join(baseDir, "07_manifests");
  const logsDir = path.join(baseDir, "08_logs");
  fs.mkdirSync(canonicalDir, { recursive: true });
  fs.mkdirSync(overridesDir, { recursive: true });
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });
  return { baseDir, canonicalDir, overridesDir, manifestDir, logsDir };
}

function runValidatorInProcess({ overrideDoc, canonicalFixtureName }) {
  const dirs = createTempRunDirs();

  const canonicalDoc = readJson(path.join(CANONICAL_FIXTURE_DIR, canonicalFixtureName));
  writeJson(path.join(dirs.canonicalDir, `${canonicalDoc.isin}.json`), canonicalDoc);
  writeJson(path.join(dirs.overridesDir, "override.json"), overrideDoc);

  const previousArgv = process.argv.slice();
  const previousExitCode = process.exitCode;
  const originalLog = console.log;
  const originalError = console.error;
  const out = [];
  const err = [];

  console.log = (...args) => out.push(args.map((x) => String(x)).join(" "));
  console.error = (...args) => err.push(args.map((x) => String(x)).join(" "));

  process.argv = [
    process.execPath,
    VALIDATOR_PATH,
    "--canonical-dir",
    dirs.canonicalDir,
    "--overrides-dir",
    dirs.overridesDir,
    "--manifest-dir",
    dirs.manifestDir,
    "--logs-dir",
    dirs.logsDir,
    "--quiet",
  ];
  process.exitCode = 0;

  let runtimeError = null;
  try {
    delete require.cache[require.resolve(VALIDATOR_PATH)];
    require(VALIDATOR_PATH);
  } catch (e) {
    runtimeError = e;
  } finally {
    console.log = originalLog;
    console.error = originalError;
    process.argv = previousArgv;
  }

  const exitCode = process.exitCode ?? 0;
  process.exitCode = previousExitCode;

  const manifestFiles = listFiles(dirs.manifestDir, "manual_overrides_validation_manifest_");
  const logFiles = listFiles(dirs.logsDir, "manual_overrides_validation_");

  const result = {
    dirs,
    runtimeError,
    exitCode,
    stdout: out.join("\n"),
    stderr: err.join("\n"),
    manifestPath: manifestFiles[0] || null,
    logPath: logFiles[0] || null,
    manifest: manifestFiles[0] ? readJson(manifestFiles[0]) : null,
  };

  return result;
}

function collectCodes(issues) {
  return new Set((issues || []).map((x) => x.code));
}

function assertCodesContain(issues, expectedCodes, label) {
  const codes = collectCodes(issues);
  for (const code of expectedCodes || []) {
    assert.ok(codes.has(code), `${label} expected code '${code}', got [${Array.from(codes).join(", ")}]`);
  }
}

function cloneBaseOverride(base) {
  return structuredClone(base);
}

const BASE_VALID = readJson(VALID_OVERRIDE_FIXTURE);
const BASE_INVALID = readJson(INVALID_OVERRIDE_FIXTURE);

const CASES = [
  {
    id: "A1",
    name: "override valido con set",
    canonicalFixture: "canonical_base.json",
    expectedExitCode: 0,
    expectedResult: "OK",
    mutate(ovr) {
      ovr.operations = [{ op: "set", path: "classification_v2.asset_subtype", value: "THEMATIC_EQUITY", reason: "Set valido" }];
    },
  },
  {
    id: "A2",
    name: "override valido con append_unique",
    canonicalFixture: "canonical_base.json",
    expectedExitCode: 0,
    expectedResult: "OK",
    mutate(ovr) {
      ovr.operations = [{ op: "append_unique", path: "classification_v2.strategy_tags", value: ["theme:water"], reason: "Append unico valido" }];
    },
  },
  {
    id: "A3",
    name: "override valido con remove_values",
    canonicalFixture: "canonical_base.json",
    expectedExitCode: 0,
    expectedResult: "OK",
    mutate(ovr) {
      ovr.operations = [{ op: "remove_values", path: "classification_v2.strategy_tags", value: ["theme:climate"], reason: "Remove values valido" }];
    },
  },
  {
    id: "A4",
    name: "override valido con unset",
    canonicalFixture: "canonical_base.json",
    expectedExitCode: 0,
    expectedResult: "OK",
    mutate(ovr) {
      ovr.operations = [{ op: "unset", path: "eligibility.review_required", reason: "Unset valido" }];
    },
  },
  {
    id: "A5",
    name: "override valido con status approved",
    canonicalFixture: "canonical_base.json",
    expectedExitCode: 0,
    expectedResult: "OK",
    mutate(ovr) {
      ovr.status = "approved";
      ovr.operations = [{ op: "set", path: "quality_flags.manual_override", value: true, reason: "Approved status valido" }];
    },
  },
  {
    id: "A6",
    name: "override valido con status draft (warning sin error)",
    canonicalFixture: "canonical_base.json",
    expectedExitCode: 0,
    expectedResult: "WARNING",
    expectedWarningCodes: ["status_not_approved"],
    mutate(ovr) {
      ovr.status = "draft";
      delete ovr.approved_by;
      delete ovr.approved_at;
      ovr.operations = [{ op: "set", path: "quality_flags.manual_override", value: true, reason: "Draft con warning" }];
    },
  },
  {
    id: "B7",
    name: "path prohibido ms.category_morningstar",
    canonicalFixture: "canonical_base.json",
    expectedExitCode: 1,
    expectedResult: "ERROR",
    expectedErrorCodes: ["prohibited_path"],
    mutate(ovr) {
      ovr.operations = [{ op: "set", path: "ms.category_morningstar", value: "RV Sector Ecologia", reason: "Debe fallar" }];
    },
  },
  {
    id: "B8",
    name: "append_unique con value no array",
    canonicalFixture: "canonical_base.json",
    expectedExitCode: 1,
    expectedResult: "ERROR",
    expectedErrorCodes: ["invalid_value_for_array_op"],
    mutate(ovr) {
      ovr.operations = [{ op: "append_unique", path: "classification_v2.strategy_tags", value: "theme:water", reason: "Debe ser array" }];
    },
  },
  {
    id: "B9",
    name: "remove_values con value no array",
    canonicalFixture: "canonical_base.json",
    expectedExitCode: 1,
    expectedResult: "ERROR",
    expectedErrorCodes: ["invalid_value_for_array_op"],
    mutate(ovr) {
      ovr.operations = [{ op: "remove_values", path: "classification_v2.strategy_tags", value: "theme:climate", reason: "Debe ser array" }];
    },
  },
  {
    id: "B10",
    name: "set sin value",
    canonicalFixture: "canonical_base.json",
    expectedExitCode: 1,
    expectedResult: "ERROR",
    expectedErrorCodes: ["missing_value_for_set"],
    mutate(ovr) {
      ovr.operations = [{ op: "set", path: "classification_v2.asset_subtype", reason: "Falta value" }];
    },
  },
  {
    id: "B11",
    name: "ISIN invalido",
    canonicalFixture: "canonical_base.json",
    expectedExitCode: 1,
    expectedResult: "ERROR",
    expectedErrorCodes: ["invalid_isin"],
    mutate(ovr) {
      ovr.isin = "INVALID";
      ovr.operations = [{ op: "set", path: "classification_v2.asset_subtype", value: "THEMATIC_EQUITY", reason: "ISIN invalido" }];
    },
  },
  {
    id: "B12",
    name: "status approved sin approved_by",
    canonicalFixture: "canonical_base.json",
    expectedExitCode: 1,
    expectedResult: "ERROR",
    expectedErrorCodes: ["missing_approved_by"],
    mutate(ovr) {
      ovr.status = "approved";
      delete ovr.approved_by;
      ovr.operations = [{ op: "set", path: "classification_v2.asset_subtype", value: "THEMATIC_EQUITY", reason: "Falta approved_by" }];
    },
  },
  {
    id: "B13",
    name: "root no permitido",
    canonicalFixture: "canonical_base.json",
    expectedExitCode: 1,
    expectedResult: "ERROR",
    expectedErrorCodes: ["path_not_allowed"],
    mutate(ovr) {
      ovr.operations = [{ op: "set", path: "root_no_permitido.campo", value: 1, reason: "Root invalido" }];
    },
  },
  {
    id: "B14",
    name: "operacion no permitida",
    canonicalFixture: "canonical_base.json",
    expectedExitCode: 1,
    expectedResult: "ERROR",
    expectedErrorCodes: ["operation_not_allowed"],
    base: "invalid",
    mutate(ovr) {
      ovr.status = "approved";
      ovr.approved_by = "QA";
      ovr.approved_at = "2026-04-18T10:05:00Z";
      ovr.operations = [{ op: "replace", path: "classification_v2.asset_subtype", value: "THEMATIC_EQUITY", reason: "Operacion invalida" }];
    },
  },
  {
    id: "C15",
    name: "unset sobre campo inexistente en canonical -> warning",
    canonicalFixture: "canonical_base.json",
    expectedExitCode: 0,
    expectedResult: "WARNING",
    expectedWarningCodes: ["canonical_path_not_found"],
    mutate(ovr) {
      ovr.operations = [{ op: "unset", path: "eligibility.no_existe", reason: "Campo no existente" }];
    },
  },
  {
    id: "C16",
    name: "append_unique sobre campo existente no array -> error",
    canonicalFixture: "canonical_non_array.json",
    expectedExitCode: 1,
    expectedResult: "ERROR",
    expectedErrorCodes: ["array_operation_target_not_array"],
    mutate(ovr) {
      ovr.operations = [{ op: "append_unique", path: "manual_notes.tags", value: ["new"], reason: "Target no array" }];
    },
  },
  {
    id: "C17",
    name: "remove_values sobre campo existente no array -> error",
    canonicalFixture: "canonical_non_array.json",
    expectedExitCode: 1,
    expectedResult: "ERROR",
    expectedErrorCodes: ["array_operation_target_not_array"],
    mutate(ovr) {
      ovr.operations = [{ op: "remove_values", path: "manual_notes.tags", value: ["initial"], reason: "Target no array" }];
    },
  },
  {
    id: "C18",
    name: "set redundante con mismo valor de canonical -> warning",
    canonicalFixture: "canonical_base.json",
    expectedExitCode: 0,
    expectedResult: "WARNING",
    expectedWarningCodes: ["redundant_set"],
    mutate(ovr) {
      ovr.operations = [{ op: "set", path: "classification_v2.asset_subtype", value: "GLOBAL_EQUITY", reason: "Mismo valor" }];
    },
  },
];

function executeScenario(scenario, index) {
  const base = scenario.base === "invalid" ? BASE_INVALID : BASE_VALID;
  const overrideDoc = cloneBaseOverride(base);

  overrideDoc.override_id = `OVR-2026-${String(1000 + index).padStart(4, "0")}`;
  overrideDoc.reason = `${scenario.id} regression`;
  overrideDoc.author = "QA";
  overrideDoc.created_at = "2026-04-18T10:00:00Z";
  if (!("status" in overrideDoc)) overrideDoc.status = "approved";
  if (overrideDoc.status === "approved") {
    overrideDoc.approved_by = overrideDoc.approved_by || "QA";
    overrideDoc.approved_at = overrideDoc.approved_at || "2026-04-18T10:05:00Z";
  }

  scenario.mutate(overrideDoc);

  const run = runValidatorInProcess({
    overrideDoc,
    canonicalFixtureName: scenario.canonicalFixture,
  });

  try {
    if (run.runtimeError) {
      throw run.runtimeError;
    }

    assert.equal(run.exitCode, scenario.expectedExitCode, `Unexpected exit code. stdout:\n${run.stdout}\nstderr:\n${run.stderr}`);
    assert.match(run.stdout, /Summary:/, "Summary line missing in stdout");

    assert.ok(run.manifestPath, "Manifest path missing");
    assert.ok(run.logPath, "Log path missing");
    assert.ok(fs.existsSync(run.manifestPath), "Manifest file not found");
    assert.ok(fs.existsSync(run.logPath), "Log file not found");

    assert.ok(run.manifest, "Manifest JSON missing");
    assert.equal(run.manifest.files.length, 1, "Expected one file in manifest");
    assert.equal(run.manifest.files[0].result, scenario.expectedResult, "Unexpected file result");

    assertCodesContain(run.manifest.files[0].errors, scenario.expectedErrorCodes, `${scenario.id} errors`);
    assertCodesContain(run.manifest.files[0].warnings, scenario.expectedWarningCodes, `${scenario.id} warnings`);
  } finally {
    fs.rmSync(run.dirs.baseDir, { recursive: true, force: true });
  }
}

let passed = 0;
let failed = 0;

for (let i = 0; i < CASES.length; i++) {
  const scenario = CASES[i];
  const label = `${scenario.id} - ${scenario.name}`;
  try {
    executeScenario(scenario, i);
    passed += 1;
    console.log(`OK   ${label}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL ${label}`);
    console.error(e && e.stack ? e.stack : String(e));
  }
}

console.log(`\nSummary: total=${CASES.length} passed=${passed} failed=${failed}`);
if (failed > 0) {
  process.exitCode = 1;
}
