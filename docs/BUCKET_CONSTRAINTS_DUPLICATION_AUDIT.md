# Auditoría: Doble Inyección de Constraints de Buckets en el Optimizador

**Fecha:** 2026-05-05  
**Alcance:** Solo lectura. Sin modificaciones de código, deploy ni push.  
**Archivos auditados:**
- `functions_python/services/portfolio/constraints_builder_v1.py`
- `functions_python/services/portfolio/optimizer_core.py`
- `functions_python/api/endpoints_portfolio.py`
- `functions_python/services/config.py`
- `functions_python/models/constraints_v1.py`
- `functions_python/services/portfolio/utils.py`
- `frontend/src/hooks/usePortfolioActions.ts`
- `frontend/src/utils/rulesEngine.ts`

---

## A. Resumen Ejecutivo

**DUPLICIDAD CONFIRMADA.** El solver CVXPY recibe **dos conjuntos de restricciones de asset allocation** sobre los mismos vectores de exposición económica, aplicados como **hard constraints** simultáneos dentro de `_apply_standard_constraints()` (optimizer_core.py, líneas 507-568):

| Fuente | Variable | Líneas | Buckets | Tipo |
|--------|----------|--------|---------|------|
| **constraints_v1.bucket_bounds** | `bucket_bounds_v1` | 508-522 | equity, bond, cash, alternative, real_asset, other (6 buckets) | Hard constraint |
| **Firestore risk_profiles** | `current_risk_buckets` | 560-568 | RV, RF, Monetario, Alternativos, Otros (5 buckets comerciales) | Hard constraint |

Ambos se aplican como desigualdades lineales `w @ v >= min` / `w @ v <= max` sobre vectores de exposición **construidos desde la misma fuente de datos** (`portfolio_exposure_v2`). Esto genera redundancia matemática y riesgo de contradicción silenciosa.

Existe un mecanismo de reconciliación parcial (`_reconcile_bucket_vs_profile`, líneas 405-459) que relaja el perfil cuando detecta contradicciones con bucket_bounds_v1, pero **solo cubre contradicciones directas min>max**, no redundancias sutiles ni acumulaciones de restricciones que estrechen el espacio factible.

---

## B. Mapa Completo de Entrada de Constraints

```
Frontend (usePortfolioActions.ts)
  └─ buildOptimizationPayload()
       ├─ risk_level / profile_id
       ├─ locked_positions (mode + positions)
       ├─ asset_metadata (classification_v2)
       ├─ constraints: { apply_profile: true, lock_mode, fixed_weights }
       └─ tactical_views
            │
            ▼
Endpoint (endpoints_portfolio.py)
  ├─ _load_canonical_profile(db, profile_id)    → profile_payload (Firestore)
  ├─ _build_effective_constraints(req_data)      → STRATEGY_CONSTRAINTS
  ├─ build_constraints_v1(profile, mode, locks)  → constraints_v1 (Pydantic)
  │     └─ _resolve_bucket_bounds(profile, overrides) → BucketBoundsV1
  ├─ _build_asset_metadata(db, assets)           → asset_metadata (Firestore)
  └─ run_optimization(assets, risk_level, db, constraints, constraints_v1, ...)
            │
            ▼
Optimizer Core (optimizer_core.py)
  ├─ _build_optimization_context(db, constraints)
  │     └─ Lee system_settings/risk_profiles → current_risk_buckets  ← FUENTE 2
  ├─ bucket_bounds_v1 = constraints_v1.bucket_bounds                 ← FUENTE 1
  ├─ _reconcile_bucket_vs_profile(bucket_bounds_v1, current_risk_buckets)
  └─ _apply_standard_constraints(ef, ..., current_risk_buckets, ..., bucket_bounds_v1)
        ├─ [L508-522] bucket_bounds_v1 → 6 hard constraints (equity/bond/cash/alt/real/other)
        └─ [L560-568] current_risk_buckets → 5 hard constraints (RV/RF/Monetario/Alt/Otros)
```

---

## C. Flujo Detallado Frontend → Endpoint → Builder → Solver

### C1. Frontend (`usePortfolioActions.ts`)

**El frontend NO envía `bucket_bounds` ni `current_risk_buckets` directamente.** Solo envía:
- `risk_level` / `profile_id` (número 1-10)
- `constraints: { apply_profile: true }`
- `locked_positions`, `asset_metadata`, `tactical_views`

Los buckets se resuelven **enteramente en backend**. El `rulesEngine.ts` del frontend solo se usa para generación local de borradores (`GENERAR`), **no para optimización remota**.

### C2. Endpoint (`endpoints_portfolio.py`)

