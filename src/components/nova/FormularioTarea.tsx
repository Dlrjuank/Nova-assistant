'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Selector } from '@/components/ui/Selector';
import { CATEGORIA_POR_DEFECTO, PRIORIDAD_POR_DEFECTO } from '@/lib/config/nova';
import { ErrorDeNegocio, MENSAJES } from '@/lib/reglas/errores';
import { aplicarMascaraFecha, esFechaISOValida, esFechaPasada, hoyBogota } from '@/lib/reglas/fechas';
import { normalizarTitulo, resolverPrioridad } from '@/lib/reglas/tarea';

type Campos = 'titulo' | 'prioridad' | 'fechaLimite';
interface Valores {
  titulo: string;
  categoria: string;
  prioridad: string;
  fechaLimite: string;
}

const OPCIONES_PRIORIDAD = [
  { valor: '1', texto: '1 · Baja' },
  { valor: '2', texto: '2 · Media' },
  { valor: '3', texto: '3 · Alta' },
];

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
  return errores;
}

/** `fechaInicial`: la que trae `?fecha=` desde Inicio o el Calendario (ya validada por la página). */
export function FormularioTarea({ fechaInicial = '' }: { fechaInicial?: string } = {}) {
  const router = useRouter();
  const [valores, setValores] = useState<Valores>({
    titulo: '',
    categoria: CATEGORIA_POR_DEFECTO,
    prioridad: String(PRIORIDAD_POR_DEFECTO),
    fechaLimite: fechaInicial,
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
    setTocados({ titulo: true, prioridad: true, fechaLimite: true });
    if (Object.keys(errores).length > 0) return;

    setEnviando(true);
    try {
      const respuesta = await fetch('/api/nova/tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: normalizarTitulo(valores.titulo),
          categoria: valores.categoria.trim() || CATEGORIA_POR_DEFECTO,
          prioridad: Number(valores.prioridad),
          fechaLimite: valores.fechaLimite,
        }),
      });
      const cuerpo = (await respuesta.json()) as { ok: boolean; error?: { mensaje?: string } };
      if (!respuesta.ok || !cuerpo.ok) {
        setErrorServidor(cuerpo.error?.mensaje ?? MENSAJES.ERROR_INTERNO);
        return;
      }
      router.push('/nova/tareas');
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
        <Campo
          id="categoria"
          etiqueta="Categoría"
          value={valores.categoria}
          onChange={cambiar('categoria')}
          maxLength={80}
          autoComplete="off"
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
      {/* RN-07 permite fechas pasadas: se avisa por si fue un error al escribir, pero no se bloquea. */}
      {esFechaPasada(valores.fechaLimite, hoyBogota()) && (
        <Aviso tipo="advertencia">Esta fecha ya pasó. Puedes guardar la tarea de todos modos.</Aviso>
      )}

      {errorServidor && <Aviso tipo="error">{errorServidor}</Aviso>}

      <div className="flex flex-wrap gap-3">
        <Boton type="submit" cargando={enviando}>
          Guardar tarea
        </Boton>
        <Boton variante="secundario" onClick={() => router.push('/nova/tareas')}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}
