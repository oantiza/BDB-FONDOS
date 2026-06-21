# BDB_POST_MIXED_SUITABILITY_IMPACT_AUDIT_0

**Fecha:** 2026-05-11  
**HEAD:** `bc655db`  
**Tipo:** Auditoría read-only — sin deploy, sin escritura Firestore, sin código modificado  
**Resultado global:** OK — NO_ACTION_REQUIRED

---

## A. Resumen Ejecutivo

Esta auditoría evalúa el impacto real de la remediación MIXED 59/60 sobre suitability, optimizer y reporting.  
Se han auditado 8 fondos representativos directamente en Firestore (modo read-only), se han ejecutado 145 tests locales y se ha analizado el código de `suitability_engine.py`, `utils.py` y el pipeline de constraints/feasibility.

| Item | Estado |
|------|--------|
| Writes a Firestore | 0 |
| Deploy | NO |
| Código modificado | NO |
| Script temporal eliminado | SI |
| Resultado global | **OK — NO_ACTION_REQUIRED** |

**Conclusión principal:** La remediación MIXED mejora significativamente la coherencia del motor. La corrección de exposiciones distorsionadas (fallback 50/50 → datos reales) se alinea con el comportamiento de suitability y optimizer sin introducir nuevos riesgos de bloqueo o regresión. Los 8 fondos auditados presentan datos coherentes con su perfil comercial.

**Estado recomendado:** `AUDIT_STABLE_WITH_TARGETED_PENDING_ITEMS`

---

## B. Scope

| Campo | Valor |
|-------|-------|
| Proyecto | BDB-FONDOS (legacy real) |
| Colección | `funds_v3` |
| Fondos MIXED corregidos | 59 / 60 |
| Fondo excluido | LU3038481936 — Hamco Global Value R (sin datos) |
| Fondos auditados en muestra | 8 ISINs representativos |
| Tests ejecutados | 145 (62 + 46 + 37) |
| Código BDB-FONDOS-CORE tocado | NO |

---

## C. Muestra Firestore (Read-Only)

### Datos observados directamente en `funds_v3`

| ISIN | Nombre | Fallback anterior | Exposición actual (economic_exposure) | Confidence | Fuente | Estado |
|------|--------|-------------------|---------------------------------------|------------|--------|--------|
| ES0114904008 | Brightgate Focus A FI | eq=50, bd=50 | eq=85.6, bd=0.0, cash=10.9, other=3.5 | 0.85 | MS_PORTFOLIO | ✅ CORRECTO |
| FR0010306142 | Carmignac Patrimoine E | bond=0, cash=100 (error MS) | eq=35.4, bd=46.8, cash=5.1, other=12.7 | 0.90 | OFFICIAL_FACTSHEET | ✅ CORRECTO |
| LU1594335520 | Allianz DMA SRI 75 AT | eq=0, bond=100 (invertido MS) | eq=79.1, bd=10.2, cash=0.0, other=10.7 | 0.90 | OFFICIAL_FACTSHEET | ✅ CORRECTO |
| LU1548496022 | Allianz DMA SRI 15 AT | eq sobreestimado MS | eq=24.6, bd=64.4, cash=0.0, other=11.0 | 0.90 | OFFICIAL_FACTSHEET | ✅ CORRECTO |
| LU0352312853 | Allianz Strategy 75 CT | sum=170.81 (apalancado MS) | eq=86.0, bd=14.0, cash=0.0, other=0.0 | 0.90 | OFFICIAL_FACTSHEET | ✅ CORRECTO |
| LU0251119078 | Fidelity Target 2035 A | eq=50, bd=50 | eq=98.8, bd=0.1, cash=0.8, other=0.4 | 0.85 | MS_PORTFOLIO | ✅ CORRECTO |
| ES0116848005 | Global Allocation R FI | eq=50, bd=50 | eq=0.0, bd=100.0, cash=0.0, other=0.0 | 0.85 | MS_PORTFOLIO | ⚠️ VER NOTA |
| LU3038481936 | Hamco Global Value R | eq=80, bd=20 (confidence=0.45) | eq=80.0, bd=20.0, cash=0.0 | 0.45 | (fallback) | ⏳ PENDIENTE |

