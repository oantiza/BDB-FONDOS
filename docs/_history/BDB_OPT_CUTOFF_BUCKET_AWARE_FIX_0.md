# BDB-OPT-CUTOFF-BUCKET-AWARE-FIX-0

## Causa raiz

El solver podia devolver pesos que cumplian los bucket bounds activos, pero el
postprocesado aplicaba `clean_weights(cutoff=0.02)`. Si ese corte eliminaba un
peso pequeno que aportaba al minimo de un bucket, la renormalizacion posterior
podia dejar la exposicion por debajo del minimo. La validacion final detectaba
`BUCKET_MIN_VIOLATION`, marcaba `is_compliant=false` y el resultado quedaba no
aplicable.

## Test anadido

Archivo:

- `functions_python/tests/test_optimizer_postprocess_bucket_aware.py`

El test sintetico cubre:

- pesos pre-clean con equity = 40.05%, cumpliendo `equity.min = 40%`;
- `clean_weights(cutoff=0.02)` elimina `EQ_SMALL = 1.90%`;
- tras normalizar, equity cae por debajo del minimo y aparece
  `BUCKET_MIN_VIOLATION`;
- con el fix, `EQ_SMALL` se preserva y el resultado final vuelve a cumplir el
  bucket.

Antes del fix, el test fallaba porque `EQ_SMALL` terminaba en `0.0` en lugar de
`0.019`.

## Revision EXTRA HIGH

Resultado: APROBADO CON OBSERVACIONES.

Se amplio la cobertura antes del commit final con tests adicionales en
`functions_python/tests/test_optimizer_postprocess_bucket_aware.py`:

- `test_postprocess_skips_when_raw_already_violates_min`
  - Verifica que si el raw pre-clean ya incumple `equity.min`, el helper no
    restaura pesos eliminados por cutoff y no maquilla compliance.
- `test_postprocess_noop_when_cutoff_zero`
  - Verifica que con `cutoff=0` el resultado coincide con los pesos limpiados.
- `test_postprocess_noop_when_no_removed_by_cutoff`
  - Verifica que si no hay activos eliminados por cutoff, el postprocesado queda
    como no-op.
- `test_postprocess_does_not_create_bucket_max_violation`
  - Verifica que restaurar el peso necesario para cumplir un minimo no produce
    violacion de maximo en equity ni bond en el caso cubierto.
- `test_status_optimal_non_compliant_when_restore_insufficient`
  - Verifica que `is_fallback=false` + `is_compliant=false` devuelve
    `optimal_non_compliant`, con `applicable=false` y `usable=false`.

## Cambio aplicado

Archivo modificado:

- `functions_python/services/portfolio/optimizer_core.py`

Cambio minimo en fase 9:

- tras `ef.clean_weights(cutoff=cutoff)`, el postprocesado revisa los minimos de
  buckets activos;
- solo actua si los pesos raw pre-clean cumplian los minimos y el clean los
  rompe;
- restaura solo pesos eliminados por cutoff que contribuyen al bucket minimo
  violado;
- no relaja bounds ni convierte violaciones reales en warnings;
- si un activo pequeno no es necesario para un minimo activo, mantiene el
  comportamiento anterior.

Tambien se aplico el ajuste simple de status:

- `is_fallback=false` + `is_compliant=false` => `optimal_non_compliant`;
- `is_fallback=true` + `is_compliant=false` => `fallback_non_compliant`.

`optimal_non_compliant` queda no aplicable porque `applicable=false` y
`usable=false`.

## Reparacion de truncado

Durante la revision posterior se reporto que
`functions_python/services/portfolio/optimizer_core.py` habia quedado truncado
dentro de `run_optimization`, con un `SyntaxError: '{' was never closed`.

En esta reparacion se comparo el cierre de `run_optimization` contra `HEAD` y
se verifico que el working tree actual conserva el final completo del dict de
`explainability`, la validacion final, el calculo de `final_status`, el return
del resultado y el bloque `except`.

No se reimplemento el fix desde cero. Se preservaron:

- el helper bucket-aware `_restore_cutoff_weights_for_bucket_mins`;
- la firma de `_postprocess_weights` con `bucket_bounds_v1=None`;
- la llamada desde `run_optimization` pasando `bucket_bounds_v1`;
- el status semantico `optimal_non_compliant`.

## Tests ejecutados

El primer intento con el `python` global (`C:\Python314\python.exe`) fallo
porque no tiene `pytest` instalado. Las ejecuciones finales se hicieron con
`functions_python/venv/Scripts` delante del `PATH`, manteniendo el formato
`python -m pytest`.

Resultados:

- `python -m py_compile functions_python/services/portfolio/optimizer_core.py`
  - PASS.
- `git diff --check`
  - PASS, con warnings de conversion LF/CRLF de Git en Windows.
- `python -m pytest tests/test_optimizer_postprocess_bucket_aware.py -q`
  - Reproduccion inicial antes del fix: fallo esperado.
  - Despues de la reparacion: `1 passed`.
  - Despues de revision EXTRA HIGH: `6 passed`.
- `python -m pytest tests/test_optimizer_p0_contracts.py tests/test_optimizer_fallback_status_contract.py tests/test_optimizer_invariants.py -q`
  - `14 passed`.
- `python -m pytest tests/test_constraints_canonical_contract.py tests/test_bucket_constraints_dedup.py -q`
  - `23 passed`.
- Opcional disponible: `python -m pytest tests/test_feasibility_precheck.py -q`
  - `20 passed`.
- Opcional no ejecutado: `tests/test_feasibility_precheck_contract.py`
  - No existe en este working tree.

## Riesgos

- `optimal_non_compliant` es un status nuevo de backend; el frontend actual lo
  sigue bloqueando por `applicable=false` / `usable=false`, pero una fase
  posterior puede actualizar tipos y mensajes si se quiere tratamiento visual
  especifico.
- La cobertura EXTRA HIGH cubre un caso de no creacion de max violation; no
  sustituye una prueba exhaustiva combinatoria de todos los buckets y bounds.
- El fix solo protege minimos de bucket cuando el raw pre-clean ya era
  compliant. Si el solver/fallback ya venia incumpliendo, la validacion final
  debe seguir marcando el resultado como no compliant.
- El fallback equal-weight no se cambia.

## Confirmacion

- Firestore writes = 0
- deploy = NO
- push = NO
- commit = NO
- CORE tocado = NO
- `suitability_engine.py` tocado = NO
