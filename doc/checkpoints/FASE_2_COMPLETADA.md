# Fase 2 completada · Nova Assistant

Fecha de cierre: 2026-11-05

Reglas puras en `src/lib/reglas/` con configuración en `src/lib/config/nova.ts`. Ninguna importa pg, red, next ni `process.env`.

## Resultado de `npm test`

```text
Test Files  18 passed (18)
Tests       79 passed (79)   # 47 previas + 32 de reglas (T-01 a T-28 y casos extra)
```

`npm run probar:reglas`: 12/12 OK. `npm run build`: correcto.
