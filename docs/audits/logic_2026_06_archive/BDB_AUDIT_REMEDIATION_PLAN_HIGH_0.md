# BDB-FONDOS — Plan de Corrección de Hallazgos Altos (A1, A2, Q1)

**Fecha:** 31/05/2026
**Alcance:** Remediación de los tres hallazgos de severidad ALTA de la auditoría de lógica/arquitectura
(`AUDITORIA_BDB-FONDOS_LOGICA_2026-05-31.pdf`).
**Estado:** PROPUESTA — requiere las decisiones de la §2 antes de implementar.
**Naturaleza:** Documento de planificación. No modifica código fuente.

---

## 0. Resumen ejecutivo

Los tres hallazgos altos son, en realidad, **una sola brecha estructural con tres síntomas**:
la política de perfiles declarada en `config.py` y replicada en `rulesEngine.ts` no se aplica
de forma íntegra ni unívoca en el motor, porque existen **dos sistemas de restricciones paralelos**
(Q1) que, entre ambos, **dejan sin cubrir el bucket «Mixto»** (A1) y **no cablean el `equity_floor`**
declarado por nivel (A2).

Por tanto el plan trata **Q1 como la corrección raíz** y resuelve A1 y A2 *dentro* del modelo unificado,
en este orden:

1. **Fase 0 — Decisiones** (§2): tres decisiones de negocio/quant que condicionan el código.
2. **Fase 1 — Unificar restricciones** (Q1, §3): una única representación canónica de cotas.
3. **Fase 2 — Resolver «Mixto»** (A1, §4): cubrir o retirar el bucket de forma explícita.
4. **Fase 3 — Cablear el equity floor** (A2, §5): una sola fuente de verdad para el mínimo de RV.
5. **Verificación y rollout** (§6–§8): pruebas, comparación *shadow* y despliegue por fases.

> **Principio rector:** *single source of truth*. Al terminar, debe existir **un solo** lugar donde se
> definan las cotas por perfil, **un solo** camino que las inyecte al solver, y **cero** parámetros de
> configuración que se declaren pero no se apliquen.

---

## 1. Mapa de dependencias entre hallazgos

```
                    ┌─────────────────────────────┐
                    │ Q1  Dos sistemas paralelos   │  ← causa raíz
                    │ (BucketBoundsV1  vs           │
                    │  RISK_BUCKETS_LABELS)         │
                    └───────────────┬──────────────┘
              omite "Mixto" en      │       lógica "o uno u otro"
              AMBOS caminos         │       (skip de perfil si V1 activo)
                    ┌───────────────┴──────────────┐
                    ▼                                ▼
        ┌───────────────────────┐      ┌────────────────────────────┐
        │ A1  Bucket «Mixto»     │      │ A3 (MEDIA) BOND_CAP/CASH_CAP│
        │ nunca aplicado/validado│      │ muertos y contradictorios   │
        └───────────────────────┘      └────────────────────────────┘

        ┌────────────────────────────────────────────────────────────┐
        │ A2  equity_floor por nivel no cableado (independiente de Q1, │
        │ pero comparte la necesidad de una única fuente de política)  │
        └────────────────────────────────────────────────────────────┘
```

**Implicación de secuenciación:** arreglar A1 sin antes unificar Q1 obligaría a parchear *dos* sitios
(el `vector_map` V1 y `_build_profile_bucket_vectors`) y a mantener la lógica de *skip*. Unificar primero
(Q1) reduce A1 a "añadir una clave" en un único punto. A2 puede abordarse en paralelo, pero su decisión
de negocio (§2, D2) interactúa con la matriz de cotas que Q1 deja como canónica.

---

## 2. Decisiones requeridas antes de tocar código (Fase 0)

Estas tres decisiones son de **negocio/quant**, no de ingeniería; el plan ofrece una recomendación pero
**no debe implementarse hasta confirmarlas**, porque cambian el comportamiento de las carteras generadas.

### D1 — Destino del bucket «Mixto»

