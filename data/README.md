# /data — JSON Database Layer

Esta carpeta funciona como la capa de persistencia del sistema. Cada archivo `.json` representa una colección.

## Reglas

- Un archivo por colección en singular y kebab-case.
- Cada archivo debe tener `_meta` y `records`.
- Los IDs usan el prefijo de la colección, por ejemplo `ex_001`.
- El tamaño recomendado por archivo es de 5 MB como máximo.
- Los esquemas Zod viven en `_schema/`.
- Los backups automáticos viven en `_backups/` y no se versionan.

## Flujo CRUD

```text
Request -> API Route -> esquema Zod -> json-db -> archivo JSON
                                      |
                                      +-> backup antes de escribir
```

Para crear una colección, agrega `data/nombre.json`, su esquema en `data/_schema/` y registra el esquema en `registry.ts`.

En Vercel el sistema funciona en modo lectura: la persistencia de producción requiere una base de datos o almacenamiento externo.
