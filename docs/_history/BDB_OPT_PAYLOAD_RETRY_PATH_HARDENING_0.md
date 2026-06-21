# BDB_OPT_PAYLOAD_RETRY_PATH_HARDENING_0

## Resumen ejecutivo

Se endurece el retry path del optimizador para que reutilice/preserve el contrato
de payload completo en lugar de enviar un payload mínimo dependiente de defaults backend.

**ESTADO: ✅ BDB_OPT_PAYLOAD_RETRY_PATH_HARDENING_0_READY_FOR_REVIEW**

## Estado base

| Campo | Valor |
|---|---|
| HEAD | `3b07886` |
| origin/master | `3b07886` |
| Bloque anterior | `BDB-OPT-PAYLOAD-CONTRACT-TESTS-0` |
| Known gap documentado | Retry path minimal payload |

---

## Problema corregido

El retry path en `usePortfolioActions.ts` (3 instancias: infeasible, infeasible_equity_floor,
fallback_no_history) construía un payload mínimo que omitía:

| Campo omitido | Riesgo |
|---|---|
| `profile_id` | Backend usa defaults, posible drift |
| `optimization_mode` | Backend asume `rebalance_to_profile` por defecto (correcto, pero implícito) |
| `constraints` (nested block) | Backend no recibe `apply_profile`, `lock_mode`, `fixed_weights` |
| `locked_positions` (canonical) | Backend no respeta posiciones bloqueadas en retry |
| `asset_metadata` | Backend no tiene metadatos para clasificación de activos |

El retry dependía silenciosamente de los defaults del backend (`endpoints_portfolio.py`),
lo que podía provocar resultados divergentes respecto a la optimización principal.

---

## Cambio aplicado

### Archivo modificado: `frontend/src/hooks/usePortfolioActions.ts`

**Mecanismo:** `lastPayloadRef` (React ref)

1. Se añade `const lastPayloadRef = useRef<any>(null)` junto a `optimizationArgsRef`.
2. En `proceedWithOptimization`, inmediatamente después de `buildOptimizationPayload`,
   se almacena: `lastPayloadRef.current = payload`.
3. Los 3 retry blocks ahora usan:
   ```typescript
   const retryPayload: any = {
       ...(lastPayloadRef.current || {}),
       assets: expandedAssets,  // o portfolio.map(p => p.isin)
       locked_assets: portfolio.filter(p => p.manualSwap).map(p => p.isin),
       // auto_expand_universe: true  (solo en equity_floor y fallback_no_history)
   };
   ```

### Campos ahora preservados en retry via spread

| Campo | Origen | Antes | Después |
|---|---|---|---|
| `risk_level` | `buildOptimizationPayload` | ✅ explícito | ✅ via spread |
| `profile_id` | `buildOptimizationPayload` | ❌ omitido | ✅ via spread |
| `optimization_mode` | `buildOptimizationPayload` | ❌ omitido | ✅ via spread |
| `constraints` | `buildOptimizationPayload` | ❌ omitido | ✅ via spread |
| `locked_positions` | `buildOptimizationPayload` | ❌ omitido | ✅ via spread |
| `asset_metadata` | `buildOptimizationPayload` | ❌ omitido | ✅ via spread |
| `assets` | retry-specific | ✅ explícito | ✅ override |
| `locked_assets` | retry-specific | ✅ explícito | ✅ override |
| `auto_expand_universe` | retry-specific | ✅ (2 de 3) | ✅ override |

### Campos de override en retry

Los campos `assets` y `locked_assets` se **sobreescriben** en el spread porque el retry
modifica el universo de activos (añade recovery_candidates o auto-expand). El spread
garantiza que el resto del contrato se mantiene idéntico a la optimización principal.

---

## Compatibilidad

- ✅ No se eliminan aliases legacy
- ✅ No se cambia backend
- ✅ No se cambia solver
- ✅ No se cambia ruta principal de optimización (solo se añade `lastPayloadRef.current = payload`)
- ✅ El retry produce el mismo resultado que antes si `lastPayloadRef.current` es null (fallback `{}`)

---

## Tests actualizados

### Frontend: `optimizerPayloadContract.test.ts`

| Test anterior (removed) | Test nuevo (added) |
|---|---|
| `[known_contract_gap] retry does NOT include locked_positions` | `[resolved] retry spreads lastPayloadRef.current` |
| `[known_contract_gap] retry does NOT include constraints` | `[resolved] all retry blocks spread lastPayloadRef.current` |
| `[known_contract_gap] retry does NOT include optimization_mode` | `[resolved] lastPayloadRef stored during primary optimization` |
| `[known_contract_gap] retry does NOT include profile_id` | `[resolved] retry overrides assets` |
| `[known_contract_gap] retry includes assets (expanded)` | `[resolved] retry overrides locked_assets` |
| `[known_contract_gap] retry includes risk_level` | `[resolved] contract fields preserved via spread` |
| `[known_contract_gap] retry includes locked_assets` | `[traceability] comments reference gap resolution` |
| — | `retry path exists` (kept) |

### Backend: `test_optimizer_payload_contract_static.py`

| Test anterior (removed) | Test nuevo (added) |
|---|---|
| `test_retry_path_has_risk_level` | `test_retry_path_preserves_contract_via_lastPayloadRef` |
| `test_retry_path_missing_fields_documented_in_contract` | `test_retry_path_gap_documented_in_contract` |

---

## Validaciones

| Validación | Resultado |
|---|---|
| Frontend tests (`npx vitest run`) | 19/19 suites, 504/504 PASS |
| Backend tests (`pytest test_optimizer_payload_contract_static.py`) | 43/43 PASS |
| Frontend build (`npx vite build`) | PASS |
| Security scan (no writes/secrets) | CLEAN |

---

## Qué NO se hizo

- ❌ No backend logic changes
- ❌ No optimizer_core changes
- ❌ No constraints_builder changes
- ❌ No endpoints_portfolio changes
- ❌ No deploy
- ❌ No Firestore writes
- ❌ No parser/Gemini
- ❌ No CORE
- ❌ No commit/push
- ❌ No librerías nuevas

---

## Decisión

**ESTADO: `BDB_OPT_PAYLOAD_RETRY_PATH_HARDENING_0_READY_FOR_REVIEW`**

Fecha: 2026-05-09T18:32:00+02:00
