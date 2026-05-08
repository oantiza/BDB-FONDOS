# BDB-FONDOS: Auditoría de Restricciones del Optimizador para Fondos Mixtos

> **Tipo:** Auditoría read-only  
> **Fecha:** 2026-05-08  
> **Estado:** DOCUMENTO INFORMATIVO — NO se modificó código  
> **Autor:** Antigravity IDE (Claude 4.6)  
> **HEAD:** `c8a28b4` (master sincronizado con origin)

---

## 1. Resumen Ejecutivo

Esta auditoría examina cómo el motor de optimización de BDB-FONDOS trata los **fondos mixtos** (`asset_type = MIXED | ALLOCATION`) a lo largo de toda la cadena: clasificación → suitability → bucket constraints → solver → validación.

### Hallazgos Principales

| # | Hallazgo | Severidad | Componente |
|---|----------|-----------|------------|
| **F-1** | El bucket "Mixto" **no tiene vector de exposición** en el solver backend | 🔴 CRÍTICA | `optimizer_core.py` |
| **F-2** | Frontend y backend aplican lógica de look-through **divergente** para Mixtos | 🟡 MEDIA | `rulesEngine.ts` vs `utils.py` |
| **F-3** | Los min-sum de buckets pueden superar 100% en perfiles intermedios (3-5) | 🟡 MEDIA | `config.py` / Firestore |
| **F-4** | Suitability engine no tiene reglas específicas para Mixtos | 🟢 BAJA | `suitability_engine.py` |
| **F-5** | Fallback del backend para Mixtos sin exposure: 50/50 equity/bond | 🟡 MEDIA | `utils.py` L344 |
| **F-6** | Frontend asigna Mixtos a bucket "Mixto" pero backend los descompone | 🟡 MEDIA | Arquitectura |

---

## 2. Arquitectura de la Cadena de Restricciones

```
┌─────────────────────────────────────────────────────────────────┐
│                     FLUJO DE CONSTRAINTS                        │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ Firestore    │───▶│ config.py    │───▶│ optimizer_core   │  │
│  │ risk_profiles│    │ SEED fallback│    │ _apply_standard  │  │
│  └──────────────┘    └──────────────┘    │ _constraints()   │  │
│                                          └────────┬─────────┘  │
│                                                   │             │
│  ┌──────────────┐    ┌──────────────────┐         ▼             │
│  │ suitability  │───▶│ Pre-solver       │    ┌─────────┐       │
│  │ _engine.py   │    │ feasibility_     │───▶│ PyPfOpt │       │
│  │ (Hard Gate)  │    │ precheck.py      │    │ Solver  │       │
│  └──────────────┘    └──────────────────┘    └─────────┘       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ FRONTEND (rulesEngine.ts) — RÉPLICA DE PRESENTACIÓN     │   │
│  │ Solo para UX local. NO es fuente de verdad del solver.  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Definición de Perfiles y Buckets

### 3.1 Backend: `config.py` → `RISK_BUCKETS_LABELS`

Define **6 buckets** con bandas min/max por perfil (1-10):

| Bucket | Perfil 1 | Perfil 3 | Perfil 5 | Perfil 7 | Perfil 9 | Perfil 10 |
|--------|----------|----------|----------|----------|----------|-----------|
| **RV** | 0-10% | 10-25% | 40-60% | 70-90% | 95-100% | 95-100% |
| **RF** | 20-60% | 40-70% | 20-40% | 0-20% | 0-5% | 0-5% |
| **Mixto** | 0-20% | 10-30% | 20-50% | 0-20% | 0-5% | 0-5% |
| **Monetario** | 40-80% | 10-30% | 0-10% | 0-5% | 0-0% | 0-5% |
| **Alternativos** | 0-10% | 0-15% | 0-20% | 0-15% | 0-5% | 0-5% |
| **Otros** | 0-10% | 0-20% | 0-25% | 0-20% | 0-5% | 0-0% |

### 3.2 Frontend: `rulesEngine.ts` → `RISK_PROFILES`

Define la **misma estructura de 6 buckets** pero con valores ligeramente diferentes en formato `{ min, max }` (base 100):

| Bucket | Perfil 1 | Perfil 5 | Perfil 9 |
|--------|----------|----------|----------|
| **RV** | 0-10 | 40-60 | 95-100 |
| **RF** | 20-60 | 20-40 | 0-5 |
| **Mixto** | 0-20 | 20-50 | 0-5 |
| **Monetario** | 40-80 | 0-10 | 0-0 |
| **Alternativos** | 0-10 | 0-20 | 0-5 |
| **Otros** | 0-10 | 0-25 | 0-5 |

> ✅ **Verificación:** Las seeds del frontend y backend son **idénticas en valores** (salvo escala: frontend base-100, backend base-1). Coherencia confirmada.

---

## 4. Análisis de Hallazgos

### F-1: 🔴 El bucket "Mixto" NO tiene vector de exposición en el solver

**Ubicación:** `optimizer_core.py` líneas 114-121

```python
def _build_profile_bucket_vectors(eq_v, bd_v, cs_v, al_v, ra_v, ot_v):
    return {
        "RV": eq_v,
        "RF": bd_v,
        "Monetario": cs_v,
        "Alternativos": al_v + ra_v,
        "Otros": ot_v,
    }
