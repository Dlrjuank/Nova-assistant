# Plan Jarvis · Nova Assistant

> **EN PAUSA (pedido del usuario).** Este plan no se está ejecutando y las decisiones de la sección 11 siguen pendientes. No se ejecuta ningún paso J hasta que el usuario lo indique.

Plan de la mejora Jarvis, reorganizado según las decisiones del usuario del 2026-11-10. **Es solo planificación.** Se ejecuta después de E21, en la rama `jarvis`, con los prompts de `doc/PROMPTS_JARVIS.md` (J01 a J25).

"Paso M07" se refiere a un paso del Excel `asistente_jarvis_plan.xlsx`. "Migración M23" se refiere a una migración de la base. Estado del código comprobado en la rama `ampliacion`, commit `5f74406` (última etapa terminada: E10c). J01 vuelve a comprobarlo después de E21.

## 1. Visión

Jarvis es un asistente personal en la nube, construido sobre Nova: recuerda, captura tareas y avisa. A futuro, otras personas podrán usarlo como su propio asistente personal.

## 2. Decisiones del usuario

| # | Decisión |
|---|---|
| 1 | Nube primero. El agente en el PC es opcional, va al final y solo sirve para controlar el computador y la palabra de activación. Cada persona lo instalaría en su PC |
| 2 | La memoria vive en Supabase con pgvector, con una pantalla para ver, corregir y olvidar. Obsidian queda como exportación opcional a Markdown |
| 3 | WhatsApp reemplaza a Telegram, solo con la API oficial de WhatsApp Business. Primero el número de prueba de Meta y después una segunda línea. Pocos recordatorios y costo de plantillas aceptado |
| 4 | El asistente sigue con Gemini. Claude queda como opcional al final |
| 5 | Las llamadas son opcionales y por WhatsApp, no por Twilio. Antes van las notas de voz por WhatsApp |
| 6 | Para otras personas quedan abiertas las dos opciones (sección 10). No se decide aquí |

## 3. Advertencia: términos de Meta frente a las decisiones 3 y 4

Esta es la decisión más importante pendiente. Dos cláusulas de la sección 4.7 de los [términos de WhatsApp Business](https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform) (última actualización: 23 de septiembre de 2026) afectan a este plan.

