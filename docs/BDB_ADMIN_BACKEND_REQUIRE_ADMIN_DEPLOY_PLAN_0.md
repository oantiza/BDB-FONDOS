# BDB_ADMIN_BACKEND_REQUIRE_ADMIN_DEPLOY_PLAN_0

## 1. Resumen Ejecutivo

Plan de deploy controlado para las 2 nuevas Cloud Functions admin read-only:
`admin_health` y `admin_fund_search`.

Firebase CLI soporta deploy de functions específicas por nombre, lo que permite
desplegar solo las 2 nuevas sin redesplegar las 17 existentes.

## 2. Estado Base

| Campo | Valor |
|---|---|
| HEAD | `a05e660` |
| origin/master | `a05e660` |
| Commit | `ADMIN_BACKEND: add read-only admin auth endpoints` |
| Backend admin read-only | cerrado y pusheado ✅ |
| Functions deploy previo | ninguno para admin_health/admin_fund_search |
| Producción | operativa (hosting + functions existentes) |

## 3. Functions Candidatas al Deploy

| Function | Tipo | Acceso | Firestore | Write |
|---|---|---|---|---|
| `admin_health` | @on_call | admin-only | NO | NO |
| `admin_fund_search` | @on_call | admin-only | Lee `funds_v3` | NO |

## 4. Configuración Actual de Deploy

### firebase.json
```json
{
    "functions": {
        "source": "functions_python",
        "runtime": "python312",
        "ignore": ["venv", ".git", "__pycache__", "*.pyc"]
    }
}
```

- **Source única**: `functions_python` (no hay codebase múltiple).
- **Runtime**: Python 3.12.
- **Entrypoint**: `main.py` exporta 19 functions al module level.

### Functions Exportadas (19 total)

| # | Function | Módulo | Riesgo redeploy |
|---|---|---|---|
| 1 | `scheduleWeeklyResearch` | schedulers | ⚠️ SCHEDULER — redeploy puede resetear timer |
| 2 | `runMasterDailyRoutine` | schedulers | ⚠️ SCHEDULER |
| 3 | `runDailyDataValidation` | schedulers | ⚠️ SCHEDULER |
| 4 | `optimize_portfolio_quant` | portfolio | BAJO — read-only compute |
| 5 | `backtest_portfolio` | portfolio | BAJO |
| 6 | `backtest_portfolio_multi` | portfolio | BAJO |
| 7 | `getEfficientFrontier` | portfolio | BAJO |
| 8 | `analyze_portfolio_endpoint` | portfolio | BAJO |
| 9 | `get_economic_calendar` | macro | BAJO |
| 10 | `force_weekly_research` | admin | ⚠️ WRITE — triggers research + Gemini |
| 11 | `generate_analysis_report` | admin | ⚠️ WRITE — triggers research |
| 12 | `restore_historico` | admin | ⚠️ WRITE |
| 13 | `insertMonthlyReport` | admin | ⚠️ WRITE |
| 14 | `getRiskRate` | admin | BAJO — read-only |
| 15 | `updateFundHistory` | admin | ⚠️ WRITE |
| 16 | `refresh_daily_metrics` | admin | ⚠️ WRITE + scheduler trigger |
| 17 | `compare_risk_free` | xray | BAJO — read-only |
| 18 | **`admin_health`** | admin_console | ✅ NEW — read-only |
| 19 | **`admin_fund_search`** | admin_console | ✅ NEW — read-only |

## 5. Análisis de Riesgo

### Opción A: `firebase deploy --only functions` (TODAS)

| Aspecto | Evaluación |
|---|---|
| Alcance | Redespliega las 19 functions |
| Riesgo schedulers | ⚠️ MEDIO — redeploy de schedulers puede resetear timers de cron |
| Riesgo write functions | ⚠️ BAJO — no modifica lógica, pero redespliega código idéntico |
| Riesgo downtime | ⚠️ BAJO — Firebase despliega en caliente, pero hay ventana de segundos |
| Cold start | ⚠️ BAJO — todas las functions tendrán cold start post-deploy |

**Veredicto**: Viable pero innecesariamente amplio. Preferir deploy específico.

### Opción B: `firebase deploy --only functions:admin_health,functions:admin_fund_search` (ESPECÍFICO)

| Aspecto | Evaluación |
|---|---|
| Alcance | Solo 2 functions nuevas |
| Riesgo schedulers | ✅ NINGUNO — no se tocan |
| Riesgo write functions | ✅ NINGUNO — no se redesplegan |
| Riesgo downtime | ✅ NINGUNO — functions existentes no se afectan |
| Cold start | ✅ Solo las 2 nuevas (esperado, primera ejecución) |

**Veredicto**: ✅ RECOMENDADO. Mínimo riesgo.

### Consideración importante sobre Python functions + deploy específico

Con Firebase Python functions, el deploy de una función específica sube todo el
source (`functions_python/`) pero solo crea/actualiza la Cloud Function nombrada.
Las functions existentes NO se modifican en Cloud Functions, pero el código
fuente subyacente se actualiza en el bucket de deploy. Esto es seguro porque:

