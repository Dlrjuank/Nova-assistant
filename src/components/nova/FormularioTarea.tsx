'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Selector } from '@/components/ui/Selector';
import { SelectorCategoria } from '@/components/nova/SelectorCategoria';
import { CATEGORIA_POR_DEFECTO, PRIORIDAD_POR_DEFECTO } from '@/lib/config/nova';
import { ErrorDeNegocio, MENSAJES } from '@/lib/reglas/errores';
import { aplicarMascaraFecha, esFechaISOValida, esFechaPasada, hoyBogota } from '@/lib/reglas/fechas';
import { validarHorario } from '@/lib/reglas/horario';
import { normalizarTitulo, resolverPrioridad } from '@/lib/reglas/tarea';
import { PanelNotificaciones } from '@/components/nova/PanelNotificaciones';
import { useFormatoHora, useHoraRecordatorio } from '@/components/nova/PreferenciasNova';
import { usePendientes } from '@/components/nova/pendientes/ProveedorPendientes';
import { esFallaDeRed } from '@/lib/reglas/sinConexion';
import {
  cabeOtraPendiente,
  GUARDADA_EN_DISPOSITIVO,
  textoRecordatorioPasado,
  TOPE_PENDIENTES,
  validarPendiente,
  type DatosPendiente,
} from '@/lib/reglas/tareasPendientes';
import { almacenDispositivo, listarPendientes, obtenerPendiente } from '@/lib/tareasPendientes';
import { cargarPagina } from '@/lib/cargarPagina';
import {
  AVISO_MOMENTO_PASADO,
  esRecordatorio,
  estadoInicial,
  momentoRecordatorio,
  opcionesRecordatorio,
  recordatorioCompatible,
  type Recordatorio,
} from '@/lib/reglas/recordatorios';

type Campos = 'titulo' | 'prioridad' | 'fechaLimite' | 'horaInicio' | 'horaFin';
interface Valores {
  titulo: string;
  categoria: string;
  prioridad: string;
  fechaLimite: string;
  horaInicio: string;
  horaFin: string;
  /** E11c (RB-43): '' = sin recordatorio. */
  recordatorio: Recordatorio | '';
}

/** RB-43: ¿el recordatorio elegido ya pasó? Solo con la fecha (y la hora, si hay horario) bien escritas. */
function recordatorioPasado(v: Valores, recordatorio: Recordatorio | '', horaFija: string): boolean {
  if (!recordatorio || !esFechaISOValida(v.fechaLimite) || (v.horaInicio && !esHoraValida(v.horaInicio))) return false;
  const momento = momentoRecordatorio({ recordatorio, fechaLimite: v.fechaLimite, horaInicio: v.horaInicio || null, horaFija });
  return estadoInicial(momento, new Date()) === 'omitido';
}

const OPCIONES_PRIORIDAD = [
  { valor: '1', texto: '1 · Baja' },
  { valor: '2', texto: '2 · Media' },
  { valor: '3', texto: '3 · Alta' },
];

function esHoraValida(hora: string): boolean {
  try {
    validarHorario(hora, null);
    return true;
  } catch {
    return false;
  }
}

/** Mismas reglas que el servidor (lib/reglas), con los mensajes exactos de la sección 5.1. */
function validar(v: Valores): Partial<Record<Campos, string>> {
  const errores: Partial<Record<Campos, string>> = {};
  if (normalizarTitulo(v.titulo) === '') errores.titulo = 'El título es obligatorio.';
  if (!esFechaISOValida(v.fechaLimite)) errores.fechaLimite = MENSAJES.FECHA_INVALIDA;
  try {
    resolverPrioridad(Number(v.prioridad));
  } catch (error) {
    if (error instanceof ErrorDeNegocio) errores.prioridad = error.message;
  }
  // RB-34: las mismas reglas que el servidor; el error va en el campo que hay que corregir.
  try {
    validarHorario(v.horaInicio, v.horaFin);
  } catch (error) {
    if (error instanceof ErrorDeNegocio) {
      // Una hora mal escrita se marca en su propio campo; los demás errores del horario, en "Hasta".
      const inicioMalo = error.codigo === 'HORA_INVALIDA' && !esHoraValida(v.horaInicio);
      errores[inicioMalo ? 'horaInicio' : 'horaFin'] = error.message;
    }
  }
  return errores;
}

