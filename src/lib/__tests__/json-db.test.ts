import { describe, expect, it } from 'vitest';
import { count, getAll, getById, query } from '../json-db';

describe('json-db', () => {
  it('lee la colección de ejemplo', async () => {
    const result = await getAll('example');

    expect(result.total).toBeGreaterThan(0);
    expect(result.data[0]?.id).toBe('ex_001');
  });

  it('busca por id y permite filtrar', async () => {
    const record = await getById('example', 'ex_001');
    const active = await query('example', (item) => item.active === true);

    expect(record?.name).toBe('Registro de prueba');
    expect(active).toHaveLength(1);
  });

  it('cuenta registros de notas', async () => {
    await expect(count('note')).resolves.toBe(1);
  });
});