| Opción | Qué implica | Coste | Recomendación |
|---|---|---|---|
| **(a) Retirar Mixto como cota** | Aceptar que el *look-through* económico (equity/bond/cash de los fondos mixtos) ya gobierna la asignación; «Mixto» pasa a ser solo etiqueta comercial/reporting. Se elimina de la matriz canónica y del frontend. | Bajo-Medio | **Recomendada.** Es coherente con lo que el motor ya hace y es financieramente correcto (importa la exposición económica, no el envoltorio comercial). |
| (b) Implementar Mixto como cota real | Añadir un vector indicador (`= 1.0` si `asset_type ∈ {MIXED, ALLOCATION}`) y aplicarlo como las demás clases. | Medio | Solo si negocio exige limitar la *proporción de vehículos mixtos* como tal (no su exposición económica). |

> La auditoría documenta que hoy los mínimos de Mixto de los perfiles 3–6 (10–20 %) son inertes; cualquiera
> de las dos opciones elimina la divergencia entre lo declarado y lo aplicado.

### D2 — Autoridad del mínimo de renta variable (equity)

Hoy conviven dos magnitudes con semántica distinta y valores **mutuamente incoherentes**:

| Perfil | `EQUITY_FLOOR` (config) | RV-min (bucket `RISK_BUCKETS_LABELS`) | ¿Coherente? (floor económico ≥ RV de clase) |
|:---:|:---:|:---:|:---:|
| 1 | 5 % | 0 % | ✔ |
| 2 | 10 % | 0 % | ✔ |
| 3 | 20 % | 10 % | ✔ |
| 4 | 30 % | 20 % | ✔ |
| 5 | 40 % | 40 % | ✔ (=) |
| 6 | 55 % | 50 % | ✔ |
| 7 | 65 % | **70 %** | ✘ (floor < RV-min) |
| 8 | 75 % | **85 %** | ✘ |
| 9 | 85 % | **95 %** | ✘ |
| 10 | 98 % | 95 % | ✔ |

`EQUITY_FLOOR` mide **equity económico con look-through** (incluye la parte de RV dentro de fondos mixtos);
RV-min mide el peso de fondos **clasificados como RV**. Por construcción, el primero debería ser **≥** el
segundo, pero en los perfiles 7–9 está por debajo: fueron redactados de forma independiente.

**Decisión a tomar:** definir **una** política de equity por nivel y un invariante `equity_floor[n] ≥ rv_min[n]`.

- **Recomendación:** mantener ambas magnitudes (son conceptualmente distintas y útiles) pero **reconciliar**
  los valores para que cumplan el invariante, y declarar `EQUITY_FLOOR` como la cota *económica* canónica.
  Para 7–9, subir `EQUITY_FLOOR` a ≥ RV-min (p. ej. 70/85/95 %) o bajar RV-min; cifras a fijar por quant.
- **Atención:** cablear `EQUITY_FLOOR` activará un mínimo de equity en perfiles **conservadores** (5 % en
  "Preservación", 10 % en "Muy Conservador"). Confirmar que es deseable; si no, poner esos niveles a 0 %.

### D3 — Tratamiento de `alternative` vs `real_asset`

El sistema V1 los separa (`alternative`, `real_asset`); el de perfil los combina (`Alternativos = al + ra`).
Decidir el modelo canónico: **combinar** en "Alternativos" (recomendado, coincide con la salida
`portfolio_allocation` y con `rulesEngine.ts`) o mantenerlos separados y propagar la separación al frontend
y a la matriz de perfiles. La recomendación (combinar) simplifica y no rompe la UI actual.

---

## 3. Fase 1 — Unificar el sistema de restricciones (Q1)

**Objetivo:** que el optimizador consuma **una sola** estructura de cotas por bucket, derivada de una sola
fuente, eliminando la lógica "o V1 o perfil" y la función de reconciliación que hoy *relaja silenciosamente*
las bandas (hallazgo A5, que queda resuelto de paso).

### 3.1 Estado actual (evidencia)

- Dos representaciones de las mismas cotas:
  - `models/constraints_v1.py::BucketBoundsV1` → `{equity, bond, cash, alternative, real_asset, other}`.
  - `services/config.py::RISK_BUCKETS_LABELS` → `{RV, RF, Monetario, Mixto, Alternativos, Otros}`.
- En `services/portfolio/optimizer_core.py::_apply_standard_constraints` (~líneas 845–911) se inyecta
  **uno u otro**:

