# Informe de estado — PR #1 Remediación auditoría lógica

**Fecha:** 2026-06-02  
**Repositorio:** `oantiza/BDB-FONDOS`  
**PR:** https://github.com/oantiza/BDB-FONDOS/pull/1  
**Rama:** `audit/remediation-batch`  
**Base:** `master`  
**Estado actual:** PR abierto en modo **draft**, mergeable, con CI verde.

---

## 1. Resumen ejecutivo

Se ha implementado y publicado el primer lote de remediación derivado de la auditoría lógica del proyecto BDB-FONDOS.

El PR #1 incluye la base de CI, el flag `unified_constraints`, la lectura dual de perfiles de riesgo, la paridad inicial de suitability backend/frontend y una primera implementación de constraints unificadas detrás de flag.

El cambio queda deliberadamente en **draft** porque, aunque CI ya está verde, REM-2 y REM-4 no deben considerarse cerrados todavía: quedan gaps contractuales que deben resolverse antes de construir REM-5B shadow comparator y antes de tocar REM-3.

---

## 2. Estado del PR

**PR:** `Audit remediation batch: CI, unified constraints flag, suitability parity`  
**URL:** https://github.com/oantiza/BDB-FONDOS/pull/1  
**Commits:** 3  
**Archivos cambiados:** 28  
**Estado GitHub:** abierto, draft, mergeable  
**CI:** verde en GitHub Actions, run 3

Commits relevantes:

1. `30aca66` — `Audit remediation batch: CI, unified constraints flag, suitability parity`
2. `ade4d2d` — `Stabilize remediation CI dependencies and focused checks`
3. `34d6e93` — `Provide CI Firebase env for frontend tests`

---

## 3. Alcance incluido

El PR contiene:

- **REM-0:** workflow CI, configuración pytest, dependencias dev y lockfiles Node versionados.
- **REM-5A:** flag `unified_constraints`, lectura dual `risk_profiles` / `risk_profiles_staging`.
- **REM-1:** paridad suitability backend/frontend con golden compartido.
- **REM-2:** implementación inicial de unified constraints tras flag, no cerrada.
- **REM-4:** limpieza parcial de config y `equity_floor` derivado, no cerrada.

También se añadieron ajustes de estabilización de CI:

- Versionado de `package-lock.json` y `frontend/package-lock.json`.
- Eliminación de `package-lock.json` de `.gitignore`.
- Placeholder `overrides/05_overrides/.gitkeep` para que el gate no falle por directorio ausente.
- Variables Firebase dummy en CI para que Vitest pueda inicializar Firebase sin secretos.

---

## 4. Incidencias encontradas durante CI

### Run 1

Falló por configuración inicial de CI:

- `setup-node` no podía resolver rutas de cache porque los lockfiles no estaban versionados.
- Backend ejecutaba todo el suite completo y tropezaba con deuda histórica no relacionada con este lote.

Además, al probar localmente se descubrió un fallo real de paridad frontend/backend:

- Caso `no_classification`: backend esperaba `[]`, frontend devolvía perfiles `1..10`.
- Se corrigió `frontend/src/utils/rulesEngine.ts` para que, sin `classification_v2`, suitability frontend devuelva `false`, alineado con backend.

### Run 2

Mejoró el estado:

- Backend: verde.
- Manual overrides gate: verde.
- Frontend: falló en Vitest por `auth/invalid-api-key`.

Causa:

- En local existe `frontend/.env`.
- En GitHub Actions no existe ese `.env`.
- Algunos tests importan `frontend/src/firebase.ts`, que inicializa Firebase Auth.

Corrección:

- Se añadieron variables `VITE_FIREBASE_*` dummy al job frontend de CI.
- No son secretos ni apuntan a producción; solo permiten inicialización en tests.

### Run 3

Resultado final:

- Backend remediation tests: **success**.
- Frontend vitest: **success**.
- Manual overrides gate: **success**.

CI queda verde.

---

## 5. Validación local realizada

Antes de publicar los ajustes finales se validó localmente:

- Backend focalizado del lote: `27 passed`.
- Frontend completo: `24 test files passed`, `625 passed`.
- Manual overrides gate:
  - tests unitarios: `18 passed`;
  - validación: `errors=0`;
  - warnings por duplicados canónicos preexistentes.
- `git diff --check`: sin errores.

También se confirmó que los documentos locales no entraron en el commit:

- `docs/PR_REMEDIATION_BATCH.md` queda fuera del PR.
- Los planes/auditorías/CSVs no versionados siguen fuera del PR.

---

## 6. Nota importante sobre backend completo

El primer intento de CI ejecutaba `python -m pytest -q` sobre todo el backend y falló en 3 tests no relacionados con este lote:

1. `test_admin_endpoints_readonly.py`
   - Detecta `.set(` en `admin_retro_write`.

2. `test_admin_retro_dry_run.py`
   - Detecta el mismo `.set(`.

3. `test_backtester_history_fallback.py`
   - La expectativa antigua exige error con pocas observaciones, pero el código actual ya devuelve métricas.

Estos fallos parecen deuda previa del repo, no introducida por el lote de remediación. Para no ampliar alcance, el CI backend del PR quedó limitado a las pruebas específicas de remediación.

Recomendación: abrir un ticket separado para estabilizar el suite backend completo antes de convertirlo en gate global.

---

## 7. Gaps contractuales pendientes antes de shadow

Aunque CI está verde, no debe empezarse REM-5B todavía hasta cerrar estos puntos:

1. **`ignored_overrides` a respuesta/explainability**
   - Actualmente el cálculo existe, pero debe propagarse al objeto de respuesta.

2. **Precheck con bounds efectivos**
   - Con `UNIFIED_CONSTRAINTS=1`, el precheck debe usar la misma fuente efectiva que el inyector.

3. **Validación/postproceso con `build_bucket_vectors`**
   - Inyección, validación y postproceso deben compartir vocabulario y mapeo.

4. **Resolver `bond_cap` / `cash_cap`**
   - Quedan restos locales en el contexto aunque la config muerta se haya retirado.

5. **Fusionar `alternative + real_asset`**
   - Si ambos aparecen en overrides V1, deben estrecharse/fusionarse, no perder una entrada.

---

## 8. Recomendación

No marcar el PR como listo para merge todavía.

Secuencia recomendada:

1. Mantener PR #1 en draft.
2. Cerrar los 5 gaps contractuales anteriores en la rama actual.
3. Reejecutar CI.
4. Solo después construir REM-5B shadow comparator.
5. Mantener REM-3 bloqueado hasta tener:
   - CI verde;
   - gaps contractuales cerrados;
   - shadow validado.

Conclusión: el lote ya pasó de “implementación tentativa” a “base validada por CI”, pero aún no es una remediación completa. El siguiente trabajo debe ser contractual, no expansión de alcance.
