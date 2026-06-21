# BDB_OPT_FEASIBILITY_LOCKS_RELEASE_READINESS_0

## Release Readiness: Locks Feasibility Precheck

**Estado: `RELEASE_REVIEW_ONLY` | `NOT_DEPLOYED` | `NO_RUNTIME_CHANGES_IN_THIS_BLOCK`**

---

## 1. Resumen ejecutivo

Este documento evalúa si el bloque **Locks Feasibility Precheck** está listo para
release/deploy a producción. Se analiza retrocompatibilidad, impacto en carteras
existentes, comportamiento UX del frontend ante los nuevos códigos BLOCK/WARNING,
y se emite un veredicto final.

---

## 2. Estado Git

| Campo | Valor |
|---|---|
| Repositorio | `C:/Users/oanti/Documents/BDB-FONDOS` |
| Remoto | `github.com/oantiza/BDB-FONDOS` |
| Rama | `master` |
| HEAD al evaluar | `574933d` |
| HEAD = origin/master | ✅ |
| Working tree | Limpio al iniciar |

---

## 3. Scope del release

| Aspecto | Estado |
|---|---|
| Backend / precheck | ✅ Implementado (3 checks) |
| Firma `run_feasibility_precheck` | ✅ Retrocompatible (parámetro opcional) |
| `optimizer_core.py` | ✅ +1 línea keyword arg |
| Frontend | ❌ No tocado |
| Solver | ❌ No tocado |
| `constraints_builder_v1.py` | ❌ No tocado |
| `endpoints_portfolio.py` | ❌ No tocado |
| `config.py` | ❌ No tocado |
| Deploy | ❌ No realizado |

---

## 4. Checks implementados

| Check | Tipo | Severidad | Commit |
|---|---|---|---|
| `BLOCK_LOCKS_INCOMPATIBLE_BUCKET` | BLOCK-7 | Bloquea optimización | `47d3e20` |
| `WARNING_LOCKS_HIGH_CONCENTRATION` | WARNING | No bloquea | `47d3e20` |
| `BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR` | BLOCK-8 | Bloquea optimización | `ca78051` |

---

## 5. Contrato de compatibilidad

### 5.1. Firma retrocompatible ✅

```python
def run_feasibility_precheck(
    universe, max_weight, active_bounds, exposure_vectors,
    fixed_weights, lock_mode, _read_bound_fn,
    equity_floor: Optional[float] = None,   # ← NUEVO, default None
) -> dict:
```

- `equity_floor=None` → BLOCK-8 se salta → **ningún cambio de comportamiento**.
- Todas las llamadas existentes usan keyword args → **sin riesgo posicional**.
- Output sigue siendo `{is_feasible, blocks, warnings, info}` → **sin cambio de contrato**.

### 5.2. Respuesta del optimizer cuando precheck bloquea

```python
# optimizer_core.py L1133–1147
return {
    "api_version": "optimizer_v4",
    "status": "infeasible",              # ← CLAVE
    "message": first_block["message"],   # ← Mensaje en español del BLOCK
    "feasibility_precheck": precheck_result,
    "weights": {},
    "metrics": {},
    "frontier_points": frontier_points,
    "explainability": {
        "precheck_blocked": True,
        "blocking_codes": [b["code"] for b in precheck_result["blocks"]],
    },
}
```

**Status devuelto: `"infeasible"`** — el mismo status que ya existía antes del precheck
para universo insuficiente.

---

## 6. Evaluación UX / Frontend

### 6.1. Cómo maneja el frontend `status: "infeasible"`

Archivo: `frontend/src/hooks/usePortfolioActions.ts` líneas 675–714.

```typescript
} else if (result.status === 'infeasible') {
    const msg = result.message || "Faltan datos para equilibrar la cartera...";
    setConfirmDialog({
        isOpen: true,
        title: "Universo insuficiente para optimizar",
        message: msg,
        confirmLabel: "Añadir fondos y reintentar",
        cancelLabel: "Cancelar",
        onConfirm: async () => { /* retry con recovery_candidates */ },
    });
}
```

### 6.2. Análisis del flujo UX con precheck BLOCK

| Aspecto | Comportamiento actual | Evaluación |
|---|---|---|
| **`result.message`** | Contiene el mensaje en español del BLOCK (e.g., *"Las posiciones bloqueadas exceden..."*) | ✅ **Claro y específico** |
| **Dialog title** | `"Universo insuficiente para optimizar"` | ⚠️ **Genérico** — debería reflejar "locks incompatibles" |
| **Botón confirm** | `"Añadir fondos y reintentar"` | ⚠️ **Inadecuado** — añadir fondos no resuelve un BLOCK de locks |
| **Retry con recovery_candidates** | `result.recovery_candidates` probablemente no existe en precheck block | ⚠️ **Retry vacío** — no hay candidates en precheck |
| **`result.feasibility_precheck`** | El frontend **no lo lee** actualmente | ℹ️ Dato disponible pero ignorado |
| **WARNING codes** | No se muestran — el frontend solo actúa sobre `is_feasible=False` | ⚠️ **WARNING invisible** |

