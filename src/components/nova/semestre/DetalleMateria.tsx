'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { EliminarConConfirmacion } from '@/components/nova/EliminarConConfirmacion';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Tarjeta } from '@/components/ui/Tarjeta';
import type { ComponenteMateria, CorteMateria, Materia, NotaRegistrada } from '@/lib/dataService';
import { formatearFecha } from '@/lib/formato';
import { aplicarMascaraFecha, esFechaISOValida } from '@/lib/reglas/fechas';
import {
  AYUDA_SIN_NOTA,
  avisoCortes,
  avisoDeComponentes,
  MAX_CORTES_MATERIA,
  MAX_NOMBRE_COMPONENTE,
  MAX_NOMBRE_CORTE,
  MAX_NOMBRE_NOTA,
  validarNombreComponente,
  validarNombreCorte,
  validarNombreNota,
  validarNota,
  validarPorcentaje,
} from '@/lib/reglas/notas';
import { MENSAJES } from '@/lib/reglas/errores';
import { aCentesimas, formatearNota, formatearPorcentaje } from '@/lib/reglas/preferencias';
import { ConDialogo } from './ConDialogo';
import { FormularioMateria } from './FormularioMateria';
import { mensajeDe, pedirSemestre, type Resultado } from './peticion';

const AYUDA_FECHA = 'Opcional. Formato AAAA-MM-DD; los guiones se ponen solos.';
const mensajeFecha = (f: string) => (f.trim() && !esFechaISOValida(f.trim()) ? MENSAJES.FECHA_INVALIDA : '');
const porcentajeAEdicion = (c: number) => formatearPorcentaje(c);
const notaAEdicion = (c: number | null) => (c === null ? '' : formatearNota(c));

/** El error de un pedido, o refrescar la página con los datos nuevos y cerrar. */
function useGuardar() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function guardar(pedido: () => Promise<Resultado<unknown>>, alTerminar?: () => void): Promise<boolean> {
    setError('');
    setEnviando(true);
    const r = await pedido();
    setEnviando(false);
    if (!r.ok) {
      setError(r.mensaje);
      return false;
    }
    alTerminar?.();
    router.refresh();
    return true;
  }
  return { guardar, error, enviando };
}

// ---------- Componentes ----------

function FormularioComponente({ componente, corteId, cerrar }: { componente?: ComponenteMateria; corteId: string; cerrar: () => void }) {
  const [nombre, setNombre] = useState(componente?.nombre ?? '');
  const [porcentaje, setPorcentaje] = useState(componente ? porcentajeAEdicion(componente.porcentaje) : '');
  const [errores, setErrores] = useState<{ nombre?: string; porcentaje?: string }>({});
  const { guardar, error, enviando } = useGuardar();

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const nuevos = { nombre: mensajeDe(() => validarNombreComponente(nombre)), porcentaje: mensajeDe(() => validarPorcentaje(porcentaje)) };
    setErrores(nuevos);
    if (nuevos.nombre || nuevos.porcentaje) return;
    const cuerpo = { nombre, porcentaje };
    void guardar(() => (componente ? pedirSemestre(`/api/nova/componentes/${componente.id}`, 'PATCH', cuerpo) : pedirSemestre(`/api/nova/cortes/${corteId}/componentes`, 'POST', cuerpo)), cerrar);
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <Campo id="componente-nombre" etiqueta="Nombre" placeholder="Parcial, Talleres, Quizzes…" value={nombre} maxLength={MAX_NOMBRE_COMPONENTE} onChange={(e) => setNombre(e.target.value)} error={errores.nombre} autoComplete="off" />
      <Campo
        id="componente-porcentaje"
        etiqueta="Porcentaje (%)"
        value={porcentaje}
        inputMode="decimal"
        maxLength={6}
        onChange={(e) => setPorcentaje(e.target.value)}
        error={errores.porcentaje}
        ayuda="Mayor que 0 y hasta 100, con hasta dos decimales. Sus notas se promedian por igual."
      />
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div>
        <Boton type="submit" cargando={enviando} disabled={enviando}>
          {componente ? 'Guardar cambios' : 'Agregar componente'}
        </Boton>
      </div>
    </form>
  );
}

