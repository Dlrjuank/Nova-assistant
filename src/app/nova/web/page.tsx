import { BuscadorWeb } from '@/components/nova/BuscadorWeb';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';

export default function WebPage() {
  return (
    <>
      <EncabezadoPantalla
        titulo="Web"
        subtitulo="Busca en Wikipedia en español: Nova resume los 3 primeros artículos y guarda la fuente. La consulta se envía a Wikipedia y, con los extractos, al proveedor del asistente."
      />
      <BuscadorWeb />
    </>
  );
}
