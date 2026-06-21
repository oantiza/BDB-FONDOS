# BDB-FONDOS Audit Verification Report
## BDB-AUDIT-2026-05-10-VERIFY-0

| Campo | Valor |
|-------|-------|
| **Fecha de verificación** | 2026-05-10T10:30 CET |
| **Commit auditado por el PDF** | `78f0b35` — `feat(portfolio): harden minimum history to 3 years and prefer 5+ years` |
| **Commit actual local (HEAD)** | `18d17c49f2727aae77895e6bf2cf63a9a6ad2747` (`18d17c4`) |
| **Branch** | `master` |
| **Working tree** | Limpio (`git status --short` vacío) |
| **¿Coinciden?** | **NO** — HEAD está ~50+ commits por delante del commit auditado |
| **Commits intermedios** | Incluyen: admin console, optimizer contract, retrocession write gate, feasibility precheck locks, etc. |

---

## 1. Estado de Sincronización

### 1.1 Local vs Commit Auditado

```
git diff --stat 78f0b35..HEAD → 3627 files changed, 1770686 insertions(+), 37034 deletions(-)
```

Los cambios post-auditoría incluyen:
- **OPTIMIZER_FEASIBILITY**: Precheck de locks, equity floor enforcement, bucket precheck (commits `47d3e20`..`18d17c4`)
- **OPTIMIZER_CONTRACT**: Hardening de payload retry path (commits `3b07886`..`caa2bd2`)
- **ADMIN_CONSOLE**: UI read-only completa para admin (commits `42c9c56`..`ece32a7`)
- **RETROCESSION_WRITE**: Gate controlado de escritura de retrocesiones (`7842829`..`bfee586`)
- **OPTIMIZER_FIX**: Mixed legacy fallback auditable (`144ac7f`..`0b8b6dd`)
- **Firestore rules hardening** (endurecimiento de reglas — cambios en `firestore.rules`)

### 1.2 Local vs Producción (Firestore Rules)

| Colección | LOCAL (HEAD) | PRODUCCIÓN (deploy actual) | Estado |
|-----------|-------------|---------------------------|--------|
| `funds_v3` | `isAuthenticated()` ✅ | `isAuthenticated()` ✅ | ✅ SYNC |
| `historico_vl_v2` | `isAuthenticated()` ✅ | `isAuthenticated()` ✅ | ✅ SYNC |
| `system_settings` | `isAuthenticated()` ✅ | `isAuthenticated()` ✅ | ✅ SYNC |
| `analysis_results` read | `isAuthenticated()` ✅ | `allow read: if true` ⚠️ | ⚠️ DESYNC |
| `synthetic_benchmarks` read | `isAuthenticated()` ✅ | `allow read: if true` ⚠️ | ⚠️ DESYNC |
| `reports` | `isAuthenticated()` ✅ | `isAuthenticated()` ✅ | ✅ SYNC |
| **catch-all `/{document=**}`** | `allow read, write: if false` ✅ | `allow read: if true` ⛔ | ⛔ **DESYNC CRÍTICO** |

---

## 2. Contradicción de Firestore Rules: Informe Nuevo vs Informe Previo

> [!CAUTION]
> **Contradicción resuelta parcialmente.** El informe de auditoría (commit `78f0b35`) reporta Firestore rules 100% públicas (`allow read: if true` en todas las colecciones principales). Los informes previos de cierre indican que las rules fueron "endurecidas y desplegadas". La verificación muestra:

### Estado Real

| Capa | Estado |
|------|--------|
| **Código local (HEAD)** | ✅ **Endurecido** — `funds_v3`, `historico_vl_v2`, `system_settings`, `reports`, `synthetic_benchmarks`, `analysis_results` usan `isAuthenticated()`. Catch-all es `false/false`. |
| **Commit auditado (78f0b35)** | ⛔ **Abierto** — Todas las colecciones principales tenían `allow read: if true`. Catch-all: `allow read: if true`. |
| **Producción (firebase deploy)** | ⚠️ **Parcialmente endurecido** — Las colecciones principales (`funds_v3`, `historico_vl_v2`, `system_settings`, `reports`) usan `isAuthenticated()`, PERO el catch-all `/{document=**}` sigue con `allow read: if true` y `analysis_results`/`synthetic_benchmarks` también siguen públicos. |

