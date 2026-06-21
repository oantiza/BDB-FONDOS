# BDB-COMPATIBLE-PROFILES-VERIFY-SECTOR-EQUITY-0
## Informe Final — Verificación y Decisión sobre Fondos Gold/Mining/Metales Preciosos

**Bloque:** `BDB-COMPATIBLE-PROFILES-VERIFY-SECTOR-EQUITY-0`  
**Fecha:** 2026-05-11  
**Base commit:** `98e2143` (BDB-COMPATIBLE-PROFILES-REGEN-DRYRUN-0)  
**Modo:** Read-only — 0 writes Firestore — 0 deploy — 0 código productivo modificado  
**Tipo de bloque:** Verificación + Decisión humana aplicada

---

## A. Resumen Ejecutivo

| Dimensión | Resultado |
|---|---|
| Fondos revisados | **14** |
| HOLD_DO_NOT_ADD_P3_P4 | **14** (100%) |
| Safe to regen | **0** |
| Needs manual review | **0** |
| Discrepancia 13 vs 14 | **Resuelta — son 14** |
| Human decision applied | ✅ SÍ |
| write_executed | ✅ **false** |
| Resultado global | ✅ **CERRADO — HOLD aplicado a los 14 fondos** |

Los 14 fondos EQUITY STALE identificados en el bloque anterior son fondos de **oro, minería y metales preciosos**. Por decisión del usuario/product owner, **NO deben ganar los perfiles 3 ni 4**. Los valores actuales de `compatible_profiles = [5,6,7,8,9,10]` son correctos desde la perspectiva del producto, y deben mantenerse.

---

## B. Confirmación de Decisión Humana

**Decisión:** `ALL_LISTED_FUNDS_ARE_COMMODITIES_PRECIOUS_METALS_DO_NOT_ADD_P3_P4`

El usuario confirma que todos los 14 fondos son fondos temáticos de materias primas (oro, minería, metales preciosos). Por política de suitability de producto:

- **No son aptos para perfiles conservadores (3 y 4).**
- Los `compatible_profiles` actuales `[5,6,7,8,9,10]` son **correctos**.
- La diferencia detectada en el dry-run no es un error de datos — es un **gap del engine** (ver sección D).

---

## C. Tabla de los 14 Fondos — HOLD_DO_NOT_ADD_P3_P4

| ISIN | Nombre | Stored | Computed (engine) | Decisión |
|---|---|---|---|---|
| IE00BYVJR916 | Jupiter Gold & Silver Fund L EUR Acc | [5..10] | [3..10] | **HOLD** |
| LU0090845842 | BGF World Mining Fund E2 | [5..10] | [3..10] | **HOLD** |
| LU0171306680 | BGF World Gold Fund E2 (EUR) | [5..10] | [3..10] | **HOLD** |
| LU0172157280 | BGF World Mining Fund A2 (EUR) | [5..10] | [3..10] | **HOLD** |
| LU0172157363 | BGF World Mining Fund E2 (EUR) | [5..10] | [3..10] | **HOLD** |
| LU0273148055 | DWS Gold and Precious Metals Equities NC | [5..10] | [3..10] | **HOLD** |
| LU0273159177 | DWS Gold and Precious Metals Equities LC | [5..10] | [3..10] | **HOLD** |
| LU0326425351 | BGF World Mining Fund E2 EUR Hedged | [5..10] | [3..10] | **HOLD** |
| LU0496368142 | Franklin Gold & Precious Metals A(acc)EUR-H1 | [5..10] | [3..10] | **HOLD** |
| LU0496369389 | Franklin Gold & Precious Metals N(acc)EUR | [5..10] | [3..10] | **HOLD** |
| LU0604766674 | Allianz Global Metals and Mining AT EUR | [5..10] | [3..10] | **HOLD** |
| LU1223083087 | Schroder ISF Global Gold A EUR Hedged | [5..10] | [3..10] | **HOLD** |
| LU1223084051 | Schroder ISF Global Gold A PLN Hedged | [5..10] | [3..10] | **HOLD** |
| LU1578889864 | Ninety One GSF Global Gold Fund A EUR Hedged | [5..10] | [3..10] | **HOLD** |

