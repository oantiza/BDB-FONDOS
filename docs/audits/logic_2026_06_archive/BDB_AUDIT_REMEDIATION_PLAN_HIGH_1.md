# BDB-FONDOS — Plan de Corrección de Hallazgos Altos — v2

**Fecha:** 31/05/2026 · **Sustituye a:** `BDB_AUDIT_REMEDIATION_PLAN_HIGH_0.md` (conservado por histórico).
**Estado:** PROPUESTA revisada tras *peer review*. Requiere las decisiones de la §2 antes de implementar.
**Naturaleza:** Documento de planificación; no modifica código fuente.

---

## Changelog v1 → v2 (qué cambia y por qué)

| # | Cambio | Motivo (peer review) |
|---|---|---|
| 1 | **D2 reescrito.** Se descarta "cablear `EQUITY_FLOOR`" como segunda política. El mínimo de RV y `equity_floor` operan sobre el **mismo eje** (`w · eq_v`, look-through). Nueva dirección: **derivar** el floor técnico del `rv_min` efectivo y **deprecar** `EQUITY_FLOOR`. | En el backend, la banda RV ya se aplica sobre exposición económica (`eq_v`), no sobre "fondos clasificados RV". `EQUITY_FLOOR` y `rv_min` son redundantes (y contradictorios en 7-9). |
| 2 | **CI movido al frente** (Fase 0), antes era el último ítem. Incluye reproducibilidad de la suite, no solo el `.github/workflows`. | Sin red de seguridad ejecutable, el refactor de contrato es ciego. El `npm test` raíz es un stub y la suite backend depende hoy de un venv de Windows. |
| 3 | **Q1 tratado explícitamente como refactor de contrato**, con lista de tests que **se romperán a propósito** y deben migrarse. | Tests actuales *fijan* el comportamiento vigente (p. ej. `test_mixto_not_injected_as_hard_constraint`). Romperlos es esperado, no una regresión. |
| 4 | **A6 separado como quick win independiente** del refactor grande. | `compatible_profiles` cacheado puede hacer que la UI diga "apto" y el motor excluya: riesgo en vivo que no debe esperar a Q1. |
| 5 | **Reordenación por riesgo-a-confianza:** A5 → A6 → Q1 (arrastra A1/A3) → A2. | Mixto sin aplicar y `equity_floor` dormido son *seguros*; lo que muerde en operación es la relajación silenciosa (A5) y la obsolescencia (A6). |

---

## 0. Veredicto y principio rector

No es "el optimizador está roto", sino **contratos solapados y documentación que promete más de lo que el
motor aplica**. Es serio por la confianza en las carteras, no por una caída funcional. El objetivo de la
remediación es: **una sola fuente de verdad de cotas, un solo inyector de restricciones, cero parámetros
declarados que no se apliquen, y cero relajaciones silenciosas.**

**Orden por riesgo-a-confianza (no por elegancia):**

```
A5 (relajación silenciosa)  →  A6 (paridad UI/motor)  →  Q1 (unificación, arrastra A1 y A3)  →  A2 (equity floor)
   ↑ se realiza como primer       ↑ quick win independiente,    ↑ refactor de contrato          ↑ se reduce a "derivar
     entregable del refactor Q1      puede ir en paralelo                                          + deprecar"
```

---

## 1. Mapa de dependencias (actualizado)

```
                    ┌─────────────────────────────┐
                    │ Q1  Dos sistemas paralelos   │  ← causa raíz estructural
                    │ (BucketBoundsV1 vs perfil)   │
                    └───────┬───────────────┬──────┘
        omite "Mixto" en    │               │  lógica "o uno u otro" + reconciliación
        AMBOS caminos       │               │  que RELAJA en silencio
                    ▼       │               ▼
        ┌───────────────────┐       ┌───────────────────────────────┐
        │ A1  Mixto sin cota │       │ A5  relajación silenciosa      │
        └───────────────────┘       │ (se cierra DENTRO de Q1)       │
        ┌───────────────────┐       └───────────────────────────────┘
        │ A3  caps muertos   │
        └───────────────────┘

   Independientes del refactor de constraints:
   ┌──────────────────────────────┐   ┌───────────────────────────────────────────┐
   │ A6  compatible_profiles stale │   │ A2  equity_floor: MISMO eje que rv_min →    │
   │ (quick win propio)            │   │ derivar del rv_min efectivo, no 2ª política │
   └──────────────────────────────┘   └───────────────────────────────────────────┘
```

