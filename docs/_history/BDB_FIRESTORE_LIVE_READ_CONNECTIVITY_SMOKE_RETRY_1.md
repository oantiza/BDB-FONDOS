# BDB-FIRESTORE-LIVE-READ-CONNECTIVITY-SMOKE-RETRY-1

Fecha de ejecucion: 2026-05-18

## Resumen ejecutivo

- Resultado: Firestore live read desde el proceso Codex/Node sigue sin estabilizarse.
- Lectura 1 doc: FAIL.
- Lectura 5 docs: FAIL / no ejecutada porque falla la prueba base de Node.
- Lectura 76 docs: FAIL / no ejecutada porque falla la prueba base de Node.
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
- Primeros ISINs incluidos: `ES0112602000`, `ES0114633003`, `ES0124880032`, `ES0125240038`, `ES0141580037`.

## Pruebas retry

| Prueba | Resultado | Detalle |
| --- | --- | --- |
| Directorio | OK | Ejecutado en `C:\Users\oanti\Documents\BDB-FONDOS`, no en Core. |
| Node fetch base pedido por usuario | FAIL | `FAIL undefined fetch failed`. |
| Node fetch con causa interna | FAIL | `TypeError: fetch failed`; causa `AggregateError`; `EACCES` contra `108.177.15.95:443`; IPv6 `ENETUNREACH`. |
| cmd /c node fetch | FAIL | `FAIL undefined fetch failed EACCES`. |
| Firestore 1 doc | FAIL / SKIPPED | No se intenta lectura porque Node no llega a OAuth/Google APIs desde esta sesion. |
| Firestore 5 docs | SKIPPED | Bloqueado por fallo de conectividad de Node. |
| Firestore 76 docs | SKIPPED | Bloqueado por fallo de conectividad de Node. |

## Error exacto

```text
fetch('https://oauth2.googleapis.com')
TypeError: fetch failed
cause: AggregateError
errors:
  - connect EACCES 108.177.15.95:443
  - connect ENETUNREACH 2a00:1450:400c:c02::5f:443
```

## Diagnostico

Aunque PowerShell normal ya funciona segun la prueba manual del usuario, el proceso lanzado por Codex/Node sigue bloqueado para salida HTTPS hacia Google APIs. La discrepancia parece estar en el contexto de ejecucion de Codex/Antigravity, no en el manifest ni en Firestore.

No se crea `morningstar_low_risk_write_gate_snapshot_live_retry_0.json` ni `morningstar_low_risk_write_gate_snapshot_live_retry_1.json` porque no hay lectura live 76/76.

## Siguiente accion recomendada

1. Reiniciar completamente Antigravity/Codex, no solo abrir una shell dentro de la misma sesion.
2. Repetir primero: `node -e "fetch('https://oauth2.googleapis.com').then(r=>console.log('OK', r.status)).catch(e=>console.error('FAIL', e.code, e.message))"`.
3. Solo si devuelve `OK 404` desde Codex, repetir lectura 1/5/76 live.
4. Mantener bloqueado cualquier write gate hasta tener snapshot live 76/76.

## Seguridad

- NO se escribio Firestore.
- NO se ejecuto write gate.
- NO se llamo Gemini.
- NO se parsearon PDFs.
- NO deploy. NO commit. NO push.
- `BDB-FONDOS-CORE` no tocado.
- `funds_core_v1` no usado.
