# Quick Win Report: Eliminación de Doble Inyección de Bucket Constraints

**Fecha:** 2026-05-05  
**Autor:** Antigravity (Claude 4.6)  
**Estado:** Implementado — pendiente commit/push/deploy.

---

## A. Resumen Ejecutivo

Se ha implementado un cambio mínimo (12 líneas añadidas, 3 eliminadas) en `optimizer_core.py` para evitar que el solver CVXPY reciba **dos conjuntos redundantes de hard constraints** sobre los mismos vectores de exposición económica.

**Antes:** Tanto `bucket_bounds_v1` como `current_risk_buckets` se inyectaban como hard constraints simultáneamente, generando hasta 4 desigualdades por bucket cuando 2 bastaban.

**Después:** Si `bucket_bounds_v1` contiene bounds activos, el bloque de `current_risk_buckets` se omite para el solver. Si `bucket_bounds_v1` está vacío o ausente, el legacy funciona exactamente igual que antes.

---

## B. Archivos Modificados

| Archivo | Tipo | Líneas cambiadas |
|---------|------|-----------------|
| `functions_python/services/portfolio/optimizer_core.py` | MODIFICADO | +12 / -3 |
| `functions_python/tests/test_bucket_constraints_dedup.py` | NUEVO | 278 líneas |
| `docs/BUCKET_CONSTRAINTS_DUPLICATION_AUDIT.md` | NUEVO (previo) | Auditoría completa |
| `docs/BUCKET_CONSTRAINTS_DUPLICATION_QUICK_WIN_REPORT.md` | NUEVO | Este documento |

---

## C. Diff Aplicado

### `optimizer_core.py` — `_apply_standard_constraints()`

**Cambio 1: Flag de detección (L507)**
```diff
     # Canonical constraints_v1 bucket bounds
+    _v1_has_active_bounds = False
     if isinstance(bucket_bounds_v1, dict):
         ...
             if b_min is not None and b_min > 1e-6:
                 ef_inst.add_constraint(...)
+                _v1_has_active_bounds = True
             if b_max is not None and b_max < 1.0 - 1e-6:
                 ef_inst.add_constraint(...)
+                _v1_has_active_bounds = True
```

**Cambio 2: Condicional en bloque de perfil (L560)**
```diff
-    if apply_profile and risk_level_i in current_risk_buckets:
+    if apply_profile and risk_level_i in current_risk_buckets and not _v1_has_active_bounds:
         bucket_cfg = current_risk_buckets[risk_level_i]
         ...
+    elif apply_profile and _v1_has_active_bounds:
+        logger.info("ℹ️ [Optimizer] Profile bucket constraints SKIPPED: bucket_bounds_v1 already active")
```

**Cambio 3: Explainability (L1093-1116)**
```diff
-        if any(...):
-            binding_constraints.append("constraints_v1 bucket_bounds applied on portfolio_exposure_v2")
+        _v1_bounds_active = any(...)
+        if _v1_bounds_active:
+            binding_constraints.append("constraints_v1 bucket_bounds applied ... (canonical, profile buckets skipped)")
+        elif apply_profile:
+            binding_constraints.append("current_risk_buckets applied as legacy fallback (no bucket_bounds_v1)")
         ...
+            "bucket_constraints_source": "bucket_bounds_v1" if _v1_bounds_active else "current_risk_buckets_legacy",
```

---

## D. Fuente Canónica Final

| Rol | Fuente | Resultado |
|-----|--------|-----------|
| **Hard constraints del solver** | `bucket_bounds_v1` (cuando activo) | ✅ Canónico |
| **Hard constraints del solver** | `current_risk_buckets` (solo si v1 vacío) | ✅ Legacy fallback |
| **Suitability filter** | `current_risk_buckets` | ✅ Sin cambio |
| **Postprocess fallback** | `current_risk_buckets` | ✅ Sin cambio |
| **Explainability / Reporting** | Ambos documentados | ✅ Mejorado |

---

## E. Compatibilidad Legacy

