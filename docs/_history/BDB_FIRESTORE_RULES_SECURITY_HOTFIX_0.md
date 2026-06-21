# BDB-FONDOS — Firestore Rules Security Hotfix
## BDB-FIRESTORE-RULES-SECURITY-HOTFIX-0

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-05-10 |
| **Branch** | `master` |
| **HEAD pre-hotfix** | `18d17c4` |
| **Archivo modificado** | `firestore.rules` (1 línea) |
| **Deploy** | `firebase deploy --only firestore` — exitoso |

---

## Motivo

La verificación `BDB_AUDIT_2026_05_10_VERIFICATION_0.md` detectó:

1. **Producción** tenía catch-all `/{document=**}` con `allow read: if true` — público sin autenticación.
2. **Producción** tenía `analysis_results` y `synthetic_benchmarks` con lectura pública.
3. **Local** (HEAD `18d17c4`) ya tenía las correcciones para los puntos 1 y 2, **PERO** `system_settings` local tenía `allow read: if true; // Temporarily public for verification`.
4. Si se desplegaba local tal cual, `system_settings` en producción **regresaría** a público (producción ya lo tenía endurecido).

## Estado ANTES del Hotfix

### Producción (Firebase)
| Colección | Regla read |
|-----------|-----------|
| `funds_v3` | `isAuthenticated()` ✅ |
| `historico_vl_v2` | `isAuthenticated()` ✅ |
| `system_settings` | `isAuthenticated()` ✅ |
| `analysis_results` | `if true` ⛔ |
| `synthetic_benchmarks` | `if true` ⛔ |
| `reports` | `isAuthenticated()` ✅ |
| catch-all `/{document=**}` | `allow read: if true` ⛔ |

### Local (firestore.rules)
| Colección | Regla read |
|-----------|-----------|
| `funds_v3` | `isAuthenticated()` ✅ |
| `historico_vl_v2` | `isAuthenticated()` ✅ |
| `system_settings` | `if true` ⛔ ← **REGRESIÓN POTENCIAL** |
| `analysis_results` | `isAuthenticated()` ✅ |
| `synthetic_benchmarks` | `isAuthenticated()` ✅ |
| `reports` | `isAuthenticated()` ✅ |
| catch-all `/{document=**}` | `if false` ✅ |

## Cambio Exacto

```diff
 match /system_settings/{document=**} {
-      allow read: if true; // Temporarily public for verification
+      allow read: if isAuthenticated();
       allow write: if isAdmin();
 }
```

## Estado DESPUÉS del Hotfix

### Producción (Firebase) — verificado via `firebase_get_security_rules`
| Colección | Regla read |
|-----------|-----------|
| `funds_v3` | `isAuthenticated()` ✅ |
| `historico_vl_v2` | `isAuthenticated()` ✅ |
| `system_settings` | `isAuthenticated()` ✅ |
| `analysis_results` | `isAuthenticated()` ✅ |
| `synthetic_benchmarks` | `isAuthenticated()` ✅ |
| `reports` | `isAuthenticated()` ✅ |
| catch-all `/{document=**}` | `allow read, write: if false` ✅ |

**Zero** instancias de `allow read: if true` en producción.

## Verificaciones Realizadas

1. ✅ `Select-String "allow read: if true"` → 0 matches en local
2. ✅ `Select-String "Temporarily"` → 0 matches en local
3. ✅ `firebase_validate_security_rules` → "OK: No errors detected"
4. ✅ `firebase deploy --only firestore` → 100% success
5. ✅ `firebase_get_security_rules` post-deploy → todas las colecciones protegidas
6. ✅ `git diff` → solo 1 línea modificada en `firestore.rules`

## Confirmación de No-Touch

| Componente | ¿Tocado? |
|-----------|----------|
| Functions (Python backend) | NO |
| Hosting (Frontend) | NO |
| Optimizer | NO |
| Parser | NO |
| firestore.indexes.json | NO |
| Datos de Firestore | NO |
| BDB-FONDOS-CORE | NO |

## Riesgos Cerrados

| Hallazgo | Riesgo | Estado |
|----------|--------|--------|
| F-01: catch-all público | CRÍTICO | ✅ CERRADO |
| F-09: `analysis_results` público | ALTO | ✅ CERRADO |
| F-10: `synthetic_benchmarks` público | ALTO | ✅ CERRADO |
| FA-01: `system_settings` regresión | ALTO | ✅ CERRADO |
