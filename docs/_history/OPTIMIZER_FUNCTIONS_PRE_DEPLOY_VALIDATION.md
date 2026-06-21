# Pre-Deploy Validation: Optimizer Functions

**Fecha:** 2026-05-05  
**Validador:** Antigravity (Claude 4.6)  
**Estado:** ✅ APTO PARA DEPLOY

---

## A. Estado Git

```
On branch master
Your branch is up to date with 'origin/master'.
nothing to commit, working tree clean
```

**Working tree limpio.** ✅

---

## B. Commits Pendientes de Deploy (functions)

| Hash | Mensaje | Archivos productivos |
|------|---------|---------------------|
| `5663eae` | fix(optimizer): avoid duplicate bucket constraints when bucket_bounds_v1 is active | `optimizer_core.py` |
| `48ba511` | fix(tests): update test_optimizer_core fixtures for 756-day minimum and mock feasibility | Solo tests |
| `9f852c3` | fix(optimizer): guard float conversion for missing target volatility | `utils.py` + tests |

**Total cambios productivos:**
- `functions_python/services/portfolio/optimizer_core.py` (+15 / -3)
- `functions_python/services/portfolio/utils.py` (+4 / -4)

**Total cambios test/docs:**
- `functions_python/tests/test_bucket_constraints_dedup.py` (nuevo, 369 líneas)
- `functions_python/tests/test_optimizer_core.py` (refactored)
- `docs/` (3 informes)

---

## C. Tests Ejecutados

| Suite | Tests | Resultado |
|-------|-------|-----------|
| `test_optimizer_core.py` | 2 | ✅ PASSED |
| `test_optimizer_invariants.py` | 8 | ✅ PASSED |
| `test_bucket_constraints_dedup.py` | 9 | ✅ PASSED |
| **Total** | **19** | **19/19 ✅** |

Tiempo de ejecución: 13.16s

---

## D. Smoke Tests

No existe smoke test local de optimización (`smoke_test` / `test_optimizer_v3` no encontrados).  
Los tests unitarios cubren:
- Solver principal (min_vol, fallback chain)
- Deduplicación de constraints (9 escenarios)
- Invariantes matemáticos (weights, PSD, frontier, sharpe)
- Fallback equal-weight con datos degenerados

---

## E. Verificación de Archivos Protegidos

| Recurso | Tocado | Estado |
|---------|--------|--------|
| `frontend/` | NO | ✅ |
| `firestore.rules` | NO | ✅ |
| Credenciales / `.env` / `serviceAccount` | NO | ✅ |

Verificado con `git diff 5663eae~1..9f852c3 --stat` filtrado: **sin cambios en archivos protegidos.**

---

## F. Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| `_to_float(x, None)` devuelve `None` donde antes crasheaba — algún caller podría no esperar `None` | Baja (solo 1 caller usa `default=None`) | Verificado con grep; el caller (L1141) maneja `None` explícitamente con `if _target_vol is not None` |
| Perfiles P8-P10 con v1 activo ya no inyectan constraints de perfil duplicadas | Baja (v1 hereda del mismo perfil) | Si v1 está vacío, el legacy funciona exactamente igual |
| Tests no cubren integración real con Firestore/DataFetcher | Media | Los mocks son representativos; validación completa requiere test contra backend real |

---

## G. Recomendación

**✅ DEPLOY APROBADO** — solo functions (Python backend).

Los cambios son:
1. **Defensivos** (evitan crash, no cambian comportamiento correcto)
2. **Mínimos** (19 líneas productivas)
3. **Reversibles** (documentados en reports)
4. **Testeados** (19/19)

---

## H. Comando de Deploy Recomendado

```bash
firebase deploy --only functions
```

> [!IMPORTANT]
> Deploy **solo functions**. No incluir hosting ni firestore rules.
> El frontend ya está desplegado con la UX de fallback (commits anteriores).
