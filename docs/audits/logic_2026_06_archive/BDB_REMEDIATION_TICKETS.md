# BDB-FONDOS — Backlog de tickets: remediación de hallazgos altos

**Fuente:** `BDB_AUDIT_REMEDIATION_PLAN_HIGH_2.md` (v3.1). **Fecha:** 31/05/2026.
**Decisiones fijadas:** D1(a) retirar `Mixto` solo como cota · D2 deprecar `EQUITY_FLOOR` y derivar del `rv_min` · D3 combinar `alternative + real_asset`.
**Importación:** ver `BDB_REMEDIATION_TICKETS.csv` (columnas compatibles con Jira/Linear/Asana).
**Ajustes de ejecución (v1.1):** REM-5 dividido en **REM-5A** (flag + lectura staging, *antes* de REM-2) y **REM-5B** (shadow + *promote*, después); REM-0 fija versión de Python y `pytest`/`cvxpy` explícitos; en REM-2 la ampliación de banda es `ignored_overrides` **por defecto** (sin modo estricto en esta entrega) y el cálculo de idoneidad en lectura (REM-1) pasa a *spike* futuro.

## Mapa de dependencias

```
EPIC  BDB-REM
│
├─ REM-0    CI y reproducibilidad ............... (prerrequisito de todo)
│         │
│         ├─ REM-5A  Flag + lectura staging/canónica ... (ANTES del refactor)
│         │         │
│         │         └─ REM-2  Q1 + A5 unificar ......... (refactor, protegido por flag)
│         │                   ├─ REM-3  A1 Mixto
│         │                   └─ REM-4  A2+A3 equity_floor
│         │                             │
│         │                             └─ REM-5B  Shadow + runbook + promote
│         └─ REM-1    A6 paridad UI/motor ........ (paralelo, tras REM-0)
```

Orden de ejecución sugerido: **REM-0 → REM-5A → (REM-1 ∥ REM-2) → REM-3, REM-4 → REM-5B**.
Leyenda estimación: **S** ≈ pequeño · **M** ≈ medio.

---

## EPIC — BDB-REM · Remediación de hallazgos altos de auditoría

**Tipo:** Epic · **Prioridad:** Alta · **Cierra:** A1, A2, A3, A5, Q1, Q3, A6
**Objetivo:** eliminar la divergencia entre política declarada y ejecutada. Resultado: una sola fuente de verdad
de cotas, un solo inyector de restricciones, cero parámetros declarados que no se apliquen, cero relajaciones
silenciosas, y CI que lo proteja.
**Contexto / decisiones:** D1(a), D2, D3 fijadas (ver plan §1). Comportamiento neutro en pesos salvo donde D1 lo
justifique; cambios visibles solo en `status`/mensajes (REM-4).

---

## REM-0 — CI y reproducibilidad de la suite

- **Tipo:** Task · **Prioridad:** Highest (prerrequisito) · **Estimación:** S · **Cierra:** Q3
- **Bloqueado por:** — · **Bloquea:** REM-1, REM-2, REM-3, REM-4

**Objetivo:** red de seguridad ejecutable antes de cualquier refactor de contrato.

**Subtareas:**

- [ ] **Fijar versión de Python en CI: 3.11** (recomendado por compatibilidad de `PyPortfolioOpt`/`cvxpy`/`numpy<2`); 3.12 aceptable. **No** usar el 3.14 global del repo (sin wheels fiables para esas deps).
- [ ] `functions_python/requirements.txt`: convertir los `>=` en **pins reales** (`==`); añadir **`pytest`** explícito (hoy **no está**); declarar **`cvxpy`** (se importa directo en `optimizer_core.py` pero hoy solo entra transitivo vía PyPortfolioOpt); mantener `numpy<2.0.0`.
- [ ] `pytest tests/ -q` arranca **en frío** en imagen Linux limpia (sin el venv de Windows); añadir `pytest.ini`/`conftest.py` si hace falta para el `sys.path`.
- [ ] Reemplazar el stub raíz `"test": "echo ... exit 1"` por un runner real (o documentar `pytest` + `vitest` + `manual-overrides:gate`).
- [ ] `.github/workflows/ci.yml`: Python pinneado + en cada PR ejecuta backend (pytest) + frontend (vitest) + `manual-overrides:gate`.

