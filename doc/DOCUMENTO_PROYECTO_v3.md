# Nova Assistant · Documento del proyecto (versión 3)

Proyecto de Lógica y Programación · 27 de noviembre de 2026

**Autor:** Juan Carlos De La Rosa Henríquez

- **Código e historial:** https://github.com/Dlrjuank/Nova-assistant (rama `ampliacion`).
- **Acceso a la aplicación:** la cuenta de Vercel (plan gratuito) está en pausa por consumo de CPU hasta el 27 de diciembre de 2026. Mientras tanto, Nova corre en un computador y se publica con un enlace temporal de Cloudflare Tunnel, que se entrega por aparte junto con el usuario y la contraseña de la cuenta de prueba.
- **Sobre las capturas:** son de la aplicación real, en tema claro, con una cuenta de prueba y datos de ejemplo.

---

## 1. Qué problema resuelve y para quién

Un estudiante universitario reparte su semestre en muchos lugares: las tareas en una libreta o en el teléfono, los apuntes y libros en archivos sueltos, las notas en una hoja de cálculo y las fechas en la memoria. Eso trae tres problemas:

1. **No sabe qué hacer primero** ni qué se le vence.
2. **Encontrar un dato en sus documentos toma tiempo**, y un asistente de IA genérico responde de memoria, sin decir de dónde sacó la información.
3. **No sabe cómo va en cada materia** ni cuánto necesita para aprobar.

**Nova** reúne todo en una sola aplicación para **estudiantes universitarios**: organiza tareas y calendario, responde preguntas sobre los documentos del propio estudiante **citando la fuente**, arma cuestionarios de repaso y calcula las notas del semestre. Funciona en el computador y en el teléfono, donde se puede instalar como aplicación.

---

## 2. Qué hace, pantalla por pantalla

### 2.1 Entrada

Se puede entrar con **Google** o con correo y contraseña. Las cuentas nuevas se crean con "Entrar con Google".

![Pantalla de entrada](capturas/01-entrada.png)

### 2.2 Inicio

Resume el día: tareas de hoy y vencidas, tiempo dedicado en la semana, promedio actual, la semana completa, el progreso semanal y el próximo corte. Desde "Pregúntale a Nova" se llega al asistente.

![Inicio](capturas/02-inicio.png)

### 2.3 En el teléfono

La navegación pasa a una barra inferior con un botón para crear tareas. La app se puede instalar, consultar sin conexión y crear tareas sin conexión, que se envían solas al volver internet.

<p>
<img src="capturas/18a-telefono-inicio.png" alt="Inicio en el teléfono" width="260">
<img src="capturas/18b-telefono-tareas.png" alt="Tareas en el teléfono" width="260">
</p>

### 2.4 Tareas

Lista agrupada por categoría, con pestañas (todas, hoy, importantes, completadas). Al completar una tarea se anotan los minutos dedicados.

![Tareas](capturas/03-tareas.png)

Cada tarea tiene fecha límite, prioridad, categoría y, si se quiere, horario y recordatorio.

![Registrar una tarea](capturas/04-tarea-nueva.png)

### 2.5 Calendario

El mes con las tareas por color de categoría, los cortes y las notas con fecha, y la lista de lo próximo.

![Calendario](capturas/05-calendario.png)

### 2.6 Asistente

Responde preguntas sobre los documentos y las tareas, y muestra **la fuente de cada respuesta**. "Buscar en" permite elegir todos los documentos, uno en particular, las fuentes web guardadas, Wikipedia o la IA general (marcada como respuesta sin fuentes). Una respuesta se puede pedir de otra manera: más simple, con un ejemplo, paso a paso, en resumen o con una analogía.

![Asistente con una respuesta citada](capturas/06-asistente.png)

### 2.7 Fuentes

Se suben documentos de hasta 15 MB: PDF (también escaneados), Word, PowerPoint, Markdown, texto y fotos. Las páginas escaneadas y las fotos se leen con reconocimiento de texto (OCR), y Nova pregunta antes de gastar consultas.

![Fuentes](capturas/07-fuentes.png)

"Ver contenido" muestra las secciones o capítulos y permite repartirlos en un **plan de lectura** que se convierte en tareas.

![Contenido de un documento](capturas/08-capitulos.png)

### 2.8 Cuestionarios

Se generan preguntas a partir de un documento: selección única, respuesta múltiple, verdadero o falso, completar, abierta o mezcladas.

![Cuestionarios](capturas/09-cuestionarios.png)

Al terminar se ve el puntaje, qué falló, la explicación y en qué parte del documento está, y se pueden repetir solo las preguntas falladas.

