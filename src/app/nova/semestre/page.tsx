import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { NuevaMateria } from '@/components/nova/semestre/NuevaMateria';
import { CLASE_FOCO } from '@/components/ui/Boton';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Pestanas } from '@/components/ui/Pestanas';
import { exigirSesion, listarMaterias, type Materia } from '@/lib/dataService';
import { avisoDeComponentes, avisoDeCortes, type MateriaEntrada } from '@/lib/reglas/notas';

export const dynamic = 'force-dynamic';

const entrada = (m: Materia): MateriaEntrada => ({
  usaCortes: m.usaCortes,
  cortes: m.cortes.map((c) => ({ nombre: c.nombre, porcentaje: c.porcentaje, componentes: c.componentes.map((k) => ({ nombre: k.nombre, porcentaje: k.porcentaje, notas: k.notas.map((n) => n.nota) })) })),
});

/** E12: créditos, cortes, componentes y notas registradas, y si algún porcentaje no suma 100 %. */
function TarjetaMateria({ materia }: { materia: Materia }) {
  const componentes = materia.cortes.flatMap((c) => c.componentes);
  const notas = componentes.flatMap((c) => c.notas);
  const calificadas = notas.filter((n) => n.nota !== null).length;
  const e = entrada(materia);
  const revisar = Boolean(avisoDeCortes(e) || e.cortes.some((c) => avisoDeComponentes(c, e.usaCortes)));
  return (
    <li>
      <Link
        href={`/nova/semestre/${materia.id}`}
        prefetch={false}
        className={`flex items-center gap-3 rounded-2xl border border-borde bg-superficie p-4 shadow-suave transition-colors hover:border-acento ${CLASE_FOCO}`}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="break-words text-base font-semibold text-texto">{materia.nombre}</span>
          <span className="text-sm text-texto-suave">
            {materia.creditos} {materia.creditos === 1 ? 'crédito' : 'créditos'}
            {materia.docente ? ` · ${materia.docente}` : ''}
          </span>
          <span className="text-sm text-texto-suave">
            {materia.usaCortes ? `${materia.cortes.length} cortes` : 'Sin cortes'} · {componentes.length} {componentes.length === 1 ? 'componente' : 'componentes'} ·{' '}
            {calificadas} de {notas.length} {notas.length === 1 ? 'nota calificada' : 'notas calificadas'}
          </span>
          {revisar && <span className="text-sm font-medium text-aviso">Revisa los porcentajes: no suman 100 %.</span>}
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-texto-suave" />
      </Link>
    </li>
  );
}

/** E12 (5.7): Semestre, con la pestaña "Materias y notas" (las demás llegan en sus etapas). */
export default async function SemestrePage() {
  const sesion = await exigirSesion();
  const materias = await listarMaterias(sesion.id);
  return (
    <>
      <EncabezadoPantalla titulo="Semestre" subtitulo="Tus materias, sus componentes de evaluación y tus notas." accion={materias.length > 0 ? <NuevaMateria /> : undefined} />
      <Pestanas etiqueta="Secciones de Semestre" pestanas={[{ href: '/nova/semestre', texto: 'Materias y notas', activa: true }]} />
      {materias.length === 0 ? (
        <EstadoVacio titulo="Aún no tienes materias." descripcion="Crea tu primera materia con sus créditos; luego agrega sus componentes de evaluación y tus notas." accion={<NuevaMateria />} />
      ) : (
        <ul aria-label="Materias" className="grid max-w-4xl gap-3 md:grid-cols-2">
          {materias.map((m) => (
            <TarjetaMateria key={m.id} materia={m} />
          ))}
        </ul>
      )}
    </>
  );
}
