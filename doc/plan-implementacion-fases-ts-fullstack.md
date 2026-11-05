# Plan de Implementación por Fases — Sistema Fullstack TypeScript

> **Documento complementario a:** Plan de Infraestructura Fullstack TS  
> **Arquitecto:** Claude (Asistente IA)  
> **Solicitante:** Jhonatan Castro — CTSO  
> **Fecha:** 25 de marzo de 2026  
> **Versión:** 1.0

---

## Índice de Fases

```
FASE 0 ─ Scaffolding & Validación .............. Fundación del proyecto
FASE 1 ─ Motor de Datos JSON ................... Capa de persistencia
FASE 2 ─ Sistema UI & Layout ................... Interfaz base
FASE 3 ─ Funcionalidad Core .................... Lógica de negocio
FASE 4 ─ Producción & Escala ................... Hardening final
```

```
 FASE 0          FASE 1          FASE 2          FASE 3          FASE 4
┌──────┐       ┌──────┐        ┌──────┐       ┌──────┐        ┌──────┐
│Scaff.│──────►│Data  │───────►│ UI   │──────►│ Core │───────►│ Prod │
│ olding│       │Engine│        │Layout│       │ Logic│        │Scale │
└──────┘       └──────┘        └──────┘       └──────┘        └──────┘
  3-4 días       5-7 días       5-7 días       7-10 días       5-7 días
                                                          Total: 25-35 días
```

---

## Convenciones de este documento

| Símbolo | Significado |
|---|---|
| ★ | Tarea crítica (bloquea siguientes) |
| ○ | Tarea secundaria (puede paralelizarse) |
| ⚡ | Tarea rápida (< 1 hora) |
| 🧪 | Requiere testing antes de avanzar |
| 📦 | Genera un entregable o artefacto |
| 🔗 | Tiene dependencia de otra tarea |
| ✅ | Criterio de aceptación (gate de fase) |

---

---

# FASE 0 — Scaffolding & Validación

> **Objetivo:** Tener el proyecto creado, configurado, desplegado en Vercel con un Home "Hola Mundo" animado y una API de salud funcional. Esta fase valida que toda la cadena TypeScript → Build → Deploy funciona sin errores.

**Duración estimada:** 3–4 días  
**Branch de trabajo:** `main` (setup inicial directo) + `develop` a partir del primer commit funcional

---

### Tarea 0.1 — Crear repositorio GitHub ★

**Acciones:**

1. Crear repositorio en GitHub (nombre del proyecto a definir)
2. Inicializar con README.md y `.gitignore` para Node.js
3. Configurar branch protection en `main`: requerir PR + checks passing
4. Crear branch `develop` desde `main`

**Configuración del `.gitignore`:**

```gitignore
node_modules/
.next/
.env
.env.local
.vercel/
*.tsbuildinfo
data/_backups/
coverage/
```

**Entregable:** 📦 Repositorio GitHub listo con branches `main` y `develop`

---

### Tarea 0.2 — Scaffolding Next.js con TypeScript ★ 🔗(0.1)

**Acciones:**

1. Ejecutar scaffolding del proyecto:
   ```bash
   npx create-next-app@latest nombre-proyecto \
     --typescript \
     --tailwind \
     --eslint \
     --app \
     --src-dir \
     --import-alias "@/*"
   ```
2. Verificar que el proyecto arranca sin errores: `npm run dev`
3. Verificar que TypeScript compila: `npx tsc --noEmit`

**Entregable:** 📦 Proyecto Next.js 15 + TypeScript funcional en local

---

### Tarea 0.3 — Instalar dependencias del stack ⚡ 🔗(0.2)

**Dependencias de producción:**

```bash
npm install framer-motion zod
```

**Dependencias de desarrollo:**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom \
  jsdom prettier @vitejs/plugin-react
```

**Verificación:** `npm run build` debe completar sin errores tras la instalación.

**Entregable:** 📦 `package.json` con todas las dependencias declaradas

---

### Tarea 0.4 — Configurar TypeScript estricto ★ 🔗(0.2)

**Modificar `tsconfig.json`:**

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
      "@data/*": ["./data/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Verificación 🧪:** `npx tsc --noEmit` pasa limpio con cero errores y cero warnings.

**Entregable:** 📦 `tsconfig.json` con strict mode completo

---

### Tarea 0.5 — Configurar Prettier y ESLint ○ 🔗(0.2)

**Crear `.prettierrc`:**

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always"
}
```

**Ajustar `.eslintrc.json`:**

```json
{
  "extends": ["next/core-web-vitals", "next/typescript", "prettier"],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "error",
    "prefer-const": "error"
  }
}
```

**Agregar scripts en `package.json`:**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "format": "prettier --write \"src/**/*.{ts,tsx,css}\"",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Entregable:** 📦 Configuración de linting y formateo lista

---

### Tarea 0.6 — Configurar Vitest ○ 🔗(0.3)

**Crear `vitest.config.ts`:**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@data': path.resolve(__dirname, './data'),
    },
  },
});
```

**Crear `src/test/setup.ts`:**

```typescript
import '@testing-library/jest-dom';
```

**Entregable:** 📦 Framework de testing funcional

---

### Tarea 0.7 — Crear estructura de carpeta /data ★ 🔗(0.2)

**Crear la estructura base:**

```
data/
├── _schema/
│   └── .gitkeep
├── _backups/               ← En .gitignore
│   └── .gitkeep
├── example.json
└── README.md
```

**Contenido de `data/example.json`:**

```json
{
  "_meta": {
    "version": 1,
    "lastModified": "2026-03-25T12:00:00Z",
    "description": "Colección de ejemplo para validar el motor JSON-DB"
  },
  "records": [
    {
      "id": "ex_001",
      "createdAt": "2026-03-25T12:00:00Z",
      "updatedAt": "2026-03-25T12:00:00Z",
      "name": "Registro de prueba",
      "active": true
    }
  ]
}
```

**Contenido de `data/README.md`:**

```markdown
# /data — JSON Database Layer

Esta carpeta funciona como la capa de persistencia del sistema.
Cada archivo `.json` representa una colección.