function FormularioNota({ nota, componenteId, cerrar }: { nota?: NotaRegistrada; componenteId: string; cerrar: () => void }) {
  const [nombre, setNombre] = useState(nota?.nombre ?? '');
  const [sinNota, setSinNota] = useState(nota ? nota.nota === null : false);
  const [valor, setValor] = useState(notaAEdicion(nota?.nota ?? null));
  const [fecha, setFecha] = useState(nota?.fecha ?? '');
  const [errores, setErrores] = useState<{ nombre?: string; nota?: string; fecha?: string }>({});
  const { guardar, error, enviando } = useGuardar();

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const nuevos = {
      nombre: mensajeDe(() => validarNombreNota(nombre)),
      // Sin marcar "Sin nota", la nota es obligatoria (RB-09).
      nota: sinNota ? '' : valor.trim() ? mensajeDe(() => validarNota(valor)) : MENSAJES.NOTA_INVALIDA,
      fecha: mensajeFecha(fecha),
    };
    setErrores(nuevos);
    if (nuevos.nombre || nuevos.nota || nuevos.fecha) return;
    const cuerpo = { nombre: nombre.trim() || null, nota: sinNota ? null : valor, fecha: fecha.trim() || null };
    void guardar(() => (nota ? pedirSemestre(`/api/nova/notas/${nota.id}`, 'PATCH', cuerpo) : pedirSemestre(`/api/nova/componentes/${componenteId}/notas`, 'POST', cuerpo)), cerrar);
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <Campo id="nota-nombre" etiqueta="Nombre (opcional)" placeholder="Quiz 1" value={nombre} maxLength={MAX_NOMBRE_NOTA} onChange={(e) => setNombre(e.target.value)} error={errores.nombre} autoComplete="off" />
      <label className="flex min-h-10 items-center gap-2 text-sm text-texto">
        <input type="checkbox" checked={sinNota} onChange={(e) => setSinNota(e.target.checked)} className="size-5 accent-acento" />
        Sin nota (aún no la tengo)
      </label>
      {!sinNota && (
        <Campo id="nota-valor" etiqueta="Nota" value={valor} inputMode="decimal" maxLength={4} onChange={(e) => setValor(e.target.value)} error={errores.nota} ayuda="De 0,0 a 5,0, con hasta dos decimales." />
      )}
      <Campo
        id="nota-fecha"
        etiqueta="Fecha (opcional)"
        value={fecha}
        placeholder="AAAA-MM-DD"
        inputMode="numeric"
        maxLength={10}
        onChange={(e) => setFecha(aplicarMascaraFecha(e.target.value))}
        error={errores.fecha}
        ayuda={AYUDA_FECHA}
        autoComplete="off"
      />
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div>
        <Boton type="submit" cargando={enviando} disabled={enviando}>
          {nota ? 'Guardar cambios' : 'Agregar nota'}
        </Boton>
      </div>
    </form>
  );
}

function FilaNota({ nota, indice, componente }: { nota: NotaRegistrada; indice: number; componente: string }) {
  const nombre = nota.nombre ?? `Nota ${indice + 1}`;
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm">
        <span className="break-words text-texto">{nombre}</span>
        {nota.nota === null ? (
          <span className="rounded-full bg-superficie-2 px-2 py-0.5 text-xs font-semibold text-texto-suave">Sin nota</span>
        ) : (
          <span className="font-semibold text-texto tabular-nums">{formatearNota(nota.nota)}</span>
        )}
        {nota.fecha && <span className="text-xs text-texto-suave">{formatearFecha(nota.fecha)}</span>}
      </span>
      <span className="flex items-center gap-1">
        <ConDialogo boton="Editar" variante="fantasma" className="min-h-9 py-1.5" etiqueta={`Editar ${nombre} de ${componente}`} titulo={`Editar ${nombre}`}>
          {(cerrar) => <FormularioNota nota={nota} componenteId="" cerrar={cerrar} />}
        </ConDialogo>
        <EliminarConConfirmacion ruta={`/api/nova/notas/${nota.id}`} etiqueta={`Eliminar ${nombre} de ${componente}`} pregunta={`¿Eliminar ${nombre}?`} />
      </span>
    </li>
  );
}