### Conclusión

- El endurecimiento local es real (commit posterior a `78f0b35`).
- **El deploy a producción fue PARCIAL**: las colecciones principales se endurecieron, pero el catch-all residual `allow read: if true` sigue activo en producción, exponiendo cualquier colección no explícitamente protegida.
- **`analysis_results` y `synthetic_benchmarks`** siguen públicos en producción.

---

## 3. Tabla de Hallazgos — Verificación F-01 a F-12+

### F-01: Firestore Rules — `allow read: if true` público

| Campo | Valor |
|-------|-------|
| **Severidad original** | CRÍTICO |
| **Estado** | **PARCIAL** |
| **Evidencia local** | [firestore.rules](file:///c:/Users/oanti/Documents/BDB-FONDOS/firestore.rules) — L17-57: colecciones principales usan `isAuthenticated()`, catch-all L56-57 es `allow read, write: if false` |
| **Evidencia producción** | Firebase MCP `firebase_get_security_rules`: catch-all `allow read: if true` sigue activo. `analysis_results` L39: `allow read: if true`. `synthetic_benchmarks` L47: `allow read: if true`. |
| **Riesgo real** | **ALTO** — Catch-all público en producción permite lectura sin autenticación de colecciones futuras o no explícitamente protegidas. |
| **Recomendación** | Deploy inmediato de `firestore.rules` local (ya endurecido) → producción. Quick win seguro. |

---

### F-02: Índice compuesto `categoryId ASC + std_perf.sharpe DESC` ausente

| Campo | Valor |
|-------|-------|
| **Severidad original** | ALTO |
| **Estado** | **CONFIRMADO** |
| **Evidencia** | [firestore.indexes.json](file:///c:/Users/oanti/Documents/BDB-FONDOS/firestore.indexes.json) — No existe ningún índice con `categoryId`. Los índices existentes usan `derived.asset_class` y `derived.primary_region` como campos de filtro. No hay campo `categoryId` en el schema. |
| **Riesgo real** | **MEDIO** — Si alguna query en producción filtra por `categoryId + sharpe`, sería rechazada. Pero el sistema actual usa `derived.asset_class` y funciona. Puede que el hallazgo del PDF se refiera a este campo con otro nombre. |
| **Recomendación** | Verificar si la query existe realmente en frontend/backend. Si no, el hallazgo es un falso positivo por naming. Si sí existe, crear índice. |

---

### F-03: Divergencia Risk Profiles Backend ↔ Frontend

| Campo | Valor |
|-------|-------|
| **Severidad original** | ALTO |
| **Estado** | **DESACTUALIZADO** |
| **Evidencia backend** | [config.py](file:///c:/Users/oanti/Documents/BDB-FONDOS/functions_python/services/config.py#L106-L187) — RISK_BUCKETS_LABELS perfiles 1-10 con 6 buckets: RV, RF, Mixto, Monetario, Alternativos, Otros |
| **Evidencia frontend** | [rulesEngine.ts](file:///c:/Users/oanti/Documents/BDB-FONDOS/frontend/src/utils/rulesEngine.ts#L39-L160) — RISK_PROFILES perfiles 1-10 con 6 buckets idénticos |
| **Comparación perfil a perfil** | ✅ **Todos alineados 1:1** (escalas 0-1 backend, 0-100 frontend, mismos valores tras conversión) |
| **Riesgo real** | **BAJO** — No hay divergencia real en los valores seed. Ambos son fallbacks; Firestore es la fuente de verdad. |
| **Recomendación** | No requiere acción. La arquitectura de precedencia canónica ya está documentada en ambos archivos. |

---

### F-04: Enum Consistency — Faltan 9 subtipos sectoriales en frontend

| Campo | Valor |
|-------|-------|
| **Severidad original** | MEDIO |
| **Estado** | **DESACTUALIZADO** |
| **Evidencia backend** | [canonical_types.py](file:///c:/Users/oanti/Documents/BDB-FONDOS/functions_python/models/canonical_types.py#L16-L51) — 34 miembros de `AssetSubtypeV2` incluyendo 11 sectoriales (`SECTOR_EQUITY_TECH` a `SECTOR_EQUITY_COMMUNICATION`) + `THEMATIC_EQUITY` |
| **Evidencia frontend** | [canonical.ts](file:///c:/Users/oanti/Documents/BDB-FONDOS/frontend/src/types/canonical.ts#L13-L51) — 34 miembros idénticos, incluyendo todos los 11 sectoriales (L23-25, L41-49) |
| **Evidencia test** | [enumConsistency.test.ts](file:///c:/Users/oanti/Documents/BDB-FONDOS/frontend/src/__tests__/enumConsistency.test.ts#L42-L57) — BACKEND_ASSET_SUBTYPE_V2 incluye los 11 sectoriales + THEMATIC |
| **Riesgo real** | **NULO** — Los 9+ subtipos sectoriales YA están presentes en ambos lados. |
| **Recomendación** | No requiere acción. El hallazgo fue corregido en commits posteriores a `78f0b35`. |

---

### F-05: `_build_profile_bucket_vectors` omite bucket "Mixto"

| Campo | Valor |
|-------|-------|
| **Severidad original** | CRÍTICO |
| **Estado** | **CONFIRMADO** |
| **Evidencia** | [optimizer_core.py L114-121](file:///c:/Users/oanti/Documents/BDB-FONDOS/functions_python/services/portfolio/optimizer_core.py#L114-L121) — `_build_profile_bucket_vectors` retorna dict con 5 keys: `RV`, `RF`, `Monetario`, `Alternativos`, `Otros`. **NO incluye `Mixto`**. |
| **Config define Mixto** | [config.py L106-187](file:///c:/Users/oanti/Documents/BDB-FONDOS/functions_python/services/config.py#L106-L187) — Cada perfil 1-10 define rango `Mixto: (min, max)` |
| **Impacto en solver** | [optimizer_core.py L689-697](file:///c:/Users/oanti/Documents/BDB-FONDOS/functions_python/services/portfolio/optimizer_core.py#L689-L697) — El loop `for bucket_name, vec in profile_vectors.items()` itera sobre los 5 vectores de `_build_profile_bucket_vectors`. Como `Mixto` no tiene vector, sus restricciones min/max del perfil **NUNCA se inyectan al solver**. |
| **Riesgo real** | **ALTO** — Los fondos MIXED/Allocation pueden sobreponerse o infraponerse en portfolios sin restricción. El solver no tiene constraint de banda para Mixto. |
| **Recomendación** | Decisión semántica requerida: ¿Mixto necesita su propio vector de exposición separado de equity+bond, o se decompone vía `get_effective_asset_mix`? NO tocar sin revisión HIGH. |

---

### F-06: Mixto — Fallback 50/50 en `get_effective_asset_mix`

| Campo | Valor |
|-------|-------|
| **Severidad original** | MEDIO |
| **Estado** | **CONFIRMADO** |
| **Evidencia** | [utils.py L343-350](file:///c:/Users/oanti/Documents/BDB-FONDOS/functions_python/services/portfolio/utils.py#L343-L350) — Cuando un fondo MIXED no tiene `portfolio_exposure_v2`, ni `metrics`, ni exposure real, el fallback es `equity: 0.5, bond: 0.5` con warning auditable. |
| **Frontend equivalente** | [rulesEngine.ts L307-317](file:///c:/Users/oanti/Documents/BDB-FONDOS/frontend/src/utils/rulesEngine.ts#L307-L317) — Frontend usa `getAssetClassFromEconomicExposure(expV2)` para look-through; si no hay datos, asigna bucket "Mixto". |
| **Riesgo real** | **MEDIO** — El 50/50 es un fallback defensivo documentado y con warning. El riesgo es que fondos mixtos agresivos (85% equity) se clasifiquen incorrectamente si no tienen exposure data. |
| **Recomendación** | Auditar cobertura de `portfolio_exposure_v2` en producción. Los fondos Mixto sin exposure real deben ser identificados y priorizados para enriquecimiento. |

---

### F-07: GlobalAllocation ignora `alternatives` en exposición

| Campo | Valor |
|-------|-------|
| **Severidad original** | MEDIO |
| **Estado** | **CONFIRMADO** |
| **Evidencia** | [usePortfolioStats.ts L208-334](file:///c:/Users/oanti/Documents/BDB-FONDOS/frontend/src/hooks/usePortfolioStats.ts#L208-L334) — `globalAllocation` agrega 4 dimensiones: `equity`, `bond`, `cash`, `other`. Los campos `alternative` y `real_asset` de `economic_exposure` NO se suman al cálculo. Se ignoran silenciosamente. |
| **Evidencia UI** | [AssetAllocationSection.tsx L27-30](file:///c:/Users/oanti/Documents/BDB-FONDOS/frontend/src/components/xray/AssetAllocationSection.tsx#L27-L30) — Solo muestra: `Renta Variable`, `Renta Fija`, `Efectivo`, `Otros`. No hay categoría para Alternativos. |
| **Riesgo real** | **MEDIO** — Las posiciones en alternativos/real estate/commodities no aparecen en el gráfico X-Ray. El chart puede sumar <100% o distorsionar proporciones visualmente. |
| **Recomendación** | Quick win: agregar `alternative` y `real_asset` al cálculo de `globalAllocation` (sumar a `other` o crear bucket separado). |

---

### F-08: EQUITY_FLOOR — Perfiles 7-9 tienen RV.min > equity_floor

| Campo | Valor |
|-------|-------|
| **Severidad original** | ALTO |
| **Estado** | **CONFIRMADO (diagnóstico)** |
| **Evidencia** |

| Perfil | EQUITY_FLOOR | RV.min (config) | ¿RV.min > FLOOR? |
|--------|-------------|----------------|-------------------|
| 7 | 0.65 | 0.70 | ✅ Sí — RV.min (70%) > floor (65%) |
| 8 | 0.75 | 0.85 | ✅ Sí — RV.min (85%) > floor (75%) |
| 9 | 0.85 | 0.95 | ✅ Sí — RV.min (95%) > floor (85%) |

| **Fuente equity_floor** | [config.py L57-68](file:///c:/Users/oanti/Documents/BDB-FONDOS/functions_python/services/config.py#L57-L68) |
| **Fuente RV.min** | [config.py L155-178](file:///c:/Users/oanti/Documents/BDB-FONDOS/functions_python/services/config.py#L155-L178) |
| **Riesgo real** | **BAJO operativo** — RV.min ya es más restrictivo que EQUITY_FLOOR, por lo que el floor nunca es binding para P7-P9. No es un bug funcional sino una redundancia semántica. |
| **Recomendación** | Decisión semántica: ¿el EQUITY_FLOOR debería ser ≥ RV.min para cada perfil, o es intencionalmente más laxo como fallback? NO cambiar sin revisión HIGH. Solo documentar la relación. |

---

### F-09: `analysis_results` público en producción

| Campo | Valor |
|-------|-------|
| **Severidad original** | ALTO |
| **Estado** | **PARCIAL** |
| **Evidencia local** | [firestore.rules L36-39](file:///c:/Users/oanti/Documents/BDB-FONDOS/firestore.rules#L36-L39) — `allow read: if isAuthenticated()` ✅ |
| **Evidencia producción** | Firebase MCP: `allow read: if true` ⚠️ |
| **Riesgo real** | **MEDIO** — `analysis_results` contiene resultados de análisis de portfolio. Exposición de datos de usuario sin autenticación. |
| **Recomendación** | Deploy de rules locales (ya corregidas) → producción. |

---

### F-10: Catch-all `/{document=**}` permite lectura pública en producción

| Campo | Valor |
|-------|-------|
| **Severidad original** | CRÍTICO |
| **Estado** | **CONFIRMADO en producción** |
| **Evidencia local** | [firestore.rules L56-58](file:///c:/Users/oanti/Documents/BDB-FONDOS/firestore.rules#L56-L58) — `allow read, write: if false` ✅ |
| **Evidencia producción** | Firebase MCP: `allow read: if true; // Temporarily allow for deep verification` ⛔ |
| **Riesgo real** | **CRÍTICO** — Cualquier colección no explícitamente listada es accesible públicamente en lectura. Esto incluye posibles colecciones futuras o temporales. |
| **Recomendación** | **PRIORIDAD MÁXIMA**: Deploy inmediato de rules locales. Quick win seguro de 1 min. |

---

### F-11: `system_settings` — acceso público temporal

| Campo | Valor |
|-------|-------|
| **Severidad original** | ALTO |
| **Estado** | **DESACTUALIZADO** |
| **Evidencia local** | [firestore.rules L31-34](file:///c:/Users/oanti/Documents/BDB-FONDOS/firestore.rules#L31-L34) — `allow read: if true; // Temporarily public for verification` — **NOTA**: aunque dice `if true` y el comentario dice "temporarily", esta es la versión LOCAL. |
| **Evidencia producción** | Firebase MCP: `allow read: if isAuthenticated()` ✅ |
| **Riesgo real** | **BAJO en producción** (ya endurecido), **ALTO en local** (si se despliega tal cual, se vuelve público). |
| **⚠️ CONTRADICCIÓN LOCAL** | El archivo local en HEAD tiene `allow read: if true` para `system_settings` (L32) pero producción tiene `isAuthenticated()`. **Si se hace deploy sin corregir esta línea, se regresará el endurecimiento de system_settings en producción.** |
| **Recomendación** | ⛔ **ANTES de hacer deploy de rules**, corregir L32 de `if true` a `if isAuthenticated()` para `system_settings`. |

---

### F-12: Índice compuesto inexistente para queries de dashboard

| Campo | Valor |
|-------|-------|
| **Severidad original** | MEDIO |
| **Estado** | **PARCIAL** |
| **Evidencia** | [firestore.indexes.json](file:///c:/Users/oanti/Documents/BDB-FONDOS/firestore.indexes.json) contiene 4 índices: 2 para `reports` (type+date, type+createdAt), 2 para `funds_v3` (asset_class+region+sharpe, asset_class+sharpe). No hay índice por `categoryId`. |
| **Riesgo real** | **BAJO** — El sistema funciona con los índices existentes. Si el PDF se refiere a un campo que no existe en el schema, es un falso positivo. |
| **Recomendación** | Verificar queries reales en producción antes de crear índices innecesarios. |

---

## 4. Hallazgos Adicionales Detectados en Verificación

### FA-01: `system_settings` local tiene `if true` — regresión potencial

> [!WARNING]
> El archivo `firestore.rules` local (HEAD) tiene en L32:  
> `allow read: if true; // Temporarily public for verification`  
> Pero producción ya tiene `isAuthenticated()`.  
> **Si se despliegan las rules locales sin corregir esta línea, se degrada la seguridad de `system_settings` en producción.**

### FA-02: `_build_profile_bucket_vectors` solo tiene 5 de 6 buckets

Confirmado como hallazgo arquitectural real. El bucket "Mixto" definido en `RISK_BUCKETS_LABELS` (config.py) no tiene vector de exposición correspondiente en `_build_profile_bucket_vectors` (optimizer_core.py L114-121). Esto significa que el solver NUNCA aplica restricciones de banda min/max para el bucket Mixto.

### FA-03: `get_effective_asset_mix` trata MIXED como look-through

En `utils.py` (L255-294), cuando un fondo MIXED tiene `portfolio_exposure_v2.asset_mix` o `economic_exposure`, su exposición se descompone en equity/bond/cash/etc. Esto es correcto para el solver (look-through), pero significa que el bucket "Mixto" del config es efectivamente inerte — los fondos mixtos se distribuyen entre RV/RF/etc. según su exposición real, nunca como "Mixto" puro.

---

## 5. Quick Wins Seguros

| # | Acción | Riesgo | Tiempo |
|---|--------|--------|--------|
| QW-1 | **Corregir `system_settings` L32**: cambiar `if true` → `if isAuthenticated()`** en firestore.rules local | NULO — ya está así en producción | 1 min |
| QW-2 | **Deploy firestore.rules** (después de QW-1) → cierra F-01, F-09, F-10, F-11 de una vez | BAJO — operación standard, no toca código | 2 min |
| QW-3 | **Agregar `alternative` + `real_asset`** al cálculo de `globalAllocation` en usePortfolioStats.ts | BAJO — solo UI, no afecta backend/solver | 15 min |

---

## 6. Decisiones Semánticas que NO deben tocarse sin revisión HIGH

| # | Decisión | Motivo |
|---|----------|--------|
| DS-1 | **Crear vector Mixto en `_build_profile_bucket_vectors`** | Requiere decidir si Mixto es un bucket de restricción independiente o si el look-through (equity+bond split) es la semántica correcta. Cambiar esto afecta la factibilidad del solver para todos los perfiles. |
| DS-2 | **Alinear EQUITY_FLOOR vs RV.min** para perfiles 7-9 | Requiere decidir si EQUITY_FLOOR debe ser binding (≥ RV.min) o permisivo (fallback más laxo). Impacto: cambia el floor efectivo del solver para perfiles agresivos. |
| DS-3 | **Eliminar fallback 50/50 para Mixto** en `get_effective_asset_mix` | Requiere previamente enriquecer todos los fondos Mixto en producción con `portfolio_exposure_v2`. Sin eso, eliminar el fallback rompe la clasificación. |
| DS-4 | **Cambiar `categoryId` por `derived.asset_class`** en índice compuesto | Requiere confirmar que ninguna query usa `categoryId`. Si no existe el campo, el índice del PDF es un error del auditor. |

---

## 7. Recomendación de Orden de Ejecución

```
BLOQUE 0 — Seguridad inmediata (5 min, cero riesgo)
├─ QW-1: Corregir system_settings if true → isAuthenticated() en firestore.rules
├─ QW-2: Deploy firestore.rules → producción
└─ Verificar con firebase_get_security_rules

BLOQUE 1 — UI fix aislado (15 min, bajo riesgo)
└─ QW-3: globalAllocation alternatives fix

BLOQUE 2 — Decisiones semánticas (requiere revisión HIGH)
├─ DS-1: Vector Mixto en optimizer — diseñar, testear, validar
├─ DS-2: EQUITY_FLOOR alignment — documentar decisión
├─ DS-3: Cobertura exposure_v2 para fondos Mixto — auditar producción
└─ DS-4: Clarificar campo categoryId vs derived.asset_class
```

---

## 8. Resumen Ejecutivo

| Categoría | Hallazgos del PDF | Verificados | Estado |
|-----------|------------------|-------------|--------|
| **CRÍTICOS** | 4 | 4 | 1 CONFIRMADO (catch-all prod), 1 PARCIAL (rules parcialmente desplegadas), 1 CONFIRMADO (Mixto vector), 1 DESACTUALIZADO (enum sync) |
| **ALTOS** | 8 | 6 verificados | 2 DESACTUALIZADO (profiles sync, system_settings prod), 2 CONFIRMADO (equity_floor, Mixto vector), 1 PARCIAL (analysis_results), 1 CONFIRMADO+NUEVO (regresión potencial system_settings local) |
| **MEDIOS** | 11 | 5 verificados | Mix de CONFIRMADO y DESACTUALIZADO |

> [!IMPORTANT]
> **Acción inmediata requerida**: El catch-all `/{document=**} allow read: if true` sigue activo en PRODUCCIÓN. El fix ya existe en local. Solo falta: (1) corregir `system_settings` local de `if true` a `if isAuthenticated()`, y (2) hacer deploy de firestore.rules.

---

*Informe generado por verificación automatizada contra repositorio real. No se modificó código. No se hizo deploy. No se hizo commit/push.*
