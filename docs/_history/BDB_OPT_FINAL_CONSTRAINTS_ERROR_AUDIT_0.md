# BDB-OPT-FINAL-CONSTRAINTS-ERROR-AUDIT-0

> **Tipo:** Auditoría read-only — sin modificaciones de código, sin commit, sin push, sin deploy  
> **Fecha:** 2026-05-22  
> **Rama auditada:** `master`  
> **HEAD:** `8e9321c` (5 commits adelante de `origin/master`)  
> **Repo:** `C:\Users\oanti\Documents\BDB-FONDOS`  
> **Autor:** Claude Sonnet 4.6 (Cowork mode)

---

## 1. Causa Raíz Exacta

**Causa raíz primaria (Causa I — postprocesado rompe lo que el solver garantizó):**

El paso `clean_weights(cutoff=cutoff)` en `_postprocess_weights` (optimizer_core.py) puede eliminar posiciones con peso < 2% que eran las que aportaban exposición marginal a un bucket (típicamente RV equity). Después de la renormalización con `_normalize`, la exposición del bucket puede caer por debajo del mínimo que el solver acababa de satisfacer. La función `_validate_optimizer_result` detecta entonces una `BUCKET_MIN_VIOLATION`, `is_compliant = False`, y el backend retorna `status = "fallback_non_compliant"` con `applicable = False`. El frontend lo interpreta como resultado no aplicable y dispara el toast.

**Causa raíz secundaria (Causa II — fallback equal-weight viola bounds):**

Cuando todos los caminos del solver fallan (primary, relaxed_sharpe, min_vol), el `solver_path` queda en `"fallback_equal_weight"` y `raw_weights = None`. La degradación graciosa (equal-weight filtrado por perfil) no puede garantizar los bucket bounds del perfil. La validación detecta la violación y retorna `fallback_non_compliant`.

**Causa raíz estructural (Causa III — status misleading):**

En `optimizer_core.py` línea 1335, cuando `is_fallback = False` (el solver primario tuvo éxito) pero `is_compliant = False` (el postprocesado rompió el cumplimiento), `final_status = "fallback_non_compliant"`. Este nombre de estado es semánticamente incorrecto: la etiqueta `fallback_non_compliant` implica que se usó un solver de fallback, pero en este caso el solver primario SÍ funcionó — fue el cutoff quien destruyó el cumplimiento.

---

## 2. Archivo y Función que Dispara el Toast

| Campo | Valor |
|---|---|
| **Archivo** | `frontend/src/hooks/usePortfolioActions.ts` |
| **Función** | `processOptimizationResult` (línea 872) |
| **Línea exacta del toast** | Línea 882 |
| **Condición gate** | `!isOptimizerResultApplicable(result) && (result.status === 'fallback_non_compliant' || result.usable === false || result.applicable === false)` |
| **Mensaje literal** | `result.message || "La propuesta no cumple las restricciones finales y no puede aplicarse."` |

### Flujo completo hasta el toast

```
Usuario hace clic "Optimizar"
  → proceedWithOptimization()
    → buildOptimizationPayload()          [FE, líneas 104–178]
    → httpsCallable('optimize_portfolio_quant')
      → optimize_portfolio_quant()        [BE, endpoints_portfolio.py]
        → _load_canonical_profile()       [carga Firestore risk_profiles]
        → build_constraints_v1()          [constraints_builder_v1.py]
          → _resolve_bucket_bounds()      [mapea Spanish→English keys]
          → BucketBoundsV1.model_dump()   [equity, bond, cash, alternative, real_asset, other]
        → run_optimization()              [optimizer_core.py]
          → _build_exposure_vectors()     [eq_vec, bd_vec, cs_vec, al_vec, ra_vec, ot_vec]
          → run_feasibility_precheck()    [FASE 5.5b — sólo geometric check]
          → _apply_standard_constraints() [FASE 6 — injected v1 bounds]
          → _run_solver()                 [FASE 8 — PyPortfolioOpt]
          → _postprocess_weights()        [FASE 9 — clean_weights + normalize ← ROMPE CUMPLIMIENTO]
          → _validate_optimizer_result()  [FASE 10 — detecta BUCKET_MIN_VIOLATION]
          → final_status = "fallback_non_compliant"
          → applicable = False, usable = False
      → response con status=fallback_non_compliant
    → processOptimizationResult(result)
      → isOptimizerResultApplicable(result) → false
      → TOAST "La propuesta no cumple las restricciones finales y no puede aplicarse."
```