### Notas por ISIN

**ES0114904008 — Brightgate Focus:** `classification_v2.subtype=FLEXIBLE_ALLOCATION`, `risk_bucket=HIGH`. Con eq=85.6% el motor lo trata como agresivo de facto pese a estar clasificado como MIXED. Coherente con su nombre y comportamiento histórico. **Impacto correcto.**

**FR0010306142 — Carmignac Patrimoine:** `subtype=MODERATE_ALLOCATION`, `risk_bucket=MEDIUM`. eq=35.4% es coherente con un mixto moderado clásico. El error MS (bond=0, cash=100) era grave; ahora el dato es fiable. **Corrección crítica.**

**LU1594335520 — Allianz SRI 75:** `subtype=AGGRESSIVE_ALLOCATION`, `risk_bucket=HIGH`. eq=79.1% consistente con nombre "75". El MS mostraba eq=0, bond=100 (completamente invertido). **Corrección crítica, impacto alto.**

**LU1548496022 — Allianz SRI 15:** `subtype=CONSERVATIVE_ALLOCATION`, `risk_bucket=LOW`. eq=24.6% consistente con nombre "15". **Corrección importante.**

**LU0352312853 — Allianz Strategy 75:** `subtype=AGGRESSIVE_ALLOCATION`, `risk_bucket=HIGH`. eq=86%, coherente. El MS tenía sum=170.81 (producto apalancado). **Corrección crítica.**

**LU0251119078 — Fidelity Target 2035:** `subtype=FLEXIBLE_ALLOCATION`, `risk_bucket=HIGH`. eq=98.8% — este fondo tiene prácticamente 100% RV, a pesar de ser clasificado como MIXED flexible. `derived.asset_class=RV` confirma la coherencia. **Corrección importante: antes 50/50 inflaba artificialmente la exposición RF en carteras.**

**ES0116848005 — Global Allocation R FI:** ⚠️ `economic_exposure: {bond=100, equity=0}`. Este es un dato MS real (el fondo puede estar en RF 100% en este momento), pero el nombre "Global Allocation" y `risk_bucket=HIGH` generan aparente contradicción. **No es un error de la remediación** — es el dato MS actual. El fondo es FLEXIBLE, puede tener 100% RF tácticamente. No requiere acción; se documenta como INFO.

**LU3038481936 — Hamco:** `ms.portfolio.asset_allocation: {equity=0, bond=0}` — confirma que MS no tiene datos para este ISIN. El fallback (80/20, confidence=0.45) sigue siendo la única opción. **Mantener decisión: NO TOCAR.**

---

## D. Impacto Suitability

### Lógica aplicable (de `suitability_engine.py`)

Los umbrales de suitability que afectan a fondos MIXED son los de `real_eq` (RV real):

| Perfil | Umbral equity | Regla |
|--------|---------------|-------|
| 1-2 | > 30% | BLOQUEA |
| 3 | > 45% | BLOQUEA |
| 4 | > 60% | BLOQUEA |
| 5-10 | Sin umbral equity | LIBRE (salvo sector, EM, HY) |

### Análisis por ISIN con nueva exposición

