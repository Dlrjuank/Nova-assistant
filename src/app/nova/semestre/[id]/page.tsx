import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { DetalleMateria } from '@/components/nova/semestre/DetalleMateria';
import { CLASE_FOCO } from '@/components/ui/Boton';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { exigirSesion, obtenerMateria, type Materia } from '@/lib/dataService';
import { obtenerPreferencias } from '@/lib/datos/configuracion';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { esquemaIdSemestre } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E12 (5.7): una materia. Una de otro usuario se comporta como inexistente (RB-01). */
export default async function MateriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await exigirSesion();
  const valido = esquemaIdSemestre.safeParse(id);
  let materia: Materia | null = null;
  if (valido.success) {
    materia = await obtenerMateria(sesion.id, valido.data).catch((error: unknown) => {
      if (error instanceof ErrorDeNegocio && error.codigo === 'MATERIA_NO_ENCONTRADA') return null;
      throw error;
    });
  }
  const { cortesDefecto } = materia ? await obtenerPreferencias(sesion.id) : { cortesDefecto: [] };

  return (
    <>
      <EncabezadoPantalla
        titulo={materia?.nombre ?? 'Materia'}
        subtitulo={materia ? `${materia.creditos} ${materia.creditos === 1 ? 'crédito' : 'créditos'}${materia.docente ? ` · ${materia.docente}` : ''}` : undefined}
      />
      <Link href="/nova/semestre" className={`inline-flex items-center gap-1 self-start rounded text-sm font-medium text-acento ${CLASE_FOCO}`}>
        <ChevronLeft aria-hidden="true" className="size-4" />
        Semestre
      </Link>
      {materia ? <DetalleMateria materia={materia} plantilla={cortesDefecto} /> : <EstadoVacio titulo="La materia no existe." descripcion="Puede que ya la hayas eliminado." />}
    </>
  );
}
