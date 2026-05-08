# ARCHIVOS_PROCESADOS

Aqui se guardan PDFs procesados correctamente o con estado REVIEW.

Reglas:

- Se renombran por ISIN cuando el parser lo detecta.
- Si ya existe `<ISIN>.pdf`, se usa un nombre unico con `report_date` o timestamp.
- No commitear PDFs reales salvo autorizacion expresa.
