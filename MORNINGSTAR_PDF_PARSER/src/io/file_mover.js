"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_PIPELINE_STATUS = Object.freeze({
  OK: "ok",
  REVIEW: "review",
});

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function uniqueDestPath(destDir, filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let candidate = path.join(destDir, filename);

  if (!fs.existsSync(candidate)) return candidate;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  let i = 1;
  while (true) {
    const alt = path.join(destDir, `${base}__${stamp}__${i}${ext}`);
    if (!fs.existsSync(alt)) return alt;
    i++;
  }
}

function moveFileSafe(srcPath, destDir, filename) {
  ensureDir(destDir);
  const destPath = uniqueDestPath(destDir, filename);
  try {
    fs.renameSync(srcPath, destPath);
    return destPath;
  } catch (e) {
    try {
      fs.copyFileSync(srcPath, destPath);
      fs.unlinkSync(srcPath);
      return destPath;
    } catch (e2) {
      console.error(`Error moviendo fichero: ${e2.message}`);
      return null;
    }
  }
}

function moveFileSafeIfNeeded(srcPath, destDir, filename) {
  if (!fs.existsSync(srcPath)) return null;
  if (path.resolve(path.dirname(srcPath)) === path.resolve(destDir)) {
    return srcPath;
  }
  return moveFileSafe(srcPath, destDir, filename);
}

function timestampForFileName(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "_",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function sanitizePdfFileNamePart(value) {
  return String(value || "")
    .trim()
    .replace(/\.pdf$/i, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function isPathInside(childPath, parentPath) {
  const child = path.resolve(childPath);
  const parent = path.resolve(parentPath);
  const relative = path.relative(parent, child);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function uniquePdfPathForIsin(destDir, isin, reportDate = null, now = new Date()) {
  const cleanIsin = sanitizePdfFileNamePart(isin || "UNKNOWN_ISIN") || "UNKNOWN_ISIN";
  const primary = path.join(destDir, `${cleanIsin}.pdf`);
  if (!fs.existsSync(primary)) return primary;

  const suffix = reportDate
    ? sanitizePdfFileNamePart(reportDate)
    : `processed_${timestampForFileName(now)}`;
  let candidate = path.join(destDir, `${cleanIsin}__${suffix}.pdf`);
  if (!fs.existsSync(candidate)) return candidate;

  let index = 1;
  while (true) {
    const alt = path.join(destDir, `${cleanIsin}__${suffix}__${index}.pdf`);
    if (!fs.existsSync(alt)) return alt;
    index += 1;
  }
}

function uniqueErrorPdfPath(destDir, originalFileName) {
  const baseName = sanitizePdfFileNamePart(originalFileName) || "archivo";
  let candidate = path.join(destDir, `UNKNOWN_ISIN__${baseName}.pdf`);
  if (!fs.existsSync(candidate)) return candidate;

  const stamp = timestampForFileName();
  let index = 1;
  while (true) {
    const alt = path.join(destDir, `UNKNOWN_ISIN__${baseName}__${stamp}__${index}.pdf`);
    if (!fs.existsSync(alt)) return alt;
    index += 1;
  }
}

function safeMoveToExactPath(srcPath, destPath) {
  ensureDir(path.dirname(destPath));
  if (!fs.existsSync(srcPath)) return null;
  if (fs.existsSync(destPath)) return null;
  try {
    fs.renameSync(srcPath, destPath);
    return destPath;
  } catch (e) {
    try {
      fs.copyFileSync(srcPath, destPath);
      fs.unlinkSync(srcPath);
      return destPath;
    } catch (e2) {
      console.error(`Error moviendo PDF procesado: ${e2.message}`);
      return null;
    }
  }
}

function buildFileMovePlan({
  fileName,
  sourcePath,
  routingStatus,
  detectedIsin,
  reportDate,
  processedDir,
  errorDir,
  pipelineStatus = DEFAULT_PIPELINE_STATUS,
}) {
  const okOrReview =
    routingStatus === pipelineStatus.OK || routingStatus === pipelineStatus.REVIEW;
  if (okOrReview && detectedIsin) {
    const destinationPath = uniquePdfPathForIsin(processedDir, detectedIsin, reportDate);
    return {
      destination_dir: processedDir,
      destination_path: destinationPath,
      renamed_to: path.basename(destinationPath),
      file_move_reason: `${routingStatus}_with_isin`,
    };
  }

  const destinationPath = uniqueErrorPdfPath(errorDir, fileName || path.basename(sourcePath));
  return {
    destination_dir: errorDir,
    destination_path: destinationPath,
    renamed_to: path.basename(destinationPath),
    file_move_reason: detectedIsin ? `${routingStatus || "error"}_blocked` : "missing_isin_or_error",
  };
}

function moveProcessedPdfAfterRouting({
  fileName,
  originalPdfPath,
  routingStatus,
  detectedIsin,
  reportDate,
  moveFiles = true,
  inputDir,
  inputDirExplicit = false,
  processedDir,
  errorDir,
  preferredInputDir = inputDir,
  pipelineStatus = DEFAULT_PIPELINE_STATUS,
}) {
  const originalPath = path.resolve(originalPdfPath || path.join(inputDir, fileName));
  const safeInputDir = path.resolve(inputDir);
  const defaultInputDir = path.resolve(preferredInputDir);
  const base = {
    original_pdf_path: originalPath,
    final_pdf_path: originalPath,
    file_move_status: "NOT_MOVED",
    file_move_reason: "not_attempted",
    renamed_to: path.basename(originalPath),
    detected_isin: detectedIsin || null,
  };

  if (!moveFiles) {
    return { ...base, file_move_status: "SKIPPED", file_move_reason: "no_move_files_flag" };
  }
  if (!fs.existsSync(originalPath)) {
    return { ...base, file_move_status: "SKIPPED", file_move_reason: "source_pdf_missing" };
  }
  if (!isPathInside(originalPath, safeInputDir) && path.dirname(originalPath) !== safeInputDir) {
    return { ...base, file_move_status: "SKIPPED", file_move_reason: "source_outside_input_dir" };
  }
  if (!inputDirExplicit && path.resolve(safeInputDir) !== defaultInputDir) {
    return {
      ...base,
      file_move_status: "SKIPPED",
      file_move_reason: "implicit_input_not_parser_entrada",
    };
  }

  const plan = buildFileMovePlan({
    fileName,
    sourcePath: originalPath,
    routingStatus,
    detectedIsin,
    reportDate,
    processedDir,
    errorDir,
    pipelineStatus,
  });
  const movedPath = safeMoveToExactPath(originalPath, plan.destination_path);
  if (!movedPath) {
    return {
      ...base,
      file_move_status: "FAILED",
      file_move_reason: "move_failed",
      final_pdf_path: plan.destination_path,
      renamed_to: plan.renamed_to,
    };
  }

  return {
    ...base,
    final_pdf_path: movedPath,
    file_move_status: "MOVED",
    file_move_reason: plan.file_move_reason,
    renamed_to: plan.renamed_to,
  };
}

module.exports = {
  ensureDir,
  uniqueDestPath,
  moveFileSafe,
  moveFileSafeIfNeeded,
  timestampForFileName,
  sanitizePdfFileNamePart,
  isPathInside,
  uniquePdfPathForIsin,
  uniqueErrorPdfPath,
  safeMoveToExactPath,
  buildFileMovePlan,
  moveProcessedPdfAfterRouting,
};
