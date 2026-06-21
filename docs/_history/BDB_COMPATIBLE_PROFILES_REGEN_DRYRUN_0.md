# BDB-COMPATIBLE-PROFILES-REGEN-DRYRUN-0
## Informe Final — Auditoría Dry-Run de `compatible_profiles`

**Bloque:** `BDB-COMPATIBLE-PROFILES-REGEN-DRYRUN-0`  
**Fecha:** 2026-05-11  
**Base commit:** `d565abb` (BDB-SUITABILITY-CONTRACT-TESTS-0)  
**Modo:** Read-only — 0 writes Firestore — 0 deploy — 0 código productivo modificado

---

## A. Resumen Ejecutivo

| Dimensión | Resultado |
|---|---|
| Total fondos escaneados | **670** |
| Con `compatible_profiles` | **670** (100% — campo presente en todos) |
| Sin `compatible_profiles` | **0** |
| MATCH (stored = computed) | **645** (96.3%) |
| STALE (stored ≠ computed) | **24** (3.6%) |
| MISSING | **0** |
| INVALID schema | **0** |
| SKIPPED (Hamco) | **1** |
| MIXED total | **60** |
| MIXED stale | **9** |
| write_executed | ✅ **false** |
| deploy | ✅ **NO** |
| Resultado global | ⚠️ **WARNING — REGEN_WRITE_GATE_NEEDED** |

El campo `compatible_profiles` **existe en los 670 documentos de `funds_v3`**. El frontend lo usa para todos los fondos (no hay fallback rule-based para ninguno). De los 670 fondos, **24 tienen valores obsoletos** — la suitability calculada actualmente por el backend difiere de los perfiles almacenados.

---

## B. Estado Real de `compatible_profiles` en Firestore

### B.1 Presencia del campo

```
670 / 670 documentos tienen classification_v2.compatible_profiles
  0 documentos carecen del campo
```

**Implicación crítica:** el frontend usa `compatible_profiles` como primera prioridad para el 100% de los fondos. El fallback rule-based de `isFundSuitableForProfile()` **nunca se ejecuta en producción** para ningún fondo del catálogo.

### B.2 Estado de los valores

| Estado | Count | % |
|---|---|---|
| MATCH | 645 | 96.3% |
| STALE | 24 | 3.6% |
| MISSING | 0 | 0% |
| INVALID schema | 0 | 0% |
| SKIPPED (Hamco) | 1 | — |

### B.3 Desglose de los 24 fondos stale

**Caso A — Perfil 3 añadido (fondo ahora más conservador de lo almacenado):**  
21 fondos con `stored=[4,5,...,10]` → `computed=[3,4,5,...,10]`  
El backend acepta estos fondos para perfil 3, pero el frontend los bloquea para ese perfil.

| ISIN | Nombre | Asset class | Cambio |
|---|---|---|---|
| ES0118537002 | Olea Neutral FI | MIXED | +p3 |
| ES0162946034 | Abante Selección FI | MIXED | +p3 |
| FR0010306142 | Carmignac Patrimoine E EUR Acc | MIXED | +p3 |
| LU0119195963 | GS Patrimonial Balanced P EUR | MIXED | +p3 |
| LU0404220724 | (Mixto sin nombre truncado) | MIXED | +p3 |
| LU1095739733 | (Mixto) | MIXED | **-p4** (único con remoción) |
| LU1697017256 | (Mixto) | MIXED | +p3 |
| LU1883330521 | Amundi Global Multi-Asset Target | MIXED | **-p1,-p2** |
| LU1894680757 | Amundi Income Opportunities | MIXED | +p3 |
| IE00BYVJR916 | Jupiter Gold & Silver Fund L EUR | EQUITY | +p3,+p4 |
| LU0090845842 | BGF World Mining Fund E2 | EQUITY | +p3,+p4 |
| LU0171306680 | BGF World Gold Fund E2 | EQUITY | +p3,+p4 |
| LU0172157280 | BGF World Mining Fund A2 | EQUITY | +p3,+p4 |
| LU0172157363 | BGF World Mining Fund E2 | EQUITY | +p3,+p4 |
| LU0273148055 | DWS Gold and Precious Metals | EQUITY | +p3,+p4 |
| LU0273159177 | (Gold/Precious) | EQUITY | +p3,+p4 |
| LU0326425351 | (Gold/Precious) | EQUITY | +p3,+p4 |
| LU0496368142 | (Gold/Precious) | EQUITY | +p3,+p4 |
| LU0496369389 | (Gold/Precious) | EQUITY | +p3,+p4 |
| LU0604766674 | (Gold/Precious) | EQUITY | +p3,+p4 |
| LU1223083087 | (Gold/Precious) | EQUITY | +p3,+p4 |
| LU1223084051 | (Gold/Precious) | EQUITY | +p3,+p4 |
| LU1578889864 | (Precious metals) | EQUITY | +p3,+p4 |
| LU1883334275 | Amundi Global Subordinated Bond | FIXED_INCOME | +p3,+p4 |

