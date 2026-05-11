# BDB-SUITABILITY-COMPATIBLE-PROFILES-COMMODITIES-FINAL-CLOSEOUT-0
## Cierre Final — Suitability: Compatible Profiles y Commodities/Metales

**Bloque:** `BDB-SUITABILITY-COMPATIBLE-PROFILES-COMMODITIES-FINAL-CLOSEOUT-0`  
**Fecha:** 2026-05-11  
**Commit base:** `8b15b1c`  
**Tipo:** Documento de cierre conjunto — sin writes, sin deploy, sin código

---

## A. Resumen Ejecutivo

Los dos ciclos de remediación de suitability se dan por **completados y cerrados**:

| Ciclo | Resultado |
|---|---|
| `compatible_profiles` — regeneración y corrección | ✅ **Cerrado** — 10/10 fondos corregidos |
| `thematic_commodities` — clasificación sectorial | ✅ **Cerrado** — 14/14 fondos corregidos |
| Dry-run final post-remediation | ✅ **0 STALE** — 669/670 MATCH |
| Deploy realizado | ✅ **NO** |
| `suitability_engine.py` modificado | ✅ **NO** |
| CORE tocado | ✅ **NO** |
| `migrate_suitability_v2.py` ejecutado | ✅ **NO** |
| Writes fuera de los 2 gates | ✅ **NINGUNO** |

El catálogo de `funds_v3` presenta una foto limpia: **suitability correctamente calibrada para los 669 fondos activos**, sin perfiles de riesgo indebidos. El único fondo excluido es Hamco (LU3038481936), que carece de datos de exposición suficientes y permanece aislado.

---

## B. Timeline de Commits

| Commit | Bloque | Objetivo | Resultado | Writes |
|---|---|---|---|---|
| `c91e43f` | BDB-SUITABILITY-HARDCODED-CONTRACT-AUDIT-0 | Auditoría de 11 reglas hardcoded suitability engine | 62/62 PASS — engine sano | NO |
| `d565abb` | BDB-SUITABILITY-CONTRACT-TESTS-0 | Suite de tests de contrato parity BE/FE + guard migrate | 171/171 PASS — FE-9 documentado | NO |
| `98e2143` | BDB-COMPATIBLE-PROFILES-REGEN-DRYRUN-0 | Escaneo dry-run 670 fondos | 645 MATCH, 24 STALE, 1 SKIPPED | NO |
| `11d18e9` | BDB-COMPATIBLE-PROFILES-VERIFY-SECTOR-EQUITY-0 | Verificación 14 HOLD gold/mining → HOLD_DO_NOT_ADD_P3_P4 | 14 confirmados HOLD — excluidos del write | NO |
| `2e8b233` | BDB-COMPATIBLE-PROFILES-REGEN-WRITE-GATE-0 | Gate 10 fondos STALE validados | drift=0, artifacts generados, authorized=false | NO |
| `cd2a0f9` | BDB-COMPATIBLE-PROFILES-REGEN-WRITE-CONTROLLED-0 | Write controlado `compatible_profiles` | 10/10 PASS | **10 docs** |
| `a3ceb46` | BDB-COMPATIBLE-PROFILES-CLOSEOUT-0 | Cierre documental ciclo compatible_profiles | Closeout publicado | NO |
| `05f7d8b` | BDB-SUITABILITY-THEMATIC-EQUITY-COMMODITIES-RULE-0 | Auditoría gap + contrato + Opción B | 19 PASS + 3 XFAIL strict — Opción B validada | NO |
| `9a212ac` | BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-GATE-0 | Gate inicial (sin snapshot live) | 5 artifacts generados, authorized=false | NO |
| `c4e807c` | BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-LIVE-GATE-REFRESH-0 | Refresh gate desde Firestore live | 14/14 snapshots live, drift=0 | NO |
| `8b15b1c` | BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-CONTROLLED-0 | Write controlado `is_sector_fund` + `sector_focus` | 14/14 PASS — 0 STALE dry-run | **14 docs** |

**Total commits del ciclo:** 11 | **Total documentos escritos en Firestore:** 24 (10 + 14) | **Total deploys:** 0

---

## C. Estado Final del Catálogo

