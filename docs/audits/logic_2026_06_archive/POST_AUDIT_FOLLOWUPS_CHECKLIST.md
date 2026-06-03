# Checklist de cierre post-auditoría (para Codex / operación)

**Contexto:** PR #1 (lote) + REM-3 ya en `master` (`fbdef7b`), CI run #13 verde, flag `unified_constraints` **OFF**.
Nada de esto es un bug bloqueante. Son verificaciones y tidy-ups, priorizados por momento.

**Leyenda:** **P0** = antes de desplegar el frontend · **P1** = housekeeping (cuando se quiera) · **P2** = antes de
poner el flag **ON** (no antes del deploy).

> **NO hacer en ninguno de estos items:** poner `unified_constraints` ON; sobrescribir `system_settings/risk_profiles`
> canónico sin gate+backup; ampliar alcance a REM nuevos.

---

## A · [P0] Verificar deriva de `compatible_profiles` en producción  (operativo)

**Por qué:** REM-1 cambió la lógica de idoneidad del frontend (fix `no_classification`). Si el `compatible_profiles`
cacheado en `funds_v3` quedó stale, la UI puede mostrar idoneidad incoherente con el motor.

**Acción (read-only, desde máquina con credenciales de prod):**
```bash
cd functions_python
# requiere GOOGLE_APPLICATION_CREDENTIALS o serviceAccountKey.json apuntando al proyecto bdb-fondos
python -m scripts.monitoring.check_compatible_profiles_drift   # exit 0 = sin deriva; 1 = hay deriva
```
- **Si exit 0 / "con deriva: 0":** nada que hacer. ✔
- **Si hay deriva:** regenerar con el gate existente (`scripts/maintenance/migrate_suitability_v2.py`):
  dry-run → revisar manifest de cambios → aprobar → escribir. NO escribir sin revisar el diff.

**Done:** monitor en 0 deriva (o regeneración aplicada y re-verificada en 0).

---

## B · [P1] Housekeeping de coherencia  (bajo riesgo)

- [ ] **Doc stale:** `docs/PR_REMEDIATION_BATCH.md` aún dice "PR #1 draft". Actualizar a "mergeado en `5b57423`,
  REM-3 en `fbdef7b`" o archivarlo. (Es doc local, no entra en commits de código.)
- [ ] **Canónico con `Mixto`:** `system_settings/risk_profiles` (canónico) todavía contiene la clave `Mixto`;
  `risk_profiles_staging` ya está migrado sin ella. Inocuo hoy (Mixto nunca se aplicó; flag-OFF lo ignora).
  **Acción diferida:** migrar también el canónico (drop `Mixto`) con gate+backup **solo** cuando se decida
  promover el flag a permanente. Hasta entonces, dejarlo documentado, no tocar.

**Done:** doc actualizado; decisión sobre el canónico anotada (no ejecutada todavía).

---

## C · [P2] Endurecer el shadow comparator  (código; antes de fiarse de él para el flip del flag)

Archivo: `functions_python/scripts/audit/shadow_compare_optimizer.py` (+ `tests/test_shadow_compare.py`).

### C.1 — Cerrar la precedencia que puede enmascarar un diff de pesos
**Problema:** en `compare_case_results`, `_status_diff_due_to_equity_floor` se evalúa **antes** del FAIL por pesos.
Para un caso `allow_equity_floor_status_diff=True`, si ambos runs producen carteras **válidas (pesos no vacíos)**
con pesos distintos *y* status distinto, se clasifica EXPECTED en vez de FAIL.

**Fix:** tratar el status-diff por equity_floor como EXPECTED **solo si al menos un lado es infeasible / pesos
vacíos**. Si ambos lados tienen pesos no vacíos, seguir aplicando la neutralidad de pesos (FAIL en caso sin
override; o INVESTIGATE si se prefiere conservador). Es decir, la regla de pesos no-override debe poder ganar a
la de equity_floor cuando hay carteras reales en ambos lados.

**Test a añadir** (`test_shadow_compare.py`): caso **sin override**, con `status` distinto por equity_floor pero
**pesos no vacíos y distintos** → debe NO ser EXPECTED (FAIL o INVESTIGATE, según se decida). Mantener verde el
test actual donde el unified es `infeasible_equity_floor` con `weights={}` (ese sí sigue EXPECTED).

### C.2 — Cubrir el objetivo de producción `efficient_risk`
**Problema:** el barrido baseline usa `min_vol` (1-7) / `max_sharpe` (8-10), pero el default real de
`rebalance_to_profile` es `efficient_risk` (con su cascada de fallbacks). Hoy solo un caso lo toca.

**Fix:** añadir en `build_cases()` casos baseline **sin override** con `objective="efficient_risk"` para una
muestra representativa de perfiles (p.ej. 3, 5, 7). Deben salir **PASS** (neutralidad). Opcional: añadir un caso
con `max_weight=0.20` (el default de producción) en vez de 1.0.

### C.3 — Re-correr y actualizar manifest
```bash
cd functions_python
python -m scripts.audit.shadow_compare_optimizer   # esperado: 0 FAIL, exit 0
python -m pytest tests/test_shadow_compare.py -q    # esperado: verde, con el nuevo test
```

**Done:** shadow determinista con `efficient_risk` y `max_weight=0.20` en el barrido, precedencia corregida,
`test_shadow_compare.py` ampliado en verde, manifest nuevo en `artifacts/shadow/`, CI verde. **0 FAIL.**

---

## Orden sugerido

1. **A** (antes de tocar el frontend en prod).
2. **Deploy** (decisión humana; backend flag-OFF neutral, frontend en preview channel primero).
3. **B** cuando se quiera.
4. **C** antes de considerar el flip del flag `unified_constraints` a ON.
5. Solo tras C + shadow live de caracterización → decidir flip del flag.
