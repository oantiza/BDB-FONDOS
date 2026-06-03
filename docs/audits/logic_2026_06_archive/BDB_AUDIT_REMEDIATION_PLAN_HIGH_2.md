# BDB-FONDOS — Plan de Corrección de Hallazgos Altos — v3

**Fecha:** 31/05/2026 · **Sustituye a:** `BDB_AUDIT_REMEDIATION_PLAN_HIGH_1.md` (v2) y `_0` (v1), conservados por histórico.
**Estado:** LISTO PARA TICKETS. Decisiones D1–D3 **fijadas** (§1, defaults aprobados en review v3.1). Incorpora 2.º y 3.er *peer review*.
**Naturaleza:** Documento de planificación; no modifica código.

---

## Changelog v2 → v3 (los 5 ajustes del review)

| # | Ajuste | Dónde |
|---|---|---|
| 1 | **Fusión de overrides restrictiva (narrowing-only).** Un override normal solo puede *estrechar*: `min = max(profile_min, override_min)`, `max = min(profile_max, override_max)`. *Ampliar* exige un camino aparte, explícito y auditado. Sin esto, A5 vuelve por la puerta de atrás. | §4.1 |
| 2 | **No eliminar `Mixto` del frontend globalmente.** Se separan dos tipos: `ConstraintBucket` (sin Mixto, para el solver) y `DisplayAssetClass`/`CommercialAssetClass` (con Mixto, para reporting/comparadores/UX). `Mixto`/`AssetClass` aparece hoy en **27 archivos** del frontend. | §5 |
| 3 | **A6: el test de paridad en CI no usa Firestore real.** CI = test determinista con *snapshot* fijo (paridad de **lógica**); aparte, *scheduled monitor* contra datos reales (deriva de **datos**). | §3 |
| 4 | **Rollback realista de la migración de perfiles.** El *feature flag* cubre código, no el documento Firestore. Se añade **dual-read + documento staging**: el motor lee `risk_profiles_staging` con el flag on; el doc canónico no se sobrescribe hasta *promote* validado (con backup). | §5, §8 |
| 5 | **Derivar `equity_floor` es neutro en pesos pero cambia *dónde* falla.** Casos límite que antes fallaban tarde en el solver ahora pueden bloquearse antes (precheck/auto-expand). Es mejor, pero se acepta como **cambio visible de status/mensajes**. | §6, §7 |

**Actualización v3.1 (3.er review):** decisiones fijadas — **D1(a)** / **D2** deprecar+derivar / **D3** combinar. Dos
refinamientos de contrato en la fusión de overrides: (i) los intentos de *ampliar* una banda se informan como
`ignored_overrides`, nunca se clampan en silencio; (ii) reformulada la precedencia como *base Firestore/seed +
capa de estrechamiento*, no como cadena con el override de cliente primero (§4.1).

---

## 0. Veredicto y orden por riesgo  *(sin cambios)*

No es "el optimizador roto", sino **contratos solapados y documentación que promete más de lo que el motor
aplica**. Objetivo: una sola fuente de verdad de cotas, un solo inyector, cero parámetros declarados que no se
apliquen, cero relajaciones silenciosas.

**Orden por riesgo-a-confianza:** A5 (relajación silenciosa) → A6 (paridad UI/motor) → Q1 (unificación, arrastra
A1/A3) → A2 (equity floor). Fase 0 (CI) es prerrequisito de todo.

---

## 1. Decisiones (D1–D3) — FIJADAS

> **Defaults aprobados (review v3.1):** **D1(a)** retirar `Mixto` solo como cota · **D2** deprecar `EQUITY_FLOOR`
> y derivar del `rv_min` efectivo · **D3** combinar `alternative + real_asset` en Alternativos.

**D1 — Destino de «Mixto» como cota:** **(a) retirarlo del vocabulario de restricción** (recomendado; el
look-through ya gobierna) o (b) vector indicador (riesgo de sobrerrestricción 3-5). *Nota v3:* "retirar como
cota" **no** significa "borrar del frontend" — ver §5 (separación bucket vs clase comercial).