| Métrica | Valor |
|---|---|
| `funds_v3` total scanned | **670** |
| Con `compatible_profiles` | **670** |
| Sin `compatible_profiles` | **0** |
| **MATCH final** | **669** |
| **STALE final** | **0** |
| MISSING | **0** |
| INVALID schema | **0** |
| SKIPPED (Hamco) | **1** |
| MIXED total | 60 |
| MIXED stale | 0 |
| Timestamp dry-run final | `2026-05-11T15:21:53Z` |
| Recomendación | `NO_ACTION_REQUIRED` |

---

## D. Writes Ejecutados

### D.1 — Compatible Profiles: 10 fondos (commit `cd2a0f9`)

Campo único actualizado: `classification_v2.compatible_profiles`

| ISIN | Nombre | Profiles antes | Profiles después | Cambio | Status |
|---|---|---|---|---|---|
| ES0118537002 | Olea Neutral FI | `[4..10]` | `[3..10]` | +3 | ✅ PASS |
| ES0162946034 | Abante Selección FI | `[4..10]` | `[3..10]` | +3 | ✅ PASS |
| FR0010306142 | Carmignac Patrimoine E EUR Acc | `[4..10]` | `[3..10]` | +3 | ✅ PASS |
| LU0119195963 | GS Patrimonial Balanced P Cap EUR | `[4..10]` | `[3..10]` | +3 | ✅ PASS |
| LU0404220724 | JPMorgan IF Global Income Fund D EUR | `[4..10]` | `[3..10]` | +3 | ✅ PASS |
| LU1697017256 | Sigma IH Selection Moderate A EUR | `[4..10]` | `[3..10]` | +3 | ✅ PASS |
| LU1894680757 | Amundi IF Income Opportunities A2 EUR | `[4..10]` | `[3..10]` | +3 | ✅ PASS |
| LU1883334275 | Amundi IF Global Subordinated Bond A EUR | `[5..10]` | `[3..10]` | +3,4 | ✅ PASS |
| LU1095739733 | First Eagle Amundi Income Builder AE-QD | `[4..10]` | `[5..10]` | −4 | ✅ PASS |
| LU1883330521 | Amundi IF Global Multi-Asset Target Income | `[1..10]` | `[3..10]` | −1,2 | ✅ PASS |

> [!NOTE]
> LU1095739733 y LU1883330521 son los dos casos de **remoción de perfiles** confirmados como `SAFE_TO_REGEN_REMOVE_PROFILES` tras revisión manual con fichas oficiales.

### D.2 — Commodities Classification: 14 fondos (commit `8b15b1c`)

Campos únicos actualizados: `classification_v2.is_sector_fund` + `classification_v2.sector_focus`

| ISIN | Nombre | `is_sector_fund` | `sector_focus` | `compatible_profiles` | Status |
|---|---|---|---|---|---|
| IE00BYVJR916 | Jupiter Gold & Silver Fund L EUR Acc | `false` → `true` | `UNKNOWN` → `PRECIOUS_METALS` | `[5..10]` ✅ | ✅ PASS |
| LU0090845842 | BlackRock GF World Mining Fund E2 | `false` → `true` | `UNKNOWN` → `MINING` | `[5..10]` ✅ | ✅ PASS |
| LU0171306680 | BlackRock GF World Gold Fund E2 EUR | `false` → `true` | `UNKNOWN` → `PRECIOUS_METALS` | `[5..10]` ✅ | ✅ PASS |
| LU0172157280 | BlackRock GF World Mining Fund A2 EUR | `false` → `true` | `UNKNOWN` → `MINING` | `[5..10]` ✅ | ✅ PASS |
| LU0172157363 | BlackRock GF World Mining Fund E2 EUR | `false` → `true` | `UNKNOWN` → `MINING` | `[5..10]` ✅ | ✅ PASS |
| LU0273148055 | DWS Gold and Precious Metals NC | `false` → `true` | `UNKNOWN` → `PRECIOUS_METALS` | `[5..10]` ✅ | ✅ PASS |
| LU0273159177 | DWS Gold and Precious Metals LC | `false` → `true` | `UNKNOWN` → `PRECIOUS_METALS` | `[5..10]` ✅ | ✅ PASS |
| LU0326425351 | BlackRock GF World Mining E2 EUR Hdg | `false` → `true` | `UNKNOWN` → `MINING` | `[5..10]` ✅ | ✅ PASS |
| LU0496368142 | Franklin Gold & Precious Metals A(acc) | `false` → `true` | `UNKNOWN` → `PRECIOUS_METALS` | `[5..10]` ✅ | ✅ PASS |
| LU0496369389 | Franklin Gold & Precious Metals N(acc) | `false` → `true` | `UNKNOWN` → `PRECIOUS_METALS` | `[5..10]` ✅ | ✅ PASS |
| LU0604766674 | Allianz GIF Global Metals and Mining | `false` → `true` | `UNKNOWN` → `MINING` | `[5..10]` ✅ | ✅ PASS |
| LU1223083087 | Schroder ISF Global Gold A EUR Hdg | `false` → `true` | `UNKNOWN` → `PRECIOUS_METALS` | `[5..10]` ✅ | ✅ PASS |
| LU1223084051 | Schroder ISF Global Gold A PLN Hdg | `false` → `true` | `UNKNOWN` → `PRECIOUS_METALS` | `[5..10]` ✅ | ✅ PASS |
| LU1578889864 | Ninety One GSF Global Gold A EUR Hdg | `false` → `true` | `UNKNOWN` → `PRECIOUS_METALS` | `[5..10]` ✅ | ✅ PASS |

