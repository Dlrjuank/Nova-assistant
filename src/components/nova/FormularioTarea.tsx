'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
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

type Campos = 'titulo' | 'prioridad' | 'fechaLimite' | 'horaInicio' | 'horaFin';
interface Valores {
  titulo: string;
  categoria: string;
  prioridad: string;
  fechaLimite: string;
  horaInicio: string;
  horaFin: string;
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
  };
  volver?: string;
} = {}) {
  const router = useRouter();
  const [valores, setValores] = useState<Valores>({
    titulo: tarea?.titulo ?? '',
    categoria: tarea?.categoria ?? CATEGORIA_POR_DEFECTO,
    prioridad: String(tarea?.prioridad ?? PRIORIDAD_POR_DEFECTO),
    fechaLimite: tarea?.fechaLimite ?? fechaInicial,
    horaInicio: tarea?.horaInicio ?? '',
    horaFin: tarea?.horaFin ?? '',
  });
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

    setEnviando(true);
    try {
      const respuesta = await fetch(tarea ? `/api/nova/tareas/${tarea.id}` : '/api/nova/tareas', {
        method: tarea ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: normalizarTitulo(valores.titulo),
          categoria: valores.categoria.trim() || CATEGORIA_POR_DEFECTO,
          prioridad: Number(valores.prioridad),
          fechaLimite: valores.fechaLimite,
          horaInicio: valores.horaInicio || null,
          horaFin: valores.horaFin || null,
        }),
      });
      const cuerpo = (await respuesta.json()) as { ok: boolean; error?: { mensaje?: string } };
      if (!respuesta.ok || !cuerpo.ok) {
        setErrorServidor(cuerpo.error?.mensaje ?? MENSAJES.ERROR_INTERNO);
        return;
      }
      router.push(volver);
      router.refresh();
    } catch {
      setErrorServidor('No se pudo conectar con el servidor. Intente de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
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
