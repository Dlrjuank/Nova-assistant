'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { EliminarConConfirmacion } from '@/components/nova/EliminarConConfirmacion';
import { Aviso } from '@/components/ui/Aviso';
import { Boton, CLASE_FOCO } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Tarjeta } from '@/components/ui/Tarjeta';
import type { Materia, MetaNota, PlanCorte, Tema } from '@/lib/dataService';
import { formatearFecha } from '@/lib/formato';
import { alcanzable, calcularCorte, calcularMateria, formatearDecimas, validarMeta, type Alcanzable, type Calculo } from '@/lib/reglas/notas';
import { formatearNota, formatearPorcentaje, type Redondeo } from '@/lib/reglas/preferencias';
import { entradaDe } from './estadoMateria';
import { mensajeDe, pedirSemestre } from './peticion';
import { PlanEstudio } from './PlanEstudio';
import { TemasCorte } from './TemasCorte';

// El resultado se dice con texto; el color solo lo refuerza.
const COLOR: Record<Alcanzable['tipo'], string> = {
  alcanzable: 'text-texto',
  asegurada: 'text-exito',
  cumplida: 'text-exito',
  'no-alcanzable': 'text-peligro',
  'no-cumplida': 'text-peligro',
  'sin-sumas': 'text-texto-suave',
};

