# BDB-SUITABILITY-THEMATIC-EQUITY-COMMODITIES-RULE-0
## Auditoría y Contrato — Thematic Equity Commodities / Gold / Mining

**Bloque:** `BDB-SUITABILITY-THEMATIC-EQUITY-COMMODITIES-RULE-0`  
**Fecha:** 2026-05-11  
**Commit base:** `a3ceb46` (compatible_profiles closeout)  
**Tipo:** Auditoría y contrato — sin implementación, sin writes, sin deploy  
**Tests creados:** `functions_python/tests/test_suitability_thematic_commodities_contract.py`

---

## A. Resumen Ejecutivo

| Dimensión | Resultado |
|---|---|
| Tipo de bloque | Auditoría / diseño de contrato |
| Fondos afectados | **14 HOLD** — commodities/gold/mining/metales preciosos |
| Riesgo identificado | ⚠️ Futura regeneración masiva les añadiría p3/p4 incorrectamente |
| Causa raíz | `THEMATIC_EQUITY` + `is_sector_fund=False` + `equity=0.0` → ninguna regla los excluye |
| Gap confirmado con tests | ✅ `test_thematic_equity_gold_currently_eligible_for_p3/p4` PASS |
| Solución recomendada | **Opción B** — Firestore write gate: `is_sector_fund=true` + `sector_focus=COMMODITIES` |
| Opción B verificada | ✅ `TestOptionBClassificationFix` — 12 tests PASS con engine actual (SIN cambios de código) |
| Opción A (engine rule) | 3 tests xfail-strict — contrato futuro documentado |
| Firestore writes | ✅ **CERO** en este bloque |
| Deploy | ✅ **NO** |
| Código productivo modificado | ✅ **NINGUNO** |

> [!IMPORTANT]
> La **Opción B** permite corregir los 14 fondos HOLD con un write gate de clasificación (`is_sector_fund`, `sector_focus`) usando el engine actual — sin tocar `suitability_engine.py`. Después del write, el dry-run mostraría 0 STALE para estos fondos.

---

## B. Causa Raíz

### El gap en 3 capas

```
Firestore (14 fondos gold/mining):
  classification_v2.asset_subtype   = "THEMATIC_EQUITY"
  classification_v2.is_sector_fund  = false   ← GAP: debería ser true
  classification_v2.sector_focus    = null    ← GAP: debería ser "COMMODITIES" o "MINING"
  portfolio_exposure_v2.economic_exposure.equity = 0.0  ← Morningstar: 0% equity

Engine (suitability_engine.py L29):
  is_sector_fund = bool(class_v2.get("is_sector_fund"))
              →   bool(False)
              →   False

Engine (suitability_engine.py L61):
  if is_sector_fund:  →  if False:  →  NO DISPARA

Engine (suitability_engine.py L64):
  if asset_subtype in {"EMERGING_MARKETS_EQUITY", "HIGH_YIELD_BOND"}:
              →  "THEMATIC_EQUITY" not in set  →  NO DISPARA

Engine (suitability_engine.py L56-59):
  real_eq = 0.0  →  sin cap de equity
  →  0.0 <= 45%  y  0.0 <= 60%  →  NO DISPARA

Resultado: is_fund_eligible_for_profile(fund, p3) = True  ← INCORRECTO
           is_fund_eligible_for_profile(fund, p4) = True  ← INCORRECTO
```

### Confirmado con tests

```
test_thematic_equity_gold_currently_eligible_for_p3  PASS (gap confirmado)
test_thematic_equity_gold_currently_eligible_for_p4  PASS (gap confirmado)
test_current_computed_profiles_are_3_to_10           PASS (engine produce [3..10])
test_stored_policy_profiles_should_be_5_to_10        PASS (política correcta = [5..10])
```

---

## C. Los 14 Fondos HOLD — Análisis Completo

