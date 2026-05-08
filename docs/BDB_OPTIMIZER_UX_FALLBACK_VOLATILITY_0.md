# BDB-OPT-UX-FALLBACK-VOLATILITY-0: Auditoría y Mejora UX de Fallback

## Objetivo
Mejorar la experiencia de usuario (UX) cuando el optimizador de carteras entra en estado `fallback`, proporcionando mayor transparencia sobre la volatilidad objetivo frente a la lograda, y traduciendo las advertencias técnicas del solver (como problemas de exposición en fondos mixtos) a un lenguaje funcional comprensible para el usuario.

## Estado Base
- La interfaz mostraba el título "Propuesta de Cartera Alternativa" cuando el estado era `fallback`.
- Los datos de `target_vol`, `achieved_vol`, y `vol_deviation` ya eran devueltos por el backend y estaban mapeados parcialmente, pero el flujo de advertencias (`warnings`) no llegaba hasta el componente de renderizado del modal.
- Los tests verificaban el control de acceso a la propuesta, pero no validaban la extracción y paso de métricas analíticas clave al UI.

## Modificaciones Realizadas

### 1. Inyección de Warnings en el Hook
En `frontend/src/hooks/usePortfolioActions.ts`, se modificó el método `processOptimizationResult` para inyectar explícitamente `result.warnings` dentro del objeto `enhancedExplainability`.
```typescript
warnings: result.warnings || []
```
Esto asegura que el componente visual reciba las advertencias técnicas generadas por el solver.

### 2. Traducción de Warnings a Lenguaje de Negocio
Se añadió una utilidad de traducción en `frontend/src/utils/normalizer.ts` (`translateTechnicalWarning`) para mapear advertencias internas como:
- `mixed_legacy_50_50_fallback` -> _"Se han detectado fondos mixtos sin desglose actualizado de renta variable. Se asume conservadoramente un 50% de exposición."_
- `requires_exposure_review` -> _"Se recomienda revisar la exposición de los fondos mixtos para mayor precisión."_
- `mixed_missing_asset_mix` -> _"Faltan datos de exposición en fondos mixtos; usando modelo 50/50 de fallback."_

### 3. Modificación del Componente Modal UX
En `frontend/src/components/modals/OptimizationReviewModal.tsx`, se amplió la caja de advertencia (Fallback Warning Box, con estilo ámbar).
- Se preservó y validó la sección que ya renderizaba "Volatilidad Objetivo", "Volatilidad Lograda" y "Desviación".
- Se agregó una subsección iterativa ("Consideraciones adicionales") que lista las advertencias del optimizador utilizando la función `translateTechnicalWarning`, garantizando que el usuario entienda las limitaciones heurísticas (como el 50/50 en fondos mixtos sin datos completos) sin alarmarse innecesariamente.

### 4. Cobertura de Pruebas
- Se extendió `frontend/src/__tests__/optimizerP0Contract.test.ts` para agregar comprobaciones estáticas de la presencia de lógica de extracción de métricas UX (`target_vol`, `achieved_vol`, `vol_deviation`, `warnings`).
- Se introdujo un bloque de validación unitaria en `frontend/src/__tests__/v2Helpers.test.ts` para verificar la traducción correcta de los strings técnicos de warning al español comercial.

## Resultado
La interfaz ahora presenta una "Propuesta de Mejor Esfuerzo" clara, auditable y transparente. Si un usuario lanza una cartera agresiva con fondos mixtos no detallados, el optimizador fallará con gracia utilizando una heurística al 50%, y el frontend explicará exactamente por qué se desvió del riesgo objetivo, mencionando específicamente la exposición del fondo mixto.

No se modificó la lógica matemática del optimizador ni se realizaron escrituras en la base de datos Firestore, respetando íntegramente las reglas de aislamiento del entorno.
