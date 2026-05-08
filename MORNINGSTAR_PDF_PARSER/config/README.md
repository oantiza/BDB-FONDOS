# Config

Carpeta para mappings/configs propios del parser Morningstar PDF.

Prioridad de busqueda:

1. `--config-dir`
2. `MORNINGSTAR_PDF_PARSER/config`
3. `data/work`
4. `functions_python/scripts`
5. `scripts/maintenance`
6. `scripts/MORNINGSTAR_PDF_PARSER/config`

No guardar secretos aqui.

Si falta un CSV requerido, el parser debe abortar con un error claro.
