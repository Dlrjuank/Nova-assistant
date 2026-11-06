import { BuscadorWeb } from '@/components/nova/BuscadorWeb';

export default function WebPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Web</h1>
      <p className="text-sm text-texto-suave">
        Busca en Wikipedia en español: Nova resume los 3 primeros artículos y guarda la fuente. La consulta se envía a Wikipedia y,
        con los extractos, al proveedor del asistente.
      </p>
      <BuscadorWeb />
    </>
  );
}