**D2 — Mínimo de equity *(sin cambios respecto a v2; es la corrección central)*:** `rv_min` y `equity_floor`
operan sobre el **mismo eje** `w · eq_v` (look-through). Decisión: **deprecar `EQUITY_FLOOR`** (y
`BOND_CAP`/`CASH_CAP`) y **derivar el floor técnico del `rv_min` efectivo** (post-fusión §4) solo para
precheck/auto-expand. Un suelo de "clase RV pura" (≠ equity económico) sería un vector nuevo, no `EQUITY_FLOOR`.

**D3 — `alternative` vs `real_asset`:** combinar en "Alternativos" (`al_v + ra_v`) como vocabulario canónico.

---

## 2. Fase 0 — CI y reproducibilidad  *(prerrequisito; sin cambios)*

Entregables en orden: (1) `requirements.txt` pinneado + `pytest` que arranque **en frío** en imagen Linux
limpia (sin el venv de Windows); (2) reemplazar el stub `npm test` por runner real; (3) `.github/workflows/ci.yml`
que ejecute backend + frontend + `manual-overrides:gate` en cada PR. **Cierra Q3.**

---

## 3. Fase 1 — A6: paridad UI/motor  *(refinado: CI sin Firestore real)*

**Problema:** `compatible_profiles` se cachea en Firestore y lo lee el frontend (`rulesEngine.ts` ≈407), pero el
motor recalcula la idoneidad en vivo (`is_fund_eligible_for_profile`). El valor cacheado puede quedar obsoleto.

