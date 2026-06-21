# BDB_OPT_FEASIBILITY_LOCKS_RUNTIME_CLOSEOUT_0

## Informe de Cierre: Locks Feasibility Precheck — Backend

**Estado: `IMPLEMENTED_BACKEND_PRECHECK_ONLY` | `NOT_DEPLOYED` | `READY_FOR_RELEASE_REVIEW`**

---

## 1. Resumen ejecutivo

Se ha completado la implementación backend del bloque de **feasibility precheck para locks**
dentro del motor de optimización de carteras (BDB-FONDOS legacy / producción / funds_v3).

El precheck detecta, **antes de invocar al solver**, combinaciones de posiciones bloqueadas
que hacen matemáticamente imposible (BLOCK) o dificultan significativamente (WARNING)
la construcción de una cartera coherente con el perfil de riesgo del cliente.

El solver, el frontend, los endpoints y la configuración **no han sido modificados**.
El precheck es una capa preventiva que se ejecuta en `feasibility_precheck.py` y que
ya estaba integrada en la FASE 5.5b de `optimizer_core.py`.

---

## 2. Estado Git / Base

| Campo | Valor |
|---|---|
| Repositorio | `C:/Users/oanti/Documents/BDB-FONDOS` |
| Remoto | `github.com/oantiza/BDB-FONDOS` |
| Rama | `master` |
| HEAD al cierre | `ca78051` |
| HEAD = origin/master | ✅ |
| Working tree | Limpio al iniciar este informe |

---

## 3. Cadena de commits del bloque

| Commit | Mensaje | Tipo |
|---|---|---|
| `742e289` | `OPTIMIZER_FEASIBILITY: document precheck audit` | Documentación |
| `3871f58` | `OPTIMIZER_FEASIBILITY: add locks compatibility design tests` | Tests diseño |
| `d8da383` | `OPTIMIZER_FEASIBILITY: document locks semantic decisions` | Documentación |
| `84d7246` | `OPTIMIZER_FEASIBILITY: document locks user decisions` | Documentación |
| `13e4855` | `OPTIMIZER_FEASIBILITY: add locks expected behavior tests` | Tests comportamiento |
| `47d3e20` | `OPTIMIZER_FEASIBILITY: enforce lock bucket precheck` | **Runtime** |
| `ca78051` | `OPTIMIZER_FEASIBILITY: enforce lock equity floor precheck` | **Runtime** |

Total: **7 commits** (4 documentación, 1 tests diseño, 2 runtime).

---

## 4. Checks implementados

### 4.1. BLOCK_LOCKS_INCOMPATIBLE_BUCKET (BLOCK-7)

- **Severidad**: BLOCK (impide optimización).
- **Descripción**: La suma de pesos bloqueados (`keep_weight`, `keep_money`, `min_keep`)
  en un bucket excede el máximo efectivo de ese bucket según `active_bounds`.
- **Fuente de bounds**: Solo `active_bounds` recibidos por el precheck (bucket_bounds_v1
  o perfil canónico de riesgo). No lee Firestore, config ni frontend.
- **Tolerancia**: `1e-4`.
- **Excluye**: `lock_mode="free"` (P4).
- **Mixto**: Solo se valida si viene con bounds definidos en `active_bounds`.

### 4.2. WARNING_LOCKS_HIGH_CONCENTRATION

- **Severidad**: WARNING (no impide optimización).
- **Descripción**: El total de capital bloqueado (`keep_weight`, `keep_money`, `min_keep`)
  supera el 60%, lo que limita la capacidad del optimizador para diversificar.
- **Threshold**: `0.60 + 1e-4`.
- **Excluye**: `lock_mode="free"` (P4).
- **No cambia `is_feasible`**.

### 4.3. BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR (BLOCK-8)

- **Severidad**: BLOCK (impide optimización).
- **Descripción**: Las posiciones bloqueadas en activos no-equity consumen tanto
  presupuesto que el `equity_floor` del perfil de riesgo se vuelve inalcanzable.
- **Algoritmo**: Greedy best-case — asigna el presupuesto libre a los activos con
  mayor exposición a equity, respetando `max_weight` por activo. Si aun así el máximo
  equity alcanzable es inferior a `equity_floor`, emite BLOCK.
- **Fuente de equity_floor**: Parámetro opcional `equity_floor: Optional[float] = None`
  en `run_feasibility_precheck()`. Inyectado desde `optimizer_core.py` con una sola
  línea: `equity_floor=equity_floor`.
