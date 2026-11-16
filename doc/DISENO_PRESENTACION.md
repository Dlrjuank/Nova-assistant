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
