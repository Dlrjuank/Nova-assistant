'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { MensajeChat, type AutorMensaje } from '@/components/nova/MensajeChat';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { CLASE_CONTROL } from '@/components/ui/Campo';
import type { Fuente, MensajeGuardado, RespuestaConHistorial } from '@/lib/dataService';
import { esConsultaValida as esValida, normalizarConsulta } from '@/lib/reglas/consulta';
import { MENSAJES } from '@/lib/reglas/errores';
import { CONSULTA_MAX_CARACTERES } from '@/lib/config/nova';

interface Mensaje {
  id: number;
  autor: AutorMensaje;
  texto: string;
  fuentes?: Fuente[];
}

interface ErrorChat {
  codigo: string;
  mensaje: string;
  pregunta: string;
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
}: {
  conversacionId?: string | null;
  historial?: MensajeGuardado[];
}) {
  const [mensajes, setMensajes] = useState<Mensaje[]>(() =>
    historial.map((m, i) => ({ id: i, autor: m.autor, texto: m.texto, fuentes: m.fuentes })),
  );
  const [conversacionId, setConversacionId] = useState(idInicial);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<ErrorChat | null>(null);
  const [sinGuardar, setSinGuardar] = useState(false);
  const [creando, setCreando] = useState(false);
  const [errorNueva, setErrorNueva] = useState('');
  const siguienteId = useRef(historial.length);
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fin.current?.scrollIntoView?.({ block: 'nearest' });
  }, [mensajes, pensando, error]);

  const agregar = (autor: AutorMensaje, contenido: string, fuentes?: Fuente[]) => {
    const id = siguienteId.current++;
    setMensajes((previos) => [...previos, { id, autor, texto: contenido, ...(fuentes ? { fuentes } : {}) }]);
  };

  async function preguntar(pregunta: string) {
    setError(null);
    setSinGuardar(false);
    setPensando(true);
    try {
      const respuesta = await fetch('/api/nova/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversacionId ? { pregunta, conversacionId } : { pregunta }),
      });
      // Si Vercel corta la función por tiempo, la respuesta no es JSON.
      const cuerpo = (await respuesta.json().catch(() => null)) as {
        ok?: boolean;
        datos?: RespuestaConHistorial;
        error?: { codigo?: string; mensaje?: string };
      } | null;
      if (!respuesta.ok || !cuerpo?.ok || !cuerpo.datos) {
        setError({
          codigo: cuerpo?.error?.codigo ?? 'ERROR_LLM',
          mensaje: cuerpo?.error?.mensaje ?? MENSAJES.ERROR_LLM,
          pregunta,
        });
        return;
      }
      agregar('asistente', cuerpo.datos.respuesta, cuerpo.datos.fuentes);
      setConversacionId(cuerpo.datos.conversacionId);
      setSinGuardar(cuerpo.datos.guardada === false);
    } catch {
      setError({ codigo: 'SIN_CONEXION', mensaje: 'No se pudo conectar con el servidor.', pregunta });
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
            <p role="alert" className="text-xs font-medium text-prioridad-alta">
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

      <ul role="log" aria-label="Conversación con el asistente" className="flex flex-col gap-4">
        {mensajes.map((m) => (
          <MensajeChat key={m.id} autor={m.autor} texto={m.texto} {...(m.fuentes ? { fuentes: m.fuentes } : {})} />
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
          <Link href="/nova/documentos/nuevo" className="font-semibold text-primario underline">
            Indexar un PDF
          </Link>
        </Aviso>
      )}
      {error && error.codigo !== 'SIN_DOCUMENTOS' && (
        <div className="flex flex-col items-start gap-2">
          <Aviso tipo="error">{error.mensaje}</Aviso>
          {!SIN_REINTENTO.includes(error.codigo) && (
            <Boton variante="secundario" onClick={() => void preguntar(error.pregunta)} disabled={pensando}>
              Reintentar
            </Boton>
          )}
        </div>
      )}

      {sinGuardar && (
        <Aviso tipo="advertencia">Esta respuesta no se pudo guardar en el historial: no estará al volver.</Aviso>
      )}

      <div ref={fin} />

      <form onSubmit={enviar} className="flex flex-col gap-2">
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
          className={`${CLASE_CONTROL} resize-y ${demasiadoCorta ? 'border-prioridad-alta' : 'border-borde'}`}
        />
        {demasiadoCorta && (
          <p id="pregunta-error" className="text-xs font-medium text-prioridad-alta">
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