---

## D. Causa Raíz — Gap del Engine (No Error de Datos)

### D.1 Por qué el dry-run los marcó como STALE

El engine de suitability actual (`suitability_engine.py`) evalúa la elegibilidad para p3-p4 basándose en:

- `real_eq > 45%` → bloqueo p3
- `real_eq > 60%` → bloqueo p4
- `is_sector_fund = True` → bloqueo p≤4
- `risk_bucket = HIGH` + `asset_type ≠ equity` → bloqueo p≤4

Para los 14 fondos de metales preciosos:

```
asset_subtype = THEMATIC_EQUITY
economic_exposure.equity = 0.0   ← el engine lee 0% de RV real
is_sector_fund = False (o ausente)
risk_bucket = no "HIGH"
```

Con `real_eq = 0%`, **ninguna regla de exclusión se activa**. El engine los clasifica como elegibles para p3 y p4 por omisión.

### D.2 ¿Por qué `economic_exposure.equity = 0.0`?

Los fondos de oro/minería/metales invierten en **acciones de empresas mineras**, pero su exposición económica real no está clasificada como renta variable pura — o bien el campo no está poblado, o bien el valor es literalmente 0.0. Esto es un caso de **lookthrough incompleto para fondos temáticos de materias primas**.

### D.3 ¿Por qué `is_sector_fund = False`?

El campo `is_sector_fund` fue diseñado para fondos sectoriales del tipo technology/healthcare/energy. Los fondos de metales preciosos no tienen `SECTOR_EQUITY_*` como subtype — usan `THEMATIC_EQUITY`, que el engine no mapea a la categoría sectorial que bloquea p≤4.

### D.4 Implicación: el valor almacenado [5..10] es correcto

El `compatible_profiles = [5,6,7,8,9,10]` fue calculado con una versión del engine o lógica que sí excluía p3-p4 para este tipo de fondos (posiblemente vía `is_sector_fund=True` o un criterio diferente). El valor almacenado refleja la **intención correcta de producto**. El engine actual tiene un gap respecto a ese comportamiento.

---

## E. Implicaciones para el Futuro Write Gate

### E.1 Fondos EXCLUIDOS del write gate

Los 14 fondos HOLD **no deben incluirse en ningún write gate de regeneración** que añada p3 o p4. Sus `compatible_profiles` actuales se mantienen tal cual.

### E.2 Fondos restantes tras aplicar HOLD

Tras retirar los 14 HOLD del universo stale de 24, quedan **10 fondos** candidatos para un futuro write gate:

| ISIN | Tipo | Cambio | Riesgo |
|---|---|---|---|
| ES0118537002 | MIXED | +p3 | 🟡 Medio |
| ES0162946034 | MIXED | +p3 | 🟡 Medio |
| FR0010306142 | MIXED (Carmignac) | +p3 | 🟡 Medio |
| LU0119195963 | MIXED | +p3 | 🟡 Medio |
| LU0404220724 | MIXED | +p3 | 🟡 Medio |
| LU1095739733 | MIXED | **-p4** | 🔴 **Alto** — require validación manual |
| LU1697017256 | MIXED | +p3 | 🟡 Medio |
| LU1883330521 | MIXED | **-p1,-p2** | 🔴 **Alto** — requiere validación manual |
| LU1883334275 | FIXED_INCOME | +p3,+p4 | 🟡 Medio |
| LU1894680757 | MIXED | +p3 | 🟡 Medio |

> Los 2 casos con remoción de perfiles (LU1095739733, LU1883330521) requieren validación manual de los valores de `economic_exposure` y `risk_bucket` antes de incluirlos en cualquier write gate.

### E.3 Bloque posterior recomendado para clasificación semántica

Los 14 fondos de metales preciosos deberán tratarse en un bloque independiente:

