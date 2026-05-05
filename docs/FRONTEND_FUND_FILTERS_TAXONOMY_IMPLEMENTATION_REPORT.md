# Reporte de Implementación: Taxonomía y Filtros Frontend (BDB-FONDOS)

## A. Resumen Ejecutivo
Se ha ejecutado la refactorización de bajo riesgo sobre los componentes frontend para estandarizar los filtros de búsqueda y comparación de fondos, asegurando coherencia con la taxonomía V2. Se eliminó el uso de tokens inconsistentes (como `MIXED_ALLOCATION` y `USA`) que causaban devoluciones de cero resultados, unificándolos a la taxonomía canónica sin tocar la base de datos ni el backend. Adicionalmente, se diagnosticó y validó exitosamente la suite de tests locales.

## B. Archivos Modificados
1. `frontend/src/components/FundSwapModal.tsx`
2. `frontend/src/components/modals/SharpeMaximizerModal.tsx`
3. `frontend/src/utils/directSearch.ts`
4. `frontend/src/components/comparator/FundComparator.tsx`
5. `frontend/src/__tests__/mixedFunds.test.ts`

## C. Cambios Exactos por Módulo

### 1. `FundSwapModal.tsx`
- **Filtros de Búsqueda:** Se cambió el valor del `<option>` del select de clase de activo de `MIXED_ALLOCATION` a `MIXED`. El texto visible ("Mixto") se mantuvo intacto.

### 2. `SharpeMaximizerModal.tsx`
- **Filtros de Búsqueda:** Se cambió el `<option>` de clase de activo de `MIXED_ALLOCATION` a `MIXED`.
- **UI / Debug:** Se eliminó el div con la advertencia en amarillo "Nota Debug" para limpiar la vista final.
- **Formateo de Métricas:** El "Sharpe Actual" ahora verifica si el dato existe o es mayor que 0. En caso de ser nulo o indefinido, muestra el string `'N/D'` en lugar de procesar un falso real `0.00`.

### 3. `directSearch.ts`
- **Normalización de Clase de Activo:** La función de parseo de tokens ahora acepta `MIXED_ALLOCATION` además de `ALLOCATION` y `MIXED`, incluyendo explícitamente en la query tanto `allocation` como `MIXED`. Esto previene futuras consultas vacías si un componente UI inyecta el valor antiguo.
- **Normalización de Región:** Se importó e implementó la utilidad `getCanonicalRegion` de `fundTaxonomy.ts`. Ahora, al comprobar la región objetivo del usuario contra la región del fondo evaluado, ambas se normalizan primero a los estándares V2 (ej: `NORTH_AMERICA`), haciendo que la búsqueda con "USA" sea equivalente a "NORTH_AMERICA".

### 4. `FundComparator.tsx`
- **Alineación de Categorías:** En la recopilación y mapeo inicial de los fondos (`allFunds`), el atributo `category` ya no utiliza la categoría cruda de Firestore, sino que emplea el método envoltorio `getCanonicalAssetClass()`. Como resultado, los fondos que en DB están etiquetados como `ALLOCATION` y `MIXED` ahora se colapsan uniformemente bajo el mismo paraguas en el panel de selección, unificándolos en la vista UI.

### 5. Configuración y Tests de Vitest (`mixedFunds.test.ts`)
- **Problema Detectado:** El error *“No test suite found in file”* reportado no se debía a un problema en el formato de los tests. Ocurría debido a un problema con el runner local si no se le especificaba correctamente el scope o porque se lanzó desde la raíz y no mediante `npm run test` dentro de `/frontend`.
- **Nuevos Tests:** Se añadieron 3 bloques de test unitarios adicionales que validan estáticamente la normalización defensiva:
  - `getAssetTypeQueryValues('MIXED_ALLOCATION')` -> incluye `MIXED` y `allocation`.
  - `getCanonicalRegion({ ... region_primary: 'USA' })` -> normaliza a `NORTH_AMERICA`.
  - `getCanonicalAssetClass({ ... asset_type: 'ALLOCATION' })` -> normaliza a `MIXED`.
- **Validación:** Se validó con éxito ejecutando explícitamente la suite de Mixtos a través de npm script (total 19/19 passing).

---

## D. Tabla Antes/Después de Valores (Mapeo)

| Concepto / Origen | Antes (UI enviaba/leía) | Después (UI envía/lee y Query resuelve) |
| :--- | :--- | :--- |
| **Swap Modal Mixto** | `MIXED_ALLOCATION` | `MIXED` |
| **Sharpe Modal Mixto** | `MIXED_ALLOCATION` | `MIXED` |
| **Filtro Categoría DB** | `ALLOCATION` (crudo separado) | `MIXED` (fusionado visualmente) |
| **Búsqueda por Región** | `USA` (causaba mismatch exacto) | `USA` -> Normaliza a `NORTH_AMERICA` |
| **Búsqueda de Mixtos** | Buscaba `"MIXED_ALLOCATION"` (0 fallos)| Busca `MIXED` y `allocation` (Defensivo) |

---

## E. Resultado de Tests
- **Estado:** ✅ **PASS**
- **Motivo de ex-fallo:** Se ejecutó Vitest fuera del entorno (probablemente en la carpeta raíz en vez de en `/frontend`). Al correrlo de forma nativa como script node (`npm run test -- src/__tests__/mixedFunds.test.ts`), Vitest los leyó y evaluó sin problemas.
- **Rendimiento:** 19 de 19 tests unitarios han pasado (16 iniciales + 3 nuevos sobre normalización agregados en esta sesión).

---

## F. Riesgos Pendientes
- Todavía pueden quedar vestigios locales si otro modal menor o nueva función se añadió copiando `FundSwapModal` antes de este cambio.
- La base de datos V2 mantiene fondos con la etiqueta `ALLOCATION`, lo ideal en el futuro es lanzar un parche (cloud function o script de mantenimiento) en backend que sobrescriba el tipo directamente a `MIXED`.

## G. Reversión
- **Frontend-only:** Este cambio únicamente impacta cómo el frontend hace peticiones de lectura a Firestore.
- Para revertir, basta con ejecutar un checkout o reset sobre el commit actual en `frontend/src/` ya que no hay persistencia externa ni migraciones asociadas.

## H. Confirmación Explícita
- [x] NO se ha tocado backend.
- [x] NO se ha hecho deploy a Firebase o Hosting.
- [x] NO se ha hecho push remoto a ningún branch.
- [x] NO se ha alterado `firestore.rules`.
- [x] NO se han tocado, inyectado o filtrado credenciales.
