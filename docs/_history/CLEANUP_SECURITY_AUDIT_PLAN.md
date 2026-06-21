# Plan de Auditoría, Limpieza y Seguridad (BDB-FONDOS)

**Fecha:** 2026-05-04
**Estado:** Modo Auditoría — Ningún cambio destructivo ejecutado.

Este documento presenta una auditoría técnica inicial del repositorio para identificar riesgos de seguridad, archivos pesados e innecesarios, duplicidades y un plan de saneamiento.

---

## 1. Archivos Sensibles Detectados (Riesgo Alto)
Estos archivos contienen secretos que permiten acceso completo a la base de datos o APIs externas. Actualmente no están en el control de versiones de Git gracias al `.gitignore`, pero residen peligrosamente en el entorno de trabajo local.
- `serviceAccountKey.json` (Root): Contiene la clave privada de Firebase (`firebase-adminsdk-fbsvc@bdb-fondos.iam.gserviceaccount.com`).
- `.env` (Root): Contiene la clave real de Gemini API (`GEMINI_API_KEY`).
- `frontend/.env`: Contiene toda la configuración de conexión de Firebase Web (API Key, Project ID, etc.).

## 2. Archivos Basura y Pesados que Deben Salir del Repositorio
Se ha detectado gran acumulación de logs, binarios y copias de seguridad estáticas.
- `BDB-FONDOS-codigo-fuente.zip` (~130MB): Generado recientemente en raíz.
- `deploy_debug.log` (300KB), `firestore-debug.log`, y `functions_python/firebase-debug.log` (750KB).
- **Todo el directorio `/archive/`**: Contiene backups pesados como `BDB-FONDOS_Backup_Light_20260423_080100.zip` (75MB) y `mingit.zip` (45MB).
- `zip_project_script.py`: Script residual de empaquetado.

## 3. Entradas Faltantes en `.gitignore`
Aunque hay exclusiones buenas (`*.zip`, `*.log`), convendría añadir estas protecciones explícitas para evitar accidentes:
- `.pytest_cache/` (actualmente en raíz, no ignorado explícitamente).
- `data/` o al menos su contenido dinámico (`data/error/*`, `data/processed_pdfs/*`).
- `zip_project_script.py` y cualquier otro script desechable futuro.
- `functions_python/.pytest_cache/` y `functions_python/firebase-debug.log`.

## 4. Directorios Candidatos a Eliminar o Mover (Archive External)
Estos directorios no pertenecen al ciclo de vida del código activo de la aplicación:
- **`mingit/`**: Una instalación standalone de Git. No debe estar anidada dentro del repositorio. Eliminar del todo.
- **`archive/`**: Repositorio pasivo de HTMLs, PDFs antiguos y ZIPs. Debe moverse a una unidad externa (ej. Google Drive del proyecto).
- **`data/`**: Contiene carpetas temporales (`canonical`, `error`, `processed_pdfs`, `review`, `work`). Su contenido debe purgarse periódicamente.
- **`tests/` vs `functions_python/tests/`**: Hay confusión entre tests globales y tests del backend.

## 5. Duplicidades Evidentes
- **Dispersión de Scripts:** Existen los directorios `/scripts/`, `/functions_python/scripts/` y `/frontend/scripts/`.
  - Ejemplo: `infer_region_primary_bdb.py` existe en `/scripts/` y en `/functions_python/scripts/` con diferentes tamaños de bytes, lo cual es un riesgo grave de ejecución de código desactualizado.
- **Carpetas internas duplicadas**: Existen subcarpetas `archive`, `sandbox` y `maintenance` tanto en `/scripts/` como en `/functions_python/scripts/`.

## 6. Riesgos de Romper el Programa al Limpiar
- **Riesgo Crítico**: Eliminar `serviceAccountKey.json` romperá instantáneamente los scripts Python locales de mantenimiento o migraciones y potencialmente el emulador de funciones.
- **Riesgo Crítico**: Eliminar `frontend/.env` romperá el arranque local de Vite y el build, impidiendo al frontend hablar con la base de datos de Firebase.
- **Riesgo Medio**: Borrar las carpetas internas de `/data/` podría causar excepciones `FileNotFoundError` en scripts de procesamiento de PDFs si dichos scripts asumen que los directorios `work` o `error` ya están creados y no usan `os.makedirs(exist_ok=True)`.

## 7. Plan de Limpieza por Fases (Safe-First Approach)
- **FASE 1 (Riesgo Cero):** Eliminar la basura generada pasiva. Borrar `.zip` sueltos en raíz, `.log` en raíz y backend, y `zip_project_script.py`. Asegurar que el `.gitignore` proteja la carpeta `data/`.
- **FASE 2 (Riesgo Bajo):** Mover la carpeta `/archive/` entera a almacenamiento externo local y borrar `/mingit/`.
- **FASE 3 (Riesgo Medio):** Unificar scripts. Comparar el contenido de `/scripts/` y `/functions_python/scripts/`, definir `/functions_python/scripts/` como única fuente de verdad y mover lo sobrante a una carpeta Legacy externa.
- **FASE 4 (Gestión Segura):** Implementar carga de credenciales con Google Cloud impersonation o un `.env.local` estricto, rotar la API Key de Gemini, y plantear la retirada de `serviceAccountKey.json` de este disco a largo plazo.

## 8. Lista de Archivos Intocables (DO NOT TOUCH)
Hasta nuevo aviso y consolidación, **NO modificar ni eliminar**:
- `serviceAccountKey.json` (Raíz)
- `.env` (Raíz y Frontend)
- Toda la carpeta `frontend/src/*` y `functions_python/api/*`.
- Configuración de Firebase (`firebase.json`, `firestore.rules`, `.firebaserc`, `storage.rules`).
- Manifiestos de paquetes (`package.json`, `requirements.txt`).
