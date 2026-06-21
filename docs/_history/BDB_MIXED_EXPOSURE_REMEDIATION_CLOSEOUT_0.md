# BDB_MIXED_EXPOSURE_REMEDIATION_CLOSEOUT_0

**Estado:** REMEDIATION_OPERATIONALLY_CLOSED
**Fecha cierre:** 2026-05-11
**HEAD al cierre:** `84c9ec4`
**Firestore writes en este documento:** 0
**Deploy:** NO
**Código modificado:** NO

---

## A. Resumen ejecutivo

La remediación de exposición económica para fondos MIXED en `funds_v3` ha sido **cerrada operativamente**.

| Métrica | Valor |
|---------|-------|
| Total fondos MIXED detectados | 60 |
| **Fondos corregidos** | **54/60 (90%)** |
| Low-risk corregidos | 30/30 (100%) |
| Review-required APPROVE corregidos | 24/24 (100%) |
| Fondos pendientes (no automáticos) | 6 |
| Writes automáticos recomendados restantes | **0** |
| Lotes ejecutados | 7 |
| Tests ejecutados por lote | 62/62 PASS |
| Campos prohibidos afectados | **0** |
| Rollbacks disponibles | Todos los lotes |

**No quedan writes automáticos recomendados.** Los 6 fondos pendientes requieren decisión manual caso por caso.

---

## B. Causa raíz

### Problema
El script `scripts/maintenance/populate_taxonomy_v2.py`, en su función `buildPortfolioExposureV2()`, implementaba la siguiente lógica para fondos MIXED:

```python
# ANTES (defectuoso)
metrics = data.get("metrics")  # → None para la mayoría de MIXED
# Si metrics es None → fallback por clasificación
# FLEXIBLE_ALLOCATION → equity=50, bond=50
# CONSERVATIVE_ALLOCATION → equity=20, bond=80
# AGGRESSIVE_ALLOCATION → equity=80, bond=20
```

### Consecuencia
- **60 fondos MIXED** quedaron con exposición económica persistida basada en fallback genérico.
- Los datos reales de Morningstar (`ms.portfolio.asset_allocation`) **sí existían** en Firestore pero eran **ignorados** por el pipeline.
- La exposición 50/50 no reflejaba la realidad de fondos que podían ser 0% equity (RF pura) o 98% equity (target-date).

### Impacto
- **Solver/Optimizer:** Asignaciones subóptimas por exposición incorrecta.
- **Suitability:** Evaluación de idoneidad distorsionada.
- **Reporting:** Reporting de asset allocation incorrecto a nivel portfolio.
- **Concentración:** Métricas de concentración desalineadas.

---

## C. Cambio implementado

### Pipeline corregido (commit `1ed2447`)

La función `buildPortfolioExposureV2()` ahora usa la siguiente precedencia:

```
1. metrics (raíz del documento)         → mayor prioridad
2. ms.portfolio.asset_allocation         → datos Morningstar reales
3. fallback por clasificación            → último recurso, auditable
```

### Lo que NO se cambió
| Componente | Modificado | Motivo |
|-----------|-----------|--------|
| optimizer_core.py | ❌ NO | No se añadió vector Mixto al solver |
| suitability_engine.py | ❌ NO | Motor de idoneidad sin cambios |
| Frontend | ❌ NO | Sin cambios de presentación |
| firestore.rules | ❌ NO | Sin cambios de seguridad |
| BDB-FONDOS-CORE | ❌ NO | Paquete core intacto |
| classification_v2 | ❌ NO | Clasificaciones preservadas |

### Diseño
- El solver sigue usando **look-through real** por `portfolio_exposure_v2.economic_exposure`.
- "Mixto" permanece como categoría **comercial/presentación**, no como vector del solver.
- Los fondos MIXED contribuyen a los vectores existentes (RV, RF, cash, otros) según su exposición real.

---

## D. Lotes ejecutados

