'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { formatearHorario, type Horario } from '@/lib/reglas/horario';
import type { FormatoHora, Tema } from '@/lib/reglas/preferencias';
import { aplicarTema } from '@/lib/tema';

const Contexto = createContext<{ formatoHora: FormatoHora }>({ formatoHora: '24' });

/**
 * E11 (5.8, B-03): las preferencias que necesitan las pantallas del navegador. El tema guardado en la base manda:
 * si este dispositivo tenía otro (o ninguno), se corrige y se recuerda para que la próxima carga no parpadee.
 */
export function ProveedorPreferencias({ tema, formatoHora, children }: { tema: Tema; formatoHora: FormatoHora; children: ReactNode }) {
  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);
  return <Contexto.Provider value={{ formatoHora }}>{children}</Contexto.Provider>;
}

export function useFormatoHora(): FormatoHora {
  return useContext(Contexto).formatoHora;
}

/** El horario de una tarea en el formato de Configuración; sirve dentro de componentes del servidor. */
export function HorarioTarea({ horaInicio, horaFin }: Partial<Horario>) {
  const formato = useFormatoHora();
  return <>{formatearHorario({ horaInicio: horaInicio ?? null, horaFin: horaFin ?? null }, formato)}</>;
}
