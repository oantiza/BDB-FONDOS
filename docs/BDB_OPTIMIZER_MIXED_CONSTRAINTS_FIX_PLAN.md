# BDB_OPTIMIZER_MIXED_CONSTRAINTS_FIX_PLAN

> **Tipo:** Plan técnico — NO implementar todavía  
> **Fecha:** 2026-05-08  
> **Estado base:** HEAD = `08d8d56` (master sincronizado con origin)  
> **Auditoría de referencia:** `docs/BDB_OPTIMIZER_MIXED_CONSTRAINTS_AUDIT.md`  
> **Producción:** Operativa  
> **Modo:** Read-only — solo plan y documentación

---

## 1. Resumen Ejecutivo

Este documento propone un plan de corrección y blindaje para el tratamiento de fondos mixtos en el motor de optimización de BDB-FONDOS, partiendo de los 6 hallazgos documentados en la auditoría (`08d8d56`).

**No se implementa nada todavía.** El plan define:
1. Principios canónicos para el tratamiento de Mixtos.
2. Decisiones recomendadas sobre cada hallazgo.
3. Tests concretos a crear antes de cualquier fix.
4. Fases de implementación ordenadas por riesgo.
5. Qué NO hacer bajo ninguna circunstancia.

**Prioridad:** Media-Alta. No hay bugs operativos inmediatos, pero el gap entre la UI y el solver puede causar confusión en producción y dificulta futuras auditorías regulatorias.

---

## 2. Estado Base

| Campo | Valor |
|-------|-------|
| HEAD | `08d8d56` |
| Rama | `master` |
| origin/master | `08d8d56` (sincronizado) |
| Último commit | `OPTIMIZER_AUDIT: document mixed funds and constraints findings` |
| Producción | Operativa, sin incidencias activas |
| Parser | Cerrado (REFACTOR-3 parcial) |
| Working tree | Sin staged ni modified tracked |

### Archivos auditados (read-only)

| Componente | Archivo | Líneas clave |
|-----------|---------|-------------|
| Solver backend | `optimizer_core.py` | L114-121 (`_build_profile_bucket_vectors`), L634-651 (v1 bounds), L689-699 (profile constraints) |
| Utilidades backend | `utils.py` | L255-352 (`get_v2_asset_mix`, `get_effective_asset_mix`) |
| Suitability | `suitability_engine.py` | L9-72 |
| Feasibility | `feasibility_precheck.py` | L39-175 |
| Config/Seeds | `config.py` | L106-191 (`RISK_BUCKETS_LABELS`) |
| Reconciler | `optimizer_core.py` | L531-585 (`_reconcile_bucket_vs_profile`) |
| Frontend rules | `rulesEngine.ts` | L300-337 (`getAssetClass`), bucket profile definitions |
| Frontend taxonomy | `fundTaxonomy.ts` | L53-65 (`mapToCanonicalAssetClass`) |
| Frontend normalizer | `normalizer.ts` | normalization chains |
| Tests existentes | `test_bucket_constraints_dedup.py` | L308-343 (`test_mixto_not_injected_as_hard_constraint`) |
| Tests existentes | `test_suitability_v2.py` | L97-131 (MOCK_ALLOCATION_AGGRESSIVE/CONSERVATIVE) |

---

## 3. Principios Canónicos

### P-1: Mixto es etiqueta comercial/producto, NO categoría del solver

El solver razona en **exposición económica real** (equity, bond, cash, alternative, real_asset, other). Un fondo mixto se descompone proporcionalmente en esos vectores según su `portfolio_exposure_v2.asset_mix`. La etiqueta "Mixto" es para:
- Reporting y explicaciones al gestor
- UI / filtros de navegación
- Suitability blanda (si procede)
- Catálogo comercial

### P-2: El solver debe usar `portfolio_exposure_v2` como fuente principal

Jerarquía canónica de exposición:
1. `portfolio_exposure_v2.asset_mix` (V2 real data)
2. `portfolio_exposure_v2.economic_exposure` (V2 alternativa)
3. `metrics` legacy con normalización (fallback documentado)
4. Fallback prudente con WARNING — NO 50/50 silencioso

### P-3: No añadir Mixto como hard constraint sin rediseño

Añadir un vector "Mixto" al solver tiene consecuencias graves:
- Σ(min) de perfiles 3-5 superaría umbrales críticos
- Doble counting: un mixto 60/40 ya contribuye a RV y RF; si además consume quota de "Mixto", se restringe dos veces
- Requiere rediseño completo del solver y recalibración de bandas

