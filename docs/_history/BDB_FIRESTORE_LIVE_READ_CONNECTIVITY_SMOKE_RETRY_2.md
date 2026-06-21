# BDB-FIRESTORE-LIVE-READ-CONNECTIVITY-SMOKE-RETRY-2

Fecha de ejecucion: 2026-05-18T19:36:31.850Z

## Resumen ejecutivo

- Resultado: Firestore live read desde el proceso Codex/Node sigue sin estabilizarse.
- Prueba base Node fetch a `oauth2.googleapis.com`: FAIL.
- Lectura 1 doc: FAIL / no ejecutada porque falla OAuth/Google APIs desde Node.
- Lectura 5 docs: FAIL / no ejecutada.
- Lectura 76 docs: FAIL / no ejecutada.
- Snapshot live retry-2 creado: NO.
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
- Primeros ISINs incluidos = ES0112602000, ES0114633003, ES0124880032, ES0125240038, ES0141580037.

## Pruebas retry-2

| Prueba | Resultado | Detalle |
| --- | --- | --- |
| Directorio | OK | Ejecutado en `C:\Users\oanti\Documents\BDB-FONDOS`, no en Core. |
| Node fetch base | FAIL | `fetch failed`; causa interna `EACCES`. |
| Node fetch detalle | FAIL | `connect EACCES 108.177.15.95:443`; IPv6 `ENETUNREACH`. |
| cmd /c node fetch | FAIL | `FAIL undefined fetch failed EACCES`. |
| Test-NetConnection oauth2 desde Codex | FAIL | `TcpTestSucceeded=False`. |
| Test-NetConnection firestore desde Codex | FAIL | `TcpTestSucceeded=False`. |
| Firestore 1 doc | SKIPPED | Bloqueado antes de OAuth/token. |
| Firestore 5 docs | SKIPPED | Bloqueado antes de OAuth/token. |
| Firestore 76 docs | SKIPPED | Bloqueado antes de OAuth/token. |

## Error exacto

```text
fetch('https://oauth2.googleapis.com')
TypeError: fetch failed
cause: AggregateError
errors:
  - connect EACCES 108.177.15.95:443
  - connect ENETUNREACH 2a00:1450:400c:c0a::5f:443
```

## Diagnostico

La sesion de Codex/Node sigue viendo bloqueo de salida HTTPS aunque PowerShell normal fuera de esta sesion funcione. El fallo ocurre antes de obtener token OAuth, por lo que no se puede leer ni un documento live de Firestore desde este proceso.

No se crea `morningstar_low_risk_write_gate_snapshot_live_retry_2.json` porque no hay lectura live 76/76.

## Siguiente accion recomendada

1. Reiniciar completamente Codex/Antigravity para que el proceso base herede la red desbloqueada.
2. En la nueva sesion, repetir primero el fetch base a `oauth2.googleapis.com`.
3. Solo si devuelve `OK 404`, repetir lectura 1/5/76 y crear snapshot live.
4. Mantener bloqueado cualquier write gate hasta tener snapshot live 76/76 creado desde Firestore.

## Seguridad

- NO se escribio Firestore.
- NO se ejecuto write gate.
- NO se llamo Gemini.
- NO se parsearon PDFs.
- NO deploy. NO commit. NO push.
- `BDB-FONDOS-CORE` no tocado.
- `funds_core_v1` no usado.
