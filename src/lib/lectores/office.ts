import { unzipSync, type Unzipped } from 'fflate';
import { PDF_MAX_PAGINAS } from '@/lib/config/nova';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { conPaginaFinal } from '@/lib/reglas/libros';
import { contarUnidades, nombreUnidad, type EstructuraDocumento } from '@/lib/reglas/tiposDocumento';
import { seccionesPorTitulos } from './texto';

/**
 * E20d-2: leer Word (.docx) y PowerPoint (.pptx). Los dos son un ZIP con XML; se leen con `fflate` y expresiones
 * regulares sobre el XML (sin DOM en el servidor). Las imágenes de adentro no se leen.
 * - Word: párrafos, listas y tablas de `word/document.xml`; las secciones salen de los estilos con nivel de esquema
 *   (`w:outlineLvl` en `styles.xml`, así sirve "Título 1" en un Word en español) y se cortan como en un Markdown.
 * - PowerPoint: cada diapositiva en el orden de `presentation.xml`, con su título (marcador `title` o `ctrTitle`),
 *   su texto y las notas del orador.
 */

/** Un ZIP que se infla a más de esto es sospechoso (bomba de compresión). */
const MAX_INFLADO = 60 * 1024 * 1024;

function abrirZip(bytes: Uint8Array, quiere: (nombre: string) => boolean, tipo: string): Unzipped {
  let total = 0;
  try {
    return unzipSync(bytes, {
      filter: (archivo) => {
        if (!quiere(archivo.name)) return false;
        total += archivo.originalSize;
        if (total > MAX_INFLADO) throw new ErrorDeNegocio('ARCHIVO_MUY_GRANDE');
        return true;
      },
    });
  } catch (error) {
    if (error instanceof ErrorDeNegocio) throw error;
    throw new ErrorDeNegocio('PDF_INVALIDO', `El archivo no es un ${tipo} válido.`);
  }
}

const texto = (u: Uint8Array | undefined) => (u ? new TextDecoder('utf-8').decode(u) : '');

/** Las entidades de XML: &amp; &lt; &gt; &quot; &apos; y las numéricas. */
export function desescapar(t: string): string {
  return t.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    const minus = e.toLowerCase();
    if (minus === 'amp') return '&';
    if (minus === 'lt') return '<';
    if (minus === 'gt') return '>';
    if (minus === 'quot') return '"';
    if (minus === 'apos') return "'";
    const codigo = minus.startsWith('#x') ? parseInt(minus.slice(2), 16) : parseInt(minus.slice(1), 10);
    return Number.isFinite(codigo) && codigo > 0 && codigo <= 0x10ffff ? String.fromCodePoint(codigo) : '';
  });
}

const atributo = (xml: string, etiqueta: string, nombre: string): string | null => {
  const m = new RegExp(`<${etiqueta}\\b[^>]*\\b${nombre}="([^"]*)"`).exec(xml);
  return m ? (m[1] as string) : null;
};

// ---------------------------------------------------------------- Word

/** El texto de un párrafo de Word: sus `w:t`, con tabulaciones y saltos. */
function textoDeParrafoWord(xml: string): string {
  let salida = '';
  for (const m of xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:(?:br|cr)\b[^>]*\/>/g)) {
    if (m[1] !== undefined) salida += desescapar(m[1]);
    else salida += m[0].startsWith('<w:tab') ? '\t' : '\n';
  }
  return salida.replace(/[ \t]+/g, ' ').trim();
}

