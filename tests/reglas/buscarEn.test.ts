import { describe, expect, it } from 'vitest';
import { agruparPorTipo, filtrarDocumentos, normalizar } from '@/lib/reglas/buscarEn';

const docs = [
  { id: '1', nombre: 'Cálculo diferencial.pdf', tipo: 'pdf' as const },
  { id: '2', nombre: 'Foto del 26 de noviembre', tipo: 'imagen' as const },
  { id: '3', nombre: 'Apuntes de cálculo.docx', tipo: 'docx' as const },
  { id: '4', nombre: 'Física I.pdf', tipo: 'pdf_escaneado' as const },
];

describe('"Buscar en" con muchos documentos', () => {
  it('normaliza tildes y mayúsculas', () => {
    expect(normalizar('Cálculo FÍSICA')).toBe('calculo fisica');
  });

  it('filtra por todas las palabras, en cualquier orden y sin tildes; sin texto, todos', () => {
    expect(filtrarDocumentos(docs, 'calculo').map((d) => d.id)).toEqual(['1', '3']);
    expect(filtrarDocumentos(docs, 'calculo apuntes').map((d) => d.id)).toEqual(['3']);
    expect(filtrarDocumentos(docs, 'fisica')).toEqual([docs[3]]);
    expect(filtrarDocumentos(docs, '   ')).toEqual(docs);
    expect(filtrarDocumentos(docs, 'química')).toEqual([]);
  });

  it('agrupa por tipo en orden fijo (los PDF escaneados con los PDF) y respeta el orden dentro de cada grupo', () => {
    expect(agruparPorTipo(docs).map((g) => [g.grupo, g.documentos.map((d) => d.id)])).toEqual([
      ['PDF', ['1', '4']],
      ['Word', ['3']],
      ['Fotos', ['2']],
    ]);
  });
});
