# BDB-PARSER-ROOT-ORG-0 - Independent Morningstar Parser Subsystem

Fecha: 2026-05-08

Proyecto validado: `C:\Users\oanti\Documents\BDB-FONDOS`

Estado: `PARSER_ROOT_ORG_READY`

## Confirmaciones de Alcance

- No se hizo deploy.
- No se hizo push.
- No se hizo commit.
- No se escribio en Firestore.
- No se uso `--write`.
- No se uso `--confirm-write`.
- No se llamo Gemini real.
- No se tocaron credenciales.
- No se modificaron retrocesiones.
- No se cambio mapping semantico ni `asset_type`.
- No se leyo ni modifico `C:\Users\oanti\Documents\BDB-FONDOS-CORE`.

## Ubicacion Anterior

- Parser: `scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js`
- Write gate lib: `scripts/MORNINGSTAR_PDF_PARSER/lib/write_gate.js`
- Write gate CLI: `scripts/MORNINGSTAR_PDF_PARSER/prepare_write_gate_dry_run.js`
- Wrapper legacy: `scripts/maintenance/cargador_lotes_v_2.js`

## Ubicacion Nueva

Carpeta raiz operativa:

`MORNINGSTAR_PDF_PARSER/`

Arbol principal:

```text
MORNINGSTAR_PDF_PARSER/
  README.md
  ENTRADA/
    README.md
    .gitkeep
  SALIDA/
    README.md
    .gitkeep
    parser_dry_run_latest.json
  bin/
    parse_dry_run.js
    prepare_write_gate_dry_run.js
  src/
    cargador_lotes_v_2.js
    lib/
      write_gate.js
  config/
    README.md
  artifacts/
    write_approval_manifest.json
    rollback_manifest.json
    post_write_verification_plan.json
    snapshot_manifest.json
    diff_manifest.json
  docs/
    DRY_RUN_GUIDE.md
    WRITE_GATE_GUIDE.md
    PARSER_POLICY.md
  tests/
    test_cargador_lotes_v2_hardening.js
    test_region_normalization_ex_japan.js
    test_parser_write_gate.js
```

## ENTRADA y SALIDA

- `MORNINGSTAR_PDF_PARSER/ENTRADA/`: carpeta visible donde el usuario deja PDFs Morningstar.
- `MORNINGSTAR_PDF_PARSER/SALIDA/`: carpeta visible donde se generan resultados del dry-run.

Se evita usar `input/` y `output/` como nombres visibles. La nomenclatura operativa queda en mayusculas: `ENTRADA` y `SALIDA`.

## Comandos Nuevos

Dry-run con defaults:

```bash
node MORNINGSTAR_PDF_PARSER/bin/parse_dry_run.js
```

Dry-run explicito:

```bash
node MORNINGSTAR_PDF_PARSER/bin/parse_dry_run.js --dry-run --input MORNINGSTAR_PDF_PARSER/ENTRADA --output-dir MORNINGSTAR_PDF_PARSER/SALIDA
```

Write gate dry-run:

```bash
node MORNINGSTAR_PDF_PARSER/bin/prepare_write_gate_dry_run.js --output-dir MORNINGSTAR_PDF_PARSER/artifacts
```

## Wrappers Mantenidos

Se mantienen wrappers legacy:

- `scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js`
- `scripts/MORNINGSTAR_PDF_PARSER/prepare_write_gate_dry_run.js`
- `scripts/maintenance/cargador_lotes_v_2.js`

Los wrappers informan de la nueva ruta y delegan sin ejecutar logica propia de parsing ni writes.

## Config

Orden de busqueda actualizado:

1. `--config-dir`
2. `MORNINGSTAR_PDF_PARSER/config`
3. `data/work`
4. `functions_python/scripts`
5. `scripts/maintenance`
6. `scripts/MORNINGSTAR_PDF_PARSER/config`

Si falta un CSV requerido, el parser aborta con error claro.

## Tests y Validaciones

Sintaxis:

```bash
node --check MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js
node --check MORNINGSTAR_PDF_PARSER/bin/parse_dry_run.js
node --check MORNINGSTAR_PDF_PARSER/bin/prepare_write_gate_dry_run.js
node --check MORNINGSTAR_PDF_PARSER/src/lib/write_gate.js
node --check scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js
node --check scripts/MORNINGSTAR_PDF_PARSER/prepare_write_gate_dry_run.js
node --check scripts/maintenance/cargador_lotes_v_2.js
```

Resultado: PASS.

Tests legacy:

```bash
node tests/parser_hardening/test_cargador_lotes_v2_hardening.js
node tests/parser_hardening/test_region_normalization_ex_japan.js
node tests/parser_write_gate/test_parser_write_gate.js
```

Resultado: PASS.

Tests dentro del subsistema raiz:

```bash
node MORNINGSTAR_PDF_PARSER/tests/test_cargador_lotes_v2_hardening.js
node MORNINGSTAR_PDF_PARSER/tests/test_region_normalization_ex_japan.js
node MORNINGSTAR_PDF_PARSER/tests/test_parser_write_gate.js
```

Resultado: PASS.

## Dry-Run Vacio

Comando explicito ejecutado:

```bash
node MORNINGSTAR_PDF_PARSER/bin/parse_dry_run.js --dry-run --input MORNINGSTAR_PDF_PARSER/ENTRADA --output-dir MORNINGSTAR_PDF_PARSER/SALIDA
```

Comando default ejecutado:

```bash
node MORNINGSTAR_PDF_PARSER/bin/parse_dry_run.js
```

Resultado:

- `ENTRADA` vacia.
- No se llamo Gemini.
- `dry_run=true`.
- `would_write=false`.
- Artifact generado: `MORNINGSTAR_PDF_PARSER/SALIDA/parser_dry_run_latest.json`.
- Proposed payload count: 0.

## Write Gate Dry-Run

Comando ejecutado:

```bash
node MORNINGSTAR_PDF_PARSER/bin/prepare_write_gate_dry_run.js --output-dir MORNINGSTAR_PDF_PARSER/artifacts
```

Resultado:

- `dry_run=true`.
- `write_executed=false`.
- `write_candidates=0`.
- `snapshots_loaded=0`.
- No se uso Firestore write.

## Busqueda Estatica de Writes

Busqueda en wrappers y bin:

- `.update(`
- `.set(`
- `.delete(`
- `batch.commit`
- `bulkWriter`

Resultado: sin coincidencias.

`--confirm-write` aparece solo como flag bloqueado/gestionado en los CLIs, no como ejecucion de write.

## Riesgos Pendientes

- El parser sigue siendo monolitico; esta reorganizacion no refactoriza su logica interna.
- `SALIDA/` y `artifacts/` pueden acumular artifacts; conviene definir limpieza/retenion antes de uso frecuente.
- El primer write real futuro debe seguir limitado a 1-3 ISINs, con snapshot, diff, approval manifest y rollback manifest.

## Decision

`PARSER_ROOT_ORG_READY`