### P-4: No fallback silencioso peligroso

Si un fondo mixto carece de exposure data:
- Marcar explícitamente con WARNING/REVIEW
- Fallback prudente: clasificar como conservador (bajo equity) o excluir del solver con razón documentada
- No inventar 50/50 que puede distorsionar tanto perfiles conservadores como agresivos

### P-5: Separación de capas

```
┌─────────────────────────────────────────────────────────┐
│ CAPA                 │ ROL                              │
│─────────────────────│──────────────────────────────────│
│ Investment Policy    │ Bandas de perfil (Firestore)     │
│ Suitability          │ Filtro pre-solver por riesgo     │
│ Solver Constraints   │ Hard math en CVXPY (exposure)   │
│ Reporting/UI         │ Etiquetas comerciales (Mixto)   │
└─────────────────────────────────────────────────────────┘
```

Cada capa tiene su propia lógica. No mezclar: la UI no debe influir en el solver, y el solver no debe depender de etiquetas comerciales.

---

## 4. Decisiones Recomendadas

### D-1: Qué hacer con el bucket "Mixto" en `RISK_BUCKETS_LABELS` / Firestore

**Recomendación:** Mantener en config/Firestore **pero documentar explícitamente que es decorativo para el solver**.

| Opción | Pros | Contras | Recomendación |
|--------|------|---------|---------------|
| A. Eliminar Mixto de RISK_BUCKETS_LABELS | Claridad total | Rompe frontend que lo consume | ❌ No |
| B. Crear vector Mixto en solver | "Completitud" | Infeasibilidad, doble counting | ❌ No |
| **C. Mantener + documentar** | Sin breaking changes, transparente | Requiere disciplina | ✅ **Sí** |

Acción concreta:
- Añadir comentario inline en `_build_profile_bucket_vectors()` (L114-121)
- Añadir comentario en `RISK_BUCKETS_LABELS` (config.py L106)
- Asegurar que el test `test_mixto_not_injected_as_hard_constraint` permanece como golden test

### D-2: Qué hacer con `bucket_bounds_v1` y Mixto

**Estado actual:** `bucket_bounds_v1` usa keys `equity`, `bond`, `cash`, `alternative`, `real_asset`, `other` — **NO tiene key "Mixto"**. Esto es correcto.

**Recomendación:** Mantener. El mapping `v1_to_profile` en `_reconcile_bucket_vs_profile()` (L544-551) ya excluye explícitamente "Mixto". Blindar con test.

### D-3: Qué hacer con `current_risk_buckets` y Mixto

**Estado actual:** `current_risk_buckets` hereda de Firestore y SÍ puede contener "Mixto". Pero `_build_profile_bucket_vectors()` solo construye 5 vectores (sin Mixto), así que la banda Mixto se ignora silenciosamente en L692-697.

**Recomendación:** Documentar este filtro implícito. No añadir código nuevo; el test existente ya lo cubre. Considerar emitir un `logger.debug` cuando se detecte una key "Mixto" en profile_cfg que no tiene vector.

### D-4: Qué hacer con el fallback 50/50 (`utils.py` L343-344)

**Estado actual:** Si un fondo con etiqueta "Mixto" llega al solver sin exposure data, recibe `{"equity": 0.5, "bond": 0.5}`.

**Recomendación (Fase 3):**
1. Añadir WARNING explícito al log cuando se activa este fallback
2. Cambiar a fallback conservador: `{"equity": 0.25, "bond": 0.50, "cash": 0.25}` — alineado con un perfil moderado-conservador
3. Incluir el ISIN en el warning para trazabilidad
4. El suitability engine ya bloquea fondos sin V2 para perfiles ≤ 4, así que este caso solo aplica para perfiles ≥ 5

### D-5: Qué hacer en UX

**Estado actual:**
- Frontend muestra "X% Mixto" en la composición del portafolio
- Backend no retorna "Mixto" en `portfolio_allocation` (L1370-1378)
- Frontend calcula "Mixto" localmente con `rulesEngine.ts`

**Recomendación (Fase 4):**
- Añadir tooltip/explicación: "Los fondos mixtos se evalúan por su exposición económica real en el optimizador"
- Considerar mostrar la descomposición look-through junto al label Mixto
- No es urgente — es mejora UX, no bug

---

## 5. Tests Propuestos

> ⚠️ **No crear tests todavía.** Solo definir nombre, objetivo y fixture.

### A. Backend: Solver / Optimizer Tests

