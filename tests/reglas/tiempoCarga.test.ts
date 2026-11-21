// E20b (tiempo de carga, pedido del usuario): lo que hace que cambiar de pantalla se sienta rápido.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import { DURACION_MS } from '@/components/ui/Contador';

describe('tiempo de carga', () => {
  it('volver a una pantalla vista en los últimos 30 s no la pide otra vez', () => {
    expect(nextConfig.experimental?.staleTimes?.dynamic).toBe(30);
  });

  it('las animaciones se notan sin hacer esperar', () => {
    expect(DURACION_MS).toBeLessThanOrEqual(450);
    const css = readFileSync('src/app/globals.css', 'utf8');
    expect(css).toMatch(/animation: nova-entrar 0\.2s/);
    expect(css).toMatch(/\.nova-entrada > :nth-child\(n \+ 6\) \{ animation-delay: 100ms; \}/);
    expect(css).toMatch(/animation: nova-anillo 0\.55s [^;]*both;/);
  });

  it('lo que guarda sin router.refresh() no deja una lista vieja en la memoria', () => {
    for (const f of ['src/components/nova/GuardarFuente.tsx', 'src/components/nova/cuestionarios/SugerenciasRepaso.tsx', 'src/components/nova/cuestionarios/FormularioCuestionario.tsx']) {
      expect(readFileSync(f, 'utf8'), f).toContain('router.refresh()');
    }
  });
});
