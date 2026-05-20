# Morningstar PDF Gemma4 Preaudit

Herramienta local para inventariar y preclasificar PDFs de Morningstar antes de decidir que subconjunto merece pasar por el parser oficial con Gemini en dry-run.

## Objetivo

- Inventariar PDFs de `MORNINGSTAR_PDF_PARSER/ENTRADA`.
- Extraer texto localmente.
- Usar Ollama local con `gemma4:e4b`.
- Emitir JSON estructurado con ISIN, nombre, fechas, secciones utiles y recomendacion.
- No escribir Firestore.
- No llamar Gemini.
- No tocar `manual.*`, `manual.costs` ni `manual.costs.retrocession`.
- No mover, borrar ni renombrar PDFs.

## Requisitos

- Ejecutar desde `C:\Users\oanti\Documents\BDB-FONDOS`.
- Ollama local activo.
- Modelo local disponible: `gemma4:e4b`.
- Python disponible.
- Para extraccion PDF se usan librerias Python locales si existen; si no, el fallback usa `pdf-parse` ya presente en el proyecto.

Comprobacion recomendada:

```powershell
ollama list
ollama run gemma4:e4b "Responde solo OK"
```

Si el binario de Ollama no esta en `PATH`, la herramienta usa el servicio local de Ollama en `http://127.0.0.1:11434`.

## Piloto limit 5

```powershell
python tools/morningstar_preaudit/preaudit_morningstar_pdfs_gemma4.py `
  --input-dir MORNINGSTAR_PDF_PARSER/ENTRADA `
  --output-json artifacts/bdb_parser_audit/morningstar_pdfs_refresh_gemma4_preaudit_0.json `
  --limit 5 `
  --model gemma4:e4b
```

## Todo el bloque

Ejecutar solo despues de validar el piloto:

```powershell
python tools/morningstar_preaudit/preaudit_morningstar_pdfs_gemma4.py `
  --input-dir MORNINGSTAR_PDF_PARSER/ENTRADA `
  --output-json artifacts/bdb_parser_audit/morningstar_pdfs_refresh_gemma4_preaudit_0.json `
  --limit 0 `
  --model gemma4:e4b
```

## Seguridad

La herramienta:

- No escribe Firestore.
- No lee `funds_v3`.
- No usa `funds_core_v1`.
- No llama Gemini.
- No usa APIs externas.
- No mueve PDFs.
- No modifica el parser productivo.
- No escribe `manual.*`.
- No toca retrocesiones.

Contadores esperados en el JSON:

- `external_api_calls`: `0`
- `gemini_api_calls`: `0`
- `firestore_writes`: `0`
- `pdfs_moved`: `0`

## Interpretacion

- `HIGH_VALUE_REFRESH`: PDF con buen valor de actualizacion y compatibilidad probable. Candidato a Gemini Flash en dry-run.
- `SAFE_REFRESH_LOW_RISK`: PDF util y con riesgo bajo. Candidato a Gemini Flash en dry-run.
- `REVIEW_BEFORE_WRITE`: Puede aportar valor, pero requiere revision humana antes de enviarlo al parser oficial o antes de cualquier escritura futura.
- `DO_NOT_PARSE_NOW`: No conviene parsearlo ahora por bajo valor, falta de ISIN, lectura fallida o compatibilidad dudosa.

## Flags utiles

- `--limit`: por defecto procesa 5 PDFs. En este script, `--limit 0` significa sin limite y procesa todo el bloque.
- `--model`: por defecto `gemma4:e4b`.
- `--timeout`: timeout por PDF/modelo.
- `--max-chars`: maximo texto enviado a Ollama.
- `--dry-run`: no llama Ollama; usa solo heuristicas locales.
- `--text-only`: deja constancia de modo texto. La herramienta no usa vision por defecto.
