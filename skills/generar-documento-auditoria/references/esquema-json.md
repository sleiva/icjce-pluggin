# Plantilla JSON del asistente

La plantilla es un objeto JSON. El renderizador valida la estructura antes de crear el HTML. Construye `fields` y `sections` después de buscar el modelo con `buscar_modelos_informe`, leerlo con `leer_documento` y completar el inventario de `references/analisis-modelo.md`.

Usa `schema_version: 2` cuando el modelo tenga variación (cláusulas opcionales, alternativas, fragmentos que cambian dentro de la frase). La versión 1 sigue siendo válida para plantillas sin variación o con una sola alternativa por sección.

| Propiedad | Tipo | Uso |
|---|---|---|
| `schema_version` | `1` o `2` | Versión del formato. Lo marcado «v2» exige `2`. |
| `title` | texto | Título del documento. Admite `{{id}}`. |
| `subtitle` | texto opcional | Subtítulo. Admite `{{id}}`. |
| `fields` | lista de objetos | Entre 1 y 50 campos (80 en v2). |
| `conditions` | objeto opcional (v2) | Condiciones con nombre reutilizables. |
| `derived` | objeto opcional (v2) | Textos derivados para lo que cambia dentro de la frase. |
| `batch` | objeto opcional (v2) | Generación por lotes: qué campos vienen de un listado de destinatarios. |
| `sections` | lista de objetos | Entre 1 y 50 secciones (80 en v2). |
| `sources` | lista opcional | Hasta 20 objetos `{ "title": "…", "url": "https://…" }`. |
| `include_sources_in_output` | booleano opcional | Si es `true`, añade las fuentes al documento; por defecto solo se muestran en la interfaz. |

## Campos

Cada campo usa `id` único en minúsculas (`[a-z][a-z0-9_]*`), `label` y `type`. Puede tener `required` (booleano), `value` (valor inicial) y `help` (texto de ayuda).

| `type` | Valor | Notas |
|---|---|---|
| `text`, `textarea`, `date` | texto | |
| `select` | texto | Exige `options` (textos únicos). |
| `checkbox` (v2) | sí / no | Sin `options`. Con `required: true` obliga a marcarla («confirmo que…»). |
| `number` (v2) | importe o cantidad | Ver «Números y cálculos». Se escribe «1.234,56» y sale con formato. |
| `computed` (v2) | resultado de una fórmula | Ver «Números y cálculos». De solo lectura; sin `required` ni `value`. |
| `multiselect` (v2) | lista de opciones | Exige `options`. Se muestra como un grupo de casillas. |
| `group` (v2) | lista de filas | Campo repetible con subcampos; ver «Grupos repetibles». Solo admite la condición `filled` (al menos una fila con contenido). |

Un campo puede llevar `when` (v2): si la condición no se cumple, el campo no se muestra, deja de ser obligatorio y vale vacío en condiciones y textos. La condición de un campo solo puede usar campos **declarados antes** que él.

## Condiciones

Una condición es un objeto con un único operador. Se admite en campos, secciones, párrafos y casos de textos derivados.

```json
{ "field": "opinion", "equals": "Favorable" }
{ "field": "opinion", "in": ["Con salvedades", "Desfavorable"] }
{ "field": "incertidumbre", "checked": true }
{ "field": "asuntos", "includes": "Indicios de fraude" }
{ "field": "encargante", "filled": true }
{ "all": [ { … }, { … } ] }
{ "any": [ { … }, { … } ] }
{ "not": { … } }
{ "ref": "es_eip" }
```

| Operador | Campos admitidos |
|---|---|
| `equals`, `in` | `select`, `text` |
| `checked` | `checkbox` |
| `includes` | `multiselect` |
| `filled` | todos salvo `checkbox` (incluido `group`) |
| `gt`, `gte`, `lt`, `lte`, `eq` | `number`, `computed` |

- Los valores de `equals`, `in` e `includes` deben coincidir **literalmente** con una opción del campo (en campos con opciones).
- `all` y `any` necesitan al menos dos condiciones. El anidamiento máximo es de tres niveles, contando lo que aporte un `ref`.
- En la versión 1 solo se admite `{ "field": …, "equals": … }` en secciones.

## Condiciones con nombre (v2)

```json
"conditions": { "opinion_modificada": { "field": "opinion", "in": ["Con salvedades", "Desfavorable", "Denegada"] } }
```

Se usan con `{ "ref": "opinion_modificada" }`. Una condición con nombre no puede contener `ref`.

## Secciones y párrafos

Cada sección usa `heading`, `paragraphs` y, opcionalmente, `when`. Cada párrafo es un texto o, en v2, `{ "text": "…", "when": { … } }`. Un párrafo con condición falsa se omite; una sección sin párrafos visibles desaparece con su título.

```json
{ "heading": "Opinión", "paragraphs": [
  { "text": "En nuestra opinión, …", "when": { "field": "opinion", "equals": "Favorable" } },
  { "text": "Excepto por los efectos de … {{fundamento}}", "when": { "ref": "opinion_modificada" } }
] }
```

