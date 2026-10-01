# Plantilla JSON del asistente

La plantilla es un objeto JSON. El renderizador valida la estructura antes de crear el HTML.

| Propiedad | Tipo | Uso |
|---|---|---|
| `schema_version` | número `1` | Versión del formato. |
| `title` | texto | Título del documento. Admite `{{campo}}`. |
| `subtitle` | texto opcional | Subtítulo. Admite `{{campo}}`. |
| `fields` | lista de objetos | Entre 1 y 50 campos. |
| `sections` | lista de objetos | Entre 1 y 50 secciones. |
| `sources` | lista opcional | Hasta 20 objetos `{ "title": "…", "url": "https://…" }`. |
| `include_sources_in_output` | booleano opcional | Si es `true`, añade las fuentes al documento; por defecto solo se muestran en la interfaz. |

Cada campo usa `id` único en minúsculas (`[a-z][a-z0-9_]*`), `label` y `type`: `text`, `textarea`, `date` o `select`. Puede tener `required` (booleano), `value` (texto inicial) y `help` (texto de ayuda). El tipo `select` exige `options`, una lista de textos.

Cada sección usa `heading` y `paragraphs` (lista de textos). Puede tener `when: { "field": "id", "equals": "valor" }` para aparecer solo cuando el campo coincide exactamente. Los marcadores `{{id}}` sustituyen la respuesta del formulario. Los identificadores no declarados provocan error de validación.

Redacta los párrafos completos según el modelo verificado. El HTML no invoca al LLM tras abrirse: solo inserta datos y selecciona las variantes previstas en el JSON. Por ello, no uses la plantilla para prometer que generará opiniones, conclusiones u otra redacción que dependa de juicio profesional nuevo.
