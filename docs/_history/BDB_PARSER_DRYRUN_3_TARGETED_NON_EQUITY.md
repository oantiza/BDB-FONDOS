# BDB-PARSER-DRYRUN-3 - Targeted Non-Equity Dry-Run

## Fecha

2026-05-07

## Ruta validada

`C:\Users\oanti\Documents\BDB-FONDOS`

`C:\Users\oanti\Documents\BDB-FONDOS-CORE` no fue leido, tocado ni modificado.

## Objetivo

Validar el parser Morningstar reubicado, endurecido y con fix regional sobre un lote pequeno y dirigido de PDFs reales no centrados en equity general.

## Criterio de seleccion

Se cruzaron PDFs existentes en `data/processed_pdfs/ok/` con JSON locales de `data/canonical/<ISIN>.json`, sin Firestore, para identificar tipos objetivo:

- renta fija pura.
- mixto / allocation.
- monetario.
- oro / metales preciosos.
- alternativo / multistrategy.

No se selecciono real estate porque el maximo del bloque era 5 PDFs y los cinco objetivos solicitados quedaron cubiertos.

## PDFs usados

| Tipo esperado | PDF | ISIN |
|---------------|-----|------|
| Renta fija pura | `ES0124880032__2026-01-28__651e9dbe.pdf` | ES0124880032 |
| Mixto / allocation | `ES0112231016__2025-12-29__5f712c30.pdf` | ES0112231016 |
| Monetario | `LU0252500524__2023-07-04__5a3e6fcc.pdf` | LU0252500524 |
| Oro / metales preciosos | `LU0171306680__2025-12-02__dd706490.pdf` | LU0171306680 |
| Alternativo / multistrategy | `ES0175437005__2025-12-02__e8b3435f.pdf` | ES0175437005 |

Input temporal:

`data/dryrun3_input/`

## Comando ejecutado

```bash
node scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js --dry-run --dir data/dryrun3_input --limit 5 --concurrency 1 --output-dir artifacts/bdb_parser_audit --backup-root artifacts/bdb_parser_audit/dryrun_3_work --processed artifacts/bdb_parser_audit/dryrun_3_work/canonical --error artifacts/bdb_parser_audit/dryrun_3_work/error --processed-pdfs artifacts/bdb_parser_audit/dryrun_3_work/processed_pdfs/ok --review-pdfs artifacts/bdb_parser_audit/dryrun_3_work/processed_pdfs/review --error-pdfs artifacts/bdb_parser_audit/dryrun_3_work/processed_pdfs/error
```

No se uso `--write`.

No se uso `--confirm-write`.

## Seguridad confirmada

- `dry_run=true`.
- `would_write=false`.
- `write_review_to_firestore=false`.
- Firestore writes: 0.
- Deploy: 0.
- Push: 0.
- Commit: 0.
- Credenciales no impresas.
- `manual.*` ausente en todos los payloads propuestos.
- `manual.costs.retrocession` ausente en todos los payloads propuestos.
- `economic_exposure` ausente en todos los payloads, coherente con el contrato actual.

## Gemini

Gemini real fue llamado para este lote pequeno.

Modelo indicado por el parser: `gemini-2.5-flash`.

Llamadas esperadas: 5, una por PDF.

El script no reporta tokens ni coste.

## Artifact generado

`artifacts/bdb_parser_audit/parser_dry_run_latest.json`

Work artifacts:

`artifacts/bdb_parser_audit/dryrun_3_work/`

## Resultado batch

| Metrica | Valor |
|---------|-------|
| PDFs procesados | 5 |
| OK | 3 |
| REVIEW | 2 |
| ERROR | 0 |
| Bloqueados | 0 |
| Con warnings | 5 |

## Tabla por PDF

| ISIN | Nombre | Tipo esperado | `asset_type` | `asset_subtype` | `region_primary` | Asset mix | Suma | Warnings / verdict |
|------|--------|---------------|--------------|-----------------|------------------|-----------|------|--------------------|
| ES0124880032 | UBS Renta Fija 0-5 B FI | Renta fija pura | `fixed_income` | `CORPORATE_BOND` | Global | eq 0, bond 0.989315, cash 0, other 0.010685 | 1.0000 | OK. Warnings: missing sectors/regions, credit_missing, rebased sum 1.0108 to 1.0. |
| ES0112231016 | Avantage Fund B FI | Mixto / allocation | `allocation` | `FLEXIBLE_ALLOCATION` | Global | eq 0.7453, bond 0.2286, cash 0.0261, other 0 | 1.0000 | REVIEW por `credit_missing`. Allocation diversificado, no cae en equity puro. |
| LU0252500524 | JPMorgan Funds - EUR Money Market VNAV Fund D (acc) - EUR | Monetario | `money_market` | `MONEY_MARKET` | Global | eq 0, bond 0, cash 1, other 0 | 1.0000 | OK. Warnings: region/sector incompletos y fi_type_inference_weak. |
| LU0171306680 | BlackRock Global Funds - World Gold Fund E2 (EUR) | Oro / metales preciosos | `equity` | `THEMATIC_EQUITY` | Global | eq 0.9293, bond 0.0003, cash 0.0344, other 0.0359 | 0.9999 | OK. Requiere seguimiento semantico: fondo oro/metales queda como thematic equity, no alternative. |
| ES0175437005 | Dunas Valor Prudente R FI | Alternativo / multistrategy | `alternative` | `UNKNOWN` | Europa | eq 0.0112, bond 0.7454, cash 0.2221, other 0.0213 | 1.0000 | REVIEW por `credit_missing`. Perfil conservador, alto bond/cash coherente con alternativo prudente. |