## Reglas
- Un archivo por colección (singular, kebab-case)
- Cada archivo debe tener `_meta` y `records`
- IDs con prefijo de colección: `ex_001`, `usr_001`
- Máximo recomendado: 5 MB por archivo
- Los esquemas Zod van en `_schema/`
- Los backups automáticos van en `_backups/` (gitignored)
```

**Entregable:** 📦 Carpeta `/data` con estructura y documentación

---

### Tarea 0.8 — Crear variables de entorno ⚡ 🔗(0.2)

**Crear `.env.example`:**

```bash
# ─── Aplicación ───
NODE_ENV=development
NEXT_PUBLIC_APP_NAME="Sistema TS Fullstack"
NEXT_PUBLIC_APP_VERSION="0.1.0"

# ─── Capa de datos ───
DATA_DIR=./data
```

**Crear `.env.local`** (copiar de `.env.example` y ajustar; ya está en `.gitignore`).

**Entregable:** 📦 Variables de entorno documentadas

---

### Tarea 0.9 — Implementar API /api/health ★ 🔗(0.4)

**Crear `src/app/api/health/route.ts`:**

```typescript
import { NextResponse } from 'next/server';

interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  environment: string;
  version: string;
  uptime: number;
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'unknown',
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0',
    uptime: process.uptime(),
  });
}
```

**Verificación 🧪:** `curl http://localhost:3000/api/health` devuelve JSON con `status: "ok"`.

**Test unitario — `src/app/api/health/route.test.ts`:**

```typescript
import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('/api/health', () => {
  it('responde con status ok', async () => {
    const response = await GET();
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });
});
```

**Entregable:** 📦 API de salud funcional con test

---

### Tarea 0.10 — Implementar Home "Hola Mundo" ★ 🔗(0.3, 0.4)

**Arquitectura del componente:**

```
src/app/page.tsx              ← Server Component (wrapper)
  └── components/home/
      └── HolaMundo.tsx       ← Client Component ("use client")
          ├── AnimatedBackground   (gradiente mesh animado)
          ├── AnimatedTitle         ("Hola" + "Mundo" con stagger)
          ├── AnimatedDivider       (línea expandible)
          ├── AnimatedSubtitle      (texto descriptivo)
          └── TypeScriptBadge       (badge bounce-in)
```

**Especificación de `src/app/page.tsx`:**

```typescript
import { HolaMundo } from '@/components/home/HolaMundo';

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <HolaMundo />
    </main>
  );
}
```

**Especificación de `src/components/home/HolaMundo.tsx`:**

Componente `"use client"` que utiliza Framer Motion con las siguientes animaciones orquestadas:

| Elemento | Prop `initial` | Prop `animate` | Transición |
|---|---|---|---|
| Fondo gradiente | `backgroundPosition: '0% 50%'` | `backgroundPosition: '100% 50%'` | `duration: 8, repeat: Infinity, repeatType: 'reverse'` |
| "Hola" | `{ opacity: 0, y: 30, filter: 'blur(10px)' }` | `{ opacity: 1, y: 0, filter: 'blur(0px)' }` | `duration: 0.8, delay: 0.2, ease: 'easeOut'` |
| "Mundo" | `{ opacity: 0, y: 30, filter: 'blur(10px)' }` | `{ opacity: 1, y: 0, filter: 'blur(0px)' }` | `duration: 0.8, delay: 0.5, ease: 'easeOut'` |
| Línea divisora | `{ scaleX: 0 }` | `{ scaleX: 1 }` | `duration: 0.6, delay: 1.0, ease: 'easeInOut'` |
| Subtítulo | `{ opacity: 0 }` | `{ opacity: 1 }` | `duration: 0.5, delay: 1.3` |
| Badge TS | `{ scale: 0 }` | `{ scale: 1 }` | `type: 'spring', delay: 1.6, stiffness: 260, damping: 20` |

**Paleta de colores del gradiente:**

```css
/* Modo oscuro (por defecto) */
--gradient-1: #0f0c29;
--gradient-2: #302b63;
--gradient-3: #24243e;

/* Acentos */
--accent-primary: #3b82f6;    /* blue-500 */
--accent-secondary: #8b5cf6;  /* violet-500 */
```

**Tipografía:**

```
"Hola"      →  text-7xl sm:text-8xl md:text-9xl  font-extrabold  tracking-tighter
"Mundo"     →  text-7xl sm:text-8xl md:text-9xl  font-extrabold  tracking-tighter
Subtítulo   →  text-lg sm:text-xl  font-light  text-white/60  tracking-wide
Badge       →  text-sm  font-mono  px-4 py-2  rounded-full  border border-white/20
```

**Entregable:** 📦 Componente Home animado y responsivo

---

### Tarea 0.11 — Configurar Layout raíz ⚡ 🔗(0.10)

**Actualizar `src/app/layout.tsx`:**

```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? 'Sistema TS',
  description: 'Sistema fullstack TypeScript con JSON Database Layer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="antialiased bg-gray-950 text-white">
        {children}
      </body>
    </html>
  );
}
```

**Entregable:** 📦 Layout raíz con metadata y fuente configurada

---

### Tarea 0.12 — Vincular con Vercel ★ 🔗(0.1)

**Acciones:**

