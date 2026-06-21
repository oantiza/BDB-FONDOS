# BDB-CORS-HARDENING-1-PORTFOLIO-0

## Problema Detectado

`functions_python/api/endpoints_portfolio.py` usaba `cors_origins="*"` (wildcard), permitiendo que cualquier dominio realizara peticiones cross-origin a los endpoints de optimización de carteras.

## Prioridad

`endpoints_portfolio.py` fue priorizado sobre `endpoints_admin_console.py` porque expone los endpoints principales para usuarios autenticados normales (no solo administradores), incluyendo el motor de optimización cuantitativo.

## Alcance

### Archivo Modificado

| Archivo | Cambio |
|---|---|
| `functions_python/api/endpoints_portfolio.py` | `cors_origins="*"` → allowlist explícita |
| `functions_python/tests/test_portfolio_cors_hardening.py` | **[NEW]** 6 tests de validación CORS |

### Functions Afectadas

Todas comparten el mismo `cors_config` en el módulo:

| Function | Tipo | Región |
|---|---|---|
| `optimize_portfolio_quant` | `on_call` | europe-west1 |
| `backtest_portfolio` | `on_call` | europe-west1 |
| `backtest_portfolio_multi` | `on_call` | europe-west1 |
| `getEfficientFrontier` | `on_call` | europe-west1 |
| `analyze_portfolio_endpoint` | `on_call` | europe-west1 |

## Patrón CORS Aplicado

Idéntico al validado en `endpoints_admin.py` (`BDB-CORS-HARDENING-0`) y `endpoints_xray_comparador.py`:

```python
cors_config = options.CorsOptions(
    cors_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        r"https://.*\.web\.app",
        r"https://.*\.firebaseapp\.com",
    ],
    cors_methods=["GET", "POST", "OPTIONS"],
)
```

### Orígenes Permitidos

| Origen | Propósito |
|---|---|
| `http://localhost:5173` | Desarrollo local (Vite) |
| `http://localhost:3000` | Desarrollo local (alternativo) |
| `https://.*\.web\.app` | Producción Firebase Hosting |
| `https://.*\.firebaseapp\.com` | Producción Firebase Hosting (legacy) |

## Tests Ejecutados

| Suite | Tests | Resultado |
|---|---|---|
| `test_portfolio_cors_hardening.py` | 6 | ✅ 6/6 passed |
| `test_admin_cors_hardening.py` | 24 | ✅ 24/24 passed |
| `test_admin_auth.py` | 29 | ✅ 29/29 passed |
| **Total** | **59** | **✅ 59/59 passed** |

### Tests de Portfolio CORS (6)

1. `test_cors_config_not_wildcard_string` — cors_origins ≠ `"*"`
2. `test_cors_config_is_list` — cors_origins es lista
3. `test_cors_config_has_production_origins` — incluye `*.web.app` y `*.firebaseapp.com`
4. `test_cors_config_has_dev_origins` — incluye `localhost:5173` y `localhost:3000`
5. `test_cors_config_no_wildcard_in_list` — ningún elemento es `"*"`
6. `test_no_wildcard_cors_in_source` — source code no contiene `cors_origins="*"`

## Riesgos Residuales

| Riesgo | Estado |
|---|---|
| `endpoints_admin_console.py` sigue con `cors_origins="*"` | ⚠️ Pendiente — bloque `BDB-CORS-HARDENING-2-ADMIN-CONSOLE-0` |
| Deploy no realizado | ⚠️ Pendiente — requiere instrucción explícita |

## Estado CORS Global Post-Bloque

| Módulo | Estado |
|---|---|
| `endpoints_admin.py` | ✅ Hardened (bloque 0) |
| `endpoints_xray_comparador.py` | ✅ Hardened (original) |
| `endpoints_portfolio.py` | ✅ Hardened (este bloque) |
| `endpoints_admin_console.py` | ❌ Wildcard — pendiente |

## Confirmaciones

| Verificación | Estado |
|---|---|
| Firestore writes | **0** |
| Deploy | **NO** |
| Hosting | **NO** |
| firestore.rules | **NO tocado** |
| storage.rules | **NO tocado** |
| CORE (optimizer_core.py) | **NO tocado** |
| constraints_builder_v1.py | **NO tocado** |
| suitability_engine.py | **NO tocado** |
| Lógica financiera | **NO modificada** |
| Auth | **NO modificado** |
| Payloads | **NO modificados** |

## Commit

| Campo | Valor |
|---|---|
| **Hash** | `2845e0f` |
| **Mensaje** | `SECURITY: harden portfolio endpoint CORS` |
| **Archivos** | `endpoints_portfolio.py`, `test_portfolio_cors_hardening.py` |

---

**Fecha**: 2026-05-12  
**Bloque**: `BDB-CORS-HARDENING-1-PORTFOLIO-0`  
**Predecesor**: `BDB-CORS-HARDENING-0`  
**Sucesor pendiente**: `BDB-CORS-HARDENING-2-ADMIN-CONSOLE-0`  
**Autor**: Agente automático
