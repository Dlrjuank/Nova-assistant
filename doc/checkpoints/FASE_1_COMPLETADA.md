# Fase 1 completada · Nova Assistant

Fecha de cierre: 2026-11-05

Base de datos con pgvector lista: M1 (extensión y tablas), M2 (índice, función `buscar_fragmentos`, RLS) y M3 (índice HNSW, desviación del plan explicada en la bitácora). `npm run build` y `npm test` (47 pruebas) sin errores.

## Salida de `npm run db:verificar`

```text
== 1. Extensión
OK    extensión vector instalada (v0.8.2)
== 2. Existencia
OK    tabla tareas_personales
OK    tabla documentos
OK    tabla fragmentos_pdf
OK    tabla fuentes_web
OK    función buscar_fragmentos
== 3. Filas por tabla
     tareas_personales: 0
     documentos: 0
     fragmentos_pdf: 0
     fuentes_web: 0
== 4. Restricciones e índice
     tareas_cierre_coherente: CHECK (((((estado)::text = 'Completada'::text) AND (fecha_cierre IS NOT NULL)) OR (((estado)::text <> 'Completada'::text) AND (fecha_cierre IS NULL))))
     tareas_estado_valido: CHECK (((estado)::text = ANY ((ARRAY['Pendiente'::character varying, 'En Progreso'::character varying, 'Completada'::character varying])::text[])))
     tareas_minutos_validos: CHECK ((minutos_invertidos >= 0))
     tareas_personales_pkey: PRIMARY KEY (id)
     tareas_prioridad_valida: CHECK (((prioridad >= 1) AND (prioridad <= 3)))
     tareas_titulo_minimo: CHECK ((char_length(btrim((titulo)::text)) >= 1))
OK    índice idx_fragmentos_vector
== 5. RLS
OK    RLS activo en tareas_personales
OK    RLS activo en documentos
OK    RLS activo en fragmentos_pdf
OK    RLS activo en fuentes_web
== 6. Integridad (transacción con ROLLBACK)
OK    a) tarea válida: Pendiente, prioridad 2 por defecto
OK    b) prioridad 5: 23514 (tareas_prioridad_valida)
OK    c) prioridad 0: 23514 (tareas_prioridad_valida)
OK    d) Completada sin fecha_cierre: 23514 (tareas_cierre_coherente)
OK    e) documento y 2 fragmentos de 768 dimensiones
OK    f) buscar_fragmentos: #1@0.0194, #2@0.8039
OK    g) fragmento duplicado (documento, numero): 23505 (fragmentos_unico_por_doc)
== 7. Total de fallas: 0
```