| Lote | Tipo | Fondos | Commit | Post-verification | Tests | Rollback |
|------|------|--------|--------|-------------------|-------|----------|
| 1 | Low-risk | 10 | `d9ca28f` | 10/10 PASS | 62/62 | `write_gate_0/` |
| 2 | Low-risk | 5 | `fd383c2` | 5/5 PASS | 62/62 | `write_gate_2/` |
| 3 | Low-risk | 15 | `fd503e8` | 15/15 PASS | 62/62 | `write_gate_3/` |
| 4 | Review-required | 5 | `a17ff30` | 5/5 PASS | 62/62 | `write_gate_4/` |
| 5 | Review-required | 5 | `b044d20` | 5/5 PASS | 62/62 | `write_gate_5/` |
| 6 | Review-required (high-delta) | 5 | `17e23fa` | 5/5 PASS | 62/62 | `write_gate_6/` |
| 7 | Review-required (ALL remaining APPROVE) | 9 | `84c9ec4` | 9/9 PASS | 62/62 | `write_gate_7/` |
| **Total** | | **54** | | **54/54 PASS** | | **7 rollbacks** |

### ISINs corregidos — lista completa (54)

<details>
<summary>Expandir lista completa de ISINs corregidos</summary>

#### Lote 1 (10 low-risk)
IE00BYYPF474, ES0128067008, LU0512121004, LU1883327816, LU1961009468,
ES0116567035, ES0162949012, FR0010041822, LU0093503737, LU0352312184

#### Lote 2 (5 low-risk)
LU0565136552, LU1276000236, LU1298174530, LU1304666057, LU1740985814

#### Lote 3 (15 low-risk)
ES0173323009, ES0175604034, LU1245470593, DE0005318406, ES0148181003,
LU0251131362, LU0404220724, LU0171283459, LU1899018953, LU1697017256,
ES0142046038, ES0162946034, LU1697018494, LU1882475392, LU2278574715

#### Lote 4 (5 review-required)
ES0138930005, DE000DWS17J0, LU1868537090, LU0048293368, LU1697016365

#### Lote 5 (5 review-required)
LU1883330521, LU1883340322, LU1095739733, DE000A0X7541, LU1894680757

#### Lote 6 (5 review-required high-delta)
LU0119195963, ES0118537002, LU2050544563, LU0284394821, ES0114904008

#### Lote 7 (9 review-required ALL remaining APPROVE)
ES0116848005, LU0251119078, LU1899019175, ES0162305033, ES0131462022,
ES0110407006, LU1697018064, LU1899018870, FR0013219243

</details>

---

## E. Confirmaciones de seguridad

### Campos actualizados (por fondo)
| Campo | Operación |
|-------|-----------|
| `portfolio_exposure_v2.economic_exposure.equity` | update() |
| `portfolio_exposure_v2.economic_exposure.bond` | update() |
| `portfolio_exposure_v2.economic_exposure.cash` | update() |
| `portfolio_exposure_v2.economic_exposure.other` | update() |
| `portfolio_exposure_v2.exposure_confidence` | 0.45 → 0.85 |
| `portfolio_exposure_v2.warnings` | `["EXPOSURE_SOURCE_MS_PORTFOLIO"]` |
| `portfolio_exposure_v2.computed_at` | timestamp del write |

### Campos prohibidos — INTACTOS en todos los lotes
| Campo | Estado | Verificado en |
|-------|--------|--------------|
| `manual` | ✅ intacto | 54/54 fondos |
| `manual.costs` | ✅ intacto | 54/54 fondos |
| `manual.costs.retrocession` | ✅ intacto | 54/54 fondos |
| `classification_v2` | ✅ intacto | 54/54 fondos |
| `ms` | ✅ intacto | 54/54 fondos |
| `derived` | ✅ intacto | 54/54 fondos |
| `std_perf` | ✅ intacto | 54/54 fondos |

### Operaciones NO ejecutadas
| Operación | Ejecutada |
|-----------|-----------|
| Deploy | ❌ NO |
| firestore.rules modificado | ❌ NO |
| BDB-FONDOS-CORE modificado | ❌ NO |
| optimizer_core.py modificado | ❌ NO |
| suitability_engine.py modificado | ❌ NO |
| Frontend modificado | ❌ NO |
| `set()` usado (vs `update()`) | ❌ NO — siempre `update()` |

### Rollbacks
Los 7 lotes tienen `rollback_manifest.json` con valores originales para restauración inmediata si fuera necesario.

---

## F. Estado final de fondos pendientes (6)

### 1. LU3038481936 — Hamco Global Value R EUR Acc
| Campo | Valor |
|-------|-------|
| **Estado** | SIN DATOS MS / FONDO NUEVO |
| **Decisión** | NO TOCAR |
| **Exposición actual** | eq=80, bd=20 (fallback AGGRESSIVE) |
| **ms.portfolio.asset_allocation** | `null` |
| **Motivo** | Fondo nuevo sin histórico ni datos Morningstar suficientes. Mantener fallback actual. Marcar como pendiente de enriquecimiento futuro cuando MS publique datos. |
| **Acción futura** | Esperar a que Morningstar proporcione datos. Revisar en próximo ciclo de enriquecimiento. |

