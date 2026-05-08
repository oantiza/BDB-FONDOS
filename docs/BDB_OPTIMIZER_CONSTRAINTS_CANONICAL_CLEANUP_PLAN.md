# BDB_OPTIMIZER_CONSTRAINTS_CANONICAL_CLEANUP_PLAN

> **Tipo:** Plan técnico — NO implementar todavía  
> **Fecha:** 2026-05-08  
> **Estado base:** HEAD = `0b8b6dd` (master sincronizado con origin)  
> **Producción:** Operativa  
> **Modo:** Read-only — solo plan y documentación

---

## 1. Resumen Ejecutivo

Este plan propone una jerarquía canónica de constraints del optimizador BDB-FONDOS, separando claramente cuatro capas: Investment Policy, Suitability, Solver Constraints, y Reporting/Explanation. El objetivo es eliminar duplicidades, documentar qué fuente de verdad manda en cada caso, evitar contradicciones silenciosas, y preparar futuros tests y fixes.

**Contexto completado:**
- Mixto/UX cerrado (0b8b6dd)
- Hosting desplegado y validado
- Retrocesiones aparcadas (falta archivo actualizado)
- Parser cerrado

---

## 2. Estado Base

| Campo | Valor |
|-------|-------|
| HEAD | `0b8b6dd` |
| Rama | `master` |
| origin/master | `0b8b6dd` (sincronizado) |
| Último commit | `OPTIMIZER_CLOSEOUT: document mixed UX fallback cycle completion` |
| Producción | Operativa |
| Mixto/UX | Cerrado y desplegado |

---

## 3. Mapa Actual del Flujo Frontend → Backend → Solver → Response

### 3.1 Frontend: Construcción de Payload

```
usePortfolioActions.ts (L140-156)
├── assets: string[]
├── risk_level: number
├── profile_id: String(riskLevel)         ← DUPLICADO de risk_level
├── optimization_mode: 'rebalance_to_profile'
├── locked_assets: string[]
├── locked_positions: { mode, positions }
├── asset_metadata: Record<isin, {asset_class, name}>
└── constraints: {
      apply_profile: true,
      optimization_mode: 'rebalance_to_profile',  ← DUPLICADO raíz
      lock_mode: string,                           ← DUPLICADO de locked_positions.mode
      fixed_weights: Record<isin, number>           ← DUPLICADO de locked_positions.positions
    }
```

### 3.2 Backend: Endpoint (endpoints_portfolio.py)

```
optimize_portfolio_quant()
├── FASE 1: Parse raw (risk_level, locked_assets)
├── FASE 2: Challengers injection
├── FASE 3: _build_asset_metadata(db, assets, frontend_meta)
│   └── Firestore funds_v3 → classification_v2, portfolio_exposure_v2
├── FASE 4: _build_effective_constraints(req_data)
│   ├── profile_id = req_data.profile_id || risk_level
│   ├── optimization_mode = req_data || constraints || default
│   ├── _load_canonical_profile(db, profile_id)
│   └── build_constraints_v1(profile, mode, locks, views, overrides)
│       → PortfolioConstraintsV1 (Pydantic model)
└── FASE 5: run_optimization(assets, risk_level, db, constraints, constraints_v1, ...)
```

### 3.3 Solver Core (optimizer_core.py)

```
run_optimization()
├── FASE 1: _build_optimization_context(db, constraints)
│   ├── apply_profile, optimization_mode, lock_mode, fixed_weights
│   ├── current_risk_buckets ← Firestore system_settings/risk_profiles
│   │   └── fallback: RISK_BUCKETS_LABELS (config.py seed)
│   └── equity_floor, bond_cap, cash_cap
├── OVERRIDE from constraints_v1:
│   ├── locks_v1 → fixed_weights, lock_mode
│   ├── flags_v1 → apply_profile
│   ├── bucket_bounds_v1 ← constraints_v1.bucket_bounds
│   └── optimization_mode ← constraints_v1.optimization_mode
├── FASE 2: Suitability filter
├── FASE 3: Universe + exposure vectors (eq_vec..ot_vec)
├── FASE 5.5: Reconcile bucket_bounds_v1 vs current_risk_buckets
├── FASE 6: _apply_standard_constraints()
│   ├── Level 1: Locked assets (keep_weight/keep_money/min_keep)
│   ├── Level 2: bucket_bounds_v1 (6 economic keys, no "Mixto")
│   ├── Level 3: Geography constraints
│   ├── Level 4: Group limits
│   └── Level 5: Profile buckets (ONLY if no v1 bounds active)
│       └── _build_profile_bucket_vectors → 5 buckets (no Mixto)
├── FASE 7: Feasibility & auto-expand
├── FASE 8: Solve + postprocess
└── Response: status, weights, metrics, explainability, warnings
```