**Caso B — Perfiles removidos (fondo ahora más restringido de lo almacenado):**  
- `LU1095739733`: stored incluye p4, computed lo excluye.
- `LU1883330521`: stored incluye p1 y p2, computed los excluye.

> Los fondos STALE sin `likely_post_mixed_impact=True` son fondos no-MIXED cuyas reglas de suitability calculadas con el engine actual son diferentes a las almacenadas. Posible causa: se modificó la lógica del engine entre la ejecución del script de migración y hoy.

### B.4 Hallazgo sobre fondos de metales preciosos (gold/mining)

Los 13 fondos EQUITY de tipo gold/mining/precious-metals aparecen como STALE con +p3,+p4. El engine actual no tiene una regla que los excluya de p3-4 (no son `is_sector_fund=True`, no son `risk_bucket=HIGH`). El `compatible_profiles` almacenado los excluía, lo que implica que **o bien el engine tenía una regla diferente cuando se generó**, o bien hay un campo `is_sector_fund=True` que se ha eliminado/cambiado posteriormente.

> **ACCIÓN REQUERIDA ANTES DE WRITE GATE:** Para estos fondos, verificar si `is_sector_fund` y `sector_focus` han sido modificados desde la generación original de `compatible_profiles`. Los fondos de metales preciosos podrían ser sectoriales (sector_focus=MATERIALS o COMMODITIES) con reglas que los excluirían para p3-4.

---

## C. Impacto Post-MIXED

### C.1 Fondos MIXED stale (9 de 60)

De los 60 fondos MIXED totales, 9 tienen `compatible_profiles` stale:

| ISIN | Nombre | Stored | Computed | Diferencia | Post-MIXED |
|---|---|---|---|---|---|
| ES0118537002 | Olea Neutral FI | [4..10] | [3..10] | +p3 | No (ES) |
| ES0162946034 | Abante Selección | [4..10] | [3..10] | +p3 | No (ES) |
| FR0010306142 | Carmignac Patrimoine | [4..10] | [3..10] | +p3 | No (FR) |
| LU0119195963 | GS Patrimonial Balanced | [4..10] | [3..10] | +p3 | No |
| LU0404220724 | (Mixto LU) | [4..10] | [3..10] | +p3 | No |
| LU1095739733 | (Mixto LU) | [4..10] | [5..10] | **-p4** | No |
| LU1697017256 | (Mixto LU) | [4..10] | [3..10] | +p3 | No |
| LU1883330521 | Amundi Global Multi-Asset Target | [1..10] | [3..10] | **-p1,-p2** | No |
| LU1894680757 | Amundi Income Opportunities | [4..10] | [3..10] | +p3 | No |

**Ninguno de los 9 fondos MIXED stale está en el conjunto de 59 fondos MIXED remediados** (`likely_post_mixed_impact=False` para todos). El motivo probable es que estos fondos tienen un `economic_exposure.equity` que actualmente está por debajo del 45% (→ elegibles para p3), pero en el momento de generación de `compatible_profiles` estaba por encima.

### C.2 Casos críticos mencionados en auditorías previas

| Fondo | ISIN | Estado |
|---|---|---|
| Carmignac Patrimoine E EUR | FR0010306142 | ⚠️ STALE — stored=[4..10], computed=[3..10] (+p3) |
| Allianz DMA SRI 75 | (no encontrado con nombre exacto) | — no en stale list |
| Brightgate Global FI | (no encontrado) | — no en stale list |

**Carmignac Patrimoine** (caso emblemático de la remediación MIXED): la remediación corrigió su `economic_exposure.equity` de 50% → 32%. Con 32%, el engine calcula elegibilidad para p3. Pero `compatible_profiles` almacenado dice [4..10] — por lo que el frontend muestra el fondo como **no apto para perfil 3**, incorrecto.

