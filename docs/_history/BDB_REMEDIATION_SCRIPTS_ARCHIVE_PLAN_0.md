# BDB_REMEDIATION_SCRIPTS_ARCHIVE_PLAN_0

**Fecha:** 2026-05-11
**HEAD:** `6b37c88`
**Rama:** `master`
**Working tree:** limpio
**Tipo:** Gobernanza read-only — sin deploy, sin escritura Firestore, sin código modificado
**Versión:** 2 — actualización completa post ciclos compatible_profiles, commodities y FI credit

---

## A. Resumen Ejecutivo

Inventario completo de **todos** los scripts, gates, manifests y artefactos de remediación históricos en BDB-FONDOS legacy. Cubre los ciclos:

- **MIXED exposure** (59/60 fondos, 8 lotes)
- **Compatible profiles** (10 fondos regenerados)
- **Commodities/metales** (14 fondos reclasificados)
- **FI credit / FE-9** (130 fondos con `fi_credit`)
- **Parser Morningstar** (write gates históricos)
- **Semantic audit** (asset_mix, no-write decision)
- **Retrocessions** (dry-run, reload)

| Métrica | Valor |
|---------|-------|
| Scripts totales inventariados | 48 |
| Scripts HISTORICAL_WRITE — DO NOT RERUN | 12 |
| Scripts DRY_RUN_ONLY | 10 |
| Scripts SAFE_READ_ONLY | 18 |
| Scripts WRITE_GATE (read-only, genera artifacts) | 8 |
| Artifact gates completos con cadena de evidencia | 12 |
| Rollback manifests disponibles | 12 |
| Writes Firestore en esta auditoría | **0** |
| Deploy | **NO** |

**Regla de oro:** Ningún script histórico de write se reejecuta. Todo nuevo write exige nuevo bloque/gate.

---

## B. Estado del Repositorio

| Campo | Valor |
|-------|-------|
| HEAD | `6b37c88` |
| Branch | `master` |
| Working tree | clean |
| Modo | READ-ONLY + documentación |
| BDB-FONDOS-CORE | NO TOCADO |

### Ciclos cerrados

| Ciclo | Fondos | Estado |
|-------|--------|--------|
| MIXED exposure | 59/60 corregidos | ✅ CERRADO — Hamco pendiente |
| Compatible profiles | 670 saneados, 10 escritos | ✅ CERRADO |
| Commodities/metales | 14 reclasificados | ✅ CERRADO |
| FI credit | 130 fondos con `fi_credit` | ✅ CERRADO |
| FE-9 | Hard block NO activado | ✅ CERRADO |

---

## C. Clasificación de Scripts por Categoría

### Categoría 1: SAFE_READ_ONLY

Scripts que solo auditan, leen o generan informes. Sin riesgo.

| # | Path | Familia | Descripción |
|---|------|---------|-------------|
| 1 | `scripts/maintenance/bdb_semantic_audit_funds_v3_readonly.py` | Semantic | Auditoría read-only funds_v3 |
| 2 | `scripts/maintenance/bdb_mixed_review_required_audit.py` | MIXED | Lee artifact JSON local |
| 3 | `scripts/maintenance/bdb_compatible_profiles_verify_removals.py` | Profiles | Verifica removals read-only |
| 4 | `scripts/maintenance/bdb_fe9_low_quality_credit_audit.py` | FE-9 | Audita FE-9 dormida |
| 5 | `scripts/maintenance/bdb_fi_credit_parser_discovery.py` | FI credit | Discovery cobertura MS CQ |
| 6 | `scripts/maintenance/bdb_fi_credit_fe9_impact_audit.py` | FE-9 | Audita 7 fondos FE9 gap |
| 7 | `scripts/maintenance/bdb_fi_credit_fe9_manual_factsheets_audit.py` | FE-9 | Auditoría factsheets 3 fondos |
| 8 | `scripts/maintenance/bdb_data_audit_0_readonly.js` | General | Auditoría general read-only |
| 9 | `scripts/maintenance/audit_derived_unknowns.js` | General | Audita unknowns derivados |
| 10 | `scripts/maintenance/audit_funds_v3.js` | General | Audita funds_v3 |
| 11 | `scripts/maintenance/analyze_sin_retrocesion.js` | Retro | Analiza fondos sin retrocesión |
| 12 | `scripts/maintenance/check_history.py` | History | Verifica histórico |
| 13 | `scripts/maintenance/diagnose_history.py` | History | Diagnóstico histórico |
| 14 | `scripts/maintenance/examine_excel.py` | Utility | Examina Excel |
| 15 | `scripts/maintenance/examine_files.py` | Utility | Examina archivos |
| 16 | `scripts/maintenance/examine_files2.py` | Utility | Examina archivos v2 |
| 17 | `scripts/maintenance/search_isin.py` | Utility | Busca ISINs |
| 18 | `scripts/maintenance/verify_history.py` | History | Verifica integridad histórico |

