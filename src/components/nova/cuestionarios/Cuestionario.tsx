'use client';

import { CheckCircle2, CircleMinus, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton, CLASE_FOCO } from '@/components/ui/Boton';
import { CLASE_CONTROL } from '@/components/ui/Campo';
import { Tarjeta } from '@/components/ui/Tarjeta';
import type { CuestionarioVista, PreguntaVista, ResultadoRespuesta, SugerenciaRepaso } from '@/lib/dataService';
import { formatearPuntaje, NOMBRE_DIFICULTAD } from '@/lib/reglas/cuestionarios';
import { MENSAJES } from '@/lib/reglas/errores';
import {
  AUTOEVALUACIONES,
  esFallada,
  formatearPuntos,
  HUECO,
  INDICACION_ABIERTA,
  MENSAJE_ESCRIBE,
  MENSAJE_MARCA_UNA,
  NOMBRE_AUTOEVALUACION,
  NOMBRE_TIPO,
  TEXTO_ABIERTA_MAX,
  TEXTO_COMPLETAR_MAX,
  textoCuantasCorrectas,
  type Autoevaluacion,
} from '@/lib/reglas/tiposPregunta';
import { SugerenciasRepaso } from './SugerenciasRepaso';

type Resultado = { aciertos: number; total: number; puntaje: number; sugerencias: SugerenciaRepaso[] };
type Respuesta = NonNullable<PreguntaVista['respuesta']>;
type Cuerpo = { elegida: number } | { elegidas: number[] } | { verdadero: boolean } | { texto: string };

const LETRAS = ['A', 'B', 'C', 'D'];
const CLASE_OPCION = `flex min-h-14 w-full items-center gap-3 rounded-xl border-2 bg-superficie px-4 py-3 text-left text-base text-texto ${CLASE_FOCO}`;

/** Una pregunta está completa cuando tiene puntos: respondida y, si es abierta, calificada (RB-68). */
const completa = (p: PreguntaVista) => p.respuesta !== undefined && p.respuesta.puntos !== null;

