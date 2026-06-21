# BDB-COMPATIBLE-PROFILES-CLOSEOUT-0
## Cierre del Ciclo — Regeneración de `compatible_profiles`

**Bloque:** `BDB-COMPATIBLE-PROFILES-CLOSEOUT-0`  
**Fecha:** 2026-05-11  
**Commit de cierre:** `cd2a0f9` (BDB-COMPATIBLE-PROFILES-REGEN-WRITE-CONTROLLED-0)  
**Modo:** Documentación — 0 writes Firestore — 0 deploy

---

## A. Resumen Ejecutivo

El ciclo de saneamiento del campo `classification_v2.compatible_profiles` en `funds_v3` ha sido **completado con éxito**.

| Dimensión | Resultado |
|---|---|
| Fondos escaneados | **670** |
| Fondos ya correctos (MATCH) | **645** |
| Fondos corregidos por write controlado | **10** ✅ |
| Fondos HOLD — decisión humana de producto | **14** 🔒 |
| Hamco excluido | **1** ⏭️ |
| Firestore writes en este bloque | ✅ **CERO** |
| Deploy | ✅ **NO** |
| BDB-FONDOS-CORE tocado | ✅ **NO** |
| Campo único modificado | `classification_v2.compatible_profiles` |
| Post-write verification | ✅ **10/10 PASS** |
| Forbidden fields alterados | ✅ **NINGUNO** |
| Rollback disponible | ✅ `compatible_profiles_write_gate_0/rollback_manifest.json` |

---

## B. Timeline de Bloques y Commits

| # | Bloque | Commit | Objetivo | Resultado | Writes | Tests |
|---|---|---|---|---|---|---|
| 1 | `BDB-SUITABILITY-HARDCODED-CONTRACT-AUDIT-0` | `c91e43f` | Auditar 11 reglas hardcoded del engine | Contrato documentado, FE-9 identificado | 0 | 62/62 ✅ |
| 2 | `BDB-SUITABILITY-CONTRACT-TESTS-0` | `d565abb` | Tests de contrato suitability BE/FE, banner migrate | Tests creados, FE-9 documentado, banner añadido | 0 | 171/171 ✅ |
| 3 | `BDB-COMPATIBLE-PROFILES-REGEN-DRYRUN-0` | `98e2143` | Escanear 670 fondos, detectar STALE | 24 STALE detectados, 1 SKIPPED (Hamco) | 0 | — |
| 4 | `BDB-COMPATIBLE-PROFILES-VERIFY-SECTOR-EQUITY-0` | `11d18e9` | Verificar grupo gold/mining: HOLD decisión humana | 14 fondos HOLD_DO_NOT_ADD_P3_P4 confirmados | 0 | 85/85 ✅ |
| 5 | `BDB-COMPATIBLE-PROFILES-VERIFY-REMOVALS-0` | `742e7b9` | Verificar 2 casos críticos de remoción | LU1883330521, LU1095739733: ambos SAFE_TO_REGEN | 0 | 119/119 ✅ |
| 6 | `BDB-COMPATIBLE-PROFILES-REGEN-WRITE-GATE-0` | `2e8b233` | Preparar gate con snapshots, diff, rollback | drift=0, authorized=false, 5 artifacts | 0 | 134/134 ✅ |
| 7 | `BDB-COMPATIBLE-PROFILES-REGEN-WRITE-CONTROLLED-0` | `cd2a0f9` | Ejecutar write controlado para 10 fondos | 10/10 PASS, forbidden fields intactos | **10** | 134/134 ✅ |

---

## C. Estado Final del Catálogo

| Categoría | Count | Detalle |
|---|---|---|
| Total fondos escaneados | **670** | Colección `funds_v3` completa |
| Inicialmente MATCH | **645** | `compatible_profiles` correcto antes del ciclo |
| Inicialmente STALE | **24** | Valor discrepante respecto al cómputo actual |
| Corregidos por write controlado | **10** | ADD_ONLY (8) + REMOVE_ONLY (2) — todos PASS |
| HOLD — decisión humana | **14** | Commodities/metales preciosos — NO tocar |
| Skipped — sin datos | **1** | Hamco LU3038481936 |
| Schema inválido | **0** | — |
| `compatible_profiles` ausente | **0** | — |
| **Estado final** | **670/670** | Saneado bajo política actual de producto |

> **670 = 645 (MATCH) + 10 (corregidos) + 14 (HOLD) + 1 (Hamco)**

---

## D. Los 10 Writes Ejecutados

