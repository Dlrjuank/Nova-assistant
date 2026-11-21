// E20b (commit 1): los avisos de la navegación (globo de Tareas, tarjeta de la barra lateral y perfil).
import { describe, expect, it } from 'vitest';
import { avisoLateral, cuandoEs, inicialPerfil, nombrePerfil } from '@/lib/reglas/avisos';

const HOY = '2026-11-17'; // martes
const CORTE = { materiaId: 'm1', materia: 'Cálculo', corte: 'Corte 2', fecha: '2026-11-20' };

describe('avisos de la navegación', () => {
  it('cuándo es: hoy, mañana, un día de esta semana o una fecha más lejana', () => {
    expect(cuandoEs('2026-11-17', HOY)).toBe('Hoy');
    expect(cuandoEs('2026-11-18', HOY)).toBe('Mañana');
    expect(cuandoEs('2026-11-20', HOY)).toBe('El viernes 20');
    expect(cuandoEs('2026-11-23', HOY)).toBe('El lunes 23');
    expect(cuandoEs('2026-12-12', HOY)).toBe('El 12 de diciembre');
  });

  it('primero las vencidas (lo urgente), luego el próximo corte, si no, ninguno', () => {
    expect(avisoLateral({ vencidas: 1, proximoCorte: CORTE }, HOY)).toEqual({ etiqueta: 'Aviso', titulo: '1 tarea vencida', texto: 'Revísala en Tareas.', href: '/nova/tareas?vista=vencidas' });
    expect(avisoLateral({ vencidas: 3, proximoCorte: null }, HOY)?.titulo).toBe('3 tareas vencidas');
    expect(avisoLateral({ vencidas: 0, proximoCorte: CORTE }, HOY)).toEqual({ etiqueta: 'Próximo corte', titulo: 'Corte 2 de Cálculo', texto: 'El viernes 20.', href: '/nova/semestre/m1' });
    expect(avisoLateral({ vencidas: 0, proximoCorte: null }, HOY)).toBeNull();
  });

  it('el perfil: el nombre de Configuración o lo que va antes de la @; la inicial en mayúscula', () => {
    expect(nombrePerfil('  Juan ', 'juan@ejemplo.com')).toBe('Juan');
    expect(nombrePerfil('', 'estudiante@ejemplo.com')).toBe('estudiante');
    expect(inicialPerfil('ángela')).toBe('Á');
    expect(inicialPerfil('')).toBe('·');
  });
});
