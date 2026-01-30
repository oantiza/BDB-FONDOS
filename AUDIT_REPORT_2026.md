# Auditoría Técnica del Sistema BDB-FONDOS
**Fecha:** 30 de Enero de 2026
**Versión:** 1.0

## 1. Resumen Ejecutivo
El sistema se encuentra funcional y operativo, con un despliegue exitoso reciente. Sin embargo, existe una **deuda técnica considerable** en la capa de Backend que duplica lógica crítica de obtención de datos, y una laxitud en el tipado del Frontend que podría ocultar errores en tiempo de ejecución. 

**Estado General:** 🟡 **ALERTA LEVE** (Funcional, pero difícil de mantener).

---

## 2. Hallazgos Críticos (Backend)

### 2.1. Duplicación Lógica de Acceso a Datos
Existen dos implementaciones paralelas para obtener precios históricos, lo cual es peligroso para la consistencia de los datos.

*   **Archivo 1:** `functions_python/services/data.py` (Función `get_price_data`)
    *   Este archivo es el que **actualmente usa** el optimizador (`optimizer.py`).
    *   Implementa caché RAM y lectura de Firestore básica.
    *   **NO implementa** la limpieza avanzada de pandas (resampling) que sí tiene el otro archivo.
*   **Archivo 2:** `functions_python/services/data_fetcher.py` (Clase `DataFetcher`)
    *   Implementación más moderna y orientada a objetos.
    *   **NO está siendo utilizada** por el optimizador principal.
    *   Implementa lógica superior de alineación de fechas (`resample('W-FRI')`).

**Riesgo:** El optimizador podría estar trabajando con datos "sucios" o desalineados al usar la versión antigua (`data.py`), ignorando las mejoras de `data_fetcher.py`.

### 2.2. Monolito en `optimizer.py`
El archivo `optimizer.py` tiene ~800 líneas y viola el principio de responsabilidad única.
*   Realiza consultas a Base de Datos directas.
*   Contiene lógica de "Emergencia Auto-Expand" muy compleja anidada.
*   Define constantes hardcodeadas de ISINs (Líneas 104-113: `FALLBACK_CANDIDATES_DEFAULT`), lo que dificulta cambios de configuración sin tocar código.

### 2.3. Archivo `main.py` Sobrecargado
*   Actúa como un "cajón de sastre" para Triggers HTTP, Schedulers y configuración CORS.
*   Mezcla lógica de negocio (imports gigantes) con definición de rutas.

---

## 3. Hallazgos Frontend (React/TypeScript)

### 3.1. Tipado Débil (`any`)
En `frontend/src/types/index.ts`, se abusa de `any` en estructuras críticas.
*   `metrics?: { ... [key: string]: number | undefined }` (Aceptable)
*   `ms?: { ... regions?: any; equity_style?: any }` (Peligroso: `any` impide que TypeScript detecte errores de acceso a propiedades nulas).
*   `SmartPortfolioResponse`: Contiene `metrics: any` y `debug: any`.

### 3.2. Configuración Redundante
*   El archivo `package.json` en la **raíz** del proyecto define dependencias (`recharts`) que deberían estar **solo** en `frontend/package.json`. Esto puede causar conflictos de versiones entre lo que instala la raíz y lo que instala el frontend.

### 3.3. Multiplicidad de librerías gráficas
El `frontend` tiene instaladas:
1.  `chart.js`
2.  `plotly.js`
3.  `recharts`
Esto infla innecesariamente el tamaño del bundle final de la aplicación. Se recomienda estandarizar en 1 o máximo 2 librerías.

---

## 4. Recomendaciones Prioritarias

### Corto Plazo (Corrección Rápida)
1.  **Eliminar `recharts` del `package.json` raíz** para limpiar la estructura de dependencias.
2.  **Unificar lógica de Datos:** Refactorizar `optimizer.py` para que use la clase `DataFetcher` de `data_fetcher.py` en lugar de la función suelta en `data.py`. Esto garantizará que el optimizador use datos bien alineados.

### Mediano Plazo (Mejora Estructural)
3.  **Refactorizar Types:** Reemplazar los `any` en `Fund` y `SmartPortfolioResponse` con interfaces explícitas (`RegionBreakdown`, `EquityStyle`, etc.).
4.  **Limpiar `main.py`:** Mover los endpoints a un paquete `controllers/` o `routers/` para que `main.py` solo registre rutas.
5.  **Configuración Dinámica:** Mover los ISINs de fallback (`FALLBACK_CANDIDATES_DEFAULT`) a una colección de configuración en Firestore (`config/optimizer`), como ya se intenta en parte del código, para evitar hardcoding.

---

**Conclusión:**
El código es recuperable y la lógica matemática parece sólida (usando `PyPortfolioOpt`), pero la arquitectura de datos necesita higiene urgente para evitar errores silenciosos en el futuro.
