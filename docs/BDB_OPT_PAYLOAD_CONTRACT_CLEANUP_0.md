# BDB_OPT_PAYLOAD_CONTRACT_CLEANUP_0

## 1. Resumen Ejecutivo

Auditoría read-only del contrato de payload del optimizador entre frontend y backend.
**No se cambia runtime.** Se documentan campos canónicos, aliases legacy, duplicidades
y plan de cleanup seguro por fases.

**ESTADO: ✅ AUDITORÍA COMPLETADA — Matriz contractual documentada.**

## 2. Estado Git

| Campo | Valor |
|---|---|
| HEAD | `ece32a7` |
| origin/master | `ece32a7` |
| Admin Console | 8/8 cerrada |
| Tests | 18/18, 454/454 PASS |
| Build | PASS |

---

## 3. Frontend Payload Actual

**Fuente**: `usePortfolioActions.ts` líneas 140–157 → `OptimizationRequest` en `types/index.ts:248–269`.

### Payload enviado a `optimize_portfolio_quant`

| Campo | Tipo | Obligatorio | Origen frontend | Estado |
|---|---|---|---|---|
| `assets` | `string[]` | ✅ | `assetUniverse` | **canonical** |
| `risk_level` | `number` | ✅ | `riskLevel` (1–10) | **canonical** |
| `profile_id` | `string` | ❌ | `String(riskLevel)` | **alias** de `risk_level` |
| `optimization_mode` | `string` | ❌ | `'rebalance_to_profile'` hardcoded | **duplicado** (raíz + nested) |
| `locked_assets` | `string[]` | ❌ | ISINs con `isLocked=true` | **canonical** |
| `locked_positions` | `{mode, positions}` | ❌ | mode + fixedWeights dict | **canonical (v1)** |
| `asset_metadata` | `Record<string, OptimizationAsset>` | ❌ | ISIN → metadata del portfolio | **canonical** |
| `constraints.apply_profile` | `boolean` | ❌ | `true` hardcoded | **legacy wrapper** |
| `constraints.optimization_mode` | `string` | ❌ | `'rebalance_to_profile'` | **duplicado** de raíz |
| `constraints.lock_mode` | `string` | ❌ | keep_weight / keep_money | **legacy alias** de `locked_positions.mode` |
| `constraints.fixed_weights` | `Record<string, number>` | ❌ | fixedWeights dict | **legacy alias** de `locked_positions.positions` |
| `tactical_views` | `Record<string, number>` | ❌ | solo si no vacío | **canonical** |
| `constraints_v1` | `PortfolioConstraintsV1` | ❌ | no enviado por FE | **backend-only** |
| `save_snapshot` | `boolean` | ❌ | condicional label | **canonical** |
| `snapshot_label` | `string` | ❌ | condicional | **canonical** |

### Retry payload (recovery path, línea 693)

| Campo | Tipo | Nota |
|---|---|---|
| `assets` | `string[]` | expandido con recovery_candidates |
| `risk_level` | `number` | riskLevel original |
| `locked_assets` | `string[]` | solo manualSwap |

> ⚠️ **Hallazgo**: El retry path envía un payload **mínimo** sin `locked_positions`, `constraints`, `optimization_mode` ni `profile_id`. El backend usa defaults para todos estos campos.

---

## 4. Backend Payload Actual

**Fuente**: `endpoints_portfolio.py:262–470` → `optimizer_core.py:1026–1068`.

### Campos consumidos por endpoint

| Campo | Línea | Consumo real | Default/Fallback |
|---|---|---|---|
| `assets` | 285 | lista de ISINs | `[]` → error |
| `risk_level` | 287 | int 1–10 | `5` |
| `locked_assets` | 288 | ISINs bloqueados | `[]` |
| `constraints` | 241–252 | dict → `_build_effective_constraints` | `{}` |
| `profile_id` | 360 | `str(profile_id or risk_level)` | `str(risk_level)` |
| `optimization_mode` | 361–365 | cascada: raíz > constraints > default | `'rebalance_to_profile'` |
| `locked_positions` | 366–371 | dict canonical; fallback desde constraints | `{mode, positions}` |
| `asset_metadata` | 315 | merged con Firestore | `{}` |
| `tactical_views` | 358 | dict ISIN→float | `{}` |
| `enable_challengers` | 305 | bool | `False` (disabled by default) |
| `objective` | 377–378 | override string | derivado de mode |
| `save_snapshot` | 422 | bool | `False` |
| `snapshot_label` | 428 | string | `'manual_snapshot'` |
| `auto_expand_universe` | 245 | bool | `False` |

### Campos consumidos por `run_optimization` (optimizer_core)

