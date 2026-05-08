#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const parserRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(parserRoot, "..");
const parserPath = path.join(parserRoot, "src", "cargador_lotes_v_2.js");
const defaultInputDir = path.join(parserRoot, "ENTRADA");
const defaultOutputDir = path.join(parserRoot, "SALIDA");
const defaultArtifactsDir = path.join(parserRoot, "artifacts");

function hasFlag(argv, flag) {
  return argv.includes(flag);
}

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  return index === -1 ? null : argv[index + 1] || null;
}

function normalizeArgs(argv) {
  if (hasFlag(argv, "--write") || hasFlag(argv, "--confirm-write")) {
    throw new Error("WRITE_BLOCKED: parse_dry_run.js never enables Firestore writes.");
  }

  const args = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--input") {
      args.push("--dir", argv[++index] || defaultInputDir);
      continue;
    }
    args.push(token);
  }

  if (!hasFlag(args, "--dry-run")) {
    args.push("--dry-run");
  }
  if (!hasFlag(args, "--dir")) {
    args.push("--dir", defaultInputDir);
  }
  if (!hasFlag(args, "--output-dir")) {
    args.push("--output-dir", defaultOutputDir);
  }
  if (!hasFlag(args, "--backup-root")) {
    args.push("--backup-root", defaultArtifactsDir);
  }
  if (!hasFlag(args, "--processed")) {
    args.push("--processed", path.join(defaultArtifactsDir, "canonical"));
  }
  if (!hasFlag(args, "--error")) {
    args.push("--error", path.join(defaultArtifactsDir, "error"));
  }
  if (!hasFlag(args, "--processed-pdfs")) {
    args.push("--processed-pdfs", path.join(defaultArtifactsDir, "processed_pdfs", "ok"));
  }
  if (!hasFlag(args, "--review-pdfs")) {
    args.push("--review-pdfs", path.join(defaultArtifactsDir, "processed_pdfs", "review"));
  }
  if (!hasFlag(args, "--error-pdfs")) {
    args.push("--error-pdfs", path.join(defaultArtifactsDir, "processed_pdfs", "error"));
  }

  return args;
}

function main() {
  const args = normalizeArgs(process.argv.slice(2));
  const inputDir = path.resolve(valueAfter(args, "--dir") || defaultInputDir);
  const outputDir = path.resolve(valueAfter(args, "--output-dir") || defaultOutputDir);

  console.error("[MORNINGSTAR_PDF_PARSER] Dry-run root CLI");
  console.error(`[MORNINGSTAR_PDF_PARSER] ENTRADA=${inputDir}`);
  console.error(`[MORNINGSTAR_PDF_PARSER] SALIDA=${outputDir}`);

  if (!fs.existsSync(inputDir)) {
    fs.mkdirSync(inputDir, { recursive: true });
  }

  const pdfCount = fs.readdirSync(inputDir).filter((file) => file.toLowerCase().endsWith(".pdf")).length;
  if (pdfCount === 0) {
    console.error("[MORNINGSTAR_PDF_PARSER] ENTRADA vacia: no se llamara Gemini.");
  }

  const result = spawnSync(process.execPath, [parserPath, ...args], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`[MORNINGSTAR_PDF_PARSER] Failed to launch parser: ${result.error.message}`);
    process.exit(1);
  }

  if (result.signal) {
    console.error(`[MORNINGSTAR_PDF_PARSER] Parser exited via signal ${result.signal}`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  normalizeArgs,
};
