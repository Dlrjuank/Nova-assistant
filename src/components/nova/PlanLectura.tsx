'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SelectorCategoria } from '@/components/nova/SelectorCategoria';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Tarjeta } from '@/components/ui/Tarjeta';
import type { Capitulo, PlanLectura as VistaPlan, ResultadoPlanLectura } from '@/lib/dataService';
import { MENSAJES } from '@/lib/reglas/errores';
import { aplicarMascaraFecha, esFechaISOValida, hoyBogota, sumarDias } from '@/lib/reglas/fechas';
import { formatearFecha } from '@/lib/formato';
import { citaDePaginas } from '@/lib/reglas/libros';
import { MAX_POR_SEMANA } from '@/lib/reglas/planLectura';

type Modo = 'fechas' | 'semana';

/**
 * E10d (PLAN_AMPLIACION 5.9, RB-42): elegir capítulos y fechas, ver el plan y confirmarlo.
 * Las fechas y el reparto los calcula el servidor; aquí solo se evita pedir algo que ya se sabe inválido.
 */
export function PlanLectura({
  documentoId,
  capitulos,
  categoriaInicial,
  categorias,
}: {
  documentoId: string;
  capitulos: readonly Capitulo[];
  categoriaInicial: string;
  categorias: ReadonlyArray<{ nombre: string; color: string }>;
}) {
  const router = useRouter();
  const hoy = hoyBogota();
  const [elegidos, setElegidos] = useState<ReadonlySet<number>>(new Set());
  const [modo, setModo] = useState<Modo>('fechas');
  const [inicio, setInicio] = useState(hoy);
  const [fin, setFin] = useState(sumarDias(hoy, 13));
  const [porSemana, setPorSemana] = useState('1');
  const [categoria, setCategoria] = useState(categoriaInicial);
  const [vista, setVista] = useState<VistaPlan | null>(null);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState<ResultadoPlanLectura | null>(null);
  const [cargando, setCargando] = useState(false);

  const disponibles = capitulos.filter((c) => c.nivel === 1 && !c.enTareas);
  const todos = disponibles.length > 0 && disponibles.every((c) => elegidos.has(c.orden));

  // Cualquier cambio invalida la vista previa: lo que se confirma es siempre lo que se ve.
  const cambiar = <T,>(fijar: (v: T) => void) => (v: T) => {
    fijar(v);
    setVista(null);
    setError('');
    setHecho(null);
  };
  const alternar = cambiar((orden: number) =>
    setElegidos((previos) => {
      const nuevos = new Set(previos);
      if (!nuevos.delete(orden)) nuevos.add(orden);
      return nuevos;
    }),
  );
  const elegirTodos = cambiar(() => setElegidos(todos ? new Set() : new Set(disponibles.map((c) => c.orden))));

  const numeroSemana = Number(porSemana);
  const errorInicio = inicio && !esFechaISOValida(inicio) ? MENSAJES.FECHA_INVALIDA : '';
  const errorFin = modo === 'fechas' && fin && !esFechaISOValida(fin) ? MENSAJES.FECHA_INVALIDA : modo === 'fechas' && esFechaISOValida(inicio) && esFechaISOValida(fin) && fin < inicio ? MENSAJES.PLAN_FECHAS_INVERTIDAS : '';
  const errorSemana = modo === 'semana' && !(Number.isInteger(numeroSemana) && numeroSemana >= 1 && numeroSemana <= MAX_POR_SEMANA) ? `Escribe un número de 1 a ${MAX_POR_SEMANA}.` : '';
  const valido = elegidos.size > 0 && esFechaISOValida(inicio) && !errorFin && (modo === 'semana' ? !errorSemana : esFechaISOValida(fin));

  const cuerpo = () => ({
    capitulos: [...elegidos].sort((a, b) => a - b),
    categoria,
    ...(modo === 'fechas' ? { modo, inicio, fin } : { modo, inicio, porSemana: numeroSemana }),
  });

  async function enviar<T>(ruta: string): Promise<T | null> {
    setError('');
    setCargando(true);
    try {
      const respuesta = await fetch(`/api/nova/documentos/${documentoId}/plan-lectura${ruta}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo()),
      });
      const datos = (await respuesta.json().catch(() => null)) as { ok?: boolean; datos?: T; error?: { mensaje?: string } } | null;
      if (!respuesta.ok || !datos?.ok || !datos.datos) {
        setError(datos?.error?.mensaje ?? MENSAJES.ERROR_INTERNO);
        return null;
      }
      return datos.datos;
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.');
      return null;
    } finally {
      setCargando(false);
    }
  }

  async function verPlan() {
    setHecho(null);
    setVista(await enviar<VistaPlan>(''));
  }

  async function confirmar() {
    const resultado = await enviar<ResultadoPlanLectura>('/confirmar');
    if (!resultado) return;
    setHecho(resultado);
    setVista(null);
    setElegidos(new Set());
    router.refresh(); // los capítulos recién agregados pasan a "ya está en Tareas"
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Tarjeta>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-texto">Elige los capítulos para tu plan de lectura</h2>
          {disponibles.length > 0 && (
            <Boton variante="secundario" onClick={() => elegirTodos(undefined)} className="min-h-10 px-3 py-1 text-xs">
              {todos ? 'Quitar todos' : 'Elegir todos'}
            </Boton>
          )}
        </div>
        <ol className="flex flex-col divide-y divide-borde">
          {capitulos.map((c) => {
            const paginas = <span className="shrink-0 text-sm whitespace-nowrap text-texto-suave tabular-nums">{citaDePaginas(c.etiquetaPaginas)}</span>;
            if (c.nivel !== 1) {
              return (
                <li key={c.orden} className="flex items-baseline justify-between gap-4 py-2.5 pl-11">
                  <span className="min-w-0 text-sm break-words text-texto-suave">{c.titulo}</span>
                  {paginas}
                </li>
              );
            }
            const id = `capitulo-${c.orden}`;
            return (
              <li key={c.orden} className="flex items-start justify-between gap-4 py-2.5">
                <div className="flex min-w-0 items-start gap-3">
                  <input
                    id={id}
                    type="checkbox"
                    checked={elegidos.has(c.orden)}
                    disabled={c.enTareas}
                    onChange={() => alternar(c.orden)}
                    className="mt-0.5 size-5 shrink-0 accent-acento"
                  />
                  <label htmlFor={id} className="flex min-w-0 flex-col">
                    <span className={`break-words font-medium ${c.enTareas ? 'text-texto-suave' : 'text-texto'}`}>{c.titulo}</span>
                    {c.enTareas && <span className="text-xs text-texto-suave">{MENSAJES.CAPITULO_EN_TAREAS}</span>}
                  </label>
                </div>
                {paginas}
              </li>
            );
          })}
        </ol>
      </Tarjeta>

      <Tarjeta>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (valido && !cargando) void verPlan();
          }}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium text-texto">Repartir</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {(
                [
                  ['fechas', 'Entre dos fechas'],
                  ['semana', 'Capítulos por semana'],
                ] as const
              ).map(([valor, texto]) => (
                <label key={valor} className="flex min-h-10 items-center gap-2 text-sm text-texto">
                  <input type="radio" name="modo" value={valor} checked={modo === valor} onChange={() => cambiar(setModo)(valor)} className="size-4 accent-acento" />
                  {texto}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-5 sm:grid-cols-2">
            <Campo
              id="plan-inicio"
              etiqueta="Fecha de inicio"
              value={inicio}
              onChange={(e) => cambiar(setInicio)(aplicarMascaraFecha(e.target.value))}
              error={errorInicio}
              placeholder="AAAA-MM-DD"
              inputMode="numeric"
              maxLength={10}
              autoComplete="off"
            />
            {modo === 'fechas' ? (
              <Campo
                id="plan-fin"
                etiqueta="Fecha final"
                value={fin}
                onChange={(e) => cambiar(setFin)(aplicarMascaraFecha(e.target.value))}
                error={errorFin}
                placeholder="AAAA-MM-DD"
                inputMode="numeric"
                maxLength={10}
                autoComplete="off"
              />
            ) : (
              <Campo
                id="plan-semana"
                etiqueta="Cuántos por semana"
                type="number"
                min={1}
                max={MAX_POR_SEMANA}
                value={porSemana}
                onChange={(e) => cambiar(setPorSemana)(e.target.value)}
                error={errorSemana}
                inputMode="numeric"
              />
            )}
          </div>
          <SelectorCategoria id="plan-categoria" etiqueta="Categoría" valor={categoria} onCambio={cambiar(setCategoria)} categorias={categorias} />
          <p className="text-xs text-texto-suave">Formato AAAA-MM-DD. Cada capítulo será una tarea de prioridad media con su fecha límite.</p>
          <div>
            <Boton type="submit" cargando={cargando && !vista} disabled={!valido || cargando}>
              {elegidos.size === 0 ? 'Elige al menos un capítulo' : 'Ver plan'}
            </Boton>
          </div>
        </form>
      </Tarjeta>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {hecho && (
        <Aviso tipo="exito">
          {hecho.creadas === 1 ? 'Se creó 1 tarea de lectura' : `Se crearon ${hecho.creadas} tareas de lectura`} en «{hecho.categoria}».{' '}
          <Link href={`/nova/tareas?categoria=${encodeURIComponent(hecho.categoria)}`} className="font-semibold text-acento underline">
            Ver en Tareas
          </Link>
        </Aviso>
      )}

      {vista && (
        <Tarjeta>
          <h2 className="mb-2 text-base font-semibold text-texto">Tu plan de lectura</h2>
          {vista.tareas.length > 0 ? (
            <ol aria-label="Tareas que se crearán" className="flex flex-col divide-y divide-borde">
              {vista.tareas.map((t) => (
                <li key={t.orden} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <span className="min-w-0 break-words text-texto">{t.titulo}</span>
                  <span className="shrink-0 text-sm whitespace-nowrap text-texto-suave">{formatearFecha(t.fechaLimite)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-texto-suave">{MENSAJES.CAPITULO_EN_TAREAS}</p>
          )}
          {vista.yaEnTareas.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 text-sm text-texto-suave">
              {vista.yaEnTareas.map((c) => (
                <li key={c.orden}>
                  {c.titulo}: {MENSAJES.CAPITULO_EN_TAREAS}
                </li>
              ))}
            </ul>
          )}
          {vista.tareas.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Boton onClick={() => void confirmar()} cargando={cargando} disabled={cargando}>
                {vista.tareas.length === 1 ? 'Crear 1 tarea' : `Crear ${vista.tareas.length} tareas`}
              </Boton>
              <Boton variante="secundario" onClick={() => setVista(null)} disabled={cargando}>
                Cambiar el plan
              </Boton>
            </div>
          )}
        </Tarjeta>
      )}
    </div>
  );
}