- **Tolerancia**: `1e-4`.
- **Excluye**: `lock_mode="free"` (P4).
- **No se activa**: Si `equity_floor` es `None` o `<= 0`.

---

## 5. Reglas de decisión por lock_mode

| lock_mode | Cuenta para BLOCK bucket | Cuenta para BLOCK equity_floor | Cuenta para WARNING concentración | Referencia |
|---|---|---|---|---|
| `keep_weight` | ✅ | ✅ | ✅ | P2 |
| `keep_money` | ✅ | ✅ | ✅ | P2 |
| `min_keep` | ✅ | ✅ | ✅ | P3 |
| `free` | ❌ | ❌ | ❌ | P4 |

### Reglas adicionales

- **equity_floor estándar**: HARD (P1). No hay modo degradado.
- **Mixto**: Solo se valida contra bounds de bucket si el bucket aparece en `active_bounds`.
  Si no tiene bounds definidos, no se genera incompatibilidad.
- **Tolerancia numérica**: `1e-4` en todas las comparaciones de peso (decisión semántica aprobada).

---

## 6. Qué NO se implementó

| Concepto | Estado | Motivo |
|---|---|---|
| Modo cartera heredada fuera de perfil | No implementado | Requiere diseño de `allow_legacy_override` |
| `allow_legacy_override` | No implementado | Parámetro futuro (P1, D10) |
| UX frontend para BLOCK/WARNING | No implementado | No se tocó frontend |
| Cambios en solver | No implementado | El precheck es preventivo, no correctivo |
| Cambios en `constraints_builder_v1.py` | No implementado | No necesario para precheck |
| Cambios en `endpoints_portfolio.py` | No implementado | No necesario para precheck |
| Cambios en `config.py` | No implementado | equity_floor ya llega como constraint |
| Deploy a producción | No realizado | Pendiente de release review |

---

## 7. Archivos tocados durante implementación

| Archivo | Commits | Tipo de cambio |
|---|---|---|
| `feasibility_precheck.py` | `47d3e20`, `ca78051` | +BLOCK-7, +WARNING, +BLOCK-8, +param equity_floor |
| `optimizer_core.py` | `ca78051` | +1 línea: `equity_floor=equity_floor` |
| `test_feasibility_precheck_locks_expected_behavior.py` | `13e4855`, `47d3e20`, `ca78051` | Tests A1–F13b, xfail→PASS |
| `test_feasibility_precheck_locks_compatibility.py` | `3871f58`, `47d3e20`, `ca78051` | Tests bucket+equity_floor, xfail→PASS |
| `BDB_OPT_FEASIBILITY_LOCKS_EXPECTED_BEHAVIOR_TESTS_0.md` | `13e4855`, `47d3e20`, `ca78051` | Estado → IMPLEMENTED_COMPLETE |

### Archivos de documentación creados (solo docs)

| Archivo | Commit |
|---|---|
| `docs/BDB_OPT_FEASIBILITY_PRECHECK_AUDIT_0.md` | `742e289` |
| `docs/BDB_OPT_FEASIBILITY_LOCKS_DESIGN_0.md` | `3871f58` |
| `docs/BDB_OPT_FEASIBILITY_LOCKS_SEMANTIC_DECISION_0.md` | `d8da383` |
| `docs/BDB_OPT_FEASIBILITY_LOCKS_USER_DECISIONS_0.md` | `84d7246` |

---

## 8. Tests finales y resultados

### Locks tests (expected behavior + compatibility)

```
22 passed, 2 skipped, 0 xfailed, 0 failed (0.10s)
```

### Precheck original (regresión)

```
20 passed, 0 failed (0.08s)
```

### Cobertura de checks

| Check | Tests que lo validan |
|---|---|
| BLOCK_LOCKS_INCOMPATIBLE_BUCKET | A2, A4, B6, E11, F13a, case_a, case_b, case_e |
| WARNING_LOCKS_HIGH_CONCENTRATION | B7 |
| BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR | A3, D9, case_a_equity_floor |
| free exclusion | C8, C8b, case_d |
| Compatible / no-block | A1, B5, F13b, case_c, case_b_equity, case_c_equity, case_d_equity |

---

## 9. Significado de los 2 SKIPPED

| Test | Motivo del SKIP |
|---|---|
| D10 `legacy_mode_documental` | Modo futuro de cartera heredada. `allow_legacy_override` no implementado. Documental puro. |
| E12 `no_cross_source_validation_documental` | Regla de no mezclar fuente de bounds entre precheck y solver. Test de integración futuro. |