---

## E. Campos Tocados — Inventario Exacto

| Write gate | Campo | Documentos | Operación |
|---|---|---|---|
| Compatible profiles (`cd2a0f9`) | `classification_v2.compatible_profiles` | 10 | Update — profiles añadidos/removidos |
| Commodities classification (`8b15b1c`) | `classification_v2.is_sector_fund` | 14 | Update — `false` → `true` |
| Commodities classification (`8b15b1c`) | `classification_v2.sector_focus` | 14 | Update — `UNKNOWN` → `PRECIOUS_METALS`\|`MINING` |

**Total campos distintos modificados en Firestore:** 3  
**Total documentos Firestore modificados:** 24 (10 + 14, sin solapamiento)

---

## F. Campos NO Tocados — Confirmación

| Campo / Componente | Estado |
|---|---|
| `portfolio_exposure_v2` | ✅ No tocado |
| `manual` / `manual.costs` / `manual.costs.retrocession` | ✅ No tocado |
| `ms` | ✅ No tocado |
| `derived` | ✅ No tocado |
| `std_perf` | ✅ No tocado |
| `optimizer` | ✅ No tocado |
| `classification_v2.risk_bucket` | ✅ No tocado |
| `classification_v2.asset_type` | ✅ No tocado |
| `classification_v2.asset_subtype` | ✅ No tocado |
| `classification_v2.is_suitable_low_risk` | ✅ No tocado |
| `suitability_engine.py` | ✅ No modificado |
| Frontend runtime | ✅ No modificado |
| `firestore.rules` | ✅ No modificado |
| `optimizer_core.py` | ✅ No modificado |
| BDB-FONDOS-CORE | ✅ No tocado |
| `migrate_suitability_v2.py` | ✅ No ejecutado |

Confirmado por `forbidden_fields_changed_count=0` en ambos `post_write_verification.json`.

---

## G. Validaciones — Resumen Consolidado

| Validación | Comando | Resultado |
|---|---|---|
| Post-write `compatible_profiles` | `post_write_verification.json` | **10/10 PASS** — `all_pass=true` |
| Post-write `commodities classification` | `post_write_verification.json` | **14/14 PASS** — `all_pass=true` |
| Dry-run final `compatible_profiles` | `bdb_compatible_profiles_regen_dry_run.py` | **670 scanned, 669 MATCH, 0 STALE** |
| Tests contrato suitability | `pytest test_suitability_thematic_commodities_contract.py ...` | **104 PASS + 3 XFAIL** |
| Tests parity BE/FE | `pytest test_suitability_contract_parity.py test_suitability_v2.py` | **PASS** (incluidos en 104) |
| Forbidden fields intactos | Verificado per-fund en ambos scripts | **0 cambios en ambos gates** |

> [!NOTE]
> Los **3 XFAIL** son tests del contrato futuro (Option A — regla semántica `suitability_theme` en el engine). Son `xfail(strict=True)` — documentan el diseño deseado, no son regresiones. Se convertirán en PASS cuando se implemente la regla explícita en `suitability_engine.py`.

---

## H. Pendientes Vivos

### H.1 — Hamco `LU3038481936` (permanente hasta datos disponibles)