**Archivo propuesto:** `functions_python/tests/test_mixed_fund_solver_treatment.py`

| ID | Test Name | Objetivo |
|----|-----------|----------|
| A-1 | `test_mixed_50_50_contributes_to_equity_and_bond_vectors` | Verificar que un fondo MIXED con asset_mix `{equity: 0.5, bond: 0.5}` aporta `0.5` a `eq_v` y `0.5` a `bd_v` |
| A-2 | `test_mixed_fund_does_not_create_mixto_bucket_vector` | Confirmar que `_build_profile_bucket_vectors()` NO incluye key "Mixto" |
| A-3 | `test_profile_constraint_skips_mixto_band` | Verificar que si `current_risk_buckets[5]` incluye `"Mixto": (0.2, 0.5)`, ninguna constraint se genera para esa banda |
| A-4 | `test_bucket_bounds_v1_has_no_mixto_key` | Confirmar que `bucket_bounds_v1` no acepta/procesa key "Mixto" o "mixed" |
| A-5 | `test_reconciler_ignores_mixto_in_v1_to_profile` | Verificar que `_reconcile_bucket_vs_profile()` no intenta reconciliar un bucket "Mixto" |
| A-6 | `test_mixed_without_exposure_uses_fallback_with_warning` | Verificar que un fondo MIXED sin `portfolio_exposure_v2` activa un warning y usa fallback prudente |
| A-7 | `test_profiles_3_5_feasible_without_mixto_constraint` | Σ(min) de los 5 vectores activos < 1.0 para perfiles 3, 4 y 5 |
| A-8 | `test_profiles_3_5_infeasible_if_mixto_added` | Σ(min) incluyendo Mixto > umbral peligroso (demostración de por qué NO añadir) |
| A-9 | `test_portfolio_allocation_output_has_no_mixto_key` | Confirmar que el output `portfolio_allocation` no contiene "Mixto" como key separada |
| A-10 | `test_validator_skips_mixto_gracefully` | `_validate_optimizer_result()` no reporta false violation para Mixto |

### B. Backend: Suitability Tests

**Archivo propuesto:** `functions_python/tests/test_mixed_fund_suitability.py`

| ID | Test Name | Objetivo |
|----|-----------|----------|
| B-1 | `test_aggressive_allocation_blocked_below_profile_5` | MIXED con 70% eq rechazado para P1-P4 |
| B-2 | `test_conservative_allocation_allowed_profile_1` | MIXED con 20% eq permitido para P1-P2 |
| B-3 | `test_mixed_without_v2_blocked_strict` | MIXED sin `classification_v2` bloqueado para todos los perfiles |
| B-4 | `test_mixed_without_exposure_warning_profile_5_plus` | MIXED con V2 identity pero sin exposure → WARNING para P5+ |
| B-5 | `test_mixed_without_exposure_blocked_profile_4_below` | MIXED con V2 identity pero sin exposure → BLOCKED para P1-P4 |

> **Nota:** B-1 y B-2 ya existen como `TestAllocationAggressive` y `TestAllocationConservative` en `test_suitability_v2.py`. Los tests propuestos B-3 a B-5 cubren gaps en escenarios de datos parciales.

### C. Frontend: RulesEngine / Taxonomy Tests

**Archivo propuesto:** `frontend/src/__tests__/mixedFundsConstraints.test.ts`

| ID | Test Name | Objetivo |
|----|-----------|----------|
| C-1 | `test_mixed_classified_as_mixto_bucket_in_ui` | MIXED sin look-through decisivo → "Mixto" |
| C-2 | `test_mixed_85_equity_classified_as_rv` | MIXED con 85% equity → "RV" (look-through) |
| C-3 | `test_mixed_20_equity_75_bond_classified_as_rf` | MIXED con 20/75 → "RF" (look-through) |
| C-4 | `test_allocation_normalized_to_mixed_canonical` | ALLOCATION → MIXED en taxonomía |
| C-5 | `test_profile_bands_include_mixto_for_ui` | `RISK_PROFILES[5]` contiene key "Mixto" |

> **Nota:** C-1 a C-4 ya están parcialmente cubiertos por `mixedFunds.test.ts`. Los tests propuestos blindan la relación con el plan de constraints.

### D. Payload / Contrato Tests

**Archivo propuesto:** `functions_python/tests/test_mixed_fund_contract.py`

