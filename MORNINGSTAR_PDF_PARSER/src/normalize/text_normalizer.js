/**
 * Text normalization for token matching.
 * REFACTOR-1 — Phase B
 *
 * Zero side-effects, zero external deps.
 */

"use strict";

function normalizeTextForTokens(s) {
  if (!s) return "";
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

module.exports = {
  normalizeTextForTokens,
};