Estos SKIP son **intencionalmente documentales** — no hay lógica testeable todavía.
No representan bugs ni deuda técnica activa.

---

## 10. Riesgos mitigados

| Riesgo | Check | Resultado |
|---|---|---|
| Locks que exceden el máximo de un bucket de riesgo | BLOCK-7 | El solver no recibe un problema imposible |
| Locks/min_keep que consumen demasiado margen de diversificación | WARNING | El usuario recibe aviso antes de optimizar |
| Locks que hacen imposible cumplir equity_floor del perfil | BLOCK-8 | El solver no intenta una solución infactible |
| `free` indebidamente bloqueante | Exclusión P4 | `free` nunca genera BLOCK ni WARNING |
| Mixto validado con bounds inexistentes | Guard `if vec is None` | No genera falsos positivos |
| Llamadas existentes al precheck rotas por nuevo parámetro | Default `None` | 100% retrocompatible |

---

## 11. Riesgos pendientes

| Riesgo | Severidad | Contexto |
|---|---|---|
| UX no muestra mensajes de BLOCK/WARNING específicos | MEDIA | El frontend recibe `feasibility_precheck` en la respuesta pero puede no renderizar los codes nuevos |
| Modo cartera heredada no existe | BAJA | Solo afecta a un caso de uso futuro (D10) |
| No se ha hecho deploy | ALTA | Los checks están en código pero no en producción |
| No se ha validado end-to-end con UI | MEDIA | Tests unitarios cubren contrato, pero falta validación visual |
| `_check_feasibility_and_autoexpand` valida equity_floor después | BAJA | Semántica complementaria: precheck=preventivo, autoexpand=correctivo. Sin contradicción |

---

## 12. Recomendación profesional

> **No tocar más lógica de locks en feasibility_precheck antes de:**
> 1. Auditar cómo el frontend consume `feasibility_precheck` en la respuesta del optimizer.
> 2. Verificar que los codes `BLOCK_LOCKS_INCOMPATIBLE_BUCKET`,
>    `BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR` y `WARNING_LOCKS_HIGH_CONCENTRATION`
>    se renderizan correctamente al usuario.
> 3. Validar end-to-end con una cartera real que active cada check.

El backend precheck está **completo y testeado**. El siguiente paso lógico es
**cerrar la cadena UX** o **hacer un release readiness check** antes de deploy.

---

## 13. Próximos bloques posibles

| Bloque | Objetivo | Prioridad |
|---|---|---|
| `BDB-OPT-FEASIBILITY-LOCKS-UX-MESSAGES-AUDIT-0` | Auditar cómo el frontend consume los nuevos codes BLOCK/WARNING | **ALTA** |
| `BDB-OPT-FEASIBILITY-LOCKS-RELEASE-READINESS-0` | Verificar que todo está listo para deploy a producción | **ALTA** |
| `BDB-OPT-FEASIBILITY-LOCKS-END-TO-END-QA-0` | Validar con carteras reales que los checks se activan correctamente | MEDIA |
| `BDB-OPT-LEGACY-OVERRIDE-0` | Implementar modo cartera heredada (D10, `allow_legacy_override`) | BAJA |
| `BDB-OPT-CROSS-SOURCE-VALIDATION-0` | Validar coherencia entre fuentes de bounds (E12) | BAJA |

---

## 14. Estado final

```
IMPLEMENTED_BACKEND_PRECHECK_ONLY
NOT_DEPLOYED
READY_FOR_RELEASE_REVIEW
```

### Resumen en una frase

> Los checks de compatibilidad locks vs perfil de riesgo están implementados y
> testeados en el backend precheck. El solver, frontend, endpoints y configuración
> no han sido modificados. Se requiere auditoría UX y release review antes de deploy.

---

**Fecha de cierre**: 2026-05-10T07:05:00+02:00

**Autor**: Asistente IA (Claude 4.6, Antigravity IDE)

**Documentos relacionados**:
- `docs/BDB_OPT_FEASIBILITY_PRECHECK_AUDIT_0.md`
- `docs/BDB_OPT_FEASIBILITY_LOCKS_DESIGN_0.md`
- `docs/BDB_OPT_FEASIBILITY_LOCKS_SEMANTIC_DECISION_0.md`
- `docs/BDB_OPT_FEASIBILITY_LOCKS_USER_DECISIONS_0.md`
- `docs/BDB_OPT_FEASIBILITY_LOCKS_EXPECTED_BEHAVIOR_TESTS_0.md`