**Criterios de aceptación:**

- [ ] Python fijado (3.11/3.12) y `requirements.txt` con pins `==` + `pytest` + `cvxpy` explícitos.
- [ ] La suite arranca en frío en CI.
- [ ] Un PR que rompa cualquier *contract test* falla automáticamente.
- [ ] `npm test` deja de ser un stub.

**Archivos:** `package.json`, `functions_python/requirements.txt`, `functions_python/pytest.ini` (nuevo), `.github/workflows/ci.yml` (nuevo).

---

## REM-1 — A6: paridad UI/motor de suitability

- **Tipo:** Story · **Prioridad:** High · **Estimación:** S · **Cierra:** A6
- **Bloqueado por:** REM-0 · **En paralelo con:** REM-2

**Objetivo:** evitar que `compatible_profiles` cacheado diverja de la idoneidad que aplica el motor en vivo.

**Subtareas:**

- [ ] **Test de paridad de lógica (CI, sin Firestore):** con *fixture*/snapshot fijo de fondos, afirmar `compute_compatible_profiles(fondo)` == `is_fund_eligible_for_profile(fondo, n)` para n=1..10.
- [ ] **Monitor programado (fuera de CI):** *scheduled job* que compara el `compatible_profiles` cacheado en Firestore contra el recálculo en vivo del universo real; alerta de deriva de datos y dispara regeneración con su *gate* (dry-run → manifest → aprobación).
**Criterios de aceptación:**

- [ ] CI detecta deriva **de lógica** sin depender de Firestore.
- [ ] Un monitor detecta deriva **de datos** en producción.

**Fuera de alcance (spike futuro, ticket aparte):** calcular la idoneidad en tiempo de lectura para eliminar la caché de `compatible_profiles`.

**Archivos:** `services/portfolio/suitability_engine.py`, `scripts/maintenance/migrate_suitability_v2.py`, test de paridad (nuevo), `frontend/src/utils/rulesEngine.ts` (lectura ~407), *scheduled job* (nuevo).

---

## REM-2 — Q1 + A5: unificar el sistema de restricciones  (refactor de contrato)

- **Tipo:** Story · **Prioridad:** Highest · **Estimación:** M · **Cierra:** Q1, A5
- **Bloqueado por:** REM-0 · **Bloquea:** REM-3, REM-4

**Objetivo:** un único resolutor de cotas + un único inyector. Primer entregable funcional: **matar la relajación
silenciosa (A5)**. **Es un cambio de contrato: romperá tests a propósito.**

**Subtareas:**

- [ ] `resolve_effective_bounds(profile_id, overrides_v1)`: **base = Firestore/seed**; los overrides son **capa de estrechamiento**.
- [ ] Fusión **narrowing-only**: `eff_min = max(profile_min, override_min)`, `eff_max = min(profile_max, override_max)`; intento de ampliar ⇒ `explainability.ignored_overrides` **por defecto** (sin modo estricto en esta entrega), **nunca clamp silencioso**; `eff_min > eff_max` ⇒ `ConstraintError`.
- [ ] `build_bucket_vectors` como **única** definición del mapeo bucket→vector (usada por inyección, validación `_validate_optimizer_result` ~243 y post-proceso ~114).
- [ ] `_apply_bucket_constraints` único; eliminar el flag `_v1_has_active_bounds` y el log "SKIPPED" (`_apply_standard_constraints` ~845-911).
- [ ] **Eliminar** `_reconcile_bucket_vs_profile` (~743-797).
- [ ] Corregir `_resolve_bucket_bounds` (`constraints_builder_v1.py` ~68): hoy lee `Inmobiliario` (inexistente) ⇒ `real_asset` siempre vacío.
- [ ] Migrar tests de contrato (ver abajo) + nuevos `test_effective_bounds_merge.py` y `test_bucket_vectors_single_source.py`.

