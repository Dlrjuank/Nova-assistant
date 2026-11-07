'use client';

import { MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Boton } from '@/components/ui/Boton';
import { CLASE_CONTROL } from '@/components/ui/Campo';
import { CONSULTA_MAX_CARACTERES } from '@/lib/config/nova';
import { AVISO_PROVEEDOR_CORTO, esConsultaValida, normalizarConsulta } from '@/lib/reglas/consulta';
import { MENSAJES } from '@/lib/reglas/errores';

/**
 * Inicio (PLAN_AMPLIACION 5.1): bloque destacado para preguntarle al asistente. Valida RN-02 en vivo, como
 * el chat, y lleva al Asistente con la pregunta, que allí se envía sola (no solo queda escrita).
 */
export function PreguntaleANova() {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valida = esConsultaValida(texto);
  const demasiadoCorta = texto.trim() !== '' && !valida;

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!valida || enviando) return;
    setEnviando(true);
    router.push(`/nova/asistente?pregunta=${encodeURIComponent(normalizarConsulta(texto))}`);
  }

  return (
    <section
      aria-labelledby="titulo-preguntale"
      className="flex flex-col gap-3 rounded-2xl border border-acento/30 bg-acento-suave p-4 shadow-suave sm:p-6"
    >
      <h2 id="titulo-preguntale" className="flex items-center gap-2 text-lg font-semibold text-texto">
        <MessageCircle aria-hidden="true" className="size-5 text-acento" />
        Pregúntale a Nova
      </h2>
      <form onSubmit={enviar} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="pregunta-inicio" className="sr-only">
            Tu pregunta para Nova
          </label>
          <input
            id="pregunta-inicio"
            type="text"
            value={texto}
            maxLength={CONSULTA_MAX_CARACTERES}
            placeholder="Por ejemplo: ¿Qué tengo para hacer esta semana?"
            onChange={(e) => setTexto(e.target.value)}
            aria-invalid={demasiadoCorta || undefined}
            aria-describedby={demasiadoCorta ? 'pregunta-inicio-error' : undefined}
            className={`${CLASE_CONTROL} ${demasiadoCorta ? 'border-peligro' : 'border-borde'}`}
          />
          {demasiadoCorta && (
            <p id="pregunta-inicio-error" className="text-xs font-medium text-peligro">
              {MENSAJES.CONSULTA_MUY_CORTA}
            </p>
          )}
        </div>
        <Boton type="submit" disabled={!valida} cargando={enviando}>
          Preguntar
        </Boton>
      </form>
      <p className="text-xs text-texto-suave">{AVISO_PROVEEDOR_CORTO}</p>
    </section>
  );
}
