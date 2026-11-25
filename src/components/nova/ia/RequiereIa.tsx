'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { KeyRound } from 'lucide-react';
import { useEstadoIa } from '@/components/nova/PreferenciasNova';
import { avisoDeIa, RUTA_GUIA_CLAVE, TEXTO_ENLACE_GUIA } from '@/lib/reglas/claveGemini';

/**
 * E20c-1 (RB-79, RB-78, RB-90): en lugar de un botón o un campo que usa la IA, sin una clave que sirva se ve el
 * aviso con el enlace a la guía y a Configuración. Lo que no usa IA sigue igual. El servidor responde lo mismo
 * (SIN_CLAVE_GEMINI y los demás) antes de llamar a Gemini, por si alguien llega a la acción de otra forma.
 */
export function AvisoClaveIa({ texto, compacto = false }: { texto: string; compacto?: boolean }) {
  return (
    <div
      data-aviso-clave-ia
      role="status"
      className={`flex gap-3 rounded-2xl border border-acento/30 bg-acento-suave text-sm text-texto ${compacto ? 'px-3 py-2' : 'px-4 py-3'}`}
    >
      <KeyRound aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-acento" />
      <div className="flex flex-col gap-1">
        <p>{texto}</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href={RUTA_GUIA_CLAVE} className="font-semibold text-acento underline underline-offset-2">
            {TEXTO_ENLACE_GUIA}
          </Link>
          <Link href="/nova/configuracion#config-asistente" className="font-semibold text-acento underline underline-offset-2">
            Vincular en Configuración
          </Link>
        </p>
      </div>
    </div>
  );
}

/** Muestra `children` solo si la persona tiene una IA que sirve; si no, el aviso. */
export function RequiereIa({ children, compacto = false }: { children: ReactNode; compacto?: boolean }) {
  const aviso = avisoDeIa(useEstadoIa());
  if (aviso) return <AvisoClaveIa texto={aviso} compacto={compacto} />;
  return <>{children}</>;
}
