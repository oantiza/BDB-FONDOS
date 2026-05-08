"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const parser = require("../src/cargador_lotes_v_2.js");
const parseArgs = require("../src/cli/parse_args");
const pathResolver = require("../src/io/path_resolver");
const fileMover = require("../src/io/file_mover");
const artifactBuilder = require("../src/artifacts/parser_dry_run_artifact");

const parserRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(parserRoot, "..");

function makeDirs(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `bdb-refactor3a-${label}-`));
  const inputDir = path.join(root, "ENTRADA");
  const processedDir = path.join(root, "ARCHIVOS_PROCESADOS");
  const errorDir = path.join(root, "ARCHIVOS_CON_ERROR");
  fs.mkdirSync(inputDir, { recursive: true });
  fs.mkdirSync(processedDir, { recursive: true });
  fs.mkdirSync(errorDir, { recursive: true });
  return { root, inputDir, processedDir, errorDir };
}

function writeFakePdf(dir, name) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, "fake pdf bytes", "utf8");
  return filePath;
}

{
  const options = parseArgs.buildRuntimeOptions([], { parserRoot });
  assert.strictEqual(options.dryRun, true);
  assert.strictEqual(options.writeEnabled, false);
  assert.strictEqual(options.wouldWrite, false);
  assert.strictEqual(options.moveFiles, true);
  assert.strictEqual(options.inputDirExplicit, false);
  assert.strictEqual(options.outputDir, path.join(parserRoot, "SALIDA"));
}

{
  assert.throws(
    () => parseArgs.buildRuntimeOptions(["--write"], { parserRoot }),
    /WRITE_BLOCKED: --write requires --confirm-write/
  );
  assert.throws(
    () => parseArgs.buildRuntimeOptions(["--write", "--dry-run"], { parserRoot }),
    /Use either --dry-run or --write/
  );

  const options = parseArgs.buildRuntimeOptions(
    ["--write", "--confirm-write", "--no-move-files", "--only-isin", "ie0003867441"],
    { parserRoot }
  );
  assert.strictEqual(options.dryRun, false);
  assert.strictEqual(options.writeEnabled, true);
  assert.strictEqual(options.moveFiles, false);
  assert.strictEqual(options.onlyIsin, "IE0003867441");
}

{
  const parserOptions = parser.buildRuntimeOptions([]);
  const moduleOptions = parseArgs.buildRuntimeOptions([], { parserRoot });
  assert.deepStrictEqual(parserOptions, moduleOptions);
}

{
  const tmpConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), "bdb-refactor3a-config-"));
  const csvPath = path.join(tmpConfigDir, "test_mapping.csv");
  fs.writeFileSync(csvPath, "a,b\n1,2\n", "utf8");

  const searchDirs = pathResolver.getConfigSearchDirs({ configDir: tmpConfigDir }, { repoRoot, parserRoot });
  assert.strictEqual(searchDirs[0], tmpConfigDir);
  assert.ok(searchDirs.some((dir) => dir.endsWith(path.join("MORNINGSTAR_PDF_PARSER", "config"))));
  assert.ok(searchDirs.some((dir) => dir.endsWith(path.join("data", "work"))));

  const resolved = pathResolver.resolveConfigPath(
    "test_mapping.csv",
    { configDir: tmpConfigDir },
    { repoRoot, parserRoot }
  );
  assert.strictEqual(resolved, csvPath);

  const customOnly = pathResolver.getConfigSearchDirs(
    { configDir: null, searchDirs: [tmpConfigDir] },
    { repoRoot, parserRoot }
  );
  assert.deepStrictEqual(customOnly, [tmpConfigDir]);
}

{
  const dirs = makeDirs("ok");
  const source = writeFakePdf(dirs.inputDir, "random.pdf");
  const result = fileMover.moveProcessedPdfAfterRouting({
    fileName: "random.pdf",
    originalPdfPath: source,
    routingStatus: "ok",
    detectedIsin: "IE0003867441",
    reportDate: "2026-05-08",
    moveFiles: true,
    inputDir: dirs.inputDir,
    inputDirExplicit: true,
    preferredInputDir: dirs.inputDir,
    processedDir: dirs.processedDir,
    errorDir: dirs.errorDir,
  });
  assert.strictEqual(result.file_move_status, "MOVED");
  assert.strictEqual(result.renamed_to, "IE0003867441.pdf");
  assert.ok(fs.existsSync(path.join(dirs.processedDir, "IE0003867441.pdf")));
}