/** Ícono y texto, no solo color (5.11). */
function Marca({ tono, texto }: { tono: 'bien' | 'medias' | 'mal'; texto: string }) {
  const Icono = tono === 'bien' ? CheckCircle2 : tono === 'mal' ? XCircle : CircleMinus;
  const color = tono === 'bien' ? 'text-exito' : tono === 'mal' ? 'text-peligro' : 'text-aviso';
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 text-sm font-semibold ${color}`}>
      <Icono aria-hidden="true" className="size-4" />
      {texto}
    </span>
  );
}

/** 7.12: 100 acertó, 0 no, y lo de en medio "A medias" con lo que vale. */
function MarcaPuntos({ puntos }: { puntos: number }) {
  if (puntos === 100) return <Marca tono="bien" texto="¡Acertaste!" />;
  if (puntos === 0) return <Marca tono="mal" texto="No acertaste" />;
  return <Marca tono="medias" texto={`A medias: vale ${formatearPuntos(puntos)} de 1`} />;
}

type EstadoOpcion = 'normal' | 'correcta' | 'elegida-mal';
const BORDE: Record<EstadoOpcion, string> = { normal: 'border-borde', correcta: 'border-exito', 'elegida-mal': 'border-peligro' };

function MarcaOpcion({ estado }: { estado: EstadoOpcion }) {
  if (estado === 'correcta') return <Marca tono="bien" texto="Correcta" />;
  if (estado === 'elegida-mal') return <Marca tono="mal" texto="Tu respuesta" />;
  return null;
}

/** Selección única: se responde al tocar (E10e). */
function Opcion({ letra, texto, estado, deshabilitada, alElegir }: { letra: string; texto: string; estado: EstadoOpcion; deshabilitada: boolean; alElegir: () => void }) {
  return (
    <li>
      <button type="button" onClick={alElegir} disabled={deshabilitada} className={`${CLASE_OPCION} ${BORDE[estado]} enabled:hover:border-acento disabled:cursor-default`}>
        <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-superficie-2 text-sm font-semibold">
          {letra}
        </span>
        <span className="min-w-0 flex-1 break-words">{texto}</span>
        <MarcaOpcion estado={estado} />
      </button>
    </li>
  );
}

/** Respuesta múltiple: casillas de todo el ancho, de 56 px de alto como las opciones (5.12). */
function Casilla({ texto, marcada, estado, deshabilitada, alCambiar }: { texto: string; marcada: boolean; estado: EstadoOpcion; deshabilitada: boolean; alCambiar: () => void }) {
  return (
    <li>
      <label className={`${CLASE_OPCION} ${BORDE[estado]} ${deshabilitada ? '' : 'cursor-pointer hover:border-acento'} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-acento`}>
        <input type="checkbox" checked={marcada} onChange={alCambiar} disabled={deshabilitada} className="size-5 shrink-0 accent-acento" />
        <span className="min-w-0 flex-1 break-words">{texto}</span>
        <MarcaOpcion estado={estado} />
      </label>
    </li>
  );
}

/** Explicación, cita y página: se muestran siempre al responder, para comprobarlo (9.6). */
function Solucion({ respuesta, children }: { respuesta: Respuesta; children?: ReactNode }) {
  return (
    <div role="status" className="mt-4 flex flex-col gap-2 rounded-xl bg-superficie-2 p-4">
      {respuesta.puntos !== null && <MarcaPuntos puntos={respuesta.puntos} />}
      {children}
      <p className="text-sm text-texto">{respuesta.explicacion}</p>
      <blockquote className="border-l-2 border-borde pl-3 text-sm text-texto-suave italic">«{respuesta.cita}»</blockquote>
      <p className="text-xs text-texto-suave">{respuesta.fuente}</p>
    </div>
  );
}

/** Completar y abierta: un campo de texto (de varias líneas en la abierta) y "Enviar respuesta". */
function FormularioTexto({ pregunta, ocupado, alEnviar }: { pregunta: PreguntaVista; ocupado: boolean; alEnviar: (c: Cuerpo) => void }) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const abierta = pregunta.tipo === 'abierta';
  const id = `respuesta-${pregunta.id}`;
  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!texto.trim()) {
      setError(MENSAJE_ESCRIBE);
      return;
    }
    setError('');
    alEnviar({ texto: texto.trim() });
  }
  const comunes = {
    id,
    value: texto,
    disabled: ocupado,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
    className: `${CLASE_CONTROL} ${error ? 'border-peligro' : 'border-borde'}`,
  };
  return (
    <form onSubmit={enviar} className="mt-4 flex flex-col gap-3">
      <label htmlFor={id} className="text-sm font-medium text-texto">
        Tu respuesta
      </label>
      {abierta ? (
        <textarea {...comunes} rows={5} maxLength={TEXTO_ABIERTA_MAX} onChange={(e) => setTexto(e.target.value)} />
      ) : (
        <input {...comunes} type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={TEXTO_COMPLETAR_MAX} onChange={(e) => setTexto(e.target.value)} />
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-peligro">
          {error}
        </p>
      )}
      <div>
        <Boton type="submit" cargando={ocupado} disabled={ocupado}>
          Enviar respuesta
        </Boton>
      </div>
    </form>
  );
}

/** La pregunta en pantalla según su tipo (5.12). Se monta de nuevo en cada pregunta, con sus campos vacíos. */
function PreguntaEnPantalla({
  pregunta,
  ocupado,
  alResponder,
  alCalificar,
}: {
  pregunta: PreguntaVista;
  ocupado: boolean;
  alResponder: (c: Cuerpo) => void;
  alCalificar: (c: Autoevaluacion) => void;
}) {
  const [marcadas, setMarcadas] = useState<number[]>([]);
  const [errorMarcar, setErrorMarcar] = useState('');
  const r = pregunta.respuesta;
  const opciones = pregunta.opciones ?? [];

  switch (pregunta.tipo) {
    case 'unica':
      return (
        <>
          <ul aria-label="Opciones" className="mt-4 flex flex-col gap-2">
            {opciones.map((texto, i) => (
              <Opcion
                key={i}
                letra={LETRAS[i] as string}
                texto={texto}
                estado={r ? (i === r.correcta ? 'correcta' : i === r.elegida ? 'elegida-mal' : 'normal') : 'normal'}
                deshabilitada={Boolean(r) || ocupado}
                alElegir={() => alResponder({ elegida: i })}
              />
            ))}
          </ul>
          {r && <Solucion respuesta={r} />}
        </>
      );

    case 'multiple': {
      const elegidas = r ? (r.elegidas ?? []) : marcadas;
      return (
        <>
          <p className="mt-1 text-sm font-medium text-texto-suave">{textoCuantasCorrectas(pregunta.cuantasCorrectas ?? 0)}</p>
          <ul aria-label="Opciones" className="mt-4 flex flex-col gap-2">
            {opciones.map((texto, i) => (
              <Casilla
                key={i}
                texto={texto}
                marcada={elegidas.includes(i)}
                estado={r ? (r.correctas?.includes(i) ? 'correcta' : elegidas.includes(i) ? 'elegida-mal' : 'normal') : 'normal'}
                deshabilitada={Boolean(r) || ocupado}
                alCambiar={() => {
                  setErrorMarcar('');
                  setMarcadas((m) => (m.includes(i) ? m.filter((x) => x !== i) : [...m, i].sort((a, b) => a - b)));
                }}
              />
            ))}
          </ul>
          {!r && (
            <div className="mt-3 flex flex-col items-start gap-2">
              {errorMarcar && <p className="text-xs font-medium text-peligro">{errorMarcar}</p>}
              <Boton
                cargando={ocupado}
                disabled={ocupado}
                onClick={() => (marcadas.length === 0 ? setErrorMarcar(MENSAJE_MARCA_UNA) : alResponder({ elegidas: marcadas }))}
              >
                Enviar respuesta
              </Boton>
            </div>
          )}
          {r && <Solucion respuesta={r} />}
        </>
      );
    }

    case 'vf':
      return (
        <>
          <div role="group" aria-label="Verdadero o falso" className="mt-4 grid grid-cols-2 gap-3">
            {[true, false].map((valor) => {
              const estado: EstadoOpcion = r ? (valor === r.verdadero ? 'correcta' : valor === r.respondioVerdadero ? 'elegida-mal' : 'normal') : 'normal';
              return (
                <button
                  key={String(valor)}
                  type="button"
                  onClick={() => alResponder({ verdadero: valor })}
                  disabled={Boolean(r) || ocupado}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border-2 ${BORDE[estado]} bg-superficie px-3 py-3 text-lg font-semibold text-texto enabled:hover:border-acento disabled:cursor-default ${CLASE_FOCO}`}
                >
                  {valor ? 'Verdadero' : 'Falso'}
                  <MarcaOpcion estado={estado} />
                </button>
              );
            })}
          </div>
          {r && <Solucion respuesta={r} />}
        </>
      );

    case 'completar':
      return r ? (
        <Solucion respuesta={r}>
          <p className="text-sm text-texto">
            Tu respuesta: <span className="font-medium break-words">{r.texto}</span>
          </p>
          <p className="text-sm text-texto">
            Lo que faltaba: <span className="font-semibold break-words">{r.respuestaCorrecta}</span>
          </p>
        </Solucion>
      ) : (
        <FormularioTexto pregunta={pregunta} ocupado={ocupado} alEnviar={alResponder} />
      );

    case 'abierta':
      if (!r) return <FormularioTexto pregunta={pregunta} ocupado={ocupado} alEnviar={alResponder} />;
      return (
        <>
          <div className="mt-4 flex flex-col gap-1">
            <p className="text-sm font-medium text-texto-suave">Tu respuesta</p>
            <p className="text-base whitespace-pre-wrap break-words text-texto">{r.texto}</p>
          </div>
          <Solucion respuesta={r}>
            <p className="text-sm font-semibold text-texto">Respuesta modelo</p>
            <p className="text-sm break-words text-texto">{r.respuestaCorrecta}</p>
          </Solucion>
          {r.puntos === null && (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-sm font-medium text-texto">{INDICACION_ABIERTA}</p>
              <div role="group" aria-label="Califícate" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {AUTOEVALUACIONES.map((c) => (
                  <Boton key={c} variante="secundario" className="min-h-12" disabled={ocupado} onClick={() => alCalificar(c)}>
                    {NOMBRE_AUTOEVALUACION[c]}
                  </Boton>
                ))}
              </div>
            </div>
          )}
        </>
      );
  }
}