```

**Problema:**  
La función construye vectores de perfil para **5 buckets** (RV, RF, Monetario, Alternativos, Otros), pero las `RISK_BUCKETS_LABELS` definen restricciones para **6 buckets** incluyendo **"Mixto"**.

Cuando `_apply_standard_constraints()` itera sobre `profile_vectors.items()` (L692), solo genera constraints para los 5 buckets que tienen vector. El bucket "Mixto" de `bucket_cfg` se lee en L693 con `bucket_cfg.get("Mixto")`, pero como `"Mixto"` no está en `profile_vectors`, **nunca se genera una constraint para el bucket Mixto**.

**Consecuencia:**  
- Las bandas `Mixto: (min, max)` definidas en Firestore/config **son silenciosamente ignoradas** por el solver CVXPY.
- Un portafolio podría tener 0% o 100% de exposición económica a Mixtos sin violar ninguna constraint.
- Esto **NO causa infeasibilidad**, pero sí viola la intención del gestor.

**Análisis causal:**  
La razón arquitectónica es que el backend **descompone** los fondos mixtos en sus componentes económicos subyacentes (equity + bond + cash). Un fondo mixto con 60% RV / 40% RF contribuye `0.6` al vector `eq_v` y `0.4` al vector `bd_v`. No existe un vector separado de "mixtura" porque el optimizer razona en términos de exposición económica real, no de etiqueta comercial.

**¿Es esto un bug o un diseño intencionado?**  
Es un **diseño intencionado con efecto colateral no documentado**. El look-through es financieramente correcto (un mixto 60/40 ES efectivamente 60% RV + 40% RF para propósitos de riesgo). Pero las bandas "Mixto" de `RISK_BUCKETS_LABELS` son entonces **decorativas**: existen para la UI del frontend pero no restringen nada en el solver.

---

### F-2: 🟡 Lógica de look-through divergente entre frontend y backend

**Frontend** (`rulesEngine.ts` L300-337 `getAssetClass()`):

```typescript
// Para MIXED/ALLOCATION: usa economic_exposure para reclasificar
if (classV2?.asset_type === 'MIXED' || classV2?.asset_type === 'ALLOCATION') {
    const bucketFromExposure = getAssetClassFromEconomicExposure(expV2);
    if (bucketFromExposure) return bucketFromExposure;  // → RV, RF, Monetario, etc.
    return 'Mixto';  // fallback sin datos
}
```

El frontend reclasifica un fondo MIXED en **un único bucket discreto** (el dominante). Un mixto 55% equity / 45% bond → `"Mixto"` (porque equity ≥ 25 && bond ≥ 25).

**Backend** (`utils.py` L255-294 `get_v2_asset_mix()` + L297-352 `get_effective_asset_mix()`):

```python
# Devuelve el desglose real fraccional
return {
    "equity": 0.55,
    "bond": 0.45,
    "cash": 0.0,
    "alternative": 0.0,
    "real_asset": 0.0,
    "other": 0.0,
}
```

El backend **preserva las fracciones reales** del fondo mixto, contribuyendo proporcionalmente a múltiples vectores de bucket.

**Impacto:**  
| Fondo Mixto (60% EQ / 40% Bond) | Frontend | Backend |
|----------------------------------|----------|---------|
| Clasificación para bucket | `"Mixto"` | 60% en `eq_v`, 40% en `bd_v` |
| ¿Consume quota del bucket "Mixto"? | ✅ Sí | ❌ No (bucket inexistente) |
| ¿Contribuye a restricción RV? | ❌ No | ✅ Sí (60%) |
| ¿Contribuye a restricción RF? | ❌ No | ✅ Sí (40%) |

**Consecuencia para el usuario:**  
La UI muestra que un portafolio tiene "20% Mixto" y dice que eso respeta la banda [0-20%], pero el solver nunca verificó esa banda. El solver solo verificó que el total ponderado de equity/bond/cash estuviera en las bandas de RV/RF/Monetario.

---

### F-3: 🟡 Riesgo de sum-of-mins > 100% en perfiles intermedios

Verificación aritmética de `RISK_BUCKETS_LABELS`:

| Perfil | Σ(min) | Σ(max) | ¿Feasible? |
|--------|--------|--------|------------|
| 1 | 0.60 | 1.90 | ✅ OK |
| 2 | 0.60 | 1.75 | ✅ OK |
| **3** | **0.70** | **1.90** | ✅ OK |
| **4** | **0.70** | **2.10** | ✅ OK |
| **5** | **0.80** | **2.05** | ✅ OK |
| 6 | 0.60 | 1.95 | ✅ OK |
| 7 | 0.70 | 1.70 | ✅ OK |
| 8 | 0.85 | 1.45 | ✅ OK |
| 9 | 0.95 | 1.20 | ✅ OK |
| 10 | 0.95 | 1.20 | ✅ OK |

> **Nota:** Las sumas son **de los 6 buckets** (incluyendo Mixto), pero como el solver solo inyecta 5 vectores (sin Mixto), la suma efectiva de mínimos inyectados es **menor** que la tabla anterior. Ejemplo perfil 5: Σ(min sin Mixto) = 0.60, perfectamente factible.

**Sin embargo**, si en el futuro se añade el vector "Mixto" al solver, los perfiles 3-5 podrían volverse **infeasibles** inmediatamente porque Σ(min con Mixto) = 0.70-0.80 + las restricciones de diversificación.

---

### F-4: 🟢 Suitability engine: sin reglas específicas para Mixtos

**Ubicación:** `suitability_engine.py`

El motor de idoneidad filtra fondos por:
- `risk_bucket == "HIGH"` para perfiles ≤ 2
- Equity exposure real > umbral (30%, 45%, 60%)
- Sector funds para perfiles ≤ 4
- Subtypes prohibidos (EMERGING_MARKETS_EQUITY, HIGH_YIELD_BOND, COMMODITIES)

**No hay reglas específicas para `asset_type == "allocation"`.** Esto es correcto para el enfoque look-through: un mixto se juzga por su equity real, no por su etiqueta. Un mixto moderado (30% equity) pasa para perfil 3 gracias a la regla `real_eq > 45` (L56-57).

**Riesgo menor:** Un fondo Mixto Agresivo (`AGGRESSIVE_ALLOCATION`) con 80% equity pero sin `is_suitable_low_risk = false` podría pasar el filtro para perfil 2 si su equity real reportada fuera < 30% por datos desactualizados.

---

### F-5: 🟡 Fallback Mixto sin exposure: 50/50 arbitrario

**Ubicación:** `utils.py` L343-344

```python
elif label_override == "Mixto":
    base = {"equity": 0.5, "bond": 0.5, ...}
