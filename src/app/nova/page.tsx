import { PreguntaleANova } from '@/components/nova/PreguntaleANova';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';

export const dynamic = 'force-dynamic';

/**
 * Inicio (E03, versión mínima): solo "Pregúntale a Nova". La semana, el progreso semanal y las
 * prioridades de hoy llegan en E06 (PLAN_AMPLIACION 5.1).
 */
export default function InicioPage() {
  return (
    <>
      <EncabezadoPantalla titulo="Inicio" subtitulo="Tu asistente personal para tus tareas y tus documentos." />
      <PreguntaleANova />
    </>
  );
}
