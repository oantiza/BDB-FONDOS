# Morningstar Chrome Full-Page Capture

Herramienta local para capturar PNG full-page renderizados de Morningstar con Playwright, navegador visible y perfil persistente dedicado.

## Seguridad

- No escribe Firestore.
- No modifica base de datos.
- No hace deploy, commit ni push.
- No guarda usuario ni contraseña en código.
- No exporta cookies, tokens, `localStorage` ni `sessionStorage`.
- Solo navega páginas renderizadas y captura PNG.
- El perfil local se guarda en `.local_browser_profiles/morningstar_capture` y debe permanecer ignorado por Git.

## CSV de entrada

Archivo:

```text
tools/morningstar_capture/morningstar_batch_10_urls.csv
```

Columnas:

```text
isin,morningstar_id,fund_name,morningstar_url
```

Primer fondo de prueba incluido:

```text
ES0118537002,0P0000O8ZI,Olea Neutral FI,https://global.morningstar.com/es/inversiones/fondos/0P0000O8ZI/cotizacion
```

## Comando de prueba mínima

Ejecuta solo Olea Neutral FI y captura Resumen, Riesgo y Cartera:

```powershell
C:\Users\oanti\Documents\BDB-FONDOS\.venv-playwright\Scripts\python.exe `
  C:\Users\oanti\Documents\BDB-FONDOS\tools\morningstar_capture\capture_morningstar_fullpage.py `
  --limit 1 `
  --tabs "Resumen,Riesgo,Cartera"
```

Si Morningstar pide login:

1. Inicia sesión manualmente en la ventana Chromium abierta.
2. No pegues credenciales en la terminal.
3. Vuelve a la terminal.
4. Pulsa Enter para continuar.

## Comando para lote completo

Usar solo después de validar calidad visual:

```powershell
C:\Users\oanti\Documents\BDB-FONDOS\.venv-playwright\Scripts\python.exe `
  C:\Users\oanti\Documents\BDB-FONDOS\tools\morningstar_capture\capture_morningstar_fullpage.py
```

## Salidas

Carpeta base:

```text
artifacts/morningstar_captures/
```

Por fondo:

```text
artifacts/morningstar_captures/<ISIN>_<MORNINGSTAR_ID>/
```

Nombres esperados:

```text
<ISIN>_<MORNINGSTAR_ID>_01_RESUMEN.png
<ISIN>_<MORNINGSTAR_ID>_02_GRAFICO.png
<ISIN>_<MORNINGSTAR_ID>_03_ANALISIS.png
<ISIN>_<MORNINGSTAR_ID>_04_RIESGO.png
<ISIN>_<MORNINGSTAR_ID>_05_CARTERA.png
<ISIN>_<MORNINGSTAR_ID>_06_MATRIZ_PERSONAS.png
<ISIN>_<MORNINGSTAR_ID>_07_DOCUMENTOS.png
```

Manifest:

```text
artifacts/morningstar_captures/BDB_MORNINGSTAR_CHROME_FULLPAGE_CAPTURE_MANIFEST.json
```

## Parámetros útiles

- `--tabs "Resumen,Riesgo,Cartera"` limita pestañas.
- `--limit 1` limita fondos.
- `--viewport-width 1920` cambia ancho.
- `--viewport-height 1200` cambia alto visible.
- `--device-scale-factor 2` aproxima alta densidad de píxel.
- `--zoom 1.5` aplica zoom visual equivalente a 150%.
- `--wait-ms 4000` espera tras carga o cambio de pestaña.
- `--browser-channel chrome` usa Chrome instalado si el Chromium bundled de Playwright no puede lanzarse.
- `--no-manual-login` desactiva la pausa inicial.
- `--strict-isin` evita capturar si el ISIN no aparece en texto renderizado.

## Limitaciones

- La navegación por pestañas depende de textos visibles en la web de Morningstar.
- Si Morningstar cambia etiquetas o rutas, una pestaña puede registrarse como `TAB_CAPTURE_FAILED`.
- El script continúa con la siguiente pestaña si una falla.
- No usa endpoints internos ni extrae datos estructurados.