---

## 2. Decisiones requeridas (Fase de decisión)

### D1 — Destino del bucket «Mixto»  *(sin cambios respecto a v1)*

| Opción | Implica | Recomendación |
|---|---|---|
| **(a) Retirar Mixto como cota** | El *look-through* ya gobierna; Mixto pasa a etiqueta comercial/reporting. | **Recomendada.** Coherente con lo que el motor ya hace; más limpio financieramente. |
| (b) Vector indicador `Mixto` | Cota dura sobre "proporción de vehículos mixtos". | Solo si negocio lo exige; **riesgo de sobrerrestricción en perfiles 3-5**. |

### D2 — Política de mínimo de equity  *(REESCRITO en v2 — corrige el error de v1)*

**Corrección:** en v1 se afirmó que `EQUITY_FLOOR` era "equity económico con look-through" y `rv_min` medía
"fondos clasificados RV". **Es incorrecto en el backend actual.** El mínimo de RV se inyecta como
`w · eq_v ≥ rv_min`, y `eq_v` proviene de `_extract_bucket_exposure_from_meta_v2` → `get_effective_asset_mix`
(exposición económica con look-through). El chequeo de `equity_floor` (precheck/auto-expand) usa el **mismo**
`eq_vec`. Por tanto **ambos son suelos sobre el mismo eje** `w · eq_v`:

| Perfil | `EQUITY_FLOOR` | `rv_min` (banda RV) | Suelo vinculante = `max` | Observación |
|:---:|:---:|:---:|:---:|---|
| 1 | 5 % | 0 % | 5 % | cablear ⇒ mete equity nuevo en perfil defensivo |
| 2 | 10 % | 0 % | 10 % | íd. |
| 3 | 20 % | 10 % | 20 % | EQUITY_FLOOR domina |
| 4 | 30 % | 20 % | 30 % | íd. |
| 5 | 40 % | 40 % | 40 % | idénticos |
| 6 | 55 % | 50 % | 55 % | EQUITY_FLOOR domina |
| 7 | 65 % | 70 % | 70 % | **rv_min domina ⇒ EQUITY_FLOOR redundante** |
| 8 | 75 % | 85 % | 85 % | **íd.** |
| 9 | 85 % | 95 % | 95 % | **íd.** |
| 10 | 98 % | 95 % | 98 % | EQUITY_FLOOR domina |

Conclusión: `EQUITY_FLOOR` no añade una dimensión nueva; añade un **segundo suelo sobre el mismo eje**,
redundante (3-6, 10) o dominado (7-9), e introduce equity no deseado en 1-2.

**Decisión (recomendada):**

1. **Deprecar `EQUITY_FLOOR`** como política separada en `config.py` (junto con `BOND_CAP`/`CASH_CAP`, A3).
2. **Derivar el `equity_floor` técnico en runtime del `rv_min` efectivo** (el resultante tras la fusión de
   precedencia de la Fase 2, no el estático de config), únicamente para alimentar el *feasibility precheck* y
   el *auto-expand*. Así el precheck "ve" exactamente la misma cota que el solver, sin segunda política.
3. **Nota de futuro:** si negocio quisiera algún día un suelo de **clase RV pura** (distinto del equity
   económico), eso sería un **vector indicador nuevo** (igual que el de Mixto), no `EQUITY_FLOOR`. El motor
   hoy solo tiene el eje económico; no se conserva la constante "por si acaso".

### D3 — `alternative` vs `real_asset`  *(sin cambios respecto a v1)*

Combinar en "Alternativos" (`al_v + ra_v`) como vocabulario canónico (coincide con la salida del optimizador
y con `rulesEngine.ts`). Recomendado: **combinar**.

---

## 3. Fase 0 — CI y reproducibilidad de la suite  *(NUEVA posición: primero)*

