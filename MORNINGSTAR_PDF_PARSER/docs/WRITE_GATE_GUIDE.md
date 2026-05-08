# Write Gate Guide

El write gate prepara manifests para un posible write futuro, pero no escribe en Firestore.

Comando base:

```bash
node MORNINGSTAR_PDF_PARSER/bin/prepare_write_gate_dry_run.js --output-dir MORNINGSTAR_PDF_PARSER/artifacts
```

Antes de cualquier write real debe existir:

- parser dry-run artifact
- policy classification
- snapshot actual de Firestore read-only
- diff revisado
- approval manifest
- rollback manifest
- post-write verification plan

Estados clave:

- `WRITE_CANDIDATE`
- `REVIEW_REQUIRES_EXPLICIT_APPROVAL`
- `BLOCKED_NEVER_WRITE`
- `SKIP_MISSING_SNAPSHOT`
- `SKIP_FORBIDDEN_FIELD`

Campos prohibidos:

- `manual.*`
- `manual.costs`
- `manual.costs.retrocession`
- `portfolio_exposure_v2.economic_exposure`
