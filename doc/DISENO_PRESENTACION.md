# Referencia de diseño: detalles de la página de presentación

La página de presentación de Nova (artifact en claude.ai, hecha por el usuario con Claude) simula varias funciones que ya existen, con detalles visuales y de interacción que la app real todavía no tiene. Esta lista los recoge para usarlos como referencia.

Se armó leyendo el código de la página (React compilado) y comparándolo con `src/components/nova/`. Los nombres de color y de fuente son los de la página.

## 1. Identidad visual (para E20b)

- **Paleta "noche de estudio":**
  - Fondo `#14110F`; paneles `#1F1A17` y `#29221D`; bordes `#3D322B`.
  - Acento brasa `#E2703F`, suave `#F2A47C`; texto `#F3EADD`; texto tenue `#A99B8D`; éxito `#86BFA2`.
  - Error `#E58C8C`; aviso `#E6C36A`.
- **Tipografías:**
  - Títulos en Bricolage Grotesque, de 800 de grosor.
  - Texto en Instrument Sans.
  - Datos y etiquetas en JetBrains Mono, en mayúsculas espaciadas.
  - Hoy la app usa solo Inter.
- **Logo "nova":**
  - Un punto brasa con un halo que se expande y se apaga (animación `nova`, 2,6 s).
  - El mismo halo late en el botón central del Asistente de la barra inferior del teléfono.
- **Tarjetas:**
  - Radio de 20 px, con un brillo radial brasa que sigue al puntero.
  - Las secciones entran suavemente al hacer scroll.
  - Todo se desactiva con "reducir movimiento".
- **Números grandes** con cifras tabulares (`font-variant-numeric: tabular-nums`), como el promedio, la nota que necesitas o el puntaje. En la presentación cuentan hacia arriba al aparecer.

## 2. Detalles en funciones que ya existen

| Función | En la presentación | Hoy en Nova |
|---|---|---|
| Asistente: espera | Tres puntos que laten mientras responde | Texto "Pensando…" |
| Asistente: respuesta | Aparece palabra por palabra | Aparece completa |
| Asistente: cita | Chip con la cita; al tocarlo se despliega el fragmento del documento en cursiva, con borde brasa | Cita visible, sin desplegar el fragmento |
| Asistente: sugerencias | Chips con preguntas de ejemplo bajo el chat | No hay |
| Asistente: burbujas | Pregunta en brasa con esquina recortada; respuesta en panel | Similar, sin esquina recortada |
| Mi semana | Casilla de cada tarea con el color de su categoría; al completarla se rellena con ese color | Casilla sin color de categoría |
| Progreso semanal | Anillo con rebote al cambiar y debajo "Faltan N" o "Semana completa" | Anillo sin texto de lo que falta |
| Calendario | Días con examen o corte con un contorno brasa, además del punto de color; lista "próximos" con Tarea o Corte y la fecha | Ícono de Semestre en el día |
| Tareas | Insignias de prioridad con color (Alta roja, Media amarilla) y "Completada · 30 min" en la insignia | Revisar si coincide |
| Fuentes: indexar | Lista de etapas que se encienden en orden: Subiendo, Extrayendo el texto, Dividiendo en fragmentos, Creando vectores, Guardando | Porcentaje |
| Configuración: categorías | Chips; al tocarlos cambia el color entre 8 fijos | Selector de color |
| Fallas | Fila de puntos, uno por falla permitida, que se pintan de rojo al sumar | Conteo con − y + |
| Semestre | Fila de la materia en riesgo con fondo rojizo y una etiqueta del riesgo | Estado en la tarjeta |
| Cuestionarios: historial | "Mejoraste" en verde y "Bajaste" en rojo | Ícono y texto |
| Notificaciones | Vista previa de la notificación dentro de la pantalla | Solo la notificación real |
| Botones secundarios | Botón "fantasma" con borde que se pone brasa al pasar el puntero | Revisar |

## 3. Qué es de diseño y qué es de función

- **Solo visual (E20b):** paleta, tipografías, logo con halo, brillo de las tarjetas, entrada al hacer scroll, números que cuentan, burbujas, puntos de fallas, colores de la tendencia, fondo de riesgo, contorno de cortes en el calendario.
- **Cambian el comportamiento:**
  - respuesta palabra por palabra (streaming desde Gemini);
  - chips de preguntas sugeridas;
  - cita desplegable con el fragmento;
  - etapas de indexación visibles;
  - "Faltan N" en el progreso semanal;
  - casilla con el color de la categoría.

  Se pueden hacer en E20b o antes, como ajuste aparte.

Toda animación debe respetar "reducir movimiento", y los colores deben pasar `tests/reglas/contraste.test.ts`, en claro y en oscuro. La presentación solo tiene modo oscuro.

## Decisión del usuario (2026-11-17)

El usuario eligió la versión **"Con el video"** del prototipo, no el plan anterior (que era solo la presentación sobre la estructura actual).

