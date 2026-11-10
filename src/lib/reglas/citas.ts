/**
 * RB-36 (ajuste del usuario, 2026-11-09): citas cortas dentro del texto. El nombre del documento va en "Fuentes";
 * solo se conserva en la cita si la respuesta usa varios documentos. Se hace en el servidor para no depender
 * de cómo las escriba el modelo. Funciones puras.
 */

interface Rango {
  inicio: number;
  fin: number;
}

function rangoDe(etiqueta: string): Rango | null {
  const [a, b] = etiqueta.replaceAll('-', '–').split('–');
  const inicio = Number(a);
  const fin = b === undefined ? inicio : Number(b);
  return a !== undefined && /^\d+$/.test(a.trim()) && (b === undefined || /^\d+$/.test(b.trim())) && fin >= inicio ? { inicio, fin } : null;
}

const aEtiqueta = ({ inicio, fin }: Rango) => (inicio === fin ? String(inicio) : `${inicio}–${fin}`);

/** Limita una etiqueta de páginas al rango dado. Si alguna no es numérica o no se cruzan, la deja igual. */
export function recortarEtiqueta(etiqueta: string, limite: string): string {
  const r = rangoDe(etiqueta);
  const l = rangoDe(limite);
  if (!r || !l) return etiqueta;
  const inicio = Math.max(r.inicio, l.inicio);
  const fin = Math.min(r.fin, l.fin);
  return inicio <= fin ? aEtiqueta({ inicio, fin }) : etiqueta;
}

interface Cita {
  documento: string | null;
  etiqueta: string;
  rango: Rango | null;
}

/** Una cita de páginas, con o sin nombre de documento; null si es otra cosa ("Tarea 1a2b", "fragmento 3"). */
function leerCita(texto: string): Cita | null {
  const m = /^(?:(.+?)\s+·\s+)?pp?\.\s*([^\s].*)$/.exec(texto.trim());
  if (!m) return null;
  const etiqueta = (m[2] as string).trim().replaceAll('-', '–');
  if (etiqueta.includes(' ')) return null;
  return { documento: m[1] ?? null, etiqueta, rango: rangoDe(etiqueta) };
}

const CORCHETES = /\[([^[\]]+)\]/g;

/** Un corchete puede traer varias citas, y las últimas sin repetir el nombre: "[l.pdf · pp. 16–17, 18–19, 19]". */
function citasDe(contenido: string): Cita[] | null {
  const citas: Cita[] = [];
  for (const parte of contenido.split(/\s*[;,]\s*|\s+y\s+/)) {
    const previa = citas.at(-1);
    const sola = /^(?:pp?\.\s*)?(\d+(?:[-–]\d+)?)$/.exec(parte.trim());
    if (previa && sola) {
      const etiqueta = (sola[1] as string).replaceAll('-', '–');
      citas.push({ documento: previa.documento, etiqueta, rango: rangoDe(etiqueta) });
      continue;
    }
    const cita = leerCita(parte);
    if (!cita) return null;
    citas.push(cita);
  }
  return citas.length > 0 ? citas : null;
}

const formatear = (c: Cita, conDocumento: boolean) => {
  const paginas = c.etiqueta.includes('–') ? `pp. ${c.etiqueta}` : `p. ${c.etiqueta}`;
  return `[${conDocumento && c.documento ? `${c.documento} · ` : ''}${paginas}]`;
};

function aplicarLimite(c: Cita, limite: Rango | null): Cita | null {
  if (!limite || !c.rango) return c;
  const inicio = Math.max(c.rango.inicio, limite.inicio);
  const fin = Math.min(c.rango.fin, limite.fin);
  if (inicio > fin) return null; // fuera del capítulo
  const rango = { inicio, fin };
  return { ...c, rango, etiqueta: aEtiqueta(rango) };
}

const MARCA_DE_LISTA = /^\s*(?:[-*•]|\d+[.)])\s+/;
const SOLO_SEPARADORES = /^[\s,;]*(?:\b[ye]\b)?[\s,;]*$/;

