# BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-CONTROLLED-0
## Write Controlado — Corrección Clasificación Sectorial Commodities/Metales

**Bloque:** `BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-CONTROLLED-0`  
**Fecha:** 2026-05-11T15:21 (UTC)  
**Commit base:** `c4e807c`  
**Tipo:** Write controlado — 2 campos por fondo — sin deploy — sin engine changes

---

## A. Resumen Ejecutivo

| Dimensión | Resultado |
|---|---|
| Write ejecutado | ✅ **SÍ** |
| Total seleccionados | **14** |
| Total escritos | **14/14** |
| Total verificados | **14/14** |
| Post-verification | ✅ **14/14 PASS** |
| `compatible_profiles` intacto | ✅ **SÍ — 0 cambios** |
| Campos prohibidos intactos | ✅ **SÍ — 0 cambios** |
| Drift detectado | ✅ **NINGUNO** |
| Deploy | ✅ **NO** |
| Engine modificado | ✅ **NO** |
| CORE tocado | ✅ **NO** |
| Tests | ✅ **104 PASS + 3 XFAIL — 0 FAIL** |
| Dry-run compatible_profiles | ✅ **669/670 MATCH — 0 STALE** |

---

## B. Tabla de Writes — Por Fondo

| ISIN | Nombre | `is_sector_fund` antes | `is_sector_fund` después | `sector_focus` antes | `sector_focus` después | `compatible_profiles` | Status |
|---|---|---|---|---|---|---|---|
| IE00BYVJR916 | Jupiter Gold & Silver Fund L EUR Acc | `false` | `true` | `UNKNOWN` | `PRECIOUS_METALS` | `[5..10]` ✅ | **PASS** |
| LU0090845842 | BlackRock GF World Mining Fund E2 | `false` | `true` | `UNKNOWN` | `MINING` | `[5..10]` ✅ | **PASS** |
| LU0171306680 | BlackRock GF World Gold Fund E2 EUR | `false` | `true` | `UNKNOWN` | `PRECIOUS_METALS` | `[5..10]` ✅ | **PASS** |
| LU0172157280 | BlackRock GF World Mining Fund A2 EUR | `false` | `true` | `UNKNOWN` | `MINING` | `[5..10]` ✅ | **PASS** |
| LU0172157363 | BlackRock GF World Mining Fund E2 EUR | `false` | `true` | `UNKNOWN` | `MINING` | `[5..10]` ✅ | **PASS** |
| LU0273148055 | DWS Gold and Precious Metals NC | `false` | `true` | `UNKNOWN` | `PRECIOUS_METALS` | `[5..10]` ✅ | **PASS** |
| LU0273159177 | DWS Gold and Precious Metals LC | `false` | `true` | `UNKNOWN` | `PRECIOUS_METALS` | `[5..10]` ✅ | **PASS** |
| LU0326425351 | BlackRock GF World Mining E2 EUR Hdg | `false` | `true` | `UNKNOWN` | `MINING` | `[5..10]` ✅ | **PASS** |
| LU0496368142 | Franklin Gold & Precious Metals A(acc) | `false` | `true` | `UNKNOWN` | `PRECIOUS_METALS` | `[5..10]` ✅ | **PASS** |
| LU0496369389 | Franklin Gold & Precious Metals N(acc) | `false` | `true` | `UNKNOWN` | `PRECIOUS_METALS` | `[5..10]` ✅ | **PASS** |
| LU0604766674 | Allianz GIF Global Metals and Mining | `false` | `true` | `UNKNOWN` | `MINING` | `[5..10]` ✅ | **PASS** |
| LU1223083087 | Schroder ISF Global Gold A EUR Hdg | `false` | `true` | `UNKNOWN` | `PRECIOUS_METALS` | `[5..10]` ✅ | **PASS** |
| LU1223084051 | Schroder ISF Global Gold A PLN Hdg | `false` | `true` | `UNKNOWN` | `PRECIOUS_METALS` | `[5..10]` ✅ | **PASS** |
| LU1578889864 | Ninety One GSF Global Gold A EUR Hdg | `false` | `true` | `UNKNOWN` | `PRECIOUS_METALS` | `[5..10]` ✅ | **PASS** |

---

## C. Campos Actualizados

Solo y exclusivamente estos 2 campos por documento:

```
classification_v2.is_sector_fund   false → true
classification_v2.sector_focus     "UNKNOWN" → "PRECIOUS_METALS" | "MINING"
```

Verificado en post-write por lectura inmediata de cada documento.

---

## D. Campos Prohibidos — Intactos

| Campo | Estado post-write |
|---|---|
| `classification_v2.compatible_profiles` | ✅ Intacto — `[5, 6, 7, 8, 9, 10]` sin cambio |
| `classification_v2.risk_bucket` | ✅ Intacto |
| `classification_v2.asset_type` | ✅ Intacto |
| `classification_v2.asset_subtype` | ✅ Intacto |
| `classification_v2.is_suitable_low_risk` | ✅ Intacto |
| `portfolio_exposure_v2` | ✅ Intacto |
| `manual` | ✅ Intacto |
| `ms` | ✅ Intacto |
| `derived` | ✅ Intacto |
| `std_perf` | ✅ Intacto |
| `optimizer` | ✅ Intacto |

`forbidden_fields_changed_count = 0` — confirmado en `post_write_verification.json`.