function BloqueComponente({ componente, corteId }: { componente: ComponenteMateria; corteId: string }) {
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-borde p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="min-w-0 break-words text-base font-semibold text-texto">
          {componente.nombre} <span className="font-normal text-texto-suave">· {formatearPorcentaje(componente.porcentaje)} %</span>
        </h4>
        <span className="flex items-center gap-1">
          <ConDialogo boton="Editar" variante="fantasma" className="min-h-9 py-1.5" etiqueta={`Editar el componente ${componente.nombre}`} titulo={`Editar ${componente.nombre}`}>
            {(cerrar) => <FormularioComponente componente={componente} corteId={corteId} cerrar={cerrar} />}
          </ConDialogo>
          <EliminarConConfirmacion
            ruta={`/api/nova/componentes/${componente.id}`}
            etiqueta={`Eliminar el componente ${componente.nombre}`}
            pregunta={`¿Eliminar ${componente.nombre} y sus ${componente.notas.length} notas?`}
          />
        </span>
      </div>
      {componente.notas.length === 0 ? (
        <p className="text-sm text-texto-suave">Sin notas registradas: todo su porcentaje cuenta como pendiente.</p>
      ) : (
        <ul aria-label={`Notas de ${componente.nombre}`} className="flex flex-col divide-y divide-borde">
          {componente.notas.map((n, i) => (
            <FilaNota key={n.id} nota={n} indice={i} componente={componente.nombre} />
          ))}
        </ul>
      )}
      <div>
        <ConDialogo
          boton={
            <>
              <Plus aria-hidden="true" className="size-4" />
              Agregar nota
            </>
          }
          variante="fantasma"
          className="min-h-9 py-1.5"
          etiqueta={`Agregar nota a ${componente.nombre}`}
          titulo={`Nueva nota de ${componente.nombre}`}
          descripcion={AYUDA_SIN_NOTA}
        >
          {(cerrar) => <FormularioNota componenteId={componente.id} cerrar={cerrar} />}
        </ConDialogo>
      </div>
    </li>
  );
}

/** Los componentes de un corte (o de la materia sin cortes), con el aviso RB-08 si no suman 100 %. */
function Componentes({ corte, usaCortes }: { corte: CorteMateria; usaCortes: boolean }) {
  const aviso = avisoDeComponentes({ nombre: corte.nombre, porcentaje: corte.porcentaje, componentes: corte.componentes.map((c) => ({ ...c, notas: c.notas.map((n) => n.nota) })) }, usaCortes);
  return (
    <div className="flex flex-col gap-3">
      {aviso && <Aviso tipo="advertencia">{aviso}</Aviso>}
      {corte.componentes.length === 0 ? (
        <p className="text-sm text-texto-suave">Aún no hay componentes. Agrega los de tu syllabus, por ejemplo Parcial 40 % y Talleres 20 %.</p>
      ) : (
        <ul aria-label={usaCortes ? `Componentes de ${corte.nombre}` : 'Componentes de evaluación'} className="flex flex-col gap-3">
          {corte.componentes.map((c) => (
            <BloqueComponente key={c.id} componente={c} corteId={corte.id} />
          ))}
        </ul>
      )}
      <div>
        <ConDialogo
          boton={
            <>
              <Plus aria-hidden="true" className="size-4" />
              Agregar componente
            </>
          }
          etiqueta={usaCortes ? `Agregar componente a ${corte.nombre}` : 'Agregar componente'}
          titulo={usaCortes ? `Nuevo componente de ${corte.nombre}` : 'Nuevo componente'}
        >
          {(cerrar) => <FormularioComponente corteId={corte.id} cerrar={cerrar} />}
        </ConDialogo>
      </div>
    </div>
  );
}

// ---------- Cortes ----------

interface FilaCorte {
  clave: string;
  id?: string | undefined;
  nombre: string;
  porcentaje: string;
  fecha: string;
  componentes: number;
}