```python
# V1 (≈848-863): mapea solo 6 claves; NO incluye "Mixto"
vector_map = {"equity": eq_v, "bond": bd_v, "cash": cs_v,
              "alternative": al_v, "real_asset": ra_v, "other": ot_v}
...
# Perfil (≈901-911): se OMITE si V1 ya está activo
if apply_profile and risk_level_i in current_risk_buckets and not _v1_has_active_bounds:
    profile_vectors = _build_profile_bucket_vectors(...)   # tampoco incluye "Mixto"
    ...
elif apply_profile and _v1_has_active_bounds:
    logger.info("Profile bucket constraints SKIPPED: bucket_bounds_v1 already active")
```

- `_build_profile_bucket_vectors` (≈114-121) y `_active_bucket_vectors_for_bounds` (≈163-176) **no tienen
  clave `Mixto`** → origen directo de A1.
- `_reconcile_bucket_vs_profile` (≈743-797) existe únicamente para parchear conflictos entre ambos sistemas.

### 3.2 Diseño objetivo

Una **única** función que produzca el conjunto efectivo de cotas y un **único** punto de inyección:

```
Firestore (system_settings/risk_profiles)  ──┐
                                              ├─► resolve_effective_bounds(profile_id, overrides_v1)
config.RISK_BUCKETS_LABELS (seed/fallback) ──┘        │  devuelve  Dict[bucket -> (min,max)]
                                                       ▼
                                   _apply_bucket_constraints(ef, bounds, vectors)   ← único inyector
```

Reglas de la resolución:

1. **Precedencia** (sin cambios respecto a la doctrina actual): `overrides_v1` (cliente/admin) → Firestore →
   `RISK_BUCKETS_LABELS` (seed). La diferencia es que el resultado es **una sola** estructura, no dos.
2. Los `overrides_v1` se **fusionan** sobre la base del perfil bucket a bucket; ya no "sustituyen el bloque".
   Esto elimina la necesidad de `_reconcile_bucket_vs_profile`: si un override es más estricto, manda; si es
   contradictorio (min > max tras fusión), se **rechaza con error explícito** (no se relaja en silencio).
3. El vocabulario de buckets es único. Recomendado (D3): `{RV, RF, Monetario, Alternativos, Otros}` + la
   decisión de D1 sobre `Mixto`. `BucketBoundsV1` se mantiene como **DTO de entrada** del frontend, con un
   mapeo 1:1 documentado hacia el vocabulario canónico.

### 3.3 Cambios concretos

**(C1)** En `optimizer_core.py`, sustituir las dos ramas de inyección por una sola:

```python
# ANTES: dos caminos (V1 vs perfil) + flag _v1_has_active_bounds + skip
# DESPUÉS:
effective_bounds = resolve_effective_bounds(
    profile_id=risk_level_i,
    firestore_profiles=current_risk_buckets,
    overrides_v1=bucket_bounds_v1,
)  # -> {"RV": (min,max), "RF": ..., "Alternativos": ..., ...}

bucket_vectors = build_bucket_vectors(eq_v, bd_v, cs_v, al_v, ra_v, ot_v)  # incl. clave por D1
_apply_bucket_constraints(ef, effective_bounds, bucket_vectors)
```

**(C2)** Centralizar `build_bucket_vectors` y reutilizarlo en **los tres** sitios que hoy listan claves a mano:
inyección (`_apply_standard_constraints`), validación (`_validate_optimizer_result`, ≈243-275) y
post-proceso (`_postprocess_weights` / `_build_profile_bucket_vectors`). Una sola definición del mapeo
bucket→vector evita futuras divergencias (es exactamente lo que causó A1).

**(C3)** Eliminar `_reconcile_bucket_vs_profile` y su llamada (≈1412-1416). La fusión con detección de
contradicción de C1/regla 2 la sustituye. Si se desea conservar trazabilidad, emitir en su lugar un
`explainability.relaxed_constraints` estructurado (cierra A5).

**(C4)** Marcar `BucketBoundsV1` como capa de transporte: documentar en `constraints_v1.py` el mapeo
`equity→RV, bond→RF, cash→Monetario, alternative+real_asset→Alternativos, other→Otros` (según D3) y validar
que `_resolve_bucket_bounds` (en `constraints_builder_v1.py`, ≈68-114) produzca exactamente ese vocabulario
(hoy lee `Inmobiliario`, clave inexistente en la taxonomía canónica → real_asset siempre vacío: corregir).