---

## 4. Inventario de Campos

| Campo | Frontend envía | Backend recibe | Solver usa | Response devuelve |
|-------|---------------|----------------|------------|-------------------|
| `risk_level` | ✅ raíz | ✅ L287 | ✅ como `risk_level_i` | ❌ implícito |
| `profile_id` | ✅ raíz | ✅ L360 | ❌ indirecto via constraints_v1 | ✅ en explainability |
| `optimization_mode` | ✅ raíz + constraints | ✅ L361-364 | ✅ L1062 | ✅ en explainability |
| `locked_positions` | ✅ raíz | ✅ L366 | ✅ via locks_v1 | ❌ |
| `locked_assets` | ✅ raíz | ✅ L288 | ✅ L616 | ❌ implícito |
| `constraints.fixed_weights` | ✅ | ✅ via STRATEGY | ✅ L295/L1055 | ✅ explainability |
| `constraints.lock_mode` | ✅ | ✅ via STRATEGY | ✅ L294/L1060 | ✅ explainability |
| `constraints.apply_profile` | ✅ | ✅ via STRATEGY | ✅ L292/L1064 | ✅ explainability |
| `bucket_bounds_v1` | ❌ (built server-side) | ✅ L1050 | ✅ L635-651 | ✅ source in explainability |
| `current_risk_buckets` | ❌ | ✅ L304/310 | ✅ L689-697 (if no v1) | ✅ profile_limits |
| `classification_v2` | ✅ in asset_metadata | ✅ L83 | ✅ via suitability | ❌ |
| `portfolio_exposure_v2` | ✅ in asset_metadata | ✅ L84 | ✅ via exposure vectors | ❌ |
| `target_vol` | ❌ | ✅ risk_budget_v1 | ✅ L1343 | ✅ metrics |
| `achieved_vol` | ❌ | ❌ | ✅ = port_vol | ✅ metrics |
| `vol_deviation` | ❌ | ❌ | ✅ L1347 | ✅ metrics |
| `solver_path` | ❌ | ❌ | ✅ internal | ✅ raíz + explainability |
| `status` | ❌ | ❌ | ✅ L1330-1334 | ✅ raíz |
| `warnings` | ❌ | ❌ | ✅ L1336-1340 | ✅ raíz |

---

## 5. Diagnóstico de Duplicidades

### D-1: `risk_level` vs `profile_id`

- **Frontend:** envía ambos; `profile_id = String(riskLevel)` (L143)
- **Endpoint:** `profile_id = req_data.profile_id || risk_level` (L360)
- **Builder:** usa `profile_id` para cargar perfil canónico y target_vol
- **Solver:** usa `risk_level` como `risk_level_i` para bucket lookup
- **Riesgo:** 🟡 MEDIO — si difieren, el bucket bounds se aplican con `risk_level_i` pero el target_vol se calcula con `profile_id`. Actualmente son siempre iguales.
- **Acción:** Unificar a `profile_id` como fuente única. `risk_level` pasa a ser alias.

### D-2: `optimization_mode` raíz vs constraints

- **Frontend envía en 3 sitios:** raíz, constraints.optimization_mode, payload raíz
- **Endpoint:** cascada `req_data > STRATEGY > default` (L361-364), luego override por constraints_v1 (L391)
- **Solver:** override adicional de constraints_v1 (L1061-1062)
- **Riesgo:** 🟡 MEDIO — la cascada de 4 niveles puede producir un valor inesperado si difieren.
- **Acción:** Frontend envía solo en raíz. Backend normaliza una vez en el builder.

