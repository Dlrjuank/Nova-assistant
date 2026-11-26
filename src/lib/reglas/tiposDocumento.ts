import { citaDePaginas, type CapituloLibro } from './libros';

/**
 * E20d (PROMPTS_AMPLIACION, E20d; M26): los tipos de documento y su "unidad". Se reusa el modelo de páginas: la
 * unidad es la página de un PDF, la sección de un Markdown o un Word, la diapositiva de un PowerPoint o la parte de
 * un texto. Funciones puras, compartidas por el servidor y el navegador.
 */

export const TIPOS_DOCUMENTO = ['pdf', 'pdf_escaneado', 'docx', 'md', 'txt', 'pptx', 'imagen'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];
export type Unidad = 'pagina' | 'diapositiva' | 'seccion' | 'parte';
/** Lo que agrupa cada fila de `capitulos`. */
export type TipoGrupo = 'capitulo' | 'seccion' | 'diapositiva' | 'parte';

export interface GrupoDocumento extends CapituloLibro {
  tipo: TipoGrupo;
}

/** Lo que sale de leer un archivo: el texto de cada unidad y sus grupos. */
export interface EstructuraDocumento {
  unidad: Unidad;
  unidades: string[];
  /** El número impreso de cada página (solo PDF). */
  etiquetas: string[] | null;
  grupos: GrupoDocumento[];
}

/** Lo que se puede subir, por extensión, con el tipo que se guarda y el que se declara a Blob. */
const ARCHIVOS: Record<string, { tipo: TipoDocumento; mime: string }> = {
  pdf: { tipo: 'pdf', mime: 'application/pdf' },
  md: { tipo: 'md', mime: 'text/markdown' },
  txt: { tipo: 'txt', mime: 'text/plain' },
};

export const EXTENSIONES_ADMITIDAS = Object.keys(ARCHIVOS);
export const TIPOS_MIME_ADMITIDOS = [...new Set(Object.values(ARCHIVOS).map((a) => a.mime))];
/** El `accept` del campo de archivo: extensiones y tipos, porque algunos navegadores no conocen el de Markdown. */
export const ACEPTA_ARCHIVOS = [...EXTENSIONES_ADMITIDAS.map((e) => `.${e}`), ...TIPOS_MIME_ADMITIDOS].join(',');

export function extensionDe(nombre: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(nombre.trim());
  return m ? (m[1] as string).toLowerCase() : '';
}

/** El tipo de un archivo por su extensión; null si no se admite. */
export function tipoDeArchivo(nombre: string): TipoDocumento | null {
  return ARCHIVOS[extensionDe(nombre)]?.tipo ?? null;
}

export function mimeDeArchivo(nombre: string): string | null {
  return ARCHIVOS[extensionDe(nombre)]?.mime ?? null;
}

/** El nombre que se ve en el sello y en el filtro. */
export const NOMBRE_TIPO: Record<TipoDocumento, string> = {
  pdf: 'PDF',
  pdf_escaneado: 'Escaneado',
  docx: 'Word',
  md: 'Markdown',
  txt: 'Texto',
  pptx: 'PowerPoint',
  imagen: 'Foto',
};

export function esTipoDocumento(valor: unknown): valor is TipoDocumento {
  return typeof valor === 'string' && (TIPOS_DOCUMENTO as readonly string[]).includes(valor);
}

const NOMBRES_UNIDAD: Record<Unidad, readonly [string, string]> = {
  pagina: ['página', 'páginas'],
  diapositiva: ['diapositiva', 'diapositivas'],
  seccion: ['sección', 'secciones'],
  parte: ['parte', 'partes'],
};

const NOMBRES_GRUPO: Record<TipoGrupo, readonly [string, string]> = {
  capitulo: ['capítulo', 'capítulos'],
  seccion: ['sección', 'secciones'],
  diapositiva: ['diapositiva', 'diapositivas'],
  parte: ['parte', 'partes'],
};

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "página" o "páginas"; con `mayus`, "Página". */
export function nombreUnidad(unidad: Unidad, plural = false, mayus = false): string {
  const texto = NOMBRES_UNIDAD[unidad][plural ? 1 : 0];
  return mayus ? mayuscula(texto) : texto;
}

export function nombreGrupo(tipo: TipoGrupo, plural = false, mayus = false): string {
  const texto = NOMBRES_GRUPO[tipo][plural ? 1 : 0];
  return mayus ? mayuscula(texto) : texto;
}

/** "12 páginas", "1 sección". */
export function contarUnidades(n: number, unidad: Unidad): string {
  return `${n} ${nombreUnidad(unidad, n !== 1)}`;
}

/** La unidad con que se citan las filas de un grupo: los capítulos, por páginas. */
export function unidadDeGrupo(tipo: TipoGrupo): Unidad {
  return tipo === 'capitulo' ? 'pagina' : tipo;
}

/** "los capítulos", "las secciones". */
export function gruposConArticulo(tipo: TipoGrupo): string {
  return `${tipo === 'capitulo' ? 'los' : 'las'} ${nombreGrupo(tipo, true)}`;
}

/** El grupo que corresponde a cada unidad: un libro tiene capítulos; los demás, grupos de su misma unidad. */
export function grupoDeUnidad(unidad: Unidad): TipoGrupo {
  return unidad === 'pagina' ? 'capitulo' : unidad;
}

/**
 * RB-36 con las unidades de E20d: "p. 45" o "pp. 45–46"; "diapositiva 7"; "parte 3"; y una sección por su título
 * ("Unidad 2"), o "sección 2" si no se conoce.
 */
export function citaDeUnidades(etiqueta: string, unidad: Unidad = 'pagina', titulo?: string | null): string {
  if (unidad === 'pagina') return citaDePaginas(etiqueta);
  if (unidad === 'seccion' && titulo?.trim()) return titulo.trim();
  return `${nombreUnidad(unidad, etiqueta.includes('–'))} ${etiqueta}`;
}
