# BDB-MIXED-EXPOSURE-FIX-DRYRUN-0

**Fecha:** 2026-05-10  
**Estado:** ✅ Fix implementado, tests pasando, dry-run script listo  
**Commit:** `7529a23` → pendiente commit

---

## Confirmaciones de Seguridad

- ❌ NO se escribió en Firestore
- ❌ NO se hizo deploy
- ❌ NO se tocó optimizer_core.py
- ❌ NO se tocó suitability_engine.py
- ❌ NO se tocó frontend
- ❌ NO se tocó firestore.rules
- ❌ NO se tocó BDB-FONDOS-CORE
- ✅ Cambios limitados a populate_taxonomy_v2.py, tests y script dry-run

---

## 1. Causa Raíz

`buildPortfolioExposureV2()` en `scripts/maintenance/populate_taxonomy_v2.py` lee `data.get("metrics")` para obtener equity/bond/cash/other. Los fondos MIXED en producción **no tienen** campo `metrics` a nivel raíz, por lo que `total = 0 < 1.0` y el código entraba directamente al fallback por clasificación:

- CONSERVATIVE_ALLOCATION → 20/80
- AGGRESSIVE_ALLOCATION → 80/20
- FLEXIBLE/OTHER → **50/50** ← el problema

Los datos reales de Morningstar ya existían en `ms.portfolio.asset_allocation` pero **nunca se leían**.

## 2. Cambio Implementado

### Nueva precedencia de fuentes (líneas 1603-1657)

```
1. metrics top-level → si existe y suma ≥ 1.0
2. ms.portfolio.asset_allocation → si existe y suma ≥ 10.0  ← NUEVO
3. Fallback por subtype → último recurso, con warnings
```

### Trazabilidad añadida

| Fuente | Warning | exposure_confidence |
|--------|---------|-------------------|
| metrics | (ninguno) | 0.90 |
| ms.portfolio.asset_allocation | `EXPOSURE_SOURCE_MS_PORTFOLIO` | 0.85 |
| fallback | `EXPOSURE_INFERRED_FROM_CLASSIFICATION` | 0.55 |

### Guard: ms_total ≥ 10.0

Si la suma de componentes Morningstar es < 10.0, se considera dato inválido y se cae al fallback. Esto previene usar datos parciales/corruptos.

## 3. Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `scripts/maintenance/populate_taxonomy_v2.py` | Fix `buildPortfolioExposureV2` + confidence |
| `functions_python/scripts/migration/populate_taxonomy_v2.py` | Mismo fix (copia sincronizada) |
| `functions_python/tests/test_mixed_exposure_ms_portfolio.py` | **NUEVO** — 11 tests |
| `scripts/maintenance/bdb_mixed_exposure_fix_dry_run.py` | **NUEVO** — dry-run read-only |
| `docs/BDB_MIXED_EXPOSURE_FIX_DRYRUN_0.md` | **NUEVO** — esta documentación |

## 4. Tests Añadidos

11 tests en `test_mixed_exposure_ms_portfolio.py`:

| Test | Escenario | Resultado |
|------|-----------|-----------|
| `TestMixedWithMsPortfolio::test_flexible_uses_morningstar_data` | Brightgate Focus: eq=85.58 de MS, no 50/50 | ✅ PASS |
| `TestMixedWithMsPortfolio::test_conservative_uses_morningstar_data` | Cartesio X: eq=24.44 de MS, no hardcoded | ✅ PASS |
| `TestMixedFallback::test_flexible_fallback_50_50` | Sin datos → 50/50 con warning | ✅ PASS |
| `TestMixedFallback::test_conservative_fallback_20_80` | Sin datos → 20/80 con warning | ✅ PASS |
| `TestMixedFallback::test_aggressive_fallback_80_20` | Sin datos → 80/20 con warning | ✅ PASS |
| `TestMetricsPrecedence::test_metrics_takes_precedence` | metrics=90% > ms=70% → usa 90% | ✅ PASS |
| `TestScaleConsistency::test_morningstar_scale_preserved` | Escala 0-100 mantenida | ✅ PASS |
| `TestScaleConsistency::test_morningstar_sum_normalizes` | Suma 95 → normaliza a 100 | ✅ PASS |
| `TestScaleConsistency::test_morningstar_low_sum_rejected` | Suma < 10 → fallback | ✅ PASS |
| `TestNonMixedUnaffected::test_equity_still_infers_100` | EQUITY sin cambio | ✅ PASS |
| `TestNonMixedUnaffected::test_fixed_income_still_infers_100` | FI sin cambio | ✅ PASS |