---

## E. Impacto del Write — Mecanismo

La regla en `suitability_engine.py` L61:

```python
is_sector_fund = bool(class_v2.get("is_sector_fund")) or str(asset_subtype or "").startswith("SECTOR_EQUITY_")

if is_sector_fund and risk_profile <= 4:
    return False, f"Sector funds ({sector_focus}) excluded for profiles <= 4."
```

**Antes:** `is_sector_fund = bool(False) = False` → regla no dispara → engine calcula `compatible_profiles = [3,4,5,6,7,8,9,10]` → **gap de elegibilidad** (perfiles 3/4 indebidos).

**Después:** `is_sector_fund = bool(True) = True` → regla dispara para perfiles ≤ 4 → engine calcula `compatible_profiles = [5,6,7,8,9,10]` → **correcto**.

El campo `compatible_profiles` almacenado ya estaba en `[5..10]` (corregido en el ciclo anterior). No fue necesario actualizarlo.

**Futuras regeneraciones:** Ya no añadirán perfiles 3/4 a estos fondos. El dry-run confirma: **0 STALE** para los 14 ISINs.

---

## F. Rollback

- Disponible en: `artifacts/suitability/thematic_commodities_classification_gate_0/rollback_manifest.json`
- Restaura: `is_sector_fund=false`, `sector_focus=UNKNOWN`
- **NO ejecutar rollback salvo instrucción explícita del usuario.**
- Ejecutar rollback devuelve el sistema al estado de gap (perfiles 3/4 indebidos para estos fondos).

---

## G. Tests Ejecutados

```powershell
.\functions_python\venv\Scripts\python.exe -m pytest \
  functions_python\tests\test_suitability_thematic_commodities_contract.py \
  functions_python\tests\test_suitability_contract_parity.py \
  functions_python\tests\test_suitability_v2.py \
  -v --tb=short
```

```
======================= 104 passed, 3 xfailed in 0.20s ========================
EXIT:0
```

| Suite | Tests | Resultado |
|---|---|---|
| `test_suitability_thematic_commodities_contract.py` | 22 | 19 PASS + 3 XFAIL |
| `test_suitability_contract_parity.py` + `test_suitability_v2.py` | 82 | 82 PASS |
| **TOTAL** | **104** | **104 PASS + 3 XFAIL — 0 FAIL** |

> [!NOTE]
> Los 3 XFAIL son el contrato futuro (Option A — regla semántica `suitability_theme`). Son `xfail(strict=True)` que se resolverán cuando se implemente la regla en el engine. La corrección de clasificación no los afecta porque los fixtures son mocks locales.

---

## H. Dry-Run Post-Write — compatible_profiles

```powershell
.\functions_python\venv\Scripts\python.exe scripts\maintenance\bdb_compatible_profiles_regen_dry_run.py
```

```
Total funds scanned:  670
MATCH:                669
STALE:                0
MISSING:              0
SKIPPED (Hamco):      1
Recommendation:       NO_ACTION_REQUIRED
EXIT:0
```

**Resultado:** Los 14 fondos commodities/metales ya no aparecen como STALE. El dry-run confirma que el write fue exitoso semánticamente.

Backup del dry-run previo preservado en:
`artifacts/suitability/compatible_profiles_regen_dry_run_0_PRE_COMMODITIES_WRITE.json`

---

## I. Confirmaciones de Seguridad

| Confirmación | Estado |
|---|---|
| Firestore write limitado a 2 campos | ✅ `is_sector_fund` + `sector_focus` únicamente |
| `compatible_profiles` modificado | ✅ **NO** — `compatible_profiles_modified=False` |
| Deploy ejecutado | ✅ **NO** |
| `suitability_engine.py` modificado | ✅ **NO** |
| Frontend runtime modificado | ✅ **NO** |
| BDB-FONDOS-CORE tocado | ✅ **NO** |
| `migrate_suitability_v2.py` ejecutado | ✅ **NO** |
| Scripts históricos de write ejecutados | ✅ **NO** |
| Credencial copiada al repo | ✅ **NO** |
| `firestore.rules` modificado | ✅ **NO** |

---

## J. Artifacts Generados/Actualizados

| Archivo | Descripción |
|---|---|
| `thematic_commodities_classification_gate_0/write_approval_manifest.json` | Actualizado: `authorized=true` (aprobación humana explícita) |
| `thematic_commodities_classification_gate_0/post_write_verification.json` | Generado: 14/14 PASS, all_pass=true |
| `compatible_profiles_regen_dry_run_0.json` | Actualizado post-write: 0 STALE |
| `compatible_profiles_regen_dry_run_0_PRE_COMMODITIES_WRITE.json` | Backup del estado pre-write |

---

## K. Próximos Pasos

El ciclo de remediación de suitability para commodities/metales está **completado**. Opciones futuras:

1. **Option A (largo plazo):** Implementar regla semántica explícita en `suitability_engine.py` para `THEMATIC_EQUITY` commodities — actualmente documentada como `XFAIL` en el contrato de tests.
2. **Monitoreo:** El dry-run periódico de `compatible_profiles` confirmará que estos fondos se mantienen en MATCH.
3. **Deploy:** No se requiere deploy para que el fix tenga efecto — el engine lee la clasificación en tiempo real desde Firestore.