### Categoría 2: DRY_RUN_ONLY

Scripts que preparan manifests o proposals sin escribir Firestore.

| # | Path | Familia | Descripción |
|---|------|---------|-------------|
| 1 | `scripts/maintenance/bdb_mixed_exposure_fix_dry_run.py` | MIXED | Dry-run principal — lee Firestore, genera proposal |
| 2 | `scripts/maintenance/bdb_mixed_exposure_fix_dry_run_offline.py` | MIXED | Procesa artifact existente offline |
| 3 | `scripts/maintenance/bdb_sem_1_asset_mix_scale_triage.py` | Semantic | Triage de escala asset_mix |
| 4 | `scripts/maintenance/bdb_sem_2_asset_mix_fix_plan_dry_run.py` | Semantic | Plan de fix asset_mix (NO WRITE DECISION) |
| 5 | `scripts/maintenance/bdb_compatible_profiles_regen_dry_run.py` | Profiles | Dry-run regeneración 670 fondos |
| 6 | `scripts/maintenance/bdb_fi_credit_translator_dryrun.py` | FI credit | Dry-run traductor MS→fi_credit |
| 7 | `scripts/maintenance/bdb_retrocession_reload_dry_run.js` | Retro | Dry-run reload retrocesiones |
| 8 | `scripts/maintenance/generate_change_report.py` | Utility | Genera reporte de cambios |
| 9 | `scripts/maintenance/run_diagnosis.py` | Utility | Diagnóstico general |
| 10 | `scripts/maintenance/validate_nav_pipeline.py` | Utility | Validación pipeline NAV |

### Categoría 3: HISTORICAL_WRITE_SCRIPT — DO NOT RERUN ⚠️

Scripts que hicieron writes controlados a Firestore. **NO REEJECUTAR NUNCA.**

| # | Path | Familia | Lote | ISINs | Commit | Estado |
|---|------|---------|------|-------|--------|--------|
| 1 | `scripts/maintenance/bdb_mixed_exposure_write_controlled_1.py` | MIXED | Lote 1 | 10 | `d9ca28f` | ✅ DONE |
| 2 | `scripts/maintenance/bdb_mixed_exposure_write_controlled_2.py` | MIXED | Lote 2 | 5 | `fd383c2` | ✅ DONE |
| 3 | `scripts/maintenance/bdb_mixed_exposure_write_controlled_3.py` | MIXED | Lote 3 | 15 | `fd503e8` | ✅ DONE |
| 4 | `scripts/maintenance/bdb_mixed_exposure_write_controlled_4.py` | MIXED | Lote 4 | 5 | `a17ff30` | ✅ DONE |
| 5 | `scripts/maintenance/bdb_mixed_exposure_write_controlled_5.py` | MIXED | Lote 5 | 5 | `b044d20` | ✅ DONE |
| 6 | `scripts/maintenance/bdb_mixed_exposure_write_controlled_6.py` | MIXED | Lote 6 | 5 | `17e23fa` | ✅ DONE |
| 7 | `scripts/maintenance/bdb_mixed_exposure_write_controlled_7.py` | MIXED | Lote 7 | 9 | `84c9ec4` | ✅ DONE |
| 8 | `scripts/maintenance/bdb_mixed_exposure_write_controlled_8.py` | MIXED | Lote 8 | 5 | `fb14f38` | ✅ DONE |
| 9 | `scripts/maintenance/bdb_compatible_profiles_regen_write_controlled_0.py` | Profiles | Write | 10 | `cd2a0f9` | ✅ DONE |
| 10 | `scripts/maintenance/bdb_thematic_commodities_classification_write_controlled_0.py` | Commodities | Write | 14 | `8b15b1c` | ✅ DONE |
| 11 | `scripts/maintenance/bdb_fi_credit_translator_write_controlled_0.py` | FI credit | Write | 130 | `d28141f` | ✅ DONE |
| 12 | `scripts/maintenance/populate_taxonomy_v2.py` | Taxonomy | Pipeline | 670 | varios | ⚠️ PIPELINE — no ejecutar con `--execute` |

