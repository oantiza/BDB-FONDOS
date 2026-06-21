# BDB-GEMINI-PRO-CONNECTIVITY-SMOKE-0

## Resumen

Se ejecuto un smoke test minimo contra Gemini sin ejecutar el parser masivo, sin mover PDFs y sin escribir en Firestore.

Resultado:

- Flash minimal: OK
- Pro minimal: OK
- `gemini-2.5-pro` esta disponible para una llamada minima de texto
- El error de los 32 PDFs de rescate fue uniforme: `fetch failed`
- Causa probable: fallo transitorio de transporte/conectividad durante la ejecucion Pro con PDFs, no modelo inexistente ni credencial invalida

## Estado inicial

Directorio confirmado:

`C:\Users\oanti\Documents\BDB-FONDOS`

No se trabajo en `BDB-FONDOS-CORE`.

Artefactos confirmados:

- `MORNINGSTAR_PDF_PARSER/SALIDA/parser_dry_run_flash_before_pro_rescue_errors_0.json`
- `MORNINGSTAR_PDF_PARSER/SALIDA/parser_dry_run_pro_rescue_errors_0.json`
- `artifacts/bdb_parser_audit/morningstar_pdfs_refresh_pro_rescue_errors_0_summary.json`

El repositorio ya tenia cambios/untracked previos. No se hizo commit.

## Smoke test Flash

Modelo probado:

`gemini-2.5-flash`

Prompt minimo:

`Responde exactamente OK`

Resultado:

- Estado: OK
- Respuesta: `OK`
- Tiempo aproximado: 728 ms

## Smoke test Pro

Modelo probado:

`gemini-2.5-pro`

Prompt minimo:

`Responde exactamente OK`

Resultado:

- Estado: OK
- Respuesta: `OK`
- Tiempo aproximado: 2694 ms

Esto confirma que el modelo `gemini-2.5-pro` esta disponible para la API usada por el SDK actual.

## Error exacto del rescate Pro

Artefacto revisado:

`MORNINGSTAR_PDF_PARSER/SALIDA/parser_dry_run_pro_rescue_errors_0.json`

Resultado del rescate:

- PDFs intentados: 32
- OK: 0
- REVIEW: 0
- ERROR: 32
- `dry_run`: true
- `would_write`: false
- movimientos de PDFs: 32 `SKIPPED`

Error unico en los 32 casos:

`[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent: fetch failed`

No se observo en el smoke test minimo:

- `EACCES`
- `ETIMEDOUT`
- `403`
- `404 model not found`
- quota/rate limit
- TLS/cert

El artefacto del parser solo conserva el mensaje `fetch failed`, sin causa interna adicional de Node/undici.

## Entorno SDK

- Node.js: `v24.15.0`
- `@google/generative-ai`: `0.24.1`
- Plataforma: `win32 x64`

## Disponibilidad del modelo Pro

No fue necesario listar modelos porque la llamada minima con `gemini-2.5-pro` respondio correctamente. Para este diagnostico, eso confirma disponibilidad practica del modelo y descarta un `404 model not found` como causa del fallo observado en el rescate.

## Causa probable

La causa mas probable es un problema transitorio de transporte/conectividad durante el run Pro con PDFs: todas las llamadas a Pro fallaron de forma uniforme con `fetch failed`, pero minutos despues una llamada minima a `gemini-2.5-pro` funciono correctamente.

No parece ser:

- clave invalida, porque Flash y Pro minimal responden OK;
- modelo inexistente, porque Pro minimal responde OK;
- regla de Firestore, porque el run estaba en dry-run y `would_write=false`;
- movimiento de PDFs, porque todos los movimientos quedaron `SKIPPED`;
- problema de seleccion de los 32 PDFs, porque el artefacto Pro intento exactamente 32.

## Siguiente accion recomendada

Repetir el rescate Pro de los mismos 32 PDFs con ruta absoluta, `--no-move-files` y `--concurrency 1`, idealmente despues de una ventana corta o tras confirmar estabilidad de red. Si vuelve a fallar con `fetch failed`, capturar la causa interna de Node/undici en un wrapper diagnostico no productivo antes de reintentar el lote completo.

No avanzar a merge ni write gate hasta que el rescate Pro produzca propuestas validas o se decida excluir formalmente esos 32 errores.

## Validacion final

- Parser masivo ejecutado: NO
- Firestore writes: 0
- PDFs movidos: 0
- Deploy: NO
- Commit: NO
- Push: NO
- `BDB-FONDOS-CORE` tocado: NO
- `funds_core_v1` usado: NO
