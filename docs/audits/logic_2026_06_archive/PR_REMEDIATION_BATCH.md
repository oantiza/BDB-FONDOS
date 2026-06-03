# PR - Lote de remediacion (PR #1)

**Rama:** `audit/remediation-batch`  
**PR:** https://github.com/oantiza/BDB-FONDOS/pull/1  
**Estado:** draft, CI verde en run #5, gaps contractuales cerrados en `88f6188`, REM-5B implementado en `95f4c91`.

> Este documento es un handoff LOCAL. No forma parte del PR y no debe anadirse al commit.

---

## 1. Estado por ticket

| Ticket | Estado | Detalle |
|---|---|---|
| REM-0 (CI) | Implementado y validado | Backend remediation tests, frontend vitest y manual overrides gate verdes en GitHub Actions run #4. |
| REM-5A (flag + dual-read) | Implementado | `unified_constraints` OFF por defecto, dual-read `risk_profiles` / `risk_profiles_staging`. |
| REM-1 (suitability parity) | Implementado | Golden compartido backend/frontend; bug frontend `no_classification` corregido. |
| REM-2 (unified constraints) | Gaps contractuales cerrados | Bounds efectivos narrowing-only, mapper canonico unico, `ignored_overrides` en explainability/respuesta. |
| REM-4 (equity_floor/config) | Gaps contractuales cerrados | `equity_floor` derivado de `rv_min` efectivo bajo flag ON; `bond_cap`/`cash_cap` retirados del contexto ambiguo. |
| REM-5B (shadow comparator) | Implementado y validado | Shadow determinista A/B legacy vs unified: 14 casos, 0 FAIL, 0 INVESTIGATE. |

---

## 2. Alcance real del PR

**10 modificados + 21 nuevos = 31 archivos cambiados.**

**Modificados (10):**

- `.gitignore`
- `frontend/src/App.tsx`
- `frontend/src/utils/rulesEngine.ts`
- `functions_python/requirements.txt`
- `functions_python/scripts/maintenance/migrate_suitability_v2.py`
- `functions_python/services/config.py`
- `functions_python/services/portfolio/constraints_builder_v1.py`
- `functions_python/services/portfolio/optimizer_core.py`
- `functions_python/services/portfolio/suitability_engine.py`
- `package.json`

**Nuevos (19):**

- `.github/workflows/ci.yml`
- `frontend/package-lock.json`
- `frontend/src/__tests__/suitabilityParityGolden.test.ts`
- `functions_python/conftest.py`
- `functions_python/pytest.ini`
- `functions_python/requirements-dev.txt`
- `functions_python/requirements.in`
- `functions_python/scripts/monitoring/check_compatible_profiles_drift.py`
- `functions_python/services/feature_flags.py`
- `functions_python/services/portfolio/bounds_resolver.py`
- `functions_python/tests/fixtures/suitability_golden.json`
- `functions_python/tests/test_bucket_vectors_single_source.py`
- `functions_python/tests/test_constraints_builder_real_asset.py`
- `functions_python/tests/test_effective_bounds_merge.py`
- `functions_python/tests/test_suitability_parity_golden.py`
- `functions_python/tests/test_unified_constraints_contract.py`
- `functions_python/tests/test_unified_constraints_flag.py`
- `functions_python/scripts/audit/shadow_compare_optimizer.py`
- `functions_python/tests/test_shadow_compare.py`
- `overrides/05_overrides/.gitkeep`
- `package-lock.json`

---

## 3. Gaps contractuales cerrados

- `bucket_bounds_v1` se convierte una sola vez a overrides canonicos.
- `alternative + real_asset` se fusionan restrictivamente en `Alternativos`, sin descartar entradas.
- `_inject_unified_bounds` devuelve `effective_bounds`, `ignored_overrides` y `bucket_constraints_source = "unified_effective_bounds"`.
- Precheck, inyeccion, validacion final y postproceso usan los mismos bounds efectivos bajo `UNIFIED_CONSTRAINTS=1`.
- `ignored_overrides` llega a `explainability` y tambien a la respuesta.
- Flag OFF conserva la ruta legacy.
- `bond_cap` / `cash_cap` ya no aparecen en `optimizer_core.py`.

---

## 4. Verificacion

**GitHub Actions run #5:** success.

- Backend remediation tests: success.
- Frontend vitest: success.
- Manual overrides gate: success.

**Local tras `88f6188`:**

- Backend remediation tests del workflow: `44 passed`.
- Tests afectados de postprocess/dedup: `22 passed`.
- `py_compile` de modulos/tests modificados: OK.
- `git diff --check`: sin errores.
- Shadow determinista: `14 total`, `11 PASS`, `3 EXPECTED`, `0 FAIL`, `0 INVESTIGATE`.
- Manifest local: `artifacts/shadow/shadow_deterministic_20260603T050408Z.json`.

---

## 5. Notas para shadow live / rollout

- La fusion D3 de `alternative + real_asset` aplica cotas sobre la suma `Alternativos`. Es segura frente a caps combinados, pero no garantiza suelos individuales por componente si en el futuro alguien espera semantics separadas.
- La neutralidad flag OFF de pesos extremo-a-extremo ya queda validada en el shadow determinista sin overrides.
- El siguiente paso opcional es shadow live/staging contra datos reales antes de promover el flag.
- El cambio visible esperado bajo flag ON debe caracterizarse: sobre todo diferencias de `status` por `equity_floor` derivado.

---

## 6. Secuencia recomendada

1. Mantener PR #1 en draft.
2. Decidir si se corre shadow live/staging antes de promover el flag.
3. Decidir rollout del flag o merge del PR.
4. Desbloquear REM-3 solo tras esa decision humana.
