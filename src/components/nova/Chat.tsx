'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { MensajeChat, type AutorMensaje } from '@/components/nova/MensajeChat';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { CLASE_CONTROL } from '@/components/ui/Campo';
import type { Fuente, RespuestaAsistente } from '@/lib/dataService';
import { contarPalabrasYCaracteres, normalizarConsulta } from '@/lib/reglas/consulta';
import { MENSAJES } from '@/lib/reglas/errores';
import { CONSULTA_MAX_CARACTERES, CONSULTA_MIN_CARACTERES, CONSULTA_MIN_PALABRAS } from '@/lib/config/nova';

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

function esValida(texto: string): boolean {
  const { palabras, caracteres } = contarPalabrasYCaracteres(texto);
  return palabras >= CONSULTA_MIN_PALABRAS && caracteres >= CONSULTA_MIN_CARACTERES;
}

/** La conversación vive en memoria: se pierde al recargar (plan, P08). */
export function Chat() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<ErrorChat | null>(null);
  const siguienteId = useRef(0);
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
    setPensando(true);
    try {
      const respuesta = await fetch('/api/nova/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta }),
      });
      // Si Vercel corta la función por tiempo, la respuesta no es JSON.
      const cuerpo = (await respuesta.json().catch(() => null)) as {
        ok?: boolean;
        datos?: RespuestaAsistente;
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
    } catch {
      setError({ codigo: 'SIN_CONEXION', mensaje: 'No se pudo conectar con el servidor.', pregunta });
    } finally {
      setPensando(false);
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
          {error.codigo !== 'CONSULTA_MUY_CORTA' && (
            <Boton variante="secundario" onClick={() => void preguntar(error.pregunta)} disabled={pensando}>
              Reintentar
            </Boton>
          )}
        </div>
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