**Dos mecanismos separados (clave del ajuste #3):**

1. **Test de paridad de *lógica* en CI (determinista, sin Firestore):** *fixture*/snapshot fijo de fondos; afirmar
   que `compute_compatible_profiles(fondo)` (misma función que el script de migración) == `is_fund_eligible_for_profile(fondo, n)`
   en vivo para n=1..10. Detecta divergencias **de código** (si alguien cambia una regla y no la otra). Rápido y estable.
2. **Monitor programado contra datos reales (fuera de CI):** *scheduled job* que compara el `compatible_profiles`
   **cacheado** en Firestore contra el recálculo en vivo sobre el universo real; alerta si hay deriva de **datos**
   (p. ej. exposición actualizada sin re-migrar). Dispara la regeneración con su *gate* (dry-run → manifest → aprobación).

**Criterio de aceptación:** CI detecta deriva de lógica sin depender de Firestore; un monitor detecta deriva de
datos en producción. (Cierra A6.)

---

## 4. Fase 2 — Q1 + A5: unificar restricciones  *(refinado: fusión narrowing-only)*

### 4.1 Resolutor único con fusión **restrictiva**

```
base = Firestore(perfil)  o, si falta,  seed(config)            ← banda canónica
request overrides_v1      = capa de ESTRECHAMIENTO sobre la base ← solo puede estrechar
⇒ UNA estructura {bucket: (min, max)}
```

> **Aclaración (ajuste de redacción del review):** el override **no** es el primer eslabón de una cadena de
> precedencia; es una **capa que solo estrecha** sobre la base canónica (Firestore o seed). No debe leerse como
> «cliente → Firestore → seed», que sugeriría que el cliente manda.

Reglas (ajuste #1 — esto es lo que cierra A5 de verdad):

1. **Un override de petición solo ESTRECHA; un intento de ampliar se INFORMA (no se clampa en silencio):**

   ```python
   profile_min, profile_max = base_bounds[bucket]      # base canónica: Firestore o seed
   eff_min = max(profile_min, override_min)            # nunca por debajo del mínimo del perfil
   eff_max = min(profile_max, override_max)            # nunca por encima del máximo del perfil

   # Transparencia: si el override pedía AMPLIAR, no se aplica y se reporta (no clamp silencioso).
   if override_min < profile_min or override_max > profile_max:
       explainability["ignored_overrides"].append({
           "bucket": bucket,
           "requested": [override_min, override_max],
           "applied":   [eff_min, eff_max],
           "reason":    "widening_not_allowed",
       })
       # modo estricto opcional: raise ConstraintError(...) en vez de warning

   if eff_min > eff_max:
       raise ConstraintError(bucket, eff_min, eff_max)  # contradicción explícita; NO se relaja
   ```

2. **Ampliar una banda canónica NO es un override de petición.** Es una operación aparte, explícita y **auditada**,
   que modifica el **perfil** (Firestore `risk_profiles`), no el payload por-request, y requiere autoridad de admin.
   Así se preserva un caso de uso legítimo (re-tunear un perfil) sin reabrir A5 por la puerta de atrás.

3. Se **elimina `_reconcile_bucket_vs_profile`** (`optimizer_core.py` ≈743-797): la fusión restrictiva la sustituye.
   Si se quiere trazabilidad de por qué una banda quedó estrecha, emitir `explainability.applied_overrides` estructurado.

### 4.2 Inyector y vectores únicos  *(sin cambios respecto a v2)*

- **(C1)** Una sola llamada `_apply_bucket_constraints(ef, effective_bounds, vectors)`; fuera el flag
  `_v1_has_active_bounds` y el log "SKIPPED" (`_apply_standard_constraints` ≈845-911).
- **(C2)** `build_bucket_vectors` como **única** definición del mapeo bucket→vector, reutilizada por inyección,
  validación (`_validate_optimizer_result` ≈243) y post-proceso (`_build_profile_bucket_vectors` ≈114).
- **(C4)** Corregir `_resolve_bucket_bounds` (`constraints_builder_v1.py` ≈68): hoy lee `Inmobiliario` (clave
  inexistente) ⇒ `real_asset` siempre vacío.

### 4.3 Tests que se romperán a propósito  *(sin cambios; añadir test de narrowing)*

`test_mixto_not_injected_as_hard_constraint` (≈318-353), `test_v1_active_skips_profile_constraints` (≈59),
`test_skip_log_emitted_when_v1_active` (≈289): migrar/eliminar conscientemente. **Nuevo**
`test_effective_bounds_merge.py` debe afirmar explícitamente: override que intenta **ampliar** ⇒ se ignora la
ampliación **y se reporta en `ignored_overrides`** (queda la banda del perfil); override que **estrecha** ⇒ gana;
contradictorio ⇒ error.

### 4.4 Criterios de aceptación

- [ ] Fusión narrowing-only; un override de petición **no puede** ampliar bandas (A5 cerrado de raíz); todo intento de ampliar se devuelve como `ignored_overrides` (o error en modo estricto), nunca clamp silencioso.
- [ ] Un único inyector y un único `build_bucket_vectors`; `_reconcile_bucket_vs_profile` eliminado.
- [ ] Tests de contrato migrados; *shadow* (§7) sin diferencias de peso sin overrides.

---

## 5. Fase 3 — A1: «Mixto»  *(refinado: separar tipos + migración con dual-read)*

### 5.1 Separación de tipos (ajuste #2) — **no** borrar Mixto del frontend

`Mixto`/`AssetClass` se usa hoy en **27 archivos** del frontend (reporting: `InformeMensual`, `ReportDashboard`,
`WeeklyReport`; comparadores: `FundComparator`; `analytics`, `taxonomyTranslators`, paneles admin y tests).
Eliminarlo globalmente es caro y arriesgado. En su lugar, separar dos conceptos:

| Tipo | Contiene Mixto | Uso |
|---|:---:|---|
| `ConstraintBucket` | **No** (D1) | Vocabulario del solver/cotas (RV, RF, Monetario, Alternativos, Otros) |
| `DisplayAssetClass` / `CommercialAssetClass` | **Sí** | Reporting, comparadores, filtros, UX comercial |

- **Backend:** retirar `"Mixto"` solo del **vocabulario de cotas** (`RISK_BUCKETS_LABELS` / resolutor §4). El
  look-through ya descompone los mixtos en `eq/bd/cs`.
- **Frontend:** mantener `Mixto` en `DisplayAssetClass` y en `getAssetClass` para reporting/UX; introducir
  `ConstraintBucket` (sin Mixto) **solo** donde se construye el *payload* de optimización. `generateSmartPortfolioLocal`
  usa `ConstraintBucket` y recalcula `targetPcts` para sumar 100 % sin Mixto.
- **Contrato:** test que afirme que `ConstraintBucket ⊂ DisplayAssetClass` y que el mapeo Display→Constraint es
  **total** (ninguna clase comercial se pierde en silencio; Mixto → look-through, no se "cae" a Otros por accidente).

### 5.2 Migración de perfiles con **dual-read** (ajuste #4)

El *feature flag* cubre código, no el documento Firestore: desactivarlo no revierte un doc ya migrado. Por eso:

1. Escribir los perfiles nuevos (sin clave `Mixto`) en un **documento staging** `system_settings/risk_profiles_staging`,
   **sin tocar** `system_settings/risk_profiles` (canónico).
2. **Dual-read:** con `unified_constraints` on, motor **y** frontend (`syncRiskProfilesFromDB`, `rulesEngine.ts` ≈650)
   leen `risk_profiles_staging`; con el flag off, ambos leen el canónico. *Coordinar FE y BE para que lean el mismo
   doc* (si no, divergen durante el shadow).
3. *Shadow* (§7) contra staging. Solo tras validación, **promote**: copiar staging → canónico con **backup** del
   doc previo (patrón de *gate* ya existente). 
4. **Rollback** = desactivar el flag (se vuelve a leer el canónico intacto). Promote es la única operación destructiva
   y va al final, ya validada.

### 5.3 Criterios de aceptación

- [ ] `Mixto` fuera del vocabulario de cotas; presente aún en `DisplayAssetClass` (frontend no roto).
- [ ] Test `ConstraintBucket ⊂ DisplayAssetClass` y mapeo total verde.
- [ ] Migración vía staging + dual-read; canónico solo se sobrescribe en *promote* con backup.

---

## 6. Fase 4 — A2 + A3: `equity_floor` derivado + caps muertos  *(refinado: status visible)*

### 6.1 Cambios  *(sin cambios respecto a v2)*

- **(C5)** Eliminar `EQUITY_FLOOR`, `BOND_CAP`, `CASH_CAP` de `config.py`.
- **(C6)** El suelo de equity ya lo impone la banda RV (`w · eq_v ≥ rv_min`). El `equity_floor` técnico
  (precheck/auto-expand) se **deriva** del `rv_min` **efectivo** (post-fusión §4):

  ```python
  effective_bounds = resolve_effective_bounds(...)     # §4
  rv_min, _ = read_bound(effective_bounds.get("RV"))
  equity_floor_technical = rv_min or 0.0               # única fuente; NO 2ª política
  ```

- **(C7)** Eliminar el desempaquetado muerto `bond_cap`/`cash_cap` (`_build_optimization_context` ≈528-529, 531, 1305).

### 6.2 Impacto: neutro en pesos, **visible en status** (ajuste #5)

Los **pesos no cambian** (la banda RV ya era la cota efectiva). Pero al hacer consistentes precheck/auto-expand
con esa cota, **cambia *dónde* se detecta la infactibilidad**: casos límite que antes llegaban al solver y
fallaban tarde (o caían a *fallback*) ahora pueden **bloquearse antes** (status `infeasible` / `infeasible_equity_floor`
o disparar *auto-expand*). Es mejor (fallo temprano y explicable), pero **se acepta como cambio visible**:

- Revisar el manejo de status en frontend (`usePortfolioActions` ya gestiona `infeasible_equity_floor`, ≈952) y
  confirmar que los mensajes leen bien cuando se disparan antes.
- Documentar el cambio de `solver_path`/`status` para soporte y QA.

### 6.3 Criterios de aceptación

- [ ] `EQUITY_FLOOR`/`BOND_CAP`/`CASH_CAP` eliminados; sin constantes muertas (A3).
- [ ] Floor técnico derivado del `rv_min` efectivo, fuente única (A2).
- [ ] Cambios de `status`/`solver_path` documentados y validados en frontend/QA.

---

## 7. Verificación *shadow*  *(refinado: pesos vs status)*

A/B determinista sobre muestra fija de carteras × perfiles, con `unified_constraints` on y leyendo `risk_profiles_staging`:

- **Pesos por ISIN:** idénticos sin overrides (tol. 1e-4) — Fases 2 y 4 son neutras en pesos.
- **`status`/`solver_path`/mensajes:** **pueden diferir** en casos límite (ajuste #5); cada diferencia debe ser
  explicable (fallo más temprano) y se registra como esperada, no como regresión.
- **`portfolio_allocation`:** diferencias solo donde D1 (Mixto) lo justifique.
- Registrar variación de tasas `infeasible_*`/`fallback_*` y validar con negocio.

> Script (crear): `functions_python/scripts/audit/shadow_compare_optimizer.py` → manifest a `artifacts/`.

---

## 8. Secuenciación y rollout  *(refinado: dual-read/promote)*

| # | Fase | Depende de | Esfuerzo | Cierra |
|:---:|---|---|:---:|---|
| 0 | CI y reproducibilidad | — | S | Q3 |
| — | Decisiones D1, D2, D3 | — | reunión | — |
| 1 | A6 paridad (CI snapshot + monitor) | Fase 0 | S | A6 |
| 2 | Q1 + A5 unificar (fusión narrowing-only) | D1, D3, Fase 0 | M | Q1, A5 |
| 3 | A1 Mixto (tipos separados + staging/dual-read) | D1, Fase 2 | S–M | A1 |
| 4 | A2 + A3 equity_floor derivado | D2, Fase 2 | S | A2, A3 |

**Rollout:** Fases 2-4 tras `unified_constraints` (off) y leyendo `risk_profiles_staging` → *shadow* (§7) →
*staging*/QA → canary. **Rollback de código** = desactivar el flag. **Rollback de datos** = no hay que revertir:
el canónico no se toca hasta el *promote* final (con backup). El *promote* del doc de perfiles es la última
operación y va ya validada.

---

## 9. Checklist global de cierre

- [ ] CI reproducible en frío + `manual-overrides:gate` en cada PR (Q3).
- [ ] D1, D2, D3 decididas y documentadas.
- [ ] A6: test de paridad de lógica en CI (sin Firestore) + monitor de datos en producción.
- [ ] Fusión **narrowing-only** con `ignored_overrides` para intentos de ampliar (no silencioso); ampliar banda canónica solo por vía admin auditada; `_reconcile_bucket_vs_profile` fuera (A5).
- [ ] Un único sistema de cotas y un único `build_bucket_vectors` (Q1); ninguna banda declarada sin aplicar/reportar (A1).
- [ ] `Mixto` fuera del bucket de restricción pero vivo en `DisplayAssetClass` (frontend intacto).
- [ ] `equity_floor` derivado del `rv_min` efectivo; caps muertos eliminados (A2, A3); cambios de status documentados.
- [ ] Migración de perfiles por staging + dual-read; *promote* con backup como única operación destructiva.
- [ ] *Shadow*: pesos idénticos sin overrides; diferencias de status explicadas. README actualizado.

---

## Apéndice A — Archivos y funciones implicadas

| Archivo | Símbolos | Fase |
|---|---|---|
| `services/config.py` | `RISK_BUCKETS_LABELS`; `EQUITY_FLOOR`/`BOND_CAP`/`CASH_CAP` (eliminar) | 3, 4 |
| `services/portfolio/optimizer_core.py` | `_apply_standard_constraints` (~845), `_build_profile_bucket_vectors` (~114), `_validate_optimizer_result` (~243), `_reconcile_bucket_vs_profile` (~743, eliminar), `_build_optimization_context` (~527) | 2, 4 |
| `services/portfolio/constraints_builder_v1.py` | `_resolve_bucket_bounds` (~68) | 2 |
| `models/constraints_v1.py` | `BucketBoundsV1` (DTO) | 2 |
| `api/endpoints_portfolio.py` | `_build_effective_constraints` (~240) | 4 |
| `suitability_engine.py` + `scripts/maintenance/migrate_suitability_v2.py` | `is_fund_eligible_for_profile`, regeneración | 1 |
| `frontend/src/utils/rulesEngine.ts` (+ 26 archivos con `AssetClass`) | `RISK_PROFILES`, `AssetClass`→`DisplayAssetClass`+`ConstraintBucket`, `syncRiskProfilesFromDB` (~650) | 1, 3 |
| `functions_python/tests/test_bucket_constraints_dedup.py` | tests a migrar (§4.3) | 2 |

## Apéndice B — Vocabulario de buckets (D3)

| `DisplayAssetClass` (frontend, reporting) | `ConstraintBucket` (solver) | `BucketBoundsV1` (DTO) | Vector |
|---|---|---|---|
| RV | RV | equity | `eq_v` |
| RF | RF | bond | `bd_v` |
| Monetario | Monetario | cash | `cs_v` |
| Alternativos | Alternativos | alternative + real_asset | `al_v + ra_v` |
| Otros | Otros | other | `ot_v` |
| **Mixto** | — (look-through) | — | — (indicador `mx_v` solo si D1=b) |

---
*Fin del plan v3.1. D1–D3 fijadas (§1) — listo para descomponer en tickets. Referencias de línea = ancla
orientativa; usar nombres de función como ancla estable.*

