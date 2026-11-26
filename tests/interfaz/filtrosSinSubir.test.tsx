// Filtros y pestañas que se quedan en la misma pantalla: la página no sube (pedido del usuario del 2026-11-26).
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const vistos = vi.hoisted(() => [] as Array<{ href: string; scroll: boolean | undefined }>);
vi.mock('next/link', () => ({
  default: ({ href, scroll, children, ...resto }: { href: string; scroll?: boolean; children: ReactNode }) => {
    vistos.push({ href, scroll });
    return <a href={href} {...resto}>{children}</a>;
  },
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/nova/semestre/objetivos', useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }) }));

import { Pestanas } from '@/components/ui/Pestanas';

afterEach(() => {
  cleanup();
  vistos.length = 0;
});

describe('Pestanas', () => {
  it('las que solo cambian la consulta no suben; las que van a otra ruta, sí', () => {
    render(
      <Pestanas
        etiqueta="Prueba"
        pestanas={[
          { href: '/nova/semestre', texto: 'Notas', activa: false },
          { href: '/nova/semestre/objetivos?materia=a', texto: 'A', activa: true },
          { href: '/nova/semestre/objetivos', texto: 'Objetivos', activa: false },
        ]}
      />,
    );
    expect(vistos.map((v) => [v.href, v.scroll])).toEqual([
      ['/nova/semestre', true],
      ['/nova/semestre/objetivos?materia=a', false],
      ['/nova/semestre/objetivos', false],
    ]);
  });
});