**`BDB-SUITABILITY-THEMATIC-EQUITY-COMMODITIES-RULE-0`**

Opciones de resolución:
- A) Añadir `is_sector_fund = True` y `sector_focus = PRECIOUS_METALS` en `classification_v2` de estos 14 fondos → el engine los bloquea automáticamente para p≤4.
- B) Añadir `asset_subtype = SECTOR_EQUITY_PRECIOUS_METALS` → misma detección automática.
- C) Añadir regla explícita en el engine para `THEMATIC_EQUITY` + exposure commodity.

**La opción A o B requieren un write gate de clasificación** (no de compatible_profiles). La opción C requiere modificar `suitability_engine.py` y sus tests de contrato.

---

## F. Discrepancia 13 vs 14 — Resuelta

El documento `docs/BDB_COMPATIBLE_PROFILES_REGEN_DRYRUN_0.md` mencionó "13 fondos" en el texto narrativo de la sección D.3, pero la tabla en esa misma sección listaba 14 ISINs — y el artifact JSON contenía 14.

**Resolución:** El artifact JSON (`compatible_profiles_regen_dry_run_0.json`) es la fuente de verdad. **Son 14 fondos.** El "13" fue un error tipográfico en el texto narrativo del documento.

Cross-reference automático ejecutado en este bloque:
```
User-provided ISINs: 14
Artifact STALE EQUITY ISINs: 14
Intersection: 14/14 (100% match)
Extra in artifact but not in user list: 0
Missing from artifact that user provided: 0
```

---

## G. Tests Ejecutados

```
Comando: .\functions_python\venv\Scripts\python.exe -m pytest
  functions_python\tests\test_suitability_contract_parity.py
  functions_python\tests\test_suitability_v2.py
  -v --tb=short

Resultado: 85/85 PASS · 0 FAIL · 0 ERROR
Duración: 0.14s
```

| Suite | Tests | Resultado |
|---|---|---|
| `test_suitability_contract_parity.py` | 38 | ✅ 38/38 |
| `test_suitability_v2.py` | 47 | ✅ 47/47 |
| **TOTAL** | **85** | **✅ 85/85** |

---

## H. Confirmaciones

| Confirmación | Estado |
|---|---|
| Firestore writes ejecutados | ✅ **CERO** |
| Deploy ejecutado | ✅ **NO** |
| BDB-FONDOS-CORE tocado | ✅ **NO** |
| `optimizer_core.py` modificado | ✅ **NO** |
| `suitability_engine.py` modificado | ✅ **NO** |
| `migrate_suitability_v2.py` ejecutado | ✅ **NO** |
| `firestore.rules` modificado | ✅ **NO** |
| Lógica productiva modificada | ✅ **NINGUNA** |
| Scripts de write históricos reeejecutados | ✅ **NO** |
| `write_executed` en artifact | ✅ **false** |

---

## I. Archivos de Este Bloque

| Archivo | Tipo | Acción |
|---|---|---|
| `artifacts/suitability/compatible_profiles_sector_equity_verify_0.json` | Artifact JSON | NEW |
| `docs/BDB_COMPATIBLE_PROFILES_VERIFY_SECTOR_EQUITY_0.md` | Este documento | NEW |

---

## J. Próximos Bloques

### Inmediato (si se quiere proceder con write gate):
**`BDB-COMPATIBLE-PROFILES-REGEN-WRITE-GATE-0`**  
Write gate para los 10 fondos restantes (excluidos HOLD + Hamco). Requiere validación previa manual de LU1883330521 y LU1095739733.

### Clasificación semántica (independiente):
**`BDB-SUITABILITY-THEMATIC-EQUITY-COMMODITIES-RULE-0`**  
Corregir clasificación de los 14 fondos gold/mining para que el engine los detecte correctamente como fuera de p3-p4. Necesita decisión de implementación (datos vs. regla).

### Paralelo posible:
**`BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-DECISION-0`**  
Resolver la divergencia FE-9 `lowQualityCredit >= 35%`. No depende de los bloques anteriores.