## 5. Tests de Regresión

| Suite | Tests | Resultado |
|-------|-------|-----------|
| `test_mixed_funds_lookthrough_contract.py` | 4 | ✅ 4 passed |
| `test_suitability_v2.py` | 47 | ✅ 47 passed |
| `test_optimizer_core.py` | 2 | ✅ 2 passed |
| `test_constraints_canonical_contract.py` | 9 | ✅ 9 passed |
| **Total** | **62** | ✅ **62 passed** |

## 6. Dry-Run Script

**Archivo:** `scripts/maintenance/bdb_mixed_exposure_fix_dry_run.py`

**Uso:**
```bash
python scripts/maintenance/bdb_mixed_exposure_fix_dry_run.py
```

**Genera:** `artifacts/bdb_mixed_exposure_fix/mixed_exposure_fix_dry_run.json`

**Contenido del artifact:** Por cada ISIN MIXED:
- `old_economic_exposure` vs `proposed_economic_exposure`
- `delta_equity`, `delta_bond`, `delta_cash`, `delta_other`
- `source_used`: metrics | ms_portfolio_asset_allocation | fallback
- `write_recommended`: true si datos reales disponibles y actual es fallback
- `review_required`: true si delta equity > 10 puntos

**Nota:** El script requiere acceso a Firestore (serviceAccountKey.json) para leer los documentos. No ejecutado automáticamente en este paso por ser read-only contra producción.

## 7. Fondos Afectados (Estimación de Audit Previo)

De la auditoría BDB_MIXED_EXPOSURE_SOURCE_AUDIT_0.md:

| Grupo | Fondos | Cambio esperado |
|-------|--------|-----------------|
| Fallback 50/50 con ms.portfolio | ~13 | Pasarán a usar datos reales de MS |
| Fallback 20/80 o 80/20 con ms.portfolio | ~3 | Pasarán a usar datos reales de MS |
| Sin ms.portfolio | ~0 (estimado) | Mantienen fallback |
| Con metrics válido | ~4 | Sin cambio |

## 8. Mapeo de Campos

```
ms.portfolio.asset_allocation.equity  → economic_exposure.equity  (0-100)
ms.portfolio.asset_allocation.bond    → economic_exposure.bond    (0-100)
ms.portfolio.asset_allocation.cash    → economic_exposure.cash    (0-100)
ms.portfolio.asset_allocation.other   → economic_exposure.other   (0-100)
```

**Campos no mapeados:** `alternative`, `real_asset`, `commodities` no existen en `ms.portfolio.asset_allocation`. El modelo `EconomicExposureV2` solo tiene 4 campos (equity, bond, cash, other). Si Morningstar incluyera exposure a alternativas, se agregaría a `other` por la normalización existente en `_normalize_pct_block`.

## 9. Siguiente Paso Recomendado

1. **Ejecutar dry-run** contra producción para generar el artifact con datos reales
2. **Revisar artifact** — confirmar que los deltas son coherentes con datos Morningstar
3. **Write gate controlado**: Re-ejecutar `populate_taxonomy_v2.py --execute` que ahora usará ms.portfolio automáticamente, o crear un script de patch puntual
4. **Validar** portfolios P1-P10 después del write