### 2. FR0010306142 — Carmignac Patrimoine E EUR Acc
| Campo | Valor |
|-------|-------|
| **Estado** | REVIEW_MANUAL |
| **Decisión** | Revisar solo si está en cartera real, propuesta comercial o tiene patrimonio relevante |
| **Exposición actual** | eq=50, bd=50 (fallback MODERATE) |
| **MS sum** | 141.3 (derivados pesados) |
| **Motivo** | Mixto clásico con uso intensivo de derivados. MS sum=141.3 indica apalancamiento significativo que distorsiona la normalización. La normalización automática produce eq≈29% que podría no reflejar la exposición económica neta real. |
| **Acción futura** | Si aparece en cartera/propuesta, abrir `BDB-MIXED-PENDING-ISIN-REVIEW-FR0010306142` para análisis manual. |

### 3. LU1548496022 — Allianz Dynamic Multi Asset Strategy SRI 15 AT EUR
| Campo | Valor |
|-------|-------|
| **Estado** | REVIEW_MANUAL |
| **Decisión** | Revisar manualmente si importa comercialmente |
| **Exposición actual** | eq=20, bd=80 (fallback CONSERVATIVE) |
| **MS sum** | 112.5 (normalización necesaria) |
| **Motivo** | El "15" en el nombre sugiere perfil conservador/baja RV. MS sum=112.5 requiere normalización que podría distorsionar. Validar contra ficha del fondo antes de cualquier write. |
| **Acción futura** | Si relevante comercialmente, abrir tarea específica con validación manual contra ficha Allianz. |

### 4. LU1594335520 — Allianz Dynamic Multi Asset Strategy SRI 75 AT EUR
| Campo | Valor |
|-------|-------|
| **Estado** | HOLD |
| **Decisión** | NO TOCAR sin investigación específica |
| **Exposición actual** | eq=80, bd=20 (fallback AGGRESSIVE) |
| **MS propuesto** | eq=0% (anomalía) |
| **Motivo** | AGGRESSIVE_ALLOCATION con 0% equity según MS es una anomalía severa. El "75" en el nombre sugiere alta RV. Posible error de datos MS o exposición sintética vía derivados no capturada. |
| **Acción futura** | Requiere investigación manual dedicada. NO escribir sin validación humana exhaustiva. |

### 5. LU0352312853 — Allianz Strategy 75 CT EUR
| Campo | Valor |
|-------|-------|
| **Estado** | HOLD |
| **Decisión** | NO TOCAR sin investigación específica |
| **Exposición actual** | eq=80, bd=20 (fallback AGGRESSIVE) |
| **MS sum** | 170.8 (apalancamiento extremo) |
| **Motivo** | MS sum=170.8 indica apalancamiento extremo que distorsiona toda normalización. La normalización a 58.5/41.5 contradice el "75" del nombre. |
| **Acción futura** | Requiere análisis manual del uso de derivados y apalancamiento. NO escribir sin validación. |

### 6. LU0121216526 — Goldman Sachs Patrimonial Aggressive X Cap EUR
| Campo | Valor |
|-------|-------|
| **Estado** | REVIEW_MANUAL |
| **Decisión** | Revisar solo si está en cartera o propuesta |
| **Exposición actual** | eq=80, bd=20 (fallback AGGRESSIVE) |
| **MS sum** | 107.2 |
| **MS propuesto** | eq=56.5% (baja para AGGRESSIVE) |
| **Motivo** | AGGRESSIVE que baja a 56.5% equity. MS sum=107.2 (ligero leverage). No merece write automático sin relevancia comercial confirmada. Podría ser genuinamente multi-asset diversificado. |
| **Acción futura** | Si aparece en cartera/propuesta, abrir tarea específica. |

---

## G. Recomendación operativa