> Es la red de seguridad de todo lo demás. Sin esto, el refactor de contrato (Fase 2) es ciego.

**Estado actual (evidencia):** `package.json` raíz tiene `"test": "echo \"Error: no test specified\" && exit 1"`;
no hay `.github/workflows`; la suite backend (31 tests) depende de un venv de Windows y de deps pesadas
(`pypfopt`, `cvxpy`, `firebase-admin`), por lo que no arranca en frío en un entorno limpio.

**Entregables (en este orden):**

1. **Reproducibilidad backend:** `functions_python/requirements.txt` con versiones **pinneadas**; verificar
   `python -m pytest tests/ -q` en una imagen Linux limpia (sin el venv de Windows). Añadir `pytest.ini`/`conftest.py` si hace falta para el `sys.path`.
2. **Runner unificado:** reemplazar el stub de `npm test` por un agregador real (o documentar dos comandos:
   `pytest` backend + `vitest` frontend + `manual-overrides:gate`).
3. **CI:** `.github/workflows/ci.yml` que en cada PR ejecute backend + frontend + `manual-overrides:gate`.

**Criterios de aceptación:** la suite arranca en frío en CI; un PR que rompa cualquier *contract test* falla
automáticamente. (Cierra el hallazgo Q3.)

---

## 4. Fase 1 — A6: paridad UI/motor de suitability  *(quick win independiente)*

> No toca el código de constraints; puede ir **en paralelo** a la Fase 2. Va aquí por riesgo-a-confianza.

**Problema:** `compatible_profiles` se precalcula con un script de migración con *gate* y se cachea en
Firestore; `rulesEngine.ts` (≈407) lo lee primero, pero el optimizador recalcula la idoneidad **en vivo**
(`is_fund_eligible_for_profile`, `optimizer_core.py` ≈553). Si el valor cacheado queda obsoleto (la propia
cabecera de `migrate_suitability_v2.py` lo advierte), la UI puede mostrar "apto" un fondo que el motor excluye.

**Entregables:**

1. **Regeneración programada** de `compatible_profiles` (tarea periódica) tras cualquier cambio de exposición,
   reutilizando el script existente con su *gate* (dry-run → manifest → aprobación).
2. **Test de paridad UI/motor:** para una muestra fija de fondos, afirmar que `compatible_profiles[fondo]`
   coincide con `is_fund_eligible_for_profile(fondo, n)` en vivo para n=1..10. Integrarlo en CI (Fase 0) para
   que la deriva se detecte automáticamente.
3. (Opcional) Evaluar mover el cálculo a **tiempo de lectura** si el coste lo permite, eliminando la caché.

**Criterios de aceptación:** existe un mecanismo que evita (o detecta en CI) la divergencia UI/motor. (Cierra A6.)

---

## 5. Fase 2 — Q1 + A5: unificar el sistema de restricciones  *(refactor de contrato)*

> **No es un parche urgente, es un cambio de contrato.** Romperá tests a propósito (ver 5.3). El primer
> entregable funcional de esta fase es **matar la relajación silenciosa (A5)**.

### 5.1 Diseño objetivo  *(igual que v1)*

Un único resolutor de cotas + un único inyector:

```
Firestore (risk_profiles)  ──┐
                              ├─► resolve_effective_bounds(profile_id, overrides_v1)  ──► {bucket: (min,max)}
config.RISK_BUCKETS_LABELS ──┘                                   │
(seed/fallback)                                                  ▼
                                          _apply_bucket_constraints(ef, bounds, build_bucket_vectors(...))
```

Reglas:

1. **Precedencia** `overrides_v1` → Firestore → seed, pero produciendo **una** estructura, no dos.
2. Los overrides se **fusionan** bucket a bucket. Si el resultado es contradictorio (`min > max`), se
   **rechaza con error explícito**: nunca se relaja en silencio. **Esto elimina `_reconcile_bucket_vs_profile`
   (≈743-797) y cierra A5.** Si se quiere trazabilidad, emitir `explainability.relaxed_constraints` estructurado.
