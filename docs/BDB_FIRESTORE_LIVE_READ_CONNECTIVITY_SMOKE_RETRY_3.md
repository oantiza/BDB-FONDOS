# BDB-FIRESTORE-LIVE-READ-CONNECTIVITY-SMOKE-RETRY-3

Fecha de ejecucion: 2026-05-18T19:46:24.102Z

## Resumen ejecutivo

- Resultado: Firestore live read desde el proceso Codex/Node sigue sin estabilizarse.
- Prueba base Node fetch a `oauth2.googleapis.com`: FAIL.
- Lectura 1 doc: FAIL / no ejecutada porque falla OAuth/Google APIs desde Node.
- Lectura 5 docs: FAIL / no ejecutada.
- Lectura 76 docs: FAIL / no ejecutada.
- Snapshot live retry-3 creado: NO.
- Firestore writes = 0.
- Deploy = NO. Commit = NO. Push = NO.

## Manifest validado

- Fuente: `C:\Users\oanti\Documents\BDB-FONDOS\artifacts\bdb_parser_audit\morningstar_low_risk_write_gate_manifest_0.json`.
- included_in_gate = 76.
- excluded_from_gate = 7.
- forbidden_fields_detected = false.
- requires_explicit_approval_to_write = true.
- write_executed = false.

## Pruebas retry-3

| Prueba | Resultado | Detalle |
| --- | --- | --- |
| Directorio | OK | Ejecutado en `C:\Users\oanti\Documents\BDB-FONDOS`, no en Core. |
| Lanzamiento paralelo inicial | FAIL tecnico | Windows devolvio `CreateProcessWithLogonW failed: 1056`; se repitio secuencialmente. |
| Node fetch base secuencial | FAIL | `FAIL undefined fetch failed EACCES`. |
| Firestore 1 doc | SKIPPED | Bloqueado antes de OAuth/token. |
| Firestore 5 docs | SKIPPED | Bloqueado antes de OAuth/token. |
| Firestore 76 docs | SKIPPED | Bloqueado antes de OAuth/token. |

## Error exacto

```text
node fetch('https://oauth2.googleapis.com')
FAIL undefined fetch failed EACCES
```

## Diagnostico

La sesion de Codex/Node continua con bloqueo de salida HTTPS. No hay lectura live de Firestore, por lo que no se crea `morningstar_low_risk_write_gate_snapshot_live_retry_3.json`.

## Seguridad

- NO se escribio Firestore.
- NO se ejecuto write gate.
- NO se llamo Gemini.
- NO se parsearon PDFs.
- NO deploy. NO commit. NO push.
- `BDB-FONDOS-CORE` no tocado.
- `funds_core_v1` no usado.
