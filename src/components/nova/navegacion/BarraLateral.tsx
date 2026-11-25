'use client';

import { ChevronRight, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { EstrellaNova } from '@/components/nova/marca/EstrellaNova';
import { CLASE_FOCO } from '@/components/ui/Boton';
import { ATRIBUTO_PILDORA, estiloPildora, usePildora } from '@/components/ui/usePildora';
import { avisoLateral, inicialPerfil, nombrePerfil } from '@/lib/reglas/avisos';
import { hoyBogota } from '@/lib/reglas/fechas';
import { CLAVE_LATERAL } from '@/lib/tema';
import { useAvisosNavegacion } from './AvisosNavegacion';
import { SUBMENU_SEMESTRE, esActivo, menuLateral, type Seccion } from './secciones';
import { useCerrarSesion } from './useCerrarSesion';

const ESTILO_FILA = `relative z-10 flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors duration-150 ${CLASE_FOCO}`;

/** Una sección del menú; plegada, solo el ícono (el nombre sigue para lectores de pantalla y como globo). */
function Fila({ seccion, activa, extra, conFondo }: { seccion: Seccion; activa: boolean; extra?: React.ReactNode; conFondo: boolean }) {
  const { href, texto, icono: Icono } = seccion;
  return (
    <Link
      href={href}
      title={texto}
      aria-current={activa ? 'page' : undefined}
      {...(activa ? { [ATRIBUTO_PILDORA]: '' } : {})}
      className={`${ESTILO_FILA} ${activa ? `font-semibold text-texto ${conFondo ? 'bg-acento-suave' : ''}` : 'text-texto-suave hover:bg-superficie-2/70 hover:text-texto'}`}
    >
      <Icono aria-hidden="true" className={`size-5 shrink-0 ${activa ? 'text-acento' : ''}`} />
      <span className="nova-plegable">{texto}</span>
      {extra}
    </Link>
  );
}

/**
 * Computador (≥ 1024 px). E20b: panel de cristal flotante con la estrella y "nova", el perfil, las secciones con
 * una píldora que se desliza a la activa, Semestre con sus tres pestañas, una tarjeta de aviso (tareas vencidas o
 * el próximo corte) y "Cerrar sesión". Se pliega a solo íconos; se recuerda en el navegador (CLAVE_LATERAL).
 */
export function BarraLateral({ email, administrador = false }: { email: string; administrador?: boolean }) {
  const MENU_LATERAL = menuLateral(administrador);
  const ruta = usePathname();
  const avisos = useAvisosNavegacion();
  const { cerrarSesion, error, saliendo } = useCerrarSesion();
  const enSemestre = esActivo(ruta, '/nova/semestre');
  const [semestreAbierto, setSemestreAbierto] = useState(enSemestre);
  const [plegada, setPlegada] = useState(false);
  const lista = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setPlegada(document.documentElement.getAttribute('data-lateral') === 'plegada');
  }, []);
  useEffect(() => {
    if (enSemestre) setSemestreAbierto(true);
  }, [enSemestre]);

  // La subsección activa de Semestre (exacta: /nova/semestre/{id} es una materia, va con "Materias y notas").
  const subActiva = enSemestre ? (SUBMENU_SEMESTRE.find((s) => s.href !== '/nova/semestre' && esActivo(ruta, s.href))?.href ?? '/nova/semestre') : undefined;
  const activa = MENU_LATERAL.find((s) => esActivo(ruta, s.href))?.href;
  // Con el submenú a la vista, la píldora va a la subsección; con el menú plegado, el submenú no se ve.
  const conSub = semestreAbierto && subActiva !== undefined && !plegada;
  const clavePildora = conSub ? `sub:${subActiva}` : activa;
  const pildora = usePildora(lista, 'lateral', `${clavePildora}|${semestreAbierto}|${plegada}`);

  function alternarPlegada() {
    const nueva = !plegada;
    setPlegada(nueva);
    if (nueva) document.documentElement.setAttribute('data-lateral', 'plegada');
    else document.documentElement.removeAttribute('data-lateral');
    try {
      localStorage.setItem(CLAVE_LATERAL, nueva ? 'plegada' : 'desplegada');
    } catch {
      // Sin almacenamiento: vale para esta visita.
    }
  }

  const nombre = nombrePerfil(avisos?.nombre ?? '', email);
  const aviso = avisos ? avisoLateral(avisos, hoyBogota()) : null;
  const vencidas = avisos?.vencidas ?? 0;

  return (
    <aside className="fixed inset-y-3 left-3 z-30 hidden w-[var(--nova-ancho-lateral)] flex-col gap-3 overflow-y-auto rounded-[26px] border border-borde bg-cristal px-3 py-4 shadow-suave backdrop-blur-lg transition-[width] duration-200 lg:flex">
      <div className="flex items-center justify-between gap-2 px-1">
        <Link href="/nova" aria-label="Nova, ir a Inicio" className={`inline-flex items-center gap-2.5 rounded-xl ${CLASE_FOCO}`}>
          <EstrellaNova halo className="size-9" />
          <span className="nova-plegable font-display text-2xl font-extrabold tracking-tight text-texto">nova</span>
        </Link>
        <button
          type="button"
          data-sin-conexion="permitido" // solo cambia cómo se ve el menú
          onClick={alternarPlegada}
          aria-label="Plegar el menú a solo íconos"
          title="Plegar el menú"
          className={`nova-solo-desplegada flex size-9 items-center justify-center rounded-xl text-texto-suave hover:bg-superficie-2 hover:text-texto ${CLASE_FOCO}`}
        >
          <PanelLeftClose aria-hidden="true" className="size-5" />
        </button>
      </div>
      {plegada && (
        <button
          type="button"
          data-sin-conexion="permitido"
          onClick={alternarPlegada}
          aria-label="Desplegar el menú"
          title="Desplegar el menú"
          className={`flex size-10 items-center justify-center self-center rounded-xl text-texto-suave hover:bg-superficie-2 hover:text-texto ${CLASE_FOCO}`}
        >
          <PanelLeftOpen aria-hidden="true" className="size-5" />
        </button>
      )}

      <div className="flex items-center gap-3 border-b border-borde px-1 pb-3" title={email}>
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-acento-suave font-display text-lg font-extrabold text-acento">
          {inicialPerfil(nombre)}
        </span>
        <span className="nova-plegable flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-texto">{nombre}</span>
          <span className="truncate text-xs text-texto-suave">{email}</span>
        </span>
      </div>

      <nav aria-label="Principal" className="flex-1">
        <p className="nova-solo-desplegada px-3 pb-1 font-mono text-[10.5px] tracking-[0.14em] text-texto-suave uppercase">Menú</p>
        <ul ref={lista} className="relative flex flex-col gap-0.5">
          {pildora && <li aria-hidden="true" className="pointer-events-none absolute top-0 left-0 rounded-xl bg-acento-suave" style={estiloPildora(pildora)} />}
          {MENU_LATERAL.map((s) => {
            const esActiva = esActivo(ruta, s.href) && !(s.href === '/nova/semestre' && conSub);
            const conGlobo = s.href === '/nova/tareas' && vencidas > 0;
            return (
              <li key={s.href} className={s.href === '/nova/configuracion' ? 'mt-3' : undefined}>
                {s.href === '/nova/configuracion' && <p className="nova-solo-desplegada px-3 pb-1 font-mono text-[10.5px] tracking-[0.14em] text-texto-suave uppercase">Cuenta</p>}
                <div className="flex items-center">
                  <div className="min-w-0 flex-1">
                    <Fila
                      seccion={s}
                      activa={esActiva}
                      conFondo={!pildora}
                      extra={
                        conGlobo ? (
                          <span
                            aria-label={vencidas === 1 ? '1 tarea vencida' : `${vencidas} tareas vencidas`}
                            className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-peligro px-1.5 font-mono text-[11px] font-semibold text-acento-texto"
                          >
                            {vencidas}
                          </span>
                        ) : undefined
                      }
                    />
                  </div>
                  {s.href === '/nova/semestre' && (
                    <button
                      type="button"
                      data-sin-conexion="permitido"
                      aria-expanded={semestreAbierto}
                      aria-controls="submenu-semestre"
                      aria-label={semestreAbierto ? 'Ocultar las secciones de Semestre' : 'Mostrar las secciones de Semestre'}
                      onClick={() => setSemestreAbierto((v) => !v)}
                      className={`nova-solo-desplegada relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg text-texto-suave hover:bg-superficie-2 hover:text-texto ${CLASE_FOCO}`}
                    >
                      <ChevronRight aria-hidden="true" className={`size-4 transition-transform duration-200 ${semestreAbierto ? 'rotate-90' : ''}`} />
                    </button>
                  )}
                </div>
                {s.href === '/nova/semestre' && semestreAbierto && (
                  <ul id="submenu-semestre" className="nova-solo-desplegada mt-0.5 ml-[1.35rem] flex flex-col gap-0.5 border-l-[1.5px] border-borde pl-2.5">
                    {SUBMENU_SEMESTRE.map((sub) => {
                      const esSub = conSub && sub.href === subActiva;
                      return (
                        <li key={sub.href}>
                          <Link
                            href={sub.href}
                            aria-current={esSub ? 'page' : undefined}
                            {...(esSub ? { [ATRIBUTO_PILDORA]: '' } : {})}
                            className={`relative z-10 flex min-h-8 items-center rounded-lg px-2.5 py-1.5 text-[13.5px] ${CLASE_FOCO} ${
                              esSub ? `font-semibold text-texto ${pildora ? '' : 'bg-acento-suave'}` : 'text-texto-suave hover:text-texto'
                            }`}
                          >
                            {sub.texto}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {aviso && (
        <Link
          href={aviso.href}
          className={`nova-solo-desplegada relative flex flex-col gap-1 overflow-hidden rounded-2xl border border-borde bg-superficie p-3 transition-colors hover:bg-superficie-2 [@media(max-height:760px)]:hidden ${CLASE_FOCO}`}
        >
          <span aria-hidden="true" className="absolute -top-8 -right-8 size-24 rounded-full bg-acento-suave" />
          <span className="relative font-mono text-[10.5px] tracking-[0.1em] text-acento uppercase">{aviso.etiqueta}</span>
          <span className="relative font-display text-base leading-tight font-bold text-texto">{aviso.titulo}</span>
          <span className="relative text-xs text-texto-suave">{aviso.texto}</span>
        </Link>
      )}

      <div className="flex flex-col gap-1 border-t border-borde pt-3">
        <button
          type="button"
          onClick={() => void cerrarSesion()}
          disabled={saliendo}
          aria-busy={saliendo || undefined}
          title="Cerrar sesión"
          className={`${ESTILO_FILA} text-texto-suave hover:bg-superficie-2/70 hover:text-texto disabled:opacity-60`}
        >
          {saliendo ? <span aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <LogOut aria-hidden="true" className="size-5 shrink-0" />}
          <span className="nova-plegable">Cerrar sesión</span>
        </button>
        {error && (
          <p role="alert" className="px-3 text-xs font-medium text-peligro">
            {error}
          </p>
        )}
      </div>
    </aside>
  );
}