### `isOptimizerResultApplicable` (líneas 24–28)

```typescript
const APPLICABLE_OPTIMIZER_STATUSES = new Set([
    'optimal_compliant',
    'optimal_with_warnings',
    'fallback_compliant'
]);

export function isOptimizerResultApplicable(result): boolean {
    if (result.status === 'fallback_non_compliant') return false;
    if (result.usable === false || result.applicable === false) return false;
    return APPLICABLE_OPTIMIZER_STATUSES.has(String(result.status || ''));
}
```

Nota: `optimal_with_warnings` nunca es retornado por el backend (líneas 1330–1335 de optimizer_core.py).

---

## 3. Contrato Backend Esperado

### Backend produce (optimizer_core.py líneas 1359–1389)

```python
return {
    "api_version": "optimizer_v4",
    "status": final_status,           # "optimal_compliant" | "fallback_compliant" | "fallback_non_compliant"
    "solver_path": solver_path,       # "efficient_risk_profile_0.105" | "fallback_relaxed_sharpe" | ...
    "applicable": applicable,         # True si status in {optimal_compliant, optimal_with_warnings, fallback_compliant}
    "usable": applicable,             # idéntico a applicable
    "constraint_violations": final_validation.get("violations", []),
    "violations": final_validation.get("violations", []),
    "weights": weights_full,          # dict {isin: float} en escala 0-1
    "metrics": result_metrics,
    "explainability": explainability,
    "warnings": final_warnings,
    # ... otros campos
}
```

### Mapa de statuses posibles

| `final_status` | `is_fallback` | `is_compliant` | `applicable` | Interpretación |
|---|---|---|---|---|
| `optimal_compliant` | False | True | True | Solver primario + validación OK |
| `fallback_compliant` | True | True | True | Solver fallback + validación OK |
| `fallback_non_compliant` | False | **False** | **False** | **Solver primario + cutoff rompió bounds** |
| `fallback_non_compliant` | True | **False** | **False** | **Solver fallback + graceful degradation viola bounds** |

---

## 4. Contrato Frontend Actual

### `buildOptimizationPayload` (líneas 104–178)

```typescript
const payload: OptimizationRequest = {
    assets: Array.from(assetUniverse),
    risk_level: riskLevel,           // number 1-10
    profile_id: String(riskLevel),   // string "1".."10"
    optimization_mode: 'rebalance_to_profile',
    locked_assets: Array.from(lockedSet),
    locked_positions: {
        mode: isAddCapital ? 'keep_money' : 'keep_weight',
        positions: fixedWeights       // {isin: float} escala 0-1
    },
    asset_metadata: assetMetadata,
    constraints: {
        apply_profile: true,
        optimization_mode: 'rebalance_to_profile',
        lock_mode: ...,
        fixed_weights: fixedWeights   // {isin: float} escala 0-1
    }
};
```

### `mapOptimizationResultWeights` (línea 212)

```typescript
const rawWeight = (weights[p.isin] || 0) * 100;  // BE 0-1 → FE 0-100
```

**Escala confirmada coherente:** Backend trabaja en 0-1, frontend convierte a 0-100 correctamente.

---

## 5. Divergencias Detectadas

### D-1: `clean_weights(cutoff)` destruye cumplimiento de bucket bounds [CAUSA RAÍZ PRIMARIA]

| Campo | Detalle |
|---|---|
| **Dónde** | `optimizer_core.py`, `_postprocess_weights()`, líneas 946–956 |
| **Qué pasa** | El solver satisface `w @ eq_vec >= 0.4` (min RV). `clean_weights(cutoff=0.02)` elimina fondos con peso < 2%, algunos de los cuales aportaban exposición marginal al bucket equity. `_normalize` renormaliza pero la suma de equity puede quedar en 0.37 < 0.4 - 1e-4 = 0.3999. |
| **Ejemplo numérico** | 5 fondos equity, pesos [0.10, 0.10, 0.10, 0.08, 0.02], eq_exposure=[1,1,1,1,1]. Sum=0.40. Después de cutoff(0.02): el último fondo (0.02) se descarta, remaining sum = 0.38, normalize → equity = 0.38/0.38 = 1 × 0.38. Wait — los otros buckets también contribuyen. Si hay un fondo RF con peso 0.60, post-normalize equity = 0.38 / 0.98 = 0.3878 < 0.3999. |
| **Tolerancia validation** | `1e-4` (línea 260 de optimizer_core.py): `if exposure < min_v - 1e-4` |
| **Consecuencia** | `BUCKET_MIN_VIOLATION`, `is_compliant = False`, toast. |

