import { EstadoVacio } from '@/components/ui/EstadoVacio';

// Marcador de posición: la subida y el listado de documentos llegan en P07.
export default function DocumentosPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Documentos</h1>
      <EstadoVacio
        titulo="La gestión de documentos llega en un próximo paso"
        descripcion="Aquí podrás indexar PDF para preguntarle al asistente."
      />
    </>
  );
}