1. **PARAR la remediación automática aquí.** No hay más writes por lotes recomendados.
2. **No hacer más writes batch.** Los 6 fondos pendientes requieren decisión individual.
3. **Si alguno de los 6 aparece en cartera real o propuesta comercial**, abrir tarea específica por ISIN: `BDB-MIXED-PENDING-ISIN-REVIEW-{ISIN}`.
4. **Mantener Hamco (LU3038481936) pendiente** hasta que Morningstar publique datos de portfolio.
5. **Mantener HOLD/BLOCK sin cambios.** LU1594335520 y LU0352312853 no deben escribirse sin investigación manual dedicada.
6. **Los rollbacks permanecen disponibles** en `artifacts/bdb_mixed_exposure_fix/write_gate_*/rollback_manifest.json` para los 54 fondos corregidos.

---

## H. Impacto esperado

| Área | Impacto |
|------|---------|
| **Solver/Optimizer** | Mejor alineación de asignaciones con exposición real. Los fondos MIXED ahora contribuyen a RV/RF según su portfolio real, no por fallback genérico. |
| **Suitability** | Evaluación de idoneidad más precisa. Fondos que eran 98% RV ya no se evalúan como 50/50. |
| **Reporting** | Asset allocation a nivel portfolio refleja realidad. Menos distorsión en concentración. |
| **Categoría comercial** | "Mixto" sigue como categoría de presentación. El solver opera con look-through real. |
| **Confidence** | 54 fondos pasaron de `exposure_confidence=0.45` a `exposure_confidence=0.85`. |

---

## I. Próximas tareas opcionales

| Tarea | Prioridad | Trigger |
|-------|-----------|---------|
| `BDB-MIXED-PENDING-ISIN-REVIEW-FR0010306142` | Baja | Si Carmignac Patrimoine en cartera |
| `BDB-MIXED-PENDING-ISIN-REVIEW-LU1548496022` | Baja | Si Allianz SRI 15 en cartera |
| `BDB-MIXED-PENDING-ISIN-REVIEW-LU1594335520` | Media | Investigación manual dedicada |
| `BDB-MIXED-PENDING-ISIN-REVIEW-LU0352312853` | Media | Investigación manual dedicada |
| `BDB-MIXED-PENDING-ISIN-REVIEW-LU0121216526` | Baja | Si GS Aggressive en cartera |
| `BDB-MIXED-PENDING-ISIN-REVIEW-LU3038481936` | Baja | Cuando MS publique datos |
| Limpieza service account local | Media | Mover `scripts/serviceAccountKey.json` y `ServiceAccountkey.json` fuera del workspace. Usar `GOOGLE_APPLICATION_CREDENTIALS` en su lugar. |

---

## J. Documentación generada durante la remediación

### Documentos de análisis
- `docs/BDB_MIXED_EXPOSURE_SOURCE_AUDIT_0.md` — Auditoría de fuente de datos
- `docs/BDB_OPT_MIXED_FUNDS_SEMANTIC_AUDIT_0.md` — Auditoría semántica del solver
- `docs/BDB_MIXED_EXPOSURE_REVIEW_REQUIRED_AUDIT_0.md` — Clasificación de 29 fondos review-required

### Documentos de ejecución
- `docs/BDB_MIXED_EXPOSURE_WRITE_CONTROLLED_{1..7}.md` — 7 informes de ejecución

### Documentos de gate
- `docs/BDB_MIXED_EXPOSURE_WRITE_GATE_{0,2..7}.md` — 7 informes de preparación

### Artifacts
- `artifacts/bdb_mixed_exposure_fix/mixed_exposure_fix_dry_run.json` — Dry-run maestro (60 fondos)
- `artifacts/bdb_mixed_exposure_fix/write_gate_{0,2..7}/` — 7 directorios con:
  - `selection.json`
  - `snapshots_before.json`
  - `diff_manifest.json`
  - `rollback_manifest.json`
  - `write_approval_manifest.json`
  - `post_write_verification.json`

### Scripts
- `scripts/maintenance/bdb_mixed_exposure_write_gate_{0,2..7}.py` — Scripts de preparación
- `scripts/maintenance/bdb_mixed_exposure_write_controlled_{1..7}.py` — Scripts de ejecución

---

## K. Confirmación final

| Check | Estado |
|-------|--------|
| 54/60 MIXED corregidos | ✅ |
| 6 pendientes documentados | ✅ |
| 0 writes automáticos pendientes | ✅ |
| Rollbacks disponibles para los 54 | ✅ |
| Campos prohibidos intactos | ✅ |
| Tests 62/62 PASS | ✅ |
| No deploy | ✅ |
| No código runtime modificado | ✅ |
| **REMEDIATION_OPERATIONALLY_CLOSED** | ✅ |
