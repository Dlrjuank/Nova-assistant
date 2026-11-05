import { SubidorPdf } from '@/components/nova/SubidorPdf';
import { Tarjeta } from '@/components/ui/Tarjeta';

export default function NuevoDocumentoPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Indexar PDF</h1>
      <p className="text-sm text-texto-suave">
        Solo se admiten PDF con texto seleccionable (no escaneados), de hasta 15 MB.
      </p>
      <Tarjeta className="max-w-xl">
        <SubidorPdf />
      </Tarjeta>
    </>
  );
}
