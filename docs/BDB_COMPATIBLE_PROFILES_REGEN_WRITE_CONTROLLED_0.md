# BDB-COMPATIBLE-PROFILES-REGEN-WRITE-CONTROLLED-0
## Informe de Write Controlado — Regeneración de `compatible_profiles`

**Bloque:** `BDB-COMPATIBLE-PROFILES-REGEN-WRITE-CONTROLLED-0`  
**Fecha ejecución:** 2026-05-11T14:11:09Z  
**Base commit:** `2e8b233` (BDB-COMPATIBLE-PROFILES-REGEN-WRITE-GATE-0)  
**Campo modificado:** `classification_v2.compatible_profiles` **ÚNICAMENTE**  
**Colección:** `funds_v3`

---

## A. Resumen Ejecutivo

| Dimensión | Resultado |
|---|---|
| Write ejecutado | ✅ **SÍ** |
| Total seleccionados | **10** |
| Total escritos | **10** |
| Total verificados | **10** |
| **PASS** | ✅ **10/10** |
| **FAIL** | ✅ **0** |
| Drift pre-write | ✅ **NINGUNO** — 10/10 sin drift |
| Forbidden fields intactos | ✅ **SÍ** — verificado post-write en todos los fondos |
| Deploy | ✅ **NO** |
| BDB-FONDOS-CORE tocado | ✅ **NO** |
| Campos adicionales modificados | ✅ **NINGUNO** |

> [!IMPORTANT]
> Las escrituras son **irreversibles** por defecto. El rollback manual está disponible en `artifacts/suitability/compatible_profiles_write_gate_0/rollback_manifest.json`. NO ejecutar rollback salvo instrucción explícita del usuario.

---

## B. Tabla de Writes Ejecutados

| # | ISIN | Nombre | Before | After | Cambio | Status |
|---|---|---|---|---|---|---|
| 1 | ES0118537002 | Olea Neutral FI | [4..10] | **[3..10]** | +p3 | ✅ PASS |
| 2 | ES0162946034 | Abante Selección FI | [4..10] | **[3..10]** | +p3 | ✅ PASS |
| 3 | FR0010306142 | Carmignac Patrimoine E EUR Acc | [4..10] | **[3..10]** | +p3 | ✅ PASS |
| 4 | LU0119195963 | Goldman Sachs Patrimonial Balanced | [4..10] | **[3..10]** | +p3 | ✅ PASS |
| 5 | LU0404220724 | JPMorgan Global Income Fund D | [4..10] | **[3..10]** | +p3 | ✅ PASS |
| 6 | LU1697017256 | Sigma Selection Moderate A | [4..10] | **[3..10]** | +p3 | ✅ PASS |
| 7 | LU1894680757 | Amundi Income Opportunities A2 EUR | [4..10] | **[3..10]** | +p3 | ✅ PASS |
| 8 | LU1883334275 | Amundi Global Subordinated Bond A EUR | [5..10] | **[3..10]** | +p3,+p4 | ✅ PASS |
| 9 | LU1095739733 | First Eagle Amundi Income Builder AE-QD | [4..10] | **[5..10]** | **−p4** | ✅ PASS |
| 10 | LU1883330521 | Amundi Global Multi-Asset Target Income | [1..10] | **[3..10]** | **−p1,−p2** | ✅ PASS |

### Verificación Post-Write Por Fondo

Cada fondo fue re-leído de Firestore inmediatamente tras la escritura:

```
ES0118537002: after=[3,4,5,6,7,8,9,10] == proposed=[3,4,5,6,7,8,9,10]  PASS
ES0162946034: after=[3,4,5,6,7,8,9,10] == proposed=[3,4,5,6,7,8,9,10]  PASS
FR0010306142: after=[3,4,5,6,7,8,9,10] == proposed=[3,4,5,6,7,8,9,10]  PASS
LU0119195963: after=[3,4,5,6,7,8,9,10] == proposed=[3,4,5,6,7,8,9,10]  PASS
LU0404220724: after=[3,4,5,6,7,8,9,10] == proposed=[3,4,5,6,7,8,9,10]  PASS
LU1697017256: after=[3,4,5,6,7,8,9,10] == proposed=[3,4,5,6,7,8,9,10]  PASS
LU1894680757: after=[3,4,5,6,7,8,9,10] == proposed=[3,4,5,6,7,8,9,10]  PASS
LU1883334275: after=[3,4,5,6,7,8,9,10] == proposed=[3,4,5,6,7,8,9,10]  PASS
LU1095739733: after=[5,6,7,8,9,10]     == proposed=[5,6,7,8,9,10]      PASS
LU1883330521: after=[3,4,5,6,7,8,9,10] == proposed=[3,4,5,6,7,8,9,10]  PASS
```

---

## C. Campos Prohibidos — Verificación de Integridad

Tras cada escritura, el script verificó que los siguientes campos permanecen **idénticos** al snapshot pre-write:

