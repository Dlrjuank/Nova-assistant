import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { LogoNova } from '@/components/nova/marca/EstrellaNova';
import { CLASE_ENLACE_ACCESO } from '@/components/login/TarjetaAcceso';

export const metadata: Metadata = { title: 'Privacidad · Nova' };

/** Contacto público de Nova (decisión del usuario del 2026-11-26). */
const CONTACTO_PRIVACIDAD = 'nova.asistente.app@gmail.com';

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-bold tracking-tight text-texto">{titulo}</h2>
      <div className="flex flex-col gap-3 text-sm leading-6 text-texto-suave">{children}</div>
    </section>
  );
}

const LISTA = 'flex list-disc flex-col gap-1.5 pl-5 marker:text-acento';

/**
 * E21 (adelantada en la ronda de E20d, pedido del usuario del 2026-11-26): política de privacidad pública, sin sesión,
 * para Google Auth Platform. Va a `master` con E21.
 */
export default function PrivacidadPage() {
  return (
    <main data-nova-fondo className="min-h-screen bg-fondo px-4 py-10 text-texto sm:px-6">
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-8 rounded-[20px] border border-borde bg-superficie p-6 shadow-suave sm:p-9">
        <header className="flex flex-col gap-6">
          <a href="/login" aria-label="Ir a Nova" className="w-fit rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acento">
            <LogoNova />
          </a>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-texto sm:text-3xl">Privacidad</h1>
            <p className="mt-2 text-sm leading-6 text-texto-suave">
              Qué guarda Nova, qué se envía a Google y cómo eliminar tu cuenta. Actualizada el 26 de noviembre de 2026.
            </p>
          </div>
        </header>

        <Seccion titulo="Qué guarda Nova">
          <ul className={LISTA}>
            <li>
              <span className="text-texto">Tu cuenta:</span> tu correo y, si entras con Google, el nombre de tu cuenta de Google. Tu contraseña la guarda
              el sistema de cuentas protegida; nadie puede leerla.
            </li>
            <li>
              <span className="text-texto">Lo que creas en Nova:</span> tareas, categorías, materias, notas, fallas, metas, temas, planes de estudio,
              cuestionarios con tus respuestas, conversaciones con el asistente, fuentes web que guardas y tus preferencias.
            </li>
            <li>
              <span className="text-texto">Tus documentos:</span> el texto de cada documento, dividido en fragmentos, para que el asistente pueda
              buscar en él. El archivo original se guarda solo mientras se lee y se borra al terminar.
            </li>
            <li>
              <span className="text-texto">Tu clave de Gemini</span>, si la vinculas: cifrada. De su uso solo se guarda cuántas consultas hiciste cada día.
            </li>
            <li>
              <span className="text-texto">Notificaciones</span>, si las activas: la dirección que tu navegador da para recibirlas.
            </li>
            <li>
              <span className="text-texto">Datos de la cuenta:</span> cuándo entraste por última vez y cuánto espacio usas, para administrar Nova.
            </li>
          </ul>
          <p>
            Sin conexión, la app instalada guarda una copia de algunas pantallas en tu propio dispositivo. Nova no muestra publicidad, no vende tus datos
            y no usa rastreadores.
          </p>
        </Seccion>

        <Seccion titulo="Qué se envía a Gemini y a Google">
          <ul className={LISTA}>
            <li>
              <span className="text-texto">A Gemini</span> (la inteligencia artificial de Google), con tu clave: tus preguntas al asistente y los
              fragmentos de tus documentos y tareas que sirven para responderlas; el texto de tus documentos al leerlos; y lo necesario para proponer
              temas, planes de estudio y cuestionarios. Google trata esos datos según los términos de la API de Gemini. Con una clave gratuita, Google
              puede usarlos para mejorar sus productos.
            </li>
            <li>
              <span className="text-texto">Al entrar con Google</span>, Nova solo recibe tu correo, tu nombre y tu foto de perfil. No ve tu contraseña de
              Google, tu correo de Gmail ni tus archivos.
            </li>
            <li>
              <span className="text-texto">A Wikipedia</span>, lo que buscas en la búsqueda web.
            </li>
          </ul>
          <p>
            Nova funciona sobre Vercel (la app) y Supabase (la base de datos y las cuentas), en Estados Unidos. Las notificaciones pasan por el servicio
            de tu navegador (Apple, Google o Microsoft).
          </p>
          <p>
            Cuando algo falla, Nova le avisa a <span className="text-texto">Sentry</span> (también en Estados Unidos) qué error fue y en qué
            pantalla, para poder corregirlo. Ese aviso no lleva tu nombre, tu correo, tu IP ni lo que escribes en Nova.
          </p>
        </Seccion>

        <Seccion titulo="Cómo eliminar tu cuenta">
          <p>
            Escribe a{' '}
            <a className={CLASE_ENLACE_ACCESO} href={`mailto:${CONTACTO_PRIVACIDAD}`}>
              {CONTACTO_PRIVACIDAD}
            </a>{' '}
            desde el correo de tu cuenta y pide que la eliminen. Se borra todo: tu cuenta, tus tareas, documentos, conversaciones y lo demás que guarda
            Nova. No se puede deshacer.
          </p>
          <p>
            Sin eliminar la cuenta, puedes borrar tus documentos en Fuentes, tus conversaciones y tu clave de Gemini en Configuración, y desactivar las
            notificaciones.
          </p>
        </Seccion>

        <Seccion titulo="Contacto">
          <p>
            Para cualquier pregunta sobre tus datos, escribe a{' '}
            <a className={CLASE_ENLACE_ACCESO} href={`mailto:${CONTACTO_PRIVACIDAD}`}>
              {CONTACTO_PRIVACIDAD}
            </a>
            .
          </p>
        </Seccion>

        <footer className="border-t border-borde pt-6 text-center text-sm">
          <a className={CLASE_ENLACE_ACCESO} href="/login">
            Ir a Nova
          </a>
        </footer>
      </article>
    </main>
  );
}