![Resultado de un cuestionario](capturas/10-cuestionario.png)

### 2.9 Semestre: materias y notas

Cada materia tiene créditos, cortes, componentes, notas y control de fallas. Nova calcula el promedio del semestre ponderado por créditos y avisa qué materias están en riesgo.

![Materias del semestre](capturas/11-semestre.png)

La calculadora muestra la nota actual, lo asegurado y **cuánto se necesita** en lo que falta para llegar a una meta.

![Calculadora de una materia](capturas/12-materia.png)

### 2.10 Semestre: objetivos y plan de estudio

Metas por materia y por corte, temas de cada corte (escritos a mano o propuestos por el asistente desde un documento) y un **plan de estudio** repartido en días hasta la fecha del corte. Cada paso se puede pasar a Tareas.

![Objetivos y plan de estudio](capturas/13-objetivos-plan.png)

### 2.11 Semestre: estadísticas

Materias perdidas o en riesgo, comparación entre materias y evolución por corte.

![Estadísticas](capturas/14-estadisticas.png)

### 2.12 Productividad

Un índice del día de 0 a 100 según las tareas completadas y los minutos dedicados, con una recomendación del asistente, y metas semanales.

![Productividad](capturas/15-productividad.png)

### 2.13 Configuración

Perfil y contraseña, tema claro, oscuro o automático, formato de hora, reglas de notas, notificaciones e instalación.

![Configuración](capturas/16-configuracion.png)

Cada persona puede vincular **su propia clave de Gemini**, con una guía para crearla.

![Guía de la clave de Gemini](capturas/17-clave-gemini.png)

### 2.14 Administración

Solo la ven las cuentas administradoras, por eso no aparece en las capturas de la cuenta de prueba. Permite ver las cuentas y el espacio que usan, aprobar, bloquear o eliminar, nombrar administradores, dar permiso para usar la clave de Gemini del proyecto, generar una contraseña temporal, fijar los topes y consultar el registro de acciones.

### 2.15 Privacidad

Página pública que explica qué se guarda, qué se envía a terceros y cómo eliminar la cuenta.

![Privacidad](capturas/19-privacidad.png)

---

## 3. Con qué está hecha y por qué

| Pieza | Para qué | Por qué |
|---|---|---|
| **Next.js 15 y React 19** | Páginas y API en un solo proyecto | El servidor y la interfaz comparten código y se despliegan juntos |
| **TypeScript** | Todo el código | Detecta errores antes de ejecutar |
| **Tailwind CSS 4** | Diseño | Colores definidos en un solo lugar, con claro y oscuro; animaciones solo con CSS |
| **Supabase** (Postgres, Auth) | Base de datos y cuentas | Postgres real con inicio de sesión incluido y plan gratuito |
| **pgvector** (índice HNSW) | Buscar fragmentos por significado | La búsqueda vive en la misma base que los datos, sin otro servicio |
| **pg_cron y pg_net** | Tareas programadas | La propia base dispara los recordatorios |
| **Vercel Blob** | Recibir archivos grandes | El navegador sube directo, sin pasar por el servidor |
| **Gemini** (Google) | Representar el texto en vectores, responder y leer fotos | Tiene una capa gratuita suficiente para el proyecto |
| **unpdf** y lectores propios | Sacar el texto de PDF, Word, PowerPoint y Markdown | El texto es lo que se indexa |
| **Zod** | Validar lo que llega a la API | Rechaza datos mal formados antes de tocar la base |
| **Web Push y service worker** | Notificaciones y uso sin conexión | App instalable sin pasar por una tienda |
| **Sentry** | Avisar cuando algo falla | Permite corregir errores reales |
| **Vitest** | Pruebas automáticas | 1.763 pruebas de reglas, servidor e interfaz |
| **Vercel** | Alojamiento | Despliega cada cambio de la rama |

### Cómo responde el asistente (RAG)

1. Al subir un documento, Nova extrae el texto y lo divide en **fragmentos**.
2. Cada fragmento se convierte en un **vector** (768 números que representan su significado) y se guarda en la base.
3. Al preguntar, la pregunta también se convierte en vector y se buscan **los fragmentos más parecidos** del propio estudiante.
4. Esos fragmentos, junto con sus tareas cuando hace falta, se envían a Gemini, que responde **solo con ese material**.
5. La respuesta muestra de qué documento y parte salió. Si no hay material suficiente, lo dice.

### Cómo está organizado el código

