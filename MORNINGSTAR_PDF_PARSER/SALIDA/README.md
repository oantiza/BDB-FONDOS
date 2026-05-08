# SALIDA

Aqui se generan los resultados visibles del dry-run.

Revisar antes de cualquier write futuro:

- `parser_dry_run_latest.json`
- manifests de write gate, si se generan aqui
- warnings y campos propuestos

`SALIDA` no implica escritura en Firestore.

`write_executed` debe ser `false` salvo un proceso posterior expresamente autorizado.