| ISIN | Nombre | Before | After | Cambio | Rationale | Status |
|---|---|---|---|---|---|---|
| ES0118537002 | Olea Neutral FI | [4..10] | **[3..10]** | +p3 | MIXED MODERATE, equity=15.5% ≤ 45% cap p3. Stored predataba la regla. | ✅ PASS |
| ES0162946034 | Abante Selección FI | [4..10] | **[3..10]** | +p3 | MIXED MODERATE, equity=41.2% ≤ 45% cap p3. Stored predataba la regla. | ✅ PASS |
| FR0010306142 | Carmignac Patrimoine E EUR Acc | [4..10] | **[3..10]** | +p3 | MIXED MODERATE, equity=35.4% ≤ 45%. Post-MIXED remediation redujo equity ~50%→35.4%. | ✅ PASS |
| LU0119195963 | Goldman Sachs Patrimonial Balanced | [4..10] | **[3..10]** | +p3 | MIXED MODERATE, equity=38.7% ≤ 45%. Stored predataba la regla. | ✅ PASS |
| LU0404220724 | JPMorgan Global Income Fund D | [4..10] | **[3..10]** | +p3 | MIXED MODERATE, equity=44.4% ≤ 45%. Stored predataba la regla. | ✅ PASS |
| LU1697017256 | Sigma Selection Moderate A | [4..10] | **[3..10]** | +p3 | MIXED MODERATE, equity=41.9% ≤ 45%. Stored predataba la regla. | ✅ PASS |
| LU1894680757 | Amundi Income Opportunities A2 EUR | [4..10] | **[3..10]** | +p3 | MIXED MODERATE, equity=30.3% ≤ 45%. Stored predataba la regla. | ✅ PASS |
| LU1883334275 | Amundi Global Subordinated Bond A EUR | [5..10] | **[3..10]** | +p3,+p4 | FIXED_INCOME CORPORATE_BOND, equity=0.0%. Sin exclusiones activas p3/p4. | ✅ PASS |
| LU1095739733 | First Eagle Amundi Income Builder AE-QD | [4..10] | **[5..10]** | **−p4** 🔴 | MIXED MODERATE, equity=61.9% > 60% hard cap p4. UI risk activo resuelto. | ✅ PASS |
| LU1883330521 | Amundi Global Multi-Asset Target Income | [1..10] | **[3..10]** | **−p1,−p2** 🔴 | MIXED CONSERVATIVE, equity=31.7% > 30% hard cap p1-p2. UI risk ALTA resuelto. | ✅ PASS |

### Verificación Post-Write (inmediata)

```
ES0118537002: after=[3,4,5,6,7,8,9,10] == proposed  PASS | forbidden fields: OK
ES0162946034: after=[3,4,5,6,7,8,9,10] == proposed  PASS | forbidden fields: OK
FR0010306142: after=[3,4,5,6,7,8,9,10] == proposed  PASS | forbidden fields: OK
LU0119195963: after=[3,4,5,6,7,8,9,10] == proposed  PASS | forbidden fields: OK
LU0404220724: after=[3,4,5,6,7,8,9,10] == proposed  PASS | forbidden fields: OK
LU1697017256: after=[3,4,5,6,7,8,9,10] == proposed  PASS | forbidden fields: OK
LU1894680757: after=[3,4,5,6,7,8,9,10] == proposed  PASS | forbidden fields: OK
LU1883334275: after=[3,4,5,6,7,8,9,10] == proposed  PASS | forbidden fields: OK
LU1095739733: after=[5,6,7,8,9,10]     == proposed  PASS | forbidden fields: OK
LU1883330521: after=[3,4,5,6,7,8,9,10] == proposed  PASS | forbidden fields: OK
```

---

## E. Fondos HOLD — Commodities / Metales Preciosos (14)

**Decisión humana de producto:** estos fondos son materias primas / metales preciosos (gold, mining, precious metals). El valor almacenado `[5..10]` o similar es **correcto por política comercial**. El engine actual no debe añadirles p3/p4.

| ISIN | Nombre |
|---|---|
| IE00BYVJR916 | Jupiter Gold & Silver Fund L EUR Acc |
| LU0090845842 | BlackRock GF - World Mining Fund E2 |
| LU0171306680 | BlackRock GF - World Gold Fund E2 |
| LU0172157280 | BlackRock GF - World Mining Fund A2 |
| LU0172157363 | BlackRock GF - World Mining Fund E2 |
| LU0273148055 | DWS Invest Gold and Precious Metals Equities LC |
| LU0273159177 | DWS Invest Gold and Precious Metals Equities LD |
| LU0326425351 | BlackRock GF - World Mining Fund E2 EUR Hdg |
| LU0496368142 | Franklin Gold & Precious Metals Fund A(acc) EUR |
| LU0496369389 | Franklin Gold & Precious Metals Fund N(acc) EUR |
| LU0604766674 | Allianz GIF - Allianz Global Metals and Mining |
| LU1223083087 | Schroder ISF Global Gold A Acc EUR Hdg |
| LU1223084051 | Schroder ISF Global Gold A Acc PLN Hdg |
| LU1578889864 | Ninety One GSF - Global Gold Fund A Acc EUR Hdg |

