import { CalendarClock, Clock, GraduationCap, ListChecks, TriangleAlert, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CLASE_FOCO } from '@/components/ui/Boton';
import { Contador } from '@/components/ui/Contador';
import type { ResumenInicio } from '@/lib/dataService';
import { cuandoEs } from '@/lib/reglas/avisos';
import { diferenciaTiempo, fechaConSemana, partesTiempo, resumenDelDia, saludo, textoTareasHoy, textoVencida } from '@/lib/reglas/inicio';
import { formatearDecimas } from '@/lib/reglas/notas';

/**
 * E20b (commit 2, Inicio): el saludo según la hora, las cuatro tarjetas de números y el próximo corte.
 * Los números cuentan al aparecer (Contador); el resto es del servidor.
 */

/** El primer nombre del perfil (o nada). */
const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? '';

export function SaludoInicio({ nombre, hora, hoy, pendientesHoy, vencidas }: { nombre: string; hora: number; hoy: string; pendientesHoy: number; vencidas: number }) {
  const n = primerNombre(nombre);
  return (
    <header className="flex flex-col gap-1.5">
      <p className="font-mono text-xs tracking-[0.12em] text-texto-suave uppercase">{fechaConSemana(hoy)}</p>
      <h1 className="font-display text-[2rem] leading-tight font-extrabold tracking-tight text-texto sm:text-4xl">
        {saludo(hora)}
        {n ? (
          <>
            , <span className="text-acento">{n}</span>
          </>
        ) : null}
        .
      </h1>
      <p className="text-sm text-texto-suave">{resumenDelDia(pendientesHoy, vencidas)}</p>
    </header>
  );
}

/** Ícono del encabezado de cada tarjeta, con fondo del color de su tono. */
const TONOS = {
  acento: 'bg-acento-suave text-acento',
  peligro: 'bg-peligro/12 text-peligro',
  aviso: 'bg-aviso/12 text-aviso',
  exito: 'bg-exito/12 text-exito',
} as const;

