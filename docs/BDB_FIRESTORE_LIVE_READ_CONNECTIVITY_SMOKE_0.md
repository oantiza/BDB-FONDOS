# BDB-FIRESTORE-LIVE-READ-CONNECTIVITY-SMOKE-0

Fecha de ejecucion: 2026-05-18T18:27:03.553Z

## Resumen ejecutivo

- Resultado: Firestore live read NO estabilizado.
- Lectura 1 doc: FAIL.
- Lectura 5 docs: FAIL / no ejecutada porque falla la lectura de 1 doc.
- Lectura 76 docs: FAIL / no ejecutada porque falla la lectura previa.
- Snapshot live creado: NO.
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

## Pruebas realizadas

| Prueba | Resultado | Detalle |
| --- | --- | --- |
| Git/directorio | OK | Ejecutado en `C:\Users\oanti\Documents\BDB-FONDOS`; no es `BDB-FONDOS-CORE`. |
| Credencial externa | OK parcial | Existe `GOOGLE_APPLICATION_CREDENTIALS` externa para la prueba; no se imprimio ni se guardo ningun secreto. |
| Firestore Admin/gRPC | FAIL | `14 UNAVAILABLE: No connection established`; `connect EACCES 172.217.171.42:443`. |
| Firestore REST token | FAIL | `request to https://oauth2.googleapis.com/token failed`; falla antes de obtener token OAuth. |
| DNS oauth2.googleapis.com | OK | DNS resuelve direcciones A/AAAA. |
| DNS firestore.googleapis.com | OK | DNS resuelve direcciones A/AAAA. |
| TCP oauth2.googleapis.com:443 | FAIL | `TcpTestSucceeded = False`. |
| TCP firestore.googleapis.com:443 | FAIL | `TcpTestSucceeded = False`. |
| Node HTTPS oauth2.googleapis.com | FAIL | `EACCES`, `AggregateError`. |
| Node HTTPS firestore.googleapis.com | FAIL | `EACCES`, `AggregateError`. |
| Node HTTPS generativelanguage.googleapis.com | FAIL | `EACCES`, `AggregateError` en esta prueba de red. |

## Diagnostico

- El fallo actual no parece de permisos Firestore ni de contenido del manifest: la red falla antes de leer documentos.
- DNS funciona, pero la conexion TCP/HTTPS saliente a Google APIs en puerto 443 falla con `EACCES`.
- Causa probable: bloqueo local de red/firewall/antivirus/VPN/proxy para salidas HTTPS de Node/PowerShell hacia Google APIs.
- Mientras esto siga asi, no debe autorizarse ningun write gate live.

## Estado smoke

- lectura 1 doc = FAIL.
- lectura 5 docs = FAIL / SKIPPED.
- lectura 76 docs = FAIL / SKIPPED.
- snapshot live path esperado: `C:\Users\oanti\Documents\BDB-FONDOS\artifacts\bdb_parser_audit\morningstar_low_risk_write_gate_snapshot_live_0.json`.
- snapshot live creado = NO.

## Siguiente accion recomendada

1. Revisar firewall/antivirus/VPN/proxy para permitir salida HTTPS 443 desde `node.exe` y PowerShell hacia `oauth2.googleapis.com` y `firestore.googleapis.com`.
2. Si hay proxy corporativo/local, configurar `HTTPS_PROXY`/`HTTP_PROXY` tambien para Node.
3. Repetir primero `Test-NetConnection firestore.googleapis.com -Port 443` y `Test-NetConnection oauth2.googleapis.com -Port 443`.
4. Solo cuando TCP/HTTPS este OK, repetir este smoke y crear el snapshot live de 76 documentos.

## Seguridad

- NO se escribio Firestore.
- NO se ejecuto write gate.
- NO se llamo Gemini.
- NO se parsearon PDFs.
- NO deploy. NO commit. NO push.
- `BDB-FONDOS-CORE` no tocado. `funds_core_v1` no usado.
