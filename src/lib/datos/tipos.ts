import type { OrigenMensaje } from '@/lib/reglas/fuentesWeb';
import type { NivelProductividad } from '@/lib/reglas/productividad';

export type EstadoTarea = 'Pendiente' | 'En Progreso' | 'Completada';

export interface DatosTarea {
  titulo: string;
  categoria?: string | undefined;
  prioridad?: number | null | undefined;
  fechaLimite: string;
  /** RB-34: 'HH:MM' de 24 horas, opcionales. */
  horaInicio?: string | null | undefined;
  horaFin?: string | null | undefined;
}

export interface Tarea {
  id: string;
  titulo: string;
  categoria: string;
  prioridad: number;
  estado: EstadoTarea;
  minutosInvertidos: number;
  fechaLimite: string;
  fechaCreacion: string;
  fechaCierre: string | null;
  /** RB-34: 'HH:MM' de 24 horas o null. */
  horaInicio: string | null;
  horaFin: string | null;
}

export interface Documento {
  id: string;
  nombreArchivo: string;
  categoria: string;
  numFragmentos: number;
  fechaGuardado: string;
  /** E10b: null en documentos indexados antes de tener páginas. */
  paginas: number | null;
  /** E10b (RB-38): 0 a 99 mientras se indexa por partes; null = terminado. */
  progreso: number | null;
  numCapitulos: number;
}

export interface Capitulo {
  orden: number;
  nivel: number;
  titulo: string;
  paginaInicio: number;
  paginaFin: number;
  etiquetaPaginas: string;
  /** E10d (RB-42): ya tiene su tarea de lectura. */
  enTareas: boolean;
}

export interface CapitulosDocumento {
  documento: Pick<Documento, 'id' | 'nombreArchivo' | 'paginas' | 'categoria'>;
  capitulos: Capitulo[];
}

/** E10d (RB-42): vista previa del plan de lectura. */
export interface PlanLectura {
  categoria: string;
  tareas: Array<{ orden: number; titulo: string; fechaLimite: string }>;
  yaEnTareas: Array<{ orden: number; titulo: string }>;
}

export interface ResultadoPlanLectura {
  creadas: number;
  omitidas: number;
  categoria: string;
}

export interface ResultadoIndexacion {
  documentoId: string;
  numFragmentos: number;
  /** RB-38: null = terminado; un número = falta por indexar y se sigue por partes. */
  progreso: number | null;
}

export interface Fragmento {
  id: string;
  documento_id: string;
  numero: number;
  contenido: string;
  nombre_archivo: string;
  distancia: number;
  /** RB-36: "45" o "45–46"; null en documentos indexados antes de E10b. */
  etiqueta_paginas?: string | null;
}

export interface Fuente {
  tipo: 'pdf' | 'tarea' | 'web';
  etiqueta: string;
  /** Solo en las fuentes web (RB-56): el enlace al artículo. */
  url?: string;
}

/** RB-40: dónde sigue un capítulo que se responde por partes. */
export interface Continuacion {
  documentoId: string;
  orden: number;
  desde: number;
}

/** E10c: qué fragmentos usó una respuesta; se guarda con el mensaje y no sale al navegador. */
export interface ContextoMensaje {
  fragmentos: string[];
  continuacion?: Continuacion;
  /** Las páginas del capítulo o la página pedida, para no citar fuera de ellas al volver a explicarlo. */
  limitePaginas?: string;
  /** RB-39: la página del PDF pedida, para volver a usar solo su texto. */
  paginaPdf?: number;
}

export interface RespuestaAsistente {
  respuesta: string;
  fuentes: Fuente[];
  contexto?: ContextoMensaje;
}

export interface RespuestaConHistorial extends Omit<RespuestaAsistente, 'contexto'> {
  conversacionId: string;
  guardada: boolean; // false si la respuesta llegó pero no se pudo guardar en el historial
  /** E10c: para "Explicar de otra manera" (RB-41). */
  mensajeId?: number;
  explicable?: boolean;
  /** E10c2 (M21): sin origen, documentos y tareas. */
  origen?: OrigenMensaje;
}

export interface MensajeGuardado {
  id: number;
  autor: 'usuario' | 'asistente';
  texto: string;
  fuentes: Fuente[];
  /** E10c: si la respuesta citó documentos y se puede explicar de otra manera (RB-41). */
  explicable?: boolean;
  /** E10c2 (M21): null en los mensajes de documentos y tareas. */
  origen?: OrigenMensaje | null;
}

export interface ConversacionActual {
  id: string;
  mensajes: MensajeGuardado[];
}

/** Los conteos van junto al resultado para que el usuario pueda comprobar la fórmula a mano (sección 9.1). */
export interface ResultadoProductividad {
  fecha: string;
  totales: number;
  completadas: number;
  minutos: number; // suma de las completadas, sin tope; la regla aplica el tope de 120
  recomendacionDisponible: boolean; // false si Gemini falló: el índice se muestra igual
  puntos: number;
  nivel: NivelProductividad;
  recomendacion: string;
}

export interface ArticuloWeb {
  titulo: string;
  url: string;
}

/** E10b2: una fuente web guardada del usuario. */
export interface FuenteWeb {
  id: string;
  categoria: string;
  url: string;
  extracto: string;
  fechaGuardado: string;
}

export interface ResultadoWeb {
  resumen: string;
  url: string; // la del primer resultado: es la que se puede guardar; vacía si Wikipedia no encontró artículos
  articulos: ArticuloWeb[]; // los resultados que se usaron para el resumen
}

/** E10c2 (RB-55): el resultado de "Guardar fuente". */
export interface FuenteGuardada {
  categoria: string;
  fuentesEnCategoria: number; // contando la recién guardada (RN-05: máximo 20)
}

/** E05: categoría de tareas con color de la paleta fija; `tareas` = cuántas tareas del usuario la usan. */
export interface Categoria {
  id: string;
  nombre: string;
  color: string;
  tareas: number;
}
