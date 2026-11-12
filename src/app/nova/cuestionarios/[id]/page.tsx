import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { Cuestionario } from '@/components/nova/cuestionarios/Cuestionario';
import { CLASE_FOCO } from '@/components/ui/Boton';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { exigirSesion, listarCategorias, obtenerCuestionario, type CuestionarioVista } from '@/lib/dataService';
import { ErrorDeNegocio, MENSAJES } from '@/lib/reglas/errores';
import { esquemaIdCuestionario } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** E10e (5.11): responder un cuestionario; siempre muestra el intento más reciente, donde iba (B-63). */
export default async function CuestionarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ obtenidas?: string | string[]; pedidas?: string | string[] }>;
}) {
  const [{ id }, parametros] = await Promise.all([params, searchParams]);
  const sesion = await exigirSesion();
  const valido = esquemaIdCuestionario.safeParse(id);
  let datos: CuestionarioVista | null = null;
  if (valido.success) {
    // Uno ajeno se comporta como inexistente (RB-01).
    datos = await obtenerCuestionario(sesion.id, valido.data).catch((error: unknown) => {
      if (error instanceof ErrorDeNegocio && error.codigo === 'CUESTIONARIO_NO_ENCONTRADO') return null;
      throw error;
    });
  }
  // RB-53: el diálogo de la tarea de repaso elige la categoría (RB-33).
  // Se cargan siempre: la sugerencia también aparece al terminar el intento en esta pantalla.
  const categorias = datos ? (await listarCategorias(sesion.id)).map((c) => ({ nombre: c.nombre, color: c.color })) : [];
  // RB-49: con parte de las pedidas, se avisa al llegar.
  const obtenidas = Number(uno(parametros.obtenidas));
  const pedidas = Number(uno(parametros.pedidas));
  const aviso = Number.isInteger(obtenidas) && Number.isInteger(pedidas) && obtenidas < pedidas ? `Solo pude sacar ${obtenidas} de ${pedidas} preguntas de este contenido.` : undefined;

  return (
    <>
      <EncabezadoPantalla titulo="Cuestionario" subtitulo={datos ? <span className="break-all">{datos.documento.nombre}</span> : undefined} />
      <Link
        href={datos ? `/nova/cuestionarios?documento=${datos.documento.id}` : '/nova/cuestionarios'}
        className={`inline-flex items-center gap-1 self-start rounded text-sm font-medium text-acento ${CLASE_FOCO}`}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Cuestionarios
      </Link>
      {datos ? (
        <Cuestionario key={datos.intento.id} datos={datos} categorias={categorias} {...(aviso && !datos.intento.repaso ? { aviso } : {})} />
      ) : (
        <EstadoVacio titulo={MENSAJES.CUESTIONARIO_NO_ENCONTRADO} descripcion="Puede que hayas eliminado su documento." />
      )}
    </>
  );
}
