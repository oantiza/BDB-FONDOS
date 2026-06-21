# BDB-FIRESTORE-LIVE-READ-CONNECTIVITY-SMOKE-RETRY-4

Fecha de ejecucion: 2026-05-18T19:50:23.162Z

## Resumen ejecutivo

- Resultado: Firestore live read desde el proceso ejecutable de Codex sigue sin estabilizarse.
- Lectura 1 doc: FAIL / no ejecutada porque falla conectividad base desde el proceso de herramienta.
- Lectura 5 docs: FAIL / no ejecutada.
- Lectura 76 docs: FAIL / no ejecutada.
- Snapshot live retry-4 creado: NO.
- Firestore writes = 0.
- Deploy = NO. Commit = NO. Push = NO.

## Manifest validado

- Fuente: `C:\Users\oanti\Documents\BDB-FONDOS\artifacts\bdb_parser_audit\morningstar_low_risk_write_gate_manifest_0.json`.
- included_in_gate = 76.
- excluded_from_gate = 7.
- forbidden_fields_detected = false.
- requires_explicit_approval_to_write = true.
- write_executed = false.
- ISINs incluidos detectados = 76.

## Pruebas retry-4

| Prueba | Resultado | Detalle |
| --- | --- | --- |
| Terminal visible de la app | OK informado | En la terminal visible se observa `OK 404` y `NODE_OPTIONS=--dns-result-order=ipv4first`. |
| Proceso de herramienta Codex: Node fetch sin opcion | FAIL | `FAIL undefined fetch failed EACCES`. |
| Proceso de herramienta Codex: Node fetch con `NODE_OPTIONS=--dns-result-order=ipv4first` | FAIL | Sigue `FAIL undefined fetch failed EACCES`. |
| Proceso de herramienta Codex: curl.exe | FAIL | `Failed to connect to oauth2.googleapis.com port 443`. |
| Firestore 1 doc | SKIPPED | No se ejecuta porque el proceso que puede escribir artefactos no alcanza OAuth/Google APIs. |
| Firestore 5 docs | SKIPPED | Bloqueado por conectividad base. |
| Firestore 76 docs | SKIPPED | Bloqueado por conectividad base. |

## Error exacto

```text
node fetch('https://oauth2.googleapis.com')
FAIL undefined fetch failed EACCES

curl.exe -I https://oauth2.googleapis.com
curl: (7) Failed to connect to oauth2.googleapis.com port 443
```

## Diagnostico

La terminal visible de la app ya tiene conectividad, pero la herramienta de ejecucion que puede crear archivos y leer el workspace no comparte ese mismo contexto de red. No puedo escribir en la terminal visible, solo leer su salida. Por eso no se puede completar el smoke 1/5/76 desde el proceso que genera los artefactos.

No se crea `morningstar_low_risk_write_gate_snapshot_live_retry_4.json` porque no hay lectura live 76/76 desde el proceso de ejecucion de Codex.

## Siguiente accion recomendada

1. Ejecutar el script de smoke desde la terminal visible que ya devuelve `OK 404`, o reiniciar el worker/herramienta de ejecucion de Codex para que comparta ese contexto de red.
2. Mantener bloqueado cualquier write gate hasta tener `morningstar_low_risk_write_gate_snapshot_live_retry_4.json` con 76/76 documentos live.

## Seguridad

- NO se escribio Firestore.
- NO se ejecuto write gate.
- NO se llamo Gemini.
- NO se parsearon PDFs.
- NO deploy. NO commit. NO push.
- `BDB-FONDOS-CORE` no tocado.
- `funds_core_v1` no usado.
