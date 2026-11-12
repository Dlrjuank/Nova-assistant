'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Tarjeta } from '@/components/ui/Tarjeta';
import type { CuestionarioVista, PreguntaVista, ResultadoRespuesta, SugerenciaRepaso } from '@/lib/dataService';
import { formatearPuntaje } from '@/lib/reglas/cuestionarios';
import { MENSAJES } from '@/lib/reglas/errores';
import { SugerenciasRepaso } from './SugerenciasRepaso';

type Resultado = { aciertos: number; total: number; puntaje: number; sugerencias: SugerenciaRepaso[] };

const LETRAS = ['A', 'B', 'C', 'D'];

/** Ícono y texto, no solo color (5.11). */
function Marca({ acierto, texto }: { acierto: boolean; texto: string }) {
  const Icono = acierto ? CheckCircle2 : XCircle;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 text-sm font-semibold ${acierto ? 'text-exito' : 'text-peligro'}`}>
      <Icono aria-hidden="true" className="size-4" />
      {texto}
    </span>
  );
}

function Opcion({ letra, texto, estado, deshabilitada, alElegir }: { letra: string; texto: string; estado: 'normal' | 'correcta' | 'elegida-mal'; deshabilitada: boolean; alElegir: () => void }) {
  const borde = estado === 'correcta' ? 'border-exito' : estado === 'elegida-mal' ? 'border-peligro' : 'border-borde';
  return (
    <li>
      <button
        type="button"
        onClick={alElegir}
        disabled={deshabilitada}
        className={`flex min-h-14 w-full items-center gap-3 rounded-xl border-2 ${borde} bg-superficie px-4 py-3 text-left text-base text-texto enabled:hover:border-acento focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento disabled:cursor-default`}
      >
        <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-superficie-2 text-sm font-semibold">
          {letra}
        </span>
        <span className="min-w-0 flex-1 break-words">{texto}</span>
        {estado === 'correcta' && <Marca acierto texto="Correcta" />}
        {estado === 'elegida-mal' && <Marca acierto={false} texto="Tu respuesta" />}
      </button>
    </li>
  );
}

/** E10e (5.11): una pregunta por pantalla; cada respuesta se guarda al momento y no se cambia (RB-51). */
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
  const primeraSinResponder = preguntas.findIndex((p) => !p.respuesta);
  const [indice, setIndice] = useState(primeraSinResponder === -1 ? preguntas.length : primeraSinResponder);
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

  async function responder(pregunta: PreguntaVista, elegida: number) {
    if (ocupado || pregunta.respuesta) return;
    const r = await pedir<ResultadoRespuesta>(`/api/nova/intentos/${intento.id}/respuestas`, { preguntaId: pregunta.id, elegida });
    if (!r) return;
    const { resultado: final, ...respuesta } = r;
    setPreguntas((previas) => previas.map((p) => (p.id === pregunta.id ? { ...p, respuesta } : p)));
    if (final) setResultado(final);
  }

  async function empezar(repasoDe?: string) {
    const nuevo = await pedir<{ id: string }>(`/api/nova/cuestionarios/${datos.id}/intentos`, repasoDe ? { repasoDe } : {});
    if (nuevo) router.refresh(); // la página trae el intento nuevo
  }

  const encabezado = (
    <p className="text-sm text-texto-suave">
      {datos.alcance} · Dificultad {({ facil: 'fácil', media: 'media', dificil: 'difícil' } as const)[datos.dificultad]}
      {intento.repaso ? ' · Repaso de las que fallaste' : ''}
    </p>
  );

  const actual = preguntas[indice];
  if (!actual) {
    const falladas = preguntas.filter((p) => p.respuesta && !p.respuesta.acierto);
    const final = resultado ?? { aciertos: preguntas.filter((p) => p.respuesta?.acierto).length, total: preguntas.length, puntaje: 0, sugerencias: [] };
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        {encabezado}
        <Tarjeta>
          <h2 className="text-lg font-semibold text-texto">{intento.repaso ? 'Resultado del repaso' : 'Resultado'}</h2>
          <p className="mt-2 text-3xl font-semibold text-texto tabular-nums">
            {formatearPuntaje(final.puntaje)} <span className="text-base font-normal text-texto-suave">de 5</span>
          </p>
          <p className="text-sm text-texto-suave">
            {final.aciertos} de {final.total} {final.total === 1 ? 'acierto' : 'aciertos'}
          </p>
        </Tarjeta>
        {falladas.length > 0 && (
          <Tarjeta>
            <h2 className="mb-2 text-base font-semibold text-texto">Las que fallaste</h2>
            <ol className="flex flex-col divide-y divide-borde">
              {falladas.map((p) => (
                <li key={p.id} className="flex flex-col gap-1 py-3">
                  <span className="font-medium text-texto">{p.enunciado}</span>
                  <span className="text-sm text-texto">Respuesta correcta: {p.opciones[p.respuesta?.correcta ?? 0]}</span>
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

  const respuesta = actual.respuesta;
  const ultima = indice === preguntas.length - 1;
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {aviso && <Aviso tipo="advertencia">{aviso}</Aviso>}
      {encabezado}
      <Tarjeta>
        <p className="text-sm font-medium text-texto-suave">
          Pregunta {indice + 1} de {preguntas.length}
        </p>
        <h2 className="mt-1 text-lg font-semibold break-words text-texto">{actual.enunciado}</h2>
        <ul aria-label="Opciones" className="mt-4 flex flex-col gap-2">
          {actual.opciones.map((texto, i) => (
            <Opcion
              key={i}
              letra={LETRAS[i] as string}
              texto={texto}
              estado={respuesta ? (i === respuesta.correcta ? 'correcta' : i === respuesta.elegida ? 'elegida-mal' : 'normal') : 'normal'}
              deshabilitada={Boolean(respuesta) || ocupado}
              alElegir={() => void responder(actual, i)}
            />
          ))}
        </ul>
        {respuesta && (
          <div role="status" className="mt-4 flex flex-col gap-2 rounded-xl bg-superficie-2 p-4">
            <Marca acierto={respuesta.acierto} texto={respuesta.acierto ? '¡Acertaste!' : 'No acertaste'} />
            <p className="text-sm text-texto">{respuesta.explicacion}</p>
            <blockquote className="border-l-2 border-borde pl-3 text-sm text-texto-suave italic">«{respuesta.cita}»</blockquote>
            <p className="text-xs text-texto-suave">{respuesta.fuente}</p>
          </div>
        )}
      </Tarjeta>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {respuesta && (
        <div>
          <Boton onClick={() => setIndice((i) => i + 1)}>{ultima ? 'Ver resultado' : 'Siguiente pregunta'}</Boton>
        </div>
      )}
    </div>
  );
}