**Causa raíz del STALE falso:** `asset_subtype = THEMATIC_EQUITY` + `economic_exposure.equity = 0.0` + `is_sector_fund = False`. Con `real_eq = 0%`, ninguna regla del engine se activa, por lo que el engine los computa como elegibles para p3/p4. Sin embargo, son materias primas/metales con alta volatilidad sectorial. El valor stored `[5..10]` refleja la política correcta.

**Bloque recomendado para corrección estructural:** `BDB-SUITABILITY-THEMATIC-EQUITY-COMMODITIES-RULE-0`

---

## F. Hamco — LU3038481936

| Campo | Valor |
|---|---|
| ISIN | LU3038481936 |
| Nombre | Hamco Global Value R |
| Estado | SKIPPED — sin datos suficientes |
| Razón | Fondo nuevo, sin historial Morningstar fiable, sin `portfolio_exposure_v2` consolidada |
| Acción | NO tocar hasta disponer de ficha oficial / historial MS / datos económicos |
| Reversión | No aplica — no se ha modificado nunca |

---

## G. Seguridad y Trazabilidad

### G.1 Rollback disponible

```
Archivo: artifacts/suitability/compatible_profiles_write_gate_0/rollback_manifest.json
Contiene: restore values para los 10 ISINs modificados
```

| ISIN | Valor a restaurar si rollback necesario |
|---|---|
| ES0118537002 | [4,5,6,7,8,9,10] |
| ES0162946034 | [4,5,6,7,8,9,10] |
| FR0010306142 | [4,5,6,7,8,9,10] |
| LU0119195963 | [4,5,6,7,8,9,10] |
| LU0404220724 | [4,5,6,7,8,9,10] |
| LU1697017256 | [4,5,6,7,8,9,10] |
| LU1894680757 | [4,5,6,7,8,9,10] |
| LU1883334275 | [5,6,7,8,9,10] |
| LU1095739733 | [4,5,6,7,8,9,10] |
| LU1883330521 | [1,2,3,4,5,6,7,8,9,10] |

> [!WARNING]
> NO ejecutar rollback salvo instrucción explícita del usuario. El rollback restauraría el estado inconsistente previo.

### G.2 Campo único modificado

```
ALLOWED:  classification_v2.compatible_profiles
Mecanismo: Firestore dotted field path update — garantiza que solo ese subfield es modificado
```

### G.3 Forbidden fields — intactos en los 10 fondos

| Campo protegido | Estado |
|---|---|
| `portfolio_exposure_v2` | ✅ Intacto |
| `manual` | ✅ Intacto |
| `manual.costs` | ✅ Intacto |
| `manual.costs.retrocession` | ✅ Intacto |
| `ms` | ✅ Intacto |
| `derived` | ✅ Intacto |
| `std_perf` | ✅ Intacto |
| `classification_v2.risk_bucket` | ✅ Intacto |
| `classification_v2.asset_type` | ✅ Intacto |
| `classification_v2.asset_subtype` | ✅ Intacto |
| `classification_v2.is_sector_fund` | ✅ Intacto |
| `classification_v2.sector_focus` | ✅ Intacto |
| `classification_v2.is_suitable_low_risk` | ✅ Intacto |

### G.4 Artifacts de trazabilidad completos

| Artifact | Propósito |
|---|---|
| `compatible_profiles_regen_dry_run_0.json` | Baseline — 670 fondos escaneados |
| `compatible_profiles_sector_equity_verify_0.json` | 14 fondos HOLD commodities |
| `compatible_profiles_verify_removals_0.json` | 2 casos remoción verificados SAFE |
| `compatible_profiles_write_gate_0/selection.json` | 10 ISINs seleccionados, criterios |
| `compatible_profiles_write_gate_0/snapshots_before.json` | Snapshot live pre-write |
| `compatible_profiles_write_gate_0/diff_manifest.json` | Diff propuesto, drift=false |
| `compatible_profiles_write_gate_0/rollback_manifest.json` | Valores de restore |
| `compatible_profiles_write_gate_0/write_approval_manifest.json` | authorized=true, can_write=true |
| `compatible_profiles_write_gate_0/post_write_verification.json` | 10/10 PASS verificado |

---

## H. Riesgos Restantes

