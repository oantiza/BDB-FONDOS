# BDB-FIRESTORE-LIVE-READ-CONNECTIVITY-SMOKE-RETRY-0

Fecha de ejecucion: 2026-05-18T18:34:00.109Z

## Resumen ejecutivo

- Resultado: Firestore live read desde el proceso Codex/Node sigue sin estabilizarse.
- Lectura 1 doc: FAIL.
- Lectura 5 docs: FAIL / no ejecutada porque falla la lectura de 1 doc.
- Lectura 76 docs: FAIL / no ejecutada porque falla la lectura previa.
- Snapshot live retry creado: NO.
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
- Primer ISIN probado = ES0112602000.

## Pruebas retry

| Prueba | Resultado | Detalle |
| --- | --- | --- |
| Directorio | OK | Ejecutado en `C:\Users\oanti\Documents\BDB-FONDOS`, no en Core. |
| TCP manual informado por usuario | OK | Usuario confirma `TcpTestSucceeded=True` para oauth2/firestore/generativelanguage en PowerShell manual. |
| TCP desde proceso Codex | FAIL | En esta sesion, `Test-NetConnection oauth2.googleapis.com:443` y `firestore.googleapis.com:443` siguen saliendo `TcpTestSucceeded=False`. |
| Token OAuth desde Node | FAIL | `request to https://oauth2.googleapis.com/token failed`, `code=EACCES`. |
| Firestore REST 1 doc | FAIL | No llega a ejecutarse lectura de documento porque no se obtiene token OAuth. |
| Firestore 5 docs | SKIPPED | Bloqueado por fallo de 1 doc/token. |
| Firestore 76 docs | SKIPPED | Bloqueado por fallo de 1 doc/token. |

## Error exacto

```text
request to https://oauth2.googleapis.com/token failed, reason: 
code=EACCES
stack: google-auth-library -> gtoken -> JWT.refreshTokenNoCache -> getAccessToken
```

## Diagnostico

- El manifest y la credencial externa llegan hasta el intento de autenticacion, pero el proceso Node de Codex no puede abrir salida HTTPS a `oauth2.googleapis.com`.
- Hay una discrepancia entre tu PowerShell manual y el entorno de ejecucion de Codex: manualmente TCP ya funciona, dentro de esta sesion sigue fallando.
- El bloqueo ocurre antes de cualquier lectura real de `funds_v3`, por lo que no se puede crear snapshot live fiable desde este proceso.
- No conviene avanzar a write gate hasta que este mismo proceso pueda leer 76/76 live.

## Siguiente accion recomendada

1. Reiniciar la sesion/terminal de Codex o Antigravity para que herede el nuevo estado de red/firewall.
2. Repetir primero el smoke de token OAuth desde Node.
3. Si el token OAuth sale OK, repetir lectura 1/5/76 y crear el snapshot live retry.
4. Mantener bloqueado cualquier write gate mientras `snapshot_live_retry_0.json` no exista con 76/76 documentos live.

## Seguridad

- NO se escribio Firestore.
- NO se ejecuto write gate.
- NO se llamo Gemini.
- NO se parsearon PDFs.
- NO deploy. NO commit. NO push.
- `BDB-FONDOS-CORE` no tocado. `funds_core_v1` no usado.