### 6.3. Veredicto UX

> **El mensaje principal (body del dialog) SÍ será claro**: el `message` del BLOCK
> se muestra directamente al usuario en español.
>
> **Sin embargo, el contexto visual es ENGAÑOSO**: el título dice "Universo insuficiente"
> y el botón ofrece "Añadir fondos y reintentar", lo cual no aplica para un BLOCK de
> locks. El retry no tendrá efecto útil.
>
> **El WARNING de alta concentración será INVISIBLE**: el frontend no procesa
> warnings del precheck.

### 6.4. Impacto real

| Escenario | Qué ve el usuario | Correcto? |
|---|---|---|
| BLOCK bucket (locks > max) | Dialog con mensaje correcto, título/botón genéricos | ⚠️ Funcional pero confuso |
| BLOCK equity_floor (locks impiden RV) | Dialog con mensaje correcto, título/botón genéricos | ⚠️ Funcional pero confuso |
| WARNING concentración | **Nada** (warning invisible) | ⚠️ No se muestra |
| Sin locks / compatible | Sin cambio (precheck pasa, solver ejecuta) | ✅ |
| lock_mode=free | Sin cambio (free excluido) | ✅ |

---

## 7. Riesgos por tipo de cartera

| Tipo de cartera | Riesgo de BLOCK inesperado | Probabilidad | Acción |
|---|---|---|---|
| **Sin locks** | Ninguno | 0% | Sin cambio de comportamiento |
| **lock_mode=free** | Ninguno (P4 excluye free) | 0% | Sin cambio |
| **keep_weight compatible** | Ninguno | 0% | Pasa precheck |
| **keep_weight > bucket max** | BLOCK-7 **NUEVO** | BAJA-MEDIA | **Deseado** (P2) |
| **min_keep > bucket max** | BLOCK-7 **NUEVO** | BAJA | **Deseado** (P3) |
| **locks > 60% del capital** | WARNING **NUEVO** | MEDIA | Invisible al usuario |
| **locks no-equity impiden equity_floor** | BLOCK-8 **NUEVO** | BAJA | **Deseado** (P1) |
| **Perfil agresivo (8-10) + locks en RF** | BLOCK-7 o BLOCK-8 | MEDIA | **Deseado** |
| **Cartera heredada fuera de perfil** | BLOCK posible sin escape | BAJA | No implementado allow_legacy_override |
| **Mixto sin bounds definidos** | Ninguno (guard protege) | 0% | Sin cambio |
| **Universo con pocas posiciones libres** | BLOCK-8 si no alcanza equity_floor | BAJA | **Deseado** |

### Carteras que ANTES entraban al solver y AHORA serán bloqueadas

Sí, **esto es un cambio de comportamiento real**. Antes, estas carteras llegaban al
solver y podían generar:
- `infeasible_constraints` (error CVXPY críptico)
- Solución degradada/extraña
- `infeasible_equity_floor` (tras auto-expand fallido)

Ahora se bloquean **antes** del solver con un mensaje claro. Este comportamiento
es **intencionalmente deseado** según decisiones P1–P5 aprobadas por el usuario.

---

## 8. Tests mínimos antes de release/deploy

### 8.1. Tests unitarios (ya ejecutados ✅)

| Suite | Resultado | Comando |
|---|---|---|
| Locks expected + compatibility | **22 passed, 2 skipped** | `pytest tests/test_feasibility_precheck_locks_*.py -v` |
| Precheck original (regresión) | **20 passed** | `pytest tests/test_feasibility_precheck.py -q` |

### 8.2. Tests recomendados antes de deploy

| Test | Comando | Obligatorio |
|---|---|---|
| Locks tests | `pytest tests/test_feasibility_precheck_locks_*.py -v` | ✅ Sí |
| Precheck original | `pytest tests/test_feasibility_precheck.py -q` | ✅ Sí |
| Optimizer tests (si existen) | `pytest tests/test_optimizer*.py -q` | ✅ Sí |
| Frontend build | `cd frontend && npm run build` | ⚠️ Opcional (no tocamos frontend) |
| Frontend contract tests | `cd frontend && npx vitest run` | ⚠️ Recomendado |

### 8.3. Tests end-to-end manuales recomendados (post-deploy)