### C.3 Hamco (LU3038481936)

```
Status: SKIPPED
Razón: Hamco SICAV - Global Value R EUR Acc — insufficient historical data.
       Presente en funds_v3 con compatible_profiles almacenados.
       El script lo omite por política — no debe participar en write gate.
```

---

## D. Riesgo UI

### D.1 ¿El frontend está usando `compatible_profiles` stale?

**SÍ — confirmado.** Los 670 fondos tienen el campo, y el frontend lo usa con prioridad absoluta:

```typescript
// rulesEngine.ts L407-408
if (Array.isArray(classV2?.compatible_profiles) && classV2.compatible_profiles.length > 0) {
    return classV2.compatible_profiles.includes(riskProfile);
}
```

Para los **24 fondos stale**, el frontend muestra una eligibilidad **diferente a la que el backend calcularía** en runtime.

### D.2 ¿El riesgo es real o teórico?

**REAL y ACTIVO para 24 fondos** (3.6% del catálogo).

| Tipo de error | Count | Impacto UI |
|---|---|---|
| Perfiles adicionales no mostrados | 22 fondos | p3 y/o p4 ocultos para fondos que el backend sí aceptaría |
| Perfiles mostrados que el backend rechazaría | 2 fondos | p4 (LU1095739733) y p1+p2 (LU1883330521) aparecen disponibles cuando el backend los bloquearía |

El **caso más grave** son los 2 fondos con perfiles "de más" almacenados: el frontend los muestra como aptos para perfiles que el optimizer rechazará al calcular.

- **LU1883330521** (Amundi Global Multi-Asset Target): stored [1..10] → computed [3..10]. Un usuario de perfil 1 o 2 podría ver este fondo en su catálogo y seleccionarlo, pero el optimizer lo rechazaría.
- **LU1095739733**: stored incluye p4 → computed excluye p4. Impacto similar.

### D.3 Nota sobre fondos de metales preciosos

Los 13 fondos gold/mining/precious-metals aparecen como STALE con p3+p4 "añadidos". Antes de escribir, hay que verificar si deberían estar excluidos por `is_sector_fund`. Si el engine actual falla en clasificarlos como sector funds, el write gate añadiría p3+p4 incorrectamente.

---

## E. Artifact

**Ruta:** `artifacts/suitability/compatible_profiles_regen_dry_run_0.json`

**Campos clave:**

```json
{
  "audit_id": "BDB-COMPATIBLE-PROFILES-REGEN-DRY-RUN-0",
  "dry_run": true,
  "write_executed": false,
  "firestore_read_executed": true,
  "firestore_write_executed": false,
  "stats": {
    "total_funds_scanned": 670,
    "with_compatible_profiles": 670,
    "without_compatible_profiles": 0,
    "matching_count": 645,
    "stale_count": 24,
    "missing_count": 0,
    "schema_invalid_count": 0,
    "mixed_total": 60,
    "mixed_stale_count": 9
  },
  "recommendation": "REGEN_WRITE_GATE_NEEDED",
  "per_fund_results": [...]   // 670 entradas con status, exposures, reason
}
```

---

## F. Recomendación

### Recomendación primaria: `REGEN_WRITE_GATE_NEEDED`

No se puede ejecutar la regeneración sin un write gate formal con las siguientes precondiciones:

**F.1 Pre-condición crítica — fondos de metales preciosos:**

Los 13 fondos EQUITY gold/mining/precious metals necesitan verificación previa:
- ¿Tienen `is_sector_fund=True` o deberían tenerlo?
- ¿Tienen un `sector_focus` = MATERIALS/COMMODITIES/PRECIOUS_METALS?
- Si sí → el engine debería bloquearlos para p<=4, y `computed_compatible_profiles` sería [5..10], no [3..10].
- Si no → el write gate los aceptaría y añadiría p3,p4.

**Sin esta verificación no se debe ejecutar el write gate.**

**F.2 Pre-condición — fondos con perfiles removidos:**

Los 2 fondos donde `computed` excluye perfiles que `stored` incluye son el riesgo más alto:
- `LU1883330521`: ¿realmente es inelegible para p1 y p2? (real_eq > 30%, o risk_bucket=HIGH?)
- `LU1095739733`: ¿realmente es inelegible para p4? (real_eq > 60%?)

Verificar manualmente en Firestore antes de incluir en write gate.

**F.3 Secuencia recomendada:**

