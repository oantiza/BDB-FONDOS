const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..");
const sourceJsonPath = path.join(
  repoRoot,
  "MORNINGSTAR_PDF_PARSER",
  "SALIDA",
  "parser_dry_run_latest.json"
);
const sourcePdfDir = path.join(repoRoot, "MORNINGSTAR_PDF_PARSER", "ENTRADA");
const rescuePdfDir = path.join(
  repoRoot,
  "MORNINGSTAR_PDF_PARSER",
  "ENTRADA_PRO_RESCUE_ERRORS"
);
const manifestDir = path.join(repoRoot, "artifacts", "bdb_parser_audit");
const manifestPath = path.join(
  manifestDir,
  "morningstar_flash_errors_for_pro_rescue_0.json"
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function deriveIsin(fileName) {
  const match = String(fileName).match(/^[A-Z]{2}[A-Z0-9]{10}/);
  return match ? match[0] : null;
}

function assertUnder(parent, child) {
  const relative = path.relative(parent, child);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing path outside expected directory: ${child}`);
  }
}

function main() {
  const dryRun = readJson(sourceJsonPath);
  if (dryRun.dry_run !== true || dryRun.would_write !== false) {
    throw new Error("Source JSON is not a safe dry-run artifact.");
  }

  const proposedIsins = new Set(Object.keys(dryRun.proposed_payload_by_isin || {}));
  const warnings = Array.isArray(dryRun.warnings) ? dryRun.warnings : [];
  const errors = [];

  for (const fileName of dryRun.input_files || []) {
    const isin = deriveIsin(fileName);
    if (!isin || proposedIsins.has(isin)) continue;

    const fileWarnings = warnings.filter(
      (warning) => warning.isin === isin || warning.fileName === fileName
    );
    const sourcePdfPath = path.join(sourcePdfDir, fileName);
    const copiedPdfPath = path.join(rescuePdfDir, fileName);

    errors.push({
      isin,
      fileName,
      error_type: fileWarnings.map((warning) => warning.reason).filter(Boolean),
      source_pdf_path: sourcePdfPath,
      copied_pdf_path: copiedPdfPath,
    });
  }

  const expectedErrors = dryRun.summary && Number(dryRun.summary.error_count);
  if (expectedErrors !== errors.length) {
    throw new Error(
      `Expected ${expectedErrors} errors from summary, extracted ${errors.length}.`
    );
  }

  fs.mkdirSync(rescuePdfDir, { recursive: true });
  fs.mkdirSync(manifestDir, { recursive: true });

  assertUnder(path.join(repoRoot, "MORNINGSTAR_PDF_PARSER"), rescuePdfDir);
  for (const entry of fs.readdirSync(rescuePdfDir)) {
    if (entry.toLowerCase().endsWith(".pdf")) {
      fs.unlinkSync(path.join(rescuePdfDir, entry));
    }
  }

  for (const error of errors) {
    if (!fs.existsSync(error.source_pdf_path)) {
      throw new Error(`Missing source PDF: ${error.source_pdf_path}`);
    }
    fs.copyFileSync(error.source_pdf_path, error.copied_pdf_path);
  }

  const manifest = {
    task: "BDB-MORNINGSTAR-PDFS-REFRESH-PRO-RESCUE-ERRORS-0",
    created_at: new Date().toISOString(),
    source_json_path: sourceJsonPath,
    rescue_pdf_dir: rescuePdfDir,
    total_errors: errors.length,
    errors,
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  console.log(
    JSON.stringify(
      {
        total_errors: errors.length,
        rescue_pdf_dir: rescuePdfDir,
        manifest_path: manifestPath,
      },
      null,
      2
    )
  );
}

main();
