'use client';

import { KeyRound, Minus, Plus, Radio, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { pedirSemestre } from '@/components/nova/semestre/peticion';
import { MiniGrafico } from '@/components/ui/Anillo';
import { Aviso } from '@/components/ui/Aviso';
import { Boton, CLASE_FOCO } from '@/components/ui/Boton';
import { Contador } from '@/components/ui/Contador';
import { Insignia } from '@/components/ui/Insignia';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { useListo } from '@/components/ui/useListo';
import type { PanelAdministracion as Panel } from '@/lib/datos/administracion';
import {
  estadoAviso,
  fechaHora,
  formatearMb,
  haceCuanto,
  LIMITE_BASE_BYTES,
  LIMITE_BLOB_BYTES,
  margenTopes,
  porcentajeDe,
  resumenCuentas,
  TEXTO_ESTADO_AVISO,
  textoAccion,
  textoVariacion,
} from '@/lib/reglas/cuentas';
import { CuentasAdministracion } from './CuentasAdministracion';
import { ActividadCatorceDias, Medidor } from './GraficosAdministracion';

/**
 * E20c-2 (5.14, prototipo "Administración", B-103 a B-105): resumen, espacio, actividad de 14 días, cuentas, topes,
 * sistema y registro de acciones. Los datos llegan del servidor; cada acción llama a la API y vuelve a pedir la página
 * (router.refresh) para que el resumen y el registro queden al día.
 */

const NUMERO = 'font-display text-4xl leading-none font-extrabold tracking-tight text-texto';

function TarjetaResumen({ titulo, icono: Icono, children, pie }: { titulo: string; icono: LucideIcon; children: ReactNode; pie: ReactNode }) {
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-[20px] border border-borde bg-superficie p-4 shadow-suave sm:p-5">
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-texto-suave">{titulo}</span>
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-acento-suave text-acento">
          <Icono className="size-4" />
        </span>
      </span>
      {children}
      <span className="text-xs text-texto-suave">{pie}</span>
    </li>
  );
}

function Paso({ etiqueta, valor, min, max, paso, alCambiar, deshabilitado }: { etiqueta: string; valor: number; min: number; max: number; paso: number; alCambiar: (v: number) => void; deshabilitado: boolean }) {
  const boton = `inline-flex size-9 items-center justify-center rounded-xl border border-borde bg-superficie text-texto transition-colors hover:border-acento disabled:opacity-50 ${CLASE_FOCO}`;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-texto">{etiqueta}</span>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`Bajar ${etiqueta.toLowerCase()}`} disabled={deshabilitado || valor <= min} onClick={() => alCambiar(Math.max(min, valor - paso))} className={boton}>
          <Minus aria-hidden="true" className="size-4" />
        </button>
        <output aria-live="polite" aria-label={etiqueta} className="w-12 text-center font-display text-lg font-extrabold text-texto tabular-nums">
          {valor}
        </output>
        <button type="button" aria-label={`Subir ${etiqueta.toLowerCase()}`} disabled={deshabilitado || valor >= max} onClick={() => alCambiar(Math.min(max, valor + paso))} className={boton}>
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}

