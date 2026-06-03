# REM-5B — Spec del Shadow Comparator (para Codex)

**Objetivo:** demostrar que la ruta unificada (`UNIFIED_CONSTRAINTS=1`) produce **las mismas carteras** que la
ruta legacy (`=0`) cuando no hay overrides, y **caracterizar** las diferencias intencionadas cuando sí los hay,
antes de cualquier rollout o de desbloquear REM-3.

**Criterio de éxito (Definition of Done):**
- Script `functions_python/scripts/audit/shadow_compare_optimizer.py` creado.
- Genera un manifest en `artifacts/shadow/` con veredicto por caso + resumen.
- **Exit code ≠ 0 si hay algún diff de pesos en un caso SIN overrides** (regresión = bloqueante).
- Tiene su propio test (`tests/test_shadow_compare.py`) que valida la lógica de clasificación de diffs.
- No toca `optimizer_core` ni la ruta de producción; es read-only / análisis.

---

## 1. Diseño A/B

Por cada caso de la muestra, ejecutar `run_optimization` **dos veces con inputs idénticos**, variando solo el flag:

```python
import os
# Run A (legacy):  os.environ["UNIFIED_CONSTRAINTS"] = "0"
# Run B (unified): os.environ["UNIFIED_CONSTRAINTS"] = "1"
```

`feature_flags._env_override()` da prioridad a la env var, así que el toggle por entorno es la palanca limpia
(no hace falta tocar Firestore para el flag).

**Aislar la variable = solo el camino de inyección.** Para que el A/B no introduzca diferencias por datos:
- Mismos `assets_list`, `risk_level`, `constraints`, `constraints_v1`, `asset_metadata` en A y B.
- Mismos perfiles: `risk_profiles` y `risk_profiles_staging` deben tener **contenido idéntico** (el dual-read
  de REM-5A no debe meter diferencias de datos). En el fake/seed, sembrar ambos docs con el mismo dict.
- Mismos precios/retornos/covarianza (ver §3, inputs deterministas).

`run_optimization(assets_list, risk_level, db, constraints=None, asset_metadata=None, locked_assets=None,
tactical_views=None, candidate_funds=None, constraints_v1=None)`.

---

## 2. Muestra de casos (fixture)

Cubrir, como mínimo (≈12-16 casos):

| Grupo | Casos | Propósito |
|---|---|---|
| Perfiles base | risk_level 1..10, **sin** `constraints_v1.bucket_bounds` | **Neutralidad**: A==B en pesos (bloqueante si difiere). |
| Con override que ESTRECHA | p.ej. nivel 5 con `equity {min:0.50}` (más estricto que RV 0.40) | Cambio intencionado: B puede diferir; documentar. |
| Con override que AMPLÍA | nivel 5 con `equity {min:0.10}` (más laxo que RV 0.40) | B debe **ignorar** la ampliación (`ignored_overrides`) y NO ampliar; A (legacy) podía colarlo. |
| `alternative` + `real_asset` ambos en overrides | caps a ambos | Verifica fusión restrictiva sin pérdida (gap 5). |
| Fallback / auto-expand | universo corto que fuerza fallback o `auto_expand_universe=True` | Confirmar que no reaparece una ruta legacy inadvertida bajo flag ON. |
| Perfiles agresivos 8-10 | con y sin override | El objetivo pasa a max_sharpe; confirmar que A/B coinciden sin override. |

Definir la muestra como una lista de dicts (`CASES = [{id, assets, risk_level, constraints, constraints_v1}, ...]`)
para poder ampliarla sin tocar la lógica.

---

## 3. Inputs deterministas (modo recomendado) + modo live

**Modo 1 — determinista (must-have, gateable):** congelar los inputs para que ambos runs vean exactamente lo
mismo y la única variable sea el flag. Reutilizar los **mismos seams que `test_unified_constraints_contract.py`**:
- Fake `db` que sirve `risk_profiles` == `risk_profiles_staging` (mismo dict) y `feature_flags`.
- `monkeypatch`/inyección de `_build_candidate_universe` y `_build_expected_returns_and_cov` para devolver un
  **panel de precios / mu / S fijos** por caso (un universo pequeño con exposiciones eq/bd/cs/al/ra/ot conocidas).
- El solver real (cvxpy) **sí corre** sobre esos inputs fijos → el diff aísla el camino de inyección.

Esto permite incluso correrlo en CI. Es el modo que da el veredicto de neutralidad.

**Modo 2 — live (opcional, antes del promote):** contra el emulador de Firebase o staging con datos reales de
fondos, para realismo. Menos determinista (los datos cambian). No bloqueante; informativo.

> Implementar Modo 1 primero. Modo 2 detrás de un flag CLI (`--live`).

---

## 4. Qué comparar (por caso)

De cada respuesta de `run_optimization` extraer y diffear:

- `status` y `solver_path`.
- `applicable` / `usable`.
- `weights` (mapa ISIN→peso) — **comparación principal**, tolerancia **1e-4** por ISIN y en la suma.
- `portfolio_allocation` (RV/RF/Monetario/Alternativos/Otros y equity/bond/...) — tol 1e-4.
- `metrics`: `return`, `volatility`, `sharpe` — tol 1e-4.
- `len(violations)` / `constraint_violations`.
- Presencia y contenido de `explainability.effective_bounds`, `explainability.ignored_overrides`,
  `explainability.bucket_constraints_source` (solo deben aparecer en B/flag-ON).