/**
 * Limpia lo que queda al quitar o unir citas: separadores repetidos o sueltos, paréntesis vacíos y espacios
 * dobles. Solo se aplica a líneas con citas, y respeta la marca de lista del comienzo.
 */
function limpiarSeparadores(linea: string): string {
  const marca = MARCA_DE_LISTA.exec(linea)?.[0] ?? '';
  const resto = linea
    .slice(marca.length)
    .replace(/\(\s*\)/g, '')
    .replace(/,(?:\s*,)+/g, ',')
    .replace(/;(?:\s*;)+/g, ';')
    .replace(/[,;]\s*(?=[.)\]])/g, '')
    .replace(/(\S)\s+([,.;:])(?=\s|$)/g, '$1$2')
    .replace(/(\S) {2,}(?=\S)/g, '$1 ');
  return marca + resto.trimEnd();
}

/** Deja el texto anterior a una cita quitada sin el separador que la unía a lo anterior. */
const sinSeparadorFinal = (texto: string) => texto.replace(/[\s,;]*(?:\s[ye])?[\s,;]*$/, '');

function compactarLinea(linea: string, conDocumento: boolean, limite: Rango | null): string {
  const tokens: Array<{ inicio: number; fin: number; citas: Cita[] }> = [];
  for (const m of linea.matchAll(CORCHETES)) {
    const citas = citasDe(m[1] as string);
    if (citas) tokens.push({ inicio: m.index, fin: m.index + m[0].length, citas });
  }
  if (tokens.length === 0) return linea;

  // Citas separadas solo por comas, "y" o espacios forman un grupo; se ordenan para que unan aunque lleguen en desorden.
  const grupos: Array<{ inicio: number; fin: number; conComa: boolean }> = [];
  for (let i = 0; i < tokens.length; ) {
    let j = i;
    let conComa = false;
    for (; j + 1 < tokens.length; j++) {
      const hueco = linea.slice((tokens[j] as (typeof tokens)[number]).fin, (tokens[j + 1] as (typeof tokens)[number]).inicio);
      if (!SOLO_SEPARADORES.test(hueco)) break;
      if (/[,;]/.test(hueco)) conComa = true;
    }
    grupos.push({ inicio: i, fin: j, conComa });
    const todas = tokens.slice(i, j + 1).flatMap((t) => t.citas);
    todas.sort((a, b) => (a.documento ?? '').localeCompare(b.documento ?? '') || (a.rango?.inicio ?? 0) - (b.rango?.inicio ?? 0));
    for (let k = i; k < j; k++) (tokens[k] as (typeof tokens)[number]).citas = [];
    (tokens[j] as (typeof tokens)[number]).citas = todas;
    i = j + 1;
  }

  // Une las citas seguidas de la línea: la unión queda en el lugar de la última.
  const salida: string[][] = tokens.map(() => []);
  let actual: { cita: Cita; token: number } | null = null;
  const cerrar = () => {
    if (actual) (salida[actual.token] as string[]).push(formatear(actual.cita, conDocumento));
    actual = null;
  };
  tokens.forEach((token, i) => {
    for (const original of token.citas) {
      const cita = aplicarLimite(original, limite);
      if (!cita) continue;
      const previo: { cita: Cita; token: number } | null = actual;
      const mismoDocumento = !previo || !conDocumento || previo.cita.documento === cita.documento;
      if (previo && mismoDocumento && previo.cita.rango && cita.rango && cita.rango.inicio <= previo.cita.rango.fin + 1 && cita.rango.fin >= previo.cita.rango.inicio - 1) {
        const rango = { inicio: Math.min(previo.cita.rango.inicio, cita.rango.inicio), fin: Math.max(previo.cita.rango.fin, cita.rango.fin) };
        actual = { cita: { ...previo.cita, rango, etiqueta: aEtiqueta(rango) }, token: i };
      } else if (previo && mismoDocumento && previo.cita.etiqueta === cita.etiqueta) {
        actual = { cita: previo.cita, token: i };
      } else {
        cerrar();
        actual = { cita, token: i };
      }
    }
  });
  cerrar();

  // Cada grupo se limpia junto, con un solo separador entre las citas que quedan.
  let resultado = '';
  let posicion = 0;
  for (const { inicio: i, fin: j, conComa } of grupos) {
    const grupo = salida.slice(i, j + 1);
    const quedan = grupo.flat();
    let antes = linea.slice(posicion, (tokens[i] as (typeof tokens)[number]).inicio);
    if (quedan.length === 0) {
      resultado += sinSeparadorFinal(antes);
    } else {
      if (grupo.some((s) => s.length === 0)) {
        const limpio = antes.replace(/[\s,;]+$/, '');
        antes = limpio && !/[([]$/.test(limpio) ? `${limpio} ` : limpio;
      }
      resultado += antes + quedan.join(conComa ? ', ' : ' ');
    }
    posicion = (tokens[j] as (typeof tokens)[number]).fin;
  }
  return limpiarSeparadores(resultado + linea.slice(posicion));
}

/** Las citas de una línea, como aparecen en ella. */
function citasDeLinea(linea: string): string[] {
  return [...linea.matchAll(CORCHETES)].filter((m) => citasDe(m[1] as string)).map((m) => m[0]);
}

function quitarCita(linea: string, cita: string): string {
  const posicion = linea.indexOf(cita);
  return limpiarSeparadores(sinSeparadorFinal(linea.slice(0, posicion)) + linea.slice(posicion + cita.length));
}

/** Viñetas y números son listas distintas, igual que dos niveles de sangría. */
function tipoDeLista(linea: string): string | null {
  const m = /^(\s*)(?:([-*•])|\d+[.)])\s+/.exec(linea);
  return m ? `${m[1]?.length}:${m[2] ? 'viñeta' : 'número'}` : null;
}

/** Si todos los puntos seguidos de una lista tienen la misma cita, queda una sola vez, al final de la lista. */
function unirCitasDeListas(lineas: string[]): string[] {
  const resultado = [...lineas];
  for (let i = 0; i < resultado.length; i++) {
    const tipo = tipoDeLista(resultado[i] as string);
    if (tipo === null) continue;
    let fin = i;
    while (tipoDeLista(resultado[fin + 1] ?? '') === tipo) fin++;
    const citas = resultado.slice(i, fin + 1).map((l) => citasDeLinea(l));
    const primera = (citas[0] as string[]).join(' ');
    if (fin > i && primera !== '' && citas.every((c) => c.join(' ') === primera)) {
      for (let k = i; k < fin; k++) {
        for (const cita of citas[k - i] as string[]) resultado[k] = quitarCita(resultado[k] as string, cita);
      }
    }
    i = fin;
  }
  return resultado;
}

/**
 * Deja las citas cortas ("[p. 20]", "[pp. 20–21]"), une las páginas seguidas de cada párrafo en un solo rango y,
 * con `limite` (las páginas de un capítulo), no deja citas fuera de él. Si el texto cita varios documentos,
 * cada cita conserva su nombre. En una lista donde todos los puntos tienen la misma cita, queda una sola al final.
 */
export function compactarCitas(texto: string, opciones: { limite?: string | undefined } = {}): string {
  const documentos = new Set<string>();
  for (const m of texto.matchAll(CORCHETES)) {
    for (const c of citasDe(m[1] as string) ?? []) if (c.documento) documentos.add(c.documento);
  }
  const limite = opciones.limite ? rangoDe(opciones.limite) : null;
  return unirCitasDeListas(texto.split('\n').map((linea) => compactarLinea(linea, documentos.size > 1, limite))).join('\n');
}

/** Lo que se cita dentro del texto, sin el nombre del documento: para reconocer "[p. 20]" en una respuesta. */
export function citaCorta(etiquetaFuente: string): string | null {
  const c = leerCita(etiquetaFuente);
  return c ? `[${etiquetaFuente.slice(etiquetaFuente.lastIndexOf(' · ') + 3)}]` : null;
}
