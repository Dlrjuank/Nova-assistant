# Estado de ejecución · Nova Assistant

| Prompt | Estado | Build | Tests | Fecha de cierre |
|---|---|---|---|---|
| P00 Auditoría | completado | correcto | No ejecutados | 2026-10-31 |
| P01 Base de datos (pgvector) | pendiente | | | |
| P02 Reglas de negocio | pendiente | | | |
| P03 Servidor y cliente LLM | pendiente | | | |
| P04 Datos: tareas, documentos, consulta | pendiente | | | |
| P05 API | pendiente | | | |
| P06 Interfaz base y tareas | pendiente | | | |
| P07 Documentos (subida e indexación) | pendiente | | | |
| P08 Chat del asistente | pendiente | | | |
| P09 Aceptación del MVP | pendiente | | | |
| P10 Opcionales: completar tarea e índice | pendiente | | | |
| P11 Opcional: búsqueda en Wikipedia | pendiente | | | |

## Bitácora

### P00 Auditoría

- **Archivos creados:** `Doc/ESTADO_ACTUAL.md`, `.github/copilot-instructions.md`, `Doc/ESTADO_EJECUCION.md`, `Doc/checkpoints/FASE_0_COMPLETADA.md`.
- **Archivos modificados:** ninguno.
- **Comandos ejecutados y resultado:**
  - Inspección local de nombres de variables de `.env.local` y `.env.example` (sin leer ni mostrar valores): completada.
  - `npm run build`: bloqueado por la política de ejecución de PowerShell al invocar `npm.ps1`.
  - `npm.cmd run build`: correcto; build de Next.js completado con compilación, tipos y páginas estáticas.
  - Validación de `GEMINI_API_KEY`: autenticó en la API de modelos. Los modelos nombrados en el plan no están listados; se encontraron `gemini-embedding-001` y `gemini-2.5-flash`.
  - Conexión PostgreSQL y pgvector: con un cliente `pg` temporal, la conexión `NOVAASSISTANT_POSTGRES_URL_NON_POOLING` ejecutó consultas de solo lectura; `vector` está disponible y no instalada. No se añadieron dependencias al proyecto.
  - Pooler `NOVAASSISTANT_POSTGRES_URL` (Transaction pooler/6543): intento de consulta agotó el tiempo; no usar hasta diagnosticar.
  - `BLOB_READ_WRITE_TOKEN`: presente localmente; no se probó una operación de Blob.
- **Problemas y resolución:** `npm run build` fue bloqueado por la política de ejecución de PowerShell; `npm.cmd run build` completó correctamente. Se pudo comprobar pgvector instalando el cliente temporal fuera del proyecto, que luego se eliminó.
- **Pendientes:** P01 puede aplicar migraciones usando `NOVAASSISTANT_POSTGRES_URL_NON_POOLING`. Diagnosticar el timeout del pooler antes de P03/producción; ajustar los modelos Gemini del plan antes de implementar P03. La disponibilidad de claves en Vercel no se ha verificado.