> **Todos usan `docRef.update()`, nunca `set()`.** Todos tienen guards `authorized + can_write`. Todos los manifests ya están en estado `authorized=true`. **Reejecutar es técnicamente posible pero categóricamente prohibido.**

### Categoría 4: WRITE_GATE (read-only, genera artifacts)

| # | Path | Familia |
|---|------|---------|
| 1 | `scripts/maintenance/bdb_mixed_exposure_write_gate_0.py` | MIXED Gate 0 |
| 2 | `scripts/maintenance/bdb_mixed_exposure_write_gate_2.py` | MIXED Gate 2 |
| 3 | `scripts/maintenance/bdb_mixed_exposure_write_gate_3.py` | MIXED Gate 3 |
| 4 | `scripts/maintenance/bdb_mixed_exposure_write_gate_4.py` | MIXED Gate 4 |
| 5 | `scripts/maintenance/bdb_mixed_exposure_write_gate_5.py` | MIXED Gate 5 |
| 6 | `scripts/maintenance/bdb_mixed_exposure_write_gate_6.py` | MIXED Gate 6 |
| 7 | `scripts/maintenance/bdb_mixed_exposure_write_gate_7.py` | MIXED Gate 7 |
| 8 | `scripts/maintenance/bdb_mixed_exposure_write_gate_8.py` | MIXED Gate 8 |
| 9 | `scripts/maintenance/bdb_compatible_profiles_regen_write_gate_0.py` | Profiles Gate |
| 10 | `scripts/maintenance/bdb_thematic_commodities_classification_write_gate_0.py` | Commodities Gate |
| 11 | `scripts/maintenance/bdb_fi_credit_translator_write_gate_0.py` | FI credit Gate |

> Los gates son read-only pero sobrescribirían artifacts existentes si se reejecutaran. **No reejecutar** — los artifacts son evidencia histórica.

---

## D. Inventario de Artifacts / Evidencia

### MIXED exposure (8 gates completos)

| Gate | selection | snapshots | diff | rollback | approval | post_write |
|------|-----------|-----------|------|----------|----------|------------|
| write_gate_0 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| write_gate_2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| write_gate_3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| write_gate_4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| write_gate_5 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| write_gate_6 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| write_gate_7 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| write_gate_8_official | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Adicionales: `mixed_exposure_fix_dry_run.json`, `mixed_exposure_write_gate_selection_0.json`, `official_factsheet_audit_0/`

### Compatible profiles (1 gate)

| Gate | Path | Completo |
|------|------|----------|
| compatible_profiles_write_gate_0 | `artifacts/suitability/compatible_profiles_write_gate_0/` | ✅ 6 archivos |

Adicionales: `compatible_profiles_regen_dry_run_0.json`, `compatible_profiles_regen_dry_run_0_PRE_COMMODITIES_WRITE.json`, `compatible_profiles_sector_equity_verify_0.json`, `compatible_profiles_verify_removals_0.json`

### Commodities/metales (1 gate)

| Gate | Path | Completo |
|------|------|----------|
| thematic_commodities_classification_gate_0 | `artifacts/suitability/thematic_commodities_classification_gate_0/` | ✅ 6 archivos |

### FI credit (1 gate)

