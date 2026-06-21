# BDB-PARSER-REFACTOR-0: Modularization Plan & Golden Tests

- **Date**: 2026-05-08
- **HEAD**: `5dcd4d6 CSV_RECENTER_AUDIT: add funds_v3 CSV recentering reports`
- **Project**: `C:\Users\oanti\Documents\BDB-FONDOS`
- **Target**: `MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js`
- **BDB-FONDOS-CORE**: NOT touched
- **Firestore writes**: NONE
- **Gemini calls**: NONE

---

## 1. Monolith Diagnostic

| Metric | Value |
|--------|-------|
| **Total lines** | 3,744 |
| **Total bytes** | ~126 KB |
| **Functions (internal)** | ~85 |
| **Functions (exported)** | 43 (21 original + 22 temporary for golden tests) |
| **External deps** | 7 (dotenv, fs, path, crypto, pdf-parse, firebase-admin, @google/generative-ai, p-limit, csv-parse) |
| **Responsibility areas** | 20 distinct blocks |

---

## 2. Function Responsibility Map

### CLI / Args (lines 51–156)
| Function | Lines | Target Module |
|----------|-------|---------------|
| `getArgValueFromArgv` | 51–55 | `cli/args.js` |
| `getArgValue` | 57–59 | `cli/args.js` |
| `hasArg` | 61–63 | `cli/args.js` |
| `printHelp` | 65–94 | `cli/parse_cli.js` |
| `buildRuntimeOptions` | 96–125 | `cli/args.js` |
| `validateWriteGates` | 127–132 | `cli/args.js` |

### Config & Path Resolution (lines 134–367)
| Function | Lines | Target Module |
|----------|-------|---------------|
| `resolvePreferredOrLegacy` | 134–138 | `config/config_paths.js` |
| `resolveBackupDir` | 212–229 | `config/config_paths.js` |
| `getConfigSearchDirs` | 313–325 | `config/mapping_loader.js` |
| `resolveConfigPath` | 327–335 | `config/mapping_loader.js` |
| `loadCsv` | 308–311 | `config/mapping_loader.js` |
| `escapeRegex`, `buildTokenRegex` | 355–367 | `config/mapping_loader.js` |

### Firebase Admin Init (lines 277–303)
| Function | Lines | Target Module |
|----------|-------|---------------|
| `getFirebaseInitOptions` | 277–285 | `payload/firestore_client.js` |
| `initializeFirebaseAdmin` | 287–293 | `payload/firestore_client.js` |
| `getFirestoreDb` | 297–303 | `payload/firestore_client.js` |

### Gemini Client (lines 253–265, 2334–2418)
| Function | Lines | Target Module |
|----------|-------|---------------|
| `getGeminiModel` | 256–265 | `gemini/gemini_client.js` |
| `extraerMSConGemini` | 2334–2418 | `gemini/prompt_builder.js` + `gemini/gemini_client.js` |

### JSON/LLM Response Parsing (lines 2212–2301)
| Function | Lines | Target Module |
|----------|-------|---------------|
| `stripCodeFences` | 2212–2217 | `gemini/response_parser.js` |
| `extractFirstBalancedJsonObject` | 2219–2253 | `gemini/response_parser.js` |
| `repairJsonCandidate` | 2255–2267 | `gemini/response_parser.js` |
| `hasAnyCriticalGeminiKey` | 2278–2281 | `gemini/response_parser.js` |
| `unwrapGeminiRootObject` | 2283–2301 | `gemini/response_parser.js` |
| `parseGeminiJsonResponse` | 2303–2329 | `gemini/response_parser.js` |

### Number/String Normalization (lines 372–660)
| Function | Lines | Target Module |
|----------|-------|---------------|
| `cleanString` | 617–621 | `normalize/number_normalizer.js` |
| `parseNum` | 634–640 | `normalize/number_normalizer.js` |
| `clampPct` | 642–648 | `normalize/number_normalizer.js` |
| `clamp01` | 650–656 | `normalize/number_normalizer.js` |
| `approxEqual` | 658–660 | `normalize/number_normalizer.js` |
| `isPlainObject` | 630–632 | `normalize/number_normalizer.js` |
| `deleteUndefinedDeep` | 1473–1489 | `normalize/number_normalizer.js` |

