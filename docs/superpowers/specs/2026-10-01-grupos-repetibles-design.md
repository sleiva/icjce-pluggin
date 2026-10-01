# Grupos repetibles y tablas en `generar-documento-auditoria`

Fecha: 2026-10-01 · Subproyecto 2 de 4 de la ampliación del motor documental · Estado: diseño aprobado en conversación, pendiente de revisión escrita.

Depende del subproyecto 1 (`docs/superpowers/specs/2026-10-01-condiciones-documento-design.md`, publicado en v0.5.0).

## Objetivo

Permitir que la habilidad represente el contenido repetido de cualquier modelo (tablas con columnas fijas, enumeraciones y bloques de párrafos por elemento) mediante un único tipo de campo repetible y un tipo de párrafo que decide su presentación. Sin código específico por documento.

Fuera de alcance: sumas, totales y formato numérico (subproyecto 4), modo lote (subproyecto 3), condiciones por fila, grupos anidados, casillas o selecciones múltiples dentro de una fila, reordenar filas.

## Evidencia

Modelos vigentes en `kg_icjce_processed_files` / `kg_icjce_chunks` (proyecto Supabase `boygddyuxkdljzpndusd`):

- **5335**, carta de manifestaciones: tabla de incorrecciones no corregidas (Concepto · Efecto en resultado · Efecto en reservas · Efecto en patrimonio neto · Otros) con filas vacías y fila de total.
- **1723**, confirmación de independencia EIP: tabla de tres columnas de texto (Circunstancia · Amenazas · Salvaguardas) y honorarios desglosados por concepto.
- **1728**, carta a responsables del gobierno, fase final: sección de incorrecciones «Incluir solo si…», lista de asuntos pendientes antes del informe, «[enumerar documentos]», deficiencias de control como bloques.

Tres formas de salida: **tabla**, **lista** y **bloques de párrafos por elemento**.

## 1. Esquema

Todo lo siguiente pertenece a `schema_version: 2` (adición compatible: las plantillas v2 existentes siguen siendo válidas y producen lo mismo).

### Campo `group`

```json
{ "id": "incorrecciones", "label": "Incorrecciones no corregidas", "type": "group",
  "min_rows": 0, "max_rows": 20, "help": "Una fila por incorrección.",
  "fields": [
    { "id": "concepto", "label": "Concepto", "type": "text", "required": true },
    { "id": "efecto_resultado", "label": "Efecto en resultado", "type": "text" }
  ] }
```

- Claves admitidas: `id`, `label`, `type`, `fields`, `required`, `help`, `when`, `value`, `min_rows`, `max_rows`.
- `fields`: entre 1 y 8 subcampos. Claves de subcampo: `id`, `label`, `type` (`text`, `textarea`, `date`, `select`), `required`, `help`, `options` (obligatorio y único solo en `select`, sin espacios al principio ni al final). Sin `when` ni `value`.
- `required` del grupo: al menos una fila con contenido. `required` de un subcampo: obligatorio en cada fila con contenido.
- `min_rows`, `max_rows`: enteros entre 0 y 50; por defecto 0 y 50; `min_rows ≤ max_rows`; `max_rows ≥ 1`.
- `value`: lista de filas iniciales (máximo `max_rows`); cada fila es un objeto cuyas claves son subcampos del grupo y cuyos valores son textos (en `select`, una opción).
- Los identificadores de subcampo están en el espacio de nombres global: no pueden coincidir con campos, derivados, condiciones ni subcampos de otros grupos.
- Un grupo solo admite el operador `filled` y no puede insertarse con `{{…}}`. Un subcampo no puede aparecer en condiciones ni en textos fuera de su `repeat`.

### Párrafo `repeat`

Nuevo tipo de elemento en `paragraphs`:

```json
{ "repeat": "incorrecciones", "as": "table", "columns": ["concepto", "efecto_resultado"] }
{ "repeat": "pendientes", "as": "list", "item": "{{asunto}} (responsable: {{responsable}})" }
{ "repeat": "deficiencias", "as": "blocks", "paragraphs": ["{{descripcion}}", "Recomendación: {{recomendacion}}"],
  "empty": "No hemos identificado deficiencias significativas." }
```

- Comunes: `repeat` (id de un campo `group`), `as` (`table` | `list` | `blocks`), `when` opcional, `empty` opcional (texto; admite `{{campo}}` y `{{derivado}}` globales, no subcampos).
- `table`: `columns` opcional (subcampos del grupo, sin repetir); por defecto todos en su orden. Encabezados = etiquetas de los subcampos.
- `list`: `item` obligatorio (texto).
- `blocks`: `paragraphs` obligatorio (entre 1 y 10 textos).
- En `item` y en `paragraphs` de `blocks`, `{{id}}` admite subcampos del propio grupo, campos globales insertables y derivados.

### Salida de `buildModel`

Cada elemento de `sections[].paragraphs` es uno de:

- un texto (como hasta ahora);
- `{ "table": { "headers": ["…"], "rows": [["…", "…"]] } }`;
- `{ "list": ["…", "…"] }`.

`blocks` se expande en textos. Si el grupo no tiene filas con contenido: se usa `empty` como texto si existe; si no, el elemento desaparece. Una sección sin elementos visibles desaparece (regla existente).

## 2. Validador

Se mantienen todas las reglas del subproyecto 1. Errores nuevos (ruta exacta como prefijo):