- **Prototipo:** `doc/PROTOTIPO_DISENO.html`, en React con JSX y Babel en el navegador, con 7 pantallas. Se abre en el navegador; arriba hay un selector para ver "Plan anterior" o "Con el video". También está publicado como artifact privado del usuario.
- **Base para E20b:** este prototipo con "Con el video". Pasarlo a los componentes reales de Nova (TSX, tokens `--nova-*`, `lucide-react`), en claro y oscuro, sin copiar el código del prototipo tal cual.

## 4. Referencias del video del usuario (2026-11-17)

El usuario grabó un video de 1 minuto con publicaciones de componentes de interfaz en React. Usan `motion` (framer-motion), Tailwind y `lucide-react`. Pidió un diseño **con mucho énfasis en el detalle**, hecho en JSX/TSX como el resto de Nova y con estos ejemplos. Son inspiración: se toma la idea y se adapta a la identidad de Nova, sin copiar el diseño de nadie.

| Ejemplo del video | Qué tiene | Dónde va en Nova |
|---|---|---|
| Lamp login (dos versiones) | Escena oscura con una lámpara; al tirar del cordón se enciende una luz cálida y aparece el formulario de entrada | Inicio de sesión: la estrella "nova" o una lámpara de escritorio que se enciende y revela el formulario, coherente con "noche de estudio". Con "reducir movimiento", el formulario se ve de una vez |
| OTP verification (V2 y V5) | Casillas de un dígito con foco animado, avance automático y estado de verificado | Patrón de campos con estados animados (vacío, escribiendo, válido, error). Útil en "Vincular mi clave de Gemini" (E20c): verificando → verificada, con check animado |
| Interactive payment checkout | Tarjeta en 3D, formulario y botón que pasa por "procesando" y termina en "listo" | Botones con estados (cargando → éxito → vuelve) en Guardar tarea, Crear cuestionario, Proponer temas y Subir PDF |
| Finance Dashboard / Dashboard V35 | Saludo grande ("Welcome back, …"), tarjetas de datos con número grande, mini gráfico y variación, cristal suave, números que cuentan | Inicio ("Buenas tardes, {nombre}"), Productividad y Estadísticas (E20): tarjetas con número que cuenta, mini gráfico y tendencia |
| Glassy menu navigation | Menú de cristal a pantalla completa con letras grandes, el elemento activo marcado con un guion y un punto, y "01 / 04" | Hoja "Más" del teléfono |
| Curved sidebar | Barra lateral de cristal con el perfil arriba (foto, nombre, insignia), submenús desplegables con línea guía y una tarjeta de aviso abajo | Barra lateral del PC: perfil arriba, Semestre con submenú (Materias y notas, Objetivos y plan), una tarjeta de aviso (próximo corte, tarea vencida o cuota) y Configuración/Cerrar sesión al final |
| Navigation tabs V10 | Pestañas en píldora de cristal con un indicador que se desliza al activo, ícono con globo de número y barra inferior flotante con el botón central | Barra inferior del teléfono flotante, con indicador deslizante y globo de número (tareas de hoy o vencidas); también en las pestañas de Tareas y Fuentes |
| Skeuomorphism dashboard | Relieves, sombras y textura | Solo como idea de profundidad; no es la línea principal |
| Admin Dashboard V7 | Barra lateral, saludo, tarjetas de datos con variación, gráfico de barras, medidor circular de porcentaje, tarjetas de planes | Pestaña "Administración" (E20c), ver abajo |

### Pestaña "Administración" (solo administradores; E20c y diseño en E20b)

Siguiendo el ejemplo "Admin Dashboard":

- **Resumen:**
  - tarjetas con cuentas totales y activas en 7 días, cuentas nuevas en la semana, y cuentas con y sin clave de Gemini;
  - cada tarjeta muestra su variación frente a la semana anterior.
- **Espacio:**
  - medidores circulares de la base (de 500 MB) y de Blob (de 1 GB), con aviso al 80 % y al 95 %;
  - las cuentas que más ocupan.
- **Actividad:** gráfico de barras por día con registros, preguntas al Asistente y documentos indexados.
- **Cuentas:**
  - tabla con búsqueda y filtros (activas, bloqueadas, sin clave);
  - por cuenta: correo, nombre, registro, último acceso, espacio usado y si tiene clave (solo sí o no);
  - acciones: bloquear, desbloquear y eliminar (escribiendo el correo).
- **Topes:** tope de cuentas y tope de espacio por persona, editables.
- **Sistema:**
  - estado del aviso de cada minuto, con su última ejecución y sus errores;
  - la última limpieza del registro de cron.
- **Registro de acciones del administrador:** quién hizo qué y cuándo.

### Condiciones para todo lo anterior

- Modo claro y oscuro: los ejemplos son casi todos oscuros.
- Contraste suficiente sobre cristal, que pase `tests/reglas/contraste.test.ts`.
- "Reducir movimiento" respetado en cada animación.
- Teléfono a 390 px, sin desplazamiento lateral.
- **Rendimiento:**
  - el desenfoque del cristal (`backdrop-filter`) es costoso en teléfonos, así que se usa con moderación;
  - si se agrega `motion`, cargarlo de forma liviana (`LazyMotion`);
  - no empeorar el tiempo de carga, que ya está anotado para bajar en E20b.