### Asset Mix Normalization (lines 751–1281)
| Function | Lines | Target Module |
|----------|-------|---------------|
| `validateAssetMix` | 751–789 | `normalize/asset_mix_normalizer.js` |
| `sanitizeAssetMixForExposureBuilder` | 1199–1281 | `normalize/asset_mix_normalizer.js` |
| `scalePctMap` | 1002–1015 | `normalize/asset_mix_normalizer.js` |
| `normalizeExposureMapToParent01` | 1283–1309 | `normalize/asset_mix_normalizer.js` |
| `validateChildMapAgainstParent` | 791–825 | `normalize/asset_mix_normalizer.js` |
| `validateCanonicalMath` | 827–886 | `normalize/asset_mix_normalizer.js` |

### Region Normalization (lines 1491–1640)
| Function | Lines | Target Module |
|----------|-------|---------------|
| `REGION_MAPPINGS` + lookup | 1494–1558 | `normalize/region_normalizer.js` |
| `cleanRegionKey` | 1560–1570 | `normalize/region_normalizer.js` |
| `normalizeRegions` | 1572–1640 | `normalize/region_normalizer.js` |
| `hasExcludedJapanRegionText` | 1766–1773 | `normalize/region_normalizer.js` |
| `hasJapanRegionText` | 1775–1778 | `normalize/region_normalizer.js` |
| `derivePrimaryRegion` | 1780–1864 | `classify/region_classifier.js` |

### Sector Normalization (lines 1642–1659)
| Function | Lines | Target Module |
|----------|-------|---------------|
| `normalizeSectors` | 1642–1659 | `normalize/sector_normalizer.js` |

### Fixed Income Normalization (lines 1089–1166)
| Function | Lines | Target Module |
|----------|-------|---------------|
| `normalizeFixedIncome` | 1089–1166 | `normalize/fixed_income_normalizer.js` |
| `pctFromAliases` | 1022–1039 | `normalize/number_normalizer.js` |
| `numFromAliases` | 1041–1058 | `normalize/number_normalizer.js` |
| `strFromAliases` | 1060–1077 | `normalize/number_normalizer.js` |
| `normalizePctBucketObject` | 1079–1087 | `normalize/fixed_income_normalizer.js` |

### Equity Style / Market Cap (lines 1168–1403)
| Function | Lines | Target Module |
|----------|-------|---------------|
| `sizeWeightsTotalFromMarketCap` | 1168–1197 | `exposure/portfolio_exposure_builder.js` |
| `parseStyleBoxCell` | 1311–1358 | `classify/asset_type_classifier.js` |
| `deriveMarketCapBiasFromText` | 1360–1388 | `classify/asset_type_classifier.js` |
| `argmaxKey` | 1390–1403 | `normalize/number_normalizer.js` |

### Classification Builder (lines 1664–2210)
| Function | Lines | Target Module |
|----------|-------|---------------|
| `deriveAssetClassFromCategory` | 1664–1764 | `classify/asset_type_classifier.js` |
| `deriveSubcategories` | 1866–1906 | `classify/classification_builder.js` |
| `deriveSectorEquitySubtypeFromTags` | 1937–1947 | `classify/subtype_classifier.js` |
| `topSector` | 1949–1964 | `classify/classification_builder.js` |
| `deriveAssetSubtype` | 1966–2066 | `classify/subtype_classifier.js` |
| `deriveFlags` | 2068–2155 | `classify/classification_builder.js` |
| `normalizeSubtypeByAssetType` | 2157–2210 | `classify/subtype_classifier.js` |
| `hasLatinAmericaIdentity` | 1925–1935 | `classify/region_classifier.js` |

### Pipeline Status / Routing (lines 888–1000)
| Function | Lines | Target Module |
|----------|-------|---------------|
| `decidePipelineStatus` | 924–1000 | `classify/classification_builder.js` |
| `hasCoherentFixedIncomeClassification` | 895–908 | `classify/classification_builder.js` |
| `isSoftFixedIncomeRoutingWarning` | 910–922 | `classify/classification_builder.js` |

### Schema Validation (lines 662–749)
| Function | Lines | Target Module |
|----------|-------|---------------|
| `validateRawLlMSchema` | 662–749 | `gemini/response_parser.js` |

### Firestore Payload Builder (lines 3476–3523)
| Function | Lines | Target Module |
|----------|-------|---------------|
| Payload construction in `processPdfFile` | 3476–3498 | `payload/firestore_payload_builder.js` |
| `assertNoManualFields` | 2458–2463 | `payload/forbidden_fields_guard.js` |
| `hasManualField` | 2446–2456 | `payload/forbidden_fields_guard.js` |
| `serializeForArtifact` | 2429–2444 | `artifacts/dry_run_artifact_writer.js` |