1. `_load_canonical_profile(db, profile_id)` → carga el perfil desde `system_settings/risk_profiles/{id}` incluyendo sus `bucket_bounds` si existen.
2. `build_constraints_v1(profile, ...)` → `_resolve_bucket_bounds(profile, overrides)` construye `BucketBoundsV1` leyendo del perfil cargado o de overrides del frontend.
3. El objeto `constraints_v1` se serializa y se pasa a `run_optimization()`.

### C3. Optimizer Core (`optimizer_core.py`)

1. `_build_optimization_context()` **lee otra vez** `system_settings/risk_profiles` desde Firestore → `current_risk_buckets` (línea 175-178).
2. Extrae `bucket_bounds_v1` del dict `constraints_v1` (línea 911).
3. Ejecuta reconciliación parcial (línea 977-980).
4. **Inyecta ambos** en `_apply_standard_constraints()`.

---

## D. Tabla de Constraints

| Constraint | Fuente | Hard/Soft/Report | Buckets afectados | Vector base | Riesgo |
|---|---|---|---|---|---|
| `bucket_bounds_v1.equity` | constraints_builder → profile.bucket_bounds | **HARD** | equity | `eq_v` | Redundante con RV del perfil |
| `bucket_bounds_v1.bond` | constraints_builder → profile.bucket_bounds | **HARD** | bond | `bd_v` | Redundante con RF del perfil |
| `bucket_bounds_v1.cash` | constraints_builder → profile.bucket_bounds | **HARD** | cash | `cs_v` | Redundante con Monetario |
| `bucket_bounds_v1.alternative` | constraints_builder → profile.bucket_bounds | **HARD** | alternative | `al_v` | Parcial overlap con Alternativos |
| `bucket_bounds_v1.real_asset` | constraints_builder → profile.bucket_bounds | **HARD** | real_asset | `ra_v` | Incluido en Alternativos del perfil |
| `bucket_bounds_v1.other` | constraints_builder → profile.bucket_bounds | **HARD** | other | `ot_v` | Redundante con Otros |
| `current_risk_buckets.RV` | Firestore direct read | **HARD** | RV | `eq_v` | **MISMO VECTOR que equity** |
| `current_risk_buckets.RF` | Firestore direct read | **HARD** | RF | `bd_v` | **MISMO VECTOR que bond** |
| `current_risk_buckets.Monetario` | Firestore direct read | **HARD** | Monetario | `cs_v` | **MISMO VECTOR que cash** |
| `current_risk_buckets.Alternativos` | Firestore direct read | **HARD** | Alternativos | `al_v + ra_v` | **Agrega alternative+real_asset** |
| `current_risk_buckets.Otros` | Firestore direct read | **HARD** | Otros | `ot_v` | **MISMO VECTOR que other** |
| Geo (europe/americas/emerging) | STRATEGY_CONSTRAINTS | **HARD** | Regiones | region vectors | Independiente |
| group_limits | STRATEGY_CONSTRAINTS | **HARD** | Custom | custom vectors | Independiente |

---

## E. Evidencia de Duplicidad

### E1. Duplicidad directa confirmada

En `_apply_standard_constraints()`:

**Líneas 508-522** (bucket_bounds_v1):
```python
vector_map = { "equity": eq_v, "bond": bd_v, "cash": cs_v, ... }
for bucket_key, vec in vector_map.items():
    b_min, b_max = _read_bound(bucket_bounds_v1.get(bucket_key))
    if b_min is not None: ef.add_constraint(lambda w, v=vec, m=b_min: w @ v >= m)
    if b_max is not None: ef.add_constraint(lambda w, v=vec, m=b_max: w @ v <= m)
```

**Líneas 560-568** (current_risk_buckets):
```python
profile_vectors = _build_profile_bucket_vectors(eq_v, bd_v, cs_v, al_v, ra_v, ot_v)
# profile_vectors = { "RV": eq_v, "RF": bd_v, "Monetario": cs_v, "Alternativos": al_v+ra_v, "Otros": ot_v }
for bucket_name, vec in profile_vectors.items():
    min_val, max_val = _read_bound(bucket_cfg.get(bucket_name))
    if min_val is not None: ef.add_constraint(lambda w, v=vec, m=min_val: w @ v >= m)
    if max_val is not None: ef.add_constraint(lambda w, v=vec, m=max_val: w @ v <= m)
```

**Resultado:** Para `equity`/`RV`, `bond`/`RF`, `cash`/`Monetario` y `other`/`Otros`, se aplican **exactamente los mismos vectores** con potencialmente **diferentes min/max**, generando hasta **4 desigualdades por bucket** (2 de cada fuente) cuando con 2 bastaría.

