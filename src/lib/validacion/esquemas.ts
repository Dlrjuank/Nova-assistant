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
  // E11c (RB-43): lo valida src/lib/reglas/recordatorios.ts; "" o null = sin recordatorio.
  recordatorio: z.string().max(12).nullish(),
});
export type DatosTareaEntrada = z.infer<typeof esquemaTarea>;

// E10d (RB-42): las fechas y el reparto los valida src/lib/reglas/planLectura.ts, con los mensajes exactos.
export const esquemaPlanLectura = z.discriminatedUnion('modo', [
  z.object({
    modo: z.literal('fechas'),
    capitulos: z.array(z.number().int().nonnegative()).min(1).max(300),
    inicio: z.string().max(10),
    fin: z.string().max(10),
    categoria: z.string().trim().max(80).optional(),
  }),
  z.object({
    modo: z.literal('semana'),
    capitulos: z.array(z.number().int().nonnegative()).min(1).max(300),
    inicio: z.string().max(10),
    porSemana: z.number().int().min(1).max(20),
    categoria: z.string().trim().max(80).optional(),
  }),
]);

// E10e (RB-48): el rango de páginas se valida contra el documento en el servidor, con el mensaje exacto.
const comunCuestionario = {
  documentoId: z.uuid(),
  pedidas: z.union([z.literal(5), z.literal(10), z.literal(20)]),
  dificultad: z.enum(['facil', 'media', 'dificil']),
};
export const esquemaCrearCuestionario = z.discriminatedUnion('alcance', [
  z.object({ ...comunCuestionario, alcance: z.literal('documento') }),
  z.object({ ...comunCuestionario, alcance: z.literal('capitulo'), capitulo: z.number().int().nonnegative() }),
  z.object({ ...comunCuestionario, alcance: z.literal('paginas'), desde: z.number().int(), hasta: z.number().int() }),
]);
export const esquemaIdCuestionario = z.uuid();
export const esquemaEmpezarIntento = z.object({ repasoDe: z.uuid().optional() });
export const esquemaResponderPregunta = z.object({ preguntaId: z.uuid(), elegida: z.number().int().min(0).max(3) });
// E11 (5.8): cambios de Configuración; las reglas finas (RB-11, RB-26, cortes) las valida el servicio con su mensaje.
export const esquemaConfiguracion = z
  .object({
    nombre: z.string().max(200).optional(),
    tema: z.enum(['claro', 'oscuro', 'automatico']).optional(),
    formatoHora: z.enum(['24', '12']).optional(),
    notaAprobar: z.union([z.string().max(10), z.number()]).optional(),
    redondeo: z.enum(['truncar', 'redondear']).optional(),
    cortesDefecto: z.array(z.union([z.string().max(10), z.number()])).min(1).max(6).optional(),
    horaRecordatorio: z.string().max(5).optional(),
  })
  .strict();

// E10f: historial (filtro opcional por documento) y tarea de repaso (RB-53); la fecha la valida el servicio.
export const esquemaHistorialCuestionarios = z.object({ documentoId: z.uuid().optional() });
export const esquemaTareaRepaso = z.object({
  capituloId: z.uuid(),
  fecha: z.string().max(10),
  categoria: z.string().trim().max(80).optional(),
});

export const esquemaFiltroTareas = z.object({
  estado: z.enum(['Pendiente', 'En Progreso', 'Completada']).optional(),
  fecha: z.string().optional(),
});

export const esquemaConsulta = z
  .object({
    pregunta: z.string().trim().min(1).max(CONSULTA_MAX_CARACTERES).optional(),
    conversacionId: z.uuid().optional(), // sin id, la conversación más reciente del usuario (RN-20)
    documentoId: z.union([z.uuid(), z.enum(['web', 'wikipedia', 'ia'])]).optional(), // E10c, E10c2 y E10c3: "Buscar en"
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
});
export type DatosWeb = z.infer<typeof esquemaWeb>;

// RB-55: la dirección la valida el servicio, para devolver el mensaje exacto.
export const esquemaGuardarFuente = z.object({
  url: z.string().trim().min(1).max(2000),
  resumen: z.string().trim().min(1).max(5000),
  categoria: z.string().trim().max(80).optional(),
});

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

// E11c: suscripción push del navegador (PushSubscription.toJSON()) y el nombre corto del dispositivo.
export const esquemaSuscripcion = z.object({
  endpoint: z.url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  dispositivo: z.string().max(120).optional(),
});
export const esquemaQuitarSuscripcion = z.object({ endpoint: z.url().max(2000) });
