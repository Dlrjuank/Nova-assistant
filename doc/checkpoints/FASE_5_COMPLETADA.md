# Fase 5 completada · Nova Assistant

Fecha de cierre: 2026-11-06

Interfaz del MVP (P06, P07 y P08) más las ampliaciones pedidas por el usuario (P08b y P08c). Desplegada en https://nova-assistantsm-kappa.vercel.app.

## Qué incluye

- **P06:** componentes base (`Boton`, `Campo`, `Selector`, `Tarjeta`, `Insignia`, `Aviso`, `EstadoVacio`), navegación de `/nova`, lista de tareas con filtro y formulario de registro.
- **P07:** subida de PDF a Vercel Blob desde el navegador con token de un solo uso, indexación y lista de documentos. A pedido del usuario: completar y eliminar tareas.
- **P08:** chat del asistente con fuentes como chips, validación en vivo (2 palabras, 8 caracteres) y avisos de `SIN_DOCUMENTOS` y `ERROR_LLM` con reintento.
- **P08b:** máscara AAAA-MM-DD, aviso (sin bloqueo) de fecha pasada, historial del chat por usuario en la base (M4) con "Conversación nueva", y preguntas de seguimiento (el modelo recibe los últimos 6 mensajes).
- **P08c:** eliminar documento con confirmación.

## Verificación

- `npm test`: 210 pruebas pasan al cierre de P09.
- Navegador real (Edge con `puppeteer-core`, usuarios temporales ya borrados): P06 33 comprobaciones, P07 28, P08 18, P08b 21 de 22 (la que falló estaba mal planteada; ver la bitácora), P08c 8, todas sin fallas reales.
- El usuario probó P06, P07 y P08 en local y P07 en producción.
- 390 px sin desplazamiento horizontal en todas las pantallas probadas.

## Sin verificar

- La interfaz con un lector de pantalla.
- Los casos de aceptación en producción con sesión: se registran en `doc/ACEPTACION.md`.
