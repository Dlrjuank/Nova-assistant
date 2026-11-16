import { NuevaMateria } from '@/components/nova/semestre/NuevaMateria';
import { ObjetivosMateria } from '@/components/nova/semestre/ObjetivosMateria';
import { pestanasSemestre } from '@/components/nova/semestre/pestanas';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Pestanas } from '@/components/ui/Pestanas';
import { exigirSesion, listarMaterias, listarMetasNota } from '@/lib/dataService';
import { obtenerPreferencias } from '@/lib/datos/configuracion';

export const dynamic = 'force-dynamic';

/** E16 (5.7): pestaña "Objetivos y plan": la meta de cada materia y de cada corte, y si es alcanzable. */
export default async function ObjetivosPage() {
  const sesion = await exigirSesion();
  const [materias, metas, { redondeo }] = await Promise.all([listarMaterias(sesion.id), listarMetasNota(sesion.id), obtenerPreferencias(sesion.id)]);
  return (
    <>
      <EncabezadoPantalla titulo="Semestre" subtitulo="La nota que quieres en cada materia y en cada corte, y si todavía es alcanzable." />
      <Pestanas etiqueta="Secciones de Semestre" pestanas={pestanasSemestre('objetivos')} />
      {materias.length === 0 ? (
        <EstadoVacio titulo="Aún no tienes materias." descripcion="Crea una materia para ponerle una meta." accion={<NuevaMateria />} />
      ) : (
        <div className="flex max-w-4xl flex-col gap-4">
          <p className="text-sm text-texto-suave">
            «¿Es alcanzable?» usa tus notas y lo que falta por calificar, con el redondeo de Configuración. La meta de la materia es también el valor inicial de «Nota meta» en su calculadora.
          </p>
          {materias.map((m) => (
            <ObjetivosMateria key={m.id} materia={m} metas={metas.filter((x) => x.materiaId === m.id)} redondeo={redondeo} />
          ))}
        </div>
      )}
    </>
  );
}
