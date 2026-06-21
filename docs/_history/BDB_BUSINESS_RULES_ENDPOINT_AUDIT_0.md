# BDB-BUSINESS-RULES-ENDPOINT-AUDIT-0

## Resumen Ejecutivo

El frontend define `syncBusinessRulesFromBackend()` que llama a `httpsCallable('get_business_rules')`. Este endpoint **no existe en el backend**. Sin embargo, la función **nunca se invoca** desde ningún punto de la aplicación. El frontend ya obtiene los perfiles de riesgo directamente de Firestore (`system_settings/risk_profiles`) a través de una vía completamente funcional. El código es **dead code preparatorio** — un stub de integración futura que nunca fue conectado al flujo principal.

**Recomendación: Opción D — Dejar como TODO documentado, con eliminación diferida en el bloque de limpieza siguiente.**

---

## 1. Mapa del Flujo Actual de Business Rules

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      FLUJO REAL EN PRODUCCIÓN                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  App.tsx (useEffect, L43-65)                                             │
│    │                                                                     │
│    ├──→ Firestore: doc(db, 'system_settings', 'risk_profiles')           │
│    │      │                                                              │
│    │      └──→ syncRiskProfilesFromDB(profiles)                          │
│    │             │                                                       │
│    │             └──→ applyCanonicalRiskProfiles(payload, "firestore")    │
│    │                    │                                                │
│    │                    └──→ RISK_PROFILES = nextProfiles (overwrite)     │
│    │                         riskProfilesSource = "firestore"            │
│    │                                                                     │
│    └──→ isSyncingRiskProfiles = false → render app                       │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                     FLUJO MUERTO (DEAD CODE)                             │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  rulesEngine.ts L658-682:                                                │
│    export async function syncBusinessRulesFromBackend(functionsInstance)  │
│      │                                                                   │
│      ├──→ httpsCallable('get_business_rules') ← NO EXISTE BACKEND       │
│      │                                                                   │
│      ├──→ applyCanonicalRiskProfiles(data.risk_profiles, "backend")      │
│      │                                                                   │
│      └──→ try/catch → fallback silencioso                                │
│                                                                          │
│    ⚠️ Esta función está EXPORTADA pero NUNCA IMPORTADA ni INVOCADA       │
│       en ningún archivo del frontend.                                    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Cadena de Precedencia de Risk Profiles (3 fuentes)

| Prioridad | Fuente | Estado | Implementada |
|-----------|--------|--------|--------------|
| 1 (más alta) | Backend callable `get_business_rules` | ❌ No existe endpoint | ❌ No conectada |
| 2 | Firestore `system_settings/risk_profiles` | ✅ Funcional | ✅ Activa en `App.tsx` |
| 3 (fallback) | `LOCAL_RISK_PROFILE_SEED` (hardcoded en `rulesEngine.ts`) | ✅ Siempre disponible | ✅ Seed por defecto |

---

## 2. Evidencia: `get_business_rules` NO existe en backend

### Búsqueda exhaustiva

| Búsqueda | Ámbito | Resultado |
|----------|--------|-----------|
| `get_business_rules` | `functions_python/**/*.py` | **0 resultados** |
| `business_rules` | `functions_python/**/*.py` | **0 resultados** |
| `get_business_rules` | `functions_python/main.py` (exports) | **No aparece** |

### Functions registradas en `main.py` (L1-59)

Las 17 funciones exportadas son:

| Módulo | Functions |
|--------|-----------|
| `schedulers` | `scheduleWeeklyResearch`, `runMasterDailyRoutine`, `runDailyDataValidation` |
| `endpoints_portfolio` | `optimize_portfolio_quant`, `backtest_portfolio`, `backtest_portfolio_multi`, `getEfficientFrontier`, `analyze_portfolio_endpoint` |
| `endpoints_macro` | `get_economic_calendar` |
| `endpoints_admin` | `force_weekly_research`, `generate_analysis_report`, `restore_historico`, `insertMonthlyReport`, `getRiskRate`, `updateFundHistory`, `refresh_daily_metrics` |
| `endpoints_xray_comparador` | `compare_risk_free` |
| `endpoints_admin_console` | `admin_health`, `admin_fund_search` |

