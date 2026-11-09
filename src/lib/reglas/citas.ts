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

function citasDe(contenido: string): Cita[] | null {
  const citas = contenido.split(/\s*[;,]\s*|\s+y\s+/).map(leerCita);
  return citas.every(Boolean) ? (citas as Cita[]) : null;
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

function compactarLinea(linea: string, conDocumento: boolean, limite: Rango | null): string {
  const tokens: Array<{ inicio: number; fin: number; citas: Cita[] }> = [];
  for (const m of linea.matchAll(CORCHETES)) {
    const citas = citasDe(m[1] as string);
    if (citas) tokens.push({ inicio: m.index, fin: m.index + m[0].length, citas });
  }
  if (tokens.length === 0) return linea;

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

  let resultado = '';
  let posicion = 0;
  tokens.forEach((token, i) => {
    const texto = (salida[i] as string[]).join(' ');
    const antes = linea.slice(posicion, token.inicio);
    resultado += texto ? antes + texto : antes.replace(/\s+$/, '');
    posicion = token.fin;
  });
  return resultado + linea.slice(posicion);
}

/**
 * Deja las citas cortas ("[p. 20]", "[pp. 20–21]"), une las páginas seguidas de cada párrafo en un solo rango y,
 * con `limite` (las páginas de un capítulo), no deja citas fuera de él. Si el texto cita varios documentos,
 * cada cita conserva su nombre.
 */
export function compactarCitas(texto: string, opciones: { limite?: string | undefined } = {}): string {
  const documentos = new Set<string>();
  for (const m of texto.matchAll(CORCHETES)) {
    for (const c of citasDe(m[1] as string) ?? []) if (c.documento) documentos.add(c.documento);
  }
  const limite = opciones.limite ? rangoDe(opciones.limite) : null;
  return texto
    .split('\n')
    .map((linea) => compactarLinea(linea, documentos.size > 1, limite))
    .join('\n');
}

/** Lo que se cita dentro del texto, sin el nombre del documento: para reconocer "[p. 20]" en una respuesta. */
export function citaCorta(etiquetaFuente: string): string | null {
  const c = leerCita(etiquetaFuente);
  return c ? `[${etiquetaFuente.slice(etiquetaFuente.lastIndexOf(' · ') + 3)}]` : null;
}