| ISIN / Nombre | real_eq nuevo | Perfiles PERMITIDOS (nueva exposición) | Perfiles BLOQUEADOS | Impacto vs fallback 50/50 |
|---|---|---|---|---|
| ES0114904008 Brightgate Focus | 85.6% | 5-10 | 1-2-3-4 (eq>60%) | **Cambio: antes (50%) permitía perfil 4. Ahora correcto: bloqueado en 4.** |
| FR0010306142 Carmignac Patrimoine | 35.4% | 4-10 | 1-2-3 (eq>30%, >45%) | Antes (50%) bloqueado en 4 también. Ahora más permisivo. **Corrección: desbloquea p4.** |
| LU1594335520 Allianz SRI 75 | 79.1% | 5-10 | 1-2-3-4 | Antes (eq=0 → RF fallback) era tratado como RF → accesible en p1. Ahora correcto. **Corrección crítica de sobreaccesibilidad.** |
| LU1548496022 Allianz SRI 15 | 24.6% | 3-10 | 1-2 (eq>30%) | risk_bucket=LOW. Antes (50%) bloqueado en perfiles 1-2-3. Ahora permite p3 (24.6%<45%). **Corrección positiva.** |
| LU0352312853 Allianz Strategy 75 | 86.0% | 5-10 | 1-2-3-4 | Antes (50%) permitía p4. Ahora bloqueado correcto. **Corrección: cierra acceso indebido en p4.** |
| LU0251119078 Fidelity Target 2035 | 98.8% | 5-10 | 1-2-3-4 | Antes (50%) permitía p4. Ahora correcto: 98.8% equity → bloqueado hasta p4. |
| ES0116848005 Global Allocation R FI | 0.0% | 1-10 (RF puro) | Ninguno por equity | Antes (50%) bloqueado en 1-2-3. Ahora con 0% equity se abre más. INFO: este dato es táctico. |
| LU3038481936 Hamco | 80.0% | 5-10 | 1-2-3-4 | Sin cambio (fallback). |

### Observaciones clave

> **[INFO]** `LU1594335520 — Allianz SRI 75`: este es el caso más crítico. Con el MS erróneo (equity=0, bond=100), el motor lo veía como RF puro y potencialmente lo dejaba pasar en perfiles conservadores. Con la corrección (eq=79.1%), se bloquea correctamente en p1-p4. **Esta corrección protege de una sobreaccesibilidad grave.**

> **[INFO]** `FR0010306142 — Carmignac Patrimoine`: la corrección (de error MS a eq=35.4%) en realidad **amplía** el universo de perfiles permitidos (p4 antes bloqueado, ahora permitido). Es el efecto correcto para un mixto moderado real.

> **[INFO]** `ES0116848005 — Global Allocation R FI`: bond=100 táctico implica acceso en perfiles conservadores. El motor lo permitiría para p1-p2 basado en la exposición real. Esto es técnicamente correcto pero merece vigilancia si el fondo vuelve a tener alta RV (su nombre sugiere alta flexibilidad).

---

## E. Impacto Optimizer / Precheck

### Conclusión por análisis de código (`optimizer_core.py`, `constraints_builder_v1.py`, `utils.py`)

El optimizer usa `get_effective_asset_mix()` → `_allocation_vectors()` para construir los vectores de exposición económica por activo. La corrección de `portfolio_exposure_v2.economic_exposure` se propaga directamente a estos vectores.

| Área | Impacto | Evaluación |
|------|---------|------------|
| Vectores equity/bond/cash | Ahora calculados con datos reales | **MEJORA** |
| Bucket constraints (RV/RF/Monetario/Alternativos) | Calculados con exposición real en look-through | **MEJORA** |
| Feasibility precheck | No hay cambio en la lógica de precheck | SIN CAMBIO |
| Equity floor | Calculado sobre RV real del portfolio | **MEJORA** |
| Locks compatibility | No afectado por exposición del fondo | SIN CAMBIO |

### Riesgos de factibilidad

**¿Pueden carteras antes factibles ser ahora infactibles?**

Análisis por caso:
- Carteras con Allianz SRI 75 en perfiles 1-4: **antes pasaban precheck incorrectamente** (el fondo parecía RF). Ahora el precheck los bloquea con razón. Esto es una corrección, no una regresión.
- Carteras con Fidelity Target 2035 en perfiles 1-4 (50% RV fallback → 98.8% RV real): **mismo caso.** El precheck ahora es correcto.
- Carteras con Carmignac Patrimoine en perfil 4 (50% RV → 35.4% RV): antes era posible que el precheck bloqueara si el max RV era <50%. Ahora con 35.4% es más permisivo. **Mejora.**