| Severidad | Riesgo | Detalle | Bloque recomendado |
|---|---|---|---|
| ⚠️ WARNING | **Gap semántico thematic equity commodities** | Engine no identifica fondos gold/mining como sectoriales cuando `equity=0.0` e `is_sector_fund=False`. Si se regenera `compatible_profiles` sin corrección del engine, los 14 HOLD fondos ganarían p3/p4 incorrectamente. | `BDB-SUITABILITY-THEMATIC-EQUITY-COMMODITIES-RULE-0` |
| ℹ️ INFO | **FE-9 lowQualityCredit** | Frontend excluye fondos con `lowQualityCredit >= 35%` para perfiles ≤ 4. Backend no tiene esta regla. Divergencia conocida, documentada en contrato. No genera inconsistencia activa actualmente. | `BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-DECISION-0` |
| ℹ️ INFO | **Hamco LU3038481936** | Sin datos suficientes. No se puede regenerar `compatible_profiles` hasta tener exposición económica fiable. | Pendiente datos Morningstar |
| ℹ️ INFO | **`migrate_suitability_v2.py`** | Script con banner histórico. NO debe ejecutarse directamente. Podría sobreescribir el estado recién corregido si se ejecuta sin precaución. | Dejar en archivo con banner |
| ℹ️ INFO | **Reglas suitability hardcoded** | Las 11 reglas están en código Python. No son configurables desde Firestore/system_settings. Deuda técnica de medio plazo. | `BDB-SUITABILITY-RULES-SOURCE-OF-TRUTH-DESIGN-0` |

---

## I. Próximos Bloques Recomendados

| Prioridad | Bloque | Tipo | Urgencia |
|---|---|---|---|
| 1 | `BDB-SUITABILITY-THEMATIC-EQUITY-COMMODITIES-RULE-0` | Corrección semántica engine para gold/mining | **Media** — necesario antes de cualquier futura regeneración de `compatible_profiles` |
| 2 | `BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-DECISION-0` | Decidir alinear frontend/backend en `lowQualityCredit` | Media — riesgo teórico, no activo |
| 3 | `BDB-COMPATIBLE-PROFILES-POST-WRITE-SMOKE-0` | Smoke test adicional live: confirmar 0 STALE para los 10 ISINs corregidos | Baja — opcional, para cierre formal |
| 4 | `BDB-SUITABILITY-RULES-SOURCE-OF-TRUTH-DESIGN-0` | Diseño de migración a configuración dinámica (Firestore/system_settings) | Baja — deuda técnica medio plazo |

> [!IMPORTANT]
> El bloque `BDB-SUITABILITY-THEMATIC-EQUITY-COMMODITIES-RULE-0` **debe ejecutarse antes** de cualquier futura regeneración masiva de `compatible_profiles`. Sin él, los 14 fondos HOLD ganarían p3/p4 incorrectamente al próximo dry-run.

---

## J. Confirmaciones Finales

| Confirmación | Estado |
|---|---|
| Firestore writes en este bloque | ✅ **CERO** |
| Deploy ejecutado | ✅ **NO** |
| Código productivo modificado | ✅ **NINGUNO** |
| BDB-FONDOS-CORE tocado | ✅ **NO** |
| `optimizer_core.py` modificado | ✅ **NO** |
| `suitability_engine.py` modificado | ✅ **NO** |
| `migrate_suitability_v2.py` ejecutado | ✅ **NO** |
| `firestore.rules` modificado | ✅ **NO** |
| Scripts históricos de write reejecutados | ✅ **NO** |

---

## K. Archivos del Ciclo Completo

### Scripts
| Script | Propósito |
|---|---|
| `scripts/maintenance/bdb_compatible_profiles_regen_dry_run.py` | Dry-run completo 670 fondos |
| `scripts/maintenance/bdb_compatible_profiles_verify_removals.py` | Verificación 2 casos remoción |
| `scripts/maintenance/bdb_compatible_profiles_regen_write_gate_0.py` | Gate preparation — live snapshots |
| `scripts/maintenance/bdb_compatible_profiles_regen_write_controlled_0.py` | Write controlado — ejecutado `cd2a0f9` |

### Documentos
| Documento | Bloque |
|---|---|
| `docs/BDB_SUITABILITY_HARDCODED_CONTRACT_AUDIT_0.md` | `c91e43f` |
| `docs/BDB_SUITABILITY_CONTRACT_TESTS_0.md` | `d565abb` |
| `docs/BDB_COMPATIBLE_PROFILES_REGEN_DRYRUN_0.md` | `98e2143` |
| `docs/BDB_COMPATIBLE_PROFILES_VERIFY_SECTOR_EQUITY_0.md` | `11d18e9` |
| `docs/BDB_COMPATIBLE_PROFILES_VERIFY_REMOVALS_0.md` | `742e7b9` |
| `docs/BDB_COMPATIBLE_PROFILES_REGEN_WRITE_GATE_0.md` | `2e8b233` |
| `docs/BDB_COMPATIBLE_PROFILES_REGEN_WRITE_CONTROLLED_0.md` | `cd2a0f9` |
| `docs/BDB_COMPATIBLE_PROFILES_CLOSEOUT_0.md` | Este documento |
