'use client';

import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { abiertaComoApp, alCambiarInstalar, esIos, eventoInstalar, type EventoInstalar } from '@/lib/instalacion';

type Estado = { tipo: 'cargando' } | { tipo: 'instalada' } | { tipo: 'ios' } | { tipo: 'otro'; evento: EventoInstalar | null };

function leerEstado(): Estado {
  if (abiertaComoApp()) return { tipo: 'instalada' };
  if (esIos()) return { tipo: 'ios' };
  return { tipo: 'otro', evento: eventoInstalar() };
}

/**
 * E11b (5.10, B-55): guía para agregar Nova a inicio. En el iPhone, Safari › Compartir › Agregar a inicio; en
 * Android, el botón "Instalar" cuando Chrome lo ofrece, o menú › Instalar app. Si ya está abierta como app, lo dice.
 */
export function BloqueInstalar() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [rechazada, setRechazada] = useState(false);

  useEffect(() => {
    setEstado(leerEstado());
    return alCambiarInstalar(() => setEstado(leerEstado()));
  }, []);

  async function instalar(evento: EventoInstalar) {
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    if (outcome === 'dismissed') setRechazada(true);
  }

  return (
    <Tarjeta className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-texto">Instalar Nova</h2>
      {estado.tipo === 'instalada' ? (
        <Aviso tipo="exito">Nova ya está instalada en este dispositivo.</Aviso>
      ) : (
        <>
          <p className="text-sm text-texto">Agrégala a la pantalla de inicio para abrirla como una app, a pantalla completa y sin la barra del navegador.</p>
          {estado.tipo === 'ios' && (
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-texto">
              <li>Abre Nova en Safari.</li>
              <li>Toca Compartir (el cuadro con la flecha hacia arriba).</li>
              <li>Toca «Agregar a inicio» y luego «Agregar».</li>
            </ol>
          )}
          {estado.tipo === 'otro' && estado.evento && !rechazada && (
            <div>
              <Boton onClick={() => void instalar(estado.evento as EventoInstalar)}>
                <Download aria-hidden="true" className="size-4" />
                Instalar
              </Boton>
            </div>
          )}
          {estado.tipo === 'otro' && (!estado.evento || rechazada) && (
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-texto">
              <li>En Android, abre Nova en Chrome.</li>
              <li>Toca el menú (los tres puntos) y luego «Instalar app» o «Agregar a la pantalla principal».</li>
              <li>En el computador, usa el ícono de instalar de la barra de direcciones, si aparece.</li>
            </ol>
          )}
        </>
      )}
      <div className="flex flex-col gap-1 border-t border-borde pt-4 text-sm text-texto-suave">
        <p>En el iPhone, la app instalada tiene su propia sesión: la primera vez inicias sesión dentro de ella.</p>
        <p>
          Para verlas sin conexión, Inicio, Tareas, el Calendario y los capítulos guardan una copia en este dispositivo. Se borra al cerrar
          sesión. No dejes la sesión abierta en un teléfono compartido.
        </p>
      </div>
    </Tarjeta>
  );
}