### D-3: `locked_positions` vs `fixed_weights` / `lock_mode`

- **Frontend envía ambos:** `locked_positions: {mode, positions}` Y `constraints: {lock_mode, fixed_weights}`
- **Endpoint:** si `locked_positions` no es dict, se reconstruye desde constraints (L367-371)
- **Builder:** `_resolve_locks()` prioriza `locked_positions`, fallback a `overrides.fixed_weights`
- **Solver:** `_build_optimization_context` extrae `fixed_weights` de constraints; luego override de `locks_v1.positions` (L1054-1058)
- **Riesgo:** 🟡 MEDIO — doble representación del mismo concepto. Si un campo se actualiza sin el otro, inconsistencia.
- **Acción:** Eliminar `constraints.fixed_weights` y `constraints.lock_mode`. Solo `locked_positions`.

### D-4: `bucket_bounds_v1` vs `current_risk_buckets`

- **`bucket_bounds_v1`:** construido por `build_constraints_v1()` desde perfil Firestore. Keys: `equity`, `bond`, `cash`, `alternative`, `real_asset`, `other`. NO tiene "Mixto".
- **`current_risk_buckets`:** cargado directamente desde Firestore `system_settings/risk_profiles`. Keys: `RV`, `RF`, `Mixto`, `Monetario`, `Alternativos`, `Otros`. SÍ tiene "Mixto".
- **Dedup en solver:** si `bucket_bounds_v1` tiene bounds activos → se usa, profile buckets SKIPPED (L689/699). Si no → profile buckets como legacy fallback.
- **Reconciliación:** `_reconcile_bucket_vs_profile()` (L531) cruza ambos para detectar contradicciones.
- **Riesgo:** 🟢 BAJO — el dedup funciona. Pero la coexistencia es confusa y "Mixto" en profile es silenciosamente inerte.
- **Acción:** Fase 4 — documentar y eventualmente converger a solo `bucket_bounds_v1`.

### D-5: `classification_v2` vs `portfolio_exposure_v2`

- **`classification_v2`:** identidad del fondo (asset_type, asset_subtype, risk_bucket). Usado por suitability.
- **`portfolio_exposure_v2`:** desglose económico real (asset_mix, regions, sectors). Usado por solver para vectores.
- **Riesgo:** 🟢 BAJO — son complementarios, no duplicados. Pero si falta `portfolio_exposure_v2`, el fallback 50/50 aplica para Mixtos.
- **Acción:** Ya documentado en auditoría Mixto. Mantener separación.

### D-6: `asset_mix` vs `economic_exposure`

- **`asset_mix`:** campo dentro de `portfolio_exposure_v2`. Fuente real del solver.
- **`economic_exposure`:** campo alternativo dentro de `portfolio_exposure_v2`. Fallback si no hay `asset_mix`.
- **Riesgo:** 🟢 BAJO — jerarquía clara en `get_v2_asset_mix()`: asset_mix > economic_exposure > metrics > fallback.
- **Acción:** Documentar inline la jerarquía.

### D-7: `target_vol` / `achieved_vol` / `vol_deviation`

- **Cálculo:** `target_vol` viene de `risk_budget_v1.target_vol` (L1343). `achieved_vol` = `port_vol` del solver. `vol_deviation` = achieved - target (L1347).
- **Respuesta:** en `metrics` (L1354-1356).
- **Frontend:** extraído en `processOptimizationResult` (L656-658). Mostrado en `OptimizationReviewModal`.
- **Riesgo:** 🟢 BAJO — flujo limpio.
- **Acción:** Ninguna urgente.

---

## 6. Jerarquía Canónica Propuesta

### A. Investment Policy

Qué define los límites del perfil del inversor.

| Campo | Fuente de verdad | Fallback | Frontend/Backend |
|-------|------------------|----------|-----------------|
| `profile_id` | Frontend (usuario selecciona) | "5" | Frontend envía → Backend usa |
| `risk_level` | = profile_id | = profile_id | **DEPRECAR** como campo separado |
| `RISK_BUCKETS_LABELS` | config.py seed | Firestore risk_profiles | Backend only |
| `target_vol` | Firestore risk_profiles → RISK_TARGETS seed | 0.105 | Backend construye |
| `vol_band` | Firestore risk_profiles | ±2% de target_vol | Backend construye |

