import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/nextjs';
import { filtrarEvento, filtrarMigaja, opcionesComunes, sinConsulta } from '@/lib/sentry/opciones';

describe('Sentry: lo que sale de Nova no lleva contenido del usuario', () => {
  it('sinConsulta quita los parámetros y el fragmento', () => {
    expect(sinConsulta('https://nova.app/nova/asistente?pregunta=mis%20notas')).toBe('https://nova.app/nova/asistente');
    expect(sinConsulta('/nova/tareas#arriba')).toBe('/nova/tareas');
    expect(sinConsulta('/nova/calendario')).toBe('/nova/calendario');
  });

  it('descarta los mensajes de la consola', () => {
    expect(filtrarMigaja({ category: 'console', message: 'texto del usuario' })).toBeNull();
  });

  it('quita la consulta de las navegaciones y de los pedidos', () => {
    const nav = filtrarMigaja({ category: 'navigation', data: { from: '/nova?pregunta=hola', to: '/nova/asistente?pregunta=hola' } });
    expect(nav?.data).toEqual({ from: '/nova', to: '/nova/asistente' });
    const pedido = filtrarMigaja({ category: 'fetch', data: { url: '/api/nova/semana?semana=2026-11-23', method: 'GET' } });
    expect(pedido?.data).toEqual({ url: '/api/nova/semana', method: 'GET' });
  });

  it('el evento conserva solo la dirección sin consulta y el método, y nunca el usuario', () => {
    const evento = {
      type: undefined,
      request: { url: 'https://nova.app/nova?pregunta=secreta', method: 'GET', cookies: { a: 'b' }, headers: { cookie: 'x' }, data: 'cuerpo' },
      user: { email: 'alguien@example.com' },
    } as unknown as ErrorEvent;
    const filtrado = filtrarEvento(evento);
    expect(filtrado?.request).toEqual({ url: 'https://nova.app/nova', method: 'GET' });
    expect(filtrado?.user).toBeUndefined();
  });

  it('sin DSN, Sentry queda apagado y nunca manda datos personales', () => {
    expect(opcionesComunes(undefined)).toMatchObject({ enabled: false, sendDefaultPii: false });
    expect(opcionesComunes('https://clave@o1.ingest.us.sentry.io/1')).toMatchObject({ enabled: true });
  });
});