| ID | Test Name | Objetivo |
|----|-----------|----------|
| D-1 | `test_classification_v2_and_exposure_travel_separately` | `classification_v2` y `portfolio_exposure_v2` son campos independientes en el payload |
| D-2 | `test_optimizer_uses_exposure_not_asset_type_for_solver` | Solver vectores (`eq_v`, etc.) se construyen desde exposure, no desde `asset_type` |
| D-3 | `test_commercial_label_stays_in_explainability` | Output `explainability` puede mencionar tipo comercial sin afectar solver |
| D-4 | `test_status_field_reflects_fallback_honestly` | `status = "fallback_compliant"` vs `"optimal_compliant"` según `solver_path` |

### E. UX / Status Tests

**Archivo propuesto:** `frontend/src/__tests__/optimizerStatusGating.test.ts`

| ID | Test Name | Objetivo |
|----|-----------|----------|
| E-1 | `test_fallback_compliant_allows_apply_flow` | `fallback_compliant` → usuario puede aplicar |
| E-2 | `test_fallback_non_compliant_blocks_apply_flow` | `fallback_non_compliant` → NO se puede aplicar |
| E-3 | `test_target_vol_shown_when_available` | Si `metrics.target_vol` existe, se muestra |

> **Nota:** E-1 y E-2 ya están cubiertos por `optimizerP0Contract.test.ts`. E-3 es nuevo.

---

## 6. Fases de Implementación

### Fase 1 — Tests de lock-in del comportamiento actual (Prioridad: Alta)

**Objetivo:** Blindar el comportamiento actual antes de cualquier cambio.

| Acción | Archivo | Tests |
|--------|---------|-------|
| Crear test suite Mixto solver | `test_mixed_fund_solver_treatment.py` | A-1 a A-10 |
| Crear test suite Mixto suitability | `test_mixed_fund_suitability.py` | B-3 a B-5 |
| Verificar golden tests existentes | `test_bucket_constraints_dedup.py` | Confirmar que pasan |
| Verificar suitability existente | `test_suitability_v2.py` | Confirmar que pasan |

**Riesgo:** Bajo. Solo se añaden tests, no se modifica código.

**Bloque propuesto:** `BDB-OPT-MIXED-CONSTRAINTS-TESTS-0`

---

### Fase 2 — Limpieza de contrato y documentación inline (Prioridad: Media)

**Objetivo:** Hacer explícito lo que hoy es implícito.

| Acción | Archivo | Detalle |
|--------|---------|---------|
| Documentar Mixto Gap en solver | `optimizer_core.py` L114-121 | Comentario inline |
| Documentar bandas Mixto decorativas | `config.py` L106 | Comentario inline |
| Documentar mapping v1_to_profile sin Mixto | `optimizer_core.py` L544-551 | Comentario inline |
| Opcional: log.debug cuando Mixto se ignora | `optimizer_core.py` L692 | Debug transparencia |

**Riesgo:** Bajo. Solo comentarios y logging.

**Bloque propuesto:** `BDB-OPT-MIXED-CONSTRAINTS-CONTRACT-0`

---

### Fase 3 — Fallback Mixto sin exposure (Prioridad: Media)

**Objetivo:** Eliminar el fallback 50/50 silencioso.

| Acción | Archivo | Detalle |
|--------|---------|---------|
| Cambiar fallback 50/50 a conservador | `utils.py` L343-344 | `{eq: 0.25, bond: 0.50, cash: 0.25}` |
| Añadir WARNING con ISIN | `utils.py` | `logger.warning(...)` |
| Test nuevo | `test_mixed_fund_solver_treatment.py` | A-6 |

**Riesgo:** Medio. Cambia comportamiento de producción para fondos sin exposure. Mitigado por:
- Suitability ya bloquea fondos sin V2 para P1-P4
- Solo aplica a fondos con `classification_v2` pero sin exposure data (caso raro)

---

### Fase 4 — UX: Transparencia de look-through (Prioridad: Baja)

**Objetivo:** Que el operador vea lo mismo que el solver.

| Acción | Archivo | Detalle |
|--------|---------|---------|
| Tooltip "Mixto evaluado por exposición real" | Componente de composición | Informativo |
| Mostrar target_vol/achieved_vol si disponible | Dashboard de resultado | Ya calculado en backend (L1342-1356) |
| Considerar doble vista: comercial + look-through | Componente de allocation | Mejora futura |

**Riesgo:** Bajo. Solo cambios de presentación.

---

### Fase 5 — Canonical constraint source (Prioridad: Media-Baja)

**Objetivo:** Eliminar ambigüedad sobre qué fuente de constraints prevalece.