1. Ir a [vercel.com/dashboard](https://vercel.com/dashboard)
2. **Add New Project** → Importar repositorio GitHub
3. Framework preset: **Next.js** (autodetectado)
4. Configurar variables de entorno en Vercel Dashboard:
   - `NEXT_PUBLIC_APP_NAME` = nombre del sistema
   - `NEXT_PUBLIC_APP_VERSION` = `0.1.0`
5. Deploy inicial

**Configuración de branches en Vercel:**

```
Production Branch:  main
Preview Branches:   develop, feature/*
Ignored Branches:   fix/* (opcional)
```

**Verificación 🧪:** La URL de Vercel carga el Home "Hola Mundo" correctamente.

**Entregable:** 📦 Proyecto Vercel vinculado con deploy automático

---

### Tarea 0.13 — Configurar GitHub Actions CI ○ 🔗(0.6, 0.9)

**Crear `.github/workflows/ci.yml`:**

```yaml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  quality:
    name: Lint, Type Check & Test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Run tests
        run: npm run test

      - name: Build
        run: npm run build
```

**Entregable:** 📦 Pipeline CI funcional en GitHub Actions

---

### Gate de Fase 0 — Criterios de Aceptación

```
✅  Home muestra "Hola Mundo" centrado con animación elegante
✅  GET /api/health responde { status: "ok" }
✅  tsc --noEmit pasa sin errores
✅  npm run lint pasa sin errores
✅  npm run test pasa (mínimo test de health)
✅  Deploy exitoso en Vercel desde main
✅  Carpeta /data existe con example.json válido
✅  GitHub Actions CI pipeline pasa en verde
```

**Solo se avanza a Fase 1 cuando TODOS los criterios están cumplidos.**

---

---

# FASE 1 — Motor de Datos JSON

> **Objetivo:** Implementar la capa de persistencia completa basada en archivos JSON, con operaciones CRUD tipadas, validación Zod, manejo de concurrencia y API Routes genéricas que expongan los datos.

**Duración estimada:** 5–7 días  
**Branch de trabajo:** `feature/json-db-engine`  
**Dependencia:** Fase 0 completada

---

### Tarea 1.1 — Definir tipos base del motor ★

**Crear `src/lib/types.ts`:**

```typescript
// Tipos fundamentales del motor JSON-DB

export interface CollectionMeta {
  version: number;
  lastModified: string;
  description: string;
}

export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionFile<T extends BaseRecord = BaseRecord> {
  _meta: CollectionMeta;
  records: T[];
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface QueryResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export type CreateInput<T extends BaseRecord> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateInput<T extends BaseRecord> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;
```

**Entregable:** 📦 Sistema de tipos core del motor

---

### Tarea 1.2 — Implementar utilidades ⚡ 🔗(1.1)

**Crear `src/lib/utils.ts`:**

```typescript
// Helpers que utiliza el motor

export function generateId(prefix: string): string;
export function now(): string;               // ISO timestamp
export function deepClone<T>(obj: T): T;     // structuredClone wrapper
export function safeJsonParse<T>(raw: string): T | null;
```

| Función | Implementación |
|---|---|
| `generateId` | `${prefix}_${crypto.randomUUID().split('-')[0]}` |
| `now` | `new Date().toISOString()` |
| `deepClone` | `structuredClone(obj)` con fallback a `JSON.parse(JSON.stringify())` |
| `safeJsonParse` | Try/catch wrapper que retorna `null` en error |

**Entregable:** 📦 Módulo de utilidades

---

### Tarea 1.3 — Implementar json-db.ts (motor CRUD) ★ 🔗(1.1, 1.2)

**Crear `src/lib/json-db.ts`** con la siguiente estructura interna:

```
json-db.ts
├── resolveCollectionPath(name)     → Retorna ruta absoluta al .json
├── readCollection<T>(name)         → Lee y parsea el archivo
├── writeCollection<T>(name, data)  → Escribe con mutex + backup
├── getAll<T>(name, options?)       → Lista con paginación/sort
├── getById<T>(name, id)            → Busca por ID
├── create<T>(name, input)          → Inserta registro nuevo
├── update<T>(name, id, partial)    → Actualiza parcialmente
├── remove(name, id)                → Elimina por ID
├── query<T>(name, filter)          → Filtro con función predicado
└── count(name)                     → Total de registros
```

**Decisiones de implementación:**

| Aspecto | Detalle |
|---|---|
| **Lectura** | `fs.readFile` + `JSON.parse` con tipado genérico |
| **Escritura** | `JSON.stringify(data, null, 2)` + `fs.writeFile` atómico |
| **Mutex** | Map interno `locks: Map<string, Promise<void>>` para serializar escrituras por archivo |
| **Backup** | Antes de cada escritura, copiar estado actual a `data/_backups/{collection}_{timestamp}.json` |
| **Errores** | Clase custom `JsonDBError` con códigos: `NOT_FOUND`, `DUPLICATE_ID`, `VALIDATION_ERROR`, `IO_ERROR` |
| **Ambiente** | Detectar `process.env.NODE_ENV`: en producción, los métodos de escritura lanzan `ReadOnlyError` |

**Entregable:** 📦 Motor CRUD completo y tipado

---

### Tarea 1.4 — Crear sistema de esquemas Zod ★ 🔗(1.1)

**Crear `data/_schema/base.schema.ts`:**

```typescript
import { z } from 'zod';

export const baseRecordSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const collectionMetaSchema = z.object({
  version: z.number().int().positive(),
  lastModified: z.string().datetime(),
  description: z.string(),
});

export const collectionFileSchema = z.object({
  _meta: collectionMetaSchema,
  records: z.array(baseRecordSchema),
});
```

**Crear `data/_schema/example.schema.ts`:**

```typescript
import { z } from 'zod';
import { baseRecordSchema } from './base.schema';

export const exampleRecordSchema = baseRecordSchema.extend({
  name: z.string().min(1).max(255),
  active: z.boolean(),
});

export type ExampleRecord = z.infer<typeof exampleRecordSchema>;
```

**Crear `data/_schema/registry.ts`:**

```typescript
// Registro central: mapea nombre de colección → esquema Zod
import { ZodSchema } from 'zod';
import { exampleRecordSchema } from './example.schema';

export const schemaRegistry: Record<string, ZodSchema> = {
  example: exampleRecordSchema,
};

export function getSchema(collection: string): ZodSchema | null {
  return schemaRegistry[collection] ?? null;
}
```

**Entregable:** 📦 Sistema de validación con registro central

---

### Tarea 1.5 — Implementar API Routes CRUD genéricas ★ 🔗(1.3, 1.4)

**Crear `src/app/api/data/[collection]/route.ts`:**

```
Método    Acción              Parámetros
──────    ──────              ──────────
GET       Listar / Obtener    ?id=xxx, ?limit=N, ?offset=N, ?sortBy=field, ?sortOrder=asc|desc
POST      Crear               Body JSON validado contra esquema Zod
PUT       Actualizar          Body JSON con { id, ...campos }
DELETE    Eliminar            ?id=xxx
```

**Flujo interno de cada método:**

```
Request
  │
  ├─► Extraer nombre de colección desde params
  ├─► Validar que la colección existe en schemaRegistry
  ├─► (POST/PUT) Parsear body + validar con Zod
  ├─► Ejecutar operación en json-db
  ├─► Retornar respuesta tipada
  │
  └─► En error → { error: string, code: string, status: 4xx/5xx }
```

**Formato de respuesta estándar:**

```typescript
// Éxito
interface ApiSuccess<T> {
  success: true;
  data: T;
  timestamp: string;
}

// Error
interface ApiError {
  success: false;
  error: string;
  code: string;
  timestamp: string;
}
```

**Entregable:** 📦 API REST genérica funcional sobre colecciones JSON

---

### Tarea 1.6 — Tests del motor JSON-DB 🧪 🔗(1.3)

**Crear `src/lib/__tests__/json-db.test.ts`:**

| Test | Descripción |
|---|---|
| `getAll` retorna todos los registros | Lee `example.json` y verifica array |
| `getById` retorna registro correcto | Busca `ex_001` y valida campos |
| `getById` retorna null si no existe | Busca ID inexistente |
| `create` inserta registro nuevo | Crea, verifica ID generado y timestamps |
| `update` modifica campos parcialmente | Actualiza `name`, verifica `updatedAt` cambió |
| `remove` elimina registro | Elimina y verifica que `getById` retorna null |
| `query` filtra correctamente | Filtra por `active === true` |
| `count` retorna total correcto | Verifica número después de create/remove |
| Validación Zod rechaza datos inválidos | Envía datos malformados, espera error |
| Escritura en producción lanza error | Simula `NODE_ENV=production`, espera `ReadOnlyError` |

**Estrategia:** Usar directorio temporal (`/tmp/test-data/`) con fixtures para no modificar archivos reales.

**Entregable:** 📦 Suite de tests con cobertura > 80% del motor

---

### Tarea 1.7 — Tests de API Routes 🧪 🔗(1.5)

**Crear `src/app/api/data/__tests__/collection.test.ts`:**

| Test | Método | Verificación |
|---|---|---|
| Lista colección existente | GET | `status 200`, array en `data` |
| Obtiene registro por ID | GET `?id=ex_001` | `status 200`, objeto en `data` |
| Retorna 404 si colección no existe | GET `/api/data/inexistente` | `status 404` |
| Crea registro válido | POST | `status 201`, registro con ID generado |
| Rechaza registro inválido | POST (body malformado) | `status 400`, error Zod |
| Actualiza registro existente | PUT | `status 200`, campos actualizados |
| Elimina registro existente | DELETE `?id=xxx` | `status 200` |
| Retorna 404 al eliminar inexistente | DELETE `?id=fake` | `status 404` |

**Entregable:** 📦 Tests de integración de la API

---

### Tarea 1.8 — Documentar capa de datos ○ 🔗(1.3, 1.4, 1.5)

**Actualizar `data/README.md`** con:

1. Diagrama de flujo de operaciones CRUD
2. Ejemplo de cómo crear una nueva colección (paso a paso)
3. Ejemplo de cómo agregar un esquema Zod
4. Tabla de códigos de error del motor
5. Limitaciones conocidas (Vercel read-only, tamaño máximo)

**Entregable:** 📦 Documentación técnica de la capa de datos

---

### Gate de Fase 1 — Criterios de Aceptación

```
✅  json-db.ts implementa CRUD completo (getAll, getById, create, update, remove, query, count)
✅  Cada operación de escritura genera backup automático
✅  Validación Zod bloquea datos malformados antes de persistir
✅  API Routes CRUD funcionan en /api/data/[collection]
✅  Respuestas API siguen formato estándar { success, data/error, timestamp }
✅  Tests del motor pasan con cobertura > 80%
✅  Tests de API Routes pasan (8 escenarios mínimo)
✅  En producción, escrituras lanzan ReadOnlyError
✅  PR mergeado a develop, CI en verde
```

---

---

# FASE 2 — Sistema UI & Layout

> **Objetivo:** Construir el sistema de componentes visuales reutilizables, el layout principal con navegación, soporte de tema claro/oscuro, y páginas de error personalizadas. Al finalizar, el sistema tiene una interfaz navegable y consistente.

**Duración estimada:** 5–7 días  
**Branch de trabajo:** `feature/ui-system`  
**Dependencia:** Fase 1 completada (la UI consumirá la API de datos)

---

### Tarea 2.1 — Definir Design Tokens ★

**Crear `src/styles/tokens.ts`** (constantes exportables para Tailwind y componentes):

```typescript
export const tokens = {
  colors: {
    primary: { 50: '...', 100: '...', /* ... */ 900: '...' },
    accent:  { /* ... */ },
    neutral: { /* ... */ },
    success: '#22c55e',
    warning: '#f59e0b',
    error:   '#ef4444',
    info:    '#3b82f6',
  },
  radius: { sm: '0.375rem', md: '0.5rem', lg: '0.75rem', full: '9999px' },
  spacing: { /* escala consistente */ },
  typography: {
    fontFamily: { sans: 'var(--font-inter)', mono: 'monospace' },
    fontSize:   { /* escala */ },
  },
} as const;
```

**Integrar con `tailwind.config.ts`** extendiendo `theme.extend` con los tokens.

**Entregable:** 📦 Tokens de diseño centralizados

---

### Tarea 2.2 — Componentes UI base ★ 🔗(2.1)

**Crear en `src/components/ui/`:**

| Componente | Archivo | Props principales |
|---|---|---|
| **Button** | `button.tsx` | `variant: 'primary' \| 'secondary' \| 'ghost' \| 'danger'`, `size: 'sm' \| 'md' \| 'lg'`, `loading`, `disabled` |
| **Input** | `input.tsx` | `label`, `error`, `helperText`, `type` |
| **Card** | `card.tsx` | `padding`, `hoverable`, `bordered` |
| **Badge** | `badge.tsx` | `variant: 'info' \| 'success' \| 'warning' \| 'error'` |
| **Spinner** | `spinner.tsx` | `size`, animación CSS pura |
| **Container** | `container.tsx` | `maxWidth: 'sm' \| 'md' \| 'lg' \| 'xl' \| 'full'` |
| **Typography** | `typography.tsx` | `as: 'h1'-'h6' \| 'p' \| 'span'`, `variant` |

**Cada componente debe:**
1. Estar tipado con `interface ComponentProps`
2. Aceptar `className` para extensión vía Tailwind
3. Usar `forwardRef` cuando sea elemento interactivo
4. Tener un archivo de test básico (renderiza sin crash)

**Entregable:** 📦 Librería de componentes UI base

---

### Tarea 2.3 — Sistema de tema claro/oscuro ★ 🔗(2.1)

**Implementación con `next-themes` o manual via CSS variables:**

```
src/
├── components/
│   └── theme/
│       ├── ThemeProvider.tsx     ← Context + persistencia en localStorage
│       └── ThemeToggle.tsx       ← Botón sol/luna animado con Framer Motion
└── app/
    └── layout.tsx               ← Wrappear con ThemeProvider
```

**Estrategia CSS:**

```css
/* globals.css */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  /* ... */
}

.dark {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  /* ... */
}
```

**Entregable:** 📦 Tema claro/oscuro con persistencia y toggle animado

---

### Tarea 2.4 — Layout principal con navegación ★ 🔗(2.2, 2.3)

**Crear estructura de layout:**

```
src/
├── components/
│   └── layout/
│       ├── Header.tsx           ← Logo + nav + theme toggle + avatar
│       ├── Sidebar.tsx          ← Navegación lateral colapsable (desktop)
│       ├── MobileNav.tsx        ← Menú hamburguesa (mobile)
│       ├── Footer.tsx           ← Créditos + versión
│       └── AppShell.tsx         ← Composición de Header + Sidebar + Content
└── app/
    └── (dashboard)/
        └── layout.tsx           ← Usa AppShell como wrapper de rutas internas
```

**Wireframe del AppShell:**

```
┌──────────────────────────────────────────────┐
│ Header  [Logo]     [Nav Links]   [◐] [👤]   │
├────────┬─────────────────────────────────────┤
│        │                                     │
│  Side  │         Content Area                │
│  bar   │         (children)                  │
│        │                                     │
│  ☰ Nav │                                     │
│  items │                                     │
│        │                                     │
├────────┴─────────────────────────────────────┤
│ Footer  [versión]                [créditos]  │
└──────────────────────────────────────────────┘
```

**Responsive:**

| Breakpoint | Comportamiento |
|---|---|
| `< 768px` (mobile) | Sidebar oculta, menú hamburguesa en Header |
| `768px – 1024px` (tablet) | Sidebar colapsada (solo iconos) |
| `> 1024px` (desktop) | Sidebar expandida |

**Entregable:** 📦 Layout responsivo con navegación funcional

---

### Tarea 2.5 — Páginas de error personalizadas ○ 🔗(2.2)

**Crear:**

| Archivo | Propósito | Contenido |
|---|---|---|
| `src/app/not-found.tsx` | Error 404 | Ilustración SVG + mensaje + botón "Volver al inicio" |
| `src/app/error.tsx` | Error 500 genérico | `"use client"`, mensaje amigable + botón reintentar |
| `src/app/loading.tsx` | Estado de carga global | Spinner centrado con animación |

**Cada página de error debe:**
1. Mantener el tema activo (claro/oscuro)
2. Mostrar una animación sutil (Framer Motion)
3. Proveer acción clara para el usuario (volver, reintentar)

**Entregable:** 📦 Páginas de error con UX cuidada

---

### Tarea 2.6 — Página de estado del sistema ○ 🔗(1.5, 2.2)

**Crear `src/app/(dashboard)/status/page.tsx`:**

Página que consulta `/api/health` y muestra el estado del sistema en tiempo real:

| Dato | Fuente | Visualización |
|---|---|---|
| Status general | `/api/health` | Badge verde/rojo |
| Versión | env var | Texto |
| Entorno | env var | Badge |
| Uptime | `/api/health` | Formateado (e.g. "2h 34m") |
| Colecciones activas | Listar archivos en `/data` | Tabla con nombre + registros |

**Entregable:** 📦 Dashboard de estado del sistema

---

### Tarea 2.7 — Tests de componentes UI 🧪 🔗(2.2)

**Tests mínimos por componente:**

| Componente | Tests |
|---|---|
| Button | Renderiza, aplica variantes, llama onClick, muestra spinner en loading |
| Input | Renderiza, muestra label, muestra error, captura onChange |
| Card | Renderiza children, aplica clases de hover |
| Badge | Renderiza, aplica color por variante |
| ThemeToggle | Alterna tema al hacer click |
| AppShell | Renderiza Header + Sidebar + children |

**Entregable:** 📦 Tests de componentes UI

---

### Gate de Fase 2 — Criterios de Aceptación

```
✅  6+ componentes UI base creados, tipados y testeados
✅  Tema claro/oscuro funcional con persistencia y toggle animado
✅  Layout AppShell responsivo (mobile/tablet/desktop)
✅  Página 404 personalizada con navegación de retorno
✅  Página 500 personalizada con acción de reintento
✅  Estado de carga global (loading.tsx) implementado
✅  Página /status muestra salud del sistema en tiempo real
✅  Todos los componentes usan tokens de diseño centralizados
✅  PR mergeado a develop, CI en verde
```

---

---

# FASE 3 — Funcionalidad Core

> **Objetivo:** Implementar la lógica de negocio específica del sistema. Esta fase es la más flexible ya que depende del dominio particular. Se establece la arquitectura modular que permite agregar funcionalidades sin modificar el core.

**Duración estimada:** 7–10 días  
**Branch de trabajo:** `feature/core-modules`  
**Dependencia:** Fase 2 completada

---

### Tarea 3.1 — Definir arquitectura modular ★

**Crear convención de módulos:**

```
src/
├── modules/
│   ├── [nombre-modulo]/
│   │   ├── types.ts              ← Tipos del módulo
│   │   ├── schema.ts             ← Esquema Zod específico
│   │   ├── service.ts            ← Lógica de negocio (usa json-db)
│   │   ├── components/           ← Componentes React del módulo
│   │   │   ├── List.tsx
│   │   │   ├── Form.tsx
│   │   │   └── Detail.tsx
│   │   └── __tests__/
│   │       ├── service.test.ts
│   │       └── components.test.ts
│   └── index.ts                  ← Re-exports públicos
```

**Cada módulo es autónomo:** tiene sus tipos, esquema, lógica y componentes. El módulo se conecta al sistema a través de:
1. Registrar su esquema en `data/_schema/registry.ts`
2. Crear su archivo JSON en `data/`
3. Agregar ruta en el App Router

**Entregable:** 📦 Convención y template de módulo documentados

---

### Tarea 3.2 — Implementar módulo de ejemplo completo ★ 🔗(3.1)

**Módulo propuesto: "Notas" (CRUD completo como referencia)**

```
data/note.json                           ← Colección
data/_schema/note.schema.ts              ← Esquema Zod
src/modules/notes/types.ts               ← NoteRecord interface
src/modules/notes/service.ts             ← createNote, updateNote, etc.
src/modules/notes/components/
│   ├── NoteList.tsx                     ← Tabla/grid de notas
│   ├── NoteForm.tsx                     ← Formulario crear/editar
│   └── NoteDetail.tsx                   ← Vista detalle
src/app/(dashboard)/notes/
│   ├── page.tsx                         ← Lista de notas
│   ├── new/page.tsx                     ← Crear nota
│   └── [id]/page.tsx                    ← Detalle/editar nota
```

**Schema de la nota:**

```typescript
const noteSchema = baseRecordSchema.extend({
  title: z.string().min(1).max(200),
  content: z.string().max(5000),
  category: z.enum(['general', 'importante', 'pendiente']),
  pinned: z.boolean().default(false),
});
```

**Este módulo sirve como template replicable** para cualquier entidad futura del sistema.

**Entregable:** 📦 Módulo CRUD completo de referencia

---

### Tarea 3.3 — Implementar sistema de autenticación ligero ★ 🔗(1.3)

> **Nota:** Al no tener base de datos externa, la autenticación se maneja con JWT + colección `user.json`.

**Componentes:**

```
data/user.json                           ← Usuarios (password hasheado)
data/_schema/user.schema.ts
src/lib/auth/
│   ├── jwt.ts                           ← Generar/verificar JWT
│   ├── hash.ts                          ← bcrypt wrapper
│   ├── middleware.ts                     ← Middleware de autenticación
│   └── session.ts                       ← Helpers de sesión
src/app/api/auth/
│   ├── login/route.ts                   ← POST: email + password → JWT
│   ├── register/route.ts               ← POST: crear usuario
│   ├── me/route.ts                      ← GET: usuario actual (requiere JWT)
│   └── logout/route.ts                 ← POST: invalidar sesión
src/app/(auth)/
│   ├── login/page.tsx                   ← Formulario de login
│   └── register/page.tsx               ← Formulario de registro
```

**Flujo de autenticación:**

```
Login:   POST /api/auth/login { email, password }
         → Verificar en user.json
         → Generar JWT (24h expiry)
         → Retornar token en httpOnly cookie

Proteger rutas:
         → Middleware verifica cookie JWT
         → Si válido: continúa
         → Si inválido/expirado: redirect a /login
```

**Dependencias adicionales:**

```bash
npm install bcryptjs jose
npm install -D @types/bcryptjs
```

**Entregable:** 📦 Sistema de autenticación JWT funcional

---

### Tarea 3.4 — Implementar roles y permisos ○ 🔗(3.3)

**Modelo de roles:**

```typescript
type Role = 'admin' | 'editor' | 'viewer';

interface Permission {
  resource: string;      // nombre de colección
  actions: ('read' | 'create' | 'update' | 'delete')[];
}

const rolePermissions: Record<Role, Permission[]> = {
  admin:  [{ resource: '*', actions: ['read', 'create', 'update', 'delete'] }],
  editor: [{ resource: '*', actions: ['read', 'create', 'update'] }],
  viewer: [{ resource: '*', actions: ['read'] }],
};
```

**Integrar con middleware:** antes de ejecutar operación CRUD en la API, verificar que el rol del usuario tiene permiso sobre la colección y acción solicitada.

**Entregable:** 📦 Sistema RBAC básico

---

### Tarea 3.5 — Dashboard operativo ★ 🔗(2.4, 3.2)

**Crear `src/app/(dashboard)/page.tsx`:**

| Widget | Datos | Visualización |
|---|---|---|
| Resumen de colecciones | `count()` por cada colección | Cards con número + tendencia |
| Actividad reciente | Últimos 10 registros modificados (por `updatedAt`) | Timeline |
| Estado del sistema | `/api/health` | Badge + uptime |
| Acciones rápidas | Links a crear nota, ver usuarios, etc. | Botones con iconos |

**Entregable:** 📦 Dashboard funcional como página principal del sistema

---

### Tarea 3.6 — Hook personalizado useCollection ○ 🔗(1.5)

**Crear `src/hooks/use-collection.ts`:**

```typescript
function useCollection<T extends BaseRecord>(collectionName: string) {
  // Retorna:
  return {
    data: T[],              // Registros
    isLoading: boolean,     // Estado de carga
    error: string | null,   // Error si existe
    refetch: () => void,    // Recargar datos
    create: (input) => Promise<T>,
    update: (id, partial) => Promise<T>,
    remove: (id) => Promise<boolean>,
  };
}
```

**Internamente:** usa `fetch` contra `/api/data/[collection]` con manejo de estados y caché local.

**Entregable:** 📦 Hook reutilizable para consumir cualquier colección

---

### Tarea 3.7 — Tests de módulos core 🧪 🔗(3.2, 3.3)

| Suite | Tests mínimos |
|---|---|
| **notes/service** | CRUD completo: crear, leer, actualizar, eliminar, filtrar por categoría |
| **auth/jwt** | Generar token, verificar token válido, rechazar expirado, rechazar malformado |
| **auth/hash** | Hashear password, verificar correcto, rechazar incorrecto |
| **auth/login** | Login exitoso retorna cookie, login fallido retorna 401, campos faltantes retorna 400 |
| **rbac** | Admin puede todo, viewer solo lee, editor no puede eliminar |

**Entregable:** 📦 Tests de lógica de negocio

---

### Gate de Fase 3 — Criterios de Aceptación

```
✅  Arquitectura modular documentada con template replicable
✅  Módulo "Notas" funcional con CRUD completo (UI + API + Data)
✅  Autenticación JWT funcional (login, register, protección de rutas)
✅  Roles y permisos implementados (admin, editor, viewer)
✅  Dashboard operativo muestra resumen del sistema
✅  Hook useCollection funcional y reutilizable
✅  Tests de módulos core pasan
✅  PR mergeado a develop, CI en verde
```

---

---

# FASE 4 — Producción & Escala

> **Objetivo:** Preparar el sistema para uso real. Optimizar rendimiento, agregar monitoreo, completar documentación, y resolver la limitación de persistencia en Vercel. Esta fase transforma el proyecto de "funciona" a "está listo".

**Duración estimada:** 5–7 días  
**Branch de trabajo:** `feature/production-readiness`  
**Dependencia:** Fase 3 completada

---

### Tarea 4.1 — Resolver persistencia en producción ★

**Problema:** Vercel serverless no persiste escrituras a disco entre invocaciones.

**Opciones evaluadas:**

| Opción | Complejidad | Costo | Latencia |
|---|---|---|---|
| **A) Vercel KV (Redis)** | Baja | Free tier disponible | ~5ms |
| **B) Turso (SQLite edge)** | Media | Free tier generoso | ~10ms |
| **C) GitHub API como store** | Media | Gratis | ~200ms |
| **D) Mantener read-only** | Ninguna | Gratis | 0ms |

