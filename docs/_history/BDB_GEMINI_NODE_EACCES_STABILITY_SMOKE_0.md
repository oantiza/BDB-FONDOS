# BDB-GEMINI-NODE-EACCES-STABILITY-SMOKE-0

## Resultados de Pruebas

### 1. Gemini Minimal Calls
- **Intento 1:** OK (`GEMINI_MINIMAL_OK`)
- **Intento 2:** OK (`GEMINI_MINIMAL_OK`)
- **Intento 3:** OK (`GEMINI_MINIMAL_OK`)

### 2. Ejecuciones de Parser (Dry Run)
- **`parser --limit 1`**: OK (1 procesado, 0 errores, Exit code: 0)
- **`parser --limit 5`**: OK (4 OK, 1 REVIEW, 0 errores, Exit code: 0)

### 3. Diagnóstico
Durante la ejecución de las pruebas limitadas (hasta 5 llamadas concurrentes/secuenciales), **NO** se reprodujo el error `EACCES` hacia `generativelanguage.googleapis.com`.

**Causa Probable del `EACCES` en ejecuciones mayores:**
Dado que las llamadas individuales y en pequeños lotes funcionan correctamente, el error `EACCES` en Node.js sobre Windows al hacer peticiones HTTPS masivas generalmente está relacionado con:
1. **Agotamiento de Puertos Efímeros (Port Exhaustion):** Windows tiene un límite en la cantidad de puertos TCP disponibles. Si se hacen muchas llamadas rápidamente, se pueden agotar, y el OS rechaza nuevas conexiones (a veces se manifiesta como `EACCES` o `EADDRINUSE`).
2. **Bloqueo de Antivirus / Firewall:** Sistemas de seguridad (como Windows Defender o firewalls corporativos) pueden interceptar y bloquear (con `EACCES`) el proceso de Node si detectan un pico anómalo de conexiones salientes simultáneas.

**Siguiente Acción Recomendada:**
1. Realizar una prueba aumentando el límite gradualmente (ej. `--limit 15` o `--limit 20`) para identificar el umbral exacto donde el error comienza a ocurrir.
2. Probar ejecutando el parser reduciendo la concurrencia (ej. agregando un control de concurrencia menor, de `10` a `2` o `3`) para mitigar el agotamiento de sockets/bloqueos por ráfagas de red.
3. Revisar el Visor de Eventos de Windows o los registros del Antivirus en el momento en que se produce el fallo para confirmar bloqueos de red.

### 4. Checklist de Reglas de Ejecución
- **Firestore writes:** 0 (Se ejecutó exclusivamente en modo `dry_run` con escritura deshabilitada).
- **PDFs movidos:** 0 (Se utilizó la flag `--no-move-files`).
- **commit:** NO realizado.
- **push:** NO realizado.
- **Modificaciones a BDB-FONDOS-CORE:** Ninguna.
- **Modificaciones al parser productivo:** Ninguna.