```

Cuando un fondo con `asset_type = allocation` carece de `portfolio_exposure_v2` **y** de `metrics` **y** la identidad V2 no se resuelve, el último fallback legacy asigna un mix 50/50 equity/bond.

**Impacto:**
- Para perfiles conservadores (1-2), este 50% equity virtual hace que el fondo contribuya `0.5` al vector equity, potencialmente consumiendo buena parte del budget de RV.
- Para perfiles agresivos (8-10), solo contribuye 50% al equity, potencialmente siendo un lastre para alcanzar el equity_floor de 85-98%.

**Mitigación existente:** Los fondos sin V2 identity son bloqueados por `suitability_engine.py` L19-20 ("Strict V2 Requirement: Missing classification_v2"), por lo que este fallback raramente se activa en el solver real. Solo aplica si el fondo tiene `classification_v2` (con `asset_type`) pero carece de exposure data.

---

### F-6: 🟡 Desacoplamiento conceptual frontend ↔ backend para Mixtos

| Aspecto | Frontend (`rulesEngine.ts`) | Backend (`optimizer_core.py`) |
|---------|---------------------------|-------------------------------|
| Modelo mental | Bucket discreto "Mixto" | Descomposición continua por exposure |
| Vector constraint | No aplica (es UI) | No existe vector "Mixto" |
| Banda "Mixto" | Se muestra y valida localmente | Se ignora en el solver |
| Clasificación | Un fondo = 1 bucket | Un fondo = N fracciones de exposure |
| Fallback sin datos | → bucket `"Mixto"` (L317) | → `{"equity": 0.5, "bond": 0.5}` (L344) |

Este desacoplamiento **no causa bugs operativos** actualmente porque:
1. El frontend es explícitamente "réplica de presentación" (L9-13 de `rulesEngine.ts`).
2. El backend es la autoridad canónica del solver.
3. Los tests (`mixedFunds.test.ts`) validan el comportamiento del frontend de forma aislada.

Pero sí causa **confusión potencial** cuando un operador observa que la UI dice "25% Mixto" y el backend reporta "0% Mixto" en la validación post-optimización.

---

## 5. Tratamiento de Fondos MIXED en cada Componente

### 5.1 Taxonomía y Clasificación

```
classification_v2.asset_type = "MIXED" | "ALLOCATION"
                                   ↓
               ┌─────────────────────────────────────┐
               │    ¿Tiene portfolio_exposure_v2?     │
               └────────┬───────────────┬─────────────┘
                        │ SÍ            │ NO
                        ▼               ▼
              ┌──────────────┐    ┌──────────────┐
              │ Look-through │    │ Fallback      │
              │ Descomponer  │    │ 50/50 o       │
              │ por exposure │    │ bucket Mixto  │
              └──────────────┘    └──────────────┘