/** El nivel (1 a 9) de cada estilo de párrafo con nivel de esquema, siguiendo `basedOn`. */
export function nivelesDeEstilos(estilos: string): Map<string, number> {
  const directos = new Map<string, { nivel: number | null; base: string | null }>();
  for (const m of estilos.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    const cabecera = m[1] as string;
    const cuerpo = m[2] as string;
    if (!/w:type="paragraph"/.test(cabecera)) continue;
    const id = /w:styleId="([^"]*)"/.exec(cabecera)?.[1];
    if (!id) continue;
    const esquema = atributo(cuerpo, 'w:outlineLvl', 'w:val');
    // Sin nivel de esquema explícito, el nombre estándar "heading N" (el id cambia con el idioma; el nombre no).
    const nombre = atributo(cuerpo, 'w:name', 'w:val');
    const porNombre = nombre ? /^heading\s+([1-9])$/i.exec(nombre)?.[1] : undefined;
    const nivel = esquema !== null ? Number(esquema) + 1 : porNombre ? Number(porNombre) : null;
    directos.set(id, { nivel: nivel !== null && nivel >= 1 && nivel <= 9 ? nivel : null, base: atributo(cuerpo, 'w:basedOn', 'w:val') });
  }
  const niveles = new Map<string, number>();
  for (const id of directos.keys()) {
    let actual: string | null = id;
    for (let i = 0; actual && i < 10; i++) {
      const e = directos.get(actual);
      if (!e) break;
      if (e.nivel !== null) {
        niveles.set(id, e.nivel);
        break;
      }
      actual = e.base;
    }
  }
  return niveles;
}

/** Cada fila de una tabla pasa a ser un párrafo con sus celdas separadas por " | ". */
function tablasComoParrafos(cuerpo: string): string {
  return cuerpo.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, (fila) => {
    const celdas = [...fila.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map((c) =>
      [...(c[0] as string).matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((p) => textoDeParrafoWord(p[0] as string)).filter((t) => t !== '').join(' '),
    );
    const unidas = celdas.filter((c) => c !== '').join(' | ');
    return `<w:p><w:r><w:t>${unidas.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</w:t></w:r></w:p>`;
  });
}

export function leerDocx(bytes: Uint8Array): EstructuraDocumento {
  const zip = abrirZip(bytes, (n) => n === 'word/document.xml' || n === 'word/styles.xml', 'Word');
  const documento = texto(zip['word/document.xml']);
  if (!documento) throw new ErrorDeNegocio('PDF_INVALIDO', 'El archivo no es un Word válido.');
  const niveles = nivelesDeEstilos(texto(zip['word/styles.xml']));
  const cuerpo = tablasComoParrafos(/<w:body\b[^>]*>([\s\S]*)<\/w:body>/.exec(documento)?.[1] ?? documento);

  const lineas: string[] = [];
  const titulos: Array<{ linea: number; nivel: number; titulo: string }> = [];
  for (const m of cuerpo.matchAll(/<w:p\b(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/w:p>)/g)) {
    const xml = m[1] ?? '';
    const contenido = textoDeParrafoWord(xml);
    if (contenido === '') continue;
    const estilo = atributo(xml, 'w:pStyle', 'w:val');
    const esquema = atributo(xml, 'w:outlineLvl', 'w:val');
    const nivel = esquema !== null ? Number(esquema) + 1 : estilo ? (niveles.get(estilo) ?? null) : null;
    if (nivel !== null && nivel <= 3) titulos.push({ linea: lineas.length, nivel, titulo: contenido.replace(/\s+/g, ' ').slice(0, 200) });
    const esLista = /<w:numPr\b/.test(xml) && nivel === null;
    lineas.push(esLista ? `• ${contenido}` : contenido);
  }
  return seccionesPorTitulos(lineas, titulos, '\n\n');
}

// ---------------------------------------------------------------- PowerPoint

/** Los párrafos (`a:p`) de un fragmento de DrawingML, cada uno con sus `a:t` unidos. */
function parrafosDrawing(xml: string): string[] {
  return [...xml.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)]
    .map((p) =>
      [...(p[0] as string).matchAll(/<a:t>([\s\S]*?)<\/a:t>|<a:br\b[^>]*\/>/g)]
        .map((t) => (t[1] !== undefined ? desescapar(t[1]) : '\n'))
        .join('')
        .replace(/[ \t]+/g, ' ')
        .trim(),
    )
    .filter((t) => t !== '');
}

const MARCADORES_SIN_TEXTO = /<p:ph\b[^>]*type="(?:sldNum|hdr|ftr|dt|sldImg)"/;

