'use client';

import { Copy, KeyRound, Lock, LockKeyhole, LockOpen, Search, ShieldMinus, ShieldPlus, Trash2, UserCheck, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type MouseEvent } from 'react';
import { pedirSemestre } from '@/components/nova/semestre/peticion';
import { Aviso } from '@/components/ui/Aviso';
import { Boton, CLASE_FOCO } from '@/components/ui/Boton';
import { CLASE_CONTROL } from '@/components/ui/Campo';
import { Dialogo } from '@/components/ui/Dialogo';
import { Insignia, type TonoInsignia } from '@/components/ui/Insignia';
import type { CuentaAdmin } from '@/lib/datos/administracion';
import {
  correoConfirmado,
  FILTROS_CUENTAS,
  fechaCorta,
  filtrarCuentas,
  formatearMb,
  haceCuanto,
  revisarAccion,
  TEXTO_ESTADO,
  TEXTO_NIVEL,
  TEXTO_SIN_COINCIDENCIAS,
  textoConfirmarBloquear,
  textoConfirmarEliminar,
  textoContrasenaTemporal,
  textoEliminada,
  type AccionCuenta,
  type FiltroCuentas,
  type Nivel,
} from '@/lib/reglas/cuentas';

/**
 * E20c-2 (B-104, RB-82, RB-84, RB-92, RB-93): la tabla de cuentas con búsqueda y filtros. En el computador es una
 * tabla; en el teléfono, una tarjeta por cuenta. Cada cuenta muestra solo las acciones que el nivel de quien mira
 * permite (el servidor las vuelve a revisar). Bloquear y nombrar administrador piden confirmación; eliminar, escribir
 * el correo.
 */

type AccionPantalla = AccionCuenta | 'eliminar' | 'contrasena_temporal';

interface Opcion {
  accion: AccionPantalla;
  texto: string;
  icono: LucideIcon;
  confirmar?: boolean;
  peligro?: boolean;
}

function opcionesPara(yo: { id: string; nivel: Nivel }, c: CuentaAdmin): Opcion[] {
  const todas: Opcion[] = [
    { accion: 'habilitar', texto: 'Habilitar', icono: UserCheck },
    { accion: 'desbloquear', texto: 'Desbloquear', icono: LockOpen },
    { accion: 'bloquear', texto: 'Bloquear', icono: Lock, confirmar: true },
    { accion: 'nombrar_admin', texto: 'Nombrar administrador', icono: ShieldPlus, confirmar: true },
    { accion: 'quitar_admin', texto: 'Quitar administrador', icono: ShieldMinus },
    c.usaClaveProyecto
      ? { accion: 'permiso_clave_off', texto: 'Quitar la clave del proyecto', icono: KeyRound }
      : { accion: 'permiso_clave_on', texto: 'Dar la clave del proyecto', icono: KeyRound },
    { accion: 'contrasena_temporal', texto: 'Contraseña temporal', icono: LockKeyhole, confirmar: true },
    { accion: 'eliminar', texto: 'Eliminar', icono: Trash2, confirmar: true, peligro: true },
  ];
  return todas.filter((o) => revisarAccion(yo, { id: c.id, nivel: c.nivel, estado: c.estado }, o.accion) === null);
}

const HECHO: Record<AccionCuenta, (correo: string) => string> = {
  habilitar: (c) => `${c} ya puede entrar a Nova.`,
  bloquear: (c) => `Se bloqueó a ${c}.`,
  desbloquear: (c) => `Se desbloqueó a ${c}.`,
  nombrar_admin: (c) => `${c} ahora es administrador.`,
  quitar_admin: (c) => `${c} ya no es administrador.`,
  permiso_clave_on: (c) => `${c} ya puede usar la clave del proyecto.`,
  permiso_clave_off: (c) => `${c} ya no usa la clave del proyecto.`,
};

const TONO_ESTADO: Record<CuentaAdmin['estado'], TonoInsignia> = { activa: 'exito', pendiente: 'aviso', bloqueada: 'peligro' };

function EstadoCuenta({ c }: { c: CuentaAdmin }) {
  return <Insignia tono={TONO_ESTADO[c.estado]}>{c.estado === 'bloqueada' ? <><Lock aria-hidden="true" className="mr-1 size-3" />{TEXTO_ESTADO.bloqueada}</> : TEXTO_ESTADO[c.estado]}</Insignia>;
}