### B. Suitability

Filtros de elegibilidad pre-solver.

| Campo | Fuente de verdad | Rol |
|-------|------------------|-----|
| `classification_v2` | Firestore funds_v3 | Identidad del fondo |
| `portfolio_exposure_v2` | Firestore funds_v3 | Exposure real |
| `risk_bucket` | Dentro de classification_v2 | Hard gate para perfiles ≤ 2 |
| `asset_type` / `asset_subtype` | Dentro de classification_v2 | Exclusiones por tipo |
| `is_suitable_low_risk` | Dentro de classification_v2 | Gate para perfiles ≤ 2 |
| `real_eq` (equity %) | Calculado de exposure | Umbral por perfil |

### C. Solver Constraints (Hard Math)

Constraints inyectados a CVXPY.

| Campo | Fuente de verdad canónica | Legacy | Acción |
|-------|--------------------------|--------|--------|
| `bucket_bounds_v1` | `build_constraints_v1()` → Pydantic | N/A | ✅ CANÓNICO — mantener |
| `current_risk_buckets` | Firestore risk_profiles | RISK_BUCKETS_LABELS | ⚠️ Solo fallback si no hay v1 |
| `fixed_weights` | `locked_positions.positions` | `constraints.fixed_weights` | Unificar a `locked_positions` |
| `lock_mode` | `locked_positions.mode` | `constraints.lock_mode` | Unificar a `locked_positions` |
| `max_weight` / `min_weight` | `construction_v1` | `constraints.max_weight` | Preferir construction_v1 |
| `equity_floor` | constraints dict | N/A | Mantener |
| `europe` / `americas` / `emerging` | constraints dict | N/A | Mantener como geo limits |
| `group_limits` | constraints dict | N/A | Mantener |
| `objective` | `constraints_v1.objective` | `constraints.objective` | Preferir v1 |

### D. Reporting / Explanation

Solo para UI y trazabilidad. NO afecta al solver.

| Campo | Rol | Dónde se genera |
|-------|-----|----------------|
| `status` | Estado final (optimal/fallback/infeasible) | optimizer_core L1330 |
| `solver_path` | Ruta del solver usada | optimizer_core interno |
| `warnings` | Lista de advertencias técnicas | optimizer_core L1336 |
| `target_vol` / `achieved_vol` / `vol_deviation` | Transparencia volatilidad | optimizer_core L1342-1356 |
| `binding_constraints` | Qué restricciones aplican | optimizer_core L1267 |
| `bucket_constraints_source` | "bucket_bounds_v1" o "current_risk_buckets_legacy" | optimizer_core L1294 |
| `profile_limits` | Bandas del perfil (incluye Mixto decorativo) | optimizer_core L1279 |
| `constraint_hierarchy` | Texto descriptivo | optimizer_core L1295 |
| `portfolio_allocation` | Desglose equity/bond/cash/etc | optimizer_core L1370 |
| `Mixto` label | Etiqueta comercial frontend | rulesEngine.ts |
| `translateTechnicalWarning` | Traducción de warnings | normalizer.ts |

---

## 7. Tabla Campo por Campo

