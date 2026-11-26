import { BloqueAcademico } from '@/components/nova/configuracion/BloqueAcademico';
import { BloqueApariencia } from '@/components/nova/configuracion/BloqueApariencia';
import { BloqueAsistente } from '@/components/nova/configuracion/BloqueAsistente';
import { BloqueInstalar } from '@/components/nova/configuracion/BloqueInstalar';
import { BloqueNotificaciones } from '@/components/nova/configuracion/BloqueNotificaciones';
import { BloquePerfil } from '@/components/nova/configuracion/BloquePerfil';
import { BloqueSesion } from '@/components/nova/configuracion/BloqueSesion';
import { IndiceConfiguracion } from '@/components/nova/configuracion/IndiceConfiguracion';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { exigirSesion, infoClaveGemini, obtenerConfiguracion } from '@/lib/dataService';

export const dynamic = 'force-dynamic';

/** E11 (PLAN_AMPLIACION 5.8): Perfil, Apariencia, Académico, Asistente y Cerrar sesión. E11b: Instalar Nova. E11c: Notificaciones. */
export default async function ConfiguracionPage() {
  const sesion = await exigirSesion();
  const [{ perfil, preferencias }, claveGemini] = await Promise.all([obtenerConfiguracion(sesion.id, sesion.email), infoClaveGemini(sesion.id)]);
  return (
    <>
      <EncabezadoPantalla titulo="Configuración" subtitulo="Tu perfil y cómo se ve y funciona Nova." />
      {/* E20b (commit 9): en pantalla ancha, el índice de secciones queda fijo a la izquierda. */}
      <div className="xl:grid xl:grid-cols-[11rem_minmax(0,42rem)] xl:gap-8">
        <IndiceConfiguracion />
        <div className="flex max-w-2xl flex-col gap-6 [&>div]:scroll-mt-6">
          <div id="config-perfil">
            <BloquePerfil nombre={perfil.nombre} email={perfil.email} />
          </div>
          <div id="config-apariencia">
            <BloqueApariencia tema={preferencias.tema} formatoHora={preferencias.formatoHora} />
          </div>
          <div id="config-academico">
            <BloqueAcademico notaAprobar={preferencias.notaAprobar} redondeo={preferencias.redondeo} cortesDefecto={preferencias.cortesDefecto} />
          </div>
          <div id="config-notificaciones">
            <BloqueNotificaciones
              horaRecordatorio={preferencias.horaRecordatorio}
              formatoHora={preferencias.formatoHora}
              resumenDiario={preferencias.resumenDiario}
              horaResumen={preferencias.horaResumen}
            />
          </div>
          <div id="config-asistente">
            <BloqueAsistente claveGemini={claveGemini} />
          </div>
          <div id="config-instalar">
            <BloqueInstalar />
          </div>
          <div id="config-sesion">
            <BloqueSesion pideActual={!sesion.conGoogle} />
          </div>
        </div>
      </div>
    </>
  );
}