- **Estado:** SKIPPED en todos los dry-runs
- **Motivo:** Fondo nuevo sin `portfolio_exposure_v2` suficiente — no hay exposición económica fiable
- **Acción:** NO tocar hasta que el fondo tenga al menos 12 meses de datos Morningstar verificados
- **Riesgo:** Bajo — el fondo no aparece en recomendaciones de suitability mientras no tenga clasificación válida

### H.2 — Divergencia FE-9 `lowQualityCredit >= 35%`

- **Estado:** Documentada en `d565abb` — `known_divergences` en el contrato
- **Descripción:** El frontend excluye fondos con `lowQualityCredit >= 35%` para perfiles ≤ 4; el backend no tiene esa regla
- **Impacto actual:** El frontend es más restrictivo que el backend — la divergencia favorece la prudencia
- **Próximo bloque sugerido:** `BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-DECISION-0` para decidir si añadir la regla al engine o eliminarla del frontend

### H.3 — Reglas Hardcoded Suitability (deuda técnica medio plazo)

- **Estado:** Documentadas en `c91e43f` — 11 reglas hardcoded en `is_fund_eligible_for_profile()`
- **Descripción:** Toda la lógica de elegibilidad está hardcoded. No hay source-of-truth externo (Firestore, config)
- **Riesgo:** Bajo hoy — todas cubiertas por tests. Riesgo crece si el catálogo escala
- **Próximo bloque sugerido:** `BDB-SUITABILITY-RULES-SOURCE-OF-TRUTH-DESIGN-0`

### H.4 — Option A (Regla Semántica `THEMATIC_EQUITY` Commodities)

- **Estado:** 3 XFAIL en `test_suitability_thematic_commodities_contract.py`
- **Descripción:** La opción "limpia" es añadir una regla explícita en el engine que detecte `THEMATIC_EQUITY` commodities sin depender de la clasificación sectorial. La Option B (ya ejecutada) funciona, pero depende de que `is_sector_fund` esté correctamente mantenido
- **Próximo bloque sugerido:** Puede abordarse junto con H.3

---

## I. Próximos Bloques Recomendados

| Prioridad | Bloque | Objetivo | Urgencia |
|---|---|---|---|
| 1 | `BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-DECISION-0` | Decidir si FE-9 se sincroniza en BE o se elimina en FE | Media |
| 2 | `BDB-SUITABILITY-RULES-SOURCE-OF-TRUTH-DESIGN-0` | Diseñar source-of-truth para reglas hardcoded | Baja |
| 3 | `BDB-SUITABILITY-POST-REMEDIATION-SMOKE-0` *(opcional)* | Smoke test en entorno de staging/producción real | Baja |
| 4 | `BDB-AUDIT-MASTER-STATUS-REPORT-REFRESH-2026-05-1` *(opcional)* | Actualizar el master report con el estado post-remediation | Informativa |

---

## J. Confirmaciones de Seguridad del Bloque

| Confirmación | Estado |
|---|---|
| Firestore writes en este bloque | ✅ **CERO** |
| Deploy ejecutado | ✅ **NO** |
| Código productivo modificado | ✅ **NO** |
| `suitability_engine.py` modificado | ✅ **NO** |
| BDB-FONDOS-CORE tocado | ✅ **NO** |
| `migrate_suitability_v2.py` ejecutado | ✅ **NO** |
| Scripts históricos de write ejecutados | ✅ **NO** |
| Tests ejecutados en este bloque | Tests not run — documentation-only closeout. Referenced latest passing suites from `8b15b1c`: **104 PASS + 3 XFAIL**. |

---

## K. Rollbacks Disponibles

| Gate | Artifact | Campos restaurables | Nota |
|---|---|---|---|
| Compatible profiles | `compatible_profiles_write_gate_0/rollback_manifest.json` | `classification_v2.compatible_profiles` | Restaura valores previos por ISIN |
| Commodities classification | `thematic_commodities_classification_gate_0/rollback_manifest.json` | `classification_v2.is_sector_fund`, `classification_v2.sector_focus` | Restaura `false` + `UNKNOWN` — vuelve al estado de gap |

> [!CAUTION]
> Ejecutar el rollback de commodities classification devuelve el sistema al **estado de gap** (perfiles 3/4 indebidos para fondos de oro/minería). No ejecutar sin instrucción humana explícita y sin previo análisis de impacto.