function Espacio({ c, topeMb }: { c: CuentaAdmin; topeMb: number }) {
  const mb = formatearMb(c.bytes);
  if (c.nivel !== 'usuario') return <span className="tabular-nums">{mb} MB · sin tope</span>;
  const f = topeMb > 0 ? c.bytes / (topeMb * 1024 * 1024) : 0;
  const color = f >= 0.95 ? 'bg-peligro' : f >= 0.8 ? 'bg-aviso' : 'bg-acento';
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <span aria-hidden="true" className="inline-block h-1.5 w-16 overflow-hidden rounded-full bg-superficie-2">
        <span className={`block h-full ${color}`} style={{ width: `${Math.min(100, f * 100)}%` }} />
      </span>
      {mb} de {topeMb} MB
    </span>
  );
}

function Nombre({ c, yo }: { c: CuentaAdmin; yo: string }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate font-semibold text-texto" title={c.correo}>
        {c.correo}
        {c.id === yo && <span className="font-normal text-texto-suave"> (tú)</span>}
      </span>
      <span className="flex flex-wrap items-center gap-1.5 text-xs text-texto-suave">
        {c.nombre || 'Sin nombre'}
        {c.nivel !== 'usuario' && <Insignia tono="acento">{TEXTO_NIVEL[c.nivel]}</Insignia>}
        {c.usaClaveProyecto && c.nivel !== 'dueno' && <Insignia>Clave del proyecto</Insignia>}
      </span>
    </span>
  );
}