```

### 5.2 Normalización: `MIXED` vs `ALLOCATION`

| Capa | `MIXED` → | `ALLOCATION` → |
|------|-----------|----------------|
| `normalizer.ts` (FE) | `"MIXED"` | `"MIXED"` |
| `utils.py` (BE) | `"allocation"` | `"allocation"` |
| `fundTaxonomy.ts` (FE) | `"MIXED"` | `"MIXED"` |

> ✅ Coherencia verificada: ambos tokens convergen al mismo tipo canónico.

### 5.3 Suitability para Mixtos

```
is_fund_eligible_for_profile(meta, risk_profile)
    │
    ├─ ¿Tiene classification_v2? ─── NO ──▶ RECHAZADO (Strict V2)
    │
    ├─ ¿has_v2_exposure? ─── NO & profile ≤ 4 ──▶ RECHAZADO
    │                    └── NO & profile ≥ 5 ──▶ WARNING (continúa)
    │
    ├─ ¿real_eq > 30? & profile ≤ 2 ──▶ RECHAZADO
    ├─ ¿real_eq > 45? & profile = 3 ──▶ RECHAZADO
    ├─ ¿real_eq > 60? & profile = 4 ──▶ RECHAZADO
    │
    └─ Pasa ──▶ ELIGIBLE (sin regla específica para allocation)