**Estrategia recomendada:** Implementar un **adapter pattern** en `json-db.ts`:

```typescript
interface StorageAdapter {
  read(collection: string): Promise<string>;
  write(collection: string, content: string): Promise<void>;
}

class FileAdapter implements StorageAdapter { /* fs/promises */ }
class VercelKVAdapter implements StorageAdapter { /* @vercel/kv */ }

// json-db.ts selecciona adapter según entorno
const adapter = process.env.VERCEL
  ? new VercelKVAdapter()
  : new FileAdapter();
```

**Acción:** Implementar `FileAdapter` + `VercelKVAdapter`, selección automática por entorno.

**Entregable:** 📦 Persistencia funcional tanto en local como en Vercel

---

### Tarea 4.2 — Optimización de rendimiento ★

**Acciones:**

| Área | Optimización | Herramienta de medición |
|---|---|---|
| **Bundle size** | Analizar y reducir imports de Framer Motion | `@next/bundle-analyzer` |
| **Imágenes** | Usar `next/image` con formatos WebP/AVIF | Lighthouse |
| **Fuentes** | Preload vía `next/font` (ya implementado) | Network tab |
| **API caching** | Agregar `Cache-Control` headers en respuestas GET | `curl -I` |
| **React** | Memoizar componentes pesados con `memo()` y `useMemo()` | React DevTools Profiler |
| **CSS** | Verificar que Tailwind purga clases no usadas | Build output size |
| **Lazy loading** | `dynamic()` para componentes de dashboard | Network tab |

