# Parser Policy

Resumen operativo de la politica vigente.

El parser puede preparar:

- `classification_v2`
- `portfolio_exposure_v2.asset_mix`
- `ms`
- `derived`, si aplica
- parser metadata/warnings

El parser nunca debe tocar:

- `manual.*`
- `manual.costs`
- `manual.costs.retrocession`
- `portfolio_exposure_v2.economic_exposure`

Estados:

- `ACCEPT`: puede pasar a candidato tras snapshot/diff.
- `ACCEPT_WITH_WARNINGS`: puede pasar a candidato si los warnings no bloquean y hay revision.
- `REVIEW`: requiere aprobacion explicita por ISIN.
- `BLOCKED`: nunca se escribe.

Canon:

- `asset_mix`: escala 0-1.
- `economic_exposure`: escala 0-100 y fuera del parser.
- retrocesiones: fuera del parser.

Documento canon completo: `docs/BDB_PARSER_POLICY_0_WRITE_REVIEW_CANON.md`.