| Cláusula | Qué dice | Efecto en Jarvis |
|---|---|---|
| Asistentes de IA | A los proveedores de IA les está prohibido usar la plataforma cuando la IA, incluidos "los asistentes de inteligencia artificial de uso general", "constituyen la funcionalidad principal (no incidental o auxiliar)" | Un "asistente personal" abierto por WhatsApp puede entrar ahí. La [prensa](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform) cita que Meta lo decide "a su sola discreción" y que un negocio que atiende a sus clientes con IA no queda excluido. Si Meta lo considera asistente general, puede bloquear la línea |
| Entrenar modelos | No se puede permitir, "de forma directa o indirecta", que los datos de la plataforma "se usen para crear, desarrollar, entrenar o mejorar" un modelo | El plan gratuito de Gemini sí usa lo enviado para mejorar sus productos ([precios](https://aistudio.google.com/docs/pricing)). **Enviar mensajes de WhatsApp a Gemini gratis choca con esta cláusula** |

**Cómo se refleja en el plan:**

- J08 y J09 (vincular, comandos fijos, resumen y avisos) no envían mensajes a Gemini.
- J10 a J12 (conversación, notas de voz y fotos con IA por WhatsApp) quedan detrás de la **puerta WA-IA**: no empiezan hasta que el usuario decida D3 y D4.
- Recomendación: un proyecto de Gemini de pago solo para el tráfico de WhatsApp, y el canal presentado como acceso a tareas y documentos propios, sin "IA general" por WhatsApp. Reduce el riesgo, pero no lo elimina.
- Si no se acepta, Jarvis funciona igual en la app, y WhatsApp queda para comandos y avisos.

No es asesoría legal. Conviene releer la cláusula completa antes de J10 y antes de abrir el servicio a otras personas.

## 4. Orden

### Ajustes al orden propuesto, y por qué

| Ajuste | Por qué |
|---|---|
| J01 y J02 van antes del núcleo | Control del trabajo y variables: WhatsApp agrega varias |
| Un tope diario sencillo (J06) se adelanta al núcleo; la versión por persona sigue en el grupo 4 | WhatsApp es el primer canal que gasta cuota sin la app abierta, y la cuota es la de producción. Un error podría agotarla |
| Memoria, luego acciones, luego captura natural | La captura natural usa las acciones con confirmación, y las acciones incluyen guardar en memoria |
| WhatsApp se divide en J08 a J13 | Lo que no usa IA va primero y no depende de la puerta WA-IA |
| La proactividad (J09) va antes de la conversación (J10) | Solo necesita el vínculo y E11c/E11d, y su contenido no llama al modelo |
| Fotos (J12) van tras las notas de voz (J11) | Reutilizan la descarga de medios y la confirmación |
| El MCP queda en Conexiones, pero marcado opcional | Lo pediste como opcional; requiere J04. No entra en las horas de la ruta principal |
| J03 y J04 antiguos (lista de conversaciones y streaming) pasan a opcionales | No eran parte del orden pedido y nada depende de ellos |

### Pasos y horas

Horas estimadas de trabajo activo, ajustadas al código real. Los números de migración son provisionales.

| Grupo | J | Paso | Viene de | Requiere | Horas | Migración |
|---|---|---|---|---|---|---|
| Base | J01 | Base y control | J01 anterior (M01) | Paso 0 | 0,5 | — |
| Base | J02 | Variables de entorno | J02 anterior (M02) | J01 | 1 | — |
| 1 Núcleo | J03 | Memoria en la nube | J06 anterior (M07) | J01 | 5 | M23 |
| 1 Núcleo | J04 | Acciones con confirmación | J11 anterior (M12) | J03 | 7 | M24 |
| 1 Núcleo | J05 | Captura natural | Nuevo | J04 | 3 | — |
| 1 Núcleo | J06 | Tope diario de uso | Nuevo | J01 | 1,5 | M25 |
| 2 Canales | J07 | Voz en la app | J14 anterior (M16) | J01 | 2 | — |
| 2 Canales | J08 | WhatsApp: conexión y comandos | J05 anterior (M06) | J04, J06 | 4,5 | M26 |
| 2 Canales | J09 | Resumen y avisos por WhatsApp | J10 anterior (M11, M14) | J08, E11c, E11d | 3 | M27 |
| 2 Canales | J10 | Conversación con IA por WhatsApp | J05 anterior (M06) | J09, puerta WA-IA | 3 | — |
| 2 Canales | J11 | Notas de voz a tareas o notas | Nuevo | J10, J05 | 3 | — |
| 2 Canales | J12 | Fotos a tareas o notas | Nuevo (hoja Mejoras futuras) | J11 | 3 | — |
| 2 Canales | J13 | Segunda línea de WhatsApp | Nuevo | J09 | 1,5 | — |
| 3 Conexiones | J14 | Calendario de Google (plan primero) | J13 anterior (M15), sin correo | J04 | 5 | M28 |
| 4 Otras personas | J16 | Límites por usuario | Nuevo | J06 | 2 | M29 |
| 4 Otras personas | J17 | Exportar y borrar mis datos | Nuevo | J03 | 4 | — |
| 4 Otras personas | J18 | Plan para abrir a otras personas | Nuevo | J16, J17 | 2 | Según plan |

**Ruta principal:** J01 a J14, **43 horas**. **Otras personas:** J16 a J18, **8 horas** para planear; construir la opción elegida se estima en J18. **Paso 0:** 1 hora aparte. Sin la puerta WA-IA (J10 a J12), la ruta personal baja a 34 horas.

| Opcional | Paso | Viene de | Requiere | Horas | Migración |
|---|---|---|---|---|---|
| J15 | Nova como conector MCP (plan primero) | Nuevo | J04 | 6 | M30 |
| J19 | Exportar a Markdown para Obsidian | J09 anterior (M10), reducido | J03 | 2 | — |
| J20 | Lista de conversaciones | J03 anterior (M03) | J01 | 1,5 | — |
| J21 | Respuestas en tiempo real | J04 anterior (M04) | J01 | 3 | — |
| J22 | Agente en el PC (plan primero) | J15 anterior (M17) | J04 | 8 | M31 |
| J23 | Palabra de activación (plan primero) | J16 anterior (M18) | J07, J22 | 5 | Según plan |
| J24 | Llamadas por WhatsApp (plan primero) | J17 anterior (M19) | J13, J04 | 6 | M32 |
| J25 | Claude para el chat | J12 anterior (M13) | J04 | 3 | — |

**Opcionales: 34,5 horas.**

**Numeración de migraciones:** E21 tiene una migración de limpieza sin número, por eso se reserva M22 para ella. Jarvis empieza en M23.

## 5. Identificación del usuario

Un cuerpo de petición nunca dice de quién son los datos. Los esquemas Zod son estrictos y rechazan un `usuario_id` enviado por el cliente.

| Origen | Cómo se autentica | Cómo se obtiene `usuarioId` |
|---|---|---|
| Navegador | `exigirSesion()` | La sesión |
| WhatsApp | Firma `X-Hub-Signature-256`: HMAC-SHA256 del **cuerpo crudo** con el App Secret, en tiempo constante | `messages[].from` del payload firmado, buscado en `vinculos_whatsapp`, solo si `metadata.phone_number_id` es el de la línea configurada |
| Cron y tick | Secreto en tiempo constante | Cada fila procesada trae su `usuario_id` |
| Agente en el PC (opcional) | Token de dispositivo por `Authorization: Bearer`, mostrado una vez y guardado como SHA-256 | Se busca el hash en `tokens_dispositivo`, con alcance y revocación |
| Conector MCP (opcional) | OAuth 2.1 con validación de audiencia ([especificación](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)) | El usuario del token |
| Scripts de prueba | Conexión directa, solo local | Un usuario temporal, creado y borrado por el script |

`nova_config` y su disparador no sirven para esto: E21 los retira.

### Vincular un número de WhatsApp

1. Con sesión iniciada, la web genera un código de un solo uso, válido 10 minutos y guardado como hash, sin pedir el número.
2. La persona envía `VINCULAR CODIGO` desde su WhatsApp.
3. El webhook toma el número del payload firmado. El código identifica la cuenta; el mensaje demuestra que controla ese número.
4. Se bloquea tras 5 intentos fallidos desde un número.
5. La web muestra el número vinculado y permite revocarlo. `BAJA` en WhatsApp también lo revoca.
6. En cada mensaje se vuelve a comprobar `tieneAccesoNova`. Un número sin vínculo solo recibe la instrucción de vincularse y no llama a Gemini.
7. Se registra la aceptación para recibir mensajes: [Meta exige consentimiento](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages) dentro y fuera de la ventana.

### Protección del webhook

- `GET`: compara `hub.verify_token` en tiempo constante y devuelve `hub.challenge`.
- `POST`: valida la firma antes de interpretar nada. Sin firma válida no se procesa.
- Responde 200 enseguida y procesa después. [Meta reintenta durante 36 horas](https://developers.facebook.com/docs/graph-api/webhooks/getting-started), así que `messages[].id` se guarda para ignorar repetidos.
- Un botón de confirmación solo lleva el id de la acción. Se comprueba que esa acción pertenezca al dueño del número que responde.

## 6. Costos

### WhatsApp (página oficial de Meta, consultada el 2026-11-10)

Fuentes: [modelo de precios](https://developers.facebook.com/docs/whatsapp/pricing), [cambios de precios](https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing/), [llamadas](https://developers.facebook.com/docs/whatsapp/cloud-api/calling/pricing) y [Calling API](https://developers.facebook.com/docs/whatsapp/cloud-api/calling).

| Concepto | Regla | Valor para Colombia |
|---|---|---|
| Mensajes que tú recibes | Meta no los cobra | 0 |
| Mensajes de servicio (dentro de la ventana de 24 h) | Desde el 1 de octubre de 2026 se cobran; los primeros **1.000 entregados al mes por línea** son gratis y no se acumulan | Después del 1.000: **sin confirmar** |
| Plantillas de utilidad | Se cobran por mensaje entregado. Desde el 1 de octubre de 2026 también dentro de la ventana | **Sin confirmar** |
| Plantillas de marketing | Se cobran por mensaje entregado | **Sin confirmar**. Jarvis no las usa |
| Plantillas de autenticación | Se cobran por mensaje entregado | **Sin confirmar**. Jarvis no las usa |
| Llamada que inicia la persona | Gratis | 0 |
| Llamada que inicia la empresa | Por duración en pulsos de 6 segundos, país y nivel de volumen | **Sin confirmar** |

Las tarifas de Colombia existen, pero no se pudieron leer: la tabla carga dinámicamente y los CSV no exponen su dirección. Se consultan en [la calculadora](https://business.whatsapp.com/products/platform-pricing#rates) eligiendo Colombia, y J09 las anota antes de activar los avisos.

**Regla de costo para los avisos:** dentro de una ventana abierta se envía un mensaje de servicio (entra en los 1.000 gratis). Fuera de ella, una plantilla de utilidad. Una plantilla dentro de la ventana se paga sin necesidad.

**Otros límites confirmados:**

- Fuera de la ventana solo se pueden enviar plantillas aprobadas.
- El token temporal "expira rápido"; para desarrollo se crea un token permanente de usuario del sistema.
- Las líneas sin método de pago pueden dejar de enviar mensajes de servicio una vez empiezan los cobros.
- Una llamada iniciada por la empresa requiere permiso de la persona y un **límite diario de al menos 2.000 destinatarios** (salvo números de prueba). Un portafolio nuevo empieza en 250, así que **las llamadas salientes no serían posibles al principio con una línea personal**.
- Multimedia: enlaces de 5 minutos; audio hasta 16 MB (OGG solo con OPUS) e imagen hasta 5 MB.

**Sin confirmar:** cuántos destinatarios admite el número de prueba, si permite plantillas propias, el costo y las condiciones de la segunda línea en Colombia, y qué exige la Calling API además (J24 lo revisa, incluido si necesita un servidor de audio que Vercel no ofrece).

### Estimación mensual, uso personal

Supuestos: una persona, 300 mensajes con IA, 60 notas de voz cortas, 60 plantillas de utilidad como máximo.

| Concepto | Costo mensual |
|---|---|
| Vercel Hobby y Supabase gratis | 0 USD |
| Gemini gratis, solo para la app | 0 USD |
| Gemini de pago solo para WhatsApp (si se aprueba) | Cerca de 0,5 USD. Calculado con 3.000 tokens de entrada y 400 de salida por mensaje, a 0,25 y 1,50 USD por millón. Audio a 0,50 USD por millón. Precio de embeddings sin confirmar |
| WhatsApp: mensajes de servicio | 0 USD (menos de 1.000 al mes) |
| WhatsApp: plantillas de utilidad | 60 × tarifa de Colombia, **sin confirmar** |
| Segunda línea | **Sin confirmar** (SIM y plan) |
| Google Calendar, voz del navegador | 0 USD previstos |

Con la tarifa pendiente, el costo fijo conocido es **cerca de 0,5 USD al mes** si se paga Gemini para WhatsApp, y 0 si no. Faltan por sumar las plantillas y la línea.

### Vercel y Supabase

- Hobby: un cron al día, con hasta 59 minutos de imprecisión, solo en producción ([cron](https://vercel.com/docs/cron-jobs/usage-and-pricing)). J09 reutiliza el tick de `pg_cron` de E11c.
- Hobby incluye 1.000.000 de invocaciones y 4 horas de CPU activa al mes, y solo admite **uso no comercial y personal** ([Hobby](https://vercel.com/docs/plans/hobby)).
- Webhook con vista previa protegida: la omisión se puede enviar como parámetro de la URL ([Vercel](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)). Ese secreto sirve para todos los despliegues, así que se crea uno dedicado y se revoca al terminar.
- WhatsApp no tiene modo de consulta local: se prueba con la vista previa protegida o con un túnel.
- Supabase gratis: 500 MB y pausa con poca actividad (plan de ampliación, sección 13).

## 7. Consecuencias de seguir con Gemini gratis

- **Cuota compartida con producción.** Es [por proyecto, no por clave](https://aistudio.google.com/docs/rate-limits). El 2026-11-09 las pruebas la agotaron y producción no pudo indexar ni responder preguntas normales. Se reinicia a medianoche de Pacífico (3:00 a. m. en Bogotá en horario estándar).
- **Límites observados:** unas 1.000 peticiones de embeddings al día. Las cifras del chat están sin confirmar.
- **No se crea un segundo proyecto gratis** para tener más cupo: [Google prohíbe intentar eludir sus límites](https://developers.google.com/terms). Un proyecto de pago sí es válido.
- **Uso de los datos:** en el plan gratuito, Google puede usarlos para mejorar sus productos y [personas pueden revisarlos](https://aistudio.google.com/docs/terms). Sus términos piden no enviar información sensible, confidencial o personal.

**Qué no debe enviarse a Gemini gratis:**

- Contraseñas, claves, números de tarjeta o de documento.
- Datos de salud, financieros o legales.
- Correos, chats, fotos o audios **de otras personas**, o que las identifiquen.
- Cualquier mensaje recibido por WhatsApp (sección 3).
- Cualquier dato de otras personas usuarias de Nova: abrir el servicio exige Gemini de pago.

| Paso | Gasto de Gemini |
|---|---|
| J03 | 1 embedding al guardar o corregir un recuerdo. La búsqueda reutiliza el vector de la pregunta; por página o capítulo se usan los recuerdos fijados |
| J04 y J05 | Hasta 3 llamadas de chat por mensaje |
| J07 a J09 | Ninguno por sí solos; el contenido de J08 y J09 es determinista |
| J10 | Pregunta normal: 1 embedding y 1 chat |
| J11 y J12 | Una llamada con audio o imagen por archivo |

Regla de pruebas: una sola prueba real por paso, y embeddings guardados fuera de git, reutilizados solo si coinciden el texto, el modelo y la dimensión.

## 8. Regla de contenido: dato, nunca instrucciones

El contenido de mensajes, fotos, audios, documentos, notas, recuerdos, correos y eventos es **dato**, nunca instrucciones. Esto se aplica en todos los pasos:

- Ese contenido va marcado como dato, separado de las reglas del sistema.
- No puede habilitar herramientas, cambiar permisos, ni elegir el usuario.
- Una acción que cambia algo siempre pide confirmación. Una transcripción o foto se muestra antes de confirmar.
- Las pruebas de J04, J10, J11 y J12 incluyen un caso con una orden escondida, que no debe ejecutarse.

## 9. Riesgos

| Riesgo | Cómo se maneja | Paso |
|---|---|---|
| Meta considera a Jarvis un asistente general | Puerta WA-IA; canal limitado a tareas y documentos propios; Jarvis sigue funcionando en la app | J10 |
| Datos de WhatsApp en Gemini gratis | Puerta WA-IA: solo con proyecto de pago | J10 a J12 |
| Se agota la cuota de producción | Tope diario; un número sin vínculo no llama a Gemini | J06, J08 |
| Firma de webhook falsa | Firma sobre el cuerpo crudo, tiempo constante | J08 |
| Vincular un número ajeno | Código de un solo uso, intentos limitados | J08 |
| Orden escondida en contenido | Sección 8 | Todos |
| Acción no deseada | Confirmación en el servidor, con vencimiento y uso único | J04 |
| Fecha mal interpretada | Regla pura con la zona de Bogotá; se muestra la fecha antes de confirmar | J05 |
| Memoria con datos sensibles | Rechazo de patrones de clave o número largo; ver, corregir y olvidar | J03 |
| Una línea de WhatsApp restringida | Las notificaciones push de E11c siguen como canal | J09 |
| Acceso de terceros al MCP | OAuth con audiencia, sin pasar tokens, confirmación en lo que cambia datos | J15 |
| Agente en el PC | Sin abrir puertos, lista cerrada, sin borrar archivos | J22 |
| Micrófono siempre activo | Apagado por defecto, indicador visible | J23 |
| Base compartida con `master` | Solo migraciones aditivas y prueba de compatibilidad | Todas |
| Datos de otras personas | Límites, exportar, borrar, Gemini de pago, política de privacidad | J16 a J18 |

## 10. Para otras personas: dos opciones abiertas

No se decide ahora. J18 las compara con datos reales.

| | A. Registrarse en mi Nova | B. Instalar su propia Nova |
|---|---|---|
| Datos | Todos en tu base; tú eres responsable | Cada persona, en su propia cuenta |
| Acceso | Cambiar la lista de admins (`tieneAccesoNova`), que hoy solo admite correos autorizados | Sin cambios |
| Vercel | Hobby solo admite uso no comercial: si se cobra, Pro | Cuenta propia de cada persona |
| Gemini | Cuota compartida entre todos: exige plan de pago y límites por usuario | Clave propia |
| Supabase | 500 MB compartidos: probablemente plan de pago | Proyecto propio |
| WhatsApp | Una línea para todos; costo por mensaje a tu cargo; más riesgo con la cláusula 4.7 | Cada una necesita app de Meta, línea y aprobación de plantillas |
| Legal | Política de privacidad y tratamiento de datos; requisitos en Colombia sin confirmar | Cada persona responde por sus datos |
| Tu trabajo | Operar y dar soporte | Instalador, guía y actualizaciones |
| Obligatorio | J16, J17, Gemini de pago | J17, guía de instalación |
| Agente en el PC | Cada persona lo instala en su PC, con su token | Igual |

## 11. Lo que debes decidir

| # | Decisión | Recomendación | Cuándo |
|---|---|---|---|
| D1 | ¿Cuál es el commit exacto de la entrega de tu curso? | No se supone. Hoy `master` está en `d175142` | Antes del Paso 0 |
| D2 | ¿Production debe seguir mostrando la entrega? | Si sí, no unir la ampliación hasta que la hayan recibido | Antes de unir en E21 |
| D3 | ¿Aceptas el riesgo de la cláusula 4.7 para usar IA por WhatsApp? | Sí, solo con el canal limitado a tareas y documentos propios | Antes de J10 |
| D4 | ¿Pagas Gemini para el tráfico de WhatsApp? | Sí, en un proyecto aparte con alerta de presupuesto. Sin esto, J10 a J12 no se hacen | Antes de J10 |
| D5 | ¿Qué línea usarás como segunda línea? | Una dedicada, que no sea tu número personal | Antes de J13 |
| D6 | ¿Calendario de Google con Gemini gratis? | Solo leer títulos y horas de tus eventos, sin invitados | Antes de J14 |
| D7 | ¿Nova debe guardar las fotos y audios que recibe por WhatsApp? | No: se usan y se descartan, y queda solo el texto confirmado | Antes de J11 |
| D8 | ¿Opción A o B para otras personas? | Sin recomendación, por tu decisión 6 | En J18 |
| D9 | ¿Qué opcionales quieres? | Decidirlo al terminar la ruta principal | Después de J14 |

## 12. Paso 0: respaldo, después de E21

**Antes de empezar:** E21 terminada y aceptada, y `ampliacion` ya unida con `master` por decisión tuya. Si la unión no ocurrió, no sigas: la rama `jarvis` no tendría la ampliación.

| # | Qué haces | Comando o acción | Qué debes ver |
|---|---|---|---|
| 0.1 | Confirmar el estado | `git status`, `git fetch origin`, `git log --oneline -1 master`, `git log --oneline -1 origin/master` | Sin cambios y `master` igual a `origin/master`. Production en Ready |
| 0.2 | **Responder D1** | `git log --oneline --decorate master` | Tienes el SHA exacto. Sin él, no sigas |
| 0.3 | Etiquetar la entrega | `git tag -a entrega-plan <SHA> -m "Versión entregada del curso"` y `git push origin entrega-plan` | La etiqueta aparece en GitHub. Si existe, no la muevas |
| 0.4 | Etiquetar el fin de la ampliación | `git tag -a fin-ampliacion master -m "Fin de E21"` y `git push origin fin-ampliacion` | Punto de partida de Jarvis |
| 0.5 | Crear la rama | `git switch master`, `git pull --ff-only`, `git switch -c jarvis`, `git push -u origin jarvis` | Vercel crea una vista previa y Production no cambia |
| 0.6 | Clonar la entrega | Fuera del proyecto y de OneDrive: `git clone --branch entrega-plan <URL-del-repositorio> nova-assistant-entrega` | Carpeta con el código. "detached HEAD" es normal |
| 0.7 | Guardar las claves | Copia `.env.local` en un gestor de contraseñas o carpeta cifrada. Nunca a GitHub ni al chat | Puedes abrir la copia |
| 0.8 | **Ampliar el respaldo** | En `scripts/respaldo.mjs` y `restaurar-respaldo.mjs`, `TABLAS` solo tiene 6 tablas. Agregar todas las de Nova, padres primero, en un commit propio y con tu visto bueno | Incluye `categorias`, `capitulos` y las de E10e a E20 |
| 0.9 | Respaldar | `npm run db:respaldar` | **Los fragmentos y vectores son obligatorios:** los PDF se borran de Blob al indexar |
| 0.10 | Probar la restauración | `npm run db:restaurar -- respaldos/<carpeta> --probar` | Termina sin errores y no escribe |
| 0.11 | (Opcional) Volcado completo | `pg_dump` con la conexión directa, salida fuera del repositorio | Un `.sql` guardado aparte |
| 0.12 | Anotar la configuración externa | Nombres, sin valores: `pg_cron`, Vault y Vercel | Podrías recrearla |
| 0.13 | Fijar la regla de la base | Solo migraciones aditivas; tras cada una, `db:verificar` y `probar:rag` de `master` en un `git worktree` temporal | Nada de DROP, RENAME ni cambio de tipo |
| 0.14 | Probar la copia | En el clon: `npm ci`, copia temporal de `.env.local`, `npm run build`, y borra esa copia | El build termina sin errores |
| 0.15 | No unir `jarvis` | No unir con `master` sin probar la vista previa y aprobarlo | Production sigue igual |
| 0.16 | Si algo falla | "Promote to Production" de un despliegue anterior y un Pull Request que revierta. Sin `git reset --hard` ni `git push --force` | Production vuelve a funcionar |

## 13. Variables nuevas (solo nombres)

| Variable | Pasos | Dónde |
|---|---|---|
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | J08, J09 a J13 | `.env.local` y Vercel |
| `GEMINI_API_KEY_WHATSAPP` | J10 a J12, si se aprueba | `.env.local` y Vercel |
| `CRON_SECRET` | E21, J09 | Vercel y `.env.local` |
| `NOVA_CLAVE_CIFRADO` | J14 | Vercel y `.env.local` |
| `NOVA_URL`, `NOVA_TOKEN_DISPOSITIVO` | J22 | Solo en el PC |
| `ANTHROPIC_API_KEY`, `PROVEEDOR_CHAT`, `MODELO_CHAT_CLAUDE` | J25 | `.env.local` y Vercel |

Se eliminan `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_CHAT_ID_PERMITIDO`, `SYNC_TOKEN`, las `VAULT_*` y las de Twilio.

## 14. Hallazgos que siguen vigentes

- `npm run db:respaldar` no copia `categorias` ni `capitulos`.
- `.github/workflows/ci.yml` se activa con `main` y `develop`; aquí las ramas son `master` y `ampliacion`, así que nunca corre.
- `probar:rag` sigue pendiente desde que se agotó la cuota del 2026-11-09, y es requisito de E10c2.

## 15. Qué pasó con los pasos anteriores

| Anterior | Paso del Excel | Qué pasó | Ahora |
|---|---|---|---|
| J01 | M01 | Se conserva | J01 |
| J02 | M02 | Se conserva | J02 |
| J03 | M03 | Pasa a opcional | J20 |
| J04 | M04 | Pasa a opcional | J21 |
| J05 | M06 | Se reemplaza: WhatsApp en lugar de Telegram y se divide | J08 y J10 |
| J06 | M07 | Se amplía con pgvector y pantalla para corregir | J03 |
| J07 | M08 | **Eliminado:** Obsidian ya no es la memoria | — |
| J08 | M09 | **Eliminado:** sin sincronizar el vault | — |
| J09 | M10 | Se reduce y pasa a opcional: solo exportar a Markdown | J19 |
| J10 | M11, M14 | Se conserva por WhatsApp; ya fusionaba M11 y M14 | J09 |
| J11 | M12 | Se amplía con crear, completar y editar | J04 |
| J12 | M13 | Pasa a opcional | J25 |
| J13 | M15 | Se reduce: solo calendario, sin correo | J14 |
| J14 | M16 | Se conserva | J07 |
| J15 | M17 | Pasa a opcional | J22 |
| J16 | M18 | Pasa a opcional | J23 |
| J17 | M19 | Pasa a opcional, por WhatsApp en lugar de Twilio | J24 |
| — | M05 | Sigue cubierto por E11b | Sin J |
| Nuevos | — | J05 captura natural, J06 tope diario, J11 notas de voz, J12 fotos, J13 segunda línea, J15 MCP, J16 límites, J17 exportar y borrar, J18 plan para otras personas | — |