function Topes({ topes, dueno }: { topes: Panel['topes']; dueno: boolean }) {
  const router = useRouter();
  const [cuentas, setCuentas] = useState(topes.cuentas);
  const [mb, setMb] = useState(topes.mb);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [listo, marcarListo] = useListo();
  const margen = margenTopes(cuentas, mb);
  const cambio = cuentas !== topes.cuentas || mb !== topes.mb;

  async function guardar() {
    setGuardando(true);
    setError('');
    const r = await pedirSemestre('/api/nova/administracion', 'PATCH', { cuentas, mb });
    setGuardando(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    marcarListo();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-texto">Topes</h2>
      <Paso etiqueta="Cuentas" valor={cuentas} min={1} max={1000} paso={1} alCambiar={setCuentas} deshabilitado={!dueno} />
      <Paso etiqueta="Espacio por persona (MB)" valor={mb} min={1} max={500} paso={5} alCambiar={setMb} deshabilitado={!dueno} />
      <p role="status" data-margen={margen.pasa ? 'pasa' : 'ok'} className={`text-sm ${margen.pasa ? 'text-aviso' : 'text-texto-suave'}`}>
        {margen.texto}
      </p>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {dueno ? (
        <Boton onClick={guardar} cargando={guardando} listo={listo} textoListo="Guardado" disabled={!cambio} className="self-start">
          Guardar topes
        </Boton>
      ) : (
        <p className="text-xs text-texto-suave">Solo el dueño cambia los topes.</p>
      )}
    </div>
  );
}

export function PanelAdministracion({ panel }: { panel: Panel }) {
  const ahora = new Date(panel.ahora);
  const r = resumenCuentas(panel.cuentas, ahora);
  const aviso = estadoAviso(panel.sistema.ultimoAviso, panel.sistema.erroresDia, ahora);
  const pctBase = porcentajeDe(panel.espacio.baseBytes, LIMITE_BASE_BYTES);
  const pctBlob = panel.espacio.blobBytes === null ? null : porcentajeDe(panel.espacio.blobBytes, LIMITE_BLOB_BYTES);
  const dueno = panel.yo.nivel === 'dueno';
  const tonoAviso = aviso === 'funciona' ? 'exito' : aviso === 'errores' ? 'aviso' : 'peligro';

  return (
    <div className="flex flex-col gap-6" data-panel-administracion>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-xs tracking-[0.12em] text-texto-suave uppercase">Administración · solo la ven los administradores</p>
          <h1 className="font-display text-[2rem] leading-tight font-extrabold tracking-tight text-texto sm:text-4xl">Administración</h1>
        </div>
        <p className="inline-flex items-center gap-2 self-start rounded-full border border-borde bg-superficie px-3 py-1.5 text-sm text-texto sm:self-auto" data-estado-aviso={aviso}>
          <span aria-hidden="true" className={`size-2.5 rounded-full ${aviso === 'funciona' ? 'nova-punto-vivo bg-exito' : aviso === 'errores' ? 'bg-aviso' : 'bg-peligro'}`} />
          {aviso === 'funciona' ? 'Recordatorios al día' : aviso === 'errores' ? 'Recordatorios con errores' : 'Recordatorios detenidos'} · último aviso {haceCuanto(panel.sistema.ultimoAviso, ahora)}
        </p>
      </header>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen">
        <TarjetaResumen titulo="Cuentas" icono={Users} pie={`${r.administradores} ${r.administradores === 1 ? 'administrador aparte' : 'administradores aparte'}${r.pendientes ? ` · ${r.pendientes} ${r.pendientes === 1 ? 'pendiente' : 'pendientes'}` : ''}`}>
          <span className={NUMERO}>
            <Contador valor={r.usuarios} />
            <span className="text-lg text-texto-suave"> / {panel.topes.cuentas}</span>
          </span>
          <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-superficie-2">
            <span className="block h-full bg-acento" style={{ width: `${Math.min(100, (r.usuarios / Math.max(1, panel.topes.cuentas)) * 100)}%` }} />
          </span>
        </TarjetaResumen>
        <TarjetaResumen titulo="Activas · 7 días" icono={Radio} pie={`de ${r.usuarios} ${r.usuarios === 1 ? 'cuenta' : 'cuentas'}, por su último acceso`}>
          <span className={NUMERO}>
            <Contador valor={r.activas7} />
          </span>
        </TarjetaResumen>
        <TarjetaResumen titulo="Nuevas esta semana" icono={UserPlus} pie={`${textoVariacion(r.nuevas, r.nuevasAntes)} frente a la semana pasada`}>
          <span className="flex items-end justify-between gap-2">
            <span className={NUMERO}>
              <Contador valor={r.nuevas} />
            </span>
            <MiniGrafico valores={r.nuevasPorDia} max={Math.max(1, ...r.nuevasPorDia)} etiqueta="nuevas" />
          </span>
        </TarjetaResumen>
        <TarjetaResumen titulo="Con clave de Gemini" icono={KeyRound} pie={`${r.usuarios - r.conClave} sin clave: no usan IA`}>
          <span className={NUMERO}>
            <Contador valor={r.conClave} />
            <span className="text-lg text-texto-suave"> / {r.usuarios}</span>
          </span>
        </TarjetaResumen>
      </ul>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <Tarjeta className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-texto">Espacio</h2>
          <Medidor que="base" porcentaje={pctBase} titulo="Base de datos" detalle={`${formatearMb(panel.espacio.baseBytes)} MB de 500 MB`} />
          <Medidor
            que="blob"
            porcentaje={pctBlob}
            titulo="Archivos PDF (Blob)"
            detalle={panel.espacio.blobBytes === null ? 'No se pudo medir ahora.' : `${formatearMb(panel.espacio.blobBytes)} MB de 1 GB`}
          />
          <p className="text-xs text-texto-suave">Si la base no alcanza, el siguiente paso es Supabase Pro: 25 USD al mes, 8 GB.</p>
        </Tarjeta>
        <Tarjeta>
          <ActividadCatorceDias dias={panel.actividad.dias} series={{ Preguntas: panel.actividad.preguntas, Registros: panel.actividad.registros, Documentos: panel.actividad.documentos }} />
        </Tarjeta>
      </div>

      <Tarjeta>
        <CuentasAdministracion cuentas={panel.cuentas} yo={panel.yo} topeMb={panel.topes.mb} ahora={panel.ahora} />
      </Tarjeta>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-3">
        <Tarjeta>
          <Topes key={`${panel.topes.cuentas}-${panel.topes.mb}`} topes={panel.topes} dueno={dueno} />
        </Tarjeta>
        <Tarjeta className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-texto">Sistema</h2>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-texto">Aviso de cada minuto</span>
            <Insignia tono={tonoAviso}>{TEXTO_ESTADO_AVISO[aviso]}</Insignia>
          </div>
          <p className="text-xs text-texto-suave" data-sistema-aviso>
            Última ejecución {haceCuanto(panel.sistema.ultimoAviso, ahora)} · {panel.sistema.erroresDia} {panel.sistema.erroresDia === 1 ? 'error' : 'errores'} en 24 h.
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-texto">Limpieza del registro</span>
            <Insignia>{panel.sistema.ultimaLimpieza ? fechaHora(panel.sistema.ultimaLimpieza) : 'Aún no corre'}</Insignia>
          </div>
          <p className="text-xs text-texto-suave">
            {panel.sistema.ultimaLimpieza
              ? `Borró ${panel.sistema.filasLimpiadas ?? 0} registros de más de 7 días.`
              : 'Corre cada día a las 3:00 a. m. y borra los registros de más de 7 días.'}
          </p>
        </Tarjeta>
        <Tarjeta className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-texto">Registro de acciones</h2>
          {panel.registro.length === 0 ? (
            <p className="text-sm text-texto-suave">Aún no hay acciones.</p>
          ) : (
            <ul className="flex flex-col" data-registro-acciones>
              {panel.registro.map((a) => (
                <li key={a.id} className="flex flex-col gap-0.5 border-t border-borde py-2 text-sm first:border-t-0">
                  <time dateTime={a.fecha} className="font-mono text-[11px] text-texto-suave">
                    {fechaHora(a.fecha)}
                  </time>
                  <span className="break-words text-texto">{textoAccion(a.admin, a.accion, a.correo, a.detalle)}</span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}
