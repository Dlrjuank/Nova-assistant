'use client';

import { CalendarDays, Clock, History, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Insignia } from '@/components/ui/Insignia';
import { Selector } from '@/components/ui/Selector';
import type { PlanCorte, Tema, VersionPlan } from '@/lib/dataService';
import { aplicarMascaraFecha } from '@/lib/reglas/fechas';
import { minutosDe, pasosDe, textoCambiosPlan, textoDia, textoMinutos, textoOrigen, textoSemana, validarPlanManual, type PasoEditado } from '@/lib/reglas/planEstudio';
import { EnTareas, PasarATareas } from './PasarATareas';
import { mensajeDe, pedirSemestre } from './peticion';
import { RequiereIa } from '@/components/nova/ia/RequiereIa';

/** "17/11/2026 a las 19:40" a partir de 'YYYY-MM-DDTHH:MM' (ya en Bogotá). */
function textoCreada(v: string): string {
  const [fecha = '', hora = ''] = v.split('T');
  const [a, m, d] = fecha.split('-');
  return `${d}/${m}/${a} a las ${hora}`;
}

/** Los pasos de una versión por semanas y días, con el tema, los minutos y las citas de cada paso. */
function VistaPlan({
  version,
  nombreTema,
  enTareas,
  pasar,
}: {
  version: VersionPlan;
  nombreTema: (id: string) => string;
  /** E19: paso → tarea, para los ya pasados. */
  enTareas: Record<string, string>;
  /** E19: con qué plan y materia se pasa un paso; sin esto (viendo otra versión), no hay botón. */
  pasar: { planId: string; materia: string } | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      {version.contenido.semanas.map((s) => (
        <section key={s.inicio} aria-label={textoSemana(s.inicio)} className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold tracking-wide text-texto-suave uppercase">{textoSemana(s.inicio)}</h4>
          <ol className="flex flex-col gap-2">
            {s.dias.map((d) => (
              <li key={d.fecha} className="rounded-lg border border-borde">
                <p className="flex items-center gap-2 border-b border-borde px-3 py-2 text-sm font-semibold text-texto first-letter:uppercase">
                  <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-texto-suave" />
                  <span className="first-letter:uppercase">{textoDia(d.fecha)}</span>
                </p>
                <ul className="flex flex-col divide-y divide-borde">
                  {d.pasos.map((p) => (
                    <li key={p.id} className="flex flex-col gap-1 px-3 py-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="min-w-0 text-sm font-medium break-words text-texto">{p.titulo}</p>
                        <p className="flex shrink-0 items-center gap-1 text-xs text-texto-suave tabular-nums">
                          <Clock aria-hidden="true" className="size-3.5" />
                          {textoMinutos(p.minutos)}
                        </p>
                      </div>
                      <p className="text-xs break-words text-texto-suave">Tema: {nombreTema(p.tema_id)}</p>
                      {p.fuentes.length > 0 && <p className="text-xs break-words text-texto-suave">Fuente: {p.fuentes.join(' · ')}</p>}
                      {enTareas[p.id] ? (
                        <EnTareas tareaId={enTareas[p.id] as string} />
                      ) : (
                        pasar && <PasarATareas planId={pasar.planId} pasoId={p.id} titulo={p.titulo} fecha={d.fecha} materia={pasar.materia} />
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

type Fila = { clave: string; id?: string | undefined; titulo: string; fecha: string; minutos: string; temaId: string };

/** 9.4 "Editar": título, fecha y minutos de cada paso, quitar pasos y agregar con un tema confirmado. */
function EditarPlan({
  corteId,
  version,
  confirmados,
  nombreTema,
  hoy,
  fechaCorte,
  alTerminar,
}: {
  corteId: string;
  version: VersionPlan;
  confirmados: Tema[];
  nombreTema: (id: string) => string;
  hoy: string;
  fechaCorte: string | null;
  alTerminar: () => void;
}) {
  const router = useRouter();
  const anteriores = pasosDe(version.contenido);
  const [filas, setFilas] = useState<Fila[]>(() =>
    anteriores.map((p) => ({ clave: p.id, id: p.id, titulo: p.titulo, fecha: p.fecha, minutos: String(p.minutos), temaId: p.tema_id })),
  );
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [contador, setContador] = useState(0);

  const cambiar = (clave: string, campo: keyof Omit<Fila, 'clave' | 'id'>, valor: string) => setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)));
  const pasosEditados = (): PasoEditado[] => filas.map((f) => ({ ...(f.id ? { id: f.id } : {}), titulo: f.titulo, fecha: f.fecha, minutos: f.minutos, temaId: f.temaId }));

  function agregar() {
    const n = contador + 1;
    setContador(n);
    const fecha = fechaCorte && fechaCorte > hoy ? hoy : '';
    setFilas((fs) => [...fs, { clave: `nuevo-${n}`, titulo: '', fecha, minutos: '30', temaId: confirmados[0]?.id ?? '' }]);
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const pasos = pasosEditados();
    const problema = mensajeDe(() =>
      validarPlanManual(pasos, { anteriores, temasConfirmados: new Set(confirmados.map((t) => t.id)), hoy, fechaCorte, nuevoId: () => crypto.randomUUID() }),
    );
    if (problema) {
      setError(problema);
      return;
    }
    setError('');
    setEnviando(true);
    const r = await pedirSemestre(`/api/nova/cortes/${corteId}/plan/versiones`, 'POST', { pasos });
    setEnviando(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    alTerminar();
    router.refresh();
  }

  return (
    <form onSubmit={(e) => void guardar(e)} noValidate className="flex flex-col gap-3">
      <p className="text-sm text-texto-suave">Guardar crea una versión nueva; la anterior queda en Versiones.</p>
      <ul className="flex flex-col gap-3">
        {filas.map((f, i) => {
          const opciones = confirmados.map((t) => ({ valor: t.id, texto: t.nombre }));
          // Un paso cuyo tema ya no está confirmado lo conserva mientras no se cambie (9.4).
          if (f.temaId && !confirmados.some((t) => t.id === f.temaId)) opciones.unshift({ valor: f.temaId, texto: nombreTema(f.temaId) });
          return (
            <li key={f.clave} className="flex flex-col gap-2 rounded-lg border border-borde p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-texto">Paso {i + 1}</p>
                <Boton variante="fantasma" className="min-h-9 py-1.5" aria-label={`Quitar el paso ${i + 1}`} onClick={() => setFilas((fs) => fs.filter((x) => x.clave !== f.clave))}>
                  <Trash2 aria-hidden="true" className="size-4" />
                  Quitar
                </Boton>
              </div>
              <Campo id={`paso-titulo-${f.clave}`} etiqueta="Qué hacer" value={f.titulo} maxLength={120} onChange={(e) => cambiar(f.clave, 'titulo', e.target.value)} />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_8rem_minmax(0,1.5fr)]">
                <Campo
                  id={`paso-fecha-${f.clave}`}
                  etiqueta="Fecha"
                  inputMode="numeric"
                  placeholder="AAAA-MM-DD"
                  value={f.fecha}
                  onChange={(e) => cambiar(f.clave, 'fecha', aplicarMascaraFecha(e.target.value))}
                />
                <Campo id={`paso-minutos-${f.clave}`} etiqueta="Minutos" inputMode="numeric" maxLength={3} value={f.minutos} onChange={(e) => cambiar(f.clave, 'minutos', e.target.value.replace(/\D/g, ''))} />
                <Selector id={`paso-tema-${f.clave}`} etiqueta="Tema" value={f.temaId} onChange={(e) => cambiar(f.clave, 'temaId', e.target.value)} opciones={opciones} />
              </div>
            </li>
          );
        })}
      </ul>
      {confirmados.length > 0 ? (
        <Boton variante="secundario" className="self-start" onClick={agregar}>
          <Plus aria-hidden="true" className="size-4" />
          Agregar paso
        </Boton>
      ) : (
        <p className="text-sm text-texto-suave">Para agregar pasos, confirma al menos un tema del corte.</p>
      )}
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <Boton type="submit" cargando={enviando} disabled={enviando}>
          Guardar cambios
        </Boton>
        <Boton variante="fantasma" disabled={enviando} onClick={alTerminar}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}

/**
 * E18 (5.7, 9.2 a 9.4; RB-19 a RB-23): el plan de estudio de un corte (o de la materia sin cortes). Generar con el
 * asistente, verlo por semanas y días, editarlo, ver y restaurar versiones, y el aviso de cambios con "Actualizar
 * plan". Nunca cambia solo.
 */
export function PlanEstudio({
  corteId,
  titulo,
  materia,
  plan,
  temas,
  hoy,
  fechaCorte,
}: {
  corteId: string;
  titulo: string;
  /** E19: el nombre de la materia (la categoría de las tareas que salen del plan). */
  materia: string;
  plan: PlanCorte | null;
  /** Los temas del corte (confirmados y propuestos), para los nombres y para editar. */
  temas: Tema[];
  hoy: string;
  fechaCorte: string | null;
}) {
  const router = useRouter();
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(false);
  const [verVersiones, setVerVersiones] = useState(false);
  const [vista, setVista] = useState<VersionPlan | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const confirmados = temas.filter((t) => t.estado === 'confirmado');
  const nombreTema = (id: string) => temas.find((t) => t.id === id)?.nombre ?? 'Tema eliminado';
  const version = vista ?? plan?.version ?? null;
  const viendoOtra = plan !== null && vista !== null && vista.numero !== plan.vigente;

  async function generar() {
    setError('');
    setGenerando(true);
    const r = await pedirSemestre<PlanCorte>(`/api/nova/cortes/${corteId}/plan/generar`, 'POST');
    setGenerando(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    setVista(null);
    router.refresh();
  }

  async function ver(numero: number) {
    setError('');
    setOcupado(true);
    try {
      const r = await fetch(`/api/nova/cortes/${corteId}/plan?version=${numero}`);
      const d = (await r.json().catch(() => null)) as { ok?: boolean; datos?: PlanCorte; error?: { mensaje?: string } } | null;
      if (!r.ok || !d?.ok || !d.datos) setError(d?.error?.mensaje ?? 'No se pudo abrir esa versión. Intenta de nuevo.');
      else setVista(d.datos.version.numero === plan?.vigente ? null : d.datos.version);
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.');
    }
    setOcupado(false);
  }

  async function restaurar(numero: number) {
    setError('');
    setOcupado(true);
    const r = await pedirSemestre(`/api/nova/cortes/${corteId}/plan/restaurar`, 'POST', { numero });
    setOcupado(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    setVista(null);
    router.refresh();
  }

  return (
    <section aria-label={`Plan de estudio de ${titulo}`} className="flex flex-col gap-3 rounded-xl border border-borde p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-texto">{titulo}</h3>
        {plan && version && (
          <p className="text-sm text-texto-suave">
            {pasosDe(version.contenido).length} pasos · {textoMinutos(minutosDe(version.contenido))}
          </p>
        )}
      </div>

      {!plan && !generando && (
        <p className="text-sm text-texto-suave">
          Aún no hay plan. El asistente lo arma con los temas confirmados, tus notas, tu meta y los PDF de la materia, hasta la fecha del corte.
        </p>
      )}

      {plan && version && !editando && (
        <>
          {plan.cambios.length > 0 && !viendoOtra && (
            <Aviso tipo="advertencia">
              <span className="flex flex-col items-start gap-2">
                <span>{textoCambiosPlan(plan.cambios)}</span>
                <RequiereIa compacto>
                <Boton variante="secundario" className="min-h-9 py-1.5" cargando={generando} disabled={generando || ocupado} onClick={() => void generar()}>
                  <Sparkles aria-hidden="true" className="size-4" />
                  {generando ? 'Armando el plan…' : 'Actualizar plan'}
                </Boton>
                </RequiereIa>
              </span>
            </Aviso>
          )}
          <p className="flex flex-wrap items-center gap-2 text-sm text-texto">
            <span className="font-medium">Versión {version.numero}</span>
            <Insignia tono={version.origen === 'asistente' ? 'acento' : 'neutro'}>{textoOrigen(version.origen)}</Insignia>
            <span className="text-texto-suave">{textoCreada(version.creadaEn)}</span>
          </p>
          {viendoOtra && (
            <Aviso tipo="info">
              <span className="flex flex-col items-start gap-2">
                <span>
                  Estás viendo la versión {version.numero}. La vigente es la {plan.vigente}.
                </span>
                <span className="flex flex-wrap gap-2">
                  <Boton variante="secundario" className="min-h-9 py-1.5" cargando={ocupado} disabled={ocupado} onClick={() => void restaurar(version.numero)}>
                    Restaurar esta versión
                  </Boton>
                  <Boton variante="fantasma" className="min-h-9 py-1.5" disabled={ocupado} onClick={() => setVista(null)}>
                    Volver a la vigente
                  </Boton>
                </span>
              </span>
            </Aviso>
          )}
          <VistaPlan version={version} nombreTema={nombreTema} enTareas={plan.enTareas} pasar={viendoOtra ? null : { planId: plan.planId, materia }} />
        </>
      )}

      {plan && editando && (
        <EditarPlan corteId={corteId} version={plan.version} confirmados={confirmados} nombreTema={nombreTema} hoy={hoy} fechaCorte={fechaCorte} alTerminar={() => setEditando(false)} />
      )}

      {error && <Aviso tipo="error">{error}</Aviso>}

      {!editando && (
        <div className="flex flex-wrap gap-2 border-t border-borde pt-3">
          {(!plan || plan.cambios.length === 0 || viendoOtra) && (
            <RequiereIa compacto>
            <Boton variante={plan ? 'fantasma' : 'primario'} cargando={generando} disabled={generando || ocupado} onClick={() => void generar()}>
              <Sparkles aria-hidden="true" className="size-4" />
              {generando ? 'Armando el plan…' : plan ? 'Generar de nuevo' : 'Generar plan'}
            </Boton>
            </RequiereIa>
          )}
          {plan && !viendoOtra && (
            <Boton
              variante="secundario"
              disabled={generando || ocupado}
              onClick={() => {
                setError('');
                setEditando(true);
              }}
            >
              <Pencil aria-hidden="true" className="size-4" />
              Editar
            </Boton>
          )}
          {plan && plan.versiones.length > 1 && (
            <Boton variante="fantasma" aria-expanded={verVersiones} disabled={generando} onClick={() => setVerVersiones((v) => !v)}>
              <History aria-hidden="true" className="size-4" />
              Versiones ({plan.versiones.length})
            </Boton>
          )}
        </div>
      )}

      {plan && verVersiones && !editando && (
        <ul aria-label={`Versiones del plan de ${titulo}`} className="flex flex-col divide-y divide-borde rounded-lg border border-borde">
          {plan.versiones.map((v) => (
            <li key={v.numero} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <p className="min-w-0 text-sm text-texto">
                <span className="font-medium">Versión {v.numero}</span> · {textoOrigen(v.origen)} · {v.pasos} pasos
                <span className="block text-xs text-texto-suave">{textoCreada(v.creadaEn)}</span>
              </p>
              {v.numero === plan.vigente ? (
                <Insignia tono="exito">Vigente</Insignia>
              ) : (
                <Boton variante="fantasma" className="min-h-9 py-1.5" aria-label={`Ver la versión ${v.numero}`} disabled={ocupado} onClick={() => void ver(v.numero)}>
                  Ver
                </Boton>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