### 3.4 Tests (Fase 1)

- Reutilizar/extender `functions_python/tests/test_bucket_constraints_dedup.py` y
  `test_constraints_canonical_contract.py`: ahora deben afirmar que **existe un único** conjunto de cotas
  efectivas y que el resultado es **idéntico** se llegue por V1, por Firestore o por seed para entradas
  equivalentes.
- Nuevo test `test_effective_bounds_merge.py`: (i) override más estricto gana; (ii) override contradictorio
  lanza error explícito (no relaja); (iii) ausencia de override ⇒ seed/Firestore intactos.
- Test de regresión: para una muestra fija de carteras y perfiles, los pesos resultantes **no cambian**
  respecto a la rama "solo perfil" cuando no hay overrides (garantiza no-regresión funcional).

### 3.5 Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Cambiar la inyección altera pesos en producción | Comparación *shadow* (§6.3) antes de activar; *feature flag* `unified_constraints`. |
| Overrides que antes "colaban" por relajación ahora fallan | Mensaje de error claro + documentar el cambio de contrato; revisar payloads admin existentes. |
| Mapeo `BucketBoundsV1`→canónico mal hecho | Test de mapeo 1:1 (C4) y *property test* de cobertura de las 6/5 clases. |

### 3.6 Criterios de aceptación (Fase 1)

- [ ] Un único punto de inyección de cotas de bucket en `optimizer_core.py`.
- [ ] `build_bucket_vectors` es la única definición del mapeo bucket→vector (usada por inyección, validación y post-proceso).
- [ ] `_reconcile_bucket_vs_profile` eliminado o reemplazado por *surfacing* estructurado.
- [ ] Suite `test_bucket_constraints_dedup` + `test_constraints_canonical_contract` en verde.
- [ ] *Shadow run* sin diferencias de peso cuando no hay overrides.

---

## 4. Fase 2 — Resolver el bucket «Mixto» (A1)

> Depende de **D1**. Sobre el modelo unificado de la Fase 1, la corrección se reduce a una de estas dos rutas.

### Ruta (a) — Retirar «Mixto» como cota (recomendada)

1. **Backend `config.py`:** eliminar la clave `"Mixto"` de cada perfil de `RISK_BUCKETS_LABELS` (10 perfiles).
   Reajustar, si procede, los máximos de las clases restantes para que la banda total siga siendo factible
   (la suma de mínimos ≤ 1 ≤ suma de máximos por perfil).
2. **Firestore:** ejecutar una migración controlada (patrón existente: *dry-run* → manifest → aprobación)
   que reescriba `system_settings/risk_profiles` sin la clave `Mixto`. Documentar en un `*_WRITE_GATE_0.md`.
3. **Frontend `rulesEngine.ts`:** quitar `"Mixto"` de `AssetClass`, de `ASSET_CLASS_ORDER` y de cada perfil
   en `RISK_PROFILES`. Revisar `generateSmartPortfolioLocal` (el *preview* local usa los puntos medios de cada
   bucket para repartir *slots*): al quitar Mixto, recalcular `targetPcts` para que sigan sumando 100 %.
   `getAssetClass` ya hace *look-through* de fondos `MIXED`/`ALLOCATION`, así que no necesita el bucket destino
   `Mixto` salvo como *fallback* defensivo (puede mapearse a `Otros` o mantenerse solo para etiqueta visual).
4. **Reporting:** confirmar que ninguna vista dependa de un agregado "Mixto" (la salida del optimizador
   `portfolio_allocation` ya no lo expone, así que el riesgo es bajo).

### Ruta (b) — Implementar «Mixto» como cota real

1. Construir un **vector indicador** en `build_bucket_vectors` (Fase 1):

```python
# mx_v[i] = 1.0 si el fondo i está clasificado MIXED/ALLOCATION, si no 0.0
mx_v = np.array([
    1.0 if extract_v2_identity(meta.get(isin, {})).get("asset_type") in {"allocation", "mixed"} else 0.0
    for isin in universe
])
bucket_vectors["Mixto"] = mx_v
```

2. Añadir `"Mixto"` al diccionario de cotas efectivas y dejar que el inyector/validador unificado lo trate
   como una clase más. **Ojo a la factibilidad:** un mínimo de "vehículos mixtos" combinado con los mínimos
   de RV/RF puede sobre-restringir; validar con el *feasibility precheck* y con `test_optimizer_invariants`.
