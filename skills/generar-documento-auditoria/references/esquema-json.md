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
| `multiselect` (v2) | lista de opciones | Exige `options`. Se muestra como un grupo de casillas. |

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
| `filled` | todos salvo `checkbox` |

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

## Textos derivados (v2)

Para lo que cambia dentro de la frase. Gana el primer caso cuya condición se cumpla; si ninguno, `default` (obligatorio, puede ser `""`). Los textos pueden usar `{{campo}}`, pero no otro derivado.

```json
"derived": {
  "socios": { "cases": [ { "when": { "field": "forma", "equals": "S.L." }, "text": "socios" } ], "default": "accionistas" },
  "por_encargo": { "cases": [ { "when": { "field": "encargante", "filled": true }, "text": " por encargo de {{encargante}}" } ], "default": "" }
}
```

En títulos, encabezados y párrafos se usan como un campo: `{{socios}}`, `{{por_encargo}}`.

## Marcadores

`{{id}}` inserta un campo `text`, `textarea`, `date` o `select`, o un texto derivado. No puede insertar casillas, selecciones múltiples ni condiciones. Campos, derivados y condiciones comparten identificadores: no puede haber repeticiones.

## Validación

`node bin/generar-documento.mjs validate plantilla.json` detiene la generación ante cualquier error, con la ruta exacta (por ejemplo `sections[4].paragraphs[2].when.equals`), incluido un valor que no es una opción (sugiere la más parecida) o una sección que ninguna combinación de respuestas puede mostrar. Los avisos (`Aviso: …`) no bloquean pero deben revisarse: campos sin uso, opciones que ninguna condición menciona (normal si esa opción es la rama por defecto) y marcas del modelo coladas en el texto (`[●]`, `XXX`, `[Incluir…]`, `[1]`), demasiadas combinaciones para comprobar si una sección es alcanzable (revísala a mano) y, en plantillas `schema_version` 1, claves desconocidas.

Las opciones de `select` y `multiselect` no pueden empezar ni terminar con espacios. Las claves desconocidas (por ejemplo `whn` en lugar de `when`) son un error en `schema_version` 2 y un aviso en `schema_version` 1, para que las plantillas antiguas sigan siendo válidas.

Redacta los párrafos completos según el modelo verificado. El HTML no invoca al LLM tras abrirse: solo inserta datos y selecciona las variantes previstas en el JSON. Por ello, no uses la plantilla para prometer que generará opiniones, conclusiones u otra redacción que dependa de juicio profesional nuevo.
