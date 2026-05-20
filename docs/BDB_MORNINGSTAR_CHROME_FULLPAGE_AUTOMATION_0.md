# BDB-MORNINGSTAR-CHROME-FULLPAGE-AUTOMATION-0

## Objetivo

Crear una herramienta local para capturar páginas renderizadas de Morningstar en PNG full-page, imitando el flujo manual validado con Chrome maximizado, zoom visual 150% y captura de página completa.

## Instalación requerida

Python/Playwright esperado:

```text
C:\Users\oanti\Documents\BDB-FONDOS\.venv-playwright\Scripts\python.exe
```

La venv debe tener Playwright instalado y los navegadores de Playwright disponibles. Si faltan navegadores:

```powershell
C:\Users\oanti\Documents\BDB-FONDOS\.venv-playwright\Scripts\python.exe -m playwright install chromium
```

## Archivos creados

```text
tools/morningstar_capture/morningstar_batch_10_urls.csv
tools/morningstar_capture/capture_morningstar_fullpage.py
tools/morningstar_capture/README.md
docs/BDB_MORNINGSTAR_CHROME_FULLPAGE_AUTOMATION_0.md
```

## Perfil local persistente

```text
C:\Users\oanti\Documents\BDB-FONDOS\.local_browser_profiles\morningstar_capture
```

Este perfil se usa solo para mantener sesión local. No se exportan cookies, tokens, `localStorage` ni `sessionStorage`.

## CSV de entrada

```text
tools/morningstar_capture/morningstar_batch_10_urls.csv
```

Columnas:

```text
isin,morningstar_id,fund_name,morningstar_url
```

Primer fondo de prueba:

```text
ES0118537002,0P0000O8ZI,Olea Neutral FI,https://global.morningstar.com/es/inversiones/fondos/0P0000O8ZI/cotizacion
```

## Comando de prueba Olea

Captura solo Resumen, Riesgo y Cartera:

```powershell
C:\Users\oanti\Documents\BDB-FONDOS\.venv-playwright\Scripts\python.exe `
  C:\Users\oanti\Documents\BDB-FONDOS\tools\morningstar_capture\capture_morningstar_fullpage.py `
  --limit 1 `
  --tabs "Resumen,Riesgo,Cartera"
```

## Login manual

Si Morningstar pide login, el script muestra:

```text
Inicia sesión manualmente en esta ventana y pulsa Enter en la terminal para continuar.
```

El usuario debe iniciar sesión en la ventana Chromium visible y después pulsar Enter en la terminal. El script no solicita ni guarda credenciales.

## Estructura de salida

Carpeta base:

```text
artifacts/morningstar_captures/
```

Por fondo:

```text
artifacts/morningstar_captures/<ISIN>_<MORNINGSTAR_ID>/
```

Manifest:

```text
artifacts/morningstar_captures/BDB_MORNINGSTAR_CHROME_FULLPAGE_CAPTURE_MANIFEST.json
```

Capturas esperadas para lote completo:

```text
<ISIN>_<MORNINGSTAR_ID>_01_RESUMEN.png
<ISIN>_<MORNINGSTAR_ID>_02_GRAFICO.png
<ISIN>_<MORNINGSTAR_ID>_03_ANALISIS.png
<ISIN>_<MORNINGSTAR_ID>_04_RIESGO.png
<ISIN>_<MORNINGSTAR_ID>_05_CARTERA.png
<ISIN>_<MORNINGSTAR_ID>_06_MATRIZ_PERSONAS.png
<ISIN>_<MORNINGSTAR_ID>_07_DOCUMENTOS.png
```

## Resultado de prueba Olea

Prueba mínima ejecutada correctamente el 2026-05-16 usando Chrome instalado, porque el Chromium bundled de Playwright fue bloqueado por el entorno local con `spawn EPERM`.

Comando validado:

```powershell
C:\Users\oanti\Documents\BDB-FONDOS\.venv-playwright\Scripts\python.exe `
  C:\Users\oanti\Documents\BDB-FONDOS\tools\morningstar_capture\capture_morningstar_fullpage.py `
  --limit 1 `
  --tabs "Resumen,Riesgo,Cartera" `
  --no-manual-login `
  --browser-channel chrome
```

Resultado:

- ISIN confirmado en página renderizada: `ES0118537002`
- Capturas OK: 3
- Capturas con fallo: 0
- Manifest generado correctamente
- Observación visual: las capturas son legibles y full-page; aparece el tab vertical de Feedback de Morningstar y puede haber cabeceras repetidas por elementos sticky de la propia web durante captura full-page.

El comando mínimo genera, cuando la navegación se completa:

```text
artifacts/morningstar_captures/ES0118537002_0P0000O8ZI/ES0118537002_0P0000O8ZI_01_RESUMEN.png
artifacts/morningstar_captures/ES0118537002_0P0000O8ZI/ES0118537002_0P0000O8ZI_04_RIESGO.png
artifacts/morningstar_captures/ES0118537002_0P0000O8ZI/ES0118537002_0P0000O8ZI_05_CARTERA.png
```

## Limitaciones

- La navegación se basa en texto visible de pestañas.
- Si Morningstar cambia la interfaz, una pestaña puede fallar con `TAB_CAPTURE_FAILED`.
- Si el ISIN no aparece en el texto renderizado, queda registrado en el manifest.
- No se usan endpoints internos de Morningstar.
- No se extraen datos estructurados.
- No se actualiza Excel.

## Seguridad y confirmaciones

- Firestore writes: 0
- Deploy: NO
- Commit: NO
- Push: NO
- BDB-FONDOS-CORE tocado: NO
- Credenciales guardadas: NO
- Cookies/tokens exportados: NO