3. Decidir la relación con el *look-through*: el vector indicador mide *proporción de fondos mixtos*, no su
   exposición económica; documentar que son dimensiones distintas para no reintroducir ambigüedad.

### Tests (Fase 2)

- Nuevo `test_mixto_bucket_policy.py`:
  - Ruta (a): afirmar que `"Mixto"` **no** aparece en cotas efectivas ni en la salida, y que las bandas
    restantes son factibles para los 10 perfiles.
  - Ruta (b): construir una cartera con fondos mixtos y verificar que el mínimo/máximo de `Mixto` **se aplica**
    (cartera que lo viole ⇒ `BUCKET_MIN/MAX_VIOLATION` en `_validate_optimizer_result`).
- Actualizar `frontend/src/__tests__/optimizerPayloadContract.test.ts` y los tests de `rulesEngine` para el
  nuevo vocabulario de `AssetClass`.

### Criterios de aceptación (Fase 2)

- [ ] No queda ninguna banda de bucket declarada que el motor no aplique **o** no reporte.
- [ ] `config.py`, `rulesEngine.ts` y Firestore coherentes con la decisión D1 (verificado por test de paridad).
- [ ] Factibilidad de los 10 perfiles comprobada por test.

---

## 5. Fase 3 — Cablear el `equity_floor` por nivel (A2)

> Depende de **D2**. Hace que el "equity floor" documentado deje de ser inerte.

### 5.1 Estado actual (evidencia)

- `optimizer_core.py::_build_optimization_context` (≈527): `equity_floor = float(constraints.get("equity_floor", 0.0))`.
- `api/endpoints_portfolio.py::_build_effective_constraints` (≈240-258): copia las constraints del frontend,
  `auto_expand` y `objective`; **nunca** inyecta `EQUITY_FLOOR[risk_level]`.
- El frontend **no** envía `equity_floor` (solo maneja el status de respuesta `infeasible_equity_floor`).
- Resultado: `equity_floor = 0` en operación normal ⇒ el chequeo de factibilidad de floor (≈929-962) y el
  `BLOCK-8` del *precheck* nunca se ejecutan. `BOND_CAP`/`CASH_CAP` (A3) están además muertos (≈528-529).

### 5.2 Cambios concretos

**(C5)** Inyectar el floor desde la **fuente canónica única** (tras D2). Punto recomendado: en el backend,
no en el frontend, para que la política no dependa del cliente. En `_build_effective_constraints` (o, mejor,
en `_build_optimization_context`, junto al resto de la política de perfil):

```python
from services.config import EQUITY_FLOOR  # o leerlo de Firestore si se migra allí

# Solo si el cliente no fuerza un valor explícito; la política de nivel es el suelo por defecto.
if "equity_floor" not in constraints:
    constraints["equity_floor"] = EQUITY_FLOOR.get(int(risk_level), 0.0)
```

**(C6)** Garantizar el invariante de D2 con una aserción de arranque (o test) `equity_floor[n] ≥ rv_min[n]`
para los 10 niveles, de modo que el floor económico nunca sea inferior al mínimo de la clase RV.

**(C7)** Eliminar `BOND_CAP`/`CASH_CAP` de `config.py` y su desempaquetado en `_build_optimization_context`
(≈528-529, 531, 1305) **o**, si se decide que son política, reconciliar sus valores con los máximos de RF/
Monetario de los buckets y aplicarlos por el mismo inyector unificado (Fase 1). Recomendado: **eliminarlos**
(cierra A3) salvo que negocio los reclame.

### 5.3 Impacto y validación (crítico)

Activar el floor **cambia el comportamiento** de los perfiles conservadores: el motor pasará a exigir
un mínimo de equity económico (p. ej. 5 % en "Preservación", 10 % en "Muy Conservador"). Antes de activar:

- Confirmar con negocio (D2) que esos mínimos en perfiles 1–2 son deseables; si no, ponerlos a 0 % en la
  fuente canónica.
- Verificar que universos pequeños o muy defensivos no se vuelvan `infeasible_equity_floor` de forma
  inesperada: el motor ya devuelve ese status y el frontend lo maneja, pero hay que medir la frecuencia en
  *shadow* (§6.3) para no degradar la tasa de éxito de optimización.