## Grupos repetibles (v2)

Para tablas, enumeraciones y bloques que se repiten por elemento (incorrecciones, honorarios, deficiencias, asuntos pendientes). El campo guarda las filas; un párrafo `repeat` decide cómo se presentan.

```json
{ "id": "incorrecciones", "label": "Incorrecciones no corregidas", "type": "group", "max_rows": 20,
  "fields": [
    { "id": "concepto", "label": "Concepto", "type": "text", "required": true },
    { "id": "efecto_resultado", "label": "Efecto en resultado", "type": "text" }
  ] }
```

- `fields`: entre 1 y 8 subcampos de tipo `text`, `textarea`, `date`, `select` o `number` (claves `id`, `label`, `type`, `required`, `help`, `options`, y `decimals`/`unit` en los `number`); `options` es obligatorio solo en los `select` y no se admite en los demás. Sin `when` ni `value` propios.
- `required` del grupo: al menos una fila con contenido; `required` de un subcampo: obligatorio en cada fila con contenido. Las filas en blanco se ignoran.
- `min_rows` y `max_rows`: enteros entre 0 y 50 (por defecto 0 y 50); `max_rows` debe ser al menos 1 y `min_rows` no puede superar a `max_rows`. `value`: filas iniciales, como lista de objetos `{ "subcampo": "texto" }`.
- Los identificadores de subcampo no pueden repetir ningún otro identificador. Un subcampo solo puede usarse dentro de los `repeat` de su grupo; no en condiciones ni en otros textos.
- Importes y totales son texto: la fila de total se pide como un campo normal (por ejemplo, con `when: { "field": "incorrecciones", "filled": true }`).

Párrafo `repeat`, en cualquier lugar de `paragraphs`:

```json
{ "repeat": "incorrecciones", "as": "table", "columns": ["concepto", "efecto_resultado"] }
{ "repeat": "pendientes", "as": "list", "item": "{{asunto}} (responsable: {{responsable}})" }
{ "repeat": "deficiencias", "as": "blocks", "paragraphs": ["{{descripcion}}", "Recomendación: {{recomendacion}}"],
  "empty": "No hemos identificado deficiencias significativas." }
```

- `table`: una tabla con los subcampos como columnas (por defecto todos, en su orden; `columns` elige y ordena). Los encabezados son las etiquetas.
- `list`: una viñeta por fila con la plantilla `item`.
- `blocks`: los textos de `paragraphs` (entre 1 y 10) para cada fila.
- `item` y `paragraphs` admiten los subcampos del grupo y los campos y derivados globales. `empty` (opcional) es el texto si no hay filas y solo admite campos y derivados globales; sin `empty`, el párrafo desaparece cuando no hay filas.
- Admite `when` como cualquier párrafo.

## Números y cálculos (v2)

Usa `number` solo para importes, porcentajes y cantidades; los códigos postales, NIF, teléfonos o números de cuenta son `text` (conservan sus dígitos exactos).

```json
{ "id": "base", "label": "Cifra de negocios", "type": "number", "required": true, "unit": "€" },
{ "id": "porcentaje", "label": "Porcentaje aplicado", "type": "number", "required": true, "decimals": 1, "unit": "%" },
{ "id": "materialidad", "label": "Materialidad", "type": "computed", "expr": "base * porcentaje / 100", "unit": "€" },
{ "id": "total_incorrecciones", "label": "Total", "type": "computed", "expr": "sum(incorrecciones.importe)", "unit": "€" }
```

- `number`: `decimals` (0 a 6, por defecto 2) y `unit` (texto de hasta 30 caracteres, opcional). El auditor puede escribir «1.234,56», «1234,56» o «1234.56»; «1.234» se lee como mil doscientos treinta y cuatro. Un valor no numérico se marca y bloquea la generación. Se admite también como subcampo de un `group` y como campo de `batch.fields`.
- `computed`: `expr` obligatoria (hasta 500 caracteres y 10 niveles de paréntesis), `decimals`, `unit`, `help` y `when`. La fórmula admite números (con punto decimal), campos `number` o `computed` **declarados antes**, `+ - * /`, paréntesis, `sum(grupo.subcampo)` (subcampo `number`; suma las filas con contenido; 0 sin filas), `min(a, b, …)`, `max(a, b, …)`, `round(x, n)` (n fijo de 0 a 6) y `abs(x)`. Sin `eval`: cualquier otra cosa es un error con su posición.
- Los porcentajes se escriben como se leen (5 es un 5 %): divide por 100 en la fórmula.
- Si falta un dato, hay un número no válido o una división por cero, el cálculo queda sin valor: `[Etiqueta]` en la vista previa y vacío en el documento. Se calcula con precisión completa y se redondea al mostrarlo (medio hacia arriba); usa `round` para redondear un paso intermedio.
- En el documento: «1.234,56 €» (separador de miles, coma decimal y la unidad tras un espacio duro), también en las celdas de las tablas.
- Comparaciones en condiciones: `{ "field": "total_incorrecciones", "gt": "materialidad" }` o `{ "field": "honorarios_pct", "gte": 15 }`, con `gt`, `gte`, `lt`, `lte` o `eq` contra un número o contra otro campo numérico. Si un lado no tiene valor, la condición es falsa.

