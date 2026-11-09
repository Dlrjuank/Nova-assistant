// @vitest-environment node
// E10b: extracción real con unpdf sobre PDF generados (sin red ni base).
import { describe, expect, it } from 'vitest';
import { extraerPdf } from '@/lib/pdf/extraer';
import { detectarCapitulos } from '@/lib/reglas/libros';
import { generarLibroPdf, libroDeEjemplo } from '../../scripts/pdf-libro';

describe('extraerPdf', () => {
  it('saca el texto de cada página, los números impresos y el índice interno', async () => {
    const pdf = await extraerPdf(libroDeEjemplo());
    expect(pdf.paginas).toHaveLength(40);
    expect(pdf.paginas[0]).toContain('PAGINA-i.');
    expect(pdf.paginas[11]).toContain('PAGINA-10.');
    expect(pdf.etiquetas?.slice(0, 4)).toEqual(['i', 'ii', '1', '2']);
    expect(pdf.indice.slice(0, 3)).toEqual([
      { titulo: 'Capítulo 1: Las células', pagina: 3, nivel: 1 },
      { titulo: '1.1 Partes de la célula', pagina: 3, nivel: 2 },
      { titulo: '1.2 División celular', pagina: 8, nivel: 2 },
    ]);
    const capitulos = detectarCapitulos(pdf.paginas, pdf.indice, pdf.etiquetas).filter((c) => c.nivel === 1);
    expect(capitulos.map((c) => c.etiquetaPaginas)).toEqual(['1–10', '11–19', '20–28', '29–38']);
  });

  it('sin índice ni números impresos, las líneas permiten hallar los encabezados', async () => {
    const pdf = await extraerPdf(generarLibroPdf({ paginas: [['Portada'], ['Capítulo 1', 'Primeros pasos', 'Texto.'], ['Más.'], ['Capítulo 2: Segundo', 'Texto.']] }));
    expect(pdf.indice).toEqual([]);
    expect(pdf.etiquetas).toBeNull();
    expect(detectarCapitulos(pdf.paginas, pdf.indice, pdf.etiquetas).map((c) => [c.titulo, c.etiquetaPaginas])).toEqual([
      ['Capítulo 1: Primeros pasos', '2–3'],
      ['Capítulo 2: Segundo', '4'],
    ]);
  });

  it('un archivo que no es PDF es PDF_INVALIDO', async () => {
    const consola = console.error;
    console.error = () => {};
    await expect(extraerPdf(new TextEncoder().encode('no soy un pdf'))).rejects.toMatchObject({ codigo: 'PDF_INVALIDO' });
    console.error = consola;
  });
});
