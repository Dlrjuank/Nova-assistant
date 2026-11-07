import type { NivelProductividad } from '@/lib/reglas/productividad';

export type EstadoTarea = 'Pendiente' | 'En Progreso' | 'Completada';

export interface DatosTarea {
  titulo: string;
  categoria?: string | undefined;
  prioridad?: number | null | undefined;
  fechaLimite: string;
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
}

export interface Documento {
  id: string;
  nombreArchivo: string;
  categoria: string;
  numFragmentos: number;
  fechaGuardado: string;
}

export interface Fragmento {
  id: string;
  documento_id: string;
  numero: number;
  contenido: string;
  nombre_archivo: string;
  distancia: number;
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
