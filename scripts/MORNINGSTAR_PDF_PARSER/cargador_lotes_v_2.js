#!/usr/bin/env node
"use strict";

const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const parserPath = path.join(repoRoot, "MORNINGSTAR_PDF_PARSER", "src", "cargador_lotes_v_2.js");

console.error("[compat] Morningstar PDF parser moved to MORNINGSTAR_PDF_PARSER/.");
console.error("[compat] Real parser: MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js");
console.error("[compat] Manual dry-run CLI: MORNINGSTAR_PDF_PARSER/bin/parse_dry_run.js");
console.error("[compat] Delegating with original CLI arguments.");

const result = spawnSync(process.execPath, [parserPath, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error(`[compat] Failed to launch root Morningstar parser: ${result.error.message}`);
  process.exit(1);
}

if (result.signal) {
  console.error(`[compat] Root Morningstar parser exited via signal ${result.signal}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