| ISIN | Nombre | Stored | Computed (engine) | Policy | Recomendación |
|---|---|---|---|---|---|
| IE00BYVJR916 | Jupiter Gold & Silver Fund L EUR Acc | [5..10] | [3..10] | [5..10] | **HOLD — Option B** |
| LU0090845842 | BlackRock GF World Mining Fund E2 | [5..10] | [3..10] | [5..10] | **HOLD — Option B** |
| LU0171306680 | BlackRock GF World Gold Fund E2 EUR | [5..10] | [3..10] | [5..10] | **HOLD — Option B** |
| LU0172157280 | BlackRock GF World Mining Fund A2 EUR | [5..10] | [3..10] | [5..10] | **HOLD — Option B** |
| LU0172157363 | BlackRock GF World Mining Fund E2 EUR | [5..10] | [3..10] | [5..10] | **HOLD — Option B** |
| LU0273148055 | DWS Gold and Precious Metals NC | [5..10] | [3..10] | [5..10] | **HOLD — Option B** |
| LU0273159177 | DWS Gold and Precious Metals LC | [5..10] | [3..10] | [5..10] | **HOLD — Option B** |
| LU0326425351 | BlackRock GF World Mining E2 EUR Hdg | [5..10] | [3..10] | [5..10] | **HOLD — Option B** |
| LU0496368142 | Franklin Gold & Precious Metals A(acc) | [5..10] | [3..10] | [5..10] | **HOLD — Option B** |
| LU0496369389 | Franklin Gold & Precious Metals N(acc) | [5..10] | [3..10] | [5..10] | **HOLD — Option B** |
| LU0604766674 | Allianz GIF Global Metals and Mining | [5..10] | [3..10] | [5..10] | **HOLD — Option B** |
| LU1223083087 | Schroder ISF Global Gold A EUR Hdg | [5..10] | [3..10] | [5..10] | **HOLD — Option B** |
| LU1223084051 | Schroder ISF Global Gold A PLN Hdg | [5..10] | [3..10] | [5..10] | **HOLD — Option B** |
| LU1578889864 | Ninety One GSF Global Gold A EUR Hdg | [5..10] | [3..10] | [5..10] | **HOLD — Option B** |

**Patrón común:** todos tienen `THEMATIC_EQUITY`, `equity=0.0`, `is_sector_fund=False`. Todos deben permanecer en `[5..10]`.

---

## D. Opciones Evaluadas

### Opción A — Regla explícita en el engine (`suitability_theme`)

**Implementación:**
```python
# suitability_engine.py — nueva regla después de L64
COMMODITIES_THEMES = {"COMMODITIES", "GOLD", "MINING", "PRECIOUS_METALS", "SILVER"}
suitability_theme = str(class_v2.get("suitability_theme") or "").upper()
if risk_profile <= 4 and suitability_theme in COMMODITIES_THEMES:
    return False, f"Thematic {suitability_theme} fund excluded for profiles <= 4."
```

**Requiere también:** escribir `classification_v2.suitability_theme` en Firestore para los 14 fondos.

| Pros | Contras |
|---|---|
| Semánticamente explícita | Requiere modificar `suitability_engine.py` |
| Extensible a nuevos themes | Requiere nuevo campo Firestore + write gate |
| Auto-documenta la política | Dos cambios coordinados: engine + Firestore |

**Estado:** xfail-strict — `TestFutureContractOptionA` (3 tests) documenta el contrato. No implementada.

---

### Opción B — Corregir clasificación sectorial (`is_sector_fund` + `sector_focus`) ✅ RECOMENDADA

**Implementación:** Write gate Firestore para los 14 fondos:
```
classification_v2.is_sector_fund = true
classification_v2.sector_focus   = "COMMODITIES"  (o "MINING" / "PRECIOUS_METALS")
```

El engine ya tiene la regla (L61):
```python
if is_sector_fund:
    return False, f"Sector funds ({sector_focus}) excluded for profiles <= 4."
```