3. Vocabulario único de buckets (D3), con la decisión de D1 sobre Mixto. `BucketBoundsV1` queda como **DTO de
   entrada** con mapeo 1:1 documentado (Apéndice B).

### 5.2 Cambios concretos

- **(C1)** Sustituir las dos ramas de inyección de `_apply_standard_constraints` (≈845-911) por la llamada
  única a `_apply_bucket_constraints(ef, effective_bounds, vectors)`. Eliminar el flag `_v1_has_active_bounds`
  y el `log "...SKIPPED..."`.
- **(C2)** Centralizar `build_bucket_vectors` y reutilizarlo en **inyección**, **validación**
  (`_validate_optimizer_result` ≈243-275) y **post-proceso** (`_build_profile_bucket_vectors` ≈114). Una sola
  definición del mapeo bucket→vector (es lo que faltaba y causó A1).
- **(C3)** Eliminar `_reconcile_bucket_vs_profile` y su llamada (≈1412-1416) → A5.
- **(C4)** Corregir `_resolve_bucket_bounds` (`constraints_builder_v1.py` ≈68-114): hoy lee la clave
  `Inmobiliario` (inexistente en la taxonomía) ⇒ `real_asset` siempre vacío. Alinear al vocabulario canónico (D3).

### 5.3 Tests que se romperán **a propósito** (migrar, no "arreglar como regresión")

| Test | Hoy fija | Acción en v2 |
|---|---|---|
| `test_bucket_constraints_dedup.py::test_mixto_not_injected_as_hard_constraint` (≈318-353) | Que Mixto **no** se inyecta (`call_count == 2`) | D1(a): reescribir al nuevo vocabulario (Mixto no existe). D1(b): **invertir** (afirmar que sí se aplica). |
| `…::test_v1_active_skips_profile_constraints` (≈59) | Que con V1 activo el perfil se **omite** | Reescribir: ya no hay "skip"; afirmar que la **fusión** produce el conjunto efectivo correcto. |
| `…::test_skip_log_emitted_when_v1_active` (≈289) | Que se emite el log "SKIPPED" | **Eliminar**: ya no existe ese camino. Sustituir por test de fusión. |
| `test_constraints_canonical_contract.py` | Contrato de cotas canónicas | Extender: afirmar **equivalencia de fuente única** (V1≡Firestore≡seed para entradas equivalentes). |

**Tests nuevos:** `test_effective_bounds_merge.py` (override estricto gana; contradictorio ⇒ error, no relaja;
sin override ⇒ seed intacto) y `test_bucket_vectors_single_source.py` (mismo mapeo en inyección/validación/post-proceso).

### 5.4 Criterios de aceptación

- [ ] Un único punto de inyección; `build_bucket_vectors` es la única definición del mapeo.
- [ ] `_reconcile_bucket_vs_profile` eliminado; los overrides contradictorios **fallan con error** (A5 cerrado).
- [ ] Tests de 5.3 migrados conscientemente; suite verde.
- [ ] *Shadow run* (§8) sin diferencias de peso cuando no hay overrides.

---

## 6. Fase 3 — A1: resolver el bucket «Mixto»

> Depende de D1 y de la Fase 2. Sobre el modelo unificado, es "añadir/retirar una clave en un solo sitio".

**Ruta (a), recomendada — retirar Mixto como cota:** eliminar la clave `"Mixto"` de `RISK_BUCKETS_LABELS`
(10 perfiles) reajustando máximos para mantener factibilidad; migración controlada de `system_settings/risk_profiles`
(dry-run → manifest → aprobación, con *backup* del doc previo); quitar `"Mixto"` de `AssetClass`,
`ASSET_CLASS_ORDER` y `RISK_PROFILES` en `rulesEngine.ts`, y recalcular `targetPcts` en
`generateSmartPortfolioLocal` para que sumen 100 %. `getAssetClass` ya hace look-through; Mixto puede quedar
solo como *fallback* visual o mapearse a `Otros`.

