'use client';

import { CheckCircle2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { EliminarConConfirmacion } from '@/components/nova/EliminarConConfirmacion';
import { Aviso } from '@/components/ui/Aviso';
import { Boton, CLASE_FOCO } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Insignia } from '@/components/ui/Insignia';
import { Selector } from '@/components/ui/Selector';
import type { Tema } from '@/lib/dataService';
import { MENSAJES } from '@/lib/reglas/errores';
import { textoConfirmados, validarNombreTema } from '@/lib/reglas/temas';
import { mensajeDe, pedirSemestre } from './peticion';

function FilaTema({ tema }: { tema: Tema }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(tema.nombre);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function pedir(cuerpo: { nombre?: string; confirmar?: boolean }) {
    setError('');
    setEnviando(true);
    const r = await pedirSemestre(`/api/nova/temas/${tema.id}`, 'PATCH', cuerpo);
    setEnviando(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    setEditando(false);
    router.refresh();
  }

  function guardar(evento: FormEvent) {
    evento.preventDefault();
    const problema = mensajeDe(() => validarNombreTema(nombre));
    if (problema) setError(problema);
    else void pedir({ nombre });
  }

  const propuesto = tema.estado === 'propuesto';
  return (
    <li className="flex flex-col gap-2 px-3 py-2.5">
      {editando ? (
        <form onSubmit={guardar} noValidate className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <Campo id={`tema-${tema.id}`} etiqueta="Nombre del tema" value={nombre} maxLength={200} onChange={(e) => setNombre(e.target.value)} error={error || undefined} />
          </div>
          <div className="flex gap-2 pt-7">
            <Boton type="submit" cargando={enviando} disabled={enviando}>
              Guardar
            </Boton>
            <Boton
              variante="fantasma"
              disabled={enviando}
              onClick={() => {
                setEditando(false);
                setNombre(tema.nombre);
                setError('');
              }}
            >
              Cancelar
            </Boton>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            {propuesto ? (
              <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-aviso" />
            ) : (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-exito" />
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="break-words text-sm font-medium text-texto">
                {tema.nombre} {propuesto && <Insignia tono="aviso">Propuesto</Insignia>}
              </p>
              {tema.fuente && <p className="break-words text-xs text-texto-suave">Fuente: {tema.fuente}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {propuesto && (
              <Boton variante="secundario" className="min-h-9 py-1.5" aria-label={`Confirmar ${tema.nombre}`} cargando={enviando} disabled={enviando} onClick={() => void pedir({ confirmar: true })}>
                Confirmar
              </Boton>
            )}
            <Boton variante="fantasma" className="min-h-9 py-1.5" aria-label={`Editar ${tema.nombre}`} disabled={enviando} onClick={() => setEditando(true)}>
              Editar
            </Boton>
            <EliminarConConfirmacion
              ruta={`/api/nova/temas/${tema.id}`}
              etiqueta={`${propuesto ? 'Descartar' : 'Eliminar'} ${tema.nombre}`}
              pregunta={propuesto ? '¿Descartar este tema propuesto?' : '¿Eliminar este tema?'}
            />
          </div>
        </div>
      )}
      {!editando && error && <p role="alert" className="text-xs font-medium text-peligro">{error}</p>}
    </li>
  );
}

/**
 * E17 (5.7, 6.8, 9.1; RB-19, RB-21): los temas de un corte (o de la materia sin cortes): agregar a mano (nacen
 * confirmados), editar, eliminar, y proponer desde un PDF de la materia; los propuestos se confirman o se descartan.
 */
export function TemasCorte({
  corteId,
  titulo,
  temas,
  documentos,
}: {
  corteId: string;
  titulo: string;
  temas: Tema[];
  documentos: Array<{ id: string; nombre: string }>;
}) {
  const router = useRouter();
  const [nuevo, setNuevo] = useState('');
  const [errorNuevo, setErrorNuevo] = useState('');
  const [agregando, setAgregando] = useState(false);
  const [documento, setDocumento] = useState(documentos[0]?.id ?? '');
  const [proponiendo, setProponiendo] = useState(false);
  const [resultado, setResultado] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const confirmados = temas.filter((t) => t.estado === 'confirmado').length;

  async function agregar(evento: FormEvent) {
    evento.preventDefault();
    const problema = mensajeDe(() => validarNombreTema(nuevo));
    setErrorNuevo(problema);
    if (problema) return;
    setAgregando(true);
    const r = await pedirSemestre(`/api/nova/cortes/${corteId}/temas`, 'POST', { nombre: nuevo });
    setAgregando(false);
    if (!r.ok) {
      setErrorNuevo(r.mensaje);
      return;
    }
    setNuevo('');
    router.refresh();
  }

  async function proponer() {
    setResultado(null);
    setProponiendo(true);
    const r = await pedirSemestre<Tema[]>(`/api/nova/cortes/${corteId}/temas/proponer`, 'POST', { documentoId: documento });
    setProponiendo(false);
    if (!r.ok) {
      setResultado({ tipo: 'error', texto: r.mensaje });
      return;
    }
    const n = r.datos.length;
    setResultado({ tipo: 'exito', texto: `${n === 1 ? 'Se propuso 1 tema' : `Se propusieron ${n} temas`}. Confírmalos o descártalos: solo cuentan los confirmados.` });
    router.refresh();
  }

  return (
    <section aria-label={`Temas de ${titulo}`} className="flex flex-col gap-3 rounded-xl border border-borde p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-texto">{titulo}</h3>
        <p className="text-sm text-texto-suave">{textoConfirmados(confirmados)}</p>
      </div>
      {temas.length > 0 ? (
        <ul className="flex flex-col divide-y divide-borde rounded-lg border border-borde">
          {temas.map((t) => (
            <FilaTema key={`${t.id}:${t.nombre}:${t.estado}`} tema={t} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-texto-suave">Aún no hay temas.</p>
      )}
      <form onSubmit={(e) => void agregar(e)} noValidate className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1 basis-56">
          <Campo id={`nuevo-tema-${corteId}`} etiqueta="Nuevo tema" value={nuevo} maxLength={200} onChange={(e) => setNuevo(e.target.value)} error={errorNuevo || undefined} />
        </div>
        <div className="pt-7">
          <Boton type="submit" variante="secundario" cargando={agregando} disabled={agregando}>
            Agregar
          </Boton>
        </div>
      </form>
      <div className="flex flex-col gap-2 border-t border-borde pt-3">
        <p className="text-sm font-medium text-texto">Proponer temas desde un PDF</p>
        {documentos.length === 0 ? (
          <p className="text-sm text-texto-suave">
            {MENSAJES.SIN_SYLLABUS}{' '}
            <Link href="/nova/fuentes" className={`rounded font-medium text-acento underline ${CLASE_FOCO}`}>
              Ir a Fuentes
            </Link>
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 basis-56">
              <Selector id={`pdf-temas-${corteId}`} etiqueta="PDF de la materia" value={documento} onChange={(e) => setDocumento(e.target.value)} opciones={documentos.map((d) => ({ valor: d.id, texto: d.nombre }))} />
            </div>
            <Boton variante="secundario" cargando={proponiendo} disabled={proponiendo || !documento} onClick={() => void proponer()}>
              <Sparkles aria-hidden="true" className="size-4" />
              {proponiendo ? 'Leyendo el PDF…' : 'Proponer temas'}
            </Boton>
          </div>
        )}
        {resultado && <Aviso tipo={resultado.tipo === 'exito' ? 'exito' : 'error'}>{resultado.texto}</Aviso>}
      </div>
    </section>
  );
}
