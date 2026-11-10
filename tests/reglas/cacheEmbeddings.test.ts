// @vitest-environment node
// E10c2: un embedding guardado solo se reutiliza si coinciden el texto, el modelo y la dimensión.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { claveEmbedding, usarCacheEmbeddings, type Almacen } from '../../scripts/cache-embeddings';

const M = { modelo: 'modelo-a', dimension: 3 };
const crearAlmacen = (): Almacen & { datos: Map<string, number[]> } => {
  const datos = new Map<string, number[]>();
  return { datos, leer: (c) => datos.get(c), escribir: (c, v) => void datos.set(c, v) };
};
const crearCliente = () => ({
  generarEmbedding: vi.fn<(texto: string) => Promise<number[]>>(async () => [1, 1, 1]),
  generarEmbeddings: vi.fn<(textos: string[], opciones?: { interactivo?: boolean }) => Promise<number[][]>>(async (textos) => textos.map(() => [2, 2, 2])),
});

describe('clave', () => {
  const base = claveEmbedding('hola', 'consulta', M);
  it('es estable y no contiene el texto', () => {
    expect(claveEmbedding('hola', 'consulta', M)).toBe(base);
    expect(base).not.toContain('hola');
  });

  it.each([
    ['texto', claveEmbedding('otra', 'consulta', M)],
    ['modelo', claveEmbedding('hola', 'consulta', { ...M, modelo: 'modelo-b' })],
    ['dimensión', claveEmbedding('hola', 'consulta', { ...M, dimension: 768 })],
    ['tipo', claveEmbedding('hola', 'documento', M)],
  ])('cambia con otro %s', (_, clave) => {
    expect(clave).not.toBe(base);
  });
});

describe('cliente con caché', () => {
  let almacen: ReturnType<typeof crearAlmacen>;
  let cliente: ReturnType<typeof crearCliente>;
  let real: ReturnType<typeof crearCliente>;
  let contador: ReturnType<typeof usarCacheEmbeddings>;

  beforeEach(() => {
    almacen = crearAlmacen();
    real = crearCliente();
    cliente = { ...real };
    contador = usarCacheEmbeddings(cliente, almacen, M);
  });

  it('la segunda consulta igual no llama a Gemini', async () => {
    await cliente.generarEmbedding('hola');
    await expect(cliente.generarEmbedding('hola')).resolves.toEqual([1, 1, 1]);
    expect(real.generarEmbedding).toHaveBeenCalledTimes(1);
    expect(contador).toEqual({ reutilizados: 1, pedidos: 1 });
  });

  it('un lote pide solo lo que falta y conserva el orden', async () => {
    almacen.escribir(claveEmbedding('b', 'documento', M), [9, 9, 9]);
    await expect(cliente.generarEmbeddings(['a', 'b', 'c'])).resolves.toEqual([[2, 2, 2], [9, 9, 9], [2, 2, 2]]);
    expect(real.generarEmbeddings).toHaveBeenCalledWith(['a', 'c'], undefined);
    expect(contador).toEqual({ reutilizados: 1, pedidos: 2 });
  });

  it('sin nada que falte no llama a Gemini', async () => {
    almacen.escribir(claveEmbedding('a', 'documento', M), [9, 9, 9]);
    await cliente.generarEmbeddings(['a']);
    expect(real.generarEmbeddings).not.toHaveBeenCalled();
  });

  it('un vector de otra longitud no se reutiliza', async () => {
    almacen.escribir(claveEmbedding('hola', 'consulta', M), [1, 2]);
    await cliente.generarEmbedding('hola');
    expect(real.generarEmbedding).toHaveBeenCalledTimes(1);
  });

  it('un error de Gemini no guarda nada', async () => {
    real.generarEmbedding.mockRejectedValueOnce(new Error('cuota'));
    cliente = { ...real };
    usarCacheEmbeddings(cliente, almacen, M);
    await expect(cliente.generarEmbedding('hola')).rejects.toThrow('cuota');
    expect(almacen.datos.size).toBe(0);
  });
});
