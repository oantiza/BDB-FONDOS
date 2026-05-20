# BDB Morningstar PDFs Refresh Gemma4 Preaudit 0

Fecha de ejecucion: 2026-05-17  
Tarea: `BDB-MORNINGSTAR-PDFS-REFRESH-GEMMA4-PREAUDIT-0`  
Proyecto: `C:\Users\oanti\Documents\BDB-FONDOS`  
Carpeta PDFs: `C:\Users\oanti\Documents\BDB-FONDOS\MORNINGSTAR_PDF_PARSER\ENTRADA`

## Estado de seguridad

- Proyecto confirmado: `BDB-FONDOS`.
- Proyecto no tocado: `BDB-FONDOS-CORE`.
- Coleccion objetivo conocida para fase futura: `funds_v3`.
- Coleccion prohibida/no usada: `funds_core_v1`.
- Firestore writes: `0`.
- Gemini API calls: `0`.
- External API calls: `0`.
- PDFs movidos: `0`.
- Deploy: `NO`.
- Commit: `NO`.
- Push: `NO`.
- Campos `manual.*`: no tocados.
- `manual.costs.retrocession`: no tocado.
- Retrocesiones: no tocadas.

## Git inicial

`git status --short` inicial mostraba cambios previos no relacionados:

```text
 M .gitignore
?? .antigravityrc.txt
?? BDB_FUNDS_PERFECT_DB_TEMPLATE_20260516.xlsx
?? artifacts/browser_session/
?? artifacts/exports/
?? artifacts/morningstar_captures/
?? artifacts/raw_data/
?? artifacts/scripts/
?? docs/BDB_MORNINGSTAR_CHROME_FULLPAGE_AUTOMATION_0.md
?? docs/BDB_MORNINGSTAR_MASSIVE_RUN_REPORT.md
?? docs/BDB_MORNINGSTAR_WEB_ENRICHMENT_PILOT_BATCH_0.md
?? docs/BDB_MORNINGSTAR_WEB_ENRICHMENT_PILOT_ES0118537002_0.md
?? export_funds_excel.py
?? generate_detailed_excel.py
?? scratch/
?? temp_popup.html
?? tools/
```

## Ollama

- Ollama version detectada por servicio local: `0.24.0`.
- CLI `ollama` no estaba disponible en `PATH` de esta sesion; la ruta local existia, pero la ejecucion directa devolvio acceso denegado por el entorno.
- Servicio local Ollama detectado en `http://127.0.0.1:11434`.
- Modelo detectado: `gemma4:e4b`.
- Prueba local equivalente a `Responde solo OK`: correcta, respuesta `OK`.
- Modelos adicionales descargados: `0`.

## Auditoria del parser actual

Parser revisado en lectura: `MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js`

- Modelo por defecto: `gemini-2.5-flash`.
- Dry-run por defecto: si.
- Escritura Firestore: solo con `--write --confirm-write`.
- Coleccion de escritura futura: `funds_v3`.
- `manual.*` protegido por guard `assertNoManualFields`.
- `manual.costs.retrocession` preservado en artefactos dry-run.
- Retrocesiones no se extraen en el prompt Gemini.
- El parser genera `ms`, `derived`, `classification_v2`, `portfolio_exposure_v2` y `quality`.
- Puede generar `portfolio_exposure_v2.credit` y `portfolio_exposure_v2.duration` si hay datos de renta fija.
- No se ha visto generacion de `portfolio_exposure_v2.economic_exposure`; debe preservarse si existe en destino.
- El parser puede mover PDFs tras procesar si no se usa `--no-move-files`.

Campos principales de `ms`:

- `report_date`, `category_morningstar`, `rating_stars`, `medalist_rating`, `sustainability_rating`.
- `portfolio.as_of`, `portfolio.asset_allocation`.
- `regions.macro`, `regions.detail`, `sectors`.
- `equity_style`, `fixed_income`.
- `holdings_top10`, `holdings_stats`.
- `costs.management_fee`.
- `objective`.

Campos principales de `derived`:

- `asset_class`, `asset_subtype`, `primary_region`, `subcategories`.
- `top_sector`, `top_sector_weight`.
- `is_sector_fund`, `is_thematic`, `is_index_like`.
- `confidence`, `portfolio_exposure`, `style_bias`.

Campos sensibles/prohibidos:

- `manual`, `manual.*`, `manual.costs`, `manual.costs.retrocession`.
- Retrocesiones, comision de entrada, comision de salida.

Comando seguro recomendado para fase posterior Gemini dry-run:

