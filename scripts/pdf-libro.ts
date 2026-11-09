// Genera PDF reales de prueba (sin datos personales), con índice interno y números de página impresos.
// Lo usan las pruebas de extracción y scripts/probar-libro.ts. Ejecutado directamente, guarda un libro de ejemplo:
//   npx tsx scripts/pdf-libro.ts ruta/del/libro.pdf
import { writeFileSync } from 'node:fs';

export interface Marcador {
  titulo: string;
  pagina: number; // desde 1
  hijos?: Marcador[];
}

export function generarLibroPdf(opciones: { paginas: string[][]; marcadores?: Marcador[]; romanas?: number }): Uint8Array {
  const { paginas, marcadores = [], romanas = 0 } = opciones;
  const escapar = (t: string) => t.replace(/([\\()])/g, '\\$1');
  const objetos: string[] = [];
  const reservar = () => objetos.push('') - 1 + 1; // números de objeto desde 1
  const poner = (id: number, cuerpo: string) => {
    objetos[id - 1] = cuerpo;
  };

  const catalogo = reservar();
  const arbol = reservar();
  const fuente = reservar();
  poner(fuente, '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>');

  const idsPagina = paginas.map((lineas) => {
    const pagina = reservar();
    const contenido = reservar();
    const flujo = `BT /F1 10 Tf 40 780 Td 12 TL\n${lineas.map((l) => `(${escapar(l)}) Tj T*`).join('\n')}\nET`;
    poner(contenido, `<</Length ${Buffer.byteLength(flujo, 'latin1')}>>stream\n${flujo}\nendstream`);
    poner(pagina, `<</Type/Page/Parent ${arbol} 0 R/MediaBox[0 0 612 792]/Contents ${contenido} 0 R/Resources<</Font<</F1 ${fuente} 0 R>>>>>>`);
    return pagina;
  });
  poner(arbol, `<</Type/Pages/Kids[${idsPagina.map((p) => `${p} 0 R`).join(' ')}]/Count ${idsPagina.length}>>`);

  // Índice interno: cada nivel es una lista enlazada con su padre.
  const escribirNivel = (items: Marcador[], padre: number): { primero: number; ultimo: number; cuenta: number } => {
    const ids = items.map(() => reservar());
    let cuenta = 0;
    items.forEach((m, i) => {
      const hijos = m.hijos?.length ? escribirNivel(m.hijos, ids[i] as number) : null;
      cuenta += 1 + (hijos?.cuenta ?? 0);
      const partes = [
        `/Title(${escapar(m.titulo)})`,
        `/Parent ${padre} 0 R`,
        `/Dest[${idsPagina[m.pagina - 1]} 0 R/Fit]`,
        i > 0 ? `/Prev ${ids[i - 1]} 0 R` : '',
        i < items.length - 1 ? `/Next ${ids[i + 1]} 0 R` : '',
        hijos ? `/First ${hijos.primero} 0 R/Last ${hijos.ultimo} 0 R/Count ${hijos.cuenta}` : '',
      ];
      poner(ids[i] as number, `<<${partes.join('')}>>`);
    });
    return { primero: ids[0] as number, ultimo: ids[ids.length - 1] as number, cuenta };
  };

  let extras = '';
  if (marcadores.length > 0) {
    const raiz = reservar();
    const nivel = escribirNivel(marcadores, raiz);
    poner(raiz, `<</Type/Outlines/First ${nivel.primero} 0 R/Last ${nivel.ultimo} 0 R/Count ${nivel.cuenta}>>`);
    extras += `/Outlines ${raiz} 0 R`;
  }
  if (romanas > 0) extras += `/PageLabels<</Nums[0<</S/r>>${romanas}<</S/D>>]>>`;
  poner(catalogo, `<</Type/Catalog/Pages ${arbol} 0 R${extras}>>`);

  let pdf = '%PDF-1.4\n';
  const posiciones = objetos.map((cuerpo, i) => {
    const posicion = Buffer.byteLength(pdf, 'latin1');
    pdf += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`;
    return posicion;
  });
  const inicioXref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  pdf += posiciones.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer<</Size ${objetos.length + 1}/Root ${catalogo} 0 R>>\nstartxref\n${inicioXref}\n%%EOF`;
  return Uint8Array.from(Buffer.from(pdf, 'latin1'));
}

const TEMAS = ['las células', 'la energía', 'los ecosistemas', 'la genética'];

/** Libro de ejemplo: 2 páginas iniciales (i, ii) y 38 numeradas, con 4 capítulos y secciones en el índice interno. */
export function libroDeEjemplo(): Uint8Array {
  const paginas = Array.from({ length: 40 }, (_, i) => {
    const impresa = i < 2 ? ['i', 'ii'][i] : String(i - 1);
    const tema = TEMAS[Math.min(3, Math.floor(Math.max(0, i - 2) / 9.5))];
    return [
      `Marca de control PAGINA-${impresa}.`,
      ...Array.from(
        { length: 42 },
        (_, n) => `Linea ${n + 1} de la pagina impresa ${impresa}: este texto de ejemplo explica ${tema} con palabras sencillas.`,
      ),
    ];
  });
  const marcadores: Marcador[] = [
    { titulo: 'Capítulo 1: Las células', pagina: 3, hijos: [{ titulo: '1.1 Partes de la célula', pagina: 3 }, { titulo: '1.2 División celular', pagina: 8 }] },
    { titulo: 'Capítulo 2: La energía', pagina: 13, hijos: [{ titulo: '2.1 Fotosíntesis', pagina: 13 }] },
    { titulo: 'Capítulo 3: Los ecosistemas', pagina: 22 },
    { titulo: 'Capítulo 4: La genética', pagina: 31 },
  ];
  return generarLibroPdf({ paginas, marcadores, romanas: 2 });
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/pdf-libro.ts') && process.argv[2]) {
  writeFileSync(process.argv[2], libroDeEjemplo());
  console.log(`Libro de ejemplo guardado en ${process.argv[2]}`);
}