**Tests que se romperán a propósito (migrar, no "arreglar"):** `test_mixto_not_injected_as_hard_constraint` (~318-353), `test_v1_active_skips_profile_constraints` (~59), `test_skip_log_emitted_when_v1_active` (~289).

**Criterios de aceptación:**

- [ ] Fusión narrowing-only; un override de petición **no puede** ampliar bandas; ampliación ⇒ `ignored_overrides` (no silencioso). (A5 cerrado de raíz.)
- [ ] Un único inyector y un único `build_bucket_vectors`; `_reconcile_bucket_vs_profile` eliminado.
- [ ] Tests de contrato migrados conscientemente; suite verde.
- [ ] *Shadow* sin diferencias de peso cuando no hay overrides.

**Archivos:** `services/portfolio/optimizer_core.py`, `services/portfolio/constraints_builder_v1.py`, `models/constraints_v1.py`, `functions_python/tests/test_bucket_constraints_dedup.py`, tests nuevos.

---

## REM-3 — A1: «Mixto» (separar tipos + migración con dual-read)

- **Tipo:** Story · **Prioridad:** High · **Estimación:** S–M · **Cierra:** A1
- **Bloqueado por:** REM-2

**Objetivo:** retirar `Mixto` solo del **vocabulario de cotas** (D1a), manteniéndolo como clase comercial/reporting.

**Subtareas:**

- [ ] **Backend:** quitar la clave `"Mixto"` del vocabulario de cotas (`RISK_BUCKETS_LABELS` / resolutor REM-2), reajustando máximos para mantener factibilidad de los 10 perfiles.
- [ ] **Frontend (tipos):** introducir `ConstraintBucket` (sin Mixto) **solo** donde se construye el payload de optimización; mantener `DisplayAssetClass`/`CommercialAssetClass` (con Mixto) en reporting/comparadores/UX (afecta a ~27 archivos — no borrar globalmente).
- [ ] `generateSmartPortfolioLocal` usa `ConstraintBucket` y recalcula `targetPcts` para sumar 100 % sin Mixto.
- [ ] **Test de contrato:** `ConstraintBucket ⊂ DisplayAssetClass` y mapeo Display→Constraint **total** (Mixto → look-through, no se "cae" a Otros por accidente).
- [ ] **Migración Firestore con dual-read:** escribir perfiles nuevos en `system_settings/risk_profiles_staging` (sin tocar el canónico); motor **y** frontend (`syncRiskProfilesFromDB` ~650) leen staging con el flag on; *promote* staging→canónico con **backup** solo tras validación.

**Criterios de aceptación:**

- [ ] `Mixto` fuera del vocabulario de cotas; presente aún en `DisplayAssetClass` (frontend no roto).
- [ ] Test `ConstraintBucket ⊂ DisplayAssetClass` y mapeo total en verde; 10 perfiles factibles.
- [ ] Migración por staging + dual-read; el canónico solo se sobrescribe en *promote* con backup.

**Archivos:** `services/config.py`, `services/portfolio/optimizer_core.py`, `frontend/src/utils/rulesEngine.ts` (+ archivos de `DisplayAssetClass`), script de migración/*promote*.

---

## REM-4 — A2 + A3: `equity_floor` derivado + limpieza de caps muertos

- **Tipo:** Story · **Prioridad:** Medium · **Estimación:** S · **Cierra:** A2, A3
- **Bloqueado por:** REM-2

**Objetivo:** una sola política de equity. **Reduce grados de libertad, no añade.**

**Subtareas:**

- [ ] **Eliminar** `EQUITY_FLOOR`, `BOND_CAP`, `CASH_CAP` de `config.py`.
- [ ] **Derivar** `equity_floor_technical` del `rv_min` **efectivo** (post-fusión REM-2), solo para *precheck*/*auto-expand*: `rv_min, _ = read_bound(effective_bounds["RV"]); equity_floor_technical = rv_min or 0.0`.
- [ ] Eliminar el desempaquetado muerto `bond_cap`/`cash_cap` (`_build_optimization_context` ~528-529, 531, 1305).
- [ ] **Documentar el cambio visible de `status`/`solver_path`:** casos límite que antes fallaban tarde en el solver ahora pueden bloquearse antes (precheck/auto-expand). Revisar manejo en `usePortfolioActions` (~952) y mensajes.

