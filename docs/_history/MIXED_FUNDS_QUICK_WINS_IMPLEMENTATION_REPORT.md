# MIXED_FUNDS_QUICK_WINS_IMPLEMENTATION_REPORT

**Fecha:** 2026-05-05  
**Autor:** Agente Antigravity (Claude Opus 4.6)  
**Estado:** ✅ Implementado — pendiente ejecución de tests por usuario  
**Scope:** Frontend only — zero backend/deploy impact

---

## Resumen Ejecutivo

Se implementaron 4 quick wins de bajo riesgo para corregir el tratamiento de fondos Mixtos en el frontend de BDB-FONDOS. Los cambios son reversibles, no tocan el solver backend ni las reglas de Firestore, y están respaldados por 16 tests unitarios nuevos.

---

## Cambios Realizados

### 1. Sidebar.tsx — Filtro visual de Mixto (línea 201)

**Problema:** El filtro del Sidebar para "Mixto" solo aceptaba `v2.asset_type === 'ALLOCATION'`, pero el normalizador del sistema convierte `ALLOCATION` → `MIXED`. La mayoría de fondos en BD tienen `asset_type=MIXED`, por lo que al seleccionar "Mixto" en el dropdown no aparecía ningún fondo.

**Cambio:**
```diff
-else if (category === 'Mixto') categoryMatch = v2.asset_type === 'ALLOCATION';
+else if (category === 'Mixto') categoryMatch = v2.asset_type === 'MIXED' || v2.asset_type === 'ALLOCATION';
```

**Riesgo:** Nulo. El test existente en `suitability.test.ts:60` ya esperaba exactamente este comportamiento (`v2.asset_type === 'ALLOCATION' || v2.asset_type === 'MIXED'`), confirmando que la lógica del test y la del Sidebar estaban desalineadas.

---

### 2. usePortfolioActions.ts — Autocompletar P8-P10 (líneas 337, 348-358)

**Problema:** Para perfiles ≥8, el autocompletar solo admitía `['RV', 'EQUITY']`, excluyendo completamente todos los Mixtos. Un Mixto agresivo con 85% de equity real no podía ser considerado.

**Cambio:**
- Se añadió `'MIXED'` al set de tipos válidos para P8+.
- Se añadió un gate de seguridad: solo se permiten Mixtos con `asset_subtype === 'AGGRESSIVE_ALLOCATION'` O con `equity exposure ≥ 75%`.
- Mixtos moderados/conservadores siguen excluidos de P8+.

**Riesgo:** Bajo. El gate es estricto y no abre la puerta a Mixtos genéricos. Solo permite los que son funcionalmente equivalentes a RV.

---

### 3. rulesEngine.ts — Look-through para GENERAR local (líneas 304-318)

**Problema:** La función `getAssetClass()` clasificaba todos los fondos con `asset_type=MIXED` directamente en el bucket "Mixto", sin consultar su exposición económica real. Esto provocaba que un Mixto con 85% equity consumiera el escaso presupuesto del bucket "Mixto" (ej: max 5% en P9) en vez de asignarse al bucket "RV" (95-100%).

**Cambio:**
- Para fondos MIXED/ALLOCATION, se consulta primero `portfolio_exposure_v2.economic_exposure` (look-through).
- Si la exposición indica claramente un perfil (ej: ≥80% equity → "RV"), se usa ese bucket.
- Si no hay datos de exposición usables, se emite un `console.warn` y se degrada a "Mixto".
- Los fondos no-MIXED siguen la ruta original sin cambios.

**Riesgo:** Medio-bajo. Este es el cambio más significativo. El riesgo es que un Mixto con exposición ambigua (45% equity, 45% bond) sea clasificado como "Mixto" por la función `getAssetClassFromEconomicExposure` (que requiere equity ≥ 25 Y bond ≥ 25 para devolver "Mixto"), lo cual es exactamente el comportamiento deseado.

---

### 4. mixedFunds.test.ts — 16 tests nuevos