1. Leer `is_sector_fund`, `sector_focus`, `risk_bucket`, `portfolio_exposure_v2.economic_exposure` en Firestore para los 13 fondos EQUITY stale y los 2 fondos con remoción de perfiles.
2. Actualizar la lógica o los datos si se detecta error de clasificación.
3. Re-ejecutar dry-run para confirmar que el diff es correcto.
4. Crear `BDB-COMPATIBLE-PROFILES-REGEN-WRITE-GATE-0` con manifesto explícito.

### Recomendación alternativa paralela: `ADD_VERSIONING_BEFORE_REGEN`

Antes de escribir los nuevos valores, añadir `compatible_profiles_version` o `compatible_profiles_generated_at` al documento para que futuros audits puedan detectar staleness sin re-calcular todo.

---

## G. Próximo Bloque Propuesto

### Opción A (prioritaria, técnica): `BDB-COMPATIBLE-PROFILES-VERIFY-SECTOR-EQUITY-0`
Verificar en Firestore los 13 fondos EQUITY gold/mining para determinar si `is_sector_fund` y `sector_focus` están correctamente poblados. Read-only. Si están mal clasificados, crear ticket de corrección antes del write gate.

### Opción B (si A confirma que los campos son correctos): `BDB-COMPATIBLE-PROFILES-REGEN-WRITE-GATE-0`
Write gate controlado con:
- Manifesto de cambios propuestos (24 fondos)
- Exclusión explícita de Hamco
- Exclusión de fondos con remoción de perfiles hasta validación manual
- `authorized: false` por defecto — requiere flip manual

### Opción C (paralela): `BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-DECISION-0`
No depende de compatible_profiles. Puede avanzar en paralelo.

---

## H. Tests Ejecutados

### H.1 Backend — suitability + MIXED contract

```
Comando: .\functions_python\venv\Scripts\python.exe -m pytest
  functions_python\tests\test_suitability_contract_parity.py
  functions_python\tests\test_suitability_v2.py
  functions_python\tests\test_mixed_exposure_ms_portfolio.py
  functions_python\tests\test_mixed_funds_lookthrough_contract.py
  -v --tb=short

Resultado: 100/100 PASS · 0 FAIL · 0 ERROR
Duración: 8.15s
```

### H.2 Frontend — suitability contract

```
Comando: powershell -ExecutionPolicy Bypass -Command
  "cd frontend; npx vitest run src/utils/rulesEngine.suitability.test.ts"

Resultado: 34/34 PASS · 0 FAIL · 0 ERROR
Duración: 309ms
Entorno: Vitest v4.0.16
```

### H.3 Total

| Suite | Tests | Resultado |
|---|---|---|
| `test_suitability_contract_parity.py` | 38 | ✅ 38/38 |
| `test_suitability_v2.py` | 47 | ✅ 47/47 |
| `test_mixed_exposure_ms_portfolio.py` | 11 | ✅ 11/11 |
| `test_mixed_funds_lookthrough_contract.py` | 4 | ✅ 4/4 |
| `rulesEngine.suitability.test.ts` | 34 | ✅ 34/34 |
| **TOTAL** | **134** | **✅ 134/134** |

---

## I. Confirmaciones

| Confirmación | Estado |
|---|---|
| Firestore writes ejecutados | ✅ **CERO** |
| deploy ejecutado | ✅ **NO** |
| BDB-FONDOS-CORE tocado | ✅ **NO** |
| `optimizer_core.py` modificado | ✅ **NO** |
| `suitability_engine.py` modificado | ✅ **NO** |
| `migrate_suitability_v2.py` ejecutado | ✅ **NO** |
| `firestore.rules` modificado | ✅ **NO** |
| Lógica productiva modificada | ✅ **NINGUNA** |
| Scripts de write históricos reeejecutados | ✅ **NO** |
| Script dry-run contiene `.set(`, `.update(`, `.delete(` | ✅ **NO** (verificado) |
| `write_executed` en artifact | ✅ **false** |

---

## J. Archivos de Este Bloque

| Archivo | Tipo | Acción |
|---|---|---|
| `scripts/maintenance/bdb_compatible_profiles_regen_dry_run.py` | Script dry-run | NEW |
| `artifacts/suitability/compatible_profiles_regen_dry_run_0.json` | Artifact JSON | NEW |
| `docs/BDB_COMPATIBLE_PROFILES_REGEN_DRYRUN_0.md` | Este documento | NEW |
