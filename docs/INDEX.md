# BDB-FONDOS · Índice de documentación

Punto de entrada a la documentación del repo. La fuente de verdad operativa es el código
(`functions_python/`, `frontend/`) + el `README.md` raíz; este índice solo organiza los `.md`.

## Documentación viva (raíz `docs/`)

- **Setup local de credenciales** — [`CREDENTIALS_LOCAL_SETUP.md`](./CREDENTIALS_LOCAL_SETUP.md)
- **Parser de Morningstar** — ver carpeta [`parser/`](./parser/) (políticas y guías del parser)

### Documentos de contrato referenciados por código/tests
Estos permanecen en la raíz porque están enlazados desde la app o cargados por tests
(no moverlos sin actualizar la referencia):

- `BDB_OPT_PAYLOAD_CONTRACT_CLEANUP_0.md` — cargado por `optimizerPayloadContract.test.ts` y `test_optimizer_payload_contract_static.py`.
- `BDB_SUITABILITY_HARDCODED_CONTRACT_AUDIT_0.md`, `BDB_SUITABILITY_CONTRACT_TESTS_0.md` — contratos de idoneidad (tests).
- `BDB_FI_CREDIT_FE9_SOFT_WARNING_DESIGN_0.md`, `BDB_FI_CREDIT_FE9_IMPACT_AUDIT_0.md`, `BDB_SUITABILITY_FI_CREDIT_DATA_MODEL_0.md`, `BDB_SUITABILITY_FE9_LOW_QUALITY_CREDIT_DECISION_0.md` — contratos FI credit (tests).
- `BDB_OPT_FEASIBILITY_LOCKS_USER_DECISIONS_0.md` — referenciado por tests de feasibility locks.
- Documentos del panel de administración (`ArtifactsPanel.tsx`): `BDB_ADMIN_CONSOLE_DESIGN_0.md`, `BDB_ADMIN_AUTH_GUARD_0.md`, `BDB_OPTIMIZER_CONSTRAINTS_CANONICAL_*`, `BDB_RETROCESSION_*`, `BDB_GLOBAL_STATE_AFTER_RETROCESSIONS_0.md`, `BDB_FRONTEND_RULESENGINE_TESTS_UNBLOCK_0.md`, etc.

## Histórico (`docs/_history/`)

Registros de sesión, planes, informes de despliegue, QA y auditorías previas (302 documentos).
Se conservan en git pero fuera de la raíz para reducir ruido. Búsqueda rápida:

```bash
ls docs/_history/ | grep -i <tema>
```

## Datos pesados (no versionados)

Los volcados de datos bajo `docs/audits/legacy/` (`funds_v3.json`, `audit_funds_v3_details.jsonl`,
`funds_eligibility.json`) están en `.gitignore`: permanecen en disco pero fuera del control de versiones.