Se creó `frontend/src/__tests__/mixedFunds.test.ts` con 3 suites:

| Suite | Tests | Cobertura |
|-------|-------|-----------|
| Sidebar Mixto filter | 4 | MIXED y ALLOCATION pasan, EQUITY no, undefined no |
| Autocomplete aggressive gate | 6 | AGGRESSIVE_ALLOCATION ok, 80% equity ok, 50% equity no, sin exposure no |
| Look-through classification | 6 | 85% equity → RV, 30/60 → Mixto, 20/75 → RF, sin exposure → Mixto |

---

## Ejecución de Tests

> ⚠️ **La ejecución automática de tests falló por un error de sandbox del entorno Windows.** El usuario debe ejecutar manualmente:

```bash
cd frontend
npm test -- --run --reporter=verbose
```

Esto ejecutará los 4 ficheros de test (3 existentes + 1 nuevo):
- `__tests__/enumConsistency.test.ts`
- `__tests__/suitability.test.ts`
- `__tests__/v2Helpers.test.ts`
- `__tests__/mixedFunds.test.ts` ← **NUEVO**

---

## Archivos Modificados

| Archivo | Tipo | Líneas cambiadas |
|---------|------|------------------|
| `frontend/src/components/Sidebar.tsx` | MODIFY | 1 línea |
| `frontend/src/hooks/usePortfolioActions.ts` | MODIFY | 13 líneas |
| `frontend/src/utils/rulesEngine.ts` | MODIFY | 19 líneas (+16, -5) |
| `frontend/src/__tests__/mixedFunds.test.ts` | NEW | 172 líneas |

## Archivos NO Tocados

| Archivo | Razón |
|---------|-------|
| `optimizer_core.py` | Fuera de scope (solver backend) |
| `firestore.rules` | No se modifica seguridad |
| `RISK_PROFILES` | Los buckets min/max de Mixto no cambian |
| `normalizer.ts` | Ya correcto (`ALLOCATION` → `MIXED`) |
| `classificationAuditor.ts` | Ya detecta `ALLOCATION_WITHOUT_EXPOSURE` |
| `fundTaxonomy.ts` | Ya normaliza correctamente |

---

## Riesgos Pendientes (Fase Posterior)

1. **Mixtos sin `portfolio_exposure_v2`:** Siguen entrando en bucket "Mixto" sin bloqueo. Solo se emite `console.warn`. Fase futura debería evaluar si bloquear o marcar visualmente.

2. **Divergencia GENERAR ↔ OPTIMIZAR:** El solver backend puede tratar un Mixto diferente de como lo clasifica GENERAR si los datos de exposure difieren entre frontend y backend. Requiere auditoría cruzada.

3. **`FundSwapModal` y `SharpeMaximizerModal`:** Usan `MIXED_ALLOCATION` como valor de `<option>` (no `MIXED`). Inconsistencia menor que puede causar confusión en filtros de swap.

4. **RISK_BUCKETS_LABELS:** No se ha añadido "Mixto Look-through" como etiqueta. El bucket sigue llamándose "Mixto" aunque un fondo pueda ser reclasificado internamente.

---

## Reversión

Cada cambio es independiente y reversible:
- **Sidebar:** Revertir línea 201 a `v2.asset_type === 'ALLOCATION'`
- **Autocompletar:** Revertir línea 337 a `['RV', 'EQUITY']` y eliminar bloque 348-358
- **RulesEngine:** Eliminar bloque 304-318 y restaurar `getAssetClassFromEconomicExposure` después de `mapCanonicalAssetTypeToBucket`
- **Tests:** Eliminar `mixedFunds.test.ts`

---

## Confirmación de Compliance

- ✅ NO se hizo deploy
- ✅ NO se hizo push
- ✅ NO se hizo commit
- ✅ NO se tocaron credenciales
- ✅ NO se modificó firestore.rules
- ✅ NO se modificó optimizer_core.py
- ✅ NO se añadió vector hard Mixto al solver
- ✅ NO se cambió RISK_BUCKETS_LABELS
