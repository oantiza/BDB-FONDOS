# BDB-FONDOS Technical Conventions

Este documento resume las convenciones arquitecturales y de negocio implementadas en el sistema para asegurar resiliencia, previsibilidad y consistencia entre el Frontend y el Backend.

---

## 1. Convención Temporal (Series de Tiempo)

- **Eliminación de Backfill (`bfill`):** Se prohíbe el uso de `bfill` en datos de precios. Rellenar datos hacia atrás falsifica la historia de fondos recientes o de corta vida, introduciendo sesgos irreales.
- **Tramo Común Estricto:** Toda analítica multi-activo (frontera, correlaciones, optimización) opera **únicamente** sobre la intersección temporal exacta donde _todos_ los activos seleccionados tienen precio válido.
- **Ventana Mínima de Observaciones (60 días):** Toda matemática avanzada requiere al menos 60 días de ventana común estricta. Si la intersección es menor a 60 días, el backend debe abortar matemáticamente y retornar un error explícito.
- **Metadatos Temporales Obligatorios:** Las funciones deben calcular y retornar siempre `effective_start_date` (fecha real de inicio del tramo común) y `observations` (cantidad de días hábiles procesados).

---

## 2. Contrato de Respuesta Backend

Para evitar fallos silenciosos y parseos frágiles en los hooks del frontend, todo *callable* de Firebase Functions debe devolver diccionarios con el siguiente estándar:

### Respuesta de Éxito
```json
{
  "status": "success",
  "data": { ... } // (o campos esparcidos según diseño histórico)
}
```

### Respuesta de Error
Siempre debe incluir un `status`, un `message` legible para el usuario, y opcionalmente contexto contextual (`observations`):
```json
{
  "status": "error",
  "error": "ShortHistoryException",
  "message": "Historial común insuficiente. Se requieren mínimo 60 observaciones.",
  "observations": 45,
  "effective_start_date": "2023-01-15",
  "missing_assets": []
}
```

### Compatibilidad Legacy en Frontend (Ej. Frontier)
Si un endpoint como `getEfficientFrontier` falla prematuramente, para evitar que componentes UI mapeen sobre un `undefined`, el backend debe acompañar el error estándar con arreglos vacíos de su estructura core:
```json
{
  "status": "error",
  "message": "Historial insuficiente...",
  "frontier": [],
  "assets": [],
  "math_data": {}
}
```

---

## 3. Taxonomía de Activos

- **Precedencia Estricta de `classification_v2`:** El sistema usa como fuente de verdad `classification_v2`. Solo si este campo está ausente, el normalizador y el categorizador pueden hacer un *fallback* a lectura legacy (`label`, `asset_class`, `category`).
- **Mapeo Explícito Categórico:** Para asegurar que las reglas estáticas del motor de validación (`rulesEngine.ts`) agrupen predictiblemente, las macro-clases de nicho como **"MATERIAS PRIMAS" / "COMMODITIES"** y **"INMOBILIARIO" / "REAL ESTATE"** están atadas de manera dura al bucket `"Otros"` si no tienen una regla específica, matando las lagunas de clasificación.

---

## 4. Testing (Regresión y Cobertura)

Los cambios core detallados arriba de UX, contratos y matemáticas están blindados en el backend por medio de la suite de pruebas:
- **Archivo:** `functions_python/tests/test_regression_coverage.py`
- **Casos Críticos Cubiertos:**
  - `test_analyzer_empty_portfolio`: Aborto seguro frente a carteras sin ponderación.
  - `test_analyzer_insufficient_history`: Comportamiento de validación frente a un mix de fondos nuevos sin historial (retorno de estado `error` y observaciones bajas).
  - `test_optimizer_short_history`: Prevención del optimizador intentando resolver una frontera matemáticamente infactible.
  - `test_frontier_short_history`: Garantía de arrays en blanco (`assets:[]`, `frontier:[]`) en el payload de error para compatibilidad UI estricta.
  - `test_classify_asset_fallback`: Comprobación del motor agnóstico resolviendo diccionarios mixtos entre V1 y V2.
