# BDB-PARSER-HARDENING-0 - Dry-Run, ADC and Config Path Hardening

Nota BDB-PARSER-ROOT-ORG-0: la ubicacion operativa nueva es `MORNINGSTAR_PDF_PARSER/` en la raiz del proyecto. El dry-run manual usa `MORNINGSTAR_PDF_PARSER/ENTRADA/` y escribe resultados visibles en `MORNINGSTAR_PDF_PARSER/SALIDA/`.

## Objetivo

Endurecer el parser Morningstar legacy, actualmente reubicado en `scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js`, antes de volver a usarlo y sin cambiar mapping semantico.

## Confirmacion de alcance

- No se hizo deploy.
- No se hizo push.
- No se hizo commit.
- No se hicieron writes a Firestore.
- No se llamo Gemini real durante las pruebas.
- No se tocaron credenciales.
- No se toco `C:\Users\oanti\Documents\BDB-FONDOS-CORE`.
- En BDB-PARSER-HARDENING-0 no se movio el parser. En BDB-PARSER-ORG-1 se reubico a `scripts/MORNINGSTAR_PDF_PARSER/` y `scripts/maintenance/cargador_lotes_v_2.js` quedo como wrapper compatible.
- No se corrigieron mappings semanticos pendientes como oro/mineria/recursos naturales.

## Cambios aplicados

### Dry-run default

El parser queda en dry-run si no se pasan flags de escritura.

Salida esperada:

```bash
DRY_RUN_ONLY: Firestore writes are disabled. Use --write --confirm-write for future writes.
```

En dry-run:

- No se crea `bulkWriter`.
- No se llama `writer.set`.
- No se llama `batch.commit`.
- No se mueve el PDF de entrada a carpetas OK/REVIEW/ERROR.
- Se genera artifact de dry-run.

### Write gates

Para cualquier escritura futura se requieren ambos flags:

```bash
--write --confirm-write
```

`--write` sin `--confirm-write` aborta con:

```text
WRITE_BLOCKED: --write requires --confirm-write.
```

`--dry-run` y `--write` juntos tambien bloquean.

### Credenciales ADC

Se elimino la dependencia obligatoria de `serviceAccountKey.json`.

El init de Firebase Admin ahora es lazy y usa:

- Application Default Credentials.
- `GOOGLE_APPLICATION_CREDENTIALS` si esta configurado.
- `FIREBASE_PROJECT_ID`, `GCLOUD_PROJECT` o `GOOGLE_CLOUD_PROJECT` si existen.

El parser ya no exige una clave local JSON para poder cargarse, mostrar ayuda o ejecutar tests.

### CSV/config path hardening

Se agrego `resolveConfigPath()`.

Orden de busqueda:

1. `--config-dir`
2. `data/work/`
3. `functions_python/scripts/`
4. `scripts/MORNINGSTAR_PDF_PARSER/config/`
5. `scripts/maintenance/`

CSVs requeridos:

- `subcategory_sectors_mapping.csv`
- `subcategory_tokens_mapping.csv`

Si falta un CSV requerido, el parser aborta con error claro e incluye las rutas buscadas. No se oculta el fallo.

### Artifact dry-run

En dry-run se genera:

`artifacts/bdb_parser_audit/parser_dry_run_latest.json`

Incluye:

- `timestamp`
- `dry_run=true`
- `would_write=false`
- `input_files`
- `isins_processed`
- `proposed_payload_by_isin`
- `fields_to_update`
- `fields_preserved`
- `warnings`
- `config_paths_resolved`

### Proteccion de manual fields

Se agrego guard:

```js
assertNoManualFields(payload)
```

El payload propuesto no debe incluir:

- `manual`
- `manual.costs`
- `manual.costs.retrocession`

Tambien se retiro la logica anterior que podia proponer `manual.costs.retrocession = 0` para documentos nuevos o sin retrocesion.

### Overwrite safety

Para escritura futura:

- Se conserva `writer.set(ref, doc, { merge: true })`.
- El writer solo se crea si `--write --confirm-write`.
- El payload ya no incluye `FieldValue.delete()` para limpiar campos legacy.
- No se hace set completo destructivo.
- No se borran campos ausentes del PDF.

## CLI documentada

```bash
node scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js --help
```

Opciones relevantes:

- `--dry-run`
- `--write`
- `--confirm-write`
- `--output-dir`
- `--limit`
- `--only-isin`
- `--config-dir`

## Como ejecutar dry-run

Ejemplo:

```bash
node scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js --dry-run --dir data/input_pdfs --limit 5
```

Con carpeta config explicita:

```bash
node scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js --dry-run --dir data/input_pdfs --config-dir data/work
```

Para un ISIN:

```bash
node scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js --dry-run --dir data/input_pdfs --only-isin LU1234567890
```

## Tests creados

Test:

`tests/parser_hardening/test_cargador_lotes_v2_hardening.js`

Cobertura:

- Sin flags => dry-run.
- `--write` sin `--confirm-write` => abort.
- `--write --confirm-write` habilita write mode en opciones.
- Dry-run con carpeta vacia no inicializa Firebase Admin ni crea writer.
- Artifact dry-run contiene `would_write=false`.
- `manual.*` bloqueado por guard.
- Import del parser no requiere `serviceAccountKey.json`.
- `resolveConfigPath` encuentra CSV en `data/work`.
- `resolveConfigPath` puede encontrar CSV en `functions_python/scripts`.
- CSV faltante aborta con error claro.

Validaciones ejecutadas:

```bash
node --check scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js
node --check scripts/maintenance/cargador_lotes_v_2.js
node tests/parser_hardening/test_cargador_lotes_v2_hardening.js
node scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js --write
node scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js --dir <empty-temp-dir> --limit 0
node scripts/maintenance/cargador_lotes_v_2.js --dir <empty-temp-dir> --limit 0
```

Resultados:

- Sintaxis: PASS.
- Tests hardening: PASS.
- Write sin confirmacion: bloqueado.
- Dry-run default: genera `parser_dry_run_latest.json`.

## Pendiente

- BDB-PARSER-ORG-1 ya movio el parser a `scripts/MORNINGSTAR_PDF_PARSER/` y mantuvo wrapper en `scripts/maintenance/cargador_lotes_v_2.js`.
- No se separo el monolito en modulos.
- No se agregaron tests de PDF/Gemini reales.
- No se cambio la semantica de mapping.
- No se corrigio asset_mix 0-1 porque el runtime actual lo soporta.
- No se agrego `economic_exposure`; sigue siendo responsabilidad de `populate_taxonomy_v2.py`.
- No se implemento write futuro activo mas alla de gates.

## Estado final

`PARSER_HARDENED_READY_FOR_DRY_RUN`

El parser queda listo para ejecuciones dry-run controladas, con artifact obligatorio y sin dependencia de `serviceAccountKey.json`.
