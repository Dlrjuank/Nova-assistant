'use client';

import { ArrowDown } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { MensajeChat, type AutorMensaje } from '@/components/nova/MensajeChat';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { CLASE_CONTROL } from '@/components/ui/Campo';
import { Selector } from '@/components/ui/Selector';
import type { Fuente, MensajeGuardado, RespuestaConHistorial } from '@/lib/dataService';
import { esConsultaValida as esValida, normalizarConsulta } from '@/lib/reglas/consulta';
import { MENSAJES } from '@/lib/reglas/errores';
import { CONSULTA_MAX_CARACTERES } from '@/lib/config/nova';
import type { ModoExplicar } from '@/lib/reglas/preguntasLibro';
import { useSeguirConversacion } from './seguirConversacion';

interface Mensaje {
  id: number;
  autor: AutorMensaje;
  texto: string;
  fuentes?: Fuente[];
  /** RB-41: id en la base, solo si la respuesta se puede explicar de otra manera. */
  explicableId?: number;
}

interface ErrorChat {
  codigo: string;
  mensaje: string;
  cuerpo: Record<string, unknown>;
}

// Reintentar no sirve para estos: repetir la misma pregunta daría el mismo error.
const SIN_REINTENTO = ['CONSULTA_MUY_CORTA', 'CONVERSACION_NO_ENCONTRADA'];

/**
 * RN-20: la conversación se guarda en la base por usuario y la página entrega la más reciente al cargar.
 * RN-21: el servidor le pasa al modelo los últimos mensajes, así que se puede preguntar "¿y el segundo?".
 */
