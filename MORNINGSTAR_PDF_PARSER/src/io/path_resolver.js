"use strict";

const fs = require("fs");
const path = require("path");

function defaultParserRoot() {
  return path.resolve(__dirname, "..", "..");
}

function defaultRepoRoot() {
  return path.resolve(defaultParserRoot(), "..");
}

function resolvePreferredOrLegacy(preferredPath, legacyPath) {
  if (fs.existsSync(preferredPath)) return preferredPath;
  if (legacyPath && fs.existsSync(legacyPath)) return legacyPath;
  return preferredPath;
}

function resolveBackupDir(newRelativePath, legacyRelativePath, options = {}) {
  const backupRootArg = options.backupRootArg || null;
  const parserArtifactRoot =
    options.parserArtifactRoot || path.join(defaultParserRoot(), "artifacts");
  const legacyBackupRoot =
    options.legacyBackupRoot || path.join(defaultParserRoot(), "src", "BDB_PARSE_BACKUP");

  if (backupRootArg) {
    const base = path.resolve(backupRootArg);
    return path.resolve(
      resolvePreferredOrLegacy(
        path.join(base, newRelativePath),
        legacyRelativePath ? path.join(base, legacyRelativePath) : null
      )
    );
  }

  return path.resolve(
    resolvePreferredOrLegacy(
      path.join(parserArtifactRoot, newRelativePath),
      legacyRelativePath ? path.join(legacyBackupRoot, legacyRelativePath) : null
    )
  );
}

function getConfigSearchDirs(options = {}, roots = {}) {
  const repoRoot = roots.repoRoot || defaultRepoRoot();
  const parserRoot = roots.parserRoot || defaultParserRoot();

  if (Array.isArray(options.searchDirs) && options.searchDirs.length) {
    return [options.configDir, ...options.searchDirs].filter(Boolean);
  }
  return [
    options.configDir,
    path.join(parserRoot, "config"),
    path.join(repoRoot, "data", "work"),
    path.join(repoRoot, "functions_python", "scripts"),
    path.join(repoRoot, "scripts", "maintenance"),
    path.join(repoRoot, "scripts", "MORNINGSTAR_PDF_PARSER", "config"),
  ].filter(Boolean);
}

function resolveConfigPath(fileName, options = {}, roots = {}) {
  const candidates = getConfigSearchDirs(options, roots).map((dir) => path.resolve(dir, fileName));
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (found) return found;

  throw new Error(
    `Missing required config CSV ${fileName}. Searched: ${candidates.join("; ")}`
  );
}

module.exports = {
  resolvePreferredOrLegacy,
  resolveBackupDir,
  getConfigSearchDirs,
  resolveConfigPath,
};