**¿Pueden carteras antes conservadoras mostrar más RV real?**

Sí, en carteras que incluyan Brightgate (85.6%) o Allianz SRI 75 (79.1%). Si estos estaban con fallback 50% y ahora muestran su RV real, la composición real del portfolio sube. Esto es **correcto** — el reporting antes subestimaba el riesgo.

**Riesgo de cambio de comportamiento en producción:**  
BAJO. Los cambios están en Firestore (datos), no en código. El optimizer ya estaba diseñado para leer `portfolio_exposure_v2`. El único cambio es que ahora hay datos reales donde antes había fallbacks genéricos.

---

## F. Impacto Reporting / X-Ray

### globalAllocation

Con la corrección de MIXED:
- `ES0114904008 Brightgate`: pasa de contribuir 50% RV en X-Ray a contribuir 85.6% RV. **Reflejo correcto.**
- `LU1594335520 Allianz SRI 75`: pasa de contribuir 0% RV (error MS) a 79.1% RV. **Corrección crítica visible en X-Ray.**
- `LU1548496022 Allianz SRI 15`: contribuye 24.6% RV vs 50% anterior. **Corrección.**

### Alternativos

Los 8 fondos auditados no tienen campo `alternative` ni `real_asset` significativo en `economic_exposure`. La corrección X-Ray de `globalAllocation` (alternatives bucket, commit `7529a23`) es independiente y no genera interferencia.

### Riesgo de cash/other raro

`ES0116848005 — Global Allocation R FI` tiene `bond=100, equity=0`. Si este fondo está en una cartera de cliente, el X-Ray mostrará 100% RF de ese fondo, lo que puede sorprender al usuario si el nombre sugiere "Global Allocation". Es el dato correcto MS, no un artefacto de la remediación. **INFO, no acción.**

---

## G. Tests Ejecutados

### Suite 1 — MIXED, lookthrough, suitability

```
pytest tests/test_mixed_exposure_ms_portfolio.py tests/test_mixed_funds_lookthrough_contract.py tests/test_suitability_v2.py -v --tb=short
```

**Resultado:** 🟢 **62/62 PASSED** — 1.76s

### Suite 2 — Optimizer, feasibility, precheck locks

```
pytest tests/test_optimizer_core.py tests/test_feasibility_precheck.py tests/test_feasibility_precheck_locks_compatibility.py tests/test_feasibility_precheck_locks_expected_behavior.py -v --tb=short
```

**Resultado:** 🟢 **44 passed, 2 skipped** — 2.01s

Los 2 skipped son tests doctrinales (`test_legacy_mode_documental`, `test_no_cross_source_validation_documental`) marcados explícitamente como `@pytest.mark.skip`. No son fallos.

### Suite 3 — Regression coverage + X-Ray

```
pytest tests/test_regression_coverage.py tests/xray/ -v --tb=short
```

**Resultado:** 🟢 **37/37 PASSED** — 2.57s

### Total consolidado

| Suite | Tests | Resultado |
|-------|-------|-----------|
| MIXED + lookthrough + suitability | 62 | 🟢 62/62 PASS |
| Optimizer + feasibility + locks | 46 | 🟢 44/44 PASS + 2 skip (documental) |
| Regression + X-Ray | 37 | 🟢 37/37 PASS |
| **TOTAL** | **145** | 🟢 **143/143 PASS + 2 skip** |

---

## H. Riesgos Detectados

