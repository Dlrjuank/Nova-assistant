import { EliminarConConfirmacion } from './EliminarConConfirmacion';

/** RN-22: eliminar con confirmación, como "Eliminar tarea". */
export function EliminarDocumento({ id, nombre }: { id: string; nombre: string }) {
  return (
    <EliminarConConfirmacion
      ruta={`/api/nova/documentos/${id}`}
      etiqueta={`Eliminar documento: ${nombre}`}
      pregunta="¿Eliminar este documento? El asistente ya no podrá usarlo. No se puede deshacer."
    />
  );
}