### Artifacts / Dry-Run Writer (lines 2465–2551)
| Function | Lines | Target Module |
|----------|-------|---------------|
| `recordDryRunProposal` | 2465–2476 | `artifacts/dry_run_artifact_writer.js` |
| `buildParserDryRunArtifact` | 2490–2543 | `artifacts/dry_run_artifact_writer.js` |
| `writeParserDryRunArtifact` | 2545–2551 | `artifacts/dry_run_artifact_writer.js` |

### File Flow / PDF Mover (lines 374–599)
| Function | Lines | Target Module |
|----------|-------|---------------|
| `ensureDir` | 374–376 | `files/safe_filename.js` |
| `uniqueDestPath` | 378–392 | `files/safe_filename.js` |
| `moveFileSafe` | 394–410 | `files/processed_file_mover.js` |
| `moveFileSafeIfNeeded` | 412–418 | `files/processed_file_mover.js` |
| `uniquePdfPathForIsin` | 449–466 | `files/processed_file_mover.js` |
| `uniqueErrorPdfPath` | 468–480 | `files/processed_file_mover.js` |
| `buildFileMovePlan` | 501–529 | `files/processed_file_mover.js` |
| `moveProcessedPdfAfterRouting` | 531–599 | `files/processed_file_mover.js` |
| `safeMoveToExactPath` | 482–499 | `files/processed_file_mover.js` |

### PDF Reader / Hash (lines 2553–2579, 609–628)
| Function | Lines | Target Module |
|----------|-------|---------------|
| `isValidPdfText` | 2553–2579 | `pdf/pdf_reader.js` |
| `sha1Hex` | 609–611 | `pdf/pdf_hash.js` |
| `shortHash` | 613–615 | `pdf/pdf_hash.js` |
| `buildStableBaseName` | 623–628 | `pdf/pdf_hash.js` |

### ISIN / Date Extraction (lines 1410–1471)
| Function | Lines | Target Module |
|----------|-------|---------------|
| `buscarISINRegex` | 1410–1418 | `pdf/pdf_reader.js` |
| `reportDateFromFilename` | 1420–1427 | `pdf/pdf_reader.js` |
| `parseSpanishDateToISO` | 1429–1471 | `normalize/number_normalizer.js` |

### Main / Orchestrator (lines 2585–3688, 3738–3744)
| Function | Lines | Target Module |
|----------|-------|---------------|
| `processPdfFile` | 2585–3523 | Stays in main (calls all modules) |
| `main` | 3528–3688 | `cli/parse_cli.js` |

---

## 3. Recommended Extraction Phases

### Phase 1 — Pure utilities (zero risk)
- `normalize/number_normalizer.js` (parseNum, clampPct, clamp01, approxEqual, cleanString, etc.)
- `pdf/pdf_hash.js` (sha1Hex, shortHash, buildStableBaseName)
- `files/safe_filename.js` (ensureDir, uniqueDestPath, timestampForFileName, sanitizePdfFileNamePart)
- `payload/forbidden_fields_guard.js` (hasManualField, assertNoManualFields)

### Phase 2 — Normalizers (low risk, well-isolated)
- `normalize/region_normalizer.js` (REGION_MAPPINGS, cleanRegionKey, normalizeRegions)
- `normalize/sector_normalizer.js` (normalizeSectors)
- `normalize/fixed_income_normalizer.js` (normalizeFixedIncome)
- `normalize/asset_mix_normalizer.js` (validateAssetMix, sanitizeAssetMixForExposureBuilder, etc.)

### Phase 3 — Classifiers (medium risk, interdependent)
- `classify/asset_type_classifier.js` (deriveAssetClassFromCategory, parseStyleBoxCell, etc.)
- `classify/subtype_classifier.js` (deriveAssetSubtype, normalizeSubtypeByAssetType, etc.)
- `classify/region_classifier.js` (derivePrimaryRegion, hasLatinAmericaIdentity)
- `classify/classification_builder.js` (deriveSubcategories, deriveFlags, decidePipelineStatus)

### Phase 4 — External-facing (higher risk)
- `gemini/response_parser.js` (parseGeminiJsonResponse, validateRawLlMSchema)
- `gemini/gemini_client.js` (getGeminiModel, extraerMSConGemini)
- `gemini/prompt_builder.js` (prompt template)
- `config/mapping_loader.js` + `config/config_paths.js`
- `cli/args.js` + `cli/parse_cli.js`