```powershell
node MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js `
  --dir MORNINGSTAR_PDF_PARSER/ENTRADA `
  --dry-run `
  --no-move-files `
  --model gemini-2.5-flash
```

## Herramienta creada

- `tools/morningstar_preaudit/preaudit_morningstar_pdfs_gemma4.py`
- `tools/morningstar_preaudit/README.md`
- `artifacts/bdb_parser_audit/morningstar_pdfs_refresh_gemma4_preaudit_0.json`

La herramienta usa extraccion local. En esta maquina no estaban disponibles `pypdf`, `pymupdf` ni `pdfplumber`, asi que el piloto uso el fallback local `node_pdf_parse` con `pdf-parse` ya presente en el proyecto. No se instalaron paquetes.

## Piloto Gemma4

Comando ejecutado:

```powershell
python tools/morningstar_preaudit/preaudit_morningstar_pdfs_gemma4.py --input-dir MORNINGSTAR_PDF_PARSER/ENTRADA --output-json artifacts/bdb_parser_audit/morningstar_pdfs_refresh_gemma4_preaudit_0.json --limit 5 --model gemma4:e4b
```

Resumen:

- PDFs inventariados: `649`.
- PDFs procesados en piloto: `5`.
- JSON valido: `SI`.
- Errores: `0`.
- HIGH_VALUE_REFRESH: `5`.
- SAFE_REFRESH_LOW_RISK: `0`.
- REVIEW_BEFORE_WRITE: `0`.
- DO_NOT_PARSE_NOW: `0`.

Resultados por PDF:

| ISIN | PDF | Fecha informe | Fecha cartera | Recomendacion | Score |
|---|---|---:|---:|---|---:|
| BE0943877671 | DPAM B - Bonds Eur Government B Cap | 2026-05-17 | 2026-03-31 | HIGH_VALUE_REFRESH | 15 |
| BE0946564383 | DPAM B - Equities NewGems Sustainable B Cap | 2026-05-17 | 2026-04-30 | HIGH_VALUE_REFRESH | 12 |
| BE0947853660 | DPAM B - Equities US Dividend Sustainable B EUR Cap | 2026-05-17 | 2026-04-30 | HIGH_VALUE_REFRESH | 15 |
| BE6213829094 | DPAM B - Real Estate Europe Dividend Sustainable B Cap | 2026-05-17 | 2026-04-30 | HIGH_VALUE_REFRESH | 12 |
| DE0005318406 | DWS ESG Stiftungsfonds LD | 2026-05-17 | 2026-03-31 | HIGH_VALUE_REFRESH | 15 |

## Calidad del resultado

- ISIN: detectado correctamente en los 5 PDFs piloto.
- Fecha de informe: detectada en los 5 PDFs.
- Fecha de cartera: detectada en los 5 PDFs tras normalizar abreviaturas de meses.
- Secciones utiles: detectadas por combinacion de texto local y Gemma4.
- JSON estructurado: valido.
- Categoria Morningstar exacta: limitada en este piloto porque la extraccion de tablas compacta cabeceras y valores; el script descarta valores corruptos como `�` en vez de aceptarlos.

## Limitaciones

- No se comparo contra Firestore ni contra `funds_v3`.
- No se verifico existencia previa del ISIN en base de datos.
- Gemma4 se uso como preclasificador barato, no como parser definitivo.
- No se uso vision/OCR. El texto fue suficiente para el piloto.
- Las categorias Morningstar exactas pueden requerir Gemini/parser oficial o una mejora especifica de extraccion de tablas.

## Recomendacion

Escalar Gemma4 a todo el bloque local antes de cualquier Gemini:

```powershell
python tools/morningstar_preaudit/preaudit_morningstar_pdfs_gemma4.py `
  --input-dir MORNINGSTAR_PDF_PARSER/ENTRADA `
  --output-json artifacts/bdb_parser_audit/morningstar_pdfs_refresh_gemma4_preaudit_0.json `
  --limit 0 `
  --model gemma4:e4b
```

Estrategia posterior:

- Enviar a Gemini Flash dry-run solo `HIGH_VALUE_REFRESH` y `SAFE_REFRESH_LOW_RISK`.
- Mantener `REVIEW_BEFORE_WRITE` para aprobacion humana antes de Gemini.
- No enviar `DO_NOT_PARSE_NOW`.
- Usar Pro solo para rescate puntual de PDFs con alto valor y fallo claro en Flash; no usar Pro masivo sin autorizacion explicita.

Siguiente paso recomendado: ejecutar Gemma4 sobre todo el bloque (`--limit 0`), revisar el ranking completo y despues decidir el subset para Gemini Flash dry-run con `--no-move-files`.