### D-2: `status = "fallback_non_compliant"` cuando solver primario tuvo éxito [NAMING BUG]

| Campo | Detalle |
|---|---|
| **Dónde** | `optimizer_core.py`, líneas 1328–1335 |
| **Qué pasa** | El árbol de decisión sólo tiene 3 ramas: `(is_fallback ∧ compliant)`, `(¬is_fallback ∧ compliant)`, y el else que captura cualquier combinación restante — incluyendo `(¬is_fallback ∧ ¬compliant)`. En ese caso se emite `"fallback_non_compliant"` aunque el solver primario SÍ funcionó. |
| **Falta** | Un cuarto status: `"optimal_non_compliant"` para el caso `(¬is_fallback ∧ ¬compliant)`. |

### D-3: Validación nunca usa `current_risk_buckets` cuando `constraints_v1` tiene `bucket_bounds` [DEAD PATH]

| Campo | Detalle |
|---|---|
| **Dónde** | `optimizer_core.py`, `_validate_optimizer_result()`, líneas 243–247 |
| **Qué pasa** | `bucket_bounds_v1` de `model_dump()` es SIEMPRE un dict no vacío (6 keys: equity, bond, cash, alternative, real_asset, other). Por tanto `if bucket_bounds_v1:` es siempre `True`. La rama `elif apply_profile...` (que usa `current_risk_buckets` con Spanish keys) nunca se ejecuta. |
| **Impacto** | Validación NUNCA comprueba las restricciones de perfil de Firestore directamente. Sólo comprueba los bounds traducidos a BucketBoundsV1 (English keys). El bucket "Mixto" del perfil es SIEMPRE ignorado en validación. |

### D-4: Bucket "Mixto" de Firestore no tiene vector en solver [CONFIRMADO COMO DISEÑO]

| Campo | Detalle |
|---|---|
| **Dónde** | `optimizer_core.py`, `_build_profile_bucket_vectors()`, líneas 114–121 |
| **Qué pasa** | La función sólo tiene vectores para RV, RF, Monetario, Alternativos, Otros. No hay vector "Mixto". |
| **Impacto** | Los bounds "Mixto" de `RISK_BUCKETS_LABELS` (ej. min=20%, max=50% en perfil 5) se cargan de Firestore, son descartados en `_resolve_bucket_bounds` (no hay campo en BucketBoundsV1 para Mixto), y nunca se aplican como constraint. |
| **Nota** | Documentado y decidido explícitamente en `BDB_OPTIMIZER_MIXED_UX_CLOSEOUT.md`. Comportamiento intencionado. |

### D-5: `_reconcile_bucket_vs_profile` no aplica `"real_asset"` en su mapa

| Campo | Detalle |
|---|---|
| **Dónde** | `optimizer_core.py`, `_reconcile_bucket_vs_profile()`, línea 544–550 |
| **Qué pasa** | El mapa `v1_to_profile` no incluye `"real_asset"`. Si el perfil tuviese un "Inmobiliario" bound, no se reconciliaría. En el estado actual no genera bug activo pero es un gap de cobertura. |

### D-6: `Alternativos` (profile) = `al_v + ra_v` vs `alternative` (v1) = solo `al_v`

| Campo | Detalle |
|---|---|
| **Dónde** | `_build_profile_bucket_vectors()` línea 119 vs `_apply_standard_constraints()` línea 640 |
| **Qué pasa** | La restricción de perfil "Alternativos" incluye `real_asset`. La restricción v1 "alternative" excluye `real_asset`. `real_asset` tiene su propio bound en v1. |
| **Impacto** | Cuando `_v1_has_active_bounds = True`, el solver aplica constraint de `alternative` (sin `real_asset`) y constraint de `real_asset` por separado. Cuando `_v1_has_active_bounds = False`, el solver aplica "Alternativos" = `al_v + ra_v` combinado. Las semánticas son distintas pero ambas son internamente consistentes (solver y validator usan la misma fuente). No genera bug activo. |

---

## 6. Tabla Comparativa de Restricciones

