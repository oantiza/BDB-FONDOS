#!/usr/bin/env node
"use strict";

const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const cliPath = path.join(repoRoot, "MORNINGSTAR_PDF_PARSER", "bin", "prepare_write_gate_dry_run.js");

console.error("[compat] Morningstar write gate moved to MORNINGSTAR_PDF_PARSER/.");
console.error("[compat] Real CLI: MORNINGSTAR_PDF_PARSER/bin/prepare_write_gate_dry_run.js");
console.error("[compat] Delegating with original CLI arguments.");

const result = spawnSync(process.execPath, [cliPath, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error(`[compat] Failed to launch root write gate: ${result.error.message}`);
  process.exit(1);
}

if (result.signal) {
  console.error(`[compat] Root write gate exited via signal ${result.signal}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