| Carpeta | Contenido |
|---|---|
| `src/app/nova` y `src/app/api/nova` | Pantallas y API |
| `src/lib/reglas` | Reglas de negocio puras (notas, fechas, productividad), sin red ni base |
| `src/lib/datos` | Consultas y servicios |
| `src/lib/llm` | Único lugar que conoce al proveedor de IA |
| `supabase/migrations` | Cambios de la base, en orden |
| `tests` y `scripts` | Pruebas, respaldos y verificaciones |

---

## 4. Cómo funciona el ingreso

- Las cuentas las maneja **Supabase Auth**. Las contraseñas las guarda ese servicio protegidas; la aplicación no las puede leer.
- Las cuentas nuevas se crean con **Google**; el registro con correo está cerrado.
- Cada cuenta tiene un **estado** (activa, pendiente o bloqueada) y un **nivel** (dueño, administrador o usuario). Se comprueban en cada pedido: una cuenta bloqueada deja de entrar aunque tenga la sesión abierta.
- La sesión viaja en **cookies**. El servidor la renueva y cada ruta de la API verifica la sesión antes de hacer cualquier cosa.
- **Cada persona ve solo sus datos:** cada fila guarda a quién pertenece y todas las consultas filtran por esa persona.
- Hay un tope de cuentas y de espacio por persona.

## 5. Dónde se guardan los datos

| Dónde | Qué se guarda |
|---|---|
| **Supabase (Postgres)** | Cuentas, tareas, materias, notas, planes, cuestionarios, conversaciones, preferencias y el **texto** de los documentos con sus vectores. Las tablas tienen seguridad por filas activada: la clave pública no puede leerlas, solo el servidor |
| **Vercel Blob** | El archivo original **solo mientras se lee**; se borra al terminar. Mientras tanto está en un almacén público con un nombre al azar |
| **El dispositivo** | Una copia de algunas pantallas para verlas sin conexión y las tareas creadas sin conexión, hasta enviarlas |

**Qué se envía a terceros:**

- **Gemini:** las preguntas, los fragmentos y tareas que sirven para responderlas, el texto de los documentos al indexarlos y las páginas o fotos que se aceptan leer.
- **Wikipedia:** lo que se busca en la web.
- **Sentry:** solo el error, la pantalla donde ocurrió y pasos técnicos. **No recibe contenido del usuario**, ni nombre, correo, cookies o parámetros de las direcciones; sí anota el país y la ciudad aproximada de la conexión.

**Seguridad:** las claves del proyecto no están en el repositorio; la clave de Gemini de cada persona se guarda cifrada (AES-256-GCM) y no vuelve al navegador; la conexión con la base verifica su certificado.

---

## 6. Cómo se construyó

- Primero una versión base (tareas, documentos PDF, asistente con citas y búsqueda en Wikipedia), publicada en producción.
- Después una **ampliación por etapas** en la rama `ampliacion`, probando cada una en computador y teléfono antes de seguir. El plan y la bitácora están en la carpeta `doc/` del repositorio.
- Con ayuda de asistentes de inteligencia artificial para programar y revisar.
- Pruebas automáticas (1.763) y recorridos en el navegador, más pruebas manuales en cada etapa.

---

## 7. Qué quedó por fuera y qué seguiría

### Estado de la publicación

La ampliación está completa y probada en la rama `ampliacion`. La rama de producción (`master`) todavía tiene la versión base. La unión ya se ensayó, y se hará cuando Vercel vuelva a estar disponible.

### Lo que sigue

| Pendiente | Detalle |
|---|---|
| **Publicar la ampliación** | Unir con `master`, pasar los recordatorios a producción y publicar el ingreso con Google para cualquier persona |
| **Pasar a Vercel Pro** o esperar al 27 de diciembre | El plan gratuito tiene un límite de CPU que el proyecto superó |
| **Ahorro de CPU** | Ya se redujo el trabajo del servidor; falta aplicar la mejora para que el aviso de cada minuto llame solo cuando hay trabajo |
| **M27** | Migración de la base que quita un apoyo temporal usado mientras convivían las dos versiones; se aplica uno o dos días después de unir |
| **Barra lateral** | Que se despliegue al pasar el mouse, sin empujar el contenido, con opción de fijarla y apertura con el teclado |
| **Más estadísticas** | Nuevas vistas sobre el avance del semestre |

### Limitaciones conocidas

- Mientras Vercel está en pausa no salen los recordatorios ni el resumen diario automáticos.
- Recuperar la contraseña por correo no funciona porque el servicio de correo no tiene un dominio propio; se usa el ingreso con Google o una contraseña temporal del administrador.
- En algunos casos, después de recargar y filtrar una lista, el botón "Atrás" la deja filtrada; tocar "Todos" la restaura.
- El uso de la inteligencia artificial depende del cupo gratuito de Gemini.