### 5.4 Tests (Fase 3)

- `test_feasibility_precheck*` (existentes) deben cubrir `equity_floor > 0` real por nivel.
- Nuevo `test_equity_floor_wired.py`: para cada perfil, afirmar que la cartera resultante cumple
  `w · eq_vec ≥ EQUITY_FLOOR[n] − tol`, y que el invariante `EQUITY_FLOOR[n] ≥ rv_min[n]` se cumple.
- Test de no-regresión de tasa de factibilidad sobre la muestra *shadow*.

### 5.5 Criterios de aceptación (Fase 3)

- [ ] `EQUITY_FLOOR` se inyecta desde una única fuente canónica y se aplica en el solver.
- [ ] Invariante `equity_floor[n] ≥ rv_min[n]` garantizado por test.
- [ ] `BOND_CAP`/`CASH_CAP` eliminados o reconciliados+aplicados (sin constantes muertas).
- [ ] *Shadow run*: la tasa de `infeasible_equity_floor` es conocida y aceptada por negocio.

---

## 6. Estrategia de verificación

### 6.1 Tests existentes que actúan como red de seguridad

Ejecutar en cada fase (hoy no hay CI — ver §7, hallazgo Q3 — así que de momento se corren a mano):

```bash
cd functions_python && python -m pytest tests/ -q
# Críticos para este plan:
#   test_optimizer_invariants.py            (suma de pesos, no-negatividad, bandas)
#   test_constraints_canonical_contract.py  (contrato de cotas canónicas)
#   test_bucket_constraints_dedup.py        (deduplicación de buckets)
#   test_optimizer_postprocess_bucket_aware.py
#   test_feasibility_precheck*.py           (floors / bloqueos)
#   test_suitability_contract_parity.py     (paridad FE/BE)
cd frontend && npm run test   # vitest: rulesEngine.*, optimizer*Contract
```

### 6.2 Tests nuevos (resumen)

| Test | Fase | Verifica |
|---|:---:|---|
| `test_effective_bounds_merge.py` | 1 | Fusión de overrides; contradicción ⇒ error explícito (no relaja) |
| `test_bucket_vectors_single_source.py` | 1 | Mismo mapeo bucket→vector en inyección, validación y post-proceso |
| `test_mixto_bucket_policy.py` | 2 | Coherencia con D1 (retirado y factible / aplicado y validado) |
| `test_equity_floor_wired.py` | 3 | `w·eq_vec ≥ EQUITY_FLOOR[n]`; invariante `floor ≥ rv_min` |

### 6.3 Verificación *shadow* (imprescindible antes de activar en producción)

Comparación A/B determinista sobre una **muestra fija** de carteras × perfiles (1..10), idealmente derivada de
optimizaciones reales recientes:

1. Ejecutar el motor **actual** y el **nuevo** (tras *feature flag*) sobre la misma entrada.
2. Diff de: pesos por ISIN (tolerancia 1e-4), `portfolio_allocation`, `status`/`applicable`, métricas
   (`return`, `volatility`, `sharpe`) y `binding_constraints`.
3. **Esperado:** cero diferencias cuando no hay overrides ni `equity_floor` nuevo (Fase 1 es refactor puro).
   Diferencias **solo** donde el floor (Fase 3) o el cambio de Mixto (Fase 2) lo justifiquen, y explicables.
4. Registrar la tasa de `infeasible_equity_floor` introducida por la Fase 3 y validarla con negocio.

> Script sugerido: `functions_python/scripts/audit/shadow_compare_optimizer.py` (no existe; crear) que vuelque
> un manifest CSV/JSON a `artifacts/` siguiendo el patrón de los audits previos.

---

## 7. Secuenciación, esfuerzo y dependencias

| # | Trabajo | Depende de | Esfuerzo orientativo | Entregable |
|:---:|---|---|:---:|---|
| 0 | Decisiones D1, D2, D3 (negocio/quant) | — | Reunión + acta | Decisiones firmadas |
| 1 | Unificar constraints (Q1) | D1, D3 | M (refactor + tests) | Inyector único + tests verdes |
| 2 | Resolver Mixto (A1) | D1, Fase 1 | S–M (incl. migración Firestore) | Config/FE/Firestore coherentes |
| 3 | Cablear equity floor (A2) + limpiar A3 | D2 | S | Floor aplicado + caps muertos fuera |
| 4 | *Shadow compare* + validación negocio | 1–3 | S | Manifest de diffs aprobado |
| 5 | (Recomendado) CI que ejecute las suites | — | S | Pipeline en verde (cierra Q3) |