---

## 5. Clasificación de diffs (PASS / FAIL / EXPECTED)

Por cada caso, clasificar:

- **FAIL (bloqueante):** diff de `weights` o `portfolio_allocation` > tol en un caso **SIN overrides**.
  Significa que el refactor cambió comportamiento neutro → regresión.
- **EXPECTED (registrar, no falla):**
  - diffs de pesos/allocation en casos **CON overrides** (es la unificación intencionada; B es el comportamiento correcto);
  - diffs de `status`/`solver_path` atribuibles al `equity_floor` derivado bajo flag ON;
  - aparición de `effective_bounds`/`ignored_overrides` en B.
- **INVESTIGATE (warning, no bloqueante pero se reporta):** diff de `status` en un caso **sin overrides** que
  **no** se explique por `equity_floor`; cualquier excepción/`status="error"` en uno de los dos runs.

**Exit code:** `1` si hay ≥1 FAIL; `0` en otro caso. Los INVESTIGATE se listan pero no rompen el gate (decisión humana).

---

## 6. Manifest (salida)

Escribir a `artifacts/shadow/shadow_<timestamp>.json` (y opcional `.csv` resumen):

```json
{
  "generated_at": "...",
  "mode": "deterministic | live",
  "summary": {"total": N, "pass": x, "expected_diff": y, "fail": z, "investigate": w},
  "cases": [
    {
      "id": "profile_5_no_override",
      "verdict": "PASS | FAIL | EXPECTED | INVESTIGATE",
      "weights_max_abs_diff": 0.0,
      "status": {"legacy": "...", "unified": "..."},
      "solver_path": {"legacy": "...", "unified": "..."},
      "allocation_max_abs_diff": 0.0,
      "metrics_diff": {"return": 0.0, "volatility": 0.0, "sharpe": 0.0},
      "ignored_overrides_unified": [...],
      "notes": "..."
    }
  ]
}
```

Imprimir además un resumen legible a stdout (tabla: id | verdict | weights_max_abs_diff | status A→B).

---

## 7. Cómo ejecutarlo

```bash
cd functions_python
# Modo determinista (recomendado, no necesita datos live):
python -m scripts.audit.shadow_compare_optimizer
# Modo live (emulador/staging):
firebase emulators:start         # en otra terminal, con risk_profiles + risk_profiles_staging sembrados
python -m scripts.audit.shadow_compare_optimizer --live
echo $?   # 0 = sin regresiones de peso; 1 = hay FAIL
```

---

## 8. Tests del propio harness (`tests/test_shadow_compare.py`)

No requieren el optimizador pesado; testear la **lógica de clasificación** con respuestas mock:
- Dos respuestas idénticas sin override → `PASS`, exit-contribuyente 0.
- Diff de pesos sin override → `FAIL`.
- Diff de pesos con override → `EXPECTED`.
- Solo diff de `status` por equity_floor → `EXPECTED`.
- Diff de `status` sin override no explicado → `INVESTIGATE`.
- Verificar el cálculo de `weights_max_abs_diff` y el resumen.

---

## 9. Gotchas (cosas a clavar)

1. **Limpiar el estado del flag entre runs:** usar `monkeypatch.setenv`/`finally` para no filtrar
   `UNIFIED_CONSTRAINTS` entre casos. Considerar que `feature_flags` no cachee el valor.
2. **`risk_profiles` == `risk_profiles_staging`** en el seed: si difieren, el diff mezcla "camino de inyección"
   con "datos de perfil" y el resultado es ininterpretable.
3. **Determinismo del solver:** fijar `mu`/`S` y `weight_bounds`; cvxpy debería ser determinista con inputs
   iguales. Si hay ruido numérico, la tolerancia 1e-4 lo absorbe; documentar si algún caso necesita más holgura.
4. **No marcar FAIL un cambio legítimo:** los casos CON override y los cambios de `status` por equity_floor son
   EXPECTED, no regresiones. La neutralidad se mide **solo** en los casos sin override.
5. **Casos de fallback:** confirmar que bajo flag ON el fallback/auto-expand no produce una cartera peor o por
   ruta legacy silenciosa; si el solve principal de A y B coincide pero el fallback no, registrarlo como
   INVESTIGATE (los fallbacks unificados eran un follow-up conocido).
6. **No es gate de CI todavía:** el shadow se corre a mano para esta validación; integrarlo en CI es decisión
   posterior (cuando la muestra determinista sea estable).

---

## 10. Qué NO hacer en este ticket

- No modificar `optimizer_core.py` ni la ruta de inyección (REM-2/4 ya están; aquí solo se compara).
- No tocar REM-3.
- No promover el flag a ON por defecto ni cambiar `system_settings`.

**Resultado esperado:** shadow en verde (0 FAIL) en modo determinista → recién entonces decidir rollout del flag
o desbloquear REM-3.