```

### 5.4 Bucket Constraints en el Solver

```
RISK_BUCKETS_LABELS = {
    5: {
        "RV": (0.40, 0.60),      ← INYECTADO al solver con eq_v
        "RF": (0.20, 0.40),      ← INYECTADO al solver con bd_v
        "Mixto": (0.20, 0.50),   ← ❌ NO INYECTADO (sin vector)
        "Monetario": (0.0, 0.10),← INYECTADO al solver con cs_v
        "Alternativos": (0.0, 0.20),← INYECTADO al solver con al_v+ra_v
        "Otros": (0.0, 0.25),    ← INYECTADO al solver con ot_v
    }
}
```

---

## 6. Escenarios de Riesgo para Fondos Mixtos

### Escenario A: Mixto Agresivo en Perfil Conservador (3)

| Dato | Valor |
|------|-------|
| Fondo | Mixto con 70% equity, 25% bond, 5% cash |
| Perfil | 3 (Conservador) |
| Suitability | ❌ RECHAZADO (`real_eq > 45%`) |
| **Resultado** | **Correcto**: filtrado antes de llegar al solver |

### Escenario B: Mixto Moderado en Perfil Equilibrado (5)

| Dato | Valor |
|------|-------|
| Fondo | Mixto con 40% equity, 50% bond, 10% cash |
| Perfil | 5 (Equilibrado) |
| Suitability | ✅ ELIGIBLE |
| Backend exposure | `eq_v[i]=0.4`, `bd_v[i]=0.5`, `cs_v[i]=0.1` |
| Constraint RV (40-60%) | Contribuye 0.4 × w[i] |
| Constraint RF (20-40%) | Contribuye 0.5 × w[i] |
| Constraint **Mixto** (20-50%) | ❌ **No verificada** |
| **Resultado** | Financieramente correcto (look-through), pero la banda "Mixto" es inerte |

### Escenario C: Mixto sin Exposure en Perfil Agresivo (9)

| Dato | Valor |
|------|-------|
| Fondo | `asset_type=MIXED`, sin `portfolio_exposure_v2` |
| Perfil | 9 (Agresivo) |
| Suitability | ⚠️ WARNING pero no rechazado (profile > 4) |
| Backend exposure | Fallback: `eq_v[i]=0.5`, `bd_v[i]=0.5` |
| Constraint RV (95-100%) | Contribuye 0.5 × w[i] — **insuficiente** |
| **Resultado** | Potencial infeasibilidad si el universo tiene pocos fondos de RV puro |

---

## 7. Validación Post-Optimización

`_validate_optimizer_result()` (L179-281) verifica constraints de bucket contra `active_bounds`:

```python
bucket_vectors = _active_bucket_vectors_for_bounds(
    active_bounds, eq_v, bd_v, cs_v, al_v, ra_v, ot_v
)
```

La función `_active_bucket_vectors_for_bounds()` (L163-176) **sí mapea `"RV"`, `"RF"`, `"Monetario"`, `"Alternativos"`, `"Otros"`** además de los raw keys (`"equity"`, `"bond"`, etc.), pero **tampoco mapea `"Mixto"`**.

Resultado: si `active_bounds` contiene `"Mixto": (0.2, 0.5)`, la validación post-solver **no puede verificarlo** porque `bucket_vectors.get("Mixto")` retorna `None` (L256-257), y el check se salta silenciosamente.

---

## 8. Coherencia de Tests

### 8.1 `mixedFunds.test.ts` — Frontend

| Test | Qué verifica | Estado |
|------|-------------|--------|
| Sidebar Mixto filter | MIXED y ALLOCATION → filtro "Mixto" | ✅ PASS |
| Autocomplete agresivo | MIXED con 75%+ eq → permitido para P8+ | ✅ PASS |
| Look-through RV | MIXED 85% eq → clasificado como RV | ✅ PASS |
| Look-through RF | MIXED 20% eq / 75% bond → clasificado como RF | ✅ PASS |
| Sin exposure → Mixto | MIXED sin datos → "Mixto" (no promoted) | ✅ PASS |
| Taxonomy normalization | ALLOCATION → MIXED canonical | ✅ PASS |

### 8.2 Backend tests relevantes

| Test | Archivo |
|------|---------|
| Bucket constraints | `test_bucket_constraints_dedup.py` |
| Optimizer invariants | `test_optimizer_invariants.py` |
| P0 contract | `test_optimizer_p0_contracts.py` |
| Feasibility precheck | `test_feasibility_precheck.py` |

> **Nota:** No se encontraron tests backend específicos que validen el tratamiento del bucket "Mixto" en el solver. Los tests de constraints se centran en equity/bond/cash.

---

## 9. Recomendaciones

### R-1: Documentar el "Mixto Gap" como decisión de diseño (Prioridad: Alta)

El hecho de que "Mixto" no tenga vector en el solver es una decisión de diseño válida (look-through financiero). Pero debe documentarse explícitamente en `optimizer_core.py` para evitar confusiones futuras.

```python
# NOTA DE DISEÑO: No existe vector "Mixto" porque los fondos mixtos
# se descomponen en sus exposiciones económicas reales (equity, bond, cash).
# Las bandas "Mixto" de RISK_BUCKETS_LABELS solo aplican en la capa
# de presentación (frontend rulesEngine.ts) y NO se inyectan al solver.
```

### R-2: Alinear o separar las bandas "Mixto" en Firestore (Prioridad: Media)

Opciones:
1. **Eliminar** las bandas "Mixto" de `RISK_BUCKETS_LABELS` (y Firestore) para evitar la falsa impresión de que se aplican.
2. **Crear un vector "Mixto"** sintético (fondos cuyo `asset_type == "allocation"`, contribución = 1.0) para que el solver también limite la cantidad de fondos mixtos por nombre.
3. **Mantener status quo** pero con la documentación de R-1.

### R-3: Añadir test backend para tratamiento Mixto (Prioridad: Media)

Crear un test que verifique:
- Un fondo con `asset_type=MIXED` y exposure 60/40 contribuye `0.6` a `eq_v` y `0.4` a `bd_v`.
- El bucket "Mixto" no genera constraints en `_apply_standard_constraints()`.
- La validación post-solver no reporta false violations para "Mixto".

### R-4: Harmonizar la UI (Prioridad: Baja)

Considerar que la UI muestre la **descomposición look-through** además del (o en lugar del) bucket "Mixto", para que el operador vea lo mismo que el solver.

---

## 10. Conclusión

El tratamiento de fondos mixtos en BDB-FONDOS es **financieramente correcto** gracias al enfoque look-through del backend, que descompone cada fondo en sus exposiciones económicas reales. Sin embargo, existe un **desacoplamiento no documentado** entre las 6 bandas definidas para la UI (con "Mixto") y los 5 vectores del solver (sin "Mixto"), lo que hace que las restricciones de "Mixto" sean **meramente decorativas** en el motor cuantitativo.

Este desacoplamiento no causa errores operativos ni infeasibilidad, pero puede generar confusión en la interpretación de las restricciones por parte de los gestores. Se recomienda documentar esta decisión de diseño y evaluar si las bandas "Mixto" deben mantenerse, eliminarse, o hacerse efectivas con un vector propio.

---

## Apéndice: Archivos Auditados

| Archivo | Ruta | Rol |
|---------|------|-----|
| `optimizer_core.py` | `functions_python/services/portfolio/` | Motor principal de optimización |
| `utils.py` | `functions_python/services/portfolio/` | Extracción V2, asset mix, clasificación |
| `suitability_engine.py` | `functions_python/services/portfolio/` | Filtro de idoneidad pre-solver |
| `feasibility_precheck.py` | `functions_python/services/portfolio/` | Pre-checks de factibilidad |
| `config.py` | `functions_python/services/` | Seeds de perfiles, buckets, targets |
| `rulesEngine.ts` | `frontend/src/utils/` | Motor de reglas UI (presentación) |
| `normalizer.ts` | `frontend/src/utils/` | Normalización V2 para UI |
| `fundTaxonomy.ts` | `frontend/src/utils/` | Taxonomía canónica frontend |
| `mixedFunds.test.ts` | `frontend/src/__tests__/` | Tests de fondos mixtos (frontend) |
| `optimizerP0Contract.test.ts` | `frontend/src/__tests__/` | Contrato P0 del optimizador |