function TarjetaNumero({ href, titulo, icono: Icono, tono, children, pie }: { href: string; titulo: string; icono: LucideIcon; tono: keyof typeof TONOS; children: ReactNode; pie: ReactNode }) {
  return (
    <li className="min-w-0">
      <Link
        href={href}
        prefetch={false}
        className={`flex h-full flex-col gap-2 rounded-[20px] border border-borde bg-superficie p-4 shadow-suave transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-acento/40 active:scale-[0.98] sm:p-5 ${CLASE_FOCO}`}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-texto-suave">{titulo}</span>
          <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-full ${TONOS[tono]}`}>
            <Icono className="size-4" />
          </span>
        </span>
        {children}
        <span className="text-xs text-texto-suave">{pie}</span>
      </Link>
    </li>
  );
}

const NUMERO = 'font-display text-4xl leading-none font-extrabold tracking-tight text-texto';

/** Barras pequeñas de minutos por día (lunes a domingo); hoy en brasa, los días que faltan apagados. */
function BarrasSemana({ minutos, hoyIndice }: { minutos: number[]; hoyIndice: number }) {
  const max = Math.max(...minutos, 1);
  return (
    <span aria-hidden="true" className="flex h-9 items-end gap-1">
      {minutos.map((m, i) => (
        <span
          key={i}
          className={`flex-1 rounded-sm ${i === hoyIndice ? 'bg-acento' : i < hoyIndice ? 'bg-acento/45' : 'bg-superficie-2'}`}
          style={{ height: `${Math.max(8, (m / max) * 100)}%` }}
        />
      ))}
    </span>
  );
}

export function TarjetasInicio({
  resumen,
  hoy,
  hoyTotal,
  hoyPendientes,
  hoyConHorario,
  vencidas,
}: {
  resumen: ResumenInicio;
  hoy: string;
  hoyTotal: number;
  hoyPendientes: number;
  hoyConHorario: number;
  vencidas: number;
}) {
  const tiempo = partesTiempo(resumen.minutosHastaHoy);
  const diferencia = diferenciaTiempo(resumen.minutosHastaHoy, resumen.minutosSemanaPasada);
  const hoyIndice = (new Date(`${hoy}T00:00:00Z`).getUTCDay() + 6) % 7;
  const { promedio } = resumen;
  return (
    <ul aria-label="Tu día en números" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <TarjetaNumero href="/nova/tareas?vista=hoy" titulo="Tareas de hoy" icono={ListChecks} tono="acento" pie={textoTareasHoy(hoyTotal, hoyPendientes, hoyConHorario)}>
        <span className={NUMERO}>
          <Contador valor={hoyTotal} />
        </span>
      </TarjetaNumero>
      <TarjetaNumero href="/nova/tareas?vista=vencidas" titulo="Vencidas" icono={TriangleAlert} tono="peligro" pie={textoVencida(resumen.vencidaMasAntigua, hoy)}>
        <span className={`${NUMERO} ${vencidas > 0 ? 'text-peligro' : ''}`}>
          <Contador valor={vencidas} />
        </span>
      </TarjetaNumero>
      <TarjetaNumero
        href="/nova/productividad"
        titulo="Tiempo esta semana"
        icono={Clock}
        tono="aviso"
        pie={
          diferencia ? (
            <>
              <span className={diferencia.tono === 'sube' ? 'font-semibold text-exito' : 'font-semibold text-texto'}>{diferencia.texto}</span> frente a la semana pasada
            </>
          ) : (
            'Registra minutos al completar tus tareas'
          )
        }
      >
        <span className={NUMERO}>
          {tiempo.horas > 0 && (
            <>
              <Contador valor={tiempo.horas} />
              <span className="text-2xl"> h </span>
            </>
          )}
          <span className={tiempo.horas > 0 ? 'text-2xl' : ''}>
            <Contador valor={tiempo.minutos} />
          </span>
          <span className="text-2xl"> min</span>
        </span>
        <BarrasSemana minutos={resumen.minutosPorDia} hoyIndice={hoyIndice} />
      </TarjetaNumero>
      <TarjetaNumero
        href="/nova/semestre"
        titulo="Promedio actual"
        icono={GraduationCap}
        tono="exito"
        pie={
          promedio.materias === 0
            ? 'Aún no tienes materias'
            : `Asegurado ${promedio.asegurado === null ? '—' : formatearDecimas(promedio.asegurado)} · ${promedio.materias === 1 ? '1 materia' : `${promedio.materias} materias`}`
        }
      >
        <span className={NUMERO}>{promedio.actual === null ? '—' : <Contador valor={promedio.actual} formato="decimas" />}</span>
        {/* De 0 a 5,0, con la marca de la nota para aprobar. */}
        <span aria-hidden="true" className="relative mt-1 h-2 rounded-full bg-superficie-2">
          {promedio.actual !== null && <span className="absolute inset-y-0 left-0 rounded-full bg-exito" style={{ width: `${(promedio.actual / 50) * 100}%` }} />}
          <span className="absolute -inset-y-1 w-0.5 rounded bg-texto-suave" style={{ left: `${(promedio.aprobar / 50) * 100}%` }} />
        </span>
      </TarjetaNumero>
    </ul>
  );
}

/** El corte más próximo, con lo que necesitas para tu meta (o para aprobar). */
export function ProximoCorte({ corte, hoy }: { corte: NonNullable<ResumenInicio['proximoCorte']>; hoy: string }) {
  return (
    <section aria-labelledby="titulo-proximo-corte" className="flex flex-col gap-2 rounded-[20px] bg-acento-suave p-4 shadow-suave sm:p-6">
      <p className="flex items-center gap-2 font-mono text-xs tracking-[0.12em] text-acento uppercase">
        <CalendarClock aria-hidden="true" className="size-4" />
        Próximo corte
      </p>
      <h2 id="titulo-proximo-corte" className="font-display text-xl font-bold text-texto">
        {corte.materia} · {corte.corte}
      </h2>
      <p className="text-sm text-texto">
        {cuandoEs(corte.fecha, hoy)}
        {corte.porcentaje !== null ? ` · ${(corte.porcentaje / 100).toLocaleString('es-CO')} %` : ''}.{corte.texto ? ` ${corte.texto}` : ''}
      </p>
      <Link href={`/nova/semestre/${corte.materiaId}`} prefetch={false} className={`self-start rounded-lg text-sm font-semibold text-acento underline-offset-2 hover:underline ${CLASE_FOCO}`}>
        Ver la materia
      </Link>
    </section>
  );
}