**Ruta (b) — vector indicador** (solo si D1 lo decide): añadir `mx_v[i] = 1.0 si asset_type ∈ {allocation, mixed}`
a `build_bucket_vectors` y tratarlo como una clase más. **Validar factibilidad** (precheck +
`test_optimizer_invariants`) por el riesgo de sobrerrestricción en 3-5.

**Criterios de aceptación:** ninguna banda declarada queda sin aplicar **ni** sin reportar; `config.py`,
`rulesEngine.ts` y Firestore coherentes con D1 (verificado por test de paridad); 10 perfiles factibles.

---

## 7. Fase 4 — A2 + A3: `equity_floor` como derivado, y limpieza de caps muertos

> Depende de D2. **Se reduce, no se amplía:** quita grados de libertad en vez de añadir una política.

### 7.1 Cambios concretos

- **(C5)** En `config.py`: **eliminar** `EQUITY_FLOOR`, `BOND_CAP`, `CASH_CAP` (deprecación; A2 y A3).
- **(C6)** En el motor: el suelo de equity **ya** lo impone la banda RV como restricción dura
  (`w · eq_v ≥ rv_min`). El `equity_floor` técnico que alimentan *precheck* y *auto-expand* se **deriva** del
  `rv_min` **efectivo** (post-fusión, Fase 2), no de una constante:

```python
# DESCARTADO (v1): constraints["equity_floor"] = EQUITY_FLOOR[risk_level]   # 2ª política sobre el mismo eje
# v2: una sola fuente; el floor técnico = rv_min efectivo
effective_bounds = resolve_effective_bounds(...)        # Fase 2
rv_min, _ = read_bound(effective_bounds.get("RV"))
equity_floor_technical = rv_min or 0.0                  # alimenta precheck/auto-expand, NO es 2ª política
```

- **(C7)** Eliminar el desempaquetado muerto de `bond_cap`/`cash_cap` en `_build_optimization_context`
  (≈528-529, 531, 1305).

### 7.2 Impacto y validación

Como el floor técnico se deriva del `rv_min` ya vigente, **no cambia el comportamiento del solver** (la banda
RV ya era la cota efectiva). El único efecto es que *precheck* y *auto-expand* pasan a ser **consistentes** con
esa cota (fail-fast / expansión correctos). Confirmar en *shadow* (§8) que la tasa de `infeasible_*` no cambia
de forma inesperada.

### 7.3 Criterios de aceptación

- [ ] `EQUITY_FLOOR`/`BOND_CAP`/`CASH_CAP` eliminados de config; sin constantes muertas (A3 cerrado).
- [ ] El floor técnico se deriva del `rv_min` efectivo y alimenta precheck/auto-expand desde una única fuente (A2 cerrado).
- [ ] *Shadow run*: pesos idénticos y tasa de factibilidad estable.

---

## 8. Verificación *shadow* (antes de activar en producción)

Comparación A/B determinista sobre una muestra **fija** de carteras × perfiles (1..10), idealmente de
optimizaciones reales recientes, con el sistema nuevo detrás de *feature flag* `unified_constraints`:

1. Ejecutar motor **actual** vs **nuevo** sobre la misma entrada.
2. Diff de: pesos por ISIN (tol. 1e-4), `portfolio_allocation`, `status`/`applicable`, métricas
   (`return`/`volatility`/`sharpe`) y `binding_constraints`.
3. **Esperado:** cero diferencias sin overrides (Fase 2 y Fase 4 son, por diseño, refactor neutro). Diferencias
   **solo** donde D1 (Mixto) lo justifique y explicables.
4. Registrar cualquier cambio en la tasa de `infeasible_*`/`fallback_*`.

> Script sugerido (no existe, crear): `functions_python/scripts/audit/shadow_compare_optimizer.py`, volcando un
> manifest a `artifacts/` según el patrón de audits previos.

---

## 9. Secuenciación, esfuerzo y rollout  *(reordenado por riesgo + dependencias)*