/** Título y cuerpo de una diapositiva; las formas de número, fecha o pie no cuentan. */
function leerDiapositiva(xml: string): { titulo: string; cuerpo: string[] } {
  let titulo = '';
  const cuerpo: string[] = [];
  const formas = [...xml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>|<p:graphicFrame\b[\s\S]*?<\/p:graphicFrame>/g)].map((f) => f[0] as string);
  for (const forma of formas) {
    if (MARCADORES_SIN_TEXTO.test(forma)) continue;
    const parrafos = parrafosDrawing(forma);
    if (!titulo && /<p:ph\b[^>]*type="(?:title|ctrTitle)"/.test(forma)) titulo = parrafos.join(' ').slice(0, 200);
    else cuerpo.push(...parrafos);
  }
  return { titulo, cuerpo };
}

function relaciones(xml: string): Map<string, { destino: string; tipo: string }> {
  const mapa = new Map<string, { destino: string; tipo: string }>();
  for (const m of xml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const a = m[1] as string;
    const id = /\bId="([^"]*)"/.exec(a)?.[1];
    const destino = /\bTarget="([^"]*)"/.exec(a)?.[1];
    if (id && destino) mapa.set(id, { destino, tipo: /\bType="([^"]*)"/.exec(a)?.[1] ?? '' });
  }
  return mapa;
}

/** "slides/slide1.xml" desde "ppt/" → "ppt/slides/slide1.xml"; "../notesSlides/x.xml" desde "ppt/slides/" → "ppt/notesSlides/x.xml". */
function resolver(base: string, destino: string): string {
  const partes = (destino.startsWith('/') ? destino.slice(1) : `${base}${destino}`).split('/');
  const salida: string[] = [];
  for (const p of partes) {
    if (p === '..') salida.pop();
    else if (p !== '.' && p !== '') salida.push(p);
  }
  return salida.join('/');
}

export function leerPptx(bytes: Uint8Array): EstructuraDocumento {
  const zip = abrirZip(bytes, (n) => n === 'ppt/presentation.xml' || n === 'ppt/_rels/presentation.xml.rels' || /^ppt\/(slides|notesSlides)\/(_rels\/)?[^/]+\.xml(\.rels)?$/.test(n), 'PowerPoint');
  const presentacion = texto(zip['ppt/presentation.xml']);
  if (!presentacion) throw new ErrorDeNegocio('PDF_INVALIDO', 'El archivo no es un PowerPoint válido.');
  const rels = relaciones(texto(zip['ppt/_rels/presentation.xml.rels']));
  const orden = [...presentacion.matchAll(/<p:sldId\b[^>]*\br:id="([^"]*)"/g)]
    .map((m) => rels.get(m[1] as string))
    .filter((r): r is { destino: string; tipo: string } => r !== undefined)
    .map((r) => resolver('ppt/', r.destino));
  if (orden.length > PDF_MAX_PAGINAS) {
    throw new ErrorDeNegocio('PDF_MUY_LARGO', `El archivo tiene ${contarUnidades(orden.length, 'diapositiva')}; el máximo es ${PDF_MAX_PAGINAS}.`);
  }

  const unidades: string[] = [];
  const entradas: Array<{ titulo: string; pagina: number; nivel: number }> = [];
  orden.forEach((ruta, i) => {
    const { titulo, cuerpo } = leerDiapositiva(texto(zip[ruta]));
    const nombre = ruta.split('/').pop() as string;
    const relsDiapositiva = relaciones(texto(zip[`ppt/slides/_rels/${nombre}.rels`]));
    const notas = [...relsDiapositiva.values()].find((r) => r.tipo.endsWith('/notesSlide'));
    const textoNotas = notas ? leerDiapositiva(texto(zip[resolver('ppt/slides/', notas.destino)])).cuerpo : [];
    unidades.push([titulo, ...cuerpo, ...(textoNotas.length > 0 ? [`Notas: ${textoNotas.join(' ')}`] : [])].filter((t) => t !== '').join('\n'));
    entradas.push({ titulo: titulo || `${nombreUnidad('diapositiva', false, true)} ${i + 1}`, pagina: i + 1, nivel: 1 });
  });
  if (unidades.join(' ').trim() === '') throw new ErrorDeNegocio('PDF_SIN_TEXTO', 'El archivo no tiene texto.');
  return {
    unidad: 'diapositiva',
    unidades,
    etiquetas: null,
    grupos: conPaginaFinal(entradas, unidades.length, null).map((g) => ({ ...g, tipo: 'diapositiva' as const })),
  };
}
