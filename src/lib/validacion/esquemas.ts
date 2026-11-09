import { z } from 'zod';
import { CONSULTA_MAX_CARACTERES, WEB_MAX_CARACTERES } from '@/lib/config/nova';

// Solo validan forma y tipos; las reglas finas (prioridad 1..3, fecha real, 2 palabras/8 caracteres)
// las aplica src/lib/reglas para devolver los mensajes exactos.

export const esquemaTarea = z.object({
  titulo: z.string().trim().min(1).max(200),
  categoria: z.string().trim().max(80).optional(),
  prioridad: z.number().int().nullish(),
  fechaLimite: z.string(),
  // RB-34: opcionales; las valida src/lib/reglas/horario.ts para devolver los mensajes exactos.
  horaInicio: z.string().max(8).nullish(),
  horaFin: z.string().max(8).nullish(),
});
export type DatosTareaEntrada = z.infer<typeof esquemaTarea>;

export const esquemaFiltroTareas = z.object({
  estado: z.enum(['Pendiente', 'En Progreso', 'Completada']).optional(),
  fecha: z.string().optional(),
});

export const esquemaConsulta = z
  .object({
    pregunta: z.string().trim().min(1).max(CONSULTA_MAX_CARACTERES).optional(),
    conversacionId: z.uuid().optional(), // sin id, la conversación más reciente del usuario (RN-20)
    documentoId: z.uuid().optional(), // E10c: "Buscar en"
    explicar: z.object({ mensajeId: z.coerce.number().int().positive(), modo: z.enum(['simple', 'ejemplo', 'pasos', 'corto', 'analogia']) }).optional(), // RB-41
  })
  .refine((d) => d.pregunta !== undefined || d.explicar !== undefined);
export type DatosConsulta = z.infer<typeof esquemaConsulta>;

export const esquemaIndexar = z.object({
  urlBlob: z
    .url()
    .refine((u) => u.startsWith('https://') && new URL(u).hostname.endsWith('.blob.vercel-storage.com'), {
      message: 'La URL debe ser de Vercel Blob',
    }),
  nombreArchivo: z.string().trim().min(1).max(255),
  categoria: z.string().trim().max(80).optional(),
});
export type DatosIndexar = z.infer<typeof esquemaIndexar>;

export const esquemaIdTarea = z.uuid();
export const esquemaIdDocumento = z.uuid();

export const esquemaCompletar = z.object({
  minutos: z.number().int().min(0).max(2_147_483_647), // tope de la columna INTEGER
});
export type DatosCompletar = z.infer<typeof esquemaCompletar>;

export const esquemaProductividad = z.object({
  fecha: z.string().optional(),
});
export type DatosProductividad = z.infer<typeof esquemaProductividad>;

export const esquemaWeb = z.object({
  consulta: z.string().trim().min(1).max(WEB_MAX_CARACTERES),
  categoria: z.string().trim().max(80).optional(),
});
export type DatosWeb = z.infer<typeof esquemaWeb>;

// E05: categorías. El color se valida en src/lib/reglas/categorias.ts para devolver el mensaje exacto (RB-03).
export const esquemaCategoria = z.object({
  nombre: z.string().max(200),
  color: z.string().max(20).optional(),
});
export type DatosCategoria = z.infer<typeof esquemaCategoria>;

export const esquemaActualizarCategoria = z
  .object({ nombre: z.string().max(200).optional(), color: z.string().max(20).optional() })
  .refine((d) => d.nombre !== undefined || d.color !== undefined, { message: 'Nada que cambiar' });
export type DatosActualizarCategoria = z.infer<typeof esquemaActualizarCategoria>;

export const esquemaIdCategoria = z.uuid();
