-- M20 (PLAN_AMPLIACION 6.16, E10c): en qué palabra empieza cada página del documento, para responder por página
-- solo con el texto de esa página (RB-39). Solo aditiva: los documentos ya indexados y los de master quedan en NULL.
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS inicio_paginas INTEGER[];
