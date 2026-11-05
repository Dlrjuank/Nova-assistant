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

export interface ResultadoProductividad {
  puntos: number;
  nivel: NivelProductividad;
  recomendacion: string;
}

export interface ResultadoWeb {
  resumen: string;
  url: string;
  guardada: boolean;
}