**Target:** Lighthouse Performance > 90, First Contentful Paint < 1.5s.

**Entregable:** 📦 Reporte de optimización con métricas antes/después

---

### Tarea 4.3 — Monitoreo y logging ○

**Implementar sistema de logs estructurado:**

**Crear `src/lib/logger.ts`:**

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void;
```

**Integrar en:**
1. Cada operación del motor `json-db.ts` (info en lecturas, warn en escrituras, error en fallos)
2. Middleware de autenticación (info en login, warn en intentos fallidos)
3. API Routes (info en requests, error en excepciones)

**Destino de logs:**
- **Desarrollo:** `console.log` formateado con colores
- **Producción:** JSON estructurado para integración futura con Vercel Logs / servicios externos

**Entregable:** 📦 Sistema de logging estructurado

---

### Tarea 4.4 — Manejo global de errores ○ 🔗(4.3)

**Crear `src/lib/errors.ts`:**

```typescript
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public context?: Record<string, unknown>,
  ) {
    super(message);
  }
}

class NotFoundError extends AppError { /* 404 */ }
class ValidationError extends AppError { /* 400 */ }
class UnauthorizedError extends AppError { /* 401 */ }
class ForbiddenError extends AppError { /* 403 */ }
class ConflictError extends AppError { /* 409 */ }
```

**Crear helper para API Routes:**

```typescript
function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      if (error instanceof AppError) {
        logger.warn(error.message, { code: error.code });
        return NextResponse.json(
          { success: false, error: error.message, code: error.code },
          { status: error.statusCode },
        );
      }
      logger.error('Unhandled error', { error });
      return NextResponse.json(
        { success: false, error: 'Internal Server Error', code: 'INTERNAL' },
        { status: 500 },
      );
    }
  };
}
```

**Entregable:** 📦 Manejo centralizado de errores

---

### Tarea 4.5 — SEO y Metadata ○

**Acciones:**

| Elemento | Implementación |
|---|---|
| Metadata dinámica | `generateMetadata()` en cada `page.tsx` |
| Open Graph | Imágenes OG generadas con `next/og` (Vercel OG Image) |
| `robots.txt` | `src/app/robots.ts` exportando reglas |
| `sitemap.xml` | `src/app/sitemap.ts` generando dinámicamente |
| Favicon set | Generar set completo (16, 32, 180, 192, 512) en `/public` |
| Structured Data | JSON-LD en layout para búsqueda enriquecida |

**Entregable:** 📦 SEO completo y verificable

---

### Tarea 4.6 — Documentación completa ★

**Crear/actualizar los siguientes documentos:**

| Documento | Ubicación | Contenido |
|---|---|---|
| **README.md** | Raíz | Overview, instalación, scripts, arquitectura, deploy |
| **CONTRIBUTING.md** | Raíz | Guía para contribuidores, convenciones, PR flow |
| **CHANGELOG.md** | Raíz | Historial de cambios por versión (semver) |
| **data/README.md** | `/data` | Documentación completa del JSON-DB |
| **API Reference** | `/docs/api.md` | Endpoints, request/response, códigos de error |
| **Module Guide** | `/docs/modules.md` | Cómo crear nuevos módulos paso a paso |
| **Deploy Guide** | `/docs/deploy.md` | Paso a paso de configuración GitHub + Vercel |

**Entregable:** 📦 Documentación profesional completa

---

### Tarea 4.7 — Tests end-to-end ○ 🔗(4.1, 4.4)

**Implementar smoke tests finales:**

| Test E2E | Flujo |
|---|---|
| Home carga correctamente | Navegar a `/`, verificar "Hola Mundo" visible |
| Health check funciona | Fetch `/api/health`, verificar `status: ok` |
| Login y acceso a dashboard | Login → redirect a dashboard → ver widgets |
| CRUD de notas | Crear nota → ver en lista → editar → eliminar |
| Protección de rutas | Acceder a `/dashboard` sin auth → redirect a `/login` |
| Error 404 | Navegar a ruta inexistente → ver página 404 |
| Tema claro/oscuro | Toggle tema → verificar persistencia al recargar |

**Entregable:** 📦 Suite de smoke tests

---

### Tarea 4.8 — Release v1.0 ★ 🔗(todas las anteriores)

**Acciones:**

1. Merge `develop` → `main` via PR con review completo
2. Crear tag `v1.0.0` en GitHub
3. Verificar deploy de producción en Vercel
4. Ejecutar Lighthouse en URL de producción (target: Performance > 90)
5. Verificar todos los endpoints de API
6. Documentar URL de producción en README
7. Crear GitHub Release con changelog

**Entregable:** 📦 Release v1.0.0 publicado y desplegado

---

### Gate de Fase 4 — Criterios de Aceptación

```
✅  Persistencia funciona en producción (adapter pattern implementado)
✅  Lighthouse Performance > 90 en producción
✅  Sistema de logging estructurado activo
✅  Errores manejados centralizadamente (AppError hierarchy)
✅  SEO completo (metadata, OG, robots, sitemap)
✅  Documentación profesional (README, API Reference, Module Guide, Deploy Guide)
✅  Smoke tests pasan en entorno de producción
✅  Tag v1.0.0 creado en GitHub
✅  Vercel producción estable y funcional
```

---

---

## Resumen Ejecutivo de Fases

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  FASE 0   Scaffolding          3-4 días    Next.js + TS + Vercel  │
│  ──────   ─────────────        ────────    ───────────────────    │
│           Hola Mundo animado               Deploy validado        │
│           /api/health                      CI pipeline            │
│                                                                    │
│  FASE 1   Motor de Datos       5-7 días    json-db.ts CRUD       │
│  ──────   ──────────────       ────────    ──────────────────     │
│           Esquemas Zod                     API Routes genéricas   │
│           Tests > 80%                      Documentación datos    │
│                                                                    │
│  FASE 2   Sistema UI           5-7 días    Componentes base      │
│  ──────   ──────────           ────────    ──────────────────     │
│           Layout + Nav                     Tema claro/oscuro      │
│           Páginas error                    Status page            │
│                                                                    │
│  FASE 3   Core Logic           7-10 días   Módulos de negocio    │
│  ──────   ──────────           ─────────   ──────────────────     │
│           Auth JWT                         Roles y permisos       │
│           Dashboard                        Hook useCollection     │
│                                                                    │
│  FASE 4   Producción           5-7 días    Persistencia real     │
│  ──────   ──────────           ────────    ──────────────────     │
│           Performance                      Monitoreo + logging    │
│           Documentación                    Release v1.0.0         │
│                                                                    │
│  TOTAL ESTIMADO: 25-35 días laborales                             │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Diagrama de Dependencias entre Fases

```
FASE 0 ──────────────────────────────────────────────► ENTREGA: Deploy + Hola Mundo
   │
   ▼
