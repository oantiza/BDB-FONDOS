# BDB-PARSER-ORG-1 - Morningstar PDF Parser Relocation

Nota BDB-PARSER-ROOT-ORG-0: la ubicacion operativa nueva es `MORNINGSTAR_PDF_PARSER/` en la raiz del proyecto. Las carpetas visibles de uso manual son `MORNINGSTAR_PDF_PARSER/ENTRADA/` y `MORNINGSTAR_PDF_PARSER/SALIDA/`; no se usan `input/` ni `output/` como carpetas visibles.

## Fecha

2026-05-07

## Proyecto validado

`C:\Users\oanti\Documents\BDB-FONDOS`

`C:\Users\oanti\Documents\BDB-FONDOS-CORE` no fue leido, tocado ni modificado.

## Objetivo

Reubicar el parser Morningstar PDF principal en una carpeta dedicada, visible y en mayusculas, sin cambiar comportamiento funcional y conservando los gates de seguridad de BDB-PARSER-HARDENING-0.

## Ubicacion anterior

`scripts/maintenance/cargador_lotes_v_2.js`

## Ubicacion nueva

`scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js`

La ruta antigua queda como wrapper compatible:

`scripts/maintenance/cargador_lotes_v_2.js`

## Motivo

El parser es una pieza critica del flujo PDF Morningstar -> Gemini -> JSON/artifact -> Firestore `funds_v3`. Estaba mezclado con scripts heterogeneos de mantenimiento, lo que aumentaba el riesgo de confusion y ejecucion accidental. La nueva carpeta hace visible que se trata del parser critico de PDFs Morningstar.

## Alcance aplicado

- Movimiento mecanico del parser principal.
- Wrapper compatible en la ruta antigua.
- Preservacion de todos los argumentos CLI.
- Ajuste minimo de `resolveConfigPath()` para incluir `scripts/MORNINGSTAR_PDF_PARSER/config/`.
- Actualizacion de tests de hardening para cubrir ruta nueva y wrapper antiguo.
- Actualizacion documental de rutas.
- README operativo en la nueva carpeta.

No hubo refactor funcional del parser.

## Seguridad confirmada

- No se hizo deploy.
- No se hizo push.
- No se hizo commit.
- No se hicieron writes a Firestore.
- No se llamo Gemini real.
- No se tocaron credenciales.
- No se toco BDB-FONDOS-CORE.
- No se cambio mapping semantico.
- No se corrigieron casos oro/mineria/recursos naturales en este bloque.

## Como ejecutar dry-run desde la nueva ruta

```bash
node scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js --dry-run --dir data/input_pdfs --output-dir artifacts/bdb_parser_audit
```

Con config explicita:

```bash
node scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js --dry-run --dir data/input_pdfs --config-dir data/work --output-dir artifacts/bdb_parser_audit
```

## Wrapper antiguo

`scripts/maintenance/cargador_lotes_v_2.js` informa que el parser real vive en `scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js` y delega al archivo reubicado con los argumentos originales.

El wrapper:

- No escribe por si mismo.
- No llama Gemini por si mismo.
- No inicializa Firestore por si mismo.
- Mantiene compatibilidad con ejecuciones manuales antiguas.

## Referencias legacy

La busqueda local encontro referencias historicas a `scripts/maintenance/cargador_lotes_v_2.js` en informes antiguos y un script de auditoria dry-run. Esas referencias quedan cubiertas por el wrapper de compatibilidad. Las docs operativas de hardening y auditoria Morningstar fueron actualizadas para indicar la ruta nueva.

## Tests y validaciones

Validaciones ejecutadas:

```bash
node --check scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js
node --check scripts/maintenance/cargador_lotes_v_2.js
node tests/parser_hardening/test_cargador_lotes_v2_hardening.js
node scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js --dry-run --dir <empty-temp-dir> --output-dir artifacts/bdb_parser_audit
node scripts/maintenance/cargador_lotes_v_2.js --dry-run --dir <empty-temp-dir> --output-dir artifacts/bdb_parser_audit
```

Los dry-runs con carpeta vacia deben generar `artifacts/bdb_parser_audit/parser_dry_run_latest.json` con:

- `dry_run=true`
- `would_write=false`
- `input_files=[]`
- `config_paths_resolved`

Resultados:

| Validacion | Resultado |
|------------|-----------|
| `node --check` parser reubicado | PASS |
| `node --check` wrapper antiguo | PASS |
| `test_cargador_lotes_v2_hardening.js` | PASS |
| Dry-run parser reubicado con carpeta vacia | PASS |
| Dry-run wrapper antiguo con carpeta vacia | PASS |
| `--write` sin `--confirm-write` en parser reubicado | BLOCKED |
| `--write` sin `--confirm-write` en wrapper antiguo | BLOCKED |

## Riesgos pendientes

- El parser sigue siendo monolitico.
- No se extrajeron modulos puros.
- No se agregaron tests con PDF/Gemini real.
- La semantica oro/mineria/recursos naturales sigue pendiente.
- Los writes futuros siguen requiriendo autorizacion humana explicita y deben usarse solo con `--write --confirm-write`.

## Recomendacion final

`PARSER_RELOCATED_READY`
