'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ConDialogo } from './ConDialogo';
import { FormularioMateria } from './FormularioMateria';

/** E12: "Nueva materia" abre el formulario; al crearla, lleva a su detalle. */
export function NuevaMateria({ variante = 'primario' }: { variante?: 'primario' | 'secundario' }) {
  const router = useRouter();
  return (
    <ConDialogo
      variante={variante}
      boton={
        <>
          <Plus aria-hidden="true" className="size-4" />
          Nueva materia
        </>
      }
      titulo="Nueva materia"
    >
      {(cerrar) => (
        <FormularioMateria
          alTerminar={(id) => {
            cerrar();
            router.push(`/nova/semestre/${id}`);
          }}
        />
      )}
    </ConDialogo>
  );
}
