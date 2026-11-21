import { exigirSesion } from '@/lib/auth/sesion';
import { estadisticasSemestre } from '@/lib/dataService';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';

export const dynamic = 'force-dynamic';

/** E20 (5.7): notas por corte de cada materia, nota actual, estado y riesgo por nota o por fallas. */
export const GET = conManejoDeErrores(async () => {
  const sesion = await exigirSesion();
  return responderOk(await estadisticasSemestre(sesion.id));
});