1. Grupo: `fields` ausente, vacío o con más de 8; subcampo de tipo no admitido; subcampo con clave desconocida (incluidas `when` y `value`); `options` inválidas; `min_rows`/`max_rows` no enteros, fuera de 0–50, `min_rows > max_rows` o `max_rows < 1`; `value` que no es lista de objetos, excede `max_rows`, usa claves que no son subcampos, valores no textuales u opciones inexistentes.
2. Identificador de subcampo repetido con cualquier identificador global o con otro subcampo.
3. Operador distinto de `filled` sobre un grupo; condición sobre un subcampo; `{{grupo}}` o `{{subcampo}}` en un texto que no es plantilla de su `repeat`.
4. `repeat`: campo inexistente o que no es `group`; `as` inválido; claves que no corresponden a su forma; `item` o `paragraphs` ausentes en `list`/`blocks`; `paragraphs` con más de 10 textos; `columns` con elementos que no son subcampos del grupo o repetidos; `{{subcampo}}` de otro grupo.
5. Alcanzabilidad: un grupo aporta los valores «vacío» y «con filas» a las combinaciones. Un `repeat` cuenta como visible si su `when` se cumple y (el grupo tiene filas o hay `empty`).

Avisos nuevos:

- Grupo que no aparece en ningún `repeat`.
- Subcampo que no aparece en ninguna columna ni plantilla de los `repeat` de su grupo.
- Marcas del modelo en `item`, `paragraphs` de `blocks` y `empty`.

## 3. Motor en el navegador

### Evaluador (`assets/evaluator.js`)

- `emptyValue(group) = []`; un grupo oculto vale `[]`.
- Las filas cuyos subcampos están todos vacíos se descartan antes de evaluar o presentar.
- `isEmpty(group, rows)`: no queda ninguna fila con contenido.
- `buildModel` resuelve cada `repeat` según la sección 1; con `markMissing`, un subcampo vacío se muestra como `[Etiqueta]`.

### Exportación (`assets/docx.js`, nuevo)

Se extraen del runtime `xml`, `paragraphXml` y `docxXml` a `assets/docx.js`, que expone `globalThis.DocExport = { xml, paragraphXml, tableXml, listXml, docxXml }`. El renderizador lo inserta en el HTML después del evaluador y antes del runtime. `zip()`, `docx()` y la descarga permanecen en el runtime.

- Tabla: `w:tbl` al ancho de página, bordes simples, fila de cabecera en negrita con `w:tblHeader`, celdas con estilo Normal y texto escapado.
- Lista: un párrafo por elemento con sangría y prefijo «• » (sin `numbering.xml`).
- Un documento sin tablas ni listas produce exactamente el mismo `document.xml` que hoy.

### Runtime (`assets/assistant-runtime.js`)

- Un grupo se muestra como `fieldset` con una tarjeta por fila (subcampos y botón «Quitar») y un botón «Añadir fila», desactivado al alcanzar `max_rows`. Al abrir se crean las filas de `value` o `min_rows` filas vacías.
- `collect()` devuelve para un grupo la lista de filas (objetos con los subcampos).
- Obligatorios: grupo `required` con al menos una fila con contenido; subcampos `required` rellenos en cada fila con contenido; filas con contenido ≥ `min_rows`. El botón de generar enfoca el primer hueco pendiente. El progreso cuenta el grupo como un campo obligatorio.
- Vista previa: `table` como `<table>` con cabecera y bordes finos; `list` como `<ul>`; siempre con `textContent`. En impresión, `tr { break-inside: avoid }`.

## 4. Pruebas y documentación

Pruebas en `tests/generar-documento/` (`node:test`, sin dependencias):

- `evaluator.test.mjs`: filas en blanco descartadas; `filled` sobre grupo; grupo oculto `[]`; `table` con y sin `columns`; `list`; `blocks`; `empty` y desaparición sin `empty`; `[Etiqueta]` en subcampo vacío con `markMissing`; sección con solo un `repeat` vacío eliminada.
- `validator.test.mjs`: un caso de rechazo por cada error de la sección 2 y cada aviso nuevo.
- `docx.test.mjs` (nuevo): `document.xml` de `examples/carta-encargo.json` idéntico a la referencia capturada del código actual antes del cambio; tabla con `w:tbl`, `w:tblHeader` y escape de `&`, `<`, `"`; lista con «•».
- `render.test.mjs`: el HTML incrusta `DocExport` entre el evaluador y el runtime.
- Plantilla sintética `fixtures/comunicacion-final.v2.json` (estructura inspirada en 1728 y 5335, texto inventado) con tabla de incorrecciones, lista de pendientes y bloques de deficiencias con `empty`.
- Comprobación en navegador: añadir y quitar filas, límite `max_rows`, obligatorios por fila, tabla en vista previa y DOCX descargado con tabla.

Documentación:

- `references/esquema-json.md`: secciones de `group` y `repeat` con un ejemplo de cada forma.
- `references/analisis-modelo.md`: la fila «Listas o tablas que se repiten» pasa a `group` + `repeat` (`table` para columnas fijas, `list` para enumeraciones, `blocks` para bloques por elemento); la fila de total es un campo normal hasta el subproyecto 4.
- `SKILL.md`: añade `group` y `repeat` a las piezas de la versión 2.
- `scripts/validate.py`: comprueba la existencia de `assets/docx.js`.

## Criterios de aceptación

- `node --test tests/generar-documento/*.test.mjs` y `scripts/validate.py` pasan.
- `examples/carta-encargo.json` y `fixtures/comunicacion-gobierno.v2.json` producen el mismo `buildModel` y el mismo `document.xml` que antes.
- La plantilla `comunicacion-final.v2.json` cubre las tres formas, `empty`, `min_rows`/`max_rows` y subcampos obligatorios; se abre en el navegador y exporta un DOCX con tabla.
- Cada error nuevo de la sección 2 tiene una prueba de rechazo.