**Verificado con tests:**
```
test_option_b_blocks_conservative_profiles[3]  PASS
test_option_b_blocks_conservative_profiles[4]  PASS
test_option_b_produces_correct_policy_profiles  PASS — result=[5..10]
test_option_b_sector_focus_healthcare_p5_allowed  PASS (no colisión con regla L69)
```

| Pros | Contras |
|---|---|
| ✅ NO requiere cambiar `suitability_engine.py` | Mezcla semántica: usar `is_sector_fund` para commodities |
| ✅ Funciona HOY con el engine actual | `sector_focus` no tiene enum validado en Firestore |
| ✅ Solo requiere write gate de clasificación | Requiere write gate para los 14 ISINs |
| ✅ Testeado y verificado | Semánticamente menos preciso que Opción A |
| ✅ Resultado correcto: [5..10] | — |

---

### Opción C — Campo `suitability_flags`

**Implementación:** `classification_v2.suitability_flags = ["COMMODITIES_CONCENTRATED"]`

| Pros | Contras |
|---|---|
| Flexible y extensible | Requiere cambiar engine para leer el nuevo campo |
| No mezcla semántica de `is_sector_fund` | Más invasivo que Opción B |

**Conclusión:** descartada a corto plazo. Válida si se rediseña el engine.

---

### Opción D — Lista manual HOLD en el dry-run script

**Implementación:** hardcodear los 14 ISINs como exclusión permanente en el script.

| Pros | Contras |
|---|---|
| Sin writes, sin engine changes | FRAGIL: no escala, requiere mantenimiento manual |
| Rápido | Si se ejecuta migrate_suitability_v2.py sin la lista, se sobreescribiría |
| — | No resuelve la causa raíz — el engine sigue mal |

**Conclusión:** DESCARTADA. No es una solución permanente.

---

## E. Recomendación

### Corto plazo: Opción B — Write gate de clasificación

1. **Crear:** `BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-GATE-0`  
   - Generar snapshot, diff, rollback para los 14 ISINs.  
   - Escribir SOLO: `classification_v2.is_sector_fund = true` y `classification_v2.sector_focus = "COMMODITIES"` (o categoría específica por fondo).  
   - Después del write, el dry-run de `compatible_profiles` mostrará 0 STALE para estos 14 fondos.

2. **Verificar:** re-ejecutar `bdb_compatible_profiles_regen_dry_run.py` — los 14 fondos deben aparecer MATCH.

3. **Tests:** `TestOptionBClassificationFix` — ya pasan, son el guard de regresión.

### Medio plazo: Opción A — Regla semántica en el engine

Más correcto semánticamente. Requiere:
- Añadir regla en `suitability_engine.py`.
- Escribir `classification_v2.suitability_theme` en Firestore.
- Tests en `TestFutureContractOptionA` — convertir de xfail a PASS.

### Regla definitiva: NUNCA depender de lista manual (Opción D)

> [!WARNING]
> Opción D (hardcodear ISINs) es técnicamente peligrosa porque no escala y no impide que el engine los marque STALE en futuros dry-runs.

---

## F. Tests de Diseño Creados

**Archivo:** `functions_python/tests/test_suitability_thematic_commodities_contract.py`

| Clase | Tests | Resultado | Propósito |
|---|---|---|---|
| `TestCurrentEngineGapDocumented` | 6 | ✅ 6 PASS | Documenta el gap: engine computa [3..10] — incorrecto |
| `TestOptionBClassificationFix` | 12 | ✅ 12 PASS | Verifica Opción B con engine actual |
| `TestFutureContractOptionA` | 4 | 3 XFAIL + 1 PASS | Contrato futuro Option A — activar tras implementación |
| **TOTAL** | **22** | **19 PASS + 3 XFAIL** | — |

```
======================== 19 passed, 3 xfailed in 0.17s ========================
```

### Qué protege cada grupo