| Acción | Detalle |
|--------|---------|
| Documentar jerarquía canónica | `bucket_bounds_v1` > `current_risk_buckets` > `config.py` seed |
| Verificar que el dedup funciona correctamente | Test A-3, test existente `test_v1_active_skips_profile_constraints` |
| Evaluar si `current_risk_buckets` debe seguir teniendo "Mixto" | Decisión de negocio |

**Riesgo:** Bajo si se mantiene el status quo. Medio si se decide eliminar "Mixto" de Firestore.

---

## 7. Riesgos

### 🔴 HIGH

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Añadir Mixto como hard constraint sin tests | Baja (si se sigue el plan) | Infeasibilidad en P3-P5 | Bloquear con test A-8, documentar en P-3 |
| Cambiar bandas de perfiles en caliente sin golden tests | Baja | Portafolios no conformes | Fase 1 (lock-in tests) primero |

### 🟡 MEDIUM

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Fallback 50/50 distorsiona portafolios agresivos | Media (fondos sin exposure) | Equity insuficiente para P9-P10 | Fase 3 (fallback conservador) |
| Confusión gestor: UI dice Mixto, solver no lo ve | Media | Decisiones erróneas | Fase 4 (transparencia UX) |
| Reconciler no cubre Mixto (por diseño) | Baja | Ninguno actual | Documentar en Fase 2 |

### 🟢 LOW

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Tests existentes insuficientes para Mixto | Media | Regresión silenciosa | Fase 1 cierra el gap |
| `portfolio_allocation` output confunde consumidores API | Baja | Malinterpretación | Ya correcto (no tiene "Mixto" key) |

---

## 8. Qué NO Hacer

| ❌ Prohibición | Razón |
|---------------|-------|
| **NO añadir Mixto como vector hard constraint** en `_build_profile_bucket_vectors()` | Causa doble counting e infeasibilidad en P3-P5 |
| **NO cambiar bandas de perfiles en Firestore** sin golden tests que validen la transición | Puede romper portafolios de producción |
| **NO tocar producción sin tests** de Fase 1 completados | Sin red de seguridad |
| **NO hacer Firestore writes** en este bloque | Solo plan/documentación |
| **NO mezclar parser/retrocesiones/admin** con este plan | Scopes independientes |
| **NO eliminar el bucket "Mixto" de RISK_BUCKETS_LABELS** sin migrar el frontend | Breaking change en UI |
| **NO crear vector "Mixto" sintético** basado en `asset_type == "allocation"` | Contradice el principio de look-through económico |
| **NO modificar `_reconcile_bucket_vs_profile`** para incluir Mixto | No hay mapping v1 para Mixto, no tiene sentido |

---

## 9. Próximo Bloque Recomendado

### `BDB-OPT-MIXED-CONSTRAINTS-TESTS-0`

**Tipo:** Creación de tests — NO modificar código de producción.

**Contenido:**
- Crear `functions_python/tests/test_mixed_fund_solver_treatment.py` (tests A-1 a A-10)
- Crear `functions_python/tests/test_mixed_fund_suitability.py` (tests B-3 a B-5)
- Ejecutar suite completa de backend para confirmar que todo pasa
- Commit documental de tests

**Reglas:**
- NO modificar código de producción
- NO deploy
- NO Firestore writes
- Solo crear tests que verifiquen el comportamiento actual
- Si algún test falla, documentar el hallazgo como gap

**Alternativa:** Si se prefiere empezar por documentación inline antes de tests:

### `BDB-OPT-MIXED-CONSTRAINTS-CONTRACT-0`

**Tipo:** Comentarios inline + logging — cambios mínimos de producción.

---

## 10. Decisión Final

### Estado: `BDB_OPTIMIZER_MIXED_CONSTRAINTS_FIX_PLAN_READY`

El plan está completo y listo para revisión. Resumen de la estrategia:

1. **Fase 1 (Tests):** Blindar el comportamiento actual con 15+ tests específicos para Mixtos
2. **Fase 2 (Contrato):** Documentar inline las decisiones de diseño que hoy son implícitas
3. **Fase 3 (Fallback):** Eliminar el 50/50 silencioso por un fallback conservador con trazabilidad
4. **Fase 4 (UX):** Transparencia para el gestor sobre cómo el solver trata los Mixtos
5. **Fase 5 (Canonical):** Consolidar la jerarquía de constraint sources

**Siguiente acción recomendada:** Aprobar plan → ejecutar `BDB-OPT-MIXED-CONSTRAINTS-TESTS-0`