export function CuentasAdministracion({ cuentas, yo, topeMb, ahora }: { cuentas: CuentaAdmin[]; yo: { id: string; nivel: Nivel }; topeMb: number; ahora: string }) {
  const router = useRouter();
  const id = useId();
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroCuentas>('Todas');
  const [ocupado, setOcupado] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [confirmar, setConfirmar] = useState<{ c: CuentaAdmin; accion: AccionPantalla } | null>(null);
  const [escrito, setEscrito] = useState('');
  // E20c-3 (RB-91): la contraseña temporal recién dada; se muestra una sola vez, en el diálogo.
  const [temporal, setTemporal] = useState<{ correo: string; contrasena: string } | null>(null);
  const [copiada, setCopiada] = useState(false);
  const origen = useRef<HTMLElement | null>(null);
  const momento = new Date(ahora);
  const visibles = filtrarCuentas(cuentas, busqueda, filtro);

  async function hacer(c: CuentaAdmin, accion: AccionPantalla, correo = '') {
    setOcupado(`${c.id}:${accion}`);
    setMensaje(null);
    const url = `/api/nova/administracion/cuentas/${c.id}`;
    if (accion === 'contrasena_temporal') {
      const t = await pedirSemestre<{ correo: string; contrasena: string }>(`${url}/contrasena-temporal`, 'POST');
      setOcupado('');
      if (!t.ok) {
        setMensaje({ tipo: 'error', texto: t.mensaje });
        return;
      }
      setCopiada(false);
      setTemporal({ correo: t.datos.correo, contrasena: t.datos.contrasena });
      router.refresh();
      return;
    }
    const r = accion === 'eliminar' ? await pedirSemestre(url, 'DELETE', { correo }) : await pedirSemestre(url, 'POST', { accion });
    setOcupado('');
    if (!r.ok) {
      setMensaje({ tipo: 'error', texto: r.mensaje });
      return;
    }
    setConfirmar(null);
    setEscrito('');
    setMensaje({ tipo: 'exito', texto: accion === 'eliminar' ? textoEliminada(c.correo) : HECHO[accion](c.correo) });
    router.refresh();
  }

  function elegir(e: MouseEvent<HTMLButtonElement>, c: CuentaAdmin, o: Opcion) {
    origen.current = e.currentTarget;
    if (o.confirmar) {
      setEscrito('');
      setMensaje(null);
      setConfirmar({ c, accion: o.accion });
    } else void hacer(c, o.accion);
  }

  function acciones(c: CuentaAdmin, compactas: boolean) {
    const opciones = opcionesPara(yo, c);
    if (opciones.length === 0) return null;
    return (
      <div className={`flex flex-wrap gap-1.5 ${compactas ? 'justify-end' : ''}`}>
        {opciones.map((o) => {
          const Icono = o.icono;
          const etiqueta = `${o.texto}: ${c.correo}`;
          return compactas ? (
            <button
              key={o.accion}
              type="button"
              aria-label={etiqueta}
              title={o.texto}
              aria-busy={ocupado === `${c.id}:${o.accion}` || undefined}
              disabled={ocupado !== ''}
              onClick={(e) => elegir(e, c, o)}
              className={`inline-flex size-9 items-center justify-center rounded-xl border border-borde bg-superficie transition-colors hover:border-acento disabled:opacity-60 ${o.peligro ? 'text-peligro' : 'text-texto'} ${CLASE_FOCO}`}
            >
              <Icono aria-hidden="true" className="size-4" />
            </button>
          ) : (
            <Boton key={o.accion} variante={o.peligro ? 'peligro' : 'secundario'} aria-label={etiqueta} cargando={ocupado === `${c.id}:${o.accion}`} disabled={ocupado !== '' && ocupado !== `${c.id}:${o.accion}`} onClick={(e) => elegir(e, c, o)} className="min-h-9 px-3 py-1.5">
              <Icono aria-hidden="true" className="size-4" />
              {o.texto}
            </Boton>
          );
        })}
      </div>
    );
  }

  const enDialogo = confirmar?.c;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-base font-semibold text-texto">Cuentas</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor={`${id}-buscar`} className="sr-only">
            Buscar cuenta
          </label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-suave" />
            <input id={`${id}-buscar`} type="search" autoComplete="off" placeholder="Buscar por correo o nombre" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={`${CLASE_CONTROL} pl-9 sm:w-64`} />
          </div>
          <div role="group" aria-label="Filtro" className="flex max-w-full overflow-x-auto rounded-full border border-borde bg-superficie-2 p-1">
            {FILTROS_CUENTAS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filtro === f}
                onClick={() => setFiltro(f)}
                className={`min-h-9 shrink-0 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors ${CLASE_FOCO} ${filtro === f ? 'bg-superficie text-texto shadow-suave' : 'text-texto-suave hover:text-texto'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mensaje && !confirmar && <Aviso tipo={mensaje.tipo === 'exito' ? 'exito' : 'error'}>{mensaje.texto}</Aviso>}

      {visibles.length === 0 ? (
        <p className="text-sm text-texto-suave">{TEXTO_SIN_COINCIDENCIAS}</p>
      ) : (
        <>
          {/* Computador: tabla. */}
          <div className="hidden overflow-x-auto rounded-2xl border border-borde lg:block">
            <table className="w-full border-collapse text-left text-sm" data-tabla-cuentas>
              <caption className="sr-only">Cuentas de Nova</caption>
              <thead>
                <tr className="bg-superficie-2 font-mono text-[11px] tracking-[0.1em] text-texto-suave uppercase">
                  <th scope="col" className="px-3 py-2.5 font-semibold">Cuenta</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Registro</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Último acceso</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Espacio</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">IA · 7 días</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Clave</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Estado</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((c) => (
                  <tr key={c.id} data-cuenta={c.correo} className={`border-t border-borde align-middle ${c.estado === 'bloqueada' ? 'bg-peligro/8' : ''}`}>
                    <td className="max-w-64 px-3 py-2.5">
                      <Nombre c={c} yo={yo.id} />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-texto tabular-nums">{fechaCorta(c.registro)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-texto">{haceCuanto(c.ultimoAcceso, momento)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-texto">
                      <Espacio c={c} topeMb={topeMb} />
                    </td>
                    <td className="px-3 py-2.5 text-texto tabular-nums">{c.consultas}</td>
                    <td className="px-3 py-2.5">{c.conClave ? <Insignia tono="exito">Sí</Insignia> : <Insignia>No</Insignia>}</td>
                    <td className="px-3 py-2.5">
                      <EstadoCuenta c={c} />
                    </td>
                    <td className="px-3 py-2.5">
                      {acciones(c, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Teléfono y tableta: una tarjeta por cuenta. */}
          <ul className="flex flex-col gap-3 lg:hidden" data-tarjetas-cuentas>
            {visibles.map((c) => (
              <li key={c.id} data-cuenta={c.correo} className={`flex flex-col gap-3 rounded-2xl border border-borde p-4 ${c.estado === 'bloqueada' ? 'bg-peligro/8' : 'bg-superficie'}`}>
                <div className="flex items-start justify-between gap-3">
                  <Nombre c={c} yo={yo.id} />
                  <EstadoCuenta c={c} />
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                  <dt className="text-texto-suave">Registro</dt>
                  <dd className="text-texto tabular-nums">{fechaCorta(c.registro)}</dd>
                  <dt className="text-texto-suave">Último acceso</dt>
                  <dd className="text-texto">{haceCuanto(c.ultimoAcceso, momento)}</dd>
                  <dt className="text-texto-suave">Espacio</dt>
                  <dd className="text-texto">
                    <Espacio c={c} topeMb={topeMb} />
                  </dd>
                  <dt className="text-texto-suave">IA · 7 días</dt>
                  <dd className="text-texto tabular-nums">{c.consultas}</dd>
                  <dt className="text-texto-suave">Clave de Gemini</dt>
                  <dd className="text-texto">{c.conClave ? 'Sí' : 'No'}</dd>
                </dl>
                {acciones(c, false)}
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialogo
        abierto={confirmar !== null}
        titulo={
          confirmar?.accion === 'eliminar' ? 'Eliminar cuenta' : confirmar?.accion === 'bloquear' ? 'Bloquear cuenta' : confirmar?.accion === 'contrasena_temporal' ? 'Contraseña temporal' : 'Nombrar administrador'
        }
        alCerrar={() => {
          setConfirmar(null);
          setMensaje(null);
          setTemporal(null);
        }}
        origen={origen}
      >
        {temporal && (
          <div className="flex flex-col gap-4" data-contrasena-temporal>
            <p role="status" className="text-sm text-texto">
              {textoContrasenaTemporal(temporal.correo, temporal.contrasena)}
            </p>
            <p className="rounded-xl border border-borde bg-superficie-2 px-4 py-3 text-center font-mono text-lg tracking-wider break-all text-texto select-all">{temporal.contrasena}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Boton
                variante="secundario"
                listo={copiada}
                textoListo="Copiada"
                onClick={() => {
                  void navigator.clipboard?.writeText(temporal.contrasena).then(() => setCopiada(true)).catch(() => {});
                }}
              >
                <Copy aria-hidden="true" className="size-4" />
                Copiar
              </Boton>
              <Boton
                onClick={() => {
                  setTemporal(null);
                  setConfirmar(null);
                }}
              >
                Listo
              </Boton>
            </div>
          </div>
        )}
        {!temporal && enDialogo && confirmar && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void hacer(enDialogo, confirmar.accion, escrito);
            }}
          >
            {confirmar.accion === 'eliminar' ? (
              <>
                <label htmlFor={`${id}-correo`} className="text-sm text-texto">
                  {textoConfirmarEliminar(enDialogo.correo)}
                </label>
                <input id={`${id}-correo`} autoComplete="off" autoCapitalize="none" spellCheck={false} value={escrito} onChange={(e) => setEscrito(e.target.value)} className={CLASE_CONTROL} />
              </>
            ) : confirmar.accion === 'bloquear' ? (
              <p className="text-sm text-texto">{textoConfirmarBloquear(enDialogo.correo)}</p>
            ) : confirmar.accion === 'contrasena_temporal' ? (
              <p className="text-sm text-texto">{`¿Dar una contraseña temporal a ${enDialogo.correo}? Su contraseña actual deja de servir. Con la temporal entra una sola vez en las próximas 24 horas y pone una propia.`}</p>
            ) : (
              <p className="text-sm text-texto">{`¿Nombrar administrador a ${enDialogo.correo}? Podrá ver las cuentas, habilitarlas y bloquear usuarios.`}</p>
            )}
            {mensaje?.tipo === 'error' && <Aviso tipo="error">{mensaje.texto}</Aviso>}
            <div className="flex flex-wrap justify-end gap-2">
              <Boton
                variante="secundario"
                onClick={() => {
                  setConfirmar(null);
                  setMensaje(null);
                }}
              >
                Cancelar
              </Boton>
              <Boton
                type="submit"
                variante={confirmar.accion === 'nombrar_admin' || confirmar.accion === 'contrasena_temporal' ? 'primario' : 'peligro'}
                cargando={ocupado !== ''}
                disabled={confirmar.accion === 'eliminar' && !correoConfirmado(escrito, enDialogo.correo)}
              >
                {confirmar.accion === 'eliminar' ? 'Eliminar cuenta' : confirmar.accion === 'bloquear' ? 'Bloquear' : confirmar.accion === 'contrasena_temporal' ? 'Dar contraseña temporal' : 'Nombrar administrador'}
              </Boton>
            </div>
          </form>
        )}
      </Dialogo>
    </div>
  );
}