### E2. Divergencia en Alternativos

`bucket_bounds_v1` separa `alternative` (vector `al_v`) y `real_asset` (vector `ra_v`).  
`current_risk_buckets` los agrupa en `Alternativos` (vector `al_v + ra_v`).  
Esto puede crear una contradicción: si v1 permite hasta 10% en `alternative` y 10% en `real_asset` (total 20%), pero el perfil limita `Alternativos` a 15%, el solver puede fallar.

### E3. Bucket "Mixto" ausente en v1

`RISK_BUCKETS_LABELS` en config.py incluye un bucket **"Mixto"** con límites por perfil, pero `_build_profile_bucket_vectors()` **no genera un vector para "Mixto"** — solo genera RV, RF, Monetario, Alternativos, Otros. Por tanto, los límites de "Mixto" del seed **nunca se aplican al solver**. Sin embargo, si Firestore contiene un campo "Mixto" en el perfil, tampoco se aplicaría porque no hay vector construido para ello.

---

## F. Riesgos Concretos por Perfil

| Perfil | Riesgo principal |
|--------|-----------------|
| 1-3 (Conservador) | Mínimo. Ambas fuentes suelen alinearse en RF alta / RV baja. Redundancia inocua. |
| 4-6 (Moderado) | Medio. Si bucket_bounds_v1 viene vacío (lo normal sin overrides), solo aplica perfil. Sin conflicto real pero hay constraints fantasma vacías. |
| 7 (Dinámico) | Medio-Alto. RV: 70-90% en perfil. Si bucket_bounds_v1 trae un equity.max de 80% del perfil canónico, se aplica doble: max_sharpe puede quedar atrapado. |
| 8-10 (Agresivo) | **ALTO**. RV ≥ 85-95%. Doble restricción puede reducir el espacio factible a un punto único, forzando fallback_equal_weight innecesariamente. El fix de `objective → max_sharpe` para P8+ mitiga parcialmente, pero las constraints siguen duplicadas. |

---

## G. Impacto sobre Mixto

Tras los cambios recientes de taxonomía:
1. **En el solver**, los fondos Mixtos se descomponen por look-through (`portfolio_exposure_v2`) en equity/bond/etc. Un fondo Mixto 60/40 contribuye 0.6 al vector equity y 0.4 al vector bond.
2. **bucket_bounds_v1** y **current_risk_buckets** actúan sobre esos vectores descompuestos, no sobre una categoría "Mixto" como tal.
3. **No hay riesgo directo** de que Mixto cause conflicto de doble inyección, porque el bucket "Mixto" del seed nunca se inyecta al solver (no tiene vector).
4. **Riesgo indirecto**: Un fondo Mixto agresivo (85% equity) contribuye fuertemente al vector equity, y si ambas fuentes imponen límites estrictos sobre equity, puede estrechar el espacio factible más de lo esperado.

---

## H. Recomendación de Fuente Canónica

| Rol | Fuente recomendada | Justificación |
|-----|-------------------|---------------|
| **Constraints matemáticas del solver** | `constraints_v1.bucket_bounds` (vía constraints_builder) | Es el contrato tipado (Pydantic), validado, con merge de overrides. Soporta 6 buckets granulares. Se construye una sola vez en el endpoint. |
| **Reporting / Suitability / UI** | `current_risk_buckets` (Firestore risk_profiles) | Útil para mostrar al usuario los límites comerciales, filtrar elegibilidad pre-solver, y generar explicabilidad post-solver. No debería duplicar constraints en CVXPY. |

**Arquitectura target:**
```
constraints_v1.bucket_bounds  →  SOLVER (hard constraints)
current_risk_buckets          →  SUITABILITY FILTER + REPORTING + EXPLAINABILITY
```

---

## I. Qué Dejar para Reporting/Suitability

| Componente | Mantener para | Eliminar de |
|------------|--------------|-------------|
| `current_risk_buckets` lectura en `_build_optimization_context` | Suitability filter (L196-220), postprocess fallback (L823-850), explainability (L1096-1111) | `_apply_standard_constraints` L560-568 |
| `RISK_BUCKETS_LABELS` (config.py) | Seed/inicialización de Firestore, referencia documental | Ningún cambio necesario |
| Frontend `rulesEngine.ts` | Generación local (`GENERAR`), visualización de barras de perfil | Sin cambios |

---

## J. Quick Wins sin Implementar

