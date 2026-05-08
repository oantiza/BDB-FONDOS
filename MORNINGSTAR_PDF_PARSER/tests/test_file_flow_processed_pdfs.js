"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const parser = require("../src/cargador_lotes_v_2.js");

function makeDirs(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `bdb-file-flow-${label}-`));
  const inputDir = path.join(root, "ENTRADA");
  const processedDir = path.join(root, "ARCHIVOS_PROCESADOS");
  const errorDir = path.join(root, "ARCHIVOS_CON_ERROR");
  fs.mkdirSync(inputDir, { recursive: true });
  fs.mkdirSync(processedDir, { recursive: true });
  fs.mkdirSync(errorDir, { recursive: true });
  return { root, inputDir, processedDir, errorDir };
}

function writeFakePdf(dir, name = "random.pdf") {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, "fake pdf bytes", "utf8");
  return filePath;
}

{
  const dirs = makeDirs("ok");
  const source = writeFakePdf(dirs.inputDir, "random.pdf");
  const result = parser.moveProcessedPdfAfterRouting({
    fileName: "random.pdf",
    originalPdfPath: source,
    routingStatus: "ok",
    detectedIsin: "IE0003867441",
    reportDate: "2026-05-08",
    moveFiles: true,
    inputDir: dirs.inputDir,
    inputDirExplicit: true,
    processedDir: dirs.processedDir,
    errorDir: dirs.errorDir,
  });
  assert.strictEqual(result.file_move_status, "MOVED");
  assert.strictEqual(result.renamed_to, "IE0003867441.pdf");
  assert.ok(fs.existsSync(path.join(dirs.processedDir, "IE0003867441.pdf")));
  assert.ok(!fs.existsSync(source));
}

{
  const dirs = makeDirs("review");
  const source = writeFakePdf(dirs.inputDir, "review.pdf");
  const result = parser.moveProcessedPdfAfterRouting({
    fileName: "review.pdf",
    originalPdfPath: source,
    routingStatus: "review",
    detectedIsin: "ES0165142003",
    reportDate: "2026-05-08",
    moveFiles: true,
    inputDir: dirs.inputDir,
    inputDirExplicit: true,
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
  const result = parser.moveProcessedPdfAfterRouting({
    fileName: "bad name.pdf",
    originalPdfPath: source,
    routingStatus: "error_processing",
    detectedIsin: null,
    reportDate: null,
    moveFiles: true,
    inputDir: dirs.inputDir,
    inputDirExplicit: true,
    processedDir: dirs.processedDir,
    errorDir: dirs.errorDir,
  });
  assert.strictEqual(result.file_move_status, "MOVED");
  assert.ok(result.renamed_to.startsWith("UNKNOWN_ISIN__bad_name"));
  assert.ok(fs.existsSync(result.final_pdf_path));
  assert.ok(result.final_pdf_path.includes("ARCHIVOS_CON_ERROR"));
}

{
  const dirs = makeDirs("unique");
  fs.writeFileSync(path.join(dirs.processedDir, "IE0003867441.pdf"), "existing", "utf8");
  const source = writeFakePdf(dirs.inputDir, "another.pdf");
  const result = parser.moveProcessedPdfAfterRouting({
    fileName: "another.pdf",
    originalPdfPath: source,
    routingStatus: "ok",
    detectedIsin: "IE0003867441",
    reportDate: "2026-05-08",
    moveFiles: true,
    inputDir: dirs.inputDir,
    inputDirExplicit: true,
    processedDir: dirs.processedDir,
    errorDir: dirs.errorDir,
  });
  assert.strictEqual(result.file_move_status, "MOVED");
  assert.strictEqual(result.renamed_to, "IE0003867441__2026-05-08.pdf");
  assert.ok(fs.existsSync(path.join(dirs.processedDir, "IE0003867441.pdf")));
  assert.ok(fs.existsSync(path.join(dirs.processedDir, "IE0003867441__2026-05-08.pdf")));
}

{
  const dirs = makeDirs("nomove");
  const source = writeFakePdf(dirs.inputDir, "nomove.pdf");
  const result = parser.moveProcessedPdfAfterRouting({
    fileName: "nomove.pdf",
    originalPdfPath: source,
    routingStatus: "ok",
    detectedIsin: "IE0003867441",
    reportDate: "2026-05-08",
    moveFiles: false,
    inputDir: dirs.inputDir,
    inputDirExplicit: true,
    processedDir: dirs.processedDir,
    errorDir: dirs.errorDir,
  });
  assert.strictEqual(result.file_move_status, "SKIPPED");
  assert.strictEqual(result.file_move_reason, "no_move_files_flag");
  assert.ok(fs.existsSync(source));
}

{
  const dirs = makeDirs("artifact");
  const source = writeFakePdf(dirs.inputDir, "artifact.pdf");
  const result = parser.moveProcessedPdfAfterRouting({
    fileName: "artifact.pdf",
    originalPdfPath: source,
    routingStatus: "ok",
    detectedIsin: "IE0003867441",
    reportDate: "2026-05-08",
    moveFiles: true,
    inputDir: dirs.inputDir,
    inputDirExplicit: true,
    processedDir: dirs.processedDir,
    errorDir: dirs.errorDir,
  });
  parser.recordFileMove(result);
  const artifact = parser.buildParserDryRunArtifact({
    files: ["artifact.pdf"],
    ok: 1,
    review: 0,
    fail: 0,
  });
  const entry = artifact.file_movements.find((item) =>
    String(item.original_pdf_path).endsWith("artifact.pdf")
  );
  assert.ok(entry);
  assert.ok(entry.original_pdf_path);
  assert.ok(entry.final_pdf_path);
  assert.strictEqual(entry.file_move_status, "MOVED");
  assert.strictEqual(entry.detected_isin, "IE0003867441");
}

console.log("file flow processed PDF tests passed");