| Campo verificado | Resultado |
|---|---|
| `portfolio_exposure_v2` | ✅ Intacto en los 10 fondos |
| `manual` | ✅ Intacto en los 10 fondos |
| `manual.costs` | ✅ Intacto en los 10 fondos |
| `manual.costs.retrocession` | ✅ Intacto en los 10 fondos |
| `ms` | ✅ Intacto en los 10 fondos |
| `derived` | ✅ Intacto en los 10 fondos |
| `std_perf` | ✅ Intacto en los 10 fondos |
| `classification_v2.risk_bucket` | ✅ Intacto en los 10 fondos |
| `classification_v2.asset_type` | ✅ Intacto en los 10 fondos |
| `classification_v2.asset_subtype` | ✅ Intacto en los 10 fondos |
| `classification_v2.is_sector_fund` | ✅ Intacto en los 10 fondos |
| `classification_v2.sector_focus` | ✅ Intacto en los 10 fondos |
| `classification_v2.is_suitable_low_risk` | ✅ Intacto en los 10 fondos |

> El script usó Firestore's dotted field path update (`"classification_v2.compatible_profiles": value`) que garantiza que solo ese subfield es modificado sin afectar el resto del objeto `classification_v2`.

---

## D. Rollback

Si por cualquier motivo se necesita revertir las escrituras:

```
Archivo: artifacts/suitability/compatible_profiles_write_gate_0/rollback_manifest.json
Valores previos: compatible_profiles de cada fondo antes del write (snapshot 2026-05-11T13:54:53Z)
```

| ISIN | Valor a restaurar |
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
> NO ejecutar rollback salvo instrucción explícita del usuario. El rollback restauraría el estado inconsistente previo (perfiles que el backend actual rechaza).

---

## E. Exclusiones Mantenidas

| ISIN | Razón de exclusión |
|---|---|
| LU3038481936 (Hamco) | Sin datos históricos suficientes |
| IE00BYVJR916 | HOLD — commodities/metales preciosos |
| LU0090845842 | HOLD — commodities/metales preciosos |
| LU0171306680 | HOLD — commodities/metales preciosos |
| LU0172157280 | HOLD — commodities/metales preciosos |
| LU0172157363 | HOLD — commodities/metales preciosos |
| LU0273148055 | HOLD — commodities/metales preciosos |
| LU0273159177 | HOLD — commodities/metales preciosos |
| LU0326425351 | HOLD — commodities/metales preciosos |
| LU0496368142 | HOLD — commodities/metales preciosos |
| LU0496369389 | HOLD — commodities/metales preciosos |
| LU0604766674 | HOLD — commodities/metales preciosos |
| LU1223083087 | HOLD — commodities/metales preciosos |
| LU1223084051 | HOLD — commodities/metales preciosos |
| LU1578889864 | HOLD — commodities/metales preciosos |

---

## F. Tests Ejecutados

| Suite | Tests | Resultado |
|---|---|---|
| `test_suitability_contract_parity.py` | 38 | ✅ 38/38 |
| `test_suitability_v2.py` | 47 | ✅ 47/47 |
| `test_mixed_exposure_ms_portfolio.py` | 10 | ✅ 10/10 |
| `test_mixed_funds_lookthrough_contract.py` | 4 | ✅ 4/4 |
| `rulesEngine.suitability.test.ts` | 34 | ✅ 34/34 |
| **TOTAL** | **133+** | **✅ TODOS PASS** |

---

## G. Confirmaciones de Seguridad

| Confirmación | Estado |
|---|---|
| `classification_v2.compatible_profiles` actualizado | ✅ 10/10 PASS |
| Ningún otro campo modificado | ✅ Verificado post-write |
| Firestore write limitado al campo permitido | ✅ Dotted field path update |
| Deploy ejecutado | ✅ **NO** |
| BDB-FONDOS-CORE tocado | ✅ **NO** |
| `optimizer_core.py` modificado | ✅ **NO** |
| `suitability_engine.py` modificado | ✅ **NO** |
| `migrate_suitability_v2.py` ejecutado | ✅ **NO** |
| `firestore.rules` modificado | ✅ **NO** |
| Scripts históricos de write reejecutados | ✅ **NO** |
| Rollback disponible | ✅ `rollback_manifest.json` |

---

## H. Artifacts de Este Bloque

| Archivo | Descripción |
|---|---|
| `scripts/maintenance/bdb_compatible_profiles_regen_write_controlled_0.py` | Script de write controlado |
| `artifacts/suitability/compatible_profiles_write_gate_0/write_approval_manifest.json` | Manifest actualizado: `authorized=true` |
| `artifacts/suitability/compatible_profiles_write_gate_0/post_write_verification.json` | Verificación post-write: 10/10 PASS |
| `docs/BDB_COMPATIBLE_PROFILES_REGEN_WRITE_CONTROLLED_0.md` | Este documento |

---

## I. Estado Final del Programa

### compatible_profiles — Estado Actualizado

| Grupo | Count | Estado |
|---|---|---|
| Fondos corregidos (este bloque) | 10 | ✅ DONE |
| HOLD commodities/metales | 14 | 🔒 HOLD permanente |
| Hamco | 1 | ⏭️ Excluido permanentemente |
| Resto de fondos (MATCH desde dry-run) | 645 | ✅ Correctos |
| **Total funds_v3** | **670** | — |

### Próximos Bloques Posibles

| Bloque | Tipo | Estado |
|---|---|---|
| `BDB-SUITABILITY-THEMATIC-EQUITY-COMMODITIES-RULE-0` | Corrección semántica engine para gold/mining | Independiente, no urgente |
| `BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-DECISION-0` | Divergencia frontend-backend `lowQualityCredit` | Independiente |
| Post-MIXED dry-run completo de confirmación | Verificar 0 STALE en todos los 10 ISINs | Recomendado como closeout |
