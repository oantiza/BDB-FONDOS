# BDB-FRONTEND-DEAD-CODE-CLEANUP-0

## Objetivo

Eliminar dead code del frontend previamente auditado en el bloque `BDB-BUSINESS-RULES-ENDPOINT-AUDIT-0`.

## Referencia

- Documento de auditoría: [`BDB_BUSINESS_RULES_ENDPOINT_AUDIT_0.md`](./BDB_BUSINESS_RULES_ENDPOINT_AUDIT_0.md)
- Hallazgo origen: H-06 (Delta Audit 2026-05-11)
- Recomendación aplicada: Opción B — Eliminar `syncBusinessRulesFromBackend()`

## Función Eliminada

| Campo | Valor |
|---|---|
| **Función** | `syncBusinessRulesFromBackend(functionsInstance: any)` |
| **Archivo** | `frontend/src/utils/rulesEngine.ts` |
| **Líneas** | 657-682 (26 líneas eliminadas, incluyendo comentario) |
| **Tipo** | `export async function` |
| **Endpoint llamado** | `httpsCallable('get_business_rules')` — **no existe en backend** |
| **Imports de esta función** | **0** — nunca fue importada |
| **Invocaciones** | **0** — nunca fue llamada |

## Justificación

1. La función estaba exportada pero **nunca importada ni invocada** en ningún componente.
2. Llamaba a un endpoint backend (`get_business_rules`) que **no existe**.
3. El frontend ya obtiene perfiles de riesgo directamente de Firestore en `App.tsx` via `syncRiskProfilesFromDB()`.
4. Backend y frontend leen la misma fuente canónica: `system_settings/risk_profiles`.
5. Eliminar este dead code reduce confusión y deuda técnica sin impacto funcional.

## Archivos Tocados

| Archivo | Cambio |
|---|---|
| `frontend/src/utils/rulesEngine.ts` | Eliminada función `syncBusinessRulesFromBackend` y comentario asociado |

## Archivos NO Tocados

- `App.tsx` — sin cambios, sigue usando `syncRiskProfilesFromDB`
- `optimizer_core.py` — sin cambios
- `suitability_engine.py` — sin cambios
- `firestore.rules` — sin cambios
- `storage.rules` — sin cambios
- Backend completo — sin cambios

## Validaciones Ejecutadas

### Búsquedas post-eliminación

| Búsqueda | Resultado |
|---|---|
| `syncBusinessRulesFromBackend` en `frontend/**/*.{ts,tsx}` | **0 resultados** ✅ |
| `get_business_rules` en `frontend/**/*.{ts,tsx}` | **0 resultados** ✅ |
| `syncRiskProfilesFromDB` en `frontend/**/*.{ts,tsx}` | **3 resultados**: definición (L650), import (App.tsx:23), uso (App.tsx:55) ✅ |

### TypeScript check (`tsc --noEmit`)

- **0 errores en `rulesEngine.ts`** ✅
- Errores preexistentes en archivos no relacionados (no causados por este cambio):
  - `XRayReportGenerator.tsx`: `Html2CanvasOptions` type mismatch (3 errors)
  - `portfolioAnalyticsEngine.ts`: `BacktestResponse` union type narrowing (5 errors)
  - `usePortfolioActions.ts`: `AssetClassV2` enum overlap + `PortfolioMetrics` missing properties (5 errors)

### Build (`vite build`)

- Fallo preexistente: `Could not resolve "../assets/fondo_v1.png"` en `RetirementCalculatorPage.tsx`
- **No causado por este cambio**

## Fuente Canónica de Perfiles

**Sin cambios.** La cadena canónica permanece intacta:

```
Firestore: system_settings/risk_profiles
  ├── Backend (optimizer_core.py L301): lee directamente
  └── Frontend (App.tsx L46): lee directamente → syncRiskProfilesFromDB()
```

## Confirmaciones

| Verificación | Estado |
|---|---|
| Deploy | **NO** |
| Firestore writes | **0** |
| BDB-FONDOS-CORE | **NO tocado** |
| optimizer_core.py | **NO tocado** |
| suitability_engine.py | **NO tocado** |
| Lógica financiera | **NO tocada** |
| Perfiles de riesgo | **NO modificados** |
| `syncRiskProfilesFromDB` | **Intacta y activa** |

---

**Fecha**: 2026-05-12  
**Bloque**: `BDB-FRONTEND-DEAD-CODE-CLEANUP-0`  
**Autor**: Agente automático