/**
 * `fechaInicial`: la que trae `?fecha=` desde Inicio o el Calendario (ya validada por la página).
 * `categorias`: las del usuario, para la lista del campo de categoría (E08).
 * `tarea`: modo edición (E09), con el formulario lleno; `volver` es la pantalla a la que regresa.
 */
export function FormularioTarea({
  fechaInicial = '',
  categorias = [],
  tarea,
  volver = '/nova/tareas',
}: {
  fechaInicial?: string;
  categorias?: ReadonlyArray<{ nombre: string; color: string }>;
  tarea?: {
    id: string;
    titulo: string;
    categoria: string;
    prioridad: number;
    fechaLimite: string;
    horaInicio?: string | null;
    horaFin?: string | null;
    recordatorio?: string | null;
  };
  volver?: string;
} = {}) {
  const router = useRouter();
  const formatoHora = useFormatoHora();
  const horaFija = useHoraRecordatorio();
  const [valores, setValores] = useState<Valores>({
    titulo: tarea?.titulo ?? '',
    categoria: tarea?.categoria ?? CATEGORIA_POR_DEFECTO,
    prioridad: String(tarea?.prioridad ?? PRIORIDAD_POR_DEFECTO),
    fechaLimite: tarea?.fechaLimite ?? fechaInicial,
    horaInicio: tarea?.horaInicio ?? '',
    horaFin: tarea?.horaFin ?? '',
    recordatorio: esRecordatorio(tarea?.recordatorio) ? tarea.recordatorio : '',
  });
  // Sin hora de inicio, "15 min" y "1 hora" no existen: el campo vuelve a "Sin recordatorio".
  const conHorario = valores.horaInicio !== '';
  const recordatorio = recordatorioCompatible(valores.recordatorio, conHorario);
  const opcionesRecordatorioCampo = [
    { valor: '', texto: 'Sin recordatorio' },
    ...opcionesRecordatorio(conHorario, horaFija, formatoHora).map((o) => ({ valor: o.valor, texto: o.texto })),
  ];
  const { usuarioId, avisar } = usePendientes();
  // E11e (7.14): cada tarea nueva lleva un identificador del dispositivo. Si el pedido se corta después de que el
  // servidor la guardó, el reintento desde el dispositivo no la duplica. Al "Corregir" (RB-74) es el de la pendiente.
  const [idCliente, setIdCliente] = useState(() => (tarea ? '' : crypto.randomUUID()));
  const [corrigiendo, setCorrigiendo] = useState(false);

  useEffect(() => {
    if (tarea) return;
    const parametros = new URLSearchParams(window.location.search);
    // Sin conexión, la página sale de la copia guardada sin ?fecha=: se lee aquí.
    const fecha = parametros.get('fecha');
    if (!fechaInicial && fecha && esFechaISOValida(fecha)) setValores((previo) => (previo.fechaLimite ? previo : { ...previo, fechaLimite: fecha }));
    const corregir = parametros.get('corregir');
    if (!corregir || !usuarioId) return;
    let vivo = true;
    obtenerPendiente(corregir, usuarioId)
      .then((t) => {
        if (!vivo || !t) return;
        setIdCliente(t.idCliente);
        setCorrigiendo(true);
        setValores({
          titulo: t.datos.titulo,
          categoria: t.datos.categoria,
          prioridad: String(t.datos.prioridad),
          fechaLimite: t.datos.fechaLimite,
          horaInicio: t.datos.horaInicio ?? '',
          horaFin: t.datos.horaFin ?? '',
          recordatorio: esRecordatorio(t.datos.recordatorio) ? t.datos.recordatorio : '',
        });
        if (t.error) setErrorServidor(t.error);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [tarea, fechaInicial, usuarioId]);

  const [tocados, setTocados] = useState<Partial<Record<Campos, boolean>>>({});
  const [enviando, setEnviando] = useState(false);
  const [errorServidor, setErrorServidor] = useState('');

  const errores = validar(valores);
  const visible = (campo: Campos) => (tocados[campo] ? errores[campo] : undefined);
  const cambiar = (campo: keyof Valores) => (e: { target: { value: string } }) => {
    setValores((previo) => ({ ...previo, [campo]: e.target.value }));
  };
  const tocar = (campo: Campos) => () => setTocados((previo) => ({ ...previo, [campo]: true }));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErrorServidor('');
    setTocados({ titulo: true, prioridad: true, fechaLimite: true, horaInicio: true, horaFin: true });
    if (Object.keys(errores).length > 0) return;

    const datos: DatosPendiente = {
      titulo: normalizarTitulo(valores.titulo),
      categoria: valores.categoria.trim() || CATEGORIA_POR_DEFECTO,
      prioridad: Number(valores.prioridad),
      fechaLimite: valores.fechaLimite,
      horaInicio: valores.horaInicio || null,
      horaFin: valores.horaFin || null,
      recordatorio: recordatorio || null,
    };
    setEnviando(true);
    try {
      // E11e (RB-70): sin conexión, solo crear se guarda en el dispositivo.
      if (!tarea && typeof navigator !== 'undefined' && !navigator.onLine) {
        await guardarEnDispositivo(datos);
        return;
      }
      const respuesta = await fetch(tarea ? `/api/nova/tareas/${tarea.id}` : '/api/nova/tareas', {
        method: tarea ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tarea ? datos : { ...datos, idCliente }),
      });
      const cuerpo = (await respuesta.json()) as { ok: boolean; datos?: { recordatorioEstado?: string | null }; error?: { mensaje?: string } };
      if (!respuesta.ok || !cuerpo.ok) {
        setErrorServidor(cuerpo.error?.mensaje ?? MENSAJES.ERROR_INTERNO);
        return;
      }
      if (corrigiendo) {
        // RB-74: corregida y enviada; ya no queda en el dispositivo. RB-73 si su recordatorio ya pasó.
        await almacenDispositivo.borrar(idCliente).catch(() => undefined);
        if (datos.recordatorio && cuerpo.datos?.recordatorioEstado === 'omitido') avisar(textoRecordatorioPasado(datos.titulo));
      }
      router.push(volver);
      router.refresh();
    } catch (error) {
      // E11e: si el pedido falló por la red, la tarea nueva queda en el dispositivo con el mismo idCliente.
      if (!tarea && esFallaDeRed(error)) await guardarEnDispositivo(datos);
      else setErrorServidor('No se pudo conectar con el servidor. Intente de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  /** RB-70: la tarea queda en el dispositivo, a nombre del usuario, y se vuelve a la pantalla anterior. */
  async function guardarEnDispositivo(datos: DatosPendiente) {
    try {
      validarPendiente(datos);
    } catch (error) {
      setErrorServidor(error instanceof ErrorDeNegocio ? error.message : MENSAJES.ERROR_INTERNO);
      return;
    }
    if (!usuarioId) {
      setErrorServidor('No se pudo conectar con el servidor. Intente de nuevo.');
      return;
    }
    try {
      if (!cabeOtraPendiente(await listarPendientes(usuarioId), idCliente)) {
        setErrorServidor(TOPE_PENDIENTES);
        return;
      }
      await almacenDispositivo.guardar({ idCliente, usuarioId, creadaEn: Date.now(), datos, estado: 'pendiente' });
    } catch {
      setErrorServidor('No se pudo guardar en este dispositivo. Conéctate e intenta de nuevo.');
      return;
    }
    avisar(GUARDADA_EN_DISPOSITIVO, true);
    // Sin conexión, una carga completa (la sirve el service worker desde la copia): la navegación de Next sin
    // red a veces no cambia de pantalla.
    if (typeof navigator !== 'undefined' && !navigator.onLine) cargarPagina(volver);
    else router.push(volver);
  }

  return (
    // E11e: crear también funciona sin conexión (editar no).
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5" {...(tarea ? {} : { 'data-sin-conexion': 'permitido' })}>
      <Campo
        id="titulo"
        etiqueta="Título"
        value={valores.titulo}
        onChange={cambiar('titulo')}
        onBlur={tocar('titulo')}
        error={visible('titulo')}
        maxLength={200}
        autoComplete="off"
        required
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectorCategoria
          id="categoria"
          etiqueta="Categoría"
          valor={valores.categoria}
          onCambio={(categoria) => setValores((previo) => ({ ...previo, categoria }))}
          categorias={categorias}
        />
        <Selector
          id="prioridad"
          etiqueta="Prioridad"
          opciones={OPCIONES_PRIORIDAD}
          value={valores.prioridad}
          onChange={cambiar('prioridad')}
          onBlur={tocar('prioridad')}
          error={visible('prioridad')}
        />
      </div>
      <Campo
        id="fechaLimite"
        etiqueta="Fecha límite"
        value={valores.fechaLimite}
        onChange={(e) => cambiar('fechaLimite')({ target: { value: aplicarMascaraFecha(e.target.value) } })}
        onBlur={tocar('fechaLimite')}
        error={visible('fechaLimite')}
        ayuda="Formato AAAA-MM-DD, por ejemplo 2026-03-10. Escribe solo los números: los guiones se ponen solos."
        placeholder="AAAA-MM-DD"
        inputMode="numeric"
        maxLength={10}
        autoComplete="off"
        required
      />
      {/* RB-34: horario opcional, con el selector de hora del navegador (la rueda en el iPhone), en 24 horas. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-texto">Horario (opcional)</legend>
        <div className="grid grid-cols-2 gap-3">
          <Campo
            id="horaInicio"
            etiqueta="Desde"
            type="time"
            step={300}
            value={valores.horaInicio}
            onChange={cambiar('horaInicio')}
            onBlur={tocar('horaInicio')}
            error={visible('horaInicio')}
          />
          <Campo
            id="horaFin"
            etiqueta="Hasta"
            type="time"
            step={300}
            value={valores.horaFin}
            onChange={cambiar('horaFin')}
            onBlur={tocar('horaFin')}
            error={visible('horaFin')}
          />
        </div>
        <p className="text-xs text-texto-suave">Puedes poner solo la hora de inicio. Las tareas con hora se ordenan por horario.</p>
      </fieldset>

      {/* E11c (RB-43, RB-45): con horario, desde la hora de inicio; sin horario, a la hora fija de Configuración. */}
      <div className="flex flex-col gap-3">
        <Selector
          id="recordatorio"
          etiqueta="Recordatorio"
          opciones={opcionesRecordatorioCampo}
          value={recordatorio}
          onChange={(e) => setValores((previo) => ({ ...previo, recordatorio: esRecordatorio(e.target.value) ? e.target.value : '' }))}
        />
        {recordatorioPasado(valores, recordatorio, horaFija) && <Aviso tipo="advertencia">{AVISO_MOMENTO_PASADO}</Aviso>}
        {recordatorio && <PanelNotificaciones modo="formulario" />}
      </div>

      {/* RN-07 permite fechas pasadas: se avisa por si fue un error al escribir, pero no se bloquea. */}
      {esFechaPasada(valores.fechaLimite, hoyBogota()) && (
        <Aviso tipo="advertencia">Esta fecha ya pasó. Puedes guardar la tarea de todos modos.</Aviso>
      )}

      {errorServidor && <Aviso tipo="error">{errorServidor}</Aviso>}

      <div className="flex flex-wrap gap-3">
        <Boton type="submit" cargando={enviando}>
          {tarea ? 'Guardar cambios' : 'Guardar tarea'}
        </Boton>
        <Boton variante="secundario" onClick={() => router.push(volver)}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}