export function Chat({
  conversacionId: idInicial = null,
  historial = [],
  preguntaInicial,
  documentos = [],
}: {
  conversacionId?: string | null;
  historial?: MensajeGuardado[];
  /** E03: pregunta escrita en "Pregúntale a Nova" (Inicio); se envía al cargar, una sola vez. */
  preguntaInicial?: string;
  /** E10c: los documentos listos, para el selector "Buscar en". */
  documentos?: ReadonlyArray<{ id: string; nombre: string }>;
}) {
  const [mensajes, setMensajes] = useState<Mensaje[]>(() =>
    historial.map((m, i) => ({ id: i, autor: m.autor, texto: m.texto, fuentes: m.fuentes, ...(m.explicable ? { explicableId: Number(m.id) } : {}) })),
  );
  const [buscarEn, setBuscarEn] = useState('');
  const [conversacionId, setConversacionId] = useState(idInicial);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<ErrorChat | null>(null);
  const [sinGuardar, setSinGuardar] = useState(false);
  const [creando, setCreando] = useState(false);
  const [errorNueva, setErrorNueva] = useState('');
  const siguienteId = useRef(historial.length);

  // La vista sigue a la conversación (ver seguirConversacion.ts): al enviar baja siempre; al llegar la
  // respuesta, solo si el usuario no subió a leer algo anterior (si subió, aparece "Ir al final").
  const formulario = useRef<HTMLFormElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const ultimoMensaje = useCallback(() => (lista.current?.lastElementChild as HTMLElement | null) ?? null, []);
  const { lejos, bajar, llegoAlgo } = useSeguirConversacion(formulario, ultimoMensaje);
  const pendiente = useRef<'enviada' | 'llegada' | null>(null);

  useEffect(() => {
    const accion = pendiente.current;
    if (!accion) return;
    pendiente.current = null;
    // Después de pintar, para medir con el mensaje nuevo ya en la página.
    const cuadro = requestAnimationFrame(() => (accion === 'enviada' ? bajar(true) : llegoAlgo()));
    return () => cancelAnimationFrame(cuadro);
  }, [mensajes, pensando, error, sinGuardar, bajar, llegoAlgo]);

  // Al abrir el Asistente con una conversación guardada, se ve lo último (sin animación).
  useEffect(() => {
    if (historial.length === 0) return;
    const cuadro = requestAnimationFrame(() => bajar(false));
    return () => cancelAnimationFrame(cuadro);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, []);

  // Una sola vez aunque React monte el efecto dos veces en desarrollo. Después se quita ?pregunta= de la URL
  // para que recargar la página no la vuelva a enviar. Si no fuera válida, queda en el campo para corregirla.
  const inicialEnviada = useRef(false);
  useEffect(() => {
    if (!preguntaInicial || inicialEnviada.current) return;
    inicialEnviada.current = true;
    window.history.replaceState(null, '', window.location.pathname);
    if (esValida(preguntaInicial)) {
      const pregunta = normalizarConsulta(preguntaInicial);
      agregar('usuario', pregunta);
      void preguntar(pregunta);
    } else {
      setTexto(preguntaInicial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, [preguntaInicial]);

  const agregar = (autor: AutorMensaje, contenido: string, fuentes?: Fuente[], explicableId?: number) => {
    pendiente.current = autor === 'usuario' ? 'enviada' : 'llegada';
    const id = siguienteId.current++;
    setMensajes((previos) => [...previos, { id, autor, texto: contenido, ...(fuentes ? { fuentes } : {}), ...(explicableId ? { explicableId } : {}) }]);
  };

  function preguntar(pregunta: string) {
    return consultar({ pregunta, ...(buscarEn ? { documentoId: buscarEn } : {}) });
  }

  /** RB-41: vuelve a explicar una respuesta con sus mismos fragmentos. */
  function explicar(mensajeId: number, modo: ModoExplicar, texto: string) {
    if (pensando) return;
    agregar('usuario', `Explícalo: ${texto}`);
    void consultar({ explicar: { mensajeId, modo } });
  }

  async function consultar(cuerpoConsulta: Record<string, unknown>) {
    setError(null);
    setSinGuardar(false);
    setPensando(true);
    try {
      const respuesta = await fetch('/api/nova/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversacionId ? { ...cuerpoConsulta, conversacionId } : cuerpoConsulta),
      });
      // Si Vercel corta la función por tiempo, la respuesta no es JSON.
      const cuerpo = (await respuesta.json().catch(() => null)) as {
        ok?: boolean;
        datos?: RespuestaConHistorial;
        error?: { codigo?: string; mensaje?: string };
      } | null;
      if (!respuesta.ok || !cuerpo?.ok || !cuerpo.datos) {
        pendiente.current = 'llegada';
        setError({
          codigo: cuerpo?.error?.codigo ?? 'ERROR_LLM',
          mensaje: cuerpo?.error?.mensaje ?? MENSAJES.ERROR_LLM,
          cuerpo: cuerpoConsulta,
        });
        return;
      }
      agregar('asistente', cuerpo.datos.respuesta, cuerpo.datos.fuentes, cuerpo.datos.explicable ? cuerpo.datos.mensajeId : undefined);
      setConversacionId(cuerpo.datos.conversacionId);
      setSinGuardar(cuerpo.datos.guardada === false);
    } catch {
      pendiente.current = 'llegada';
      setError({ codigo: 'SIN_CONEXION', mensaje: 'No se pudo conectar con el servidor.', cuerpo: cuerpoConsulta });
    } finally {
      setPensando(false);
    }
  }

  /** La conversación anterior queda guardada en la base; solo deja de mostrarse. */
  async function empezarNueva() {
    setErrorNueva('');
    setCreando(true);
    try {
      const respuesta = await fetch('/api/nova/conversaciones', { method: 'POST' });
      const cuerpo = (await respuesta.json().catch(() => null)) as {
        ok?: boolean;
        datos?: { id: string };
        error?: { mensaje?: string };
      } | null;
      if (!respuesta.ok || !cuerpo?.ok || !cuerpo.datos) {
        setErrorNueva(cuerpo?.error?.mensaje ?? MENSAJES.ERROR_INTERNO);
        return;
      }
      setConversacionId(cuerpo.datos.id);
      setMensajes([]);
      setError(null);
      setSinGuardar(false);
    } catch {
      setErrorNueva('No se pudo conectar con el servidor. Intente de nuevo.');
    } finally {
      setCreando(false);
    }
  }

  function enviar(evento?: FormEvent) {
    evento?.preventDefault();
    if (pensando || !esValida(texto)) return;
    const pregunta = normalizarConsulta(texto);
    agregar('usuario', pregunta);
    setTexto('');
    void preguntar(pregunta);
  }

  function alPresionarTecla(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      enviar();
    }
  }

  const demasiadoCorta = texto.trim() !== '' && !esValida(texto);

  return (
    <div className="flex flex-col gap-4">
      {mensajes.length > 0 && (
        <div className="flex flex-col items-end gap-2">
          <Boton
            variante="secundario"
            cargando={creando}
            onClick={() => void empezarNueva()}
            disabled={pensando}
            className="min-h-9 py-1.5"
          >
            Conversación nueva
          </Boton>
          {errorNueva && (
            <p role="alert" className="text-xs font-medium text-peligro">
              {errorNueva}
            </p>
          )}
        </div>
      )}

      {mensajes.length === 0 && !pensando && !error && (
        <p className="rounded-xl border border-dashed border-borde bg-superficie px-4 py-8 text-center text-sm text-texto-suave">
          Pregúntale algo a tus documentos o a tus tareas, por ejemplo: «¿Qué tareas tengo pendientes?»
        </p>
      )}

      <ul ref={lista} role="log" aria-label="Conversación con el asistente" className="flex flex-col gap-4">
        {mensajes.map((m) => (
          <MensajeChat
            key={m.id}
            autor={m.autor}
            texto={m.texto}
            {...(m.fuentes ? { fuentes: m.fuentes } : {})}
            {...(m.explicableId ? { alExplicar: (modo: ModoExplicar, nombre: string) => explicar(m.explicableId as number, modo, nombre) } : {})}
            ocupado={pensando}
          />
        ))}
      </ul>

      {pensando && (
        <p role="status" className="px-1 text-sm text-texto-suave">
          Pensando…
        </p>
      )}

      {error?.codigo === 'SIN_DOCUMENTOS' && (
        <Aviso tipo="advertencia">
          {error.mensaje}{' '}
          <Link href="/nova/fuentes?pestana=pdf" className="font-semibold text-acento underline">
            Indexar un PDF
          </Link>
        </Aviso>
      )}
      {error && error.codigo !== 'SIN_DOCUMENTOS' && (
        <div className="flex flex-col items-start gap-2">
          <Aviso tipo="error">{error.mensaje}</Aviso>
          {!SIN_REINTENTO.includes(error.codigo) && (
            <Boton variante="secundario" onClick={() => void consultar(error.cuerpo)} disabled={pensando}>
              Reintentar
            </Boton>
          )}
        </div>
      )}

      {sinGuardar && (
        <Aviso tipo="advertencia">Esta respuesta no se pudo guardar en el historial: no estará al volver.</Aviso>
      )}

      {lejos && mensajes.length > 0 && (
        <button
          type="button"
          onClick={() => bajar(true)}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-acento px-4 py-2 text-sm font-semibold text-acento-texto shadow-suave focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento lg:bottom-8 lg:left-[calc(50%+8rem)]"
        >
          <ArrowDown aria-hidden="true" className="size-4" />
          Ir al final
        </button>
      )}

      <form ref={formulario} onSubmit={enviar} className="flex scroll-mb-24 flex-col gap-2">
        {documentos.length > 0 && (
          <Selector
            id="buscar-en"
            etiqueta="Buscar en"
            value={buscarEn}
            onChange={(e) => setBuscarEn(e.target.value)}
            opciones={[{ valor: '', texto: 'Todos los documentos' }, ...documentos.map((d) => ({ valor: d.id, texto: d.nombre }))]}
          />
        )}
        <label htmlFor="pregunta" className="text-sm font-medium text-texto">
          Tu pregunta
        </label>
        <textarea
          id="pregunta"
          rows={2}
          value={texto}
          maxLength={CONSULTA_MAX_CARACTERES}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={alPresionarTecla}
          aria-invalid={demasiadoCorta || undefined}
          aria-describedby={demasiadoCorta ? 'pregunta-error' : undefined}
          className={`${CLASE_CONTROL} resize-y ${demasiadoCorta ? 'border-peligro' : 'border-borde'}`}
        />
        {demasiadoCorta && (
          <p id="pregunta-error" className="text-xs font-medium text-peligro">
            {MENSAJES.CONSULTA_MUY_CORTA}
          </p>
        )}
        <div>
          <Boton type="submit" cargando={pensando} disabled={!esValida(texto)}>
            Preguntar
          </Boton>
        </div>
      </form>
    </div>
  );
}
