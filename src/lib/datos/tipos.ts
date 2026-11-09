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
}

export interface CapitulosDocumento {
  documento: Pick<Documento, 'id' | 'nombreArchivo' | 'paginas'>;
  capitulos: Capitulo[];
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
  tipo: 'pdf' | 'tarea';
  etiqueta: string;
}

export interface RespuestaAsistente {
  respuesta: string;
  fuentes: Fuente[];
}

export interface RespuestaConHistorial extends RespuestaAsistente {
  conversacionId: string;
  guardada: boolean; // false si la respuesta llegó pero no se pudo guardar en el historial
}

export interface MensajeGuardado {
  id: number;
  autor: 'usuario' | 'asistente';
  texto: string;
  fuentes: Fuente[];
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
  url: string; // la del primer resultado: es la que se guarda
  guardada: boolean; // false si Wikipedia no encontró artículos
  categoria: string;
  articulos: ArticuloWeb[]; // los resultados que se usaron para el resumen
  fuentesEnCategoria: number; // contando la recién guardada (RN-05: máximo 20)
}

/** E05: categoría de tareas con color de la paleta fija; `tareas` = cuántas tareas del usuario la usan. */
export interface Categoria {
  id: string;
  nombre: string;
  color: string;
  tareas: number;
}
