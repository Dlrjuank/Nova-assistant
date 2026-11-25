'use client';

import { Eye, EyeOff, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Dialogo } from '@/components/ui/Dialogo';
import {
  CONFIRMAR_DESVINCULAR,
  RUTA_GUIA_CLAVE,
  TEXTO_DESVINCULADA,
  TEXTO_ENLACE_GUIA,
  textoEstadoClave,
  type InfoClave,
} from '@/lib/reglas/claveGemini';
import { fechaEnPalabras } from '@/lib/reglas/fechas';
import { pedirNova } from './guardar';

const CLASE_CAMPO =
  'w-full rounded-xl border border-borde bg-superficie px-3 py-2 pr-11 font-mono text-sm text-texto placeholder:text-texto-suave focus:outline-none focus-visible:ring-2 focus-visible:ring-acento';

/**
 * E20c-1 (5.14, RB-77, RB-80): "Vincular mi clave de Gemini" en Configuración → Asistente. La clave va al servidor
 * una sola vez, al verificarla; la pantalla nunca la recibe de vuelta (solo sus últimos 4). El campo se vacía al
 * terminar, también si falla.
 */
export function ClaveGemini({ inicial }: { inicial: InfoClave }) {
  const router = useRouter();
  const [info, setInfo] = useState(inicial);
  const [editando, setEditando] = useState(!inicial.vinculada);
  const [clave, setClave] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error' | 'advertencia'; texto: string } | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const origen = useRef<HTMLButtonElement | null>(null);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setMensaje(null);
    setCargando(true);
    const enviada = clave;
    setClave(''); // 5.14: el campo se vacía, pase lo que pase
    setMostrar(false);
    const r = await pedirNova<InfoClave & { mensaje: string }>('/api/nova/clave-gemini', 'PUT', { clave: enviada });
    setCargando(false);
    if (!r.ok) {
      setMensaje({ tipo: 'error', texto: r.mensaje });
      return;
    }
    const { mensaje: texto, ...nueva } = r.datos;
    setInfo(nueva);
    setEditando(false);
    setMensaje({ tipo: nueva.estado === 'sin_cuota' ? 'advertencia' : 'exito', texto });
    router.refresh(); // el aviso de RB-79 de las demás pantallas
  }

  async function desvincular() {
    setCargando(true);
    const r = await pedirNova<{ vinculada: false }>('/api/nova/clave-gemini', 'DELETE');
    setCargando(false);
    if (!r.ok) {
      setMensaje({ tipo: 'error', texto: r.mensaje });
      setConfirmar(false);
      return;
    }
    setConfirmar(false);
    setInfo({ vinculada: false, ultimos4: null, estado: null, verificadaEn: null });
    setEditando(true);
    setMensaje({ tipo: 'exito', texto: TEXTO_DESVINCULADA });
    router.refresh();
  }

  return (
    <div data-clave-gemini className="flex flex-col gap-3 border-t border-borde pt-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-texto">
        <KeyRound aria-hidden="true" className="size-4 text-acento" />
        Vincular mi clave de Gemini
      </h3>
      <p className="text-sm text-texto-suave">
        Con tu propia clave, todo lo que hace la IA en Nova usa tu cuota de Google. Es gratis y se crea en unos minutos.{' '}
        <Link href={RUTA_GUIA_CLAVE} className="font-semibold text-acento underline underline-offset-2">
          {TEXTO_ENLACE_GUIA}
        </Link>
      </p>

      {info.vinculada && info.ultimos4 && info.estado && (
        <div data-clave-vinculada className="flex flex-col gap-1 rounded-2xl border border-borde bg-superficie-2 px-4 py-3 text-sm text-texto">
          <p>
            Clave vinculada: <span className="font-mono">••••{info.ultimos4}</span>
          </p>
          <p className="text-texto-suave">
            Estado: <span data-estado-clave={info.estado} className={info.estado === 'activa' ? 'font-semibold text-exito' : 'font-semibold text-peligro'}>{textoEstadoClave(info.estado)}</span>
            {info.verificadaEn && <> · verificada el {fechaEnPalabras(info.verificadaEn)}</>}
          </p>
        </div>
      )}

      {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}

      {editando ? (
        <form onSubmit={(e) => void guardar(e)} className="flex flex-col gap-2">
          <label htmlFor="clave-gemini" className="text-sm font-medium text-texto">
            {info.vinculada ? 'Clave nueva' : 'Tu clave de Gemini'}
          </label>
          <div className="relative">
            <input
              id="clave-gemini"
              name="clave-gemini"
              type={mostrar ? 'text' : 'password'}
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              placeholder="Pega aquí tu clave"
              className={CLASE_CAMPO}
            />
            <button
              type="button"
              onClick={() => setMostrar((m) => !m)}
              aria-pressed={mostrar}
              aria-label={mostrar ? 'Ocultar la clave' : 'Mostrar la clave'}
              className="absolute inset-y-0 right-1 my-auto inline-flex size-9 items-center justify-center rounded-lg text-texto-suave hover:text-texto focus-visible:outline-2 focus-visible:outline-acento"
            >
              {mostrar ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Boton type="submit" cargando={cargando} disabled={cargando || clave.trim() === ''}>
              Verificar y guardar
            </Boton>
            {info.vinculada && (
              <Boton variante="secundario" disabled={cargando} onClick={() => { setEditando(false); setClave(''); setMensaje(null); }}>
                Cancelar
              </Boton>
            )}
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Boton variante="secundario" onClick={() => { setMensaje(null); setEditando(true); }}>
            Cambiar clave
          </Boton>
          <Boton
            variante="peligro"
            onClick={(e) => {
              origen.current = e.currentTarget;
              setMensaje(null);
              setConfirmar(true);
            }}
          >
            Desvincular
          </Boton>
        </div>
      )}

      <Dialogo abierto={confirmar} titulo="¿Desvincular tu clave?" descripcion={CONFIRMAR_DESVINCULAR} alCerrar={() => setConfirmar(false)} origen={origen}>
        <div className="flex flex-wrap gap-2">
          <Boton variante="peligro" cargando={cargando} disabled={cargando} onClick={() => void desvincular()}>
            Desvincular
          </Boton>
          <Boton variante="secundario" disabled={cargando} onClick={() => setConfirmar(false)}>
            Cancelar
          </Boton>
        </div>
      </Dialogo>
    </div>
  );
}