/** Una meta (de la materia o de un corte): la guardada con "¿Es alcanzable?", y el formulario para definirla. */
function FilaMeta({
  id,
  titulo,
  detalle,
  materiaId,
  corteId,
  meta,
  calculo,
  redondeo,
}: {
  id: string;
  titulo: string;
  detalle: string;
  materiaId: string;
  corteId: string | null;
  meta: number | null;
  calculo: Calculo;
  redondeo: Redondeo;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(meta === null ? '' : formatearNota(meta));
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const errorValor = valor.trim() ? mensajeDe(() => validarMeta(valor)) : '';
  const vistaPrevia = valor.trim() && !errorValor ? alcanzable(calculo, validarMeta(valor), redondeo) : null;
  const guardada = meta === null ? null : alcanzable(calculo, meta, redondeo);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const problema = mensajeDe(() => validarMeta(valor));
    if (problema) {
      setError(problema);
      return;
    }
    setError('');
    setEnviando(true);
    const r = await pedirSemestre('/api/nova/metas-nota', 'PUT', { materiaId, corteId, meta: valor });
    setEnviando(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    setEditando(false);
    router.refresh();
  }

  const consulta = `materia=${materiaId}${corteId ? `&corte=${corteId}` : ''}`;
  return (
    <li className="flex flex-col gap-2 px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-semibold break-words text-texto">{titulo}</p>
          <p className="text-sm text-texto-suave">{detalle}</p>
        </div>
        {!editando && (
          <div className="flex flex-wrap items-center gap-2">
            <Boton variante="secundario" className="min-h-9 py-1.5" aria-label={`${meta === null ? 'Definir' : 'Cambiar'} la meta de ${titulo}`} onClick={() => setEditando(true)}>
              {meta === null ? 'Definir meta' : 'Cambiar'}
            </Boton>
            {meta !== null && <EliminarConConfirmacion ruta={`/api/nova/metas-nota?${consulta}`} etiqueta={`Eliminar la meta de ${titulo}`} pregunta="¿Eliminar esta meta?" />}
          </div>
        )}
      </div>
      {!editando &&
        (meta === null || !guardada ? (
          <p className="text-sm text-texto-suave">Sin meta.</p>
        ) : (
          <p className="text-sm">
            <span className="text-texto">
              Meta: <strong className="tabular-nums">{formatearDecimas(Math.ceil(meta / 10))}</strong>
            </span>
            {' · '}
            <span className={`font-medium ${COLOR[guardada.tipo]}`}>{guardada.texto}</span>
          </p>
        ))}
      {editando && (
        <form onSubmit={(e) => void guardar(e)} noValidate className="flex flex-col gap-2">
          <div className="flex flex-wrap items-start gap-2">
            <div className="w-36">
              <Campo id={`meta-${id}`} etiqueta="Meta" inputMode="decimal" maxLength={4} value={valor} onChange={(e) => setValor(e.target.value)} error={error || errorValor || undefined} ayuda="De 0,1 a 5,0." />
            </div>
            <div className="flex gap-2 pt-7">
              <Boton type="submit" cargando={enviando} disabled={enviando}>
                Guardar meta
              </Boton>
              <Boton
                variante="fantasma"
                disabled={enviando}
                onClick={() => {
                  setEditando(false);
                  setValor(meta === null ? '' : formatearNota(meta));
                  setError('');
                }}
              >
                Cancelar
              </Boton>
            </div>
          </div>
          {vistaPrevia && (
            <p role="status" className={`text-sm font-medium ${COLOR[vistaPrevia.tipo]}`}>
              {vistaPrevia.texto}
            </p>
          )}
        </form>
      )}
    </li>
  );
}

/**
 * E16 (5.7, 6.7, 7.9; RB-18): en "Objetivos y plan", la meta de la materia y, si tiene cortes, la de cada corte con
 * su fecha, y si es alcanzable. Una materia sin cortes solo tiene la meta de la materia.
 */
export function ObjetivosMateria({
  materia,
  metas,
  redondeo,
  temas = [],
  documentos = [],
  planes = {},
  hoy = '',
}: {
  materia: Materia;
  metas: MetaNota[];
  redondeo: Redondeo;
  /** E17: los temas de sus cortes y sus PDF ya indexados. */
  temas?: Tema[];
  documentos?: Array<{ id: string; nombre: string }>;
  /** E18: el plan de estudio de cada corte que ya tiene uno, y la fecha de hoy en Bogotá. */
  planes?: Record<string, PlanCorte>;
  hoy?: string;
}) {
  const entrada = entradaDe(materia);
  const metaDe = (corteId: string | null) => metas.find((m) => m.corteId === corteId)?.meta ?? null;
  const fechaFinal = !materia.usaCortes ? materia.cortes[0]?.fecha : null;
  const fecha = (f: string | null | undefined) => (f ? `hasta el ${formatearFecha(f)}` : 'sin fecha');
  return (
    <Tarjeta className="flex flex-col gap-3">
      <Link href={`/nova/semestre/${materia.id}`} prefetch={false} className={`flex items-center justify-between gap-2 rounded text-lg font-semibold text-texto hover:text-acento ${CLASE_FOCO}`}>
        <span className="min-w-0 break-words">{materia.nombre}</span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-texto-suave" />
      </Link>
      <ul className="flex flex-col divide-y divide-borde rounded-xl border border-borde">
        <FilaMeta
          id={`${materia.id}-materia`}
          titulo="Meta de la materia"
          detalle={materia.usaCortes ? 'Nota final de la materia' : `Fecha final: ${fecha(fechaFinal)}`}
          materiaId={materia.id}
          corteId={null}
          meta={metaDe(null)}
          calculo={calcularMateria(entrada)}
          redondeo={redondeo}
        />
        {materia.usaCortes &&
          materia.cortes.map((c, i) => (
            <FilaMeta
              key={c.id}
              id={c.id}
              titulo={c.nombre}
              detalle={`${formatearPorcentaje(c.porcentaje)} % · ${fecha(c.fecha)}`}
              materiaId={materia.id}
              corteId={c.id}
              meta={metaDe(c.id)}
              calculo={calcularCorte(entrada.cortes[i] as (typeof entrada.cortes)[number])}
              redondeo={redondeo}
            />
          ))}
      </ul>
      {!materia.usaCortes && <Aviso tipo="info">Para tener metas por corte, divide la materia en cortes desde su página.</Aviso>}
      {/* E17 (6.8): los temas de cada corte; sin cortes, los de la materia (en su corte único). */}
      <h3 className="pt-2 text-base font-semibold text-texto">Temas</h3>
      {materia.cortes.map((c) => (
        <TemasCorte key={c.id} corteId={c.id} titulo={materia.usaCortes ? c.nombre : 'Temas de la materia'} temas={temas.filter((t) => t.corteId === c.id)} documentos={documentos} />
      ))}
      {/* E18 (6.9, 9.2 a 9.4): el plan de estudio de cada corte; sin cortes, el de la materia. */}
      <h3 className="pt-2 text-base font-semibold text-texto">Plan de estudio</h3>
      {materia.cortes.map((c) => (
        <PlanEstudio
          key={`${c.id}:${planes[c.id]?.vigente ?? 0}`}
          corteId={c.id}
          titulo={materia.usaCortes ? c.nombre : 'Plan de la materia'}
          materia={materia.nombre}
          plan={planes[c.id] ?? null}
          temas={temas.filter((t) => t.corteId === c.id)}
          hoy={hoy}
          fechaCorte={c.fecha}
        />
      ))}
    </Tarjeta>
  );
}
