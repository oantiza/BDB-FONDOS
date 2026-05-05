# Push Report — Post-Cleanup

**Fecha:** 2026-05-04  
**Remote:** `https://github.com/oantiza/BDB-FONDOS.git`  
**Rama:** `master`  
**Rango:** `2ef8162..4049298`

---

## Commits Pusheados (19)

| # | Hash | Mensaje |
|---|---|---|
| 1 | `4bc29fb` | Add start year selector to Comparador Patrimonial |
| 2 | `cca9cc2` | Add Anexo: Letras del Tesoro rates per year with source in report |
| 3 | `20768a2` | Add YoY inflation data to the macro annexe table |
| 4 | `1681d18` | Move macro annexe to a separate PDF page |
| 5 | `6058a2a` | Clean up macro data sources text and remove logo from annexe |
| 6 | `8b095ab` | chore: consolidate repository cleanup phases 1-3 |
| 7 | `18e86e3` | chore: add credential safety examples and gitignore hardening |
| 8 | `64bb990` | chore: document credential setup and support env-based Firebase init |
| 9 | `42f16ed` | chore: support env-based Firebase init in read-only JS tools |
| 10 | `e2f687a` | chore: support env-based Firebase init in residual read-only Python tools |
| 11 | `0654592` | chore: support env-based Firebase init in dry-run mutating tools |
| 12 | `9b0beee` | chore: support env-based Firebase init in readonly snapshot tools |
| 13 | `8f0f027` | chore: support env-based Firebase init in scoped mutating tools |
| 14 | `23099da` | chore: support env-based Firebase init in medium-risk mutating tools |
| 15 | `1b1ffec` | chore: finalize cleanup documentation and remove obsolete files |
| 16 | `0a71c01` | feat: update xray and macro endpoints before deployment validation |
| 17 | `a131405` | chore: document post-cleanup commit reports |
| 18 | `cf65f3a` | chore: require authentication for Firestore reads |
| 19 | `4049298` | docs: add firestore rules commit report |

---

## Confirmaciones

- ✅ **Push completado** a `origin/master`.
- ✅ **Working tree limpio** — 0 archivos pendientes.
- ✅ **0 commits pendientes** — local = remote.
- ✅ **Credenciales NO trackeadas** — `.env.example` son templates sin secretos.
- ✅ **No se ejecutó deploy** — solo push.
- ✅ **No se ejecutó `firebase deploy`.**

---

## Próxima Fase: Deploy Incremental

```
1. firebase deploy --only functions     ← API con auth headers
2. firebase deploy --only hosting       ← Frontend con getIdToken()
3. Verificar login + lecturas en producción
4. firebase deploy --only firestore:rules  ← AL FINAL
```

> ⚠️ **Desplegar rules DESPUÉS de functions + hosting** para evitar bloqueo de lecturas antes de que el frontend tenga auth.