| # | Fase | Depende de | Esfuerzo | Cierra |
|:---:|---|---|:---:|---|
| 0 | **CI y reproducibilidad** | — | S | Q3 |
| — | Decisiones D1, D2, D3 (negocio/quant) | — | reunión | — |
| 1 | **A6 paridad UI/motor** (quick win, paralelo) | Fase 0 | S | A6 |
| 2 | **Q1 + A5 unificar constraints** (refactor de contrato) | D1, D3, Fase 0 | M | Q1, A5 |
| 3 | **A1 Mixto** | D1, Fase 2 | S–M | A1 |
| 4 | **A2 + A3 equity_floor derivado + limpieza** | D2, Fase 2 | S | A2, A3 |

*S ≈ pequeño, M ≈ medio.* Fase 0 y Fase 1 pueden solaparse; 2→3→4 son secuenciales por dependencia técnica.

**Despliegue:** implementar Fases 2-4 tras *feature flag* `unified_constraints` (off) → *shadow run* (§8) →
*staging*/QA por perfil → canary en producción vigilando `infeasible_*`/`fallback_*` → retirar flag y código
antiguo. **Rollback** = desactivar el flag; la migración de Firestore (Fase 3) lleva su propio *backup*.

---

## 10. Checklist global de cierre

- [ ] CI ejecutando backend + frontend + `manual-overrides:gate` en cada PR; suite reproducible en frío (Q3).
- [ ] D1, D2, D3 decididas y documentadas.
- [ ] Mecanismo anti-deriva de `compatible_profiles` (regeneración o lectura en vivo) + test de paridad (A6).
- [ ] Un único sistema de cotas; sin lógica "o V1 o perfil"; **overrides contradictorios fallan con error** (Q1, A5).
- [ ] Ninguna banda declarada queda sin aplicar ni sin reportar (A1).
- [ ] `equity_floor` técnico derivado del `rv_min` efectivo; `EQUITY_FLOOR`/`BOND_CAP`/`CASH_CAP` eliminados (A2, A3).
- [ ] Tests de contrato migrados conscientemente (§5.3); *shadow run* aprobado por negocio.
- [ ] README actualizado al comportamiento real (Mixto, equity floor, objetivo de 8-10).

---

## Apéndice A — Archivos y funciones implicadas

| Archivo | Funciones / símbolos | Fase |
|---|---|---|
| `services/config.py` | `RISK_BUCKETS_LABELS`; `EQUITY_FLOOR`/`BOND_CAP`/`CASH_CAP` (a eliminar) | 3, 4 |
| `services/portfolio/optimizer_core.py` | `_apply_standard_constraints` (~845-911), `_build_profile_bucket_vectors` (~114), `_validate_optimizer_result` (~243), `_reconcile_bucket_vs_profile` (~743, eliminar), `_build_optimization_context` (~527) | 2, 3, 4 |
| `models/constraints_v1.py` | `BucketBoundsV1` (DTO de entrada) | 2 |
| `services/portfolio/constraints_builder_v1.py` | `_resolve_bucket_bounds` (~68, corregir `Inmobiliario`) | 2 |
| `api/endpoints_portfolio.py` | `_build_effective_constraints` (~240) | 4 |
| `services/portfolio/suitability_engine.py` + `scripts/maintenance/migrate_suitability_v2.py` | `is_fund_eligible_for_profile`, regeneración de `compatible_profiles` | 1 |
| `frontend/src/utils/rulesEngine.ts` | `RISK_PROFILES`, `AssetClass`, `getAssetClass`, `generateSmartPortfolioLocal` | 3 |
| `functions_python/tests/test_bucket_constraints_dedup.py` | tests a migrar (§5.3) | 2 |

## Apéndice B — Vocabulario de buckets (mapeo canónico, D3)

| `RISK_BUCKETS_LABELS` / frontend | `BucketBoundsV1` (DTO) | Vector en motor |
|---|---|---|
| RV | equity | `eq_v` |
| RF | bond | `bd_v` |
| Monetario | cash | `cs_v` |
| Alternativos | alternative + real_asset | `al_v + ra_v` |
| Otros | other | `ot_v` |
| Mixto | — (según D1) | indicador `mx_v` solo si Ruta (b) |

---
*Fin del plan v2. Las referencias de línea pueden desplazarse al editar; usar los nombres de función como
ancla estable. Cambios de fondo frente a v1 resumidos en el Changelog inicial.*

