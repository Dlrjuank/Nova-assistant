'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { EliminarConConfirmacion } from '@/components/nova/EliminarConConfirmacion';
import { mensajeDe, pedirSemestre } from '@/components/nova/semestre/peticion';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Insignia } from '@/components/ui/Insignia';
import { Selector } from '@/components/ui/Selector';
import { Tarjeta } from '@/components/ui/Tarjeta';
import type { MetasDeLaSemana } from '@/lib/dataService';
import { textoProgreso, tituloMeta, validarObjetivoMinutos, validarObjetivoTareas, type TipoMeta } from '@/lib/reglas/metasSemanales';
import { rangoSemana } from '@/lib/reglas/semana';

const TODAS = '';

/**
 * E15 (5.6, 7.8; RB-16, RB-17): metas permanentes que se miden cada semana, de lunes a domingo, con las tareas
 * completadas según el día en que se completaron. Crear y eliminar refrescan la pantalla (el servidor calcula).
 */
export function MetasSemanales({ semana, categorias }: { semana: MetasDeLaSemana; categorias: string[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<TipoMeta>('tareas');
  const [categoria, setCategoria] = useState(TODAS);
  const [objetivo, setObjetivo] = useState('');
  const [horas, setHoras] = useState('');
  const [minutos, setMinutos] = useState('');
  const [errorObjetivo, setErrorObjetivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  function cerrar() {
    setAbierto(false);
    setTipo('tareas');
    setCategoria(TODAS);
    setObjetivo('');
    setHoras('');
    setMinutos('');
    setErrorObjetivo('');
    setError('');
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    const problema = mensajeDe(() => (tipo === 'tareas' ? validarObjetivoTareas(objetivo) : validarObjetivoMinutos(horas, minutos)));
    setErrorObjetivo(problema);
    if (problema) return;
    setEnviando(true);
    const r = await pedirSemestre('/api/nova/metas', 'POST', {
      tipo,
      categoria: categoria || null,
      ...(tipo === 'tareas' ? { objetivo } : { horas, minutos }),
    });
    setEnviando(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    cerrar();
    router.refresh();
  }

  return (
    <Tarjeta className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-texto">Metas semanales</h2>
          <p className="text-sm text-texto-suave">Semana del {rangoSemana(semana.lunes)}</p>
        </div>
        {!abierto && (
          <Boton variante="secundario" onClick={() => setAbierto(true)}>
            <Plus aria-hidden="true" className="size-4" />
            Nueva meta
          </Boton>
        )}
      </div>
      <p className="text-sm text-texto-suave">
        Las metas cuentan las tareas según el día en que las completaste, de lunes a domingo, y no por su fecha límite como el índice del día. Cada semana empiezan de nuevo.
      </p>

      {abierto && (
        <form onSubmit={(e) => void guardar(e)} noValidate className="flex flex-col gap-3 rounded-xl border border-borde p-3 sm:p-4" aria-label="Nueva meta semanal">
          <div className="grid gap-3 sm:grid-cols-2">
            <Selector
              id="meta-tipo"
              etiqueta="Qué quieres medir"
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as TipoMeta);
                setErrorObjetivo('');
              }}
              opciones={[
                { valor: 'tareas', texto: 'Tareas completadas' },
                { valor: 'minutos', texto: 'Tiempo dedicado' },
              ]}
            />
            <Selector
              id="meta-categoria"
              etiqueta="Categoría"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              opciones={[{ valor: TODAS, texto: 'Todas las categorías' }, ...categorias.map((c) => ({ valor: c, texto: c }))]}
            />
          </div>
          {tipo === 'tareas' ? (
            <div className="sm:max-w-60">
              <Campo id="meta-objetivo" etiqueta="Tareas por semana" inputMode="numeric" maxLength={6} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} error={errorObjetivo || undefined} />
            </div>
          ) : (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-sm font-medium text-texto">Tiempo por semana</legend>
              <div className="grid grid-cols-2 gap-3 sm:max-w-80">
                <Campo id="meta-horas" etiqueta="Horas" inputMode="numeric" maxLength={3} value={horas} onChange={(e) => setHoras(e.target.value)} aria-invalid={errorObjetivo ? true : undefined} />
                <Campo id="meta-minutos" etiqueta="Minutos" inputMode="numeric" maxLength={2} value={minutos} onChange={(e) => setMinutos(e.target.value)} aria-invalid={errorObjetivo ? true : undefined} />
              </div>
              {errorObjetivo && (
                <p role="alert" className="text-xs font-medium text-peligro">
                  {errorObjetivo}
                </p>
              )}
            </fieldset>
          )}
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div className="flex flex-wrap gap-2">
            <Boton type="submit" cargando={enviando} disabled={enviando}>
              Guardar meta
            </Boton>
            <Boton variante="fantasma" onClick={cerrar} disabled={enviando}>
              Cancelar
            </Boton>
          </div>
        </form>
      )}

      {semana.metas.length === 0 ? (
        !abierto && <p className="text-sm text-texto-suave">Aún no tienes metas semanales.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {semana.metas.map((m) => {
            const titulo = tituloMeta(m);
            const texto = textoProgreso(m, m.progreso);
            return (
              <li key={m.id} className="flex flex-col gap-2 rounded-xl border border-borde p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="font-semibold break-words text-texto">{titulo}</p>
                    <p className="text-sm text-texto-suave tabular-nums">
                      {texto} · {m.porcentaje} %
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.cumplida && <Insignia tono="exito">Cumplida</Insignia>}
                    <EliminarConConfirmacion ruta={`/api/nova/metas/${m.id}`} etiqueta={`Eliminar la meta ${titulo}`} pregunta="¿Eliminar esta meta?" />
                  </div>
                </div>
                <div
                  role="progressbar"
                  aria-label={titulo}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={m.porcentaje}
                  aria-valuetext={`${texto}${m.cumplida ? ', cumplida' : ''}`}
                  className="h-2.5 overflow-hidden rounded-full bg-superficie-2"
                >
                  <div className={`h-full rounded-full ${m.cumplida ? 'bg-exito' : 'bg-acento'}`} style={{ width: `${m.porcentaje}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}
