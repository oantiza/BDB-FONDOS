# BDB-COMPATIBLE-PROFILES-VERIFY-REMOVALS-0
## Informe Final — Verificación de Candidatos a Remoción de Perfiles

**Bloque:** `BDB-COMPATIBLE-PROFILES-VERIFY-REMOVALS-0`  
**Fecha:** 2026-05-11  
**Base commit:** `11d18e9` (BDB-COMPATIBLE-PROFILES-VERIFY-SECTOR-EQUITY-0)  
**Modo:** Read-only — 0 writes Firestore — 0 deploy — 0 código productivo modificado  
**Tipo:** Verificación con lectura live de Firestore (`funds_v3`)

---

## A. Resumen Ejecutivo

| Dimensión | Resultado |
|---|---|
| Fondos revisados | **2** |
| SAFE_TO_REGEN_REMOVE_PROFILES | **2** ✅ |
| HOLD_NEEDS_MANUAL_REVIEW | **0** |
| DO_NOT_CHANGE | **0** |
| Lectura live Firestore | ✅ Ejecutada — 0 writes |
| write_executed | ✅ **false** |
| Resultado global | ✅ **CERRADO — Ambos fondos son SAFE para write gate** |

Ambos casos críticos han sido verificados con datos en vivo de Firestore. Las remociones de perfiles son **matemáticamente correctas** y están justificadas por reglas hardcoded del engine de suitability. No hay riesgo de error semántico ni gap de clasificación (a diferencia del caso gold/mining). Ambos fondos pueden incluirse en el futuro write gate de regeneración.

---

## B. Tabla de los 2 Fondos

| ISIN | Nombre | Stored | Computed | Perfiles a remover | Regla que justifica | Recomendación |
|---|---|---|---|---|---|---|
| LU1883330521 | Amundi Global Multi-Asset Target Income A2 EUR | [1..10] | [3..10] | **p1, p2** | `equity=31.7% > 30%` (cap p1-p2) | ✅ SAFE_TO_REGEN |
| LU1095739733 | First Eagle Amundi Income Builder AE-QD | [4..10] | [5..10] | **p4** | `equity=61.9% > 60%` (cap p4) | ✅ SAFE_TO_REGEN |

---

## C. Análisis Individual

### C.1 LU1883330521 — Amundi Funds - Global Multi-Asset Target Income A2 EUR (C)

**Datos en vivo de Firestore (13:39 UTC, 2026-05-11):**

```
asset_class:         MIXED
subtype:             CONSERVATIVE_ALLOCATION
risk_bucket:         LOW
is_sector_fund:      False
ms_category:         Mixtos Defensivos USD
economic_exposure:   equity=31.7%  bond=50.5%  cash=10.9%
exposure_confidence: 0.85
```

**Stored `compatible_profiles`:** `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]`  
**Computed `compatible_profiles`:** `[3, 4, 5, 6, 7, 8, 9, 10]`  
**Perfiles a remover:** `[1, 2]`  
**Perfiles a añadir:** ninguno

**Análisis por perfil:**

| Perfil | Engine decision | Regla aplicada |
|---|---|---|
| p1 | ❌ BLOQUEADO | `risk_profile<=2 AND real_eq=31.7%>30%` → Hard exclusion |
| p2 | ❌ BLOQUEADO | `risk_profile<=2 AND real_eq=31.7%>30%` → Hard exclusion |
| p3 | ✅ ELEGIBLE | `real_eq=31.7%≤45%` pasa el cap de p3 |
| p4..10 | ✅ ELEGIBLE | Sin restricciones adicionales |

**¿La remoción está justificada?** ✅ SÍ

El fondo tiene **31.7% de exposición real a renta variable** confirmada por Morningstar (confidence=0.85). La regla hardcoded del engine establece que perfiles 1 y 2 no pueden contener fondos con más de 30% de renta variable real. El stored `[1..10]` fue generado en un momento en que o bien la exposición era distinta (≤30%) o la regla no existía. El valor actual sobreestima la elegibilidad para perfiles muy conservadores.

**Categoría Morningstar:** `Mixtos Defensivos USD` — confirma que es un fondo mixto defensivo, categoría adecuada para perfiles 3+ pero no para p1-p2 con 31.7% equity.

**Recomendación:** `SAFE_TO_REGEN_REMOVE_PROFILES` — incluir en write gate con actualización a `[3,4,5,6,7,8,9,10]`.

---

### C.2 LU1095739733 — First Eagle Amundi Income Builder Fund Class AE-QD Shares

**Datos en vivo de Firestore (13:39 UTC, 2026-05-11):**

```
asset_class:         MIXED
subtype:             MODERATE_ALLOCATION
risk_bucket:         MEDIUM
is_sector_fund:      False
ms_category:         Mixtos Moderados USD
economic_exposure:   equity=61.9%  bond=20.9%  cash=2.0%
exposure_confidence: 0.85
```

