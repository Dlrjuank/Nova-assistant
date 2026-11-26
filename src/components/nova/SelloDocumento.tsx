import { AlignLeft, FileText, FileType, Hash, Image, Presentation, ScanLine, type LucideIcon } from 'lucide-react';
import { NOMBRE_TIPO, type TipoDocumento } from '@/lib/reglas/tiposDocumento';

/**
 * E20d: el sello de cada documento, con el ícono y el color de su tipo (colores de las categorías, que ya pasan
 * contraste.test.ts). El nombre del tipo va en texto para los lectores de pantalla.
 */
const SELLOS: Record<TipoDocumento, { icono: LucideIcon; clase: string }> = {
  pdf: { icono: FileText, clase: 'bg-cat-terracota/12 text-cat-terracota' },
  docx: { icono: FileType, clase: 'bg-cat-azul/12 text-cat-azul' },
  md: { icono: Hash, clase: 'bg-cat-violeta/12 text-cat-violeta' },
  txt: { icono: AlignLeft, clase: 'bg-cat-gris/12 text-cat-gris' },
  pptx: { icono: Presentation, clase: 'bg-cat-ambar/12 text-cat-ambar' },
  pdf_escaneado: { icono: ScanLine, clase: 'bg-cat-oliva/12 text-cat-oliva' },
  imagen: { icono: Image, clase: 'bg-cat-rosa/12 text-cat-rosa' },
};

export function SelloDocumento({ tipo }: { tipo: TipoDocumento }) {
  const { icono: Icono, clase } = SELLOS[tipo] ?? SELLOS.pdf;
  return (
    <span data-sello-documento={tipo} className={`grid size-9 shrink-0 place-items-center rounded-lg ${clase}`}>
      <Icono aria-hidden="true" className="size-4.5" />
      <span className="sr-only">{NOMBRE_TIPO[tipo] ?? NOMBRE_TIPO.pdf}</span>
    </span>
  );
}