| Grupo | Protege |
|---|---|
| `TestCurrentEngineGapDocumented` | Confirma que el gap existe y que el stored [5..10] es correcto |
| `TestOptionBClassificationFix` | Garantía de regresión para Option B una vez aplicada |
| `TestFutureContractOptionA::test_option_a_p5_to_p10_must_still_be_allowed` | p5-p10 siempre permitidos — invariante permanente |
| `TestFutureContractOptionA` (xfail) | Documenta el contrato de Option A — se activa como guard al implementar |

---

## G. Impacto Frontend

El frontend usa `compatible_profiles` como atajo (no recomputa suitability en runtime para este campo). Por tanto:

1. **Mientras no se ejecute Opción B:** `compatible_profiles` de los 14 fondos ya contiene `[5..10]` — correcto. El frontend no los muestra para p3/p4. ✅
2. **Tras Opción B (write gate de clasificación):** `compatible_profiles` se regenerará y el dry-run confirmará MATCH. ✅
3. **Si se implementa Opción A:** el frontend debe verificar paridad `isFundSuitableForProfile()` para el nuevo caso `suitability_theme`. Un test de parity en `rulesEngine.suitability.test.ts` sería necesario.

---

## H. Próximos Bloques Recomendados

| Prioridad | Bloque | Tipo | Urgencia |
|---|---|---|---|
| 1 | `BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-GATE-0` | Write gate de clasificación — Opción B | **Alta** — antes de cualquier regeneración masiva |
| 2 | `BDB-SUITABILITY-THEMATIC-COMMODITIES-IMPLEMENT-GATE-0` | Implementar Opción A en engine | Media — semántica completa |
| 3 | `BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-DECISION-0` | Divergencia frontend FE-9 | Media — independiente |
| 4 | `BDB-SUITABILITY-RULES-SOURCE-OF-TRUTH-DESIGN-0` | Migración reglas a configuración dinámica | Baja — deuda técnica |

> [!IMPORTANT]
> El bloque `BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-GATE-0` es el más eficiente: corrige los 14 fondos sin tocar el engine, usando infraestructura ya probada (snapshot, diff, rollback, write controlled). Una vez ejecutado, `compatible_profiles` de los 14 fondos quedará MATCH en el próximo dry-run.

---

## I. Confirmaciones

| Confirmación | Estado |
|---|---|
| Firestore writes en este bloque | ✅ **CERO** |
| Deploy ejecutado | ✅ **NO** |
| `suitability_engine.py` modificado | ✅ **NO** |
| `optimizer_core.py` modificado | ✅ **NO** |
| BDB-FONDOS-CORE tocado | ✅ **NO** |
| `migrate_suitability_v2.py` ejecutado | ✅ **NO** |
| `firestore.rules` modificado | ✅ **NO** |
| Scripts históricos de write reejecutados | ✅ **NO** |
| Frontend runtime modificado | ✅ **NO** |

---

## Appendix — Engine Rules Relevantes

```python
# suitability_engine.py — reglas que afectan al análisis

# L29: sector fund detection
is_sector_fund = bool(class_v2.get("is_sector_fund")) or str(asset_subtype or "").startswith("SECTOR_EQUITY_")

# L32: real equity exposure
real_eq = float(exposure.get("equity", 0.0) or 0.0)

# L56-59: equity caps (no se activan con real_eq=0.0)
if risk_profile == 3 and real_eq > 45:  # 0.0 <= 45 → False
if risk_profile == 4 and real_eq > 60:  # 0.0 <= 60 → False

# L61: SECTOR FUND EXCLUSION (la clave de Option B)
if is_sector_fund:
    return False, f"Sector funds ({sector_focus}) excluded for profiles <= 4."

# L64: SUBTYPE EXCLUSION (no cubre THEMATIC_EQUITY)
if asset_subtype in {"EMERGING_MARKETS_EQUITY", "HIGH_YIELD_BOND"} or asset_type == "commodities":
    return False, ...

# GAP: No existe regla para THEMATIC_EQUITY + gold/mining/precious_metals
```
