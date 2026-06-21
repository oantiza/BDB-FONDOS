# BDB-RETRO-IMPORT-0 - Retrocession Reload Dry-Run Plan

## Objetivo

Preparar una recarga segura de `manual.costs.retrocession` en `funds_v3` desde un CSV o Excel actualizado, sin escribir en Firestore por defecto y sin conversiones automaticas de escala.

## Confirmacion de seguridad

- Proyecto validado: `C:\Users\oanti\Documents\BDB-FONDOS`.
- No se hizo deploy.
- No se hizo push.
- No se hizo commit.
- No se hizo write a Firestore.
- No se tocaron credenciales.
- No se toco `C:\Users\oanti\Documents\BDB-FONDOS-CORE`.
- No se modificaron datos reales.

## Canon definitivo

La retrocesion se guarda y se compara como porcentaje directo en puntos porcentuales:

- `1.41` significa `1.41%`.
- `0.80` significa `0.80%`.
- `0.0155` significa `0.0155%`.

Regla critica: nunca multiplicar por 100, nunca dividir por 100 y nunca convertir por heuristica de tamano.

## Formato de entrada

Columnas minimas:

- `ISIN`
- `retrocession_percent`

Columnas recomendadas:

- `ISIN`
- `retrocession_percent`
- `source`
- `as_of_date`
- `notes`

Ejemplo CSV con `;`:

```csv
ISIN;retrocession_percent;source;as_of_date;notes
LU1234567890;1.41;bank;2026-05-07;
LU0987654321;0.0155;bank;2026-05-07;
LU1111111111;0.80;bank;2026-05-07;
```

## Normalizador canonico

Funcion creada: `retrocessionPercentPoints(value)` en `scripts/maintenance/bdb_retrocession_reload_dry_run.js`.

Reglas:

- `null`, `undefined` o vacio -> `MISSING`.
- Texto con coma decimal -> decimal espanol.
- Texto con punto decimal -> decimal estandar.
- Texto con `%` -> se quita `%`, sin dividir por 100.
- Numero `>= 0` -> se usa tal cual.
- Numero `< 0` -> `INVALID`.
- Numero `> 5` -> `HIGH_REVIEW`, no bloqueo automatico.

Ejemplos cubiertos por tests:

- `"1,41%" -> 1.41`
- `"1.41" -> 1.41`
- `"0,0155%" -> 0.0155`
- `"0.0155" -> 0.0155`
- `"0,80" -> 0.80`
- `"0.80%" -> 0.80`
- `"0.0141" -> 0.0141`, no `1.41`

## Script dry-run

Script creado:

`scripts/maintenance/bdb_retrocession_reload_dry_run.js`

Uso:

```bash
node scripts/maintenance/bdb_retrocession_reload_dry_run.js --input path/to/retrocesiones.csv
```

Opciones:

```bash
--input <path>           CSV/XLSX requerido
--delimiter <auto|;|,>   CSV delimiter, por defecto auto
--encoding <utf8|latin1> CSV encoding, por defecto utf8
--output-dir <path>      por defecto artifacts/bdb_data_audit
--project <id>           Firebase project id opcional
--collection <name>      por defecto funds_v3
```

El script:

- Lee el archivo fuente.
- Normaliza cabeceras.
- Valida ISIN.
- Lee `funds_v3` en modo read-only.
- Compara `manual.costs.retrocession` actual vs nuevo valor canonico.
- Rechaza `--apply` y `--write`.
- No contiene `batch`, `bulkWriter`, `set`, `update` ni `commit` de Firestore.
- Genera artifacts JSON/CSV.

Soporte Excel:

- Si existe el paquete npm `xlsx`, lo usa.
- Si no existe, usa el `openpyxl` del entorno Python local de `functions_python/venv`.
- Si ambos faltan, el script bloquea con error explicito antes de leer Firestore.

## Clasificacion de filas

Estados posibles:

- `UNCHANGED`: nuevo valor igual al actual.
- `UPDATE_CONFIRMED`: cambio determinista sin warning.
- `NEW_VALUE_MISSING_BEFORE`: valor nuevo valido y Firestore no tenia retrocesion.
- `SOURCE_VALUE_MISSING`: fuente vacia.
- `SOURCE_VALUE_INVALID`: fuente invalida o ISIN invalido.
- `ISIN_NOT_FOUND`: ISIN no existe en `funds_v3`.
- `DUPLICATE_ISIN_IN_SOURCE`: el ISIN aparece mas de una vez en el archivo fuente.
- `LARGE_CHANGE_REVIEW`: cambio grande que requiere revision.
- `HIGH_VALUE_REVIEW`: nuevo valor mayor que 5 puntos porcentuales.