{
  const dirs = makeDirs("review");
  const source = writeFakePdf(dirs.inputDir, "review.pdf");
  const result = fileMover.moveProcessedPdfAfterRouting({
    fileName: "review.pdf",
    originalPdfPath: source,
    routingStatus: "review",
    detectedIsin: "ES0165142003",
    reportDate: "2026-05-08",
    moveFiles: true,
    inputDir: dirs.inputDir,
    inputDirExplicit: true,
    preferredInputDir: dirs.inputDir,
    processedDir: dirs.processedDir,
    errorDir: dirs.errorDir,
  });
  assert.strictEqual(result.file_move_status, "MOVED");
  assert.strictEqual(result.renamed_to, "ES0165142003.pdf");
  assert.ok(fs.existsSync(path.join(dirs.processedDir, "ES0165142003.pdf")));
}

{
  const dirs = makeDirs("error");
  const source = writeFakePdf(dirs.inputDir, "bad name.pdf");
  const result = fileMover.moveProcessedPdfAfterRouting({
    fileName: "bad name.pdf",
    originalPdfPath: source,
    routingStatus: "error_processing",
    detectedIsin: null,
    reportDate: null,
    moveFiles: true,
    inputDir: dirs.inputDir,
    inputDirExplicit: true,
    preferredInputDir: dirs.inputDir,
    processedDir: dirs.processedDir,
    errorDir: dirs.errorDir,
  });
  assert.strictEqual(result.file_move_status, "MOVED");
  assert.ok(result.renamed_to.startsWith("UNKNOWN_ISIN__bad_name"));
  assert.ok(result.final_pdf_path.includes("ARCHIVOS_CON_ERROR"));
}

{
  const proposals = [];
  const fileMoves = [];
  const reviewEntries = [];
  const errorEntries = [];
  const configPathsResolved = { test_mapping: "local/test_mapping.csv" };

  artifactBuilder.recordDryRunProposal(
    {
      isin: "IE0003867441",
      fileName: "random.pdf",
      doc: { isin: "IE0003867441", ms: { category_morningstar: "Test" } },
      routing: { status: "ok", reason: null },
    },
    proposals
  );
  artifactBuilder.recordFileMove(
    {
      original_pdf_path: path.join(parserRoot, "ENTRADA", "random.pdf"),
      final_pdf_path: path.join(parserRoot, "ARCHIVOS_PROCESADOS", "IE0003867441.pdf"),
      file_move_status: "MOVED",
      detected_isin: "IE0003867441",
    },
    fileMoves
  );

  const artifact = artifactBuilder.buildParserDryRunArtifact({
    files: ["random.pdf"],
    ok: 1,
    review: 0,
    fail: 0,
    parserDryRunProposals: proposals,
    fileMoveEntries: fileMoves,
    reviewEntries,
    errorEntries,
    configPathsResolved,
  });

  assert.strictEqual(artifact.dry_run, true);
  assert.strictEqual(artifact.would_write, false);
  assert.strictEqual(artifact.input_file_results.length, 1);
  assert.strictEqual(artifact.file_movements.length, 1);
  assert.strictEqual(artifact.summary.proposal_count, 1);
  assert.deepStrictEqual(artifact.isins_processed, ["IE0003867441"]);
  assert.ok(artifact.fields_to_update.includes("ms"));
  assert.deepStrictEqual(artifact.config_paths_resolved, configPathsResolved);
}

{
  assert.throws(
    () =>
      artifactBuilder.recordDryRunProposal(
        {
          isin: "IE0003867441",
          fileName: "bad.pdf",
          doc: { isin: "IE0003867441", manual: { costs: { retrocession: 1.41 } } },
          routing: { status: "ok" },
        },
        []
      ),
    /MANUAL_FIELD_GUARD/
  );
}

console.log("refactor-3A IO/CLI/artifact tests passed");