| Escenario | Comportamiento | Estado |
|-----------|---------------|--------|
| Frontend envía `constraints_v1` con bounds del perfil | v1 activo → perfil skipped | ✅ Nuevo (dedup) |
| Frontend NO envía `constraints_v1` | v1 vacío → perfil legacy aplica | ✅ Igual que antes |
| `constraints_v1 = None` | v1 vacío → perfil legacy aplica | ✅ Igual que antes |
| `apply_profile = false` | Ni v1 ni perfil aplican buckets | ✅ Igual que antes |
| Locked assets | Siempre aplican, independiente de v1/perfil | ✅ Verificado |
| Mixto como hard constraint | Nunca se inyecta al solver (sin vector) | ✅ Verificado |

---

## F. Tests Ejecutados y Resultado

### Tests Nuevos (`test_bucket_constraints_dedup.py`)

| Test | Resultado |
|------|-----------|
| `test_v1_active_skips_profile_constraints` | ✅ PASSED |
| `test_v1_empty_uses_profile_legacy` | ✅ PASSED |
| `test_v1_none_uses_profile_legacy` | ✅ PASSED |
| `test_aggressive_p8_maintains_equity_constraint_via_v1` | ✅ PASSED |
| `test_aggressive_p10_maintains_constraints` | ✅ PASSED |
| `test_no_profile_no_constraints_applied` | ✅ PASSED |
| `test_skip_log_emitted_when_v1_active` | ✅ PASSED |
| `test_mixto_not_injected_as_hard_constraint` | ✅ PASSED |
| `test_locked_assets_preserved_with_v1_active` | ✅ PASSED |

**Total: 9/9 PASSED**

### Tests de Regresión (`test_optimizer_invariants.py`)

| Test | Resultado |
|------|-----------|
| `test_weights_sum` | ✅ PASSED |
| `test_weights_non_negative` | ✅ PASSED |
| `test_covariance_psd` | ✅ PASSED |
| `test_frontier_monotonic_vol` | ✅ PASSED |
| `test_frontier_roof_property` | ✅ PASSED |
| `test_max_sharpe_on_or_below_frontier` | ✅ PASSED |
| `test_calculate_portfolio_metrics_consistency` | ✅ PASSED |
| `test_frontier_points_have_valid_weights` | ✅ PASSED |

**Total: 8/8 PASSED**

### Tests Pre-existentes (`test_optimizer_core.py`)

| Test | Resultado | Nota |
|------|-----------|------|
| `test_optimizer_valid_frontier` | ❌ FAILED | **PRE-EXISTENTE** (falla también en master limpio) |
| `test_optimizer_fallback_path` | ❌ FAILED | **PRE-EXISTENTE** (historial insuficiente: 500 < 756 días) |

Verificado con `git stash` + re-ejecución en master limpio: mismos fallos exactos. **No es regresión.**

---

## G. Riesgos Pendientes

1. **Si `_resolve_bucket_bounds` en `constraints_builder_v1.py` deja de heredar del perfil canónico**, el solver quedaría sin bucket constraints. Mitigación: la función ya hereda por defecto — verificar que no haya regresión futura.

2. **Divergencia UI vs Solver**: El frontend `rulesEngine.ts` muestra barras de perfil basadas en Firestore. Si los bounds de v1 difieren sutilmente, el usuario podría ver conformidad visual pero el solver habría optimizado con bounds ligeramente distintos. Riesgo bajo mientras v1 herede del mismo perfil.

3. **Tests `test_optimizer_core.py` rotos**: Pre-existente, no relacionado con este cambio. Requieren actualizar el fixture de datos de precio a ≥756 días.

---

## H. Reversión

Para revertir completamente este cambio:

1. En `_apply_standard_constraints()`: eliminar `_v1_has_active_bounds = False`, las 2 líneas `_v1_has_active_bounds = True`, y revertir la condición a `if apply_profile and risk_level_i in current_risk_buckets:` eliminando el `elif`.

2. En `run_optimization()`: revertir el bloque de `binding_constraints` y eliminar `bucket_constraints_source` del dict de explainability.

3. Eliminar `tests/test_bucket_constraints_dedup.py`.

---

## I. Confirmación

| Regla | Cumplida |
|-------|----------|
| NO frontend modificado | ✅ |
| NO firestore.rules tocado | ✅ |
| NO credenciales tocadas | ✅ |
| NO deploy realizado | ✅ |
| NO push realizado | ✅ |
| NO commit realizado | ✅ |
| Cambios backend-only mínimos | ✅ (1 archivo, 12 líneas) |
| Reversible | ✅ |