Acciones:

- `NO_CHANGE`
- `UPDATE_DRY_RUN`
- `REVIEW`
- `SKIP`

## Regla de large change

Se marca `review_required=true` cuando:

- Existe valor actual.
- Existe valor nuevo.
- Diferencia absoluta `>= 0.50` puntos porcentuales.

Tambien se marca cuando:

- Existe valor actual distinto de cero.
- Variacion relativa `>= 50%`.

Esto no bloquea automaticamente; exige revision humana antes de cualquier write futuro.

## Artifacts generados por el dry-run

Directorio:

`artifacts/bdb_data_audit/`

Archivos:

- `retrocession_reload_dry_run.json`
- `retrocession_reload_dry_run.csv`

Columnas CSV:

- `isin`
- `name`
- `current_retrocession`
- `new_retrocession`
- `delta`
- `action`
- `status`
- `review_required`
- `reason`
- `source`
- `as_of_date`
- `notes`

## Scripts antiguos auditados

### `scripts/maintenance/import_retrocesiones.js`

Clasificacion: `DEPRECATED_DO_NOT_USE`.

Motivos:

- Convierte `"0,80%"` a decimal dividiendo por 100.
- Compara/visualiza valores como si Firestore guardase decimal.
- Tiene `--apply` activo y usa `batch.update`.
- No respeta el canon definitivo de porcentaje directo.

### `scripts/maintenance/update_retrocessions_funds_v3.js`

Clasificacion: `DEPRECATED_DO_NOT_USE`.

Motivos:

- Usa heuristica `> 1.5` para dividir por 100.
- Puede escribir con `--apply` usando `bulkWriter`.
- Es incompatible con la regla "no convertir por tamano".
- Requiere patch antes de cualquier uso futuro.

### `functions_python/scripts/migration/check_and_import_retrocesion.py`

Clasificacion: `NEEDS_PATCH_BEFORE_USE`.

Motivos:

- El parser actual usa porcentaje directo en lo esencial.
- Puede escribir con `--import`, `--force` o `--isins`.
- Usa fallback a `serviceAccountKey.json` si existe.
- Debe bloquear writes por defecto con guardas mas fuertes antes de reutilizarse.

## Errores a evitar

- No transformar `0.0141` en `1.41`.
- No dividir `1.41` por 100.
- No multiplicar `0.0155` por 100.
- No aplicar cambios sobre duplicados.
- No sobrescribir cambios grandes sin revision humana.
- No usar scripts legacy con `--apply`, `--import` o `--force`.

## Condicion para futuro write controlado

Un bloque futuro podria implementar escritura solo si cumple todo:

- Dry-run revisado y archivado.
- Duplicados resueltos.
- `ISIN_NOT_FOUND`, `SOURCE_VALUE_INVALID` y `SOURCE_VALUE_MISSING` revisados.
- `LARGE_CHANGE_REVIEW` y `HIGH_VALUE_REVIEW` aprobados explicitamente.
- Script idempotente.
- Flag explicito de escritura, por ejemplo `--apply`.
- Segundo flag de confirmacion, por ejemplo `--confirm RETROCESSION_PERCENT_POINTS`.
- Sin conversiones de escala.
- Sin tocar campos fuera de `manual.costs.retrocession` y metadatos de auditoria aprobados.

## Tests

Test creado:

`tests/retrocession_reload/test_bdb_retrocession_reload_dry_run.js`

Cobertura:

- Decimal espanol con `%`.
- Decimal estandar.
- Valores pequenos que no deben escalarse.
- Negativos invalidos.
- Vacios missing.
- ISIN duplicado.
- ISIN no encontrado.
- Large change por delta absoluto.
- Large change por variacion relativa.
- High value review.

Comando:

```bash
node tests/retrocession_reload/test_bdb_retrocession_reload_dry_run.js
```

Resultado local: PASS.

## Recomendacion final

`RETRO_RELOAD_READY_FOR_SOURCE_FILE`

El sistema queda listo para recibir el archivo actualizado de retrocesiones y ejecutar un dry-run read-only. El siguiente paso operativo es entregar el CSV/Excel con las columnas minimas y revisar los artifacts antes de plantear cualquier write futuro.