/** En completar, el espacio en blanco se ve como una línea y se lee "espacio en blanco". */
function Enunciado({ texto }: { texto: string }) {
  const partes = texto.split(HUECO);
  if (partes.length === 1) return <>{texto}</>;
  return (
    <>
      {partes.map((parte, i) => (
        <span key={i}>
          {parte}
          {i < partes.length - 1 && (
            <>
              <span aria-hidden="true" className="tracking-widest text-acento">
                {HUECO}
              </span>
              <span className="sr-only">(espacio en blanco)</span>
            </>
          )}
        </span>
      ))}
    </>
  );
}

/** La respuesta correcta de una fallada, para el resultado. */
function textoSolucion(p: PreguntaVista): string {
  const r = p.respuesta;
  const opciones = p.opciones ?? [];
  switch (p.tipo) {
    case 'unica':
      return `Respuesta correcta: ${opciones[r?.correcta ?? 0] ?? ''}`;
    case 'multiple':
      return `Respuestas correctas: ${(r?.correctas ?? []).map((i) => opciones[i]).join(' · ')}`;
    case 'vf':
      return `Respuesta correcta: ${r?.verdadero ? 'Verdadero' : 'Falso'}`;
    case 'completar':
      return `Lo que faltaba: ${r?.respuestaCorrecta ?? ''}`;
    case 'abierta':
      return `Respuesta modelo: ${r?.respuestaCorrecta ?? ''}`;
  }
}