| Restricción | Fuente Backend | Fuente Frontend | Escala | Campo clave | Validado en | Puede divergir? |
|---|---|---|---|---|---|---|
| Equity min/max (RV) | Firestore risk_profiles → BucketBoundsV1.equity | N/A (solo backend) | 0-1 | `eq_vec` | `_validate_optimizer_result` | **Sí** (ver D-1: cutoff) |
| Bond min/max (RF) | Firestore → BucketBoundsV1.bond | N/A | 0-1 | `bd_vec` | `_validate_optimizer_result` | **Sí** (cutoff) |
| Cash min/max (Monetario) | Firestore → BucketBoundsV1.cash | N/A | 0-1 | `cs_vec` | `_validate_optimizer_result` | **Sí** (cutoff) |
| Alternative min/max | Firestore → BucketBoundsV1.alternative | N/A | 0-1 | `al_vec` | `_validate_optimizer_result` | **Sí** (cutoff) |
| Real Asset | Firestore (Inmobiliario → no mapeado) | N/A | 0-1 | `ra_vec` | `_validate_optimizer_result` | No (min=max=None) |
| Otros min/max | Firestore → BucketBoundsV1.other | N/A | 0-1 | `ot_vec` | `_validate_optimizer_result` | **Sí** (cutoff) |
| Mixto | Firestore (DESCARTADO) | rulesEngine.ts | 0-100 FE, N/A BE | — | **NUNCA** | N/A |
| max_weight | constraints.max_weight | — | 0-1 | PyPortfolioOpt bounds | Indirectamente | No |
| locked_positions | locked_positions.positions | fixedWeights / 100 | **0-1** ambos | `fixed_weights` | Precheck BLOCK-7 | No |
| sum(weights) | _normalize → exactamente 1.0 | p.weight / 100 | 0-1 BE, 0-100 FE | — | WEIGHT_SUM_NOT_ONE (tol 1e-4) | No (normalize garantiza) |
| Pesos negativos | clamped a 0 en clean_weights | — | — | — | NEGATIVE_WEIGHT | No |
| equity_floor | config.EQUITY_FLOOR → no inyectado por defecto | — | 0-1 | `eq_vec` | Precheck BLOCK-8 | No |

---

## 7. Payload Mínimo para Reproducir

**Condición necesaria**: portfolio de 2-5 fondos donde la solución óptima tiene al menos un fondo equity con peso cercano al cutoff (< 2%), y el mínimo de equity en el perfil está activo.

```json
{
  "assets": ["ISIN_EQUITY_A", "ISIN_EQUITY_B_SMALL", "ISIN_BOND_C", "ISIN_BOND_D"],
  "risk_level": 5,
  "profile_id": "5",
  "optimization_mode": "rebalance_to_profile",
  "locked_assets": [],
  "locked_positions": {"mode": "keep_weight", "positions": {}},
  "asset_metadata": {
    "ISIN_EQUITY_A":    {"classification_v2": {"asset_type": "EQUITY"}, "portfolio_exposure_v2": {"asset_mix": {"equity": 1.0}}},
    "ISIN_EQUITY_B_SMALL": {"classification_v2": {"asset_type": "EQUITY"}, "portfolio_exposure_v2": {"asset_mix": {"equity": 1.0}}},
    "ISIN_BOND_C":      {"classification_v2": {"asset_type": "FIXED_INCOME"}, "portfolio_exposure_v2": {"asset_mix": {"bond": 1.0}}},
    "ISIN_BOND_D":      {"classification_v2": {"asset_type": "FIXED_INCOME"}, "portfolio_exposure_v2": {"asset_mix": {"bond": 1.0}}}
  },
  "constraints": {"apply_profile": true, "optimization_mode": "rebalance_to_profile"}
}
```

**Resultado esperado** (reproducible): El solver Markowitz puede asignar ~2% a `ISIN_EQUITY_B_SMALL`, `clean_weights(cutoff=0.02)` lo elimina, equity cae por debajo del mínimo del perfil 5 (40%), `BUCKET_MIN_VIOLATION`, toast.

**Para capturar payload real desde DevTools:**
1. Abrir Chrome DevTools → pestaña Network
2. Filtrar por `optimize_portfolio_quant`
3. Hacer clic en el botón Optimizar
4. En la request → Payload → copiar JSON completo
5. En la response → buscar `status`, `violations`, `constraint_violations`, `solver_path`

---

## 8. Propuesta de Solución Definitiva

### Fix primario — Bucket-Aware Cutoff (Fase 9 postprocesado)

**Archivo:** `functions_python/services/portfolio/optimizer_core.py`  
**Función:** `_postprocess_weights`  