1. Las functions existentes no cambiaron en el commit `a05e660`.
2. El código source que se sube es idéntico al que ya está en producción
   excepto por los 2 archivos nuevos + main.py con +8 líneas de import.
3. Las functions existentes solo se re-ejecutarían con el nuevo código si
   se redesplegan explícitamente o si Cloud Functions recicla la instancia.

**Riesgo residual**: Si Cloud Functions recicla una instancia existente,
cargará el nuevo `main.py` que importa `admin_health`/`admin_fund_search`.
Esto NO afecta las functions existentes porque:
- Los imports adicionales son independientes.
- No modifican ningún estado global compartido.
- No añaden middleware a las functions existentes.
- Son endpoints `@on_call` separados.

## 6. Validaciones Pre-deploy Ejecutadas

| Validación | Resultado |
|---|---|
| Backend tests (admin) | 43/43 PASS ✅ |
| py_compile main.py | OK ✅ |
| py_compile endpoints_admin_console.py | OK ✅ |
| py_compile admin_auth.py | OK ✅ |
| Security scan (write keywords) | Clean ✅ |
| Security scan (secrets) | Clean ✅ |
| Git sync | HEAD = origin/master ✅ |

## 7. Comando Recomendado de Deploy

### ✅ RECOMENDADO
```bash
firebase deploy --only functions:admin_health,functions:admin_fund_search
```

### ✅ ALTERNATIVA (si el anterior falla por naming)
```bash
firebase deploy --only functions:adminHealth,functions:adminFundSearch
```
Nota: Firebase puede usar camelCase o snake_case dependiendo de la
convención del SDK. Verificar con `firebase functions:list` si disponible.

### ✅ ALTERNATIVA SEGURA (deploy all functions si target falla)
```bash
firebase deploy --only functions
```
Solo usar si el deploy específico no funciona. Riesgo aceptable porque
el código existente no cambió.

## 8. Comandos PROHIBIDOS

```bash
# ❌ PROHIBIDO — despliega TODO (hosting, firestore, storage, functions)
firebase deploy

# ❌ PROHIBIDO — toca Firestore rules
firebase deploy --only firestore

# ❌ PROHIBIDO — redesplega hosting sin necesidad
firebase deploy --only hosting

# ❌ PROHIBIDO — toca storage rules
firebase deploy --only storage

# ❌ PROHIBIDO — combinación con hosting
firebase deploy --only functions,hosting
```

## 9. Checklist Pre-deploy

| # | Check | Estado |
|---|---|---|
| 1 | HEAD sincronizado con origin/master | `a05e660` ✅ |
| 2 | No staged / no modified tracked | ✅ |
| 3 | Backend tests 43/43 PASS | ✅ |
| 4 | py_compile OK | ✅ |
| 5 | Security scan clean (no writes/secrets) | ✅ |
| 6 | admin_health es read-only | ✅ |
| 7 | admin_fund_search lee solo funds_v3 | ✅ |
| 8 | admin_fund_search devuelve campos sanitizados | ✅ |
| 9 | Ambos endpoints requieren admin auth | ✅ |
| 10 | No audit log writes | ✅ |
| 11 | Comando de deploy identificado | ✅ |
| 12 | Frontend tests 142/142 PASS | ✅ |

## 10. Checklist Post-deploy

| # | Check | Cómo verificar |
|---|---|---|
| 1 | Functions desplegadas sin error | Output del CLI |
| 2 | admin_health responde a admin | Llamar desde frontend o curl con token |
| 3 | admin_health rechaza non-admin | Verificar con usuario no admin |
| 4 | admin_fund_search lee sanitizado | Verificar campos retornados |
| 5 | No Firestore writes | Verificar en Firebase Console que no hay docs nuevos |
| 6 | Functions existentes operativas | Probar optimize_portfolio_quant o getRiskRate |
| 7 | Schedulers no alterados | Verificar en Cloud Scheduler que los timers no cambiaron |

## 11. Qué NO se Hizo

- ❌ NO deploy ejecutado.
- ❌ NO Firestore writes.
- ❌ NO firestore.rules deploy.
- ❌ NO storage deploy.
- ❌ NO hosting deploy.
- ❌ NO parser.
- ❌ NO Gemini real.
- ❌ NO CORE.
- ❌ NO código modificado (solo doc).

## 12. Próximo Bloque Recomendado

**`BDB-ADMIN-BACKEND-REQUIRE-ADMIN-DEPLOY-0`**

Ejecutar:
```bash
firebase deploy --only functions:admin_health,functions:admin_fund_search
```

Seguido de verificación post-deploy con los checks de §10.

Si el deploy específico falla (e.g., Firebase no resuelve nombres snake_case),
usar fallback:
```bash
firebase deploy --only functions
```

## 13. Decisión

**ESTADO: `BDB_ADMIN_BACKEND_REQUIRE_ADMIN_DEPLOY_PLAN_0_READY`**

El comando de deploy específico está identificado y documentado.
El deploy puede proceder en el siguiente bloque.

Fecha: 2026-05-09T07:00:00+02:00
