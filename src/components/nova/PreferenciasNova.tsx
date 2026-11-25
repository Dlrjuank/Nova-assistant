'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { formatearHorario, type Horario } from '@/lib/reglas/horario';
import type { EstadoIa } from '@/lib/reglas/claveGemini';
import type { FormatoHora, Tema } from '@/lib/reglas/preferencias';
import { aplicarTema } from '@/lib/tema';

// E20c-1: sin proveedor (pruebas de un componente suelto) la IA cuenta como disponible.
const Contexto = createContext<{ formatoHora: FormatoHora; horaRecordatorio: string; estadoIa: EstadoIa }>({ formatoHora: '24', horaRecordatorio: '08:00', estadoIa: 'proyecto' });

/**
 * E11 (5.8, B-03): las preferencias que necesitan las pantallas del navegador. El tema guardado en la base manda:
 * si este dispositivo tenía otro (o ninguno), se corrige y se recuerda para que la próxima carga no parpadee.
 */
export function ProveedorPreferencias({
  tema,
  formatoHora,
  horaRecordatorio = '08:00',
  estadoIa = 'proyecto',
  children,
}: {
  tema: Tema;
  formatoHora: FormatoHora;
  /** E11c: la hora fija de los recordatorios de tareas sin horario. */
  horaRecordatorio?: string;
  /** E20c-1 (RB-79): qué IA tiene la persona; sin una que sirva, los botones de IA muestran el aviso. */
  estadoIa?: EstadoIa;
  children: ReactNode;
}) {
  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);
  return <Contexto.Provider value={{ formatoHora, horaRecordatorio, estadoIa }}>{children}</Contexto.Provider>;
}

/** E20c-1 (RB-79): qué IA tiene la persona ahora. */
export function useEstadoIa(): EstadoIa {
  return useContext(Contexto).estadoIa;
}

export function useFormatoHora(): FormatoHora {
  return useContext(Contexto).formatoHora;
}

/** E11c: la hora fija de Configuración para los recordatorios sin horario. */
export function useHoraRecordatorio(): string {
  return useContext(Contexto).horaRecordatorio;
}

/** El horario de una tarea en el formato de Configuración; sirve dentro de componentes del servidor. */
export function HorarioTarea({ horaInicio, horaFin }: Partial<Horario>) {
  const formato = useFormatoHora();
  return <>{formatearHorario({ horaInicio: horaInicio ?? null, horaFin: horaFin ?? null }, formato)}</>;
}