**Criterios de aceptación:**

- [ ] `EQUITY_FLOOR`/`BOND_CAP`/`CASH_CAP` eliminados; sin constantes muertas (A3).
- [ ] Floor técnico derivado del `rv_min` efectivo, fuente única (A2).
- [ ] Cambios de `status`/`solver_path` documentados y validados en frontend/QA.
- [ ] *Shadow*: pesos idénticos; tasa de factibilidad estable/explicada.

**Archivos:** `services/config.py`, `services/portfolio/optimizer_core.py`, `api/endpoints_portfolio.py`, `frontend/src/hooks/usePortfolioActions.ts`.

---

## REM-5A — Feature flag + lectura staging/canónica  (ANTES del refactor)

- **Tipo:** Task · **Prioridad:** Highest · **Estimación:** S · **Cierra:** — (habilita que REM-2 nazca con bandera)
- **Bloqueado por:** REM-0 · **Bloquea:** REM-2

**Objetivo:** tener la infraestructura de despliegue **antes** del refactor, para que REM-2 no se implemente sin bandera.

**Subtareas:**

- [ ] *Feature flag* `unified_constraints` (por defecto **off**).
- [ ] **Plumbing de lectura dual:** motor y frontend (`syncRiskProfilesFromDB` ~650) capaces de leer `system_settings/risk_profiles_staging` con el flag on y el canónico con el flag off; *fallback* al canónico si staging no existe (el **contenido** de staging lo escribe REM-3).

**Criterios de aceptación:**

- [ ] Flag presente y **off** por defecto; dual-read coordinado FE/BE (mismo doc bajo el mismo estado de flag).
- [ ] Sin staging, todo lee el canónico (comportamiento idéntico al actual).

**Archivos:** flag de configuración, `services/portfolio/optimizer_core.py` (`_build_optimization_context` ~512-525), `frontend/src/utils/rulesEngine.ts` (~650).

---

## REM-5B — Verificación *shadow*, runbook y *promote*  (después del refactor)

- **Tipo:** Task · **Prioridad:** High · **Estimación:** S · **Cierra:** — (cierre de rollout)
- **Bloqueado por:** REM-2, REM-3, REM-4

**Objetivo:** validar A/B y promover a producción con rollback trivial.

**Subtareas:**

- [ ] `functions_python/scripts/audit/shadow_compare_optimizer.py`: A/B determinista sobre muestra fija × perfiles 1-10; diff de pesos (tol. 1e-4), `portfolio_allocation`, `status`/`solver_path`, métricas y `binding_constraints`; manifest a `artifacts/`.
- [ ] *Runbook* de rollout: staging/QA → canary → *promote* staging→canónico (con backup) → retirar flag y código antiguo.

**Criterios de aceptación:**

- [ ] *Shadow*: pesos idénticos sin overrides; diferencias de `status` explicadas y aprobadas por negocio.
- [ ] *Promote* con backup como única operación destructiva; **rollback de código** = desactivar flag; **rollback de datos** innecesario hasta el *promote*.

**Archivos:** `functions_python/scripts/audit/shadow_compare_optimizer.py` (nuevo), `docs/` (runbook).

---

## Cierre / Definición de Done del Epic

- [ ] REM-0…REM-5B completados y *shadow run* aprobado por negocio.
- [ ] README actualizado al comportamiento real (Mixto, equity floor, objetivo de perfiles 8-10).
- [ ] CI verde y protegiendo los *contract tests*.
