# BDB-CORS-HARDENING-DEPLOY-0

## Commit Desplegado

| Campo | Valor |
|---|---|
| **Commit** | `11656a8 SECURITY: harden admin endpoint CORS` |
| **Branch** | `master` |
| **Fecha deploy** | 2026-05-12 06:24 CEST |
| **Proyecto Firebase** | `bdb-fondos` |

## Functions Desplegadas

Las 7 funciones exportadas desde `functions_python/api/endpoints_admin.py`:

| Function | Región | Resultado |
|---|---|---|
| `force_weekly_research` | europe-west1 | ✅ Successful update |
| `generate_analysis_report` | europe-west1 | ✅ Successful update |
| `restore_historico` | europe-west1 | ✅ Successful update |
| `insertMonthlyReport` | europe-west1 | ✅ Successful update |
| `getRiskRate` | europe-west1 | ✅ Successful update |
| `updateFundHistory` | europe-west1 | ✅ Successful update |
| `refresh_daily_metrics` | europe-west1 | ✅ Successful update |

## Comando Exacto Usado

```bash
firebase deploy --only functions:force_weekly_research,functions:generate_analysis_report,functions:restore_historico,functions:insertMonthlyReport,functions:getRiskRate,functions:updateFundHistory,functions:refresh_daily_metrics
```

**NO se desplegó**:
- ❌ Hosting
- ❌ Firestore rules
- ❌ Storage rules
- ❌ Otras functions no afectadas

## Tests Ejecutados Pre-Deploy

| Suite | Tests | Resultado |
|---|---|---|
| `test_admin_cors_hardening.py` | 24 | ✅ 24/24 passed |
| `test_admin_auth.py` | 29 | ✅ 29/29 passed |
| **Total** | **53** | **✅ 53/53 passed** |

## Cambio Desplegado

El hardening CORS reemplaza `cors_origins="*"` y `Access-Control-Allow-Origin: "*"` con:

### `cors_config` (CorsOptions para Firebase SDK)
```python
cors_origins=[
    "http://localhost:5173",
    "http://localhost:3000",
    r"https://.*\.web\.app",
    r"https://.*\.firebaseapp\.com"
]
```

### `get_cors_headers(request)` (headers manuales)
- Valida el `Origin` del request contra allowlist explícita.
- Solo refleja el origen si es permitido.
- Omite `Access-Control-Allow-Origin` si el origen no es permitido.
- Nunca devuelve `*`.

### Orígenes permitidos
- `https://bdb-fondos.web.app`
- `https://bdb-fondos.firebaseapp.com`
- `http://localhost:5173`
- `http://localhost:3000`
- Cualquier `*.web.app` / `*.firebaseapp.com` (regex)

## Confirmaciones

| Verificación | Estado |
|---|---|
| Hosting deploy | ❌ NO |
| Firestore rules deploy | ❌ NO |
| Storage rules deploy | ❌ NO |
| Firestore writes | **0** |
| BDB-FONDOS-CORE tocado | **NO** |
| optimizer_core.py tocado | **NO** |
| suitability_engine.py tocado | **NO** |
| Auth admin cambiado | **NO** |
| Lógica de negocio cambiada | **NO** |

## URLs de Producción Post-Deploy

- `force_weekly_research`: `https://force-weekly-research-45ma5opkra-ew.a.run.app`
- `refresh_daily_metrics`: `https://refresh-daily-metrics-45ma5opkra-ew.a.run.app`
- Las funciones `on_call` son invocadas vía SDK Firebase (no tienen URL pública directa).

---

**Fecha**: 2026-05-12  
**Bloque**: `BDB-CORS-HARDENING-DEPLOY-0`  
**Autor**: Agente automático