/** 6.4 (RB-07): los cortes en bloque. Quitar uno con componentes avisa que se borran al guardar. */
function EditorCortes({ materia }: { materia: Materia }) {
  const [filas, setFilas] = useState<FilaCorte[]>(() =>
    materia.cortes.map((c) => ({ clave: c.id, id: c.id, nombre: c.nombre, porcentaje: porcentajeAEdicion(c.porcentaje), fecha: c.fecha ?? '', componentes: c.componentes.length })),
  );
  const [errores, setErrores] = useState<Record<string, string>>({});
  const { guardar, error, enviando } = useGuardar();
  const quitar = useGuardar();
  const borrados = materia.cortes.filter((c) => c.componentes.length > 0 && !filas.some((f) => f.id === c.id));
  const suma = filas.reduce((s, f) => s + (aCentesimas(f.porcentaje) ?? 0), 0);

  const cambiar = (clave: string, campo: 'nombre' | 'porcentaje' | 'fecha', valor: string) => setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)));

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const nuevos: Record<string, string> = {};
    for (const f of filas) {
      const m = mensajeDe(() => validarNombreCorte(f.nombre)) || mensajeDe(() => validarPorcentaje(f.porcentaje)) || mensajeFecha(f.fecha);
      if (m) nuevos[f.clave] = m;
    }
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;
    void guardar(() =>
      pedirSemestre(`/api/nova/materias/${materia.id}/cortes`, 'PUT', {
        cortes: filas.map((f) => ({ ...(f.id ? { id: f.id } : {}), nombre: f.nombre, porcentaje: f.porcentaje, fecha: f.fecha.trim() || null })),
      }),
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      {suma !== 10000 && <Aviso tipo="advertencia">{avisoCortes(suma)}</Aviso>}
      <ul aria-label="Cortes" className="flex flex-col gap-3">
        {filas.map((f, i) => (
          <li key={f.clave} className="grid grid-cols-2 gap-3 rounded-xl border border-borde p-3 sm:grid-cols-[1fr_8rem_10rem_auto] sm:items-start">
            <div className="col-span-2 sm:col-span-1">
              <Campo id={`corte-nombre-${f.clave}`} etiqueta={`Nombre del corte ${i + 1}`} value={f.nombre} maxLength={MAX_NOMBRE_CORTE} onChange={(e) => cambiar(f.clave, 'nombre', e.target.value)} />
            </div>
            <Campo id={`corte-porcentaje-${f.clave}`} etiqueta="Porcentaje (%)" value={f.porcentaje} inputMode="decimal" maxLength={6} onChange={(e) => cambiar(f.clave, 'porcentaje', e.target.value)} />
            <Campo
              id={`corte-fecha-${f.clave}`}
              etiqueta="Fecha (opcional)"
              value={f.fecha}
              placeholder="AAAA-MM-DD"
              inputMode="numeric"
              maxLength={10}
              onChange={(e) => cambiar(f.clave, 'fecha', aplicarMascaraFecha(e.target.value))}
              autoComplete="off"
            />
            <div className="col-span-2 flex items-end sm:col-span-1 sm:pt-7">
              <Boton
                variante="fantasma"
                className="min-h-10 text-peligro hover:bg-peligro/10"
                aria-label={`Quitar ${f.nombre || `el corte ${i + 1}`}`}
                disabled={filas.length === 1}
                onClick={() => setFilas((fs) => fs.filter((x) => x.clave !== f.clave))}
              >
                <Trash2 aria-hidden="true" className="size-4" />
                Quitar
              </Boton>
            </div>
            {errores[f.clave] && (
              <p className="col-span-2 text-xs font-medium text-peligro sm:col-span-4" role="alert">
                {errores[f.clave]}
              </p>
            )}
          </li>
        ))}
      </ul>
      {borrados.length > 0 && (
        <Aviso tipo="advertencia">Al guardar se borrarán {borrados.map((c) => c.nombre).join(', ')} con sus componentes y notas.</Aviso>
      )}
      {error && <Aviso tipo="error">{error}</Aviso>}
      {quitar.error && <Aviso tipo="error">{quitar.error}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <Boton type="submit" cargando={enviando} disabled={enviando}>
          Guardar cortes
        </Boton>
        <Boton
          variante="secundario"
          disabled={filas.length >= MAX_CORTES_MATERIA}
          onClick={() =>
            setFilas((fs) => [...fs, { clave: `nuevo-${Date.now()}`, nombre: `Corte ${fs.length + 1}`, porcentaje: '', fecha: '', componentes: 0 }])
          }
        >
          <Plus aria-hidden="true" className="size-4" />
          Agregar corte
        </Boton>
        <Boton variante="fantasma" cargando={quitar.enviando} disabled={quitar.enviando} onClick={() => void quitar.guardar(() => pedirSemestre(`/api/nova/materias/${materia.id}/cortes`, 'POST', { accion: 'quitar' }))}>
          Quitar cortes
        </Boton>
      </div>
      <p className="text-xs text-texto-suave">Para quitar los cortes deja uno solo y guarda; sus componentes pasan a ser los de la materia.</p>
    </form>
  );
}

/** Materia sin cortes: la fecha de su corte único es la "Fecha final de la materia". */
function FechaFinal({ materia }: { materia: Materia }) {
  const corte = materia.cortes[0] as CorteMateria;
  const [fecha, setFecha] = useState(corte.fecha ?? '');
  const [errorCampo, setErrorCampo] = useState('');
  const { guardar, error, enviando } = useGuardar();
  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const m = mensajeFecha(fecha);
    setErrorCampo(m);
    if (m) return;
    void guardar(() => pedirSemestre(`/api/nova/materias/${materia.id}/cortes`, 'PUT', { cortes: [{ id: corte.id, nombre: corte.nombre, porcentaje: corte.porcentaje, fecha: fecha.trim() || null }] }));
  }
  return (
    <form onSubmit={enviar} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
      <div className="sm:w-56">
        <Campo
          id="fecha-final"
          etiqueta="Fecha final de la materia"
          value={fecha}
          placeholder="AAAA-MM-DD"
          inputMode="numeric"
          maxLength={10}
          onChange={(e) => setFecha(aplicarMascaraFecha(e.target.value))}
          error={errorCampo}
          autoComplete="off"
        />
      </div>
      <div>
        <Boton type="submit" variante="secundario" cargando={enviando} disabled={enviando}>
          Guardar fecha
        </Boton>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
    </form>
  );
}

