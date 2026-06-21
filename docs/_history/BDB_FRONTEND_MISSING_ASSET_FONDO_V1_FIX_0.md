# BDB-FONDOS — Frontend Missing Asset Fix
## BDB-FRONTEND-MISSING-ASSET-FONDO-V1-FIX-0 | 2026-05-12

---

## 1. Error

```
Failed to resolve import "../assets/fondo_v1.png" from
"src/pages/RetirementCalculatorPage.tsx". Does the file exist?
```

Vite fallaba en dev y build por un import roto.

---

## 2. Causa Raiz

**El archivo `frontend/src/assets/fondo_v1.png` nunca existio en Git.**

- `git log --all -- frontend/src/assets/fondo_v1.png` devuelve vacio.
- No hay directorio `frontend/src/assets/`.
- El import en `RetirementCalculatorPage.tsx` linea 19 referenciaba un asset local que nunca fue committeado.

El asset se usaba como background-image decorativo del contenedor principal de la pagina.

---

## 3. Solucion

**Preferencia 3: eliminar dependencia visual sin impacto funcional.**

El contenedor ya tenia `bg-[#F4F7FB]` como color de fondo solido.

### Cambios en `RetirementCalculatorPage.tsx`:

```diff
-import fondoImg from '../assets/fondo_v1.png';
```

```diff
-<div className="... bg-cover bg-center bg-fixed bg-no-repeat ..."
-     style={{ backgroundImage: `url(${fondoImg})` }}>
+<div className="... bg-[#F4F7FB] ...">
```

Se eliminaron tambien las clases CSS de background-image (`bg-cover`, `bg-center`, `bg-fixed`, `bg-no-repeat`) que eran no-ops sin imagen.

---

## 4. Hallazgo adicional: .env faltante

Durante la validacion UI se descubrio que `frontend/.env` no existia (esta en `.gitignore`). Esto causaba pagina en blanco porque Firebase SDK se inicializaba con config vacia.

Se restauro `frontend/.env` con la config web de Firebase (obtenida via Firebase MCP). Este archivo es gitignored y no se incluye en el commit.

---

## 5. Validaciones

| Check | Resultado |
|---|---|
| `npm run build` | **OK** — exit code 0, 3687 modules |
| `npm run dev` | **OK** — login page carga correctamente |
| Error pre-auth risk_profiles | **NO aparece** |
| Login form visible | **SI** |
| Pagina en blanco | **RESUELTA** (era por .env faltante) |
| TypeScript | Sin errores nuevos |

---

## 6. Archivos

| Archivo | Accion | En commit |
|---|---|---|
| `frontend/src/pages/RetirementCalculatorPage.tsx` | Eliminar import roto | SI |
| `frontend/.env` | Restaurar config Firebase | NO (gitignored) |

---

## 7. Confirmaciones

| Verificacion | Estado |
|---|---|
| Firestore writes | **0** |
| Deploy | **NO** |
| Rules | **NO tocadas** |
| CORE | **NO tocado** |
| optimizer_core.py | **NO tocado** |
| suitability_engine.py | **NO tocado** |

---

**Fecha**: 2026-05-12
**Autor**: Agente automatico