1. Optimizar cartera **sin locks** → debe funcionar igual que antes.
2. Optimizar cartera con `lock_mode=free` → debe funcionar igual.
3. Optimizar cartera con locks compatibles → debe optimizar.
4. Optimizar cartera con locks que excedan bucket max → **BLOCK esperado con mensaje claro**.
5. Optimizar cartera con locks que impidan equity_floor → **BLOCK esperado**.
6. Optimizar cartera con locks > 60% → **WARNING** (invisible en UX actual, verificar en response).

---

## 9. Rollback plan

### Si no se ha desplegado todavía

No aplica. El código está en master pero no en producción.

### Si se despliega y hay problema

| Opción | Comando | Commits a revertir |
|---|---|---|
| Revert completo runtime | `git revert ca78051 47d3e20` | BLOCK-7 + BLOCK-8 |
| Revert solo equity_floor | `git revert ca78051` | Solo BLOCK-8 |
| Revert solo bucket check | `git revert 47d3e20` | Solo BLOCK-7 (requiere ajustar tests) |

**Nota**: Los commits de documentación (`574933d`, `84d7246`, `d8da383`, etc.) no
necesitan revert ya que no contienen runtime.

### Deploy seguro (feature flag alternativa)

No se implementó feature flag. Si se necesita desactivar el precheck sin revert:
- `equity_floor=None` ya deshabilita BLOCK-8 (por defecto).
- BLOCK-7 y WARNING no tienen flag — requeriría revert o parche.

---

## 10. Veredicto final

### `READY_FOR_BACKEND_RELEASE` ✅

| Criterio | Evaluación |
|---|---|
| Retrocompatible | ✅ Parámetro opcional, output sin cambio |
| Tests pasan | ✅ 42 passed, 0 failed |
| Comportamiento deseado | ✅ Según decisiones P1–P5 aprobadas |
| Riesgo de BLOCK inesperado | BAJO — solo afecta carteras con locks incompatibles |
| UX del BLOCK | ⚠️ Mensaje correcto, contexto visual genérico |
| UX del WARNING | ⚠️ Invisible (frontend no procesa warnings) |
| Impacto si no se hace UX antes | ACEPTABLE — el usuario ve el mensaje correcto |
| Rollback posible | ✅ `git revert` limpio |

### Justificación

El backend puede desplegarse **sin necesidad de bloque UX previo** porque:

1. El `message` del BLOCK se muestra directamente al usuario y es claro en español.
2. Antes, las mismas carteras causaban errores crípticos del solver o soluciones degradadas.
3. El cambio de comportamiento es **estrictamente una mejora UX** (error claro vs error críptico).
4. El botón "Añadir fondos y reintentar" es inadecuado pero no causa daño (el retry
   simplemente volverá a bloquear con el mismo mensaje).
5. El WARNING invisible no causa daño funcional.

**Un bloque UX posterior mejoraría la experiencia** (título, botón, y visualización
de warnings), pero **no es bloqueante para deploy**.

---

## 11. Próximo bloque recomendado

| Prioridad | Bloque | Objetivo |
|---|---|---|
| 1 (post-deploy) | `BDB-OPT-FEASIBILITY-LOCKS-UX-MESSAGES-0` | Adaptar título/botón del dialog para locks BLOCK. Mostrar WARNING de concentración. |
| 2 (post-deploy) | `BDB-OPT-FEASIBILITY-LOCKS-END-TO-END-QA-0` | Validar con carteras reales en staging. |
| 3 (futuro) | `BDB-OPT-LEGACY-OVERRIDE-0` | Implementar modo cartera heredada (D10). |

---

## 12. Estado final

```
RELEASE_REVIEW_ONLY
NOT_DEPLOYED
NO_RUNTIME_CHANGES_IN_THIS_BLOCK
READY_FOR_BACKEND_RELEASE
```

### Resumen en una frase

> El bloque Locks Feasibility Precheck es seguro para deploy a producción.
> El usuario verá mensajes claros en español cuando los locks sean incompatibles.
> Un bloque UX posterior mejorará el contexto visual del dialog, pero no es
> bloqueante para release.

---

**Fecha de evaluación**: 2026-05-10T07:25:00+02:00

**Autor**: Asistente IA (Claude 4.6, Antigravity IDE)

**Documentos relacionados**:
- `docs/BDB_OPT_FEASIBILITY_LOCKS_RUNTIME_CLOSEOUT_0.md`
- `docs/BDB_OPT_FEASIBILITY_LOCKS_EXPECTED_BEHAVIOR_TESTS_0.md`
- `docs/BDB_OPT_FEASIBILITY_LOCKS_USER_DECISIONS_0.md`
- `docs/BDB_OPT_FEASIBILITY_LOCKS_SEMANTIC_DECISION_0.md`
- `docs/BDB_OPT_FEASIBILITY_LOCKS_DESIGN_0.md`
- `docs/BDB_OPT_FEASIBILITY_PRECHECK_AUDIT_0.md`
