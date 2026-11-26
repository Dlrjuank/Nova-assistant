-- M26 (PLAN_AMPLIACION, E20d): más tipos de documento y páginas leídas con OCR.
-- La base es compartida con producción: solo se agregan columnas con valor por defecto, así lo que ya existe y el
-- código de master siguen igual (todo documento de antes es un PDF por páginas).
-- Se reusa el modelo de páginas: `paginas`, `pagina_inicio` y `pagina_fin` cuentan la "unidad" del documento
-- (página, diapositiva, sección o parte), y `capitulos` guarda sus grupos. `fragmentos_pdf` conserva su nombre
-- aunque guarde otros tipos.

ALTER TABLE documentos ADD COLUMN IF NOT EXISTS tipo VARCHAR(14) NOT NULL DEFAULT 'pdf';
ALTER TABLE documentos ADD CONSTRAINT documentos_tipo_valido
  CHECK (tipo IN ('pdf', 'pdf_escaneado', 'docx', 'md', 'txt', 'pptx', 'imagen'));

ALTER TABLE documentos ADD COLUMN IF NOT EXISTS unidad VARCHAR(11) NOT NULL DEFAULT 'pagina';
ALTER TABLE documentos ADD CONSTRAINT documentos_unidad_valida
  CHECK (unidad IN ('pagina', 'diapositiva', 'seccion', 'parte'));

-- E20d-3: la página se leyó con OCR (su cita dice "escaneada").
ALTER TABLE fragmentos_pdf ADD COLUMN IF NOT EXISTS ocr BOOLEAN NOT NULL DEFAULT false;

-- Qué agrupa cada fila: los capítulos de un libro, las secciones de un Markdown o un Word, las diapositivas de un
-- PowerPoint o las partes de un texto.
ALTER TABLE capitulos ADD COLUMN IF NOT EXISTS tipo VARCHAR(11) NOT NULL DEFAULT 'capitulo';
ALTER TABLE capitulos ADD CONSTRAINT capitulos_tipo_valido
  CHECK (tipo IN ('capitulo', 'seccion', 'diapositiva', 'parte'));
