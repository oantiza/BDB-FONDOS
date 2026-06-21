# BDB-OPT-AGGRESSIVE-PROFILES-RULES-WRITE-CONTROLLED-0

## Objetivo

Aplicar de forma controlada en Firestore el cambio de reglas de perfiles agresivos 8, 9 y 10 preparado en el dry-run.

## Scope

- Documento Firestore tocado: `system_settings/risk_profiles`
- Perfiles modificados: `8`, `9`, `10`
- Perfiles no modificados: `1` a `7`
- Update mask usada: `` `8` ``, `` `9` ``, `` `10` ``

No se tocaron:
- `funds_v3`
- fondos individuales
- `compatible_profiles`
- `classification_v2`
- `portfolio_exposure_v2`
- `manual.costs`
- retrocesiones

## Artefactos Leidos Antes Del Write

- `artifacts/aggressive_profiles_rules_update_0/snapshot_before.json`
- `artifacts/aggressive_profiles_rules_update_0/proposed_patch.json`
- `artifacts/aggressive_profiles_rules_update_0/diff_manifest.json`
- `artifacts/aggressive_profiles_rules_update_0/rollback_manifest.json`

Adicionalmente se creo snapshot live antes del write para rollback exacto:

- `artifacts/aggressive_profiles_rules_update_0/snapshot_firestore_live.json`

## Write Ejecutado

Write ejecutado: SI.

Se aplico solo el patch de `proposed_patch.json` sobre `system_settings/risk_profiles`, con mascara limitada a los campos `8`, `9` y `10`.

Campos modificados por perfil:
- `RV`
- `RF`
- `Monetario`
- `Alternativos`
- `Otros`
- `Mixto`

## Post-Write Verification

Artefacto creado:

- `artifacts/aggressive_profiles_rules_update_0/post_write_verification_0.json`

Resultado:
- perfiles `8`, `9`, `10` coinciden exactamente con `proposed_patch.json`: PASS
- perfiles `1` a `7` no cambiaron: PASS
- scope de Firestore limitado a `system_settings/risk_profiles`: PASS

## Validacion Funcional P10

Payload real validado contra las reglas post-write:

- equity `97.5607% >= 95%`: PASS
- bond `0.1692% <= 3%`: PASS
- cash `2.0473% <= 5%`: PASS
- other `0.2228% <= 3%`: PASS
- alternative `0.0000% <= 3%`: PASS

Resultado funcional P10: compliant.

## Rollback

Rollback disponible: SI.

Fuentes:
- rollback manifest preparado: `artifacts/aggressive_profiles_rules_update_0/rollback_manifest.json`
- snapshot live pre-write: `artifacts/aggressive_profiles_rules_update_0/snapshot_firestore_live.json`

## Guardrails

- Firestore writes: solo `system_settings/risk_profiles`
- Deploy: NO
- Push: NO
- Commit: NO
- BDB-FONDOS-CORE tocado: NO
- `suitability_engine.py` tocado: NO
