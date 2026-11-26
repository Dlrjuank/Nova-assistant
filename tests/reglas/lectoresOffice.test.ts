// @vitest-environment node
// E20d-2: leer Word (.docx) y PowerPoint (.pptx) con archivos pequeños armados aquí mismo.
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { desescapar, leerDocx, leerPptx, nivelesDeEstilos } from '@/lib/lectores/office';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const parrafo = (t: string, estilo?: string, extra = '') =>
  `<w:p>${estilo || extra ? `<w:pPr>${estilo ? `<w:pStyle w:val="${estilo}"/>` : ''}${extra}</w:pPr>` : ''}<w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;

/** Estilos como los de un Word en español: el id cambia ("Ttulo1"), el nivel de esquema no. */
const ESTILOS = `<w:styles ${W}>
  <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Ttulo1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Ttulo2"><w:name w:val="heading 2"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="MiTitulo"><w:name w:val="Mi título"/><w:basedOn w:val="Ttulo1"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/></w:style>
</w:styles>`;

function docx(cuerpo: string, estilos = ESTILOS): Uint8Array {
  return zipSync({
    'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body>${cuerpo}<w:sectPr/></w:body></w:document>`),
    'word/styles.xml': strToU8(estilos),
    '[Content_Types].xml': strToU8('<Types/>'),
  });
}

describe('Word', () => {
  it('niveles de los estilos: nivel de esquema, nombre estándar y basedOn', () => {
    const n = nivelesDeEstilos(ESTILOS);
    expect([n.get('Ttulo1'), n.get('Ttulo2'), n.get('MiTitulo'), n.get('Heading3'), n.get('Normal')]).toEqual([1, 2, 1, 3, undefined]);
  });

  it('secciones por títulos, con listas, tablas y entidades', () => {
    const e = leerDocx(
      docx(
        [
          parrafo('Portada del curso'),
          parrafo('Unidad 1: Límites', 'Ttulo1'),
          parrafo('Un límite &amp; su idea.'),
          parrafo('Primer punto', undefined, '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'),
          parrafo('Laterales', 'Ttulo2'),
          '<w:tbl><w:tr><w:tc>' + parrafo('x') + '</w:tc><w:tc>' + parrafo('f(x)') + '</w:tc></w:tr></w:tbl>',
          parrafo('Detalle', 'Heading3'),
          parrafo('Unidad 2: Derivadas', 'MiTitulo'),
          parrafo('', 'Normal'),
          parrafo('La pendiente.'),
        ].join(''),
      ),
    );
    expect(e.unidad).toBe('seccion');
    expect(e.grupos.map((g) => [g.titulo, g.nivel, g.paginaInicio, g.paginaFin, g.tipo])).toEqual([
      ['Inicio', 1, 1, 1, 'seccion'],
      ['Unidad 1: Límites', 1, 2, 3, 'seccion'],
      ['Laterales', 2, 3, 3, 'seccion'],
      ['Unidad 2: Derivadas', 1, 4, 4, 'seccion'],
    ]);
    expect(e.unidades[1]).toBe('Unidad 1: Límites\n\nUn límite & su idea.\n\n• Primer punto');
    expect(e.unidades[2]).toBe('Laterales\n\nx | f(x)\n\nDetalle');
  });

  it('sin títulos, por partes; sin texto o sin ser un Word, el mensaje', () => {
    expect(leerDocx(docx(parrafo('Hola') + parrafo('Chao'))).unidad).toBe('parte');
    expect(() => leerDocx(docx(parrafo('')))).toThrow('El archivo no tiene texto.');
    expect(() => leerDocx(strToU8('no soy un zip'))).toThrow('El archivo no es un Word válido.');
    expect(() => leerDocx(zipSync({ 'otra/cosa.xml': strToU8('<x/>') }))).toThrow('El archivo no es un Word válido.');
  });

  it('entidades numéricas', () => {
    expect(desescapar('a&#233;&#xE1;&lt;b&gt;&quot;&apos;')).toBe('aéá<b>"\'');
  });
});

const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const forma = (tipo: string | null, ...parrafos: string[]) =>
  `<p:sp><p:nvSpPr><p:nvPr>${tipo ? `<p:ph type="${tipo}"/>` : ''}</p:nvPr></p:nvSpPr><p:txBody>${parrafos.map((t) => `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>`).join('')}</p:txBody></p:sp>`;
const diapositiva = (...formas: string[]) => strToU8(`<p:sld ${P}><p:cSld><p:spTree>${formas.join('')}</p:spTree></p:cSld></p:sld>`);
const rels = (...r: Array<[string, string, string]>) =>
  strToU8(`<Relationships>${r.map(([id, tipo, destino]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${tipo}" Target="${destino}"/>`).join('')}</Relationships>`);

function pptx(): Uint8Array {
  return zipSync({
    // El orden es el de presentation.xml, no el de los nombres: primero slide2.xml.
    'ppt/presentation.xml': strToU8(`<p:presentation ${P}><p:sldIdLst><p:sldId id="256" r:id="rId3"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>`),
    'ppt/_rels/presentation.xml.rels': rels(['rId2', 'slide', 'slides/slide1.xml'], ['rId3', 'slide', 'slides/slide2.xml']),
    'ppt/slides/slide2.xml': diapositiva(forma('ctrTitle', 'Clase 3: Derivadas'), forma('subTitle', 'Cálculo I'), forma('sldNum', '1')),
    'ppt/slides/slide1.xml': diapositiva(forma(null, 'Sin título, solo texto', 'Segunda línea')),
    'ppt/slides/_rels/slide2.xml.rels': rels(['rId1', 'notesSlide', '../notesSlides/notesSlide1.xml']),
    'ppt/notesSlides/notesSlide1.xml': strToU8(`<p:notes ${P}><p:cSld><p:spTree>${forma('sldImg')}${forma('body', 'Recordar el ejemplo')}${forma('sldNum', '1')}</p:spTree></p:cSld></p:notes>`),
  });
}

describe('PowerPoint', () => {
  it('diapositivas en orden, con título (o "Diapositiva N"), texto y notas; sin número de diapositiva', () => {
    const e = leerPptx(pptx());
    expect(e.unidad).toBe('diapositiva');
    expect(e.unidades).toEqual(['Clase 3: Derivadas\nCálculo I\nNotas: Recordar el ejemplo', 'Sin título, solo texto\nSegunda línea']);
    expect(e.grupos.map((g) => [g.titulo, g.paginaInicio, g.paginaFin, g.tipo])).toEqual([
      ['Clase 3: Derivadas', 1, 1, 'diapositiva'],
      ['Diapositiva 2', 2, 2, 'diapositiva'],
    ]);
  });

  it('no es un PowerPoint: el mensaje', () => {
    expect(() => leerPptx(strToU8('x'))).toThrow('El archivo no es un PowerPoint válido.');
  });
});