### QW-1: Flag de desactivación de perfil duplicado (SEGURO, REVERSIBLE)
Añadir un flag `skip_profile_bucket_constraints` en `_apply_standard_constraints`. Si `bucket_bounds_v1` tiene al menos un bound definido, saltarse el bloque L560-568 del perfil. Esto es un `if` de 3 líneas.

### QW-2: Logging de redundancia (SEGURO, DIAGNÓSTICO)
Antes de inyectar cada constraint, loguear si ya existe una constraint equivalente de la otra fuente. Esto no cambia el solver pero permite auditar en producción qué restricciones realmente se duplican.

### QW-3: Unificar la lectura de Firestore (SEGURO, PERFORMANCE)
`_load_canonical_profile` (endpoint) y `_build_optimization_context` (optimizer_core) leen **el mismo documento** `system_settings/risk_profiles` por separado. Pasar `current_risk_buckets` como parámetro a `run_optimization` en vez de releer.

### QW-4: Validación pre-solver de espacio factible (SEGURO)
Antes de llamar a `ef.efficient_risk()`, calcular si la intersección de ambos conjuntos de restricciones deja un espacio factible no-vacío. Log warning si la intersección es más estrecha que cualquier fuente individual.

---

## K. Riesgos de Migración

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| **Eliminar perfil sin migrar bounds** | Si `bucket_bounds_v1` llega vacío (lo normal sin overrides del frontend), el solver quedaría SIN restricciones de asset allocation | Asegurar que `_resolve_bucket_bounds` siempre hereda del perfil Firestore cuando no hay override explícito |
| **Romper fallback equal-weight** | `_postprocess_weights` (L823) usa `current_risk_buckets` para el fallback ponderado. Si se elimina esa variable, el fallback queda ciego | Mantener `current_risk_buckets` disponible para fallback/reporting, solo eliminar su inyección en el solver |
| **Romper suitability filter** | `_apply_suitability_filter` no usa buckets directamente, usa `is_fund_eligible_for_profile`. Sin riesgo | Ninguno |
| **Divergencia con frontend** | El frontend `rulesEngine.ts` muestra barras de perfil basadas en sus seeds locales (o Firestore). Si el solver deja de respetar esos mismos límites, la UI mostrará conformidad pero el solver habrá optimizado con bounds distintos | Asegurar que `constraints_builder_v1` siempre lea los mismos bounds que el frontend muestra |

---

## L. Prompt Recomendado para Implementar (si el usuario aprueba)

```
AGENTE: [modelo] en Antigravity IDE

TAREA: Eliminar la doble inyección de bucket constraints en el optimizador.

REGLAS ESTRICTAS:
- NO tocar frontend.
- NO tocar firestore.rules.
- NO tocar credenciales.
- NO cambiar RISK_BUCKETS_LABELS ni config.py.
- NO eliminar current_risk_buckets de _build_optimization_context.
- Cambios solo en optimizer_core.py (función _apply_standard_constraints).
- Mantener current_risk_buckets para: suitability, postprocess fallback, explainability.

IMPLEMENTACIÓN:
1. En _apply_standard_constraints(), envolver el bloque L560-568 (perfil) con:
   if not bucket_bounds_v1 or not any(v.get("min") or v.get("max") for v in bucket_bounds_v1.values()):
       # Solo aplicar perfil si bucket_bounds_v1 está vacío
   Esto asegura que si constraints_v1 trae bounds, el perfil NO duplica.

2. Asegurar que _resolve_bucket_bounds en constraints_builder_v1.py
   SIEMPRE hereda del perfil canónico cuando no hay override explícito
   (ya lo hace, verificar que no hay regresión).

3. Añadir log: "ℹ️ [Optimizer] Profile bucket constraints SKIPPED: 
   bucket_bounds_v1 already active" cuando se salte.

4. Ejecutar tests existentes.
5. Crear docs/BUCKET_CONSTRAINTS_DEDUP_IMPLEMENTATION_REPORT.md.
6. NO hacer deploy ni push sin aprobación.

VALIDACIÓN:
- npm run build (frontend sin cambios).
- Tests Python existentes si los hay.
- Documentar escenarios de test recomendados por perfil.
```

---

## Conclusión

La duplicidad es **real y confirmada**. Ambas fuentes inyectan hard constraints sobre los mismos vectores de exposición. La reconciliación parcial existente (`_reconcile_bucket_vs_profile`) mitiga contradicciones directas, pero no elimina la redundancia ni previene el estrechamiento acumulativo del espacio factible.

El quick win más seguro es **QW-1**: condicionar la inyección del bloque de perfil a que `bucket_bounds_v1` esté vacío, manteniendo `current_risk_buckets` solo para suitability, fallback y reporting.
