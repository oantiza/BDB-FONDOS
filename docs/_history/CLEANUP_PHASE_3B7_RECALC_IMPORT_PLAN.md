# FASE 3B.7 — Plan de Resolución del Cross-Import recalc_metrics_single

**Fecha:** 2026-05-04
**Estado:** PLAN — Ningún cambio ejecutado.
**Referencia:** `docs/CLEANUP_PHASE_3B6_FP_ROOT_DUPLICATES_PLAN.md`

---

## 1. Diagnóstico del Import Actual

### El problema

En `reports/recalc_metrics_batch.py` (línea 18):
```python
from recalc_metrics_single import recalculate_single
```

Este es un **bare import** (sin prefijo de paquete ni import relativo). Python lo resuelve buscando en:

1. El directorio del script actual (`reports/`)
2. Los directorios en `sys.path`
3. Paths añadidos manualmente

### Cómo se ejecuta

El header del batch dice:
```
RUN: python -m scripts.reports.recalc_metrics_batch
```

Cuando se ejecuta con `python -m` desde `functions_python/`:
- Python añade CWD (`functions_python/`) a `sys.path`
- El script añade `os.path.dirname(dirname(dirname(__file__)))` = `functions_python/`
- **No** añade `scripts/` a `sys.path`

### Resolución del import

Dado que `reports/` **NO** tiene `__init__.py`, no es un paquete formal. Sin embargo:
- **Si se ejecuta con `python -m`** desde `functions_python/`: el import bare busca en `functions_python/` → NO encuentra `recalc_metrics_single.py` ahí, luego busca en el directorio del script (`reports/`) → **SÍ encuentra** `reports/recalc_metrics_single.py`.
- **Si se ejecuta con `python scripts/reports/recalc_metrics_batch.py`** desde `functions_python/scripts/`: Python añade `reports/` a `sys.path[0]` → **SÍ encuentra** `reports/recalc_metrics_single.py`.

> [!IMPORTANT]
> **Conclusión:** En ambos modos de ejecución, el bare import `from recalc_metrics_single import recalculate_single` resuelve a `reports/recalc_metrics_single.py`, **NO** a la copia raíz. Esto significa que la copia raíz es **prescindible** y su eliminación **NO rompe** el import.

## 2. Comparación: Raíz vs reports/

| Aspecto | Raíz (156 líneas) | reports/ (166 líneas) |
|---|---|---|
| Header metadata | ❌ Sin header | ✅ 10 líneas BDB-FONDOS |
| `import firebase_admin` | ✅ Línea 1 | ✅ Línea 10 (dentro del header) |
| `sys.path.append` | 2 niveles (`dirname(dirname)`) | 3 niveles (`dirname³`) |
| `def recalculate_single(isin)` | ✅ Línea 29 | ✅ Línea 38 |
| `def initialize()` | ✅ Línea 14 | ✅ Línea 23 |
| Cuerpo funcional | **100% idéntico** | **100% idéntico** |
| `if __name__` | ✅ pass | ✅ pass |

**Veredicto:** Las dos versiones son funcionalmente idénticas. La versión `reports/` tiene paths más robustos (3 niveles) y el header estándar BDB-FONDOS.

## 3. Test_research.py (pendiente de FASE 3B.6)

| Aspecto | Raíz (87 líneas) | tests/ (97 líneas) |
|---|---|---|
| Header | ❌ Sin header | ✅ 10 líneas BDB-FONDOS |
| `sys.path` | 2 niveles | 3 niveles |
| `.env` path | `dirname(dirname(__file__))` | `dirname(dirname(dirname(__file__)))` |
| Emojis | Encoding legacy | Encoding limpio |
| Cuerpo funcional | **Equivalente** (solo encoding) | **Equivalente** |

**Veredicto:** Mismo patrón que los otros header-only. La versión `tests/` es superior. Seguro de eliminar la raíz.

## 4. Opciones de Resolución

### Opción A: Eliminar raíz directamente (RECOMENDADA) ⭐

**Acción:** Eliminar `recalc_metrics_single.py` y `test_research.py` de raíz sin tocar nada más.

**Justificación:** El análisis de resolución de imports demuestra que el bare import en `recalc_metrics_batch.py` resuelve a `reports/recalc_metrics_single.py` en todos los escenarios de ejecución documentados. La copia raíz nunca se usa.

**Riesgo:** MÍNIMO. Si hubiera un escenario de ejecución no documentado donde `scripts/` se añadiera a `sys.path`, Python buscaría primero en el directorio del script (`reports/`) y encontraría la versión correcta igualmente.

**Archivos a tocar:** Solo eliminar 2 archivos. 0 ediciones de código.

### Opción B: Convertir raíz en wrapper

**Acción:** Reemplazar el contenido de raíz por:
```python
# Backward-compat wrapper
from reports.recalc_metrics_single import recalculate_single
```

**Riesgo:** BAJO pero innecesario — añade complejidad sin beneficio.

### Opción C: Cambiar import a relativo

**Acción:** Cambiar línea 18 de `recalc_metrics_batch.py`:
```python
from .recalc_metrics_single import recalculate_single
```

**Riesgo:** MEDIO — los imports relativos requieren que el directorio sea un paquete con `__init__.py`, lo cual no existe. Requeriría crear `__init__.py` en `reports/`. Cambio más invasivo.

---

## 5. Recomendación Final

**Opción A: Eliminación directa** de ambos archivos raíz (`recalc_metrics_single.py` y `test_research.py`) sin ninguna edición de código.

La resolución de imports de Python garantiza que el bare import funciona correctamente sin la copia raíz en todos los escenarios de ejecución documentados.

## 6. Archivos Afectados

| Acción | Archivo |
|---|---|
| ELIMINAR | `functions_python/scripts/recalc_metrics_single.py` |
| ELIMINAR | `functions_python/scripts/test_research.py` |
| NO TOCAR | `functions_python/scripts/reports/recalc_metrics_single.py` |
| NO TOCAR | `functions_python/scripts/reports/recalc_metrics_batch.py` |
| NO TOCAR | `functions_python/scripts/tests/test_research.py` |
| NO TOCAR | `functions_python/scripts/script_manifest.json` |

## 7. Prompt Recomendado para Ejecución

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Ejecutar FASE 3B.7 — eliminar recalc_metrics_single.py y test_research.py de raíz.

REGLAS ESTRICTAS:
- Ejecuta SOLO FASE 3B.7.
- Sigue docs/CLEANUP_PHASE_3B7_RECALC_IMPORT_PLAN.md.
- NO edites reports/recalc_metrics_batch.py.
- NO edites reports/recalc_metrics_single.py.
- NO edites tests/test_research.py.
- NO toques script_manifest.json.
- NO ejecutes scripts.
- NO toques credenciales.
- NO toques frontend/src/.
- NO toques functions_python/api/ ni services/.

OBJETIVO:
1. Eliminar functions_python/scripts/recalc_metrics_single.py.
2. Eliminar functions_python/scripts/test_research.py.
3. Verificar reports/recalc_metrics_single.py presente.
4. Verificar reports/recalc_metrics_batch.py presente.
5. Verificar tests/test_research.py presente.
6. Verificar manifest 34 ACTIVE, 0 huérfanas.
7. Verificar los 9 únicos restantes en raíz siguen presentes.
8. git status.

ENTREGABLE:
Crear: docs/CLEANUP_PHASE_3B7_RECALC_IMPORT_RESOLUTION_REPORT.md
```

---

> [!IMPORTANT]
> **Confirmación:** Ningún archivo ha sido movido, borrado, ejecutado ni modificado. El repositorio permanece en su estado post-FASE 3B.6.
