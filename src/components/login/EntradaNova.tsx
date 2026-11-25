'use client';

import { MousePointerClick, Pointer } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { EstrellaNova } from '@/components/nova/marca/EstrellaNova';
import { CieloNoche } from './CieloNoche';

/** Si nadie toca la estrella, se enciende sola. */
export const ENCENDER_SOLA_MS = 2000;
/** Lo que dura el brillo antes de que la estrella empiece a moverse. */
const BRILLO_MS = 450;
/** El viaje de la estrella hasta su lugar (arranca despacio, acelera y frena). */
export const VIAJE_MS = 1000;
/** El formulario aparece cuando la estrella va por aquí del viaje, para que todo se sienta encadenado. */
const FORMULARIO_EN = 0.45;
/** Distancia (px) a la que una estrella del fondo brilla más con la luz. */
const RADIO_CERCA = 130;
/** Tamaño de la luz que sigue al puntero. */
const LUZ = 360;

export type EstadoEntrada = 'apagada' | 'encendiendo' | 'encendida';

const FRASE = 'Tu semestre, tus tareas y tus documentos, en un solo lugar.';

/**
 * E20b (commit 10, cambio del usuario del 2026-11-24): la entrada con la Estrella nova. Empieza con un cielo de
 * noche y la estrella apagada latiendo en el centro; al tocarla (o con Enter o Espacio, o sola a los 2 s, o al
 * llegar con Tab al formulario) se enciende como una nova: brillo cálido, tres ondas que viajan con ella, y
 * un solo movimiento hasta su lugar (arriba del formulario en el teléfono; grande a la izquierda en pantalla
 * ancha). El formulario siempre está en la página: se puede usar con el teclado y con lectores de pantalla
 * aunque la estrella no se haya encendido. Con "reducir movimiento", todo está encendido desde el principio.
 * Deja lugar (`extra`) para "Entrar con Google" y el texto nuevo de "¿Olvidaste tu contraseña?" (E20c).
 */