| Campo | Capa actual | Capa canónica | Fuente verdad | Riesgo | Acción |
|-------|------------|---------------|---------------|--------|--------|
| `risk_level` | Policy+Solver | Policy | Frontend | 🟡 Duplicado con profile_id | Deprecar, usar profile_id |
| `profile_id` | Policy | Policy | Frontend | 🟢 OK | Mantener como canónico |
| `optimization_mode` | Policy+Solver | Policy | Frontend raíz | 🟡 Duplicado 4x | Enviar solo raíz |
| `apply_profile` | Policy | Policy | constraints.apply_profile | 🟢 OK | Mantener |
| `locked_positions` | Solver | Solver | Frontend raíz | 🟡 Duplicado con fixed_weights | Unificar |
| `fixed_weights` | Solver | **DEPRECAR** | constraints.fixed_weights | 🟡 Duplicado | Eliminar, usar locked_positions |
| `lock_mode` | Solver | **DEPRECAR** | constraints.lock_mode | 🟡 Duplicado | Eliminar, usar locked_positions |
| `bucket_bounds_v1` | Solver | Solver | build_constraints_v1 | 🟢 Canónico | Mantener |
| `current_risk_buckets` | Solver (fallback) | Reporting | Firestore | 🟡 Legacy fallback | Documentar, converger |
| `classification_v2` | Suitability | Suitability | Firestore funds_v3 | 🟢 OK | Mantener |
| `portfolio_exposure_v2` | Solver+Suitability | Solver | Firestore funds_v3 | 🟢 OK | Mantener |
| `target_vol` | Solver+Reporting | Both | risk_budget_v1 | 🟢 OK | Mantener |
| `achieved_vol` | Reporting | Reporting | port_vol | 🟢 OK | Mantener |
| `vol_deviation` | Reporting | Reporting | calculated | 🟢 OK | Mantener |
| `Mixto` band | Policy (inerte) | Reporting | RISK_BUCKETS_LABELS | 🟡 Decorativo | Documentar |
| `solver_path` | Reporting | Reporting | internal | 🟢 OK | Mantener |
| `warnings` | Reporting | Reporting | internal | 🟢 OK | Mantener |

---

## 8. Riesgos

### 🔴 HIGH

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Cambiar estructura de payload sin backward compat | Rompe frontend | Fase gradual con tests |
| Eliminar current_risk_buckets sin migrar | Solver sin bounds | Mantener fallback |

### 🟡 MEDIUM

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| `risk_level` ≠ `profile_id` en edge case | Target vol vs bucket mismatch | Unificar |
| `optimization_mode` inconsistente por cascada 4x | Objetivo inesperado | Simplificar cascada |
| `fixed_weights` y `locked_positions` divergen | Lock incorrecto | Eliminar duplicado |
| `current_risk_buckets` tiene "Mixto" inerte | Confusión gestor | Documentar |

### 🟢 LOW

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Tests insuficientes para dedup | Regresión | Fase 0 tests |
| `asset_mix` vs `economic_exposure` confusión | Ninguno actual | Documentar |

---

## 9. Plan por Fases

### Fase 0 — Tests de contrato/dedup (Riesgo: Bajo)

| Acción | Archivos | Deploy |
|--------|----------|--------|
| Test: profile_id == risk_level siempre | test nuevo | NO |
| Test: optimization_mode cascada determinista | test nuevo | NO |
| Test: locked_positions y fixed_weights sync | test nuevo | NO |
| Test: bucket_bounds_v1 dedup con profile | existente | NO |
| Verificar golden tests existentes | existentes | NO |

### Fase 1 — Documentación inline (Riesgo: Bajo)

| Acción | Archivos | Deploy |
|--------|----------|--------|
| Comentarios en optimizer_core sobre jerarquía | optimizer_core.py | functions |
| Comentarios en constraints_builder_v1 | constraints_builder_v1.py | functions |
| Comentarios en config.py sobre Mixto decorativo | config.py | functions |

### Fase 2 — Payload normalization (Riesgo: Medio)

| Acción | Archivos | Deploy |
|--------|----------|--------|
| Frontend: eliminar constraints.fixed_weights | usePortfolioActions.ts, types/index.ts | hosting |
| Frontend: eliminar constraints.lock_mode | usePortfolioActions.ts | hosting |
| Backend: mantener backward compat temporal | endpoints_portfolio.py | functions |

### Fase 3 — Locks canonical (Riesgo: Medio)

| Acción | Archivos | Deploy |
|--------|----------|--------|
| Unificar a locked_positions como único canal | endpoints_portfolio.py, optimizer_core.py | functions |
| Frontend: solo enviar locked_positions | usePortfolioActions.ts | hosting |
| Tests: lock modes con nuevo canal | tests nuevos | NO |

### Fase 4 — Bucket bounds canonical (Riesgo: Bajo)