## Analisis por tipo

### Renta fija

ES0124880032 queda como `fixed_income` con bond 98.93%, equity 0% y other 1.07%. La exposicion es razonable para una RF corto plazo. El parser rebasa una suma raw de 1.0108 a 1.0, lo documenta mediante warning y mantiene escala final 0-1.

### Mixto / allocation

ES0112231016 queda como `allocation`, no como equity puro. El asset mix es diversificado pero agresivo: equity 74.53%, bond 22.86%, cash 2.61%. Routing queda en REVIEW por `credit_missing`, no por clasificacion.

### Monetario

LU0252500524 queda como `money_market` con cash 100% y equity 0%. La clasificacion es coherente. Los warnings de regiones/sectores incompletos son esperables para un monetario y no implican write ni corrupcion.

### Oro / metales preciosos

LU0171306680 queda como `equity` / `THEMATIC_EQUITY`, con equity 92.93%. En este PDF Morningstar no devolvio el patron problematico equity=0 / other=100; devolvio exposicion accionaria alta. Sigue pendiente una capa semantica posterior para distinguir fondos de mineras/oro/metales frente a equity tematico general si el optimizador requiere tratamiento especial.

### Alternativo / multistrategy

ES0175437005 queda como `alternative`, subtipo `UNKNOWN`, con bond 74.54%, cash 22.21%, equity 1.12%. El routing queda en REVIEW por `credit_missing`. No hay bloqueo, pero antes de writes futuros conviene decidir si alternativas conservadoras con alta RF/cash deben quedar como alternative o allocation/fixed-income-like en otra capa semantica.

### Region

No aparecio una categoria `ex-Japan` en este lote. Por tanto no se revalidó R14 con Gemini real aqui. La correccion de BDB-PARSER-REGION-0 queda cubierta por tests unitarios, y no hubo regresiones regionales evidentes en el lote.

## Warnings agregados

| Warning | Interpretacion |
|---------|----------------|
| `asset_mix_guardrail:detected_scale_0_100_divided_by_100` | Esperado: Gemini devuelve porcentajes 0-100 y el parser normaliza a 0-1. |
| `asset_mix_guardrail:asset_mix_rebased_to_sum_1` | En RF, suma raw ligeramente por encima de 1 tras normalizar; parser reescala a 1.0. |
| `asset_mix_guardrail:mixed_scale_signal_detected` | En oro/metales, componente minimo pequeno junto a maximo alto; el parser normaliza y suma final queda correcta. |
| `credit_missing` | Genera REVIEW en allocation y alternative; no produjo ERROR. |
| `missing_sectors` / `missing_regions` / `region_incomplete` | Esperable en RF/monetario; afecta reporting granular, no asset_mix. |
| `fi_type_inference_weak` / `fi_missing_credit_data` / `fi_missing_duration_data` | Señales de baja disponibilidad de datos RF. |

## Escalas

Todos los `portfolio_exposure_v2.asset_mix` quedaron en escala 0-1.

Suma final por fondo:

- ES0124880032: 1.0000
- ES0112231016: 1.0000
- LU0252500524: 1.0000
- LU0171306680: 0.9999
- ES0175437005: 1.0000

## Pendientes

- Revisar politica de `credit_missing` para fondos allocation/alternative antes de cualquier write futuro.
- Profundizar en oro/mineria/recursos naturales con casos donde Morningstar devuelva `equity=0 / other=100`, si existen.
- Validar un lote mediano con mas RF y monetarios para medir frecuencia de `missing_regions`/`missing_sectors`.

## Limpieza

La carpeta temporal `data/dryrun3_input/` debe eliminarse al cierre del bloque porque solo contiene copias de PDFs ya existentes.

## Decision

`PARSER_TARGETED_BATCH_OK_WITH_WARNINGS`

El parser queda apto para dry-run de lote mediano, manteniendo revision manual de REVIEW/warnings antes de cualquier write futuro.