| Campo | Fuente | Consumo real |
|---|---|---|
| `apply_profile` | `constraints.apply_profile` | Activa/desactiva filtro suitability |
| `optimization_mode` | `constraints.optimization_mode` → overridden por `constraints_v1` | Modo del solver |
| `lock_mode` | `constraints.lock_mode` → overridden por `constraints_v1.locks.mode` | Tipo de bloqueo |
| `fixed_weights` | `constraints.fixed_weights` → overridden por `constraints_v1.locks.positions` | Pesos bloqueados |
| `current_risk_buckets` | Firestore `system_settings/risk_profiles` | Bandas asset allocation |
| `bucket_bounds_v1` | `constraints_v1.bucket_bounds` | Override v1 de bandas |
| `construction_v1` | `constraints_v1.construction` | min/max weight, cutoff |
| `risk_budget_v1` | `constraints_v1.risk_budget` | target_vol, max_vol |

---

## 5. Duplicidades Detectadas

### D1: `risk_level` vs `profile_id`

| Campo | Origen FE | Uso BE | Relación |
|---|---|---|---|
| `risk_level` | `riskLevel` (int) | Parseado, validado 1–10 | **canónico en endpoint** |
| `profile_id` | `String(riskLevel)` | `str(profile_id or risk_level)` | **derivado/alias** |

**Riesgo**: Bajo. Ambos se sincronizan actualmente. `profile_id` permite futuro string no-numérico.
**Propuesta**: `risk_level` canónico. `profile_id` alias transitorio → deprecar cuando perfiles sean string.

### D2: `optimization_mode` duplicado

| Ubicación | Valor | Prioridad |
|---|---|---|
| `payload.optimization_mode` | `'rebalance_to_profile'` | Nivel 1 (raíz) |
| `payload.constraints.optimization_mode` | `'rebalance_to_profile'` | Nivel 2 (legacy nested) |
| `constraints_v1.optimization_mode` | derivado por builder | Nivel 3 (override final) |

**Riesgo**: Medio. Si difieren, cascada confusa. Actualmente siempre hardcoded idéntico.
**Propuesta**: Enviar solo en raíz. Backend ignora nested legacy.

### D3: `locked_positions` vs `constraints.fixed_weights` / `constraints.lock_mode`

| Campo | Estructura | Prioridad actual |
|---|---|---|
| `locked_positions.mode` | `'keep_weight'/'keep_money'` | **canónico** (endpoint L366) |
| `locked_positions.positions` | `Record<ISIN, weight>` | **canónico** |
| `constraints.lock_mode` | same value | **legacy alias** |
| `constraints.fixed_weights` | same dict | **legacy alias** |

**Riesgo**: Medio. Backend tiene fallback: si `locked_positions` no es dict, reconstruye desde constraints.
**Propuesta**: `locked_positions` canónico. `constraints.{lock_mode,fixed_weights}` legacy → deprecar.

### D4: `bucket_bounds_v1` vs `current_risk_buckets`

| Campo | Fuente | Uso |
|---|---|---|
| `current_risk_buckets` | Firestore `system_settings/risk_profiles` | Bandas base (siempre cargado) |
| `bucket_bounds_v1` | `constraints_v1.bucket_bounds` (construido por builder) | Override si presente |

**Riesgo**: Bajo. No son enviados por FE. Son construidos server-side.
**Propuesta**: Documentar que `bucket_bounds_v1` es override canónico sobre Firestore base.

### D5: `classification_v2` vs `portfolio_exposure_v2`

| Campo | Rol correcto | Riesgo |
|---|---|---|
| `classification_v2` | identidad/metadata/suitability | ⚠️ usado como fallback silencioso de exposure en some paths |
| `portfolio_exposure_v2.asset_mix` | fuente económica primaria | canónico para solver |

**Riesgo**: Alto. Si `exposure` falta, `classification_v2` puede sustituir silenciosamente.
**Propuesta**: No usar classification como fallback exposure. Documentar separación estricta.

### D6: Mixto / Mixed

| Aspecto | Estado actual |
|---|---|
| Rol | Label decorativo / reporting |
| Solver constraint | ❌ No es hard constraint |
| Tests | `mixedFunds.test.ts` valida look-through |

**Riesgo**: Bajo si se mantiene como metadata. Alto si alguien lo convierte en constraint.
**Propuesta**: Mantener como reporting. Tests confirman que no es constraint.

---

## 6. Riesgos Detectados