export function EntradaNova({
  titulo,
  subtitulo,
  children,
  pie,
  extra,
}: {
  titulo: string;
  subtitulo: ReactNode;
  children: ReactNode;
  pie?: ReactNode;
  /** E20c: "Entrar con Google" y el texto de "¿Olvidaste tu contraseña?". */
  extra?: ReactNode;
}) {
  const [estado, setEstado] = useState<EstadoEntrada>('apagada');
  const [formulario, setFormulario] = useState(false);
  const escena = useRef<HTMLElement>(null);
  const capa = useRef<HTMLDivElement>(null);
  const luz = useRef<HTMLDivElement>(null);
  const viajera = useRef<HTMLDivElement>(null);
  const huecoMovil = useRef<HTMLSpanElement>(null);
  const huecoAncho = useRef<HTMLSpanElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const encendidaCon = useRef<'estrella' | 'otro'>('otro');
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  const encender = useCallback((con: 'estrella' | 'otro') => {
    if (estadoRef.current !== 'apagada') return;
    encendidaCon.current = con;
    setEstado('encendiendo');
  }, []);

  // Reducir movimiento: todo encendido desde el principio. Si no, se enciende sola a los 2 s.
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setEstado('encendida');
      setFormulario(true);
      return;
    }
    const t = setTimeout(() => encender('otro'), ENCENDER_SOLA_MS);
    return () => clearTimeout(t);
  }, [encender]);

  // Al encender: brillo, y luego el viaje hasta el lugar visible (teléfono o pantalla ancha).
  useEffect(() => {
    if (estado !== 'encendiendo') return;
    const temporizadores: number[] = [];
    let animacion: Animation | null = null;
    temporizadores.push(
      window.setTimeout(() => {
        const el = viajera.current;
        const ancho = window.matchMedia?.('(min-width: 1024px)').matches;
        const hueco = (ancho ? huecoAncho : huecoMovil).current;
        temporizadores.push(window.setTimeout(() => setFormulario(true), VIAJE_MS * FORMULARIO_EN));
        if (!el || !hueco || typeof el.animate !== 'function') {
          setEstado('encendida');
          return;
        }
        const a = el.getBoundingClientRect();
        const b = hueco.getBoundingClientRect();
        const escala = b.width / a.width;
        const dx = b.left + b.width / 2 - (a.left + a.width / 2);
        const dy = b.top + b.height / 2 - (a.top + a.height / 2);
        animacion = el.animate([{ transform: 'translate3d(0, 0, 0) scale(1)' }, { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${escala})` }], {
          duration: VIAJE_MS,
          easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
          fill: 'forwards',
        });
        animacion.onfinish = () => setEstado('encendida');
      }, BRILLO_MS),
    );
    return () => {
      temporizadores.forEach(clearTimeout);
      animacion?.cancel();
    };
  }, [estado]);

  // Si se encendió con la estrella (clic, Enter o Espacio), el foco pasa al primer campo al llegar.
  useEffect(() => {
    if (estado !== 'encendida' || encendidaCon.current !== 'estrella') return;
    formRef.current?.querySelector<HTMLElement>('input, button, a')?.focus({ preventScroll: true });
  }, [estado]);

  // La luz que sigue al puntero (sin retraso: transform en requestAnimationFrame) y el cielo que se mueve al lado
  // contrario. En el teléfono, la luz sigue al dedo mientras se arrastra. Se detiene con la pestaña oculta.
  useEffect(() => {
    const raiz = escena.current;
    if (!raiz || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let x = -9999;
    let y = -9999;
    let pendiente = false;
    let cuadro = 0;
    let estrellas: Array<{ el: HTMLElement; cx: number; cy: number; cerca: boolean }> = [];
    const medir = () => {
      estrellas = [...raiz.querySelectorAll<HTMLElement>('[data-estrella-cielo]')].map((el) => {
        const r = el.getBoundingClientRect();
        return { el, cx: r.left + r.width / 2, cy: r.top + r.height / 2, cerca: el.hasAttribute('data-cerca') };
      });
    };
    const pintar = () => {
      pendiente = false;
      if (luz.current) luz.current.style.transform = `translate3d(${x - LUZ / 2}px, ${y - LUZ / 2}px, 0)`;
      if (capa.current) {
        const px = (x / window.innerWidth - 0.5) * -14;
        const py = (y / window.innerHeight - 0.5) * -10;
        capa.current.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
      }
      for (const e of estrellas) {
        const cerca = (e.cx - x) ** 2 + (e.cy - y) ** 2 < RADIO_CERCA ** 2;
        if (cerca !== e.cerca) {
          e.cerca = cerca;
          e.el.toggleAttribute('data-cerca', cerca);
        }
      }
    };
    const mover = (ev: PointerEvent) => {
      if (ev.pointerType !== 'mouse' && ev.buttons === 0 && ev.type === 'pointermove') return; // el dedo sin tocar
      x = ev.clientX;
      y = ev.clientY;
      if (luz.current) luz.current.dataset.visible = '';
      if (!pendiente && !document.hidden) {
        pendiente = true;
        cuadro = requestAnimationFrame(pintar);
      }
    };
    const soltar = (ev: PointerEvent) => {
      if (ev.pointerType !== 'mouse' && luz.current) delete luz.current.dataset.visible;
    };
    const visibilidad = () => raiz.toggleAttribute('data-pausado', document.hidden);
    medir();
    const alCambiarTamano = () => medir();
    window.addEventListener('pointermove', mover, { passive: true });
    window.addEventListener('pointerdown', mover, { passive: true });
    window.addEventListener('pointerup', soltar, { passive: true });
    window.addEventListener('pointercancel', soltar, { passive: true });
    window.addEventListener('resize', alCambiarTamano);
    document.addEventListener('visibilitychange', visibilidad);
    // El cielo se desplaza despacio: las posiciones se vuelven a medir cada tanto (barato: 64 estrellas).
    const remedir = window.setInterval(() => !document.hidden && medir(), 4000);
    return () => {
      cancelAnimationFrame(cuadro);
      window.clearInterval(remedir);
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerdown', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);
      window.removeEventListener('resize', alCambiarTamano);
      document.removeEventListener('visibilitychange', visibilidad);
    };
  }, []);

  const encendida = estado === 'encendida';
  const viajando = estado === 'encendiendo';

  return (
    <main ref={escena} data-nova-fondo data-entrada-estado={estado} className="nova-cielo relative min-h-dvh overflow-x-hidden bg-cielo-abajo text-texto">
      <CieloNoche capaRef={capa} />
      {/* La luz cálida: más tenue cuando la estrella ya está encendida, para no estorbar el formulario. */}
      <div
        ref={luz}
        aria-hidden="true"
        data-luz
        className={`nova-luz pointer-events-none fixed top-0 left-0 z-0 rounded-full opacity-0 will-change-transform ${encendida ? 'data-[visible]:opacity-40' : 'data-[visible]:opacity-100'}`}
        style={{ width: LUZ, height: LUZ, transform: 'translate3d(-9999px, -9999px, 0)' }}
      />

      {/* La estrella del centro (primera al pulsar Tab): se enciende y viaja hasta su lugar; al llegar, se queda la del hueco. */}
      {!encendida && (
        <div className="nova-entrada-escena pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-center gap-8 px-4">
          <div ref={viajera} className="relative" data-estrella-viajera>
            {viajando && (
              <>
                <span aria-hidden="true" className="nova-halo-nova absolute -inset-1/2 rounded-full" />
                {[0, 0.22, 0.44].map((d) => (
                  <span key={d} aria-hidden="true" className="nova-onda absolute inset-0 rounded-full" style={{ animationDelay: `${d}s` }} data-onda />
                ))}
              </>
            )}
            <button
              type="button"
              onClick={() => encender('estrella')}
              aria-label="Encender la estrella de Nova"
              disabled={viajando}
              className="pointer-events-auto relative block rounded-full focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-cielo-texto"
            >
              <EstrellaNova className={`size-36 lg:size-44 ${viajando ? 'nova-estrella-encendida' : 'nova-estrella-apagada nova-latido'}`} />
            </button>
          </div>
          {!viajando && (
            <p className="nova-indicacion flex flex-col items-center gap-1 text-center text-cielo-texto" data-indicacion>
              <span className="flex items-center gap-2 text-base font-semibold">
                <Pointer aria-hidden="true" className="size-5 pointer-fine:hidden" />
                <MousePointerClick aria-hidden="true" className="hidden size-5 pointer-fine:inline" />
                <span className="pointer-fine:hidden">Toca la estrella</span>
                <span className="hidden pointer-fine:inline">Haz clic en la estrella</span>
              </span>
              <span className="hidden text-sm text-cielo-texto-suave pointer-fine:inline">o pulsa Enter</span>
            </p>
          )}
        </div>
      )}
      <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:gap-16">
        {/* Pantalla ancha: la estrella queda grande a la izquierda, con "Nova" y una frase corta. */}
        <div className="hidden flex-col items-center gap-5 text-center lg:flex">
          <span ref={huecoAncho} data-hueco-estrella="ancho" className="relative grid size-44 place-items-center">
            {encendida && <EstrellaNova halo className="size-44" />}
          </span>
          <div className={`flex flex-col gap-2 transition-opacity duration-700 ${formulario ? 'opacity-100' : 'opacity-0'}`}>
            <p className="font-display text-5xl font-extrabold tracking-tight text-cielo-texto">Nova</p>
            <p className="max-w-xs text-base text-cielo-texto-suave">{FRASE}</p>
          </div>
        </div>

        {/* El formulario siempre está en la página; al llegar a él con Tab, la estrella se enciende. */}
        <div
          ref={formRef}
          onFocusCapture={() => encender('otro')}
          data-visible={formulario || undefined}
          className={`nova-entrada-formulario mx-auto w-full max-w-md ${formulario ? 'opacity-100' : 'opacity-0'}`}
          data-formulario-entrada
        >
          <section className="rounded-[20px] border border-borde bg-superficie p-6 shadow-suave sm:p-9">
            <div className="mb-8">
              <p className="mb-8 flex items-center gap-2.5 lg:hidden">
                <span ref={huecoMovil} data-hueco-estrella="movil" className="relative inline-flex size-12 shrink-0">
                  {encendida && <EstrellaNova halo className="size-12" />}
                </span>
                <span className="font-display text-3xl font-extrabold tracking-tight text-texto">nova</span>
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-texto sm:text-3xl">{titulo}</h1>
              <p className="mt-2 text-sm leading-6 text-texto-suave">{subtitulo}</p>
            </div>
            {children}
            {extra}
            {pie && <div className="mt-7 text-center text-sm text-texto-suave">{pie}</div>}
          </section>
        </div>
      </div>

    </main>
  );
}
