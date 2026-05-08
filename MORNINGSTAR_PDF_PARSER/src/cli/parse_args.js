"use strict";

const path = require("path");

function defaultParserRoot() {
  return path.resolve(__dirname, "..", "..");
}

function getArgValueFromArgv(argv, flag) {
  const i = argv.indexOf(flag);
  if (i === -1) return null;
  return argv[i + 1] || null;
}

function getArgValue(flag, argv = process.argv.slice(2)) {
  return getArgValueFromArgv(argv, flag);
}

function hasArg(argv, flag) {
  return argv.includes(flag);
}

function printHelp() {
  console.log(`
Morningstar parser hardening CLI

Usage:
  node MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js [options]

Safety:
  --dry-run is the default. Firestore writes require BOTH --write and --confirm-write.

Options:
  --dry-run                   Run without Firestore writes (default)
  --write                     Request Firestore writes
  --confirm-write             Required together with --write
  --output-dir <dir>          Dry-run artifact directory (default MORNINGSTAR_PDF_PARSER/SALIDA)
  --limit <n>                 Limit number of PDFs
  --only-isin <ISIN>          Process only PDFs whose filename contains this ISIN
  --config-dir <dir>          Primary directory for CSV/config files
  --no-move-files             Do not move PDFs after processing
  --dir <dir>                 Input PDF directory
  --processed <dir>           Canonical output directory
  --error <dir>               Error output directory
  --processed-pdfs <dir>      OK PDF destination
  --review-pdfs <dir>         Review PDF destination
  --error-pdfs <dir>          Error PDF destination
  --backup-root <dir>         Parser backup/output root
  --write-review              In write mode, also write REVIEW payloads
  --model <name>              Gemini model (default gemini-2.5-flash)
`);
}

function buildRuntimeOptions(argv = process.argv.slice(2), defaults = {}) {
  const parserRoot = defaults.parserRoot || defaultParserRoot();
  const wantsWrite = hasArg(argv, "--write");
  const confirmWrite = hasArg(argv, "--confirm-write");
  const dryRunFlag = hasArg(argv, "--dry-run");

  if (wantsWrite && dryRunFlag) {
    throw new Error("Use either --dry-run or --write, not both.");
  }
  if (wantsWrite && !confirmWrite) {
    throw new Error("WRITE_BLOCKED: --write requires --confirm-write.");
  }

  return {
    dryRun: !wantsWrite,
    writeEnabled: wantsWrite && confirmWrite,
    wouldWrite: wantsWrite && confirmWrite,
    confirmWrite,
    writeReview: hasArg(argv, "--write-review"),
    moveFiles: !hasArg(argv, "--no-move-files"),
    inputDirExplicit: hasArg(argv, "--dir"),
    outputDir: path.resolve(
      getArgValueFromArgv(argv, "--output-dir") ||
        path.join(parserRoot, "SALIDA")
    ),
    onlyIsin: (getArgValueFromArgv(argv, "--only-isin") || "").trim().toUpperCase() || null,
    configDir: getArgValueFromArgv(argv, "--config-dir")
      ? path.resolve(getArgValueFromArgv(argv, "--config-dir"))
      : null,
  };
}

function validateWriteGates(options) {
  if (options.writeEnabled && !options.confirmWrite) {
    throw new Error("WRITE_BLOCKED: --write requires --confirm-write.");
  }
  return true;
}

module.exports = {
  getArgValueFromArgv,
  getArgValue,
  hasArg,
  printHelp,
  buildRuntimeOptions,
  validateWriteGates,
};
