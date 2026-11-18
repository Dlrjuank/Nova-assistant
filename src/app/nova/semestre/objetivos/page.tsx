import { cookies } from 'next/headers';
import { NuevaMateria } from '@/components/nova/semestre/NuevaMateria';
import { ObjetivosMateria } from '@/components/nova/semestre/ObjetivosMateria';
import { pestanasSemestre } from '@/components/nova/semestre/pestanas';
import { RecordarMateria } from '@/components/nova/semestre/RecordarMateria';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Pestanas } from '@/components/ui/Pestanas';
import { documentosDeMaterias, exigirSesion, listarMaterias, listarMetasNota, listarTemas, materiaMasReciente } from '@/lib/dataService';
import { obtenerPreferencias } from '@/lib/datos/configuracion';
import { COOKIE_MATERIA, elegirMateria } from '@/lib/reglas/materiaElegida';

export const dynamic = 'force-dynamic';

/**
 * E16 y E17 (5.7): pestaña "Objetivos y plan": una materia a la vez (ajuste del usuario del 2026-11-17), con sus metas
 * y sus temas. La materia va en ?materia= (Atrás vuelve a la anterior); sin ella, la última abierta en este navegador
 * o la más reciente.
 */
export default async function ObjetivosPage({ searchParams }: { searchParams: Promise<{ materia?: string | string[] }> }) {
  const sesion = await exigirSesion();
  const { materia: pedida } = await searchParams;
  const [materias, { redondeo }, recordada, masReciente] = await Promise.all([
    listarMaterias(sesion.id),
    obtenerPreferencias(sesion.id),
    cookies().then((c) => c.get(COOKIE_MATERIA)?.value),
    materiaMasReciente(sesion.id),
  ]);
  const id = elegirMateria(
    materias.map((m) => m.id),
    typeof pedida === 'string' ? pedida : undefined,
    recordada,
    masReciente,
  );
  const materia = materias.find((m) => m.id === id);
  const [metas, temas, documentos] = materia
    ? await Promise.all([listarMetasNota(sesion.id, materia.id), listarTemas(sesion.id, materia.id), documentosDeMaterias(sesion.id)])
    : [[], [], []];

  return (
    <>
      <EncabezadoPantalla titulo="Semestre" subtitulo="La nota que quieres en cada materia y en cada corte, si todavía es alcanzable, y los temas de cada corte." />
      <Pestanas etiqueta="Secciones de Semestre" pestanas={pestanasSemestre('objetivos')} />
      {!materia ? (
        <EstadoVacio titulo="Aún no tienes materias." descripcion="Crea una materia para ponerle una meta." accion={<NuevaMateria />} />
      ) : (
        <div className="flex max-w-4xl min-w-0 flex-col gap-4">
          {materias.length > 1 && (
            <Pestanas
              etiqueta="Materia"
              envolverEnComputador
              pestanas={materias.map((m) => ({ href: `/nova/semestre/objetivos?materia=${m.id}`, texto: m.nombre, activa: m.id === materia.id }))}
            />
          )}
          <RecordarMateria id={materia.id} />
          <p className="text-sm text-texto-suave">
            «¿Es alcanzable?» usa tus notas y lo que falta por calificar, con el redondeo de Configuración. La meta de la materia es también el valor inicial de «Nota meta» en su calculadora.
          </p>
          <ObjetivosMateria key={materia.id} materia={materia} metas={metas} redondeo={redondeo} temas={temas} documentos={documentos.filter((d) => d.materiaId === materia.id)} />
        </div>
      )}
    </>
  );
}
