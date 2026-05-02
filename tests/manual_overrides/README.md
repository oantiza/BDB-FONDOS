# Tests de Regresion - Manual Overrides

## Ejecucion
Desde la raiz del repo:

```bash
node tests/manual_overrides/test_validate_manual_overrides.js
```

Alternativa con scripts npm (integracion operativa):

```bash
npm run manual-overrides:test
npm run manual-overrides:validate
npm run manual-overrides:validate:strict
npm run manual-overrides:gate
```

`manual-overrides:gate` ejecuta: tests + validacion estandar.
`manual-overrides:validate:strict` deja el validador en modo bloqueante ante warnings.

## Flujo operativo recomendado
1. Ejecutar regresion local:
```bash
npm run manual-overrides:test
```
2. Validar overrides reales antes de aplicar:
```bash
npm run manual-overrides:validate:strict
```
3. Solo si el paso 2 pasa (exit code 0), continuar con la aplicacion de overrides sobre `04_canonical`.

## Que cubren
La suite valida el comportamiento observable de `overrides/validate_manual_overrides.js`:

- Casos validos: `set`, `unset`, `append_unique`, `remove_values`, `status=approved`, `status=draft` con warning.
- Casos invalidos: path prohibido, `value` invalido para ops de array, `set` sin `value`, ISIN invalido, `approved` sin `approved_by`, root no permitido, operacion no permitida.
- Cross-check con canonical: path inexistente (warning), ops de array sobre target no array (error), `set` redundante (warning).
- Verificacion de salida: `exit code`, generacion de `manifest` y `log`, y clasificacion `OK/WARNING/ERROR` en manifest.

## Fixtures
Se usan fixtures pequenos y estables:

- `fixtures/04_canonical/canonical_base.json`
- `fixtures/04_canonical/canonical_non_array.json`
- `fixtures/05_overrides_valid/base_valid_override.json`
- `fixtures/05_overrides_invalid/base_invalid_override.json`

## Como anadir un caso nuevo
1. Agrega un nuevo escenario en `CASES` dentro de `test_validate_manual_overrides.js`.
2. Define `mutate(...)`, `expectedExitCode`, `expectedResult` y (si aplica) `expectedErrorCodes` / `expectedWarningCodes`.
3. Reutiliza un fixture canonical existente o crea uno nuevo en `fixtures/04_canonical`.
4. Ejecuta la suite completa con el comando de arriba.
