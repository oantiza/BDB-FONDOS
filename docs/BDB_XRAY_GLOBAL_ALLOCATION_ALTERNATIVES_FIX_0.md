# BDB-FONDOS — X-Ray Global Allocation Alternatives Fix
## BDB-XRAY-GLOBAL-ALLOCATION-ALTERNATIVES-FIX-0

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-05-10 |
| **Branch** | `master` |
| **Origen** | Hallazgo F-07 de `BDB_AUDIT_2026_05_10_VERIFICATION_0.md` |

---

## Problema Detectado

El cálculo de `globalAllocation` en `usePortfolioStats.ts` solo acumulaba 4 dimensiones:
- `equity`, `bond`, `cash`, `other`

Los campos `alternative` y `real_asset` disponibles en `portfolio_exposure_v2.economic_exposure` eran **ignorados silenciosamente**. Esto causaba:

1. Fondos alternativos (hedge funds, retorno absoluto, commodities, real estate) no aparecían en el gráfico de Composición Global del X-Ray.
2. En el heurístico de fallback (Strategy 3), las categorías "alternative", "real_estate", "commodities", "absolute return" y "retorno absoluto" se clasificaban como `other` en lugar de un bucket propio.
3. El resumen visual de activos (Renta Var. / Renta Fija / Otros y Liquidez) no tenía espacio para Alternativos.

## Decisión de Bucket

| Decisión | Valor |
|----------|-------|
| **Nombre del bucket** | `alternative` |
| **Composición** | `alternative + real_asset` (ambos sumados) |
| **Label en UI** | "Alternativos" / "Alternat." |
| **Color** | Purple (`#6B21A8`, `bg-purple-50/50`, `border-purple-100`) |
| **Visibilidad** | Solo se muestra si > 0.1% (evita ruido visual) |
| **Grid** | 3 columnas si no hay alternativos, 4 columnas si los hay |

**Motivo**: `real_asset` incluye REITs, commodities y activos reales que en la práctica se agrupan comercialmente como "Alternativos". Esta agrupación es consistente con la función `get_profile_bucket_exposure` del backend (`utils.py` L366-370) que suma `alternative + real_asset` en un solo bucket `Alternativos`.

## Archivos Tocados

| Archivo | Cambio |
|---------|--------|
| `frontend/src/hooks/usePortfolioStats.ts` | Añadido `totalAlternative` acumulador. Strategy 1 (V2) lee `alternative` + `real_asset`. Strategy 2 (metrics) lee `alternative` + `real_asset`. Strategy 3 (heuristics) redirige categorías alternativas al nuevo bucket. Output incluye campo `alternative`. |
| `frontend/src/components/xray/AssetAllocationSection.tsx` | Interfaz actualizada para aceptar `alternative`. Chart fallback incluye "Alternativos". Grid summary muestra 4ª columna condicional. |
| `frontend/src/components/xray/pdf/XRayPdfSections.tsx` | Interfaz PDF actualizada con `alternative`. Chart y summary alineados con la versión interactiva. |

## Compatibilidad con Datos Antiguos

| Escenario | Comportamiento |
|-----------|---------------|
| Fondo sin `alternative` en `economic_exposure` | `Number(undefined) \|\| 0` → `eeAlt = 0`. Sin impacto. |
| Fondo sin `real_asset` en `economic_exposure` | `Number(undefined) \|\| 0` → `eeRa = 0`. Sin impacto. |
| Fondo sin `portfolio_exposure_v2` (solo `metrics`) | Strategy 2 intenta `p.metrics.alternative` y `p.metrics.real_asset`. Si no existen → 0. Sin impacto. |
| Fondo sin ningún dato (heuristic fallback) | Las categorías alternative/real_estate/commodities ahora van a `alt` en vez de `other`. Mejora la clasificación. |
| Portfolio 100% equity/bond/cash | `totalAlternative = 0`, `alternative = 0` en output. Grid muestra 3 columnas. Visualmente idéntico al antes. |

## Tests Ejecutados

| Test | Resultado |
|------|-----------|
| `npx vitest run` | 392 passed, 7 failed (pre-existente: `adminFundSearch` por `auth/invalid-api-key`) |
| `npm run build` | Fallo pre-existente: `fondo_v1.png` missing en `RetirementCalculatorPage.tsx` (confirmado idéntico sin mis cambios) |
| `npx tsc --noEmit` | 16 errores pre-existentes en archivos NO tocados. Cero errores nuevos. |

## Confirmación de No-Touch

| Componente | ¿Tocado? |
|-----------|----------|
| Backend Python | NO |
| Optimizer | NO |
| Parser | NO |
| Firestore rules | NO |
| firestore.indexes.json | NO |
| Datos de Firestore | NO |
| BDB-FONDOS-CORE | NO |
| Deploy | NO realizado |
