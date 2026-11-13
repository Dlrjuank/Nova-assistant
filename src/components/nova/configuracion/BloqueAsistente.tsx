'use client';

import { useRef, useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Dialogo } from '@/components/ui/Dialogo';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { CONFIRMAR_BORRAR_HISTORIAL, HISTORIAL_BORRADO } from '@/lib/reglas/preferencias';
import { pedirNova } from './guardar';

/** E11 (5.8, RB-25, riesgo de privacidad de la sección 13): aviso de Gemini y borrar todo el historial. */
export function BloqueAsistente() {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState(false);
  const origen = useRef<HTMLButtonElement | null>(null);

  async function borrar() {
    setError('');
    setCargando(true);
    const r = await pedirNova<{ borradas: number }>('/api/nova/conversaciones', 'DELETE');
    setCargando(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    setAbierto(false);
    setHecho(true);
  }

  return (
    <Tarjeta className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-texto">Asistente</h2>
      <div className="flex flex-col gap-2 text-sm text-texto">
        <p>
          Para responder, Nova envía a Gemini, de Google, tus preguntas, los fragmentos de tus documentos que sirven para
          responderlas, tus tareas y las fuentes web que guardaste.
        </p>
        <p>
          Con el plan gratuito, Google puede usar ese contenido para mejorar sus productos, y algunas personas pueden
          leerlo. No escribas ni subas información sensible, confidencial o personal.
        </p>
      </div>
      <div className="flex flex-col gap-2 border-t border-borde pt-4">
        <h3 className="text-sm font-semibold text-texto">Historial</h3>
        <p className="text-sm text-texto-suave">Borra todas tus conversaciones con el asistente.</p>
        {hecho && <Aviso tipo="exito">{HISTORIAL_BORRADO}</Aviso>}
        <div>
          <Boton
            variante="peligro"
            onClick={(e) => {
              origen.current = e.currentTarget;
              setError('');
              setHecho(false);
              setAbierto(true);
            }}
          >
            Borrar historial
          </Boton>
        </div>
      </div>
      <Dialogo abierto={abierto} titulo="¿Borrar el historial?" descripcion={CONFIRMAR_BORRAR_HISTORIAL} alCerrar={() => setAbierto(false)} origen={origen}>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <div className="flex flex-wrap gap-2">
          <Boton variante="peligro" cargando={cargando} disabled={cargando} onClick={() => void borrar()}>
            Borrar historial
          </Boton>
          <Boton variante="secundario" disabled={cargando} onClick={() => setAbierto(false)}>
            Cancelar
          </Boton>
        </div>
      </Dialogo>
    </Tarjeta>
  );
}