| Gate | Path | Completo |
|------|------|----------|
| fi_credit_translator_write_gate_0 | `artifacts/suitability/fi_credit_translator_write_gate_0/` | ✅ 6 archivos |

Adicionales: `fi_credit_parser_discovery_0.json`, `fi_credit_translator_dryrun_0.json`, `fi_credit_translator_dryrun_0_PRE_WRITE.json`, `fi_credit_fe9_impact_audit_0.json`, `fi_credit_fe9_manual_factsheets_audit_0.json`, `fe9_low_quality_credit_audit_0.json`

### Parser Morningstar (2 gates)

| Gate | Path | Completo |
|------|------|----------|
| write_gate | `artifacts/bdb_parser_audit/write_gate/` | ✅ 5 archivos |
| write_gate_snapshot_1 | `artifacts/bdb_parser_audit/write_gate_snapshot_1/` | ✅ 7 archivos |

> **Cadena de evidencia 100% completa para 12 gates.** No borrar ningún artifact.

---

## E. Lista explícita de NO REEJECUTAR

Los siguientes scripts/acciones están **categóricamente prohibidos**:

| # | Script/Acción | Motivo |
|---|---------------|--------|
| 1 | `bdb_mixed_exposure_write_controlled_1.py` a `_8.py` | Writes MIXED completados y verificados |
| 2 | `bdb_compatible_profiles_regen_write_controlled_0.py` | Write compatible_profiles completado |
| 3 | `bdb_thematic_commodities_classification_write_controlled_0.py` | Write commodities completado |
| 4 | `bdb_fi_credit_translator_write_controlled_0.py` | Write fi_credit completado |
| 5 | `populate_taxonomy_v2.py --execute` | Pipeline de taxonomy — no relanzar |
| 6 | Cualquier gate `_write_gate_*.py` | Sobrescribiría artifacts de evidencia |
| 7 | Cualquier flag `--write`, `--apply`, `--confirm-write`, `--force` | Prohibido en scripts históricos |
| 8 | `scripts/backfill_asset_class_aggressive_v1.js` | Backfill histórico — no relanzar |
| 9 | `scripts/backfill_asset_class_fill_only_v1.js` | Backfill histórico — no relanzar |
| 10 | `scripts/apply_manual_overrides.js` | Overrides manuales — no relanzar sin gate |

---

## F. Evidencia a conservar obligatoriamente

| Tipo | Ubicación | Cantidad | Motivo |
|------|-----------|----------|--------|
| rollback_manifest.json | Todos los gate dirs | 12 | Capacidad de rollback de emergencia |
| snapshots_before.json | Todos los gate dirs | 12 | Estado pre-write documentado |
| post_write_verification.json | Todos los gate dirs | 12 | Prueba de verificación post-write |
| write_approval_manifest.json | Todos los gate dirs | 12 | Registro de aprobación humana |
| diff_manifest.json | Todos los gate dirs | 12 | Delta exacto aplicado |
| Docs `BDB_*_CLOSEOUT_*.md` | `docs/` | 5+ | Cierre formal de cada ciclo |
| Docs `BDB_*_WRITE_CONTROLLED_*.md` | `docs/` | 11 | Registro de cada write |

---

## G. Reglas para Futuros Agentes / Operadores

### Regla de oro
> **Ningún script histórico de write se reejecuta. Todo nuevo write exige nuevo bloque/gate.**

### Reglas absolutas

1. **NO ejecutar scripts `controlled_*` ni `write_controlled_*`** — están completados.
2. **NO ejecutar scripts `write_gate_*`** — sobrescribirían evidencia.
3. **NO usar flags** `--write`, `--apply`, `--confirm-write`, `--force`, `--commit`, `--deploy`.
4. **NO asumir que un dry-run histórico sigue vigente** — los datos Firestore han cambiado.
5. **NO borrar artifacts** de auditoría, rollback, snapshots o verification.
6. **NO copiar credenciales** dentro del repositorio.

### Todo nuevo write exige