| Acción | Archivos | Deploy |
|--------|----------|--------|
| Documentar current_risk_buckets como legacy | optimizer_core.py | functions |
| Log warning si Mixto band se ignora | optimizer_core.py L692 | functions |
| Test: profile fallback solo sin v1 | test nuevo | NO |

### Fase 5 — Response diagnostics (Riesgo: Bajo)

| Acción | Archivos | Deploy |
|--------|----------|--------|
| Unificar explainability fields | optimizer_core.py | functions |
| Frontend: limpiar SmartPortfolioResponse duplicados | types/index.ts | hosting |
| target_vol/achieved_vol solo en metrics | optimizer_core.py, usePortfolioActions.ts | ambos |

### Fase 6 — Feasibility precheck (Riesgo: Bajo)

| Acción | Archivos | Deploy |
|--------|----------|--------|
| Verificar que precheck usa mismos bounds que solver | feasibility_precheck.py | functions |
| Test: precheck coherente con solver bounds | test nuevo | NO |

---

## 10. Tests Recomendados

| ID | Test | Objetivo |
|----|------|----------|
| T-1 | `test_profile_id_equals_risk_level_in_payload` | Confirmar que frontend siempre envía profile_id == String(risk_level) |
| T-2 | `test_optimization_mode_cascade_deterministic` | Verificar que la cascada de 4 fuentes produce resultado predecible |
| T-3 | `test_locked_positions_supersedes_fixed_weights` | Confirmar prioridad de locked_positions sobre constraints.fixed_weights |
| T-4 | `test_bucket_bounds_v1_disables_profile_buckets` | Dedup funciona: v1 activo → profile SKIPPED |
| T-5 | `test_current_risk_buckets_mixto_silently_ignored` | Mixto en profile no genera constraint |
| T-6 | `test_constraints_v1_overrides_strategy_constraints` | constraints_v1 manda sobre STRATEGY_CONSTRAINTS |
| T-7 | `test_response_vol_metrics_consistent` | target_vol, achieved_vol, vol_deviation coherentes |
| T-8 | `test_feasibility_precheck_uses_same_bounds_as_solver` | Precheck y solver usan misma fuente |

---

## 11. Qué NO Hacer

| ❌ Prohibición | Razón |
|---------------|-------|
| NO mezclar con parser | Scopes independientes |
| NO Firestore writes en este bloque | Solo plan |
| NO deploy sin tests de Fase 0 | Sin red de seguridad |
| NO cambiar perfiles sin aprobación | Puede romper producción |
| NO reintroducir Mixto hard constraint | Doble counting, infeasibilidad |
| NO cambiar payload en caliente sin backward compat | Rompe frontend existente |
| NO eliminar current_risk_buckets sin confirmar v1 activo | Solver sin bounds |
| NO tocar lógica matemática del solver | Fuera de scope |

---

## 12. Próximo Bloque Recomendado

### Opción A: `BDB-OPT-CONSTRAINTS-CANONICAL-TESTS-0`

Tests de contrato para blindar el estado actual antes de cualquier cleanup.

### Opción B: `BDB-OPT-PAYLOAD-CONTRACT-AUDIT-0`

Auditoría detallada del contrato frontend-backend con propuesta de schema estricto.

**Recomendación:** Opción A primero (tests), luego B.

---

## 13. Decisión Final

### Estado: `BDB_OPTIMIZER_CONSTRAINTS_CANONICAL_CLEANUP_PLAN_READY`

El plan está completo. Principales hallazgos:

1. **4 duplicidades activas** en el payload (risk_level/profile_id, optimization_mode 4x, locked_positions/fixed_weights, lock_mode 2x)
2. **1 campo decorativo** (Mixto band en current_risk_buckets — nunca inyectado al solver)
3. **1 dedup funcional** (bucket_bounds_v1 vs current_risk_buckets — funciona correctamente)
4. **Jerarquía canónica clara:** Investment Policy → Suitability → Solver Constraints → Reporting
5. **6 fases** de cleanup ordenadas por riesgo, todas con backward compatibility

Siguiente acción: aprobar plan → ejecutar Fase 0 (tests de contrato).
