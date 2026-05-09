# BDB_OPT_PAYLOAD_CONTRACT_TESTS_0

## Resumen ejecutivo

Se añaden tests contractuales estáticos para fijar el payload del optimizador
sin cambiar runtime. El objetivo es proteger el contrato frontend/backend
antes de cualquier cleanup o refactoring.

**ESTADO: ✅ BDB_OPT_PAYLOAD_CONTRACT_TESTS_0_READY_FOR_REVIEW**

## Estado base

| Campo | Valor |
|---|---|
| HEAD | `b8edadb` |
| origin/master | `b8edadb` |
| Documento base | `docs/BDB_OPT_PAYLOAD_CONTRACT_CLEANUP_0.md` |
| Admin Console | 8/8 cerrada |
| Tests frontend (pre) | 18/18 suites, 454/454 PASS |
| Tests frontend (post) | 19/19 suites, 504/504 PASS |
| Build | PASS |

---

## Tests añadidos

### Frontend

**Archivo**: `frontend/src/__tests__/optimizerPayloadContract.test.ts`

| Sección | Tests | Cubre |
|---|---|---|
| Payload shape — main path | 11 | risk_level, profile_id, optimization_mode, locked_positions, constraints, assets, tactical_views |
| Retry path — known_contract_gap | 8 | retry payload minimal sin locked_positions, constraints, optimization_mode, profile_id |
| OptimizationRequest type docs | 7 | Campos canónicos y legacy en interface TypeScript |
| Duplicate fields contract | 4 | D1 risk_level/profile_id, D2 optimization_mode, D3 locked_positions/fixed_weights |
| Mixto reporting/metadata | 4 | Mixto no es constraint, look-through, OptimizationAsset minimal |
| classification_v2 / portfolio_exposure_v2 | 5 | Separación estricta, no silent fallback, doc verification |
| Contract doc coverage | 11 | Verificación de que el doc base cubre todos los campos |

**Total**: 50 tests

### Backend

**Archivo**: `functions_python/tests/test_optimizer_payload_contract_static.py`

| Sección | Tests | Cubre |
|---|---|---|
| Endpoint field recognition | 10 | Todos los campos documentados reconocidos por endpoints_portfolio.py |
| Optimizer core field usage | 8 | portfolio_exposure_v2, classification_v2, asset_mix, bucket_bounds, constraints_builder |
| Endpoint field cascading | 3 | D1 profile_id fallback, D2 optimization_mode cascada, D3 locked_positions canonical |
| No silent fallback guard | 3 | _build_exposure_vectors usa asset_mix, no classification_v2 como exposure |
| Mixto reporting only | 2 | _build_profile_bucket_vectors no incluye Mixto, doc confirms |
| Contract doc coverage | 11 | Verificación exhaustiva del documento base |
| Retry path documentation | 4 | retry path existe, campos presentes y ausentes documentados |
| Bucket bounds separation | 2 | bucket_bounds_v1 vs current_risk_buckets |

**Total**: 43 tests

---

## Contratos cubiertos

| # | Contrato | Estado |
|---|---|---|
| D1 | `risk_level` vs `profile_id` | ✅ Cubierto FE + BE |
| D2 | `optimization_mode` raíz vs nested | ✅ Cubierto FE + BE |
| D3 | `locked_positions` vs `fixed_weights` / `lock_mode` | ✅ Cubierto FE + BE |
| D4 | `bucket_bounds_v1` vs `current_risk_buckets` | ✅ Cubierto BE |
| D5 | `portfolio_exposure_v2.asset_mix` vs `classification_v2` | ✅ Cubierto FE + BE |
| D6 | Mixto reporting/metadata, no hard constraint | ✅ Cubierto FE + BE |
| R1 | Retry path mínimo | ✅ Cubierto como known_contract_gap FE + BE |

---

## Retry path

- El retry path en `usePortfolioActions.ts` (línea ~693) queda cubierto como **known_contract_gap**.
- Los tests documentan que el retry payload NO incluye: `locked_positions`, `constraints`, `optimization_mode`, `profile_id`.
- **No se corrige en este bloque.**
- Bloque posterior recomendado: **BDB-OPT-PAYLOAD-RETRY-PATH-HARDENING-0**.

---

## Qué NO se hizo

- ❌ No runtime changes
- ❌ No backend logic changes
- ❌ No frontend behavior changes
- ❌ No optimizer execution
- ❌ No deploy
- ❌ No Firestore writes
- ❌ No parser/Gemini
- ❌ No CORE
- ❌ No commit/push
- ❌ No librerías nuevas

---

## Validaciones

| Validación | Resultado |
|---|---|
| Frontend tests (`npx vitest run`) | 19/19 suites, 504/504 PASS |
| Backend tests (`pytest test_optimizer_payload_contract_static.py`) | 43/43 PASS |
| Frontend build (`npx vite build`) | PASS |
| Security scan (no writes/secrets) | CLEAN |

---

## Decisión

**ESTADO: `BDB_OPT_PAYLOAD_CONTRACT_TESTS_0_READY_FOR_REVIEW`**

Fecha: 2026-05-09T17:58:00+02:00