FASE 1 ──────────────────────────────────────────────► ENTREGA: API + Motor JSON-DB
   │
   ├──────────────────┐
   ▼                  ▼
FASE 2              (paralelo parcial con Fase 2)
   │                  │
   ▼                  │
FASE 3 ◄─────────────┘ ─────────────────────────────► ENTREGA: Sistema funcional
   │
   ▼
FASE 4 ──────────────────────────────────────────────► ENTREGA: Release v1.0.0
```

> **Nota:** Las Fases 2 y 3 tienen dependencias cruzadas pero pueden solaparse parcialmente. Los componentes UI (Fase 2) pueden desarrollarse en paralelo con los esquemas y servicios de módulos (Fase 3), integrándose al final.

---

## Protocolo de Avance entre Fases

Antes de iniciar cualquier fase nueva, se debe cumplir el siguiente protocolo:

1. **Gate Check:** Todos los criterios de aceptación de la fase anterior deben estar marcados como cumplidos
2. **CI Verde:** El pipeline de GitHub Actions debe pasar sin errores
3. **PR Review:** El código debe estar mergeado a `develop` via Pull Request
4. **Build Limpio:** `npm run build` debe completar sin warnings ni errores
5. **Type Safe:** `npm run type-check` debe pasar con cero errores

Si algún criterio no se cumple, la fase actual se considera incompleta y debe resolverse antes de avanzar.

---

> **Siguiente acción:** Ejecutar **Tarea 0.1** — Crear repositorio GitHub e iniciar el scaffolding del proyecto.