### Phase 5 — I/O modules (file system, Firestore)
- `files/processed_file_mover.js`
- `pdf/pdf_reader.js`
- `artifacts/dry_run_artifact_writer.js`
- `payload/firestore_payload_builder.js`
- `payload/firestore_client.js` (Firebase Admin init)

---

## 4. Golden Tests Created

| Fixture | Type | ISIN | Tests |
|---------|------|------|-------|
| `equity_global_normal.json` | Allocation (Mixto keyword) | IE0003867441 | class=Mixto, subtype→FLEXIBLE_ALLOCATION, region=Global |
| `fixed_income_corporate.json` | Fixed Income | ES0165142003 | class=RF, subtype=CORPORATE_BOND, credit=IG, duration=intermediate |
| `money_market_short.json` | Money Market | LU0208853944 | class=Monetario, subtype→MONEY_MARKET, duration=ultrashort |

**Test file**: `MORNINGSTAR_PDF_PARSER/tests/test_parser_golden_outputs.js`
**Result**: **62 assertions passed, 0 failed**

Assertions cover:
- `deriveAssetClassFromCategory` output
- `deriveAssetSubtype` raw output
- `normalizeSubtypeByAssetType` (incompatible flag + final subtype)
- `derivePrimaryRegion`
- `sanitizeAssetMixForExposureBuilder` (sum, individual components)
- `validateAssetMix`
- `hasManualField` (positive + negative)
- `economic_exposure` absence
- `normalizeFixedIncome`
- `validateRawLlMSchema`
- `deriveFlags` (type checks)
- `parseGeminiJsonResponse`
- `parseStyleBoxCell`

---

## 5. Temporary Exports Added

22 pure functions added to `module.exports` in `cargador_lotes_v_2.js` for golden test access:

```
deriveAssetClassFromCategory, deriveAssetSubtype, deriveSubcategories,
deriveFlags, normalizeSubtypeByAssetType, normalizeRegions,
normalizeSectors, normalizeFixedIncome, sanitizeAssetMixForExposureBuilder,
validateAssetMix, validateCanonicalMath, decidePipelineStatus,
validateRawLlMSchema, parseGeminiJsonResponse, parseStyleBoxCell,
cleanString, parseNum, clampPct, clamp01, approxEqual
```

These will be **removed** once the corresponding modules are extracted in REFACTOR-1.

---

## 6. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Module boundary breaks CSV config loading | Medium | Test `resolveConfigPath` integration after Phase 2 |
| Circular deps between classifiers | Low | Extract in dependency order (Phase 3 last) |
| Global state (`manifestEntries`, `parserDryRunProposals`) | Medium | Keep in orchestrator, pass via injection |
| `RUNTIME_OPTIONS` global evaluated at import | High | Move to lazy init or factory pattern in Phase 4 |
| `admin.firestore.FieldValue.serverTimestamp()` in payload | Low | Import firebase-admin only in payload module |

---

## 7. What NOT to Touch in REFACTOR-1

- `manual.*` protection logic — only move, never modify
- `retrocession` preservation — keep test coverage
- `asset_mix` normalization math — changes require new golden fixtures
- `REGION_MAPPINGS` values — changes require data audit
- `subcategory_sectors_mapping.csv` / `subcategory_tokens_mapping.csv` — data files
- Write gate logic (`write_gate.js`) — separate module already

---

## 8. Success Criteria for REFACTOR-1

1. All 6 existing tests pass (5 original + 1 golden)
2. `node --check` passes on all new modules
3. `module.exports` in main file shrinks to orchestrator + re-exports
4. Each extracted module has its own test or is covered by golden tests
5. No functional behavior change (golden tests are the regression gate)

---

## 9. Decision

**`PARSER_REFACTOR_PLAN_READY`**

- ✅ Monolith diagnosed (3,744 lines, ~85 functions, 20 responsibility areas)
- ✅ Function map created (all functions classified by target module)
- ✅ Golden fixtures created (3 fixtures covering equity/FI/money_market)
- ✅ Golden tests passing (62/62)
- ✅ Existing tests passing (5/5)
- ✅ Temporary exports documented
- ✅ 5-phase extraction plan defined
- ✅ No writes, no Gemini, no deploy
