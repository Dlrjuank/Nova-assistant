'use client';

import { ArrowDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { MensajeChat, type AutorMensaje } from '@/components/nova/MensajeChat';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { CLASE_CONTROL } from '@/components/ui/Campo';
import { Selector } from '@/components/ui/Selector';
import type { Fuente, MensajeGuardado, RespuestaConHistorial } from '@/lib/dataService';
import { AVISO_BUSQUEDA_CORTA, esConsultaValida as esValida, normalizarConsulta } from '@/lib/reglas/consulta';
import { MENSAJES } from '@/lib/reglas/errores';
import { CONSULTA_MAX_CARACTERES } from '@/lib/config/nova';
import { BUSCAR_EN_IA, BUSCAR_EN_WEB, BUSCAR_EN_WIKIPEDIA, type OrigenMensaje } from '@/lib/reglas/fuentesWeb';
import { ofrecePreguntarIa } from '@/lib/reglas/iaGeneral';
import type { ModoExplicar } from '@/lib/reglas/preguntasLibro';
import { useSeguirConversacion } from './seguirConversacion';

interface Mensaje {
  id: number;
  autor: AutorMensaje;
  texto: string;
  fuentes?: Fuente[];
  /** RB-41: id en la base, solo si la respuesta se puede explicar de otra manera. */
  explicableId?: number;
  /** E10c2 (M21): sin origen, documentos y tareas. */
  origen?: OrigenMensaje | null;
}

interface ErrorChat {
  codigo: string;
  mensaje: string;
  cuerpo: Record<string, unknown>;
  /** RN-20: la pregunta sin respuesta no se guarda; se muestra aquí, no en la conversación. */
  pregunta: string;
}

// Reintentar no sirve para estos: repetir la misma pregunta daría el mismo error.
const SIN_REINTENTO = ['CONSULTA_MUY_CORTA', 'CONVERSACION_NO_ENCONTRADA'];
const CLAVE_BUSCAR_EN = 'nova-buscar-en';
const ESPERA_AVISO_DEMORA_MS = 10_000;
export const AVISO_DEMORA = 'Los textos largos, como un capítulo, pueden tardar hasta un par de minutos. Espera un poco más.';

// El almacenamiento puede estar bloqueado: entonces "Buscar en" simplemente no se recuerda.
function leerBuscarEn(): string {
  try {
    return sessionStorage.getItem(CLAVE_BUSCAR_EN) ?? '';
  } catch {
    return '';
  }
}

function recordarBuscarEn(valor: string): void {
  try {
    sessionStorage.setItem(CLAVE_BUSCAR_EN, valor);
  } catch {
    // ver leerBuscarEn
  }
}

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
    historial.map((m, i) => ({ id: i, autor: m.autor, texto: m.texto, fuentes: m.fuentes, origen: m.origen ?? null, ...(m.explicable ? { explicableId: Number(m.id) } : {}) })),
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
  const router = useRouter();

  // La vista sigue a la conversación (ver seguirConversacion.ts): al enviar baja siempre; al llegar la
  // respuesta, solo si el usuario no subió a leer algo anterior (si subió, aparece "Ir al final").
  const formulario = useRef<HTMLFormElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const ultimoMensaje = useCallback(() => (lista.current?.lastElementChild as HTMLElement | null) ?? null, []);
  const { lejos, bajar, llegoAlgo } = useSeguirConversacion(formulario, ultimoMensaje);
  const pendiente = useRef<'enviada' | 'llegada' | null>(null);

  // Un capítulo o un texto largo puede tardar hasta 110 s en el servidor: se avisa si la espera se alarga.
  const [demora, setDemora] = useState(false);
  useEffect(() => {
    if (!pensando) return setDemora(false);
    const reloj = setTimeout(() => setDemora(true), ESPERA_AVISO_DEMORA_MS);
    return () => clearTimeout(reloj);
  }, [pensando]);

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

  // "Buscar en" se conserva al cambiar de pestaña. Lo que llega de "Pregúntale a Nova" va a todos los documentos.
  useEffect(() => {
    if (preguntaInicial) return recordarBuscarEn('');
    const guardado = leerBuscarEn();
    if ([BUSCAR_EN_WEB, BUSCAR_EN_WIKIPEDIA, BUSCAR_EN_IA, ...documentos.map((d) => d.id)].includes(guardado)) setBuscarEn(guardado);
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
      void preguntar(normalizarConsulta(preguntaInicial));
    } else {
      setTexto(preguntaInicial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, [preguntaInicial]);

  const agregar = (autor: AutorMensaje, contenido: string, fuentes?: Fuente[], explicableId?: number, origen?: OrigenMensaje) => {
    pendiente.current = autor === 'usuario' ? 'enviada' : 'llegada';
    const id = siguienteId.current++;
    setMensajes((previos) => [...previos, { id, autor, texto: contenido, ...(fuentes ? { fuentes } : {}), ...(explicableId ? { explicableId } : {}), ...(origen ? { origen } : {}) }]);
  };

  function preguntar(pregunta: string) {
    return consultar({ pregunta, ...(buscarEn ? { documentoId: buscarEn } : {}) }, pregunta);
  }

  /** RB-60: la misma pregunta, ahora a la IA general; la respuesta anterior queda intacta. */
  function preguntarIa(pregunta: string) {
    if (pensando) return;
    void consultar({ pregunta, documentoId: BUSCAR_EN_IA }, pregunta);
  }

  /** RB-60: la pregunta que recibió el "No encontré", si aún no se le preguntó a la IA justo después. */
  function preguntaParaIa(i: number): string | null {
    const m = mensajes[i];
    const anterior = mensajes[i - 1];
    if (!m || !ofrecePreguntarIa(m) || anterior?.autor !== 'usuario' || anterior.texto.startsWith('Explícalo: ')) return null;
    return mensajes[i + 1]?.texto === anterior.texto ? null : anterior.texto;
  }

  /** RB-41: vuelve a explicar una respuesta con sus mismos fragmentos. */
  function explicar(mensajeId: number, modo: ModoExplicar, texto: string) {
    if (pensando) return;
    void consultar({ explicar: { mensajeId, modo } }, `Explícalo: ${texto}`);
  }

  /** RN-20: una pregunta sin respuesta no se guarda, así que tampoco se queda en la conversación que se ve. */
  function fallo(codigo: string, mensaje: string, cuerpo: Record<string, unknown>, pregunta: string) {
    pendiente.current = 'llegada';
    setMensajes((previos) => (previos.at(-1)?.autor === 'usuario' ? previos.slice(0, -1) : previos));
    setError({ codigo, mensaje, cuerpo, pregunta });
  }

  async function consultar(cuerpoConsulta: Record<string, unknown>, pregunta: string) {
    agregar('usuario', pregunta);
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
        fallo(cuerpo?.error?.codigo ?? 'ERROR_LLM', cuerpo?.error?.mensaje ?? MENSAJES.ERROR_LLM, cuerpoConsulta, pregunta);
        return;
      }
      agregar('asistente', cuerpo.datos.respuesta, cuerpo.datos.fuentes, cuerpo.datos.explicable ? cuerpo.datos.mensajeId : undefined, cuerpo.datos.origen);
      setConversacionId(cuerpo.datos.conversacionId);
      setSinGuardar(cuerpo.datos.guardada === false);
      router.refresh(); // el botón Atrás restaura la copia que tenga Next: debe incluir este turno
    } catch {
      fallo('SIN_CONEXION', 'No se pudo conectar con el servidor.', cuerpoConsulta, pregunta);
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
      router.refresh();
    } catch {
      setErrorNueva('No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      setCreando(false);
    }
  }

  function enviar(evento?: FormEvent) {
    evento?.preventDefault();
    if (pensando || !esValida(texto)) return;
    setTexto('');
    void preguntar(normalizarConsulta(texto));
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
        {mensajes.map((m, i) => {
          const paraIa = preguntaParaIa(i);
          return (
            <MensajeChat
              key={m.id}
              autor={m.autor}
              texto={m.texto}
              {...(m.fuentes ? { fuentes: m.fuentes } : {})}
              {...(m.explicableId ? { alExplicar: (modo: ModoExplicar, nombre: string) => explicar(m.explicableId as number, modo, nombre) } : {})}
              ocupado={pensando}
              guardable={m.autor === 'asistente' && m.origen === BUSCAR_EN_WIKIPEDIA}
              deIa={m.autor === 'asistente' && m.origen === BUSCAR_EN_IA}
              {...(paraIa ? { alPreguntarIa: () => preguntarIa(paraIa) } : {})}
            />
          );
        })}
      </ul>

      {pensando && (
        <p role="status" className="px-1 text-sm text-texto-suave">
          Pensando…{demora && <span className="block">{AVISO_DEMORA}</span>}
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
          <p className="px-1 text-sm text-texto-suave">Quedó sin respuesta y no se guardó: «{error.pregunta}»</p>
          {!SIN_REINTENTO.includes(error.codigo) && (
            <Boton variante="secundario" onClick={() => void consultar(error.cuerpo, error.pregunta)} disabled={pensando}>
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
          className="fixed bottom-[calc(5.5rem+var(--nova-seguro-abajo))] left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-acento px-4 py-2 text-sm font-semibold text-acento-texto shadow-suave focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento lg:bottom-8 lg:left-[calc(50%+8rem)]"
        >
          <ArrowDown aria-hidden="true" className="size-4" />
          Ir al final
        </button>
      )}

      <form ref={formulario} onSubmit={enviar} className="flex scroll-mb-24 flex-col gap-2">
        <Selector
          id="buscar-en"
          etiqueta="Buscar en"
          value={buscarEn}
          onChange={(e) => {
            setBuscarEn(e.target.value);
            recordarBuscarEn(e.target.value);
          }}
          opciones={[
            { valor: '', texto: 'Todos los documentos' },
            ...documentos.map((d) => ({ valor: d.id, texto: d.nombre })),
            { valor: BUSCAR_EN_WEB, texto: 'Fuentes web' },
            { valor: BUSCAR_EN_WIKIPEDIA, texto: 'Wikipedia' },
            { valor: BUSCAR_EN_IA, texto: 'IA (conocimiento general)' },
          ]}
        />
        {buscarEn === BUSCAR_EN_IA && (
          <p className="text-xs text-texto-suave">Responde la IA con su conocimiento general, sin tus documentos, tareas ni fuentes. Puede equivocarse.</p>
        )}
        {buscarEn === BUSCAR_EN_WIKIPEDIA && (
          <p className="text-xs text-texto-suave">Busca en Wikipedia en español. La consulta se envía a Wikipedia y, con los extractos, al proveedor del asistente.</p>
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
            {buscarEn === BUSCAR_EN_WIKIPEDIA ? AVISO_BUSQUEDA_CORTA : MENSAJES.CONSULTA_MUY_CORTA}
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