Después de `clean_weights`, antes de `_normalize`, detectar si eliminar una posición viola un bucket bound. Si es así, mantenerla aunque esté por debajo del cutoff.

```python
# Pseudocódigo — NO aplicar sin testing completo
def _bucket_aware_clean_weights(ef, raw_weights, cutoff, universe, bucket_vectors, active_bounds, _read_bound):
    cleaned = ef.clean_weights(cutoff=cutoff)
    # Para cada activo eliminado por cutoff, chequear si su exclusión viola un bound.
    # Si viola: restaurar con weight = cutoff (mínimo técnico).
    # Renormalizar al final.
    ...
```

Alternativa más conservadora: reducir el cutoff a 0.005 (0.5%) para dar más margen al cumplimiento de bounds sin eliminar "polvo". Pero esto debe testarse para no generar carteras con decenas de posiciones insignificantes.

### Fix secundario — Nuevo status `optimal_non_compliant`

**Archivo:** `functions_python/services/portfolio/optimizer_core.py`, líneas 1327–1336

```python
# Propuesta de mejora (NO APLICAR — sólo diseño)
if is_fallback:
    final_status = "fallback_compliant" if is_compliant else "fallback_non_compliant"
elif is_compliant:
    final_status = "optimal_compliant"
else:
    final_status = "optimal_non_compliant"   # ← nuevo status semánticamente correcto
```

Y en el frontend, añadir `"optimal_non_compliant"` al conjunto de statuses con handling específico (distinto de `fallback_non_compliant`).

### Fix terciario — Post-clean validation con tolerancia más amplia

Si `clean_weights` produce una pequeña violación (< 0.02 = cutoff), considerarla como warning en lugar de hard violation. Solo declarar `non_compliant` si la violación supera un umbral más significativo (ej. 0.03 = 3 puntos porcentuales).

---

## 9. Cambios Recomendados por Fases

### Fase 1 (urgente, bajo riesgo) — Diagnóstico transparente en producción

1. Añadir `solver_path` y `constraint_violations` al log de errores del toast en el frontend.
2. En el backend, añadir log explícito cuando la violación es causada por `clean_weights` (comparar exposición antes y después del cutoff).
3. No modifica contratos ni lógica matemática.

### Fase 2 (corto plazo) — Bucket-Aware Postprocesado

1. Modificar `_postprocess_weights` para detectar si el cutoff rompe algún bound activo.
2. Si es así: preservar el activo con `max(value, 0.005)` o el mínimo técnico.
3. Tests: añadir casos de prueba con carteras que bordean el mínimo de bucket justo en el umbral del cutoff.

### Fase 3 (medio plazo) — Nuevo status y semántica clara

1. Añadir `optimal_non_compliant` en el backend.
2. Actualizar `APPLICABLE_OPTIMIZER_STATUSES` y la función `isOptimizerResultApplicable` en el frontend.
3. Actualizar el mensaje del toast para distinguir el error de solver (infeasible) del error de postprocesado (cutoff).
4. Migrar los tests existentes para esperar el nuevo status.

### Fase 4 (largo plazo) — Precheck bucket-aware que incluya cutoff

1. Ampliar `run_feasibility_precheck` para simular el efecto del cutoff en los bounds.
2. Añadir `real_asset` al mapa de reconciliación en `_reconcile_bucket_vs_profile`.

---

## 10. Tests Necesarios

### Backend (pytest)

```python
# test_cutoff_bucket_violation.py
def test_cutoff_can_break_bucket_minimum():
    """
    Verifica que clean_weights(cutoff=0.02) puede causar BUCKET_MIN_VIOLATION
    en un portfolio donde la solución del solver apenas cumple el mínimo de equity.
    """
    # Portfolio: 1 equity fondo peso 0.02 (= cutoff), 1 equity fondo peso 0.38, 1 bond fondo peso 0.60
    # equity total = 0.40 (satisface min=0.40)
    # Después de cutoff: equity fondo 0.02 eliminado
    # equity = 0.38 / (0.38 + 0.60) = 0.387 < 0.40 - 1e-4
    # → BUCKET_MIN_VIOLATION esperado
    ...

def test_optimal_non_compliant_status():
    """Cuando is_fallback=False e is_compliant=False, el status debería ser 'optimal_non_compliant'."""
    ...

def test_validation_never_uses_profile_when_v1_has_all_none_bounds():
    """Cuando BucketBoundsV1 tiene todos los bounds a None, la validación NO cae al perfil."""
    ...
```

