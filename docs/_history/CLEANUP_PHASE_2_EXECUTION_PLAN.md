# FASE 2 — Plan de Ejecución (Mover `archive` y Borrar `mingit`)

**Fecha:** 2026-05-04
**Estado:** PLAN PREPARADO — No se han ejecutado movimientos ni borrados.
**Referencia:** `docs/CLEANUP_PHASE_1_COMPLETION_REPORT.md`

---

## 1. Análisis y Evidencia de Referencias

Se ha escaneado la totalidad del repositorio buscando referencias cruzadas para garantizar la seguridad de esta operación.

### 1.1 Inventario de `archive/`
- **Tamaño total:** ~117.8 MB
- **Contenido:** 15 archivos. Ningún subdirectorio.
- **Archivos destacados:**
  - `BDB-FONDOS_Backup_Light_20260423_080100.zip` (75 MB) - Backup antiguo.
  - `mingit.zip` (45 MB) - Comprimido de la instalación de mingit.
  - `xray_modulo_completo.zip` (36 KB), `xray_logica_calculo.zip` (12 KB).
  - Varios `.html` (`jon completo.html`, `rosario completo.html`) y un `.pdf` de prueba.
  - Varios pequeños `.json` (`batch_run_...`).
- **Singularidad:** Contiene backups y reportes antiguos, pero ninguno es parte del funcionamiento actual de la aplicación.
- **Referencias en código:** La búsqueda global de `archive` no reveló ninguna importación, ruta dura en el backend, ni referencia en el frontend que apunte a `C:\Users\oanti\Documents\BDB-FONDOS\archive`. (Las únicas menciones a la palabra "archive" ocurren dentro de scripts en `scripts/archive/` como metadata).

### 1.2 Inventario de `mingit/`
- **Tamaño total:** ~106.5 MB
- **Contenido:** Ejecutables y librerías de una instalación Portable Git (MinGit) para Windows.
- **Singularidad:** Es software de terceros. No pertenece al código fuente del proyecto BDB-FONDOS.
- **Referencias en código:** La búsqueda global de `mingit` en todos los archivos de código, JSONs de configuración y scripts arrojó **0 coincidencias**. 
- **Verificación de hooks:** El directorio `.git/hooks/` de este repositorio fue examinado y solo contiene archivos `.sample`, confirmando que no hay hooks activos que dependan de este ejecutable local.

---

## 2. Acciones Propuestas

Estas acciones tienen un riesgo muy bajo ya que se ha demostrado que el código funcional no depende de estas carpetas.

### Acción 1: Externalizar `archive/`
| Riesgo | BAJO |
|---|---|

**Justificación:** Preservar backups históricos pero fuera de la ruta de desarrollo para aligerar el proyecto, búsquedas e IDE.

**Comandos propuestos (NO EJECUTADOS):**
```powershell
$source = "C:\Users\oanti\Documents\BDB-FONDOS\archive"
$dest = "C:\Users\oanti\Documents\BDB-FONDOS-EXTERNAL-ARCHIVE"
New-Item -ItemType Directory -Force -Path $dest
Move-Item -Path "$source\*" -Destination $dest
Remove-Item -Path $source -Recurse -Force
```

### Acción 2: Eliminar `mingit/`
| Riesgo | CERO |
|---|---|

**Justificación:** Software ajeno, no referenciado en el proyecto, ocupando +100MB innecesarios.

**Comandos propuestos (NO EJECUTADOS):**
```powershell
Remove-Item "C:\Users\oanti\Documents\BDB-FONDOS\mingit" -Recurse -Force
```

---

## 3. Elementos que NO se tocarán

Confirmación de protección para las siguientes áreas durante la FASE 2:
- `data/` (se analizará su limpieza en futuras fases)
- `scripts/` y `functions_python/scripts/` (se abordarán en la FASE 3 de unificación)
- **Credenciales y Configuración:**
  - `serviceAccountKey.json`
  - `.env` y `frontend/.env`
  - `firebase.json`, `firestore.rules`, `storage.rules`, `.firebaserc`
  - `package.json`, `package-lock.json`, `requirements.txt`
- **Código Funcional:**
  - `frontend/src/`
  - `functions_python/api/` y `functions_python/services/`

---

## 4. Checklist de Verificación Posterior

Si se aprueba y ejecuta este plan, se deberá comprobar:
- [ ] La carpeta `C:\Users\oanti\Documents\BDB-FONDOS\archive` ya no existe.
- [ ] Sus contenidos están seguros en `C:\Users\oanti\Documents\BDB-FONDOS-EXTERNAL-ARCHIVE`.
- [ ] La carpeta `C:\Users\oanti\Documents\BDB-FONDOS\mingit` ya no existe.
- [ ] El frontend (`npm run dev`) y backend emulado siguen funcionando sin errores.
- [ ] `git status` detectará la eliminación de `archive/` y `mingit/` solo si alguna vez fueron trackeados inadvertidamente.

---

> [!IMPORTANT]
> **Confirmación final:** Ningún comando ha sido ejecutado. El repositorio BDB-FONDOS se mantiene en su estado post-FASE 1. Quedo a la espera de aprobación para ejecutar la FASE 2.
