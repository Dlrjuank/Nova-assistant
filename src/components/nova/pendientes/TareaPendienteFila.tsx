'use client';

import { CloudOff } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { InsigniaCategoria } from '@/components/nova/InsigniaCategoria';
import { InsigniaPrioridad } from '@/components/nova/InsigniaPrioridad';
import { useFormatoHora } from '@/components/nova/PreferenciasNova';
import { Boton, claseBoton } from '@/components/ui/Boton';
import { Insignia } from '@/components/ui/Insignia';
import { formatearFecha } from '@/lib/formato';
import { colorDeCategoria } from '@/lib/reglas/categorias';
import { formatearHorario } from '@/lib/reglas/horario';
import { CONFIRMAR_DESCARTAR, INSIGNIA_PENDIENTE, textoNoSeEnvio, type TareaPendiente } from '@/lib/reglas/tareasPendientes';
import { almacenDispositivo } from '@/lib/tareasPendientes';

/** La pantalla que corrige una tarea rechazada: el formulario lleno, con el mismo idCliente (RB-74). */
export const hrefCorregir = (idCliente: string) => `/nova/tareas/nueva?corregir=${encodeURIComponent(idCliente)}`;

/**
 * E11e (RB-71, RB-74): una tarea creada sin conexión que aún no llega al servidor. Sin casilla: no se completa,
 * edita ni elimina; solo se descarta, con confirmación. Si el servidor la rechazó, muestra su mensaje y "Corregir".
 * Todo funciona sin conexión (`data-sin-conexion="permitido"`).
 */
export function TareaPendienteFila({
  tarea,
  categorias = [],
  conFecha = false,
  compacta = false,
}: {
  tarea: TareaPendiente;
  categorias?: ReadonlyArray<{ nombre: string; color: string }>;
  /** En Tareas, donde no se agrupan por día. */
  conFecha?: boolean;
  /** En las columnas de la semana (computador). */
  compacta?: boolean;
}) {
  const formato = useFormatoHora();
  const [preguntando, setPreguntando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const d = tarea.datos;
  const rechazada = tarea.estado === 'rechazada';
  const horario = formatearHorario({ horaInicio: d.horaInicio, horaFin: d.horaFin }, formato);

  async function descartar() {
    setBorrando(true);
    try {
      await almacenDispositivo.borrar(tarea.idCliente);
    } finally {
      setBorrando(false);
      setPreguntando(false);
    }
  }

  return (
    <div
      data-sin-conexion="permitido"
      data-pendiente={tarea.idCliente}
      className={`flex flex-col gap-2 rounded-xl border border-dashed ${rechazada ? 'border-peligro' : 'border-borde'} ${compacta ? 'px-1 py-1.5' : 'p-2.5'}`}
    >
      <div className="flex items-start gap-2.5">
        <CloudOff aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-texto-suave" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="flex min-w-0 flex-col text-sm font-medium break-words text-texto">
            {d.titulo}
            {(horario || conFecha) && (
              <span className="text-xs font-normal text-texto-suave">
                {conFecha ? formatearFecha(d.fechaLimite) : ''}
                {conFecha && horario ? ' · ' : ''}
                {horario}
              </span>
            )}
          </p>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            <InsigniaCategoria nombre={d.categoria} color={colorDeCategoria(d.categoria, categorias)} compacta={compacta} />
            <InsigniaPrioridad prioridad={d.prioridad} />
            <Insignia tono={rechazada ? 'peligro' : 'aviso'}>{rechazada ? 'No se pudo enviar' : INSIGNIA_PENDIENTE}</Insignia>
          </div>
          {rechazada && tarea.error && <p className="text-xs font-medium text-peligro">{textoNoSeEnvio(tarea.error)}</p>}
        </div>
      </div>
      {preguntando ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-texto">{CONFIRMAR_DESCARTAR}</p>
          <div className="flex flex-wrap gap-2">
            <Boton variante="peligro" cargando={borrando} onClick={() => void descartar()} className="min-h-9 py-1.5">
              Sí, descartar
            </Boton>
            <Boton variante="fantasma" disabled={borrando} onClick={() => setPreguntando(false)} className="min-h-9 py-1.5">
              Cancelar
            </Boton>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {rechazada && (
            <Link href={hrefCorregir(tarea.idCliente)} prefetch={false} className={`${claseBoton('secundario')} min-h-9 py-1.5`}>
              Corregir
            </Link>
          )}
          <Boton
            variante="fantasma"
            aria-label={`Descartar tarea: ${d.titulo}`}
            onClick={() => setPreguntando(true)}
            className="min-h-9 py-1.5 text-peligro hover:bg-peligro/12"
          >
            Descartar
          </Boton>
        </div>
      )}
    </div>
  );
}