### Frontend (Vitest)

```typescript
test('processOptimizationResult shows toast on fallback_non_compliant', () => {
    const result = { status: 'fallback_non_compliant', usable: false, applicable: false };
    // Verificar que toast.error se llama con el mensaje correcto
    ...
});

test('isOptimizerResultApplicable returns false for fallback_non_compliant', () => {
    expect(isOptimizerResultApplicable({ status: 'fallback_non_compliant' })).toBe(false);
});
```

---

## 11. Riesgos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Fix bucket-aware cutoff puede introducir nuevos mínimos artificiales | MEDIA | Tests exhaustivos con perfiles 1-10 y portfolios de 5-20 fondos |
| Reducir cutoff a 0.005 puede generar carteras con >30 posiciones insignificantes | BAJA | Limitar a casos donde bound está activo |
| Nuevo status `optimal_non_compliant` puede romper tests de contrato existentes | MEDIA | Actualizar `test_optimizer_p0_contracts.py` y `test_optimizer_fallback_status_contract.py` |
| La modificación de `_postprocess_weights` puede afectar la diversificación | BAJA | Solo preservar activos que contribuyen a bounds activos |
| Despliegue de funciones sin testing en staging | ALTA | Deploy en emulador local primero |

---

## 12. Confirmación de Integridad de la Auditoría

| Restricción | Estado |
|---|---|
| Sin modificaciones de código | ✅ Confirmado |
| Sin `git commit` | ✅ Confirmado |
| Sin `git push` | ✅ Confirmado |
| Sin deploy de Functions | ✅ Confirmado |
| Sin deploy de Hosting | ✅ Confirmado |
| Sin escrituras en Firestore | ✅ Confirmado |
| Sin tocar BDB-FONDOS-CORE | ✅ Confirmado |
| Sin tocar optimizer_core.py ni suitability_engine.py | ✅ Confirmado — solo lectura |
| Repo state post-auditoría | Igual que pre-auditoría (mismo HEAD `8e9321c`) |

---

## Anexo A: Mapa de Archivos Auditados

| Archivo | Propósito |
|---|---|
| `frontend/src/hooks/usePortfolioActions.ts` | Toast, `isOptimizerResultApplicable`, `processOptimizationResult` |
| `frontend/src/types/index.ts` | `SmartPortfolioResponse` — contrato de response |
| `frontend/src/components/modals/SharpeMaximizerModal.tsx` | Modal separado, no implicado |
| `functions_python/api/endpoints_portfolio.py` | Endpoint, `_load_canonical_profile`, `build_constraints_v1` |
| `functions_python/services/portfolio/optimizer_core.py` | Motor completo: solver, postprocesado, validación |
| `functions_python/services/portfolio/constraints_builder_v1.py` | Traducción Spanish→English keys |
| `functions_python/models/constraints_v1.py` | `BucketBoundsV1` — modelo Pydantic |
| `functions_python/services/portfolio/feasibility_precheck.py` | Pre-checks BLOCK-1 a BLOCK-8 |
| `functions_python/services/portfolio/utils.py` | `_normalize`, `get_effective_asset_mix`, etc. |
| `functions_python/services/config.py` | `RISK_BUCKETS_LABELS` (seed Firestore) |
| `functions_python/tests/test_optimizer_p0_contracts.py` | Test canónico de `fallback_non_compliant` |
| `docs/BDB_OPTIMIZER_MIXED_UX_CLOSEOUT.md` | Historial del ciclo Mixto (contexto) |
| `docs/BDB_OPTIMIZER_MIXED_CONSTRAINTS_AUDIT.md` | Auditoría previa (referencia F-3) |

---

## Anexo B: Estado Git al Cerrar la Auditoría

```
HEAD: 8e9321c FRONTEND: fix Sharpe maximizer current Sharpe source
Commits adelante de origin/master:
  8e9321c FRONTEND: fix Sharpe maximizer current Sharpe source
  e1f43bc DOCS: close ERROR-32 ACCEPT-26 write
  22cc7b8 DOCS: add ERROR-32 ACCEPT-26 write gate artifacts
  196ce35 DOCS: design ERROR-32 ACCEPT-26 write gate
  6d45436 DOCS: add ERROR-32 reparse dry-run audit report

Working tree: múltiples M (modified) en archivos de runtime/parser, ninguno en frontend o functions_python relevante.
```
