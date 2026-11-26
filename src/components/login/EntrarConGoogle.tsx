import { CLASE_FOCO } from '@/components/ui/Boton';
import { LogoGoogle } from './LogoGoogle';

/**
 * E20c-3 (RB-81): "Entrar con Google". Es un enlace normal a /auth/google (funciona sin JavaScript): el servidor
 * pide a Supabase la dirección de Google y vuelve por /auth/callback. Debajo, "o con tu correo" separa el formulario.
 */
export function EntrarConGoogle({ separador = true }: { separador?: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <a
        href="/auth/google"
        data-entrar-google
        className={`inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-borde bg-superficie px-4 py-2 text-sm font-semibold text-texto transition-[border-color,background-color,transform] duration-150 hover:border-acento hover:bg-superficie-2 active:scale-[0.98] ${CLASE_FOCO}`}
      >
        <LogoGoogle />
        Entrar con Google
      </a>
      {separador && (
        <p className="flex items-center gap-3 text-xs text-texto-suave" aria-hidden="true">
          <span className="h-px flex-1 bg-borde" />o con tu correo
          <span className="h-px flex-1 bg-borde" />
        </p>
      )}
    </div>
  );
}
