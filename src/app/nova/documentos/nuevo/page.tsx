import { SubidorPdf } from '@/components/nova/SubidorPdf';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { Tarjeta } from '@/components/ui/Tarjeta';

export default function NuevoDocumentoPage() {
  return (
    <>
      <EncabezadoPantalla
        titulo="Indexar PDF"
        subtitulo="Solo se admiten PDF con texto seleccionable (no escaneados), de hasta 15 MB."
      />
      <Tarjeta className="max-w-xl">
        <SubidorPdf />
      </Tarjeta>
    </>
  );
}
