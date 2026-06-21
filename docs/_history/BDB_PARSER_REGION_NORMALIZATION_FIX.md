# BDB-PARSER-REGION-0 - Region Normalization ex-Japan Fix

## Fecha

2026-05-07

## Ruta validada

`C:\Users\oanti\Documents\BDB-FONDOS`

`C:\Users\oanti\Documents\BDB-FONDOS-CORE` no fue leido, tocado ni modificado.

## Bug R14 detectado

BDB-PARSER-DRYRUN-2 detecto que una categoria Morningstar como:

`RV Asia (ex-Japon)`

se clasificaba como:

`region_primary = Japon`

Esto es incorrecto porque `ex-Japon` significa que Japon esta excluido.

## Causa

`derivePrimaryRegion()` hacia matching simple de tokens:

- si encontraba `JAPAN` / `JAPON`, devolvia Japon.
- ese check ocurria antes de evaluar Asia.
- no habia una regla de negacion contextual para patrones `ex-X`.

Por eso `Asia ex-Japon` activaba el token `JAPON` aunque el contexto lo negaba.

## Regla implementada

Se anadio una deteccion explicita de exclusion de Japon antes del match simple:

- `ex-Japan`
- `ex Japan`
- `ex-Japon`
- `ex Japon`
- `excluding Japan`
- `excluding Japon`
- `sin Japon`

Cuando el texto contiene Asia y una exclusion de Japon, `derivePrimaryRegion()` devuelve:

`Asia`

No se introdujo un enum nuevo para evitar romper consumidores que ya esperan regiones primarias existentes como `Asia`, `Europa`, `USA`, `Japon`, `Emergentes` o `Global`.

## Casos cubiertos

| Entrada | Resultado |
|---------|-----------|
| `Asia ex-Japon` | `Asia` |
| `Asia ex Japan` | `Asia` |
| `Asia Pacific ex Japan` | `Asia` |
| `RV Asia (ex-Japon)` | `Asia` |
| `Japan Equity` | Japon |
| `Japon` | Japon |
| `Asia` | `Asia` |
| `Asia Pacific` | `Asia` |

## Tests anadidos

`tests/parser_hardening/test_region_normalization_ex_japan.js`

Cobertura:

- Asia ex-Japon no devuelve Japon.
- Asia ex Japan no devuelve Japan.
- Asia Pacific ex Japan no devuelve Japan.
- RV Asia (ex-Japon) no devuelve Japon.
- Japan Equity sigue devolviendo Japon.
- Japon sigue devolviendo Japon.
- Asia simple sigue devolviendo Asia.
- Asia Pacific simple sigue devolviendo Asia.

## Validaciones ejecutadas

```bash
node --check scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js
node tests/parser_hardening/test_cargador_lotes_v2_hardening.js
node tests/parser_hardening/test_region_normalization_ex_japan.js
```

Resultados:

| Validacion | Resultado |
|------------|-----------|
| `node --check` parser | PASS |
| hardening tests | PASS |
| region ex-Japan tests | PASS |

## Confirmaciones de seguridad

- No se ejecuto parser con PDFs.
- No se llamo Gemini real.
- No se hicieron writes a Firestore.
- No se uso `--write`.
- No se uso `--confirm-write`.
- No se hizo deploy.
- No se hizo push.
- No se hizo commit.
- No se tocaron credenciales.
- No se toco BDB-FONDOS-CORE.
- No se cambio `asset_type`.
- No se cambio `asset_mix`.
- No se tocaron retrocesiones.
- No se movieron archivos.

## Estado final

`REGION_FIX_READY`