/** E10e y E10g (5.11, 5.12): una pregunta por pantalla; cada respuesta se guarda al momento y no se cambia (RB-51). */
export function Cuestionario({
  datos,
  aviso,
  categorias = [],
}: {
  datos: CuestionarioVista;
  aviso?: string | undefined;
  categorias?: ReadonlyArray<{ nombre: string; color: string }>;
}) {
  const router = useRouter();
  const { intento } = datos;
  const [preguntas, setPreguntas] = useState<PreguntaVista[]>(intento.preguntas);
  const primeraSinTerminar = preguntas.findIndex((p) => !completa(p));
  const [indice, setIndice] = useState(primeraSinTerminar === -1 ? preguntas.length : primeraSinTerminar);
  const [resultado, setResultado] = useState<Resultado | null>(
    intento.terminado && intento.aciertos !== null && intento.puntaje !== null ? { aciertos: intento.aciertos, total: intento.total, puntaje: intento.puntaje, sugerencias: intento.sugerencias } : null,
  );
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  async function pedir<T>(url: string, cuerpo: unknown): Promise<T | null> {
    setError('');
    setOcupado(true);
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
      const d = (await r.json().catch(() => null)) as { ok?: boolean; datos?: T; error?: { mensaje?: string } } | null;
      if (!r.ok || !d?.ok || !d.datos) {
        setError(d?.error?.mensaje ?? MENSAJES.ERROR_INTERNO);
        return null;
      }
      return d.datos;
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.');
      return null;
    } finally {
      setOcupado(false);
    }
  }

  function guardar(pregunta: PreguntaVista, r: ResultadoRespuesta) {
    const { resultado: final, ...respuesta } = r;
    setPreguntas((previas) => previas.map((p) => (p.id === pregunta.id ? { ...p, respuesta } : p)));
    if (final) setResultado(final);
  }

  async function responder(pregunta: PreguntaVista, cuerpo: Cuerpo) {
    if (ocupado || pregunta.respuesta) return;
    const r = await pedir<ResultadoRespuesta>(`/api/nova/intentos/${intento.id}/respuestas`, { preguntaId: pregunta.id, ...cuerpo });
    if (r) guardar(pregunta, r);
  }

  async function calificar(pregunta: PreguntaVista, calificacion: Autoevaluacion) {
    if (ocupado || !pregunta.respuesta || pregunta.respuesta.puntos !== null) return;
    const r = await pedir<ResultadoRespuesta>(`/api/nova/intentos/${intento.id}/autoevaluacion`, { preguntaId: pregunta.id, calificacion });
    if (r) guardar(pregunta, r);
  }

  async function empezar(repasoDe?: string) {
    const nuevo = await pedir<{ id: string }>(`/api/nova/cuestionarios/${datos.id}/intentos`, repasoDe ? { repasoDe } : {});
    if (nuevo) router.refresh(); // la página trae el intento nuevo
  }

  const encabezado = (
    <p className="text-sm text-texto-suave">
      {datos.alcance} · {NOMBRE_TIPO[datos.tipo]} · Dificultad {NOMBRE_DIFICULTAD[datos.dificultad].toLowerCase()}
      {intento.repaso ? ' · Repaso de las que fallaste' : ''}
    </p>
  );

  const actual = preguntas[indice];
  if (!actual) {
    const falladas = preguntas.filter((p) => esFallada(p.respuesta?.puntos ?? null));
    const aMedias = preguntas.filter((p) => (p.respuesta?.puntos ?? 0) > 0 && (p.respuesta?.puntos ?? 100) < 100).length;
    const final = resultado ?? { aciertos: preguntas.filter((p) => p.respuesta?.puntos === 100).length, total: preguntas.length, puntaje: 0, sugerencias: [] };
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        {encabezado}
        <Tarjeta>
          <h2 className="text-lg font-semibold text-texto">{intento.repaso ? 'Resultado del repaso' : 'Resultado'}</h2>
          <p className="mt-2 text-3xl font-semibold text-texto tabular-nums">
            {formatearPuntaje(final.puntaje)} <span className="text-base font-normal text-texto-suave">de 5</span>
          </p>
          <p className="text-sm text-texto-suave">
            {final.aciertos} de {final.total} bien
            {aMedias > 0 ? ` · ${aMedias} a medias` : ''}
          </p>
        </Tarjeta>
        {falladas.length > 0 && (
          <Tarjeta>
            <h2 className="mb-2 text-base font-semibold text-texto">Las que fallaste</h2>
            <ol className="flex flex-col divide-y divide-borde">
              {falladas.map((p) => (
                <li key={p.id} className="flex flex-col gap-1 py-3">
                  <span className="font-medium break-words text-texto">
                    <Enunciado texto={p.enunciado} />
                  </span>
                  {(p.respuesta?.puntos ?? 0) > 0 && <MarcaPuntos puntos={p.respuesta?.puntos ?? 0} />}
                  <span className="text-sm break-words text-texto">{textoSolucion(p)}</span>
                  <span className="text-sm text-texto-suave">{p.respuesta?.explicacion}</span>
                  <span className="text-xs text-texto-suave">{p.respuesta?.fuente}</span>
                </li>
              ))}
            </ol>
          </Tarjeta>
        )}
        <SugerenciasRepaso intentoId={intento.id} sugerencias={final.sugerencias} categoriaInicial={datos.documento.categoria} categorias={categorias} />
        {error && <Aviso tipo="error">{error}</Aviso>}
        <div className="flex flex-wrap gap-2">
          {falladas.length > 0 && (
            <Boton onClick={() => void empezar(intento.id)} disabled={ocupado}>
              Repetir solo las que fallé
            </Boton>
          )}
          <Boton variante={falladas.length > 0 ? 'secundario' : 'primario'} onClick={() => void empezar()} disabled={ocupado}>
            Hacer de nuevo
          </Boton>
        </div>
      </div>
    );
  }

  const ultima = indice === preguntas.length - 1;
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {aviso && <Aviso tipo="advertencia">{aviso}</Aviso>}
      {encabezado}
      <Tarjeta>
        <p className="text-sm font-medium text-texto-suave">
          Pregunta {indice + 1} de {preguntas.length}
          {datos.tipo === 'mixto' ? ` · ${NOMBRE_TIPO[actual.tipo]}` : ''}
        </p>
        <h2 className="mt-1 text-lg font-semibold break-words text-texto">
          <Enunciado texto={actual.enunciado} />
        </h2>
        <PreguntaEnPantalla
          key={actual.id}
          pregunta={actual}
          ocupado={ocupado}
          alResponder={(c) => void responder(actual, c)}
          alCalificar={(c) => void calificar(actual, c)}
        />
      </Tarjeta>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {completa(actual) && (
        <div>
          <Boton onClick={() => setIndice((i) => i + 1)}>{ultima ? 'Ver resultado' : 'Siguiente pregunta'}</Boton>
        </div>
      )}
    </div>
  );
}