**Ninguna se llama `get_business_rules` ni tiene funcionalidad equivalente.**

---

## 3. Evidencia: `syncBusinessRulesFromBackend` NUNCA se invoca

### Grep completo en `frontend/src/**/*.{ts,tsx}`

| Búsqueda | Resultado |
|----------|-----------|
| `syncBusinessRulesFromBackend` en imports | **0 resultados** (solo la definición en L658) |
| `syncBusinessRulesFromBackend` en llamadas | **0 resultados** |
| `functionsInstance` en uso | Solo dentro de la propia función (L658, L661) |

### Imports reales de `rulesEngine.ts` en el proyecto

| Archivo | Import |
|---------|--------|
| `App.tsx` | `syncRiskProfilesFromDB` (Firestore path) |
| `usePortfolioActions.ts` | `generateSmartPortfolioLocal` |
| `fundSwapper.ts` | `calculateScore` |
| `pdfGenerator.ts` | `RISK_PROFILES` |
| Tests | `isFundSuitableForProfile`, `generateSmartPortfolioLocal` |

**Conclusión**: `syncBusinessRulesFromBackend` está exportada pero **no es importada ni invocada por ningún componente**.

---

## 4. Fuente Canónica Actual de Risk Profiles

### Backend (optimizer_core.py)

```python
# optimizer_core.py L301
risk_profile_doc = db.collection("system_settings").document("risk_profiles").get()
```

El optimizer lee directamente de Firestore `system_settings/risk_profiles` en cada ejecución. No necesita un endpoint intermediario.

### Frontend (App.tsx)

```typescript
// App.tsx L46
const docRef = doc(db, 'system_settings', 'risk_profiles');
const docSnap = await getDoc(docRef);
syncRiskProfilesFromDB(profiles);
```

El frontend lee el **mismo documento Firestore** al arrancar y sobrescribe la seed local con `riskProfilesSource = "firestore"`.

### Backend config.py

```python
CANONICAL_RISK_PROFILE_DOC = "system_settings/risk_profiles"
```

Declarado como constante canónica.

### Conclusión de Fuente de Verdad

```
┌─────────────────────────────────────────────────┐
│  FUENTE DE VERDAD CANÓNICA:                      │
│  Firestore: system_settings/risk_profiles        │
│                                                   │
│  • Backend (optimizer): lee directamente          │
│  • Frontend (App.tsx): lee directamente            │
│  • Ambos leen del MISMO documento                 │
│  • No hay intermediario ni endpoint necesario     │
└─────────────────────────────────────────────────┘
```

---

## 5. Análisis de Riesgo

### ¿Hay riesgo de divergencia en primer render o modo offline?

**No en producción actual.** La cadena funcional es:

1. `App.tsx` bloquea el render con `isSyncingRiskProfiles = true` (L96-103)
2. Lee `system_settings/risk_profiles` de Firestore
3. Si existe → sobrescribe la seed local vía `syncRiskProfilesFromDB`
4. Si falla → `setConfigError` muestra pantalla de error (L78-90)
5. Solo si Firestore retorna datos válidos → render normal

**Riesgo residual bajo**: Si Firestore no responde (offline total), el frontend mostrará error de carga, no datos divergentes. La seed local actuaría como fallback solo si se modifica la lógica de manejo de errores.

### ¿Riesgo del dead code?

| Riesgo | Severidad | Detalle |
|--------|-----------|---------|
| Confusión de mantenimiento | Baja | Un desarrollador podría creer que `syncBusinessRulesFromBackend` debe llamarse |
| Falsa expectativa de contrato | Baja | Los docs (L657) dicen "FASE 1" sugiriendo que fue planificada pero nunca implementada |
| Deuda técnica acumulada | Baja | Código inerte que ocupa espacio en el bundle |
| Riesgo funcional | **Nulo** | No se ejecuta nunca |

---

## 6. Análisis de Opciones

### Opción A — Implementar endpoint `get_business_rules`

**Pros**:
- Centraliza la exposición de configuración en un solo endpoint
- Alinea la marca `riskProfilesSource = "backend"` como fuente de mayor autoridad