**Stored `compatible_profiles`:** `[4, 5, 6, 7, 8, 9, 10]`  
**Computed `compatible_profiles`:** `[5, 6, 7, 8, 9, 10]`  
**Perfiles a remover:** `[4]`  
**Perfiles a añadir:** ninguno

**Análisis por perfil:**

| Perfil | Engine decision | Regla aplicada |
|---|---|---|
| p1-p3 | ❌ BLOQUEADOS | `real_eq=61.9%` supera caps de p1-p3 (30%, 30%, 45%) |
| p4 | ❌ BLOQUEADO | `risk_profile==4 AND real_eq=61.9%>60%` → Hard exclusion |
| p5..10 | ✅ ELEGIBLE | Sin restricciones adicionales |

**¿La remoción está justificada?** ✅ SÍ

El fondo tiene **61.9% de exposición real a renta variable** (confidence=0.85). La regla hardcoded establece que el perfil 4 no puede contener fondos con más del 60% de renta variable real. La diferencia es marginal (1.9pp sobre el cap), pero la regla es una hard boundary sin tolerancia. El stored `[4..10]` fue generado cuando posiblemente la exposición era ≤60% (el fondo podría haber estado cerca del límite antes de la remediación MIXED) o el cap era diferente.

**Hipótesis pre-MIXED:** Es posible que antes de la remediación, este fondo reportaba ~58-60% de equity (dentro del cap), y tras la corrección MIXED quedó en 61.9% — justo por encima del límite. Este sería entonces un caso donde la remediación MIXED sí tiene impacto indirecto en `compatible_profiles`, aunque `likely_post_mixed_impact=False` en el artifact (el ISIN no estaba en la lista de los 59 remediados).

> **Nota:** aunque `likely_post_mixed_impact=False` en el artifact anterior, no puede descartarse que la exposición haya cambiado por actualización periódica de Morningstar independiente de la remediación MIXED. Lo relevante es que el valor actual (61.9%) supera el cap y la remoción de p4 es correcta.

**Categoría Morningstar:** `Mixtos Moderados USD` — confirma que es un fondo moderado, más adecuado para p5+ con 61.9% equity.

**Recomendación:** `SAFE_TO_REGEN_REMOVE_PROFILES` — incluir en write gate con actualización a `[5,6,7,8,9,10]`.

---

## D. Implicación para el Write Gate

### D.1 Universo final del write gate

| Grupo | Count | Acción |
|---|---|---|
| STALE originales | 24 | — |
| HOLD commodities/metales (bloques previos) | -14 | Excluidos permanentemente |
| LU1883330521 | 1 | ✅ SAFE → incluir |
| LU1095739733 | 1 | ✅ SAFE → incluir |
| Restantes MIXED/FI con +p3 | 8 | ✅ Candidatos (no revisados en este bloque) |
| Hamco LU3038481936 | 1 | Siempre excluido |

**Total candidatos para write gate:** **10 fondos** (2 removal + 8 MIXED/FI con adición de p3)

### D.2 Cambios propuestos para los 2 fondos verificados

| ISIN | Stored actual | Propuesto | Tipo de cambio |
|---|---|---|---|
| LU1883330521 | [1,2,3,4,5,6,7,8,9,10] | [3,4,5,6,7,8,9,10] | Remoción p1, p2 |
| LU1095739733 | [4,5,6,7,8,9,10] | [5,6,7,8,9,10] | Remoción p4 |

### D.3 Advertencia: remociones son más críticas que adiciones

Los fondos que añaden perfiles (los 8 MIXED/FI con +p3) son menos arriesgados: el peor caso es que un fondo que debería mostrarse para p3 no se muestre. Pero para los 2 fondos de remoción, el riesgo es inverso: **el frontend muestra el fondo como apto para perfiles que el backend rechazaría**. Esto puede derivar en propuestas de portfolios que el optimizer denegará.

> **Prioridad en el write gate:** Los 2 fondos de remoción deberían tener prioridad en el write gate porque su stale state genera inconsistencia activa entre frontend y backend.

---

## E. Riesgo UI

### E.1 Estado actual del frontend para estos fondos

El frontend usa `compatible_profiles` con prioridad absoluta. Con los valores actuales:

| Fondo | Perfil afectado | Riesgo UI activo |
|---|---|---|
| LU1883330521 | **p1 y p2** | ⚠️ **ACTIVO** — Un usuario de perfil muy conservador (1 o 2) puede ver este fondo en su catálogo. Si lo selecciona, el backend/optimizer lo rechazará. |
| LU1095739733 | **p4** | ⚠️ **ACTIVO** — Un usuario de perfil moderado-conservador (4) puede ver este fondo. El optimizer lo bloqueará al calcular. |

### E.2 Severidad