*Esfuerzo:* S ≈ pequeño, M ≈ medio. Las fases 1→2→3 son secuenciales por dependencia técnica; la 5 puede
arrancar en paralelo y de hecho **habilita** la verificación continua del resto.

### Orden de despliegue recomendado

1. Implementar Fases 1–3 detrás de un *feature flag* `unified_constraints` (por defecto **off**).
2. *Shadow run* (§6.3) en entorno de pruebas; revisar manifest de diffs.
3. Activar el flag en *staging*; QA de carteras representativas por perfil.
4. Activar en producción por porcentaje/canary; vigilar tasa de `infeasible_*` y `fallback_*`.
5. Retirar el flag y el código del sistema antiguo una vez estabilizado.

> **Rollback:** al estar todo tras *feature flag*, revertir es desactivar el flag. La migración de Firestore
> (Fase 2) debe llevar su propio *backup* del documento `risk_profiles` previo (patrón de gate ya en uso).

---

## 8. Checklist global de cierre

- [ ] D1, D2, D3 decididas y documentadas.
- [ ] Un único sistema de cotas; sin lógica "o V1 o perfil"; sin reconciliación silenciosa (Q1, A5).
- [ ] Ninguna banda declarada queda sin aplicar ni sin reportar (A1).
- [ ] `equity_floor` por nivel aplicado desde fuente única, con invariante `≥ rv_min` (A2).
- [ ] Sin constantes de configuración muertas (`BOND_CAP`/`CASH_CAP`) (A3).
- [ ] Tests nuevos + existentes en verde; *shadow run* aprobado por negocio.
- [ ] README actualizado para reflejar el comportamiento real (equity floors, Mixto, objetivo de 8–10).
- [ ] (Recomendado) CI ejecutando backend + frontend en cada PR (Q3).

---

## Apéndice A — Archivos y funciones implicadas

| Archivo | Funciones / símbolos | Hallazgo |
|---|---|---|
| `functions_python/services/config.py` | `RISK_BUCKETS_LABELS`, `EQUITY_FLOOR`, `BOND_CAP`, `CASH_CAP`, `RISK_TARGETS` | A1, A2, A3 |
| `functions_python/services/portfolio/optimizer_core.py` | `_apply_standard_constraints` (~845–911), `_build_profile_bucket_vectors` (~114), `_active_bucket_vectors_for_bounds` (~163), `_validate_optimizer_result` (~243), `_reconcile_bucket_vs_profile` (~743), `_build_optimization_context` (~527), `_postprocess_weights` (~1148) | Q1, A1, A2, A5 |
| `functions_python/models/constraints_v1.py` | `BucketBoundsV1` | Q1, A1 |
| `functions_python/services/portfolio/constraints_builder_v1.py` | `_resolve_bucket_bounds` (~68), objetivo 8–10 (~204) | Q1, A1 |
| `functions_python/api/endpoints_portfolio.py` | `_build_effective_constraints` (~240) | A2 |
| `frontend/src/utils/rulesEngine.ts` | `RISK_PROFILES`, `AssetClass`, `getAssetClass`, `generateSmartPortfolioLocal` | A1 |
| `frontend/src/hooks/usePortfolioActions.ts` | manejo de `infeasible_equity_floor` (~952) | A2 |

## Apéndice B — Vocabulario de buckets (mapeo canónico propuesto, D3)

| Frontend / `RISK_BUCKETS_LABELS` | `BucketBoundsV1` (DTO) | Vector en motor |
|---|---|---|
| RV | equity | `eq_v` |
| RF | bond | `bd_v` |
| Monetario | cash | `cs_v` |
| Alternativos | alternative + real_asset | `al_v + ra_v` |
| Otros | other | `ot_v` |
| Mixto | — (según D1) | indicador `mx_v` solo si Ruta (b) |

---
*Fin del plan. Las referencias de línea corresponden al estado del repositorio en la fecha de emisión y
pueden desplazarse al editar; usar los nombres de función como ancla estable.*

