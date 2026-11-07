import { CategoriasConfig } from '@/components/nova/CategoriasConfig';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { exigirSesion, listarCategorias } from '@/lib/dataService';

export const dynamic = 'force-dynamic';

/**
 * Configuración (PLAN_AMPLIACION 5.8). En E05 solo el bloque Categorías; perfil, apariencia, académico y
 * asistente llegan en E11.
 */
export default async function ConfiguracionPage() {
  // El layout ya exige sesión con acceso; aquí hace falta el id para ver solo sus categorías (RB-01).
  const { id } = await exigirSesion();
  const categorias = await listarCategorias(id);

  return (
    <>
      <EncabezadoPantalla titulo="Configuración" subtitulo="Organiza tus categorías de tareas y sus colores." />
      <CategoriasConfig categorias={categorias} />
    </>
  );
}