function EliminarMateria({ materia }: { materia: Materia }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  async function eliminar() {
    setEnviando(true);
    const r = await pedirSemestre(`/api/nova/materias/${materia.id}`, 'DELETE');
    if (!r.ok) {
      setEnviando(false);
      setError(r.mensaje);
      return;
    }
    router.push('/nova/semestre');
    router.refresh();
  }
  if (!confirmando) {
    return (
      <Boton variante="fantasma" className="text-peligro hover:bg-peligro/10" onClick={() => setConfirmando(true)}>
        <Trash2 aria-hidden="true" className="size-4" />
        Eliminar materia
      </Boton>
    );
  }
  return (
    <div role="group" aria-label="Confirmar eliminación" className="flex flex-col gap-2">
      <p className="text-sm text-texto">¿Eliminar {materia.nombre} con sus cortes, componentes y notas? Sus documentos y su categoría de tareas se conservan.</p>
      <div className="flex flex-wrap gap-2">
        <Boton variante="peligro" cargando={enviando} onClick={() => void eliminar()}>
          Sí, eliminar
        </Boton>
        <Boton variante="fantasma" disabled={enviando} onClick={() => setConfirmando(false)}>
          Cancelar
        </Boton>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
    </div>
  );
}

/** E12 (5.7, 6.4): una materia con sus cortes (si los usa), componentes de evaluación y notas. */
export function DetalleMateria({ materia, plantilla }: { materia: Materia; plantilla: readonly number[] }) {
  const router = useRouter();
  const dividir = useGuardar();
  const corteUnico = materia.cortes[0];
  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-start gap-2">
        <ConDialogo boton="Editar materia" titulo="Editar materia">
          {(cerrar) => (
            <FormularioMateria
              materia={materia}
              alTerminar={() => {
                cerrar();
                router.refresh();
              }}
            />
          )}
        </ConDialogo>
        <EliminarMateria materia={materia} />
      </div>

      {!materia.usaCortes && corteUnico ? (
        <>
          <Tarjeta className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-texto">Componentes de evaluación</h2>
              <p className="text-sm text-texto-suave">{AYUDA_SIN_NOTA}</p>
            </div>
            <Componentes corte={corteUnico} usaCortes={false} />
          </Tarjeta>
          <Tarjeta className="flex flex-col gap-4">
            <FechaFinal materia={materia} />
            <div className="flex flex-col items-start gap-2 border-t border-borde pt-4">
              <p className="text-sm text-texto-suave">
                ¿La materia tiene cortes? Al dividirla, lo que ya registraste pasa al Corte 1 y se agregan los demás según Configuración (
                {plantilla.map((p) => `${formatearPorcentaje(p)} %`).join(' + ')}).
              </p>
              <Boton variante="secundario" cargando={dividir.enviando} disabled={dividir.enviando} onClick={() => void dividir.guardar(() => pedirSemestre(`/api/nova/materias/${materia.id}/cortes`, 'POST', { accion: 'dividir' }))}>
                Dividir en cortes
              </Boton>
              {dividir.error && <Aviso tipo="error">{dividir.error}</Aviso>}
            </div>
          </Tarjeta>
        </>
      ) : (
        <>
          <Tarjeta className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-texto">Cortes</h2>
            <EditorCortes key={materia.cortes.map((c) => `${c.id}:${c.nombre}:${c.porcentaje}:${c.fecha}`).join('|')} materia={materia} />
          </Tarjeta>
          {materia.cortes.map((corte) => (
            <Tarjeta key={corte.id} className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold text-texto">
                  {corte.nombre} <span className="font-normal text-texto-suave">· {formatearPorcentaje(corte.porcentaje)} %</span>
                </h2>
                {corte.fecha && <p className="text-sm text-texto-suave">Fecha: {formatearFecha(corte.fecha)}</p>}
                <p className="text-sm text-texto-suave">{AYUDA_SIN_NOTA}</p>
              </div>
              <Componentes corte={corte} usaCortes />
            </Tarjeta>
          ))}
        </>
      )}
    </div>
  );
}