| Riesgo | Severidad | Descripción |
|---|---|---|
| Payload ambiguity | ⚠️ Medio | Mismo campo en raíz y en `constraints` nested |
| Frontend/backend drift | ⚠️ Medio | Retry path envía payload mínimo sin constraints |
| Fallbacks silenciosos | 🔴 Alto | `classification_v2` → exposure fallback sin warning |
| Tests legacy | ⚠️ Medio | P0 tests validan duplicación actual (intencionalmente) |
| Rename sin compat | ⚠️ Medio | Eliminar alias sin transición rompe retry path |
| Snapshot writes | ℹ️ Bajo | Solo si `save_snapshot=true`, no afecta optimizer |

---

## 7. Plan de Cleanup por Fases

| Fase | Descripción | Riesgo | Scope |
|---|---|---|---|
| **0** | Documentación actual — **este bloque** | Ninguno | Solo docs |
| **1** | Tests contractuales de payload shape sin runtime change | Bajo | Tests FE + BE |
| **2** | Warning/deprecation map: backend loguea si recibe campos legacy | Bajo | Backend logs |
| **3** | Frontend envía canonical + aliases (transición) | Medio | Frontend payload |
| **4** | Backend consume canonical, loguea legacy pero no depende | Medio | Backend endpoint |
| **5** | Eliminación legacy después de validación en producción | Alto | FE + BE |

---

## 8. Tests Existentes

### Frontend

| Suite | Tests | Cubre |
|---|---|---|
| `optimizerP0Contract.test.ts` | 8 | Fallback gating, payload shape, response mapping |
| `adminOptimizerReadOnly.test.tsx` | 41 | Panel read-only, cleanups documented |
| `mixedFunds.test.ts` | 19 | Mixed look-through, no constraint |
| `suitability.test.ts` | 24 | Suitability filter logic |
| `v2Helpers.test.ts` | 32 | V2 taxonomy helpers |

### Backend

| Suite | Cubre |
|---|---|
| `test_optimizer_core.py` | Core solver paths |
| `test_optimizer_p0_contracts.py` | P0 contractual invariants |
| `test_optimizer_fallback_status_contract.py` | Fallback status semantics |
| `test_optimizer_invariants.py` | Hard invariants |
| `test_constraints_canonical_contract.py` | Constraints builder v1 |
| `test_bucket_constraints_dedup.py` | Bucket dedup logic |
| `test_mixed_funds_lookthrough_contract.py` | Mixed look-through |
| `test_optimizer_v3_verify.py` | V3 compatibility |

---

## 9. Tests Recomendados (Fase 1)

| Test propuesto | Tipo | Prioridad |
|---|---|---|
| FE payload shape matches OptimizationRequest interface exactly | FE static | Alta |
| BE accepts canonical payload (minimal: assets + risk_level) | BE unit | Alta |
| BE accepts full payload with all aliases | BE unit | Alta |
| No silent fallback classification_v2 → exposure | BE contract | Alta |
| Mixed label is reporting only, never solver constraint | FE + BE | Media |
| locked_positions canonical takes priority over constraints.fixed_weights | BE unit | Media |
| Retry path works with minimal payload | FE contract | Media |
| optimization_mode cascada is deterministic | BE unit | Media |

---

## 10. Decisiones Canónicas Propuestas

| # | Campo(s) | Decisión | Transición |
|---|---|---|---|
| 1 | `risk_level` / `profile_id` | `risk_level` canónico; `profile_id` alias transitorio | Fase 2–3 |
| 2 | `optimization_mode` | Solo raíz; nested en constraints legacy | Fase 3–4 |
| 3 | `locked_positions` / `fixed_weights` / `lock_mode` | `locked_positions` canónico; constraints.{} legacy | Fase 3–4 |
| 4 | `bucket_bounds_v1` / `current_risk_buckets` | `bucket_bounds_v1` override canónico sobre Firestore base | Documentado |
| 5 | `portfolio_exposure_v2.asset_mix` | Fuente económica primaria para solver | Inmediato |
| 6 | `classification_v2` | Identidad/metadata/suitability; NO exposure fallback | Fase 1 (test) |
| 7 | Mixto | Metadata/reporting; NO hard solver constraint | Documentado |

---

## 11. Qué NO Se Hizo

- ❌ No code changes
- ❌ No runtime optimizer changes
- ❌ No constraints builder changes
- ❌ No frontend behavior changes
- ❌ No backend behavior changes
- ❌ No field renames/removals
- ❌ No payload changes
- ❌ No deploy
- ❌ No Firestore writes
- ❌ No parser/Gemini
- ❌ No CORE
- ❌ No commit/push

---

## 12. Decisión

**ESTADO: `BDB_OPT_PAYLOAD_CONTRACT_CLEANUP_0_READY_FOR_REVIEW`**

Fecha: 2026-05-09T11:25:00+02:00