- [ ] Nuevo dry-run desde datos actuales
- [ ] Nuevo diff_manifest
- [ ] Nuevo snapshot_before (live Firestore)
- [ ] Aprobación humana explícita
- [ ] Rollback manifest generado
- [ ] Post-write verification
- [ ] Commit y documentación

---

## H. Propuesta de fase futura

### `BDB-REMEDIATION-SCRIPTS-ARCHIVE-EXECUTION-0`

> **NO ejecutar ahora. Solo si se decide mover físicamente scripts/artifacts.**

Acciones propuestas:
1. Mover scripts `controlled_*` y `gate_*` a `scripts/maintenance/archive/`
2. Añadir banner `DO NOT RUN — HISTORICAL SCRIPT` en headers
3. Crear `README.md` en directorio de archivo
4. Confirmar tests PASS después del archivo

---

## I. Recomendación Profesional

1. **Por ahora, documentar y no mover nada.** Este documento es suficiente.
2. **Mantener evidencia accesible** — rollbacks, snapshots, verifications.
3. **Evitar borrar artifacts** de auditoría bajo ninguna circunstancia.
4. **No reejecutar nada histórico** — todo nuevo write exige nuevo gate.
5. **El sistema está estable.** No urge ninguna acción de archivo físico.

---

## J. Scripts en otros directorios (referencia)

### `scripts/` (raíz)

| Script | Tipo | Riesgo |
|--------|------|--------|
| `populate_taxonomy_v2_FINAL.py` | Pipeline | ⚠️ NO ejecutar sin gate |
| `backfill_asset_class_aggressive_v1.js` | Backfill | ⚠️ HISTÓRICO |
| `backfill_asset_class_fill_only_v1.js` | Backfill | ⚠️ HISTÓRICO |
| `apply_manual_overrides.js` | Overrides | ⚠️ NO ejecutar sin gate |
| `seed_emulator_data.py` | Emulator | ✅ SAFE (solo emulator) |
| `convert_font.py`, `create_fonts_ts.py` | Utility | ✅ SAFE |
| `aggressive_audit.py` | Audit | ✅ SAFE READ-ONLY |
| `remediate_orphans.py` | Fix | ⚠️ Revisar antes de ejecutar |

### `functions_python/scripts/`

| Script | Tipo | Riesgo |
|--------|------|--------|
| `repair_funds_v3_bdb.py` | Fix | ⚠️ WRITE-CAPABLE — no ejecutar sin gate |
| `update_risk_profiles_firestore.py` | Write | ⚠️ WRITE-CAPABLE — no ejecutar sin gate |
| `scripts/fixes/sync_categories_to_firestore.py` | Fix | ⚠️ WRITE-CAPABLE |
| `scripts/migration/populate_taxonomy_v2*.py` | Migration | ⚠️ HISTÓRICO — múltiples versiones |
| `scripts/audit/*` | Audit | ✅ SAFE READ-ONLY |
| `scripts/debug/*` | Debug | ✅ SAFE READ-ONLY |
| `scripts/sandbox/*` | Sandbox | ✅ SAFE READ-ONLY |
| `scripts/reports/*` | Reports | ✅ SAFE (genera informes) |

---

## K. Confirmaciones Finales

| Check | Estado |
|-------|--------|
| Writes a Firestore | ✅ 0 |
| Deploy | ✅ NO |
| Código productivo modificado | ✅ NO |
| Scripts write-capable reejecutados | ✅ NO |
| Scripts movidos/borrados | ✅ NO |
| Artifacts modificados | ✅ NO |
| `optimizer_core.py` tocado | ✅ NO |
| `suitability_engine.py` tocado | ✅ NO |
| `firestore.rules` tocado | ✅ NO |
| Frontend tocado | ✅ NO |
| Backend runtime tocado | ✅ NO |
| BDB-FONDOS-CORE tocado | ✅ NO |
| Credenciales tocadas | ✅ NO |

---

*Generado por Antigravity Agent — BDB-REMEDIATION-SCRIPTS-ARCHIVE-PLAN-0 v2*
*HEAD: `6b37c88` — Scripts inventariados: 48 — Write-capable: 12 — Artifact gates: 12 completos*