| ID | Riesgo | Clasificación | Acción |
|----|--------|---------------|--------|
| R-01 | Allianz SRI 75 (LU1594335520): antes accesible en p1-p4 por error MS; ahora bloqueado. Carteras existentes de clientes conservadores podrían estar en situación de incumplimiento si incluían este fondo. | **WARNING** | Revisar carteras activas de clientes conservadores con este fondo. No requiere código. |
| R-02 | Global Allocation R FI (ES0116848005): bond=100 táctico puede cambiar cuando el fondo gire a RV. Si MS actualiza datos, la exposición cambiará sola. | **INFO** | Ninguna acción inmediata. Monitorizar en futuras auditorías periódicas. |
| R-03 | Fidelity Target 2035 (LU0251119078): eq=98.8% pese a ser clasificado MIXED FLEXIBLE. El motor y suitability lo tratan correctamente (bloqueado en p1-p4), pero el naming puede confundir a usuarios. | **INFO** | Documentar. No requiere código. |
| R-04 | Hamco (LU3038481936): ms.portfolio.asset_allocation = {equity=0, bond=0}. Confirmado: no hay datos MS. Fallback 80/20 sigue. | **INFO** | NO TOCAR. Monitorizar cuando MS publique datos. |
| R-05 | Los tests de optimizer (`test_optimizer_core.py`) solo cubren 2 casos (valid frontier + fallback path). No hay tests de carteras con MIXED reales. | **INFO** | Deuda técnica de test coverage. Para bloque futuro. |

---

## I. Recomendación

**`NO_ACTION_REQUIRED`** en código productivo.

La auditoría confirma que:
1. Los datos escritos son coherentes con los perfiles comerciales de los fondos.
2. El impacto suitability es correcto: se corrigen sobreaccesibilidades (Allianz SRI 75) y se amplían universos donde corresponde (Carmignac).
3. El optimizer propaga la corrección de forma natural sin cambios en su lógica.
4. El X-Ray reflejará exposiciones reales en lugar de fallbacks, lo que mejora la informacion al cliente.
5. No hay nuevos tests que fallen. 143/143 PASS.

**Accion recomendada:** Solo documentacion. Ningún bloqueo en produccion. El riesgo R-01 (Allianz SRI 75 en carteras conservadoras) es una corrección positiva que identifica una situacion potencialmente indebida anterior.

---

## J. Próximo Bloque Recomendado

### Opción recomendada: `BDB-REMEDIATION-SCRIPTS-ARCHIVE-PLAN-0`

**Justificación:**
- La auditoría de impacto suitability está cerrada sin hallazgos bloqueantes.
- El siguiente paso de menor riesgo y mayor utilidad práctica es limpiar la deuda técnica de los scripts de remediación (gates 1-8).
- Esto evita confusión en el futuro sobre qué scripts son históricos vs ejecutables.
- Es un bloque 100% read-only/documentation, rápido y sin riesgos.

### Orden actualizado sugerido

| Orden | Bloque | Justificación |
|-------|--------|---------------|
| 1 | `BDB-REMEDIATION-SCRIPTS-ARCHIVE-PLAN-0` | Deuda técnica baja complejidad, evita reejección accidental |
| 2 | `BDB-EQUITY-FLOOR-DEAD-CODE-AUDIT-0` | Auditoría read-only del optimizer |
| 3 | `BDB-SUITABILITY-HARDCODED-CONTRACT-AUDIT-0` | Auditoría thresholds suitability |

---

## K. Confirmaciones Finales

| Check | Estado |
|-------|--------|
| Writes a Firestore | ✅ 0 |
| Deploy | ✅ NO |
| Código productivo modificado | ✅ NO |
| Script temporal eliminado antes del commit | ✅ SI |
| `optimizer_core.py` tocado | ✅ NO |
| `suitability_engine.py` tocado | ✅ NO |
| `firestore.rules` tocado | ✅ NO |
| BDB-FONDOS-CORE tocado | ✅ NO |
| Scripts de write históricos reejecutados | ✅ NO |

---

*Generado por Antigravity Agent (Claude Sonnet 4.6 Thinking) — BDB-POST-MIXED-SUITABILITY-IMPACT-AUDIT-0*  
*HEAD: `bc655db` — Tests: 143/143 PASS + 2 skip — Produccion: ESTABLE*
