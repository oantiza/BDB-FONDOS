# BDB Gemini Node Env Network Diagnosis 0

Fecha: 2026-05-17  
Proyecto: `C:\Users\oanti\Documents\BDB-FONDOS`  
Tarea: `BDB-GEMINI-NODE-ENV-NETWORK-DIAGNOSIS-0`

## Resumen Ejecutivo

El problema principal no era el parser productivo. Habia dos incidencias de entorno:

1. `npm` fallaba con `EPERM` al usar la cache por defecto en `C:\Users\oanti\AppData\Local\npm-cache`.
2. Los paquetes `csv-parse` y `@google/generative-ai` no estaban instalados realmente; habia shims temporales del bloque anterior.

Se resolvio sin tocar la logica productiva usando una cache npm local del proyecto (`.npm-cache`) y reinstalando dependencias reales con scripts desactivados. La llamada minima a Gemini con `gemini-2.5-flash` funciono desde Node.

No se ejecuto el parser sobre los 649 PDFs.

## Estado Inicial

- Directorio confirmado: `C:\Users\oanti\Documents\BDB-FONDOS`.
- No se trabajo en `BDB-FONDOS-CORE`.
- PDFs en `MORNINGSTAR_PDF_PARSER/ENTRADA`: `649`.
- Parser masivo ejecutado: `NO`.
- Firestore writes: `0`.
- PDFs movidos: `0`.
- Commit/push/deploy: `NO`.

## Shims Locales

Detectados al inicio:

- `node_modules/csv-parse/package.json` con `version: local-shim`.
- `node_modules/@google/generative-ai/package.json` con `version: local-shim`.

Estado final:

- Shims sustituidos por dependencias reales.
- `csv-parse/sync` resuelve a `node_modules/csv-parse/dist/cjs/sync.cjs`.
- `@google/generative-ai` resuelve a `node_modules/@google/generative-ai/dist/index.js`.
- `@google/generative-ai` version real: `0.24.1`.
- No quedan shims activos para esas dos dependencias.

## Diagnostico npm

- Node: `v24.15.0`.
- npm: `11.12.1`.
- Cache por defecto: `C:\Users\oanti\AppData\Local\npm-cache`.
- Prefix: `C:\Users\oanti\AppData\Roaming\npm`.
- Proxy npm: `null`.
- HTTPS proxy npm: `null`.

Fallos con cache por defecto:

- `npm doctor`: falla al crear `C:\Users\oanti\AppData\Local\npm-cache\_cacache\tmp`.
- `npm cache verify`: `EPERM mkdir C:\Users\oanti\AppData\Local\npm-cache\_cacache`.
- `npm view csv-parse version`: `EPERM mkdir ...\_cacache\tmp`.

Prueba corregida:

```powershell
New-Item -ItemType Directory -Force -Path .npm-cache
npm.cmd view csv-parse version --cache .\.npm-cache
npm.cmd cache verify --cache .\.npm-cache
npm.cmd install --package-lock-only --ignore-scripts --no-audit --no-fund --cache .\.npm-cache
npm.cmd install --ignore-scripts --no-audit --no-fund --cache .\.npm-cache
```

Resultado: dependencias reales instaladas correctamente. Se creo `package-lock.json` y `.npm-cache/` local.

## Estado Dependencias

| Dependencia | Estado final |
|---|---|
| `csv-parse/sync` | OK, real: `node_modules/csv-parse/dist/cjs/sync.cjs` |
| `@google/generative-ai` | OK, real: `node_modules/@google/generative-ai/dist/index.js` |
| `p-limit` | OK |
| `pdf-parse` | OK |
| `firebase-admin` | OK |

## Diagnostico Red Gemini

| Prueba | Resultado |
|---|---|
| DNS `Resolve-DnsName generativelanguage.googleapis.com` | OK, devuelve A y AAAA |
| TCP 443 `Test-NetConnection` | OK, `TcpTestSucceeded=True` |
| PowerShell HTTPS | FAIL: `Se ha terminado la conexi?n: Error inesperado de recepci?n` |
| Node HTTPS `https.request` | OK, respuesta HTTP 404 en `/` |
| Node `fetch` | OK, respuesta HTTP 404 en `/` |
| Proxy env | `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` vacios |
| npm proxy | `null` |
| npm https-proxy | `null` |

Interpretacion: DNS y TCP funcionan. PowerShell tiene un problema de recepcion/TLS/HTTPS, pero Node puede salir a Gemini correctamente.

## Prueba Minima Gemini

Se creo script documentado en `tools/diagnostics/gemini_minimal_call.js`. No contiene ni guarda secretos. Usa `GEMINI_API_KEY` del entorno y pide a `gemini-2.5-flash` responder `OK`.

Resultado: `GEMINI_MINIMAL_OK`.

## Causa Probable

- npm: bloqueo/permisos/seguridad sobre la cache por defecto `C:\Users\oanti\AppData\Local\npm-cache`.
- red: PowerShell HTTPS falla, pero Node HTTPS/fetch funciona. Para el parser Gemini, el canal relevante es Node, y ya esta OK.

## Accion Concreta Para Desbloquear

Accion inmediata suficiente para este proyecto:

```powershell
npm.cmd install --ignore-scripts --no-audit --no-fund --cache .\.npm-cache
```

Accion de sistema recomendada si se quiere arreglar npm globalmente:

- Revisar permisos o bloqueo de antivirus/Defender sobre `C:\Users\oanti\AppData\Local\npm-cache`.
- Cerrar procesos Node/Antigravity que puedan retener la cache.
- Ejecutar `npm cache verify` en una PowerShell normal del usuario tras liberar permisos.
- No eliminar `node_modules` ni limpiar cache con `--force` sin aprobacion explicita.

## Reintento Seguro Del Parser

Cuando se quiera reintentar el dry-run, el comando seguro sigue siendo:

```powershell
node MORNINGSTAR_PDF_PARSER/bin/parse_dry_run.js --model gemini-2.5-flash --no-move-files
```

No usar `--write`, `--confirm-write` ni `--write-review`.

## Confirmaciones

- Firestore writes: `0`.
- PDFs movidos: `0`.
- Parser masivo: `NO`.
- Deploy: `NO`.
- Commit: `NO`.
- Push: `NO`.
- `BDB-FONDOS-CORE` no tocado.
- `funds_core_v1` no usado.
- Secretos no impresos ni guardados.