**Contras**:
- **Duplica** lo que Firestore ya proporciona directamente (ambos leen `system_settings/risk_profiles`)
- Añade latencia (Firestore directo ≈ 50ms, callable ≈ 200-500ms cold start)
- Requiere implementar, testear y desplegar un endpoint nuevo sin ganancia funcional
- El frontend ya funciona perfectamente con lectura directa de Firestore

**Veredicto**: ❌ No recomendado ahora. Sería útil **solo** si se necesita lógica de negocio computada (e.g., reglas dinámicas por usuario, A/B testing de perfiles).

### Opción B — Eliminar `syncBusinessRulesFromBackend` del frontend

**Pros**:
- Elimina dead code y confusión
- Reduce bundle size (marginalmente)
- Limpia la interfaz pública de `rulesEngine.ts`

**Contras**:
- Requiere modificar `rulesEngine.ts` (toca frontend)
- Riesgo bajo pero no nulo de romper imports futuros si alguien esperaba esta función
- Bloque adicional de deploy (hosting) para solo 25 líneas

**Veredicto**: ✅ Recomendado como parte de un bloque de limpieza mayor (no solo por esto).

### Opción C — Sustituir por lectura Firestore directa

**Pros**: N/A — **ya es así**. El frontend ya lee de Firestore directamente en `App.tsx`.

**Veredicto**: ⚪ No aplica. Ya está implementado.

### Opción D — Dejar como TODO documentado

**Pros**:
- Cero riesgo de regresión
- No requiere deploy
- Documenta la decisión para futura referencia
- Permite evaluar en contexto de un bloque de limpieza mayor

**Contras**:
- El dead code permanece
- Requiere disciplina documental

**Veredicto**: ✅ **Recomendado como acción inmediata.**

---

## 7. Recomendación Profesional

### Decisión propuesta: **D → B (secuencial)**

1. **Inmediato (este bloque)**: Opción **D** — Documentar que `syncBusinessRulesFromBackend` es dead code preparatorio. No tocar código. Este documento es suficiente como registro.

2. **Bloque futuro `BDB-FRONTEND-DEAD-CODE-CLEANUP-0`**: Opción **B** — Eliminar la función junto con otros dead code identificados en el frontend. Incluir en un deploy de hosting programado.

### Justificación

- La función no se ejecuta, no impacta producción, no genera riesgo funcional.
- Implementar un endpoint nuevo (`A`) sería **sobre-ingeniería** dado que Firestore ya sirve el mismo dato con menor latencia.
- Eliminar (`B`) es correcto pero conviene agruparlo con otras limpiezas para justificar un deploy de hosting.
- El flujo actual (Firestore directo) es la arquitectura correcta para este caso de uso.

---

## 8. Bloque Siguiente Recomendado (si se aprueba B)

### `BDB-FRONTEND-DEAD-CODE-CLEANUP-0`

| Ítem | Detalle |
|------|---------|
| **Objetivo** | Eliminar dead code del frontend |
| **Archivos** | `frontend/src/utils/rulesEngine.ts` |
| **Cambio** | Eliminar `syncBusinessRulesFromBackend()` (L657-682) |
| **Tipo de función** | Solo eliminar export; no hay imports que romper |
| **Tests** | Verificar que no hay imports rotos con `tsc --noEmit` |
| **Deploy** | `firebase deploy --only hosting` (requiere `npm run build` previo) |
| **Dependencias** | Ninguna — la función nunca se invoca |

---

## 9. Confirmaciones de Auditoría

| Verificación | Estado |
|---|---|
| Código modificado | **NO** |
| Firestore writes | **0** |
| Deploy | **NO** |
| BDB-FONDOS-CORE tocado | **NO** |
| optimizer_core.py tocado | **NO** |
| suitability_engine.py tocado | **NO** |
| firestore.rules tocado | **NO** |
| storage.rules tocado | **NO** |
| Working tree | **limpio** |

---

**Fecha**: 2026-05-12  
**Bloque**: `BDB-BUSINESS-RULES-ENDPOINT-AUDIT-0`  
**Hallazgo origen**: H-06 (Delta Audit 2026-05-11)  
**Autor**: Agente automático
