"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const parser = require("../../MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js");

const repoRoot = path.resolve(__dirname, "..", "..");
const parserPath = path.join(
  repoRoot,
  "MORNINGSTAR_PDF_PARSER",
  "src",
  "cargador_lotes_v_2.js"
);
const rootCliPath = path.join(repoRoot, "MORNINGSTAR_PDF_PARSER", "bin", "parse_dry_run.js");
const scriptsWrapperPath = path.join(
  repoRoot,
  "scripts",
  "MORNINGSTAR_PDF_PARSER",
  "cargador_lotes_v_2.js"
);
const wrapperPath = path.join(repoRoot, "scripts", "maintenance", "cargador_lotes_v_2.js");

{
  const options = parser.buildRuntimeOptions([]);
  assert.strictEqual(options.dryRun, true);
  assert.strictEqual(options.writeEnabled, false);
  assert.strictEqual(options.wouldWrite, false);
}

{
  assert.throws(
    () => parser.buildRuntimeOptions(["--write"]),
    /WRITE_BLOCKED: --write requires --confirm-write/
  );
}

{
  const options = parser.buildRuntimeOptions(["--write", "--confirm-write"]);
  assert.strictEqual(options.dryRun, false);
  assert.strictEqual(options.writeEnabled, true);
}

{
  const payload = {
    isin: "LU1234567890",
    ms: { category_morningstar: "Test" },
    manual: { costs: { retrocession: 1.41 } },
  };
  assert.throws(() => parser.assertNoManualFields(payload), /MANUAL_FIELD_GUARD/);
}

{
  const payload = {
    isin: "LU1234567890",
    ms: { category_morningstar: "Test" },
    derived: {},
  };
  assert.strictEqual(parser.assertNoManualFields(payload), true);
}

{
  const artifact = parser.buildParserDryRunArtifact({
    files: ["LU1234567890.pdf"],
    ok: 1,
    review: 0,
    fail: 0,
  });
  assert.strictEqual(artifact.dry_run, true);
  assert.strictEqual(artifact.would_write, false);
  assert.deepStrictEqual(artifact.fields_preserved, [
    "manual",
    "manual.costs",
    "manual.costs.retrocession",
  ]);
}

{
  const dataWorkPath = parser.resolveConfigPath("subcategory_sectors_mapping.csv", {
    configDir: null,
  });
  assert.ok(dataWorkPath.endsWith(path.join("data", "work", "subcategory_sectors_mapping.csv")));

  const pythonScriptsPath = parser.resolveConfigPath("subcategory_tokens_mapping.csv", {
    configDir: null,
    searchDirs: [path.join(repoRoot, "functions_python", "scripts")],
  });
  assert.ok(
    pythonScriptsPath.endsWith(
      path.join("functions_python", "scripts", "subcategory_tokens_mapping.csv")
    )
  );

  const searchDirs = parser.getConfigSearchDirs(parser.buildRuntimeOptions([]));
  assert.ok(
    searchDirs.some((dir) => dir.endsWith(path.join("MORNINGSTAR_PDF_PARSER", "config")))
  );
  assert.ok(
    searchDirs.some((dir) => dir.endsWith(path.join("scripts", "MORNINGSTAR_PDF_PARSER", "config")))
  );
}

{
  assert.throws(
    () =>
      parser.resolveConfigPath("missing_required_config.csv", {
        configDir: path.join(os.tmpdir(), "bdb-parser-missing-config"),
        searchDirs: [],
      }),
    /Missing required config CSV missing_required_config.csv/
  );
}

{
  const initOptions = parser.getFirebaseInitOptions({});
  assert.deepStrictEqual(initOptions, {});
}

{
  const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), "bdb-parser-empty-"));
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "bdb-parser-artifacts-"));
  const result = spawnSync(
    process.execPath,
    [parserPath, "--dir", inputDir, "--output-dir", outputDir],
    {
      cwd: repoRoot,
      encoding: "utf8",
    }
  );
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /DRY_RUN_ONLY/);
  assert.doesNotMatch(result.stdout, /Firebase Admin initialized/);

  const artifactPath = path.join(outputDir, "parser_dry_run_latest.json");
  assert.ok(fs.existsSync(artifactPath));
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  assert.strictEqual(artifact.dry_run, true);
  assert.strictEqual(artifact.would_write, false);
}

{
  const result = spawnSync(process.execPath, [parserPath, "--write"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.notStrictEqual(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /WRITE_BLOCKED/);
}

{
  const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), "bdb-parser-wrapper-empty-"));
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "bdb-parser-wrapper-artifacts-"));
  const result = spawnSync(
    process.execPath,
    [wrapperPath, "--dir", inputDir, "--output-dir", outputDir],
    {
      cwd: repoRoot,
      encoding: "utf8",
    }
  );
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  assert.match(`${result.stderr}\n${result.stdout}`, /MORNINGSTAR_PDF_PARSER/);
  assert.match(result.stdout, /DRY_RUN_ONLY/);

  const artifactPath = path.join(outputDir, "parser_dry_run_latest.json");
  assert.ok(fs.existsSync(artifactPath));
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  assert.strictEqual(artifact.dry_run, true);
  assert.strictEqual(artifact.would_write, false);
}

{
  const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), "bdb-parser-root-cli-empty-"));
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "bdb-parser-root-cli-artifacts-"));
  const result = spawnSync(
    process.execPath,
    [rootCliPath, "--input", inputDir, "--output-dir", outputDir],
    {
      cwd: repoRoot,
      encoding: "utf8",
    }
  );
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  assert.match(`${result.stderr}\n${result.stdout}`, /ENTRADA/);
  assert.match(`${result.stderr}\n${result.stdout}`, /SALIDA/);
  assert.match(result.stdout, /DRY_RUN_ONLY/);

  const artifactPath = path.join(outputDir, "parser_dry_run_latest.json");
  assert.ok(fs.existsSync(artifactPath));
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  assert.strictEqual(artifact.dry_run, true);
  assert.strictEqual(artifact.would_write, false);
}

{
  const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), "bdb-parser-scripts-wrapper-empty-"));
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "bdb-parser-scripts-wrapper-artifacts-"));
  const result = spawnSync(
    process.execPath,
    [scriptsWrapperPath, "--dir", inputDir, "--output-dir", outputDir],
    {
      cwd: repoRoot,
      encoding: "utf8",
    }
  );
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  assert.match(`${result.stderr}\n${result.stdout}`, /MORNINGSTAR_PDF_PARSER/);
  assert.match(result.stdout, /DRY_RUN_ONLY/);

  const artifactPath = path.join(outputDir, "parser_dry_run_latest.json");
  assert.ok(fs.existsSync(artifactPath));
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  assert.strictEqual(artifact.dry_run, true);
  assert.strictEqual(artifact.would_write, false);
}

{
  const result = spawnSync(process.execPath, [wrapperPath, "--write"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.notStrictEqual(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /WRITE_BLOCKED/);
}

console.log("cargador_lotes_v2 hardening tests passed");
