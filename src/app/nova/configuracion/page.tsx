import { BloqueAcademico } from '@/components/nova/configuracion/BloqueAcademico';
import { BloqueApariencia } from '@/components/nova/configuracion/BloqueApariencia';
import { BloqueAsistente } from '@/components/nova/configuracion/BloqueAsistente';
import { BloqueInstalar } from '@/components/nova/configuracion/BloqueInstalar';
import { BloqueNotificaciones } from '@/components/nova/configuracion/BloqueNotificaciones';
import { BloquePerfil } from '@/components/nova/configuracion/BloquePerfil';
import { BloqueSesion } from '@/components/nova/configuracion/BloqueSesion';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { exigirSesion, obtenerConfiguracion } from '@/lib/dataService';

export const dynamic = 'force-dynamic';

/** E11 (PLAN_AMPLIACION 5.8): Perfil, Apariencia, Académico, Asistente y Cerrar sesión. E11b: Instalar Nova. E11c: Notificaciones. */
export default async function ConfiguracionPage() {
  const sesion = await exigirSesion();
  const { perfil, preferencias } = await obtenerConfiguracion(sesion.id, sesion.email);
  return (
    <>
      <EncabezadoPantalla titulo="Configuración" subtitulo="Tu perfil y cómo se ve y funciona Nova." />
      <div className="flex max-w-2xl flex-col gap-6">
        <BloquePerfil nombre={perfil.nombre} email={perfil.email} />
        <BloqueApariencia tema={preferencias.tema} formatoHora={preferencias.formatoHora} />
        <BloqueAcademico notaAprobar={preferencias.notaAprobar} redondeo={preferencias.redondeo} cortesDefecto={preferencias.cortesDefecto} />
        <BloqueNotificaciones
          horaRecordatorio={preferencias.horaRecordatorio}
          formatoHora={preferencias.formatoHora}
          resumenDiario={preferencias.resumenDiario}
          horaResumen={preferencias.horaResumen}
        />
        <BloqueAsistente />
        <BloqueInstalar />
        <BloqueSesion />
      </div>
    </>
  );
}