| Dimensión | LU1883330521 | LU1095739733 |
|---|---|---|
| Perfiles incorrectamente mostrados | p1, p2 | p4 |
| Gap equity vs. cap | 31.7% vs. 30.0% (+1.7pp) | 61.9% vs. 60.0% (+1.9pp) |
| Tipo de error | Fondo con +30% equity accesible a perfil MUY conservador | Fondo con +60% equity accesible a perfil moderado-conservador |
| Severidad | 🔴 **ALTA** — perfil muy conservador expuesto a >30% RV | 🟡 **MEDIA** — 1.9pp sobre límite |
| Acción recomendada | Write gate prioritario | Write gate recomendado |

### E.3 ¿Cuántos usuarios afectados?

No es posible determinarlo en este bloque (requeriría leer portfolios de usuario). Sin embargo, la mera presencia en el catálogo para esos perfiles es la inconsistencia a corregir.

---

## F. Tests Ejecutados

### F.1 Backend

```
Comando: .\functions_python\venv\Scripts\python.exe -m pytest
  functions_python\tests\test_suitability_contract_parity.py
  functions_python\tests\test_suitability_v2.py
  -v --tb=short

Resultado: 85/85 PASS · 0 FAIL · 0 ERROR
```

### F.2 Frontend

```
Comando: powershell -ExecutionPolicy Bypass -Command
  "cd frontend; npx vitest run src/utils/rulesEngine.suitability.test.ts"

Resultado: 34/34 PASS · 0 FAIL · 0 ERROR
```

### F.3 Script de verificación

```
Comando: .\functions_python\venv\Scripts\python.exe
  scripts\maintenance\bdb_compatible_profiles_verify_removals.py

Resultado: EXIT:0 — 2/2 fondos analizados, artifact generado
  LU1883330521: SAFE_TO_REGEN_REMOVE_PROFILES
  LU1095739733: SAFE_TO_REGEN_REMOVE_PROFILES
```

| Suite | Tests | Resultado |
|---|---|---|
| `test_suitability_contract_parity.py` | 38 | ✅ 38/38 |
| `test_suitability_v2.py` | 47 | ✅ 47/47 |
| `rulesEngine.suitability.test.ts` | 34 | ✅ 34/34 |
| Script `bdb_compatible_profiles_verify_removals.py` | — | ✅ EXIT:0 |
| **TOTAL TESTS** | **119** | **✅ 119/119** |

---

## G. Confirmaciones

| Confirmación | Estado |
|---|---|
| Firestore reads ejecutados | ✅ Solo lectura — 2 documentos |
| Firestore writes ejecutados | ✅ **CERO** |
| Deploy ejecutado | ✅ **NO** |
| BDB-FONDOS-CORE tocado | ✅ **NO** |
| `optimizer_core.py` modificado | ✅ **NO** |
| `suitability_engine.py` modificado | ✅ **NO** |
| `migrate_suitability_v2.py` ejecutado | ✅ **NO** |
| `firestore.rules` modificado | ✅ **NO** |
| Lógica productiva modificada | ✅ **NINGUNA** |
| Scripts de write históricos reejecutados | ✅ **NO** |
| `write_executed` en artifact | ✅ **false** |
| Script contiene `.set(`/`.update(`/`.delete(` en código | ✅ **NO** (solo en docstring) |

---

## H. Archivos de Este Bloque

| Archivo | Tipo | Acción |
|---|---|---|
| `scripts/maintenance/bdb_compatible_profiles_verify_removals.py` | Script read-only | NEW |
| `artifacts/suitability/compatible_profiles_verify_removals_0.json` | Artifact JSON con live Firestore data | NEW |
| `docs/BDB_COMPATIBLE_PROFILES_VERIFY_REMOVALS_0.md` | Este documento | NEW |

---

## I. Próximos Bloques

### Inmediato: `BDB-COMPATIBLE-PROFILES-REGEN-WRITE-GATE-0`

Todos los prerequisitos están cumplidos para crear el write gate de regeneración:

| Prerrequisito | Estado |
|---|---|
| Dry-run completo (670 fondos) | ✅ `BDB-COMPATIBLE-PROFILES-REGEN-DRYRUN-0` |
| HOLD commodities/metales confirmado | ✅ `BDB-COMPATIBLE-PROFILES-VERIFY-SECTOR-EQUITY-0` |
| Casos de remoción verificados | ✅ Este bloque |

**Universo del write gate:**
- 10 fondos candidatos (2 removal + 8 MIXED/FI con adición de p3)
- Excluidos: 14 commodities HOLD + Hamco
- Prioridad: LU1883330521 y LU1095739733 primero (riesgo UI más alto)

### Paralelo posible: `BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-DECISION-0`
No depende de compatible_profiles. Puede avanzar en cualquier momento.

### Futuro: `BDB-SUITABILITY-THEMATIC-EQUITY-COMMODITIES-RULE-0`
Corrección semántica del engine para fondos gold/mining. No urgente — los valores stored son correctos.
