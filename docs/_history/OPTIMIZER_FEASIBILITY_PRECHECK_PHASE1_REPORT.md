# Fase 1: Pre-Check de Factibilidad — Reporte de Implementación

**Fecha:** 2026-05-05  
**Commit previo:** `9f852c3`  
**Estado:** Implementado — pendiente commit/push.

---

## A. Resumen Ejecutivo

Se implementó una capa de validación determinista (Fase 1) que detecta 6 tipos de infeasibilidad aritmética **antes** de invocar al solver PyPortfolioOpt/CVXPY. La capa es pura (sin I/O, sin Firebase), testeable (20 tests propios) y no altera la política de asset allocation ni el fallback chain existente.

Cuando se detecta un problema imposible, el optimizador devuelve `status: "infeasible"` con un mensaje claro en español para banca privada, en lugar de dejar que CVXPY devuelva un error opaco.

---

## B. Archivos Nuevos y Modificados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `services/portfolio/feasibility_precheck.py` | **NUEVO** | Módulo puro de pre-check con 6 validaciones BLOCK |
| `tests/test_feasibility_precheck.py` | **NUEVO** | 20 tests unitarios con datos sintéticos |
| `services/portfolio/optimizer_core.py` | **MODIFICADO** | Import + FASE 5.5b precheck (38 líneas añadidas) |

---

## C. Validaciones Implementadas

| # | Código | Tipo | Descripción |
|---|--------|------|-------------|
| 1 | `BLOCK_EMPTY_UNIVERSE` | BLOCK | 0 activos tras filtros |
| 2 | `BLOCK_UNIVERSE_TOO_SMALL` | BLOCK | `n * max_weight < 1.0` |
| 3 | `BLOCK_BUCKET_MINS_EXCEED_100` | BLOCK | `sum(bucket_mins) > 100%` |
| 4 | `BLOCK_BUCKET_MAXS_BELOW_100` | BLOCK | `sum(bucket_maxs) < 100%` (solo si todos tienen max definido) |
| 5 | `BLOCK_FIXED_WEIGHTS_EXCEED_100` | BLOCK | Posiciones bloqueadas > 100% |
| 6 | `BLOCK_BUCKET_NOT_REPRESENTABLE` | BLOCK | Bucket con mínimo > 0 pero sin exposición en ningún activo |

---

## D. Contrato Devuelto

### Pre-check (internal):
```json
{
  "is_feasible": true|false,
  "blocks": [{"code": "...", "severity": "block", "message": "...", "details": {...}}],
  "warnings": [],
  "info": []
}
```

### Respuesta del optimizador cuando hay BLOCK:
```json
{
  "api_version": "optimizer_v4",
  "status": "infeasible",
  "message": "Mensaje en español para asesor",
  "feasibility_precheck": { "is_feasible": false, "blocks": [...] },
  "weights": {},
  "metrics": {},
  "frontier_points": [...],
  "explainability": {
    "precheck_blocked": true,
    "blocking_codes": ["BLOCK_UNIVERSE_TOO_SMALL"]
  }
}
```

---

## E. Mensajes de Usuario (ES)

| Código | Mensaje |
|--------|---------|
| `BLOCK_EMPTY_UNIVERSE` | "No quedan fondos válidos tras aplicar los filtros de idoneidad e historial." |
| `BLOCK_UNIVERSE_TOO_SMALL` | "El universo seleccionado (N fondos) no es suficiente para respetar el peso máximo por activo (X%). Se necesitan al menos Y fondos." |
| `BLOCK_BUCKET_MINS_EXCEED_100` | "Las restricciones mínimas por clase de activo suman X%, superando el 100% del capital. Revise los límites del perfil." |
| `BLOCK_BUCKET_MAXS_BELOW_100` | "Los máximos permitidos por clase de activo suman solo X%, impidiendo asignar todo el capital." |
| `BLOCK_FIXED_WEIGHTS_EXCEED_100` | "Las posiciones bloqueadas consumen el X% del capital. No queda presupuesto para optimizar." |
| `BLOCK_BUCKET_NOT_REPRESENTABLE` | "Existe un mínimo exigido (X%) para [Renta Variable], pero ningún fondo seleccionado aporta exposición a [Renta Variable]." |

---

## F. Resultado de Tests

| Suite | Tests | Resultado |
|-------|-------|-----------|
| `test_feasibility_precheck.py` | 20 | ✅ PASSED |
| `test_optimizer_core.py` | 2 | ✅ PASSED |
| `test_optimizer_invariants.py` | 8 | ✅ PASSED |
| `test_bucket_constraints_dedup.py` | 9 | ✅ PASSED |
| **Total** | **39** | **39/39 ✅** |

Tiempo: 2.21s

---

## G. Riesgos Pendientes

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Frontend no maneja `status: "infeasible"` aún | Media | El frontend actual trata cualquier status ≠ "optimal"/"fallback" como error genérico; el mensaje es legible |
| Falso positivo por mixtos con exposure parcial | Baja | Se usa exposure continua (`eq_vec`), no binaria |
| Precheck pasa pero solver falla por combinación de constraints | Media | El precheck solo cubre contradicciones aritméticas puras; constraints cruzadas las maneja el fallback chain |

---

## H. Qué Queda para Fase 2

1. **WARN-1**: Budget libre insuficiente para diversificación.
2. **WARN-2**: Target vol probablemente inalcanzable (comparar con rango de vols del universo).
3. **WARN-3**: Margen de optimización estrecho (sum_mins > 0.95).
4. **WARN-4**: Locked weights incompatibles con bucket bounds.
5. **Frontend**: Manejar `status: "infeasible"` con modal/toast específico.

---

## I. Reversión

Para revertir:
1. Eliminar `services/portfolio/feasibility_precheck.py`
2. Eliminar `tests/test_feasibility_precheck.py`
3. En `optimizer_core.py`:
   - Eliminar `from services.portfolio.feasibility_precheck import run_feasibility_precheck`
   - Eliminar el bloque FASE 5.5b (38 líneas entre "Setup Constants" y "Main Base Solver Instantiation")

---

## J. Confirmación

| Regla | Cumplida |
|-------|----------|
| NO frontend modificado | ✅ |
| NO firestore.rules tocado | ✅ |
| NO credenciales tocadas | ✅ |
| NO deploy realizado | ✅ |
| NO push realizado | ✅ |
| NO perfiles 1-10 cambiados | ✅ |
| NO política de asset allocation alterada | ✅ |
| NO objective/fallback chain cambiado | ✅ |
| Cambios mínimos (1 nuevo módulo + 38 líneas en optimizer) | ✅ |
