# BDB-CODE-HYGIENE-MOJIBAKE-0

## Objetivo

Corregir caracteres UTF-8 doblemente codificados (mojibake) en comentarios, docstrings, mensajes de log y excepciones del optimizer core.

## Archivos Auditados

| Archivo | Mojibake | Corregido |
|---|---|---|
| `functions_python/services/portfolio/optimizer_core.py` | ✅ Sí | ✅ Sí |
| `functions_python/scripts/reports/insert_report_function.py` | ✅ Sí | ⚪ No (script histórico) |
| `functions_python/scripts/reports/insert_user_report.py` | ✅ Sí | ⚪ No (script histórico) |
| `functions_python/scripts/tests/test_research.py` | ✅ Sí | ⚪ No (script histórico) |
| `functions_python/scripts/migration/check_and_import_retrocesion.py` | ✅ Sí | ⚪ No (script histórico) |
| `MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js` | ✅ Sí | ⚪ No (parser) |
| `MORNINGSTAR_PDF_PARSER/src/classify/asset_type_classifier.js` | ✅ Sí | ⚪ No (parser) |

**Nota**: Scripts históricos y parser no fueron tocados por política de bloque.

## Archivo Modificado

`functions_python/services/portfolio/optimizer_core.py`

## Patrones Encontrados y Corregidos

### Texto Español (acentos doblemente codificados)

| Mojibake | Correcto | Ocurrencias |
|---|---|---|
| `Ã³` → `ó` | exposición, Construcción, etc. | 20 |
| `Ã­` → `í` | políticas, explícitamente, etc. | 9 |
| `Ã¡` → `á` | Básica, matemáticamente, etc. | 8 |
| `Ãº` → `ú` | común | 3 |
| `Ã"` → `Ó` | CANÓNICA, CORRECCIÓN | 4 |

### Emojis doblemente codificados

| Mojibake | Correcto | Emoji | Ocurrencias |
|---|---|---|---|
| `âš ï¸` | `⚠️` | Warning | 13 |
| `âš¡` | `⚡` | High Voltage | 1 |
| `ðŸš«` | `🚫` | Prohibited | 1 |
| `ðŸ"¥` | `📥` | Inbox | 1 |

**Total: 60 ocurrencias corregidas en 44 líneas.**

## Confirmación de Cero Cambios Funcionales

- `git diff --stat`: **44 insertions, 44 deletions** (misma cantidad de líneas)
- Solo se modificaron strings en:
  - docstrings de funciones `_build_optimization_context`, `_apply_suitability_filter`, etc.
  - mensajes de `logger.info()` y `logger.warning()`
  - mensajes de `raise Exception(...)`
  - strings en dict de explainability
- **Ningún nombre de variable, función, contrato JSON o clave de respuesta fue modificado.**

## Tests Ejecutados

| Suite | Tests | Resultado |
|---|---|---|
| `test_optimizer_fallback_status_contract.py` | 2 | ✅ passed |
| `test_optimizer_payload_contract_static.py` | 38 | ✅ passed |
| `test_optimizer_p0_contracts.py` | 9 | ✅ passed |
| **Total** | **49** | **✅ 49/49 passed** |

## Riesgos Residuales

1. **Scripts históricos** (`scripts/reports/`, `scripts/migration/`) siguen con mojibake — no fueron tocados por política de bloque.
2. **Parser** (`MORNINGSTAR_PDF_PARSER/`) tiene mojibake en regex de matching (e.g., `TRÉSORERIE`, `JAPÓN`) que debe tratarse con cuidado aparte, ya que algunos patrones pueden ser intencionales para matchear PDFs con encoding incorrecto.

## Confirmaciones

| Verificación | Estado |
|---|---|
| Firestore writes | **0** |
| Deploy | **NO** |
| Hosting | **NO** |
| firestore.rules | **NO tocado** |
| storage.rules | **NO tocado** |
| CORE (lógica) | **NO tocado** |
| optimizer_core.py (lógica) | **NO tocada** (solo texto) |
| suitability_engine.py | **NO tocado** |
| constraints_builder_v1.py | **NO tocado** |

---

**Fecha**: 2026-05-12  
**Bloque**: `BDB-CODE-HYGIENE-MOJIBAKE-0`  
**Autor**: Agente automático
