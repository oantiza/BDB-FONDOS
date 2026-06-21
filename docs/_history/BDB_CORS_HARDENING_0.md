# BDB-CORS-HARDENING-0

## Problema Detectado

El hallazgo H-02 de la auditoría delta (`BDB_AUDIT_2026_05_11_DELTA_VERIFICATION_0.md`) identificó
que `functions_python/api/endpoints_admin.py` utilizaba CORS con origen wildcard (`*`) en dos puntos:

1. **Línea 13-14**: `cors_config = options.CorsOptions(cors_origins="*", ...)`
2. **Línea 20**: `"Access-Control-Allow-Origin": "*"` en `get_cors_headers()`

El riesgo práctico era bajo porque todos los endpoints admin verifican Firebase Auth token + email admin,
pero el wildcard CORS es contrario a mejores prácticas de seguridad y debía endurecerse.

## Alcance Exacto

| Aspecto | Detalle |
|---|---|
| **Archivo modificado** | `functions_python/api/endpoints_admin.py` |
| **Archivo nuevo (test)** | `functions_python/tests/test_admin_cors_hardening.py` |
| **Archivo nuevo (doc)** | `docs/BDB_CORS_HARDENING_0.md` |
| **Archivos NO tocados** | `optimizer_core.py`, `suitability_engine.py`, `firestore.rules`, `storage.rules`, `endpoints_admin_console.py`, `endpoints_portfolio.py`, cualquier otro |
| **Firestore writes** | 0 |
| **Deploy** | NO |

## Orígenes Permitidos

### Lista explícita (`ALLOWED_ORIGINS`)
```python
ALLOWED_ORIGINS = [
    "https://bdb-fondos.web.app",
    "https://bdb-fondos.firebaseapp.com",
    "http://localhost:5173",
    "http://localhost:3000",
]
```

### Patrón regex (`cors_config` para Firebase Functions SDK)
```python
cors_origins=[
    "http://localhost:5173",
    "http://localhost:3000",
    r"https://.*\.web\.app",
    r"https://.*\.firebaseapp\.com"
]
```

Este patrón es idéntico al ya utilizado en `endpoints_xray_comparador.py` (líneas 16-18),
que es el patrón de referencia del proyecto.

### Orígenes localhost

Se incluyen `localhost:5173` y `localhost:3000` porque:
- `:5173` es el puerto por defecto de Vite (usado en desarrollo local del frontend).
- `:3000` es el puerto por defecto de Next.js / create-react-app (alternativa habitual).
- Ambos estaban presentes en el patrón de referencia de `endpoints_xray_comparador.py`.

## Decisiones Tomadas

1. **`cors_config` (CorsOptions)**: Se reemplazó `cors_origins="*"` por lista con regex,
   idéntica al patrón existente en `endpoints_xray_comparador.py`. Esto afecta a todos los
   decoradores `@https_fn.on_request` y `@https_fn.on_call` que usen `cors=cors_config`:
   - `force_weekly_research` (on_request)
   - `insertMonthlyReport` (on_call)
   - `getRiskRate` (on_call)
   - `updateFundHistory` (on_call)

2. **`get_cors_headers(request=None)`**: Se convirtió de función que devolvía wildcard
   a función que:
   - Acepta opcionalmente el objeto `request`.
   - Lee el header `Origin` del request.
   - Valida contra `ALLOWED_ORIGINS` (exacto) + regex (`*.web.app`, `*.firebaseapp.com`).
   - Solo refleja el origen en `Access-Control-Allow-Origin` si es permitido.
   - Omite el header por completo si el origen no es permitido.

3. **`_is_origin_allowed(origin)`**: Función auxiliar reutilizable para la validación.

4. **`Authorization` en `Access-Control-Allow-Headers`**: Se añadió `Authorization` al
   header `Access-Control-Allow-Headers` (previamente solo incluía `Content-Type`),
   ya que los endpoints admin requieren Bearer token.

5. **No se tocó la lógica de auth**: Los verificadores de token y email admin
   (`auth.verify_id_token`, check `email == "oantiza@gmail.com"`) permanecen intactos.

6. **No se tocó la lógica de negocio**: Payloads, rutas, respuestas y lógica admin
   permanecen idénticos.

## Tests Ejecutados

### Test suite nueva: `test_admin_cors_hardening.py`
| Clase | Tests | Resultado |
|---|---|---|
| `TestIsOriginAllowed` | 12 | ✅ 12/12 passed |
| `TestGetCorsHeaders` | 7 | ✅ 7/7 passed |
| `TestAllowedOriginsList` | 3 | ✅ 3/3 passed |
| `TestCorsConfig` | 1 | ✅ 1/1 passed |
| `TestNoWildcardInSource` | 1 | ✅ 1/1 passed |
| **Total** | **24** | **✅ 24/24 passed** |

### Regresión: `test_admin_auth.py`
| Total | Resultado |
|---|---|
| 29 | ✅ 29/29 passed |

### Invariantes verificados por tests:
- ✅ Origen permitido recibe `Access-Control-Allow-Origin` con el origen reflejado.
- ✅ Origen no permitido NO recibe `Access-Control-Allow-Origin`.
- ✅ El wildcard `*` nunca aparece en la respuesta.
- ✅ El wildcard `*` no aparece en el source code como `cors_origins`.
- ✅ Auth admin no cambia (29 tests de regresión pasan).

## Confirmaciones

- ✅ **Firestore writes**: 0
- ✅ **Deploy**: NO
- ✅ **Push del bloque CORS**: NO (pendiente instrucción explícita)
- ✅ **Lógica financiera**: NO tocada
- ✅ **optimizer_core.py**: NO tocado
- ✅ **suitability_engine.py**: NO tocado
- ✅ **firestore.rules**: NO tocado
- ✅ **storage.rules**: NO tocado
- ✅ **Parser**: NO tocado

## Riesgos Residuales

1. **`endpoints_admin_console.py` y `endpoints_portfolio.py`** también tienen `cors_origins="*"`.
   Están fuera de alcance de este bloque pero deberían endurecerse en un bloque futuro.
   La auditoría delta indicaba que no tenían CORS wildcard, pero la inspección del código
   confirma que sí lo tienen (L25 de `endpoints_admin_console.py`, L23 de `endpoints_portfolio.py`).

2. **Regex amplio**: El patrón `https://.*\.web\.app` permite cualquier subdominio de `web.app`.
   Esto es consistente con el patrón de referencia del proyecto. Para máxima restricción,
   se podría cambiar a `https://bdb-fondos\.web\.app` en un bloque futuro.

3. **Sin deploy**: Los cambios están en commit local. El CORS wildcard sigue activo en producción
   hasta que se despliegue. El riesgo práctico es bajo por la protección de auth existente.

---

**Fecha**: 2026-05-12  
**Bloque**: `BDB-CORS-HARDENING-0`  
**Autor**: Agente automático  
**Commit**: pendiente (local, sin push)