## Textos derivados (v2)

Para lo que cambia dentro de la frase. Gana el primer caso cuya condición se cumpla; si ninguno, `default` (obligatorio, puede ser `""`). Los textos pueden usar `{{campo}}`, pero no otro derivado.

```json
"derived": {
  "socios": { "cases": [ { "when": { "field": "forma", "equals": "S.L." }, "text": "socios" } ], "default": "accionistas" },
  "por_encargo": { "cases": [ { "when": { "field": "encargante", "filled": true }, "text": " por encargo de {{encargante}}" } ], "default": "" }
}
```

En títulos, encabezados y párrafos se usan como un campo: `{{socios}}`, `{{por_encargo}}`.

## Generación por lotes (v2)

Para cartas que se envían con el mismo texto a muchos destinatarios (circularizaciones a bancos, clientes, proveedores, asesores legales). El auditor rellena los datos comunes, carga un listado y descarga un ZIP con un DOCX por destinatario o un PDF con todas las cartas.

```json
"batch": {
  "label": "Destinatarios",
  "fields": ["destinatario", "direccion", "tratamiento", "saldo"],
  "filename": "Confirmación {{destinatario}}"
}
```

- `label`: título de la sección del listado.
- `fields`: entre 1 y 20 campos ya declarados en `fields`, de tipo `text`, `textarea`, `date`, `select` o `number` (no `computed`), cuyos valores vienen del listado. Pueden tener `required` y `when`; se evalúan fila a fila con los datos comunes y los de la fila. Los grupos (`group`) son comunes a todo el lote.
- `filename`: nombre de cada DOCX; admite `{{campo}}` y `{{derivado}}` y debe usar al menos un campo de `fields`. Se quitan los caracteres no válidos y los duplicados se numeran («(2)», «(3)»).
- El listado se pega desde Excel (con la fila de encabezados) o se sube como `.xlsx` (primera hoja) o `.csv` (`;`, `,` o tabulador; UTF-8 o Windows-1252). Máximo 500 destinatarios y 50 columnas con encabezado; los archivos, como máximo 5 MB. También se admite el `.txt` «Texto Unicode» (UTF-16) de Excel. Un campo común a todas las cartas (que no está en `fields`) no puede tener un `when` que dependa de un campo del lote; las secciones, párrafos y textos derivados sí pueden.
- Cada encabezado se empareja con el identificador o la etiqueta de un campo del lote, sin distinguir mayúsculas, tildes ni espacios frente a guiones bajos. Las columnas sin campo se ignoran con aviso. Falta de una columna obligatoria (sin `when`), dos columnas para el mismo campo o un listado vacío bloquean la carga.
- Por fila: un `select` acepta la opción sin distinguir mayúsculas ni tildes; una fecha acepta `dd/mm/aaaa`, `aaaa-mm-dd` o fecha de Excel y se guarda como `aaaa-mm-dd`; un número de Excel en un campo de texto conserva sus dígitos exactos («28001», «1234,5»); en un campo `number` se formatea como importe; un obligatorio visible vacío es un error de esa fila. No se genera el lote mientras haya errores.
- El modo «Un documento» sigue disponible: los campos del lote se rellenan a mano.

## Marcadores

`{{id}}` inserta un campo `text`, `textarea`, `date`, `select`, `number` o `computed` (estos dos, con formato), o un texto derivado. No puede insertar casillas, selecciones múltiples ni condiciones. Campos, derivados y condiciones comparten identificadores: no puede haber repeticiones.

## Validación

`node bin/generar-documento.mjs validate plantilla.json` detiene la generación ante cualquier error, con la ruta exacta (por ejemplo `sections[4].paragraphs[2].when.equals`), incluido un valor que no es una opción (sugiere la más parecida) o una sección que ninguna combinación de respuestas puede mostrar. Los avisos (`Aviso: …`) no bloquean pero deben revisarse: campos sin uso, opciones que ninguna condición menciona (normal si esa opción es la rama por defecto) marcas del modelo coladas en el texto (`[●]`, `XXX`, `[Incluir…]`, `[1]`), un grupo que ningún párrafo `repeat` utiliza, un subcampo que no aparece en ninguna columna ni plantilla de su grupo, demasiadas combinaciones para comprobar si una sección es alcanzable (revísala a mano) y, en plantillas `schema_version` 1, claves desconocidas.

Las opciones de `select` y `multiselect` no pueden empezar ni terminar con espacios. Las claves desconocidas (por ejemplo `whn` en lugar de `when`) son un error en `schema_version` 2 y un aviso en `schema_version` 1, para que las plantillas antiguas sigan siendo válidas.

Redacta los párrafos completos según el modelo verificado. El HTML no invoca al LLM tras abrirse: solo inserta datos y selecciona las variantes previstas en el JSON. Por ello, no uses la plantilla para prometer que generará opiniones, conclusiones u otra redacción que dependa de juicio profesional nuevo.
