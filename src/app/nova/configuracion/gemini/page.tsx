import { ArrowLeft, ExternalLink, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { exigirSesionDePagina } from '@/lib/dataService';

export const dynamic = 'force-dynamic';

const AI_STUDIO = 'https://aistudio.google.com/apikey';

/**
 * E20c-1 (5.14, TAREA 1): "Cómo crear tu clave de Gemini". Pasos revisados el 2026-11-25 en la documentación oficial
 * (aistudio.google.com/docs/api-key) y en sus términos: AI Studio crea un proyecto y una clave al aceptar los
 * términos la primera vez; las claves nuevas desde el 28 de mayo de 2026 ya vienen limitadas a la API de Gemini.
 * También se ve sin clave (es justo para quien no la tiene).
 */
export default async function GuiaClaveGeminiPage() {
  await exigirSesionDePagina();
  return (
    <>
      <EncabezadoPantalla titulo="Cómo crear tu clave de Gemini" subtitulo="Es gratis y toma unos minutos. Solo necesitas una cuenta de Google." />
      <Link href="/nova/configuracion#config-asistente" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-acento underline underline-offset-2">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Volver a Configuración
      </Link>
      <Tarjeta className="flex flex-col gap-4">
        <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm text-texto marker:font-semibold marker:text-acento">
          <li>
            Entra a{' '}
            <a href={AI_STUDIO} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-acento underline underline-offset-2">
              Google AI Studio
              <ExternalLink aria-hidden="true" className="size-3.5" />
              <span className="sr-only">(se abre en otra pestaña)</span>
            </a>{' '}
            con tu cuenta de Google. Google pide tener 18 años o más y estar en un país donde el servicio esté disponible.
          </li>
          <li>
            Si es tu primera vez, acepta los términos: AI Studio crea un proyecto y una clave por ti. Si ya lo usabas, toca{' '}
            <strong>Create API key</strong> (o <strong>Crear clave de API</strong>).
          </li>
          <li>Copia la clave.</li>
          <li>
            Si junto a tu clave dice <strong>Unrestricted</strong>, toca <strong>Add restrictions</strong> y elige{' '}
            <strong>Restrict to Gemini API only</strong>. Las claves creadas desde el 28 de mayo de 2026 ya vienen limitadas a Gemini.
          </li>
          <li>
            En Nova, ve a{' '}
            <Link href="/nova/configuracion#config-asistente" className="font-semibold text-acento underline underline-offset-2">
              Configuración → Asistente
            </Link>
            , pega la clave y toca <strong>Verificar y guardar</strong>.
          </li>
        </ol>
      </Tarjeta>
      <Tarjeta className="flex flex-col gap-3 text-sm text-texto">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ShieldAlert aria-hidden="true" className="size-4 text-aviso" />
          Antes de usarla
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            En el plan gratuito, Google puede usar lo que envías (tus preguntas, fragmentos de tus documentos y las respuestas)
            para mejorar sus productos, y algunas personas pueden leerlo. No envíes información sensible, confidencial o
            personal. En el plan de pago, Google no lo usa para mejorar sus productos.
          </li>
          <li>Trata tu clave como una contraseña: no la compartas con nadie ni la pegues en otro sitio.</li>
          <li>
            Si crees que alguien la vio: crea una nueva en AI Studio, cámbiala en Nova y, cuando la nueva funcione, borra la
            anterior en AI Studio.
          </li>
          <li>Los límites de uso son los de tu cuenta de Google, no los de Nova.</li>
        </ul>
      </Tarjeta>
    </>
  );
}
