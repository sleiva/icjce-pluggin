# Del modelo MCP al formulario

## 1. Elegir el modelo

Usa `buscar_modelos_informe` primero. Ajusta `tipo` al documento solicitado (`informe_auditoria`, `carta_encargo`, `carta_manifestaciones`, `procedimientos_acordados`, `revision_limitada`, `informe_especial`, `confirmacion_independencia`, `comision_auditoria`, `comunicacion_gobierno`, `parrafo`, `cuestionario` u `otro`). Para informes de auditoría, añade `tipo_opinion`, `eip` y `variante` solo si el usuario los conoce. `query` precisa el tema. Si los filtros estrictos no devuelven resultados, amplía la consulta y verifica manualmente la aplicabilidad de los candidatos.

Compara los resultados por título, tipo de encargo, versión, vigencia, fecha, sector, opinión, EIP y variante cuando esos datos aparezcan. No confundas una mención lateral en una guía con un modelo completo. La búsqueda puede devolver la posición de un ejemplo dentro de un documento largo; conserva `doc_id`, `fuente` y `desde` para la lectura. Esos identificadores son internos y no deben mostrarse al usuario.

## 2. Leer el texto suficiente

Llama a `leer_documento(doc_id, fuente, desde)` y sigue las instrucciones de continuación que entregue (`desde` y, si procede, `desde_caracter`). Si la posición apunta al medio de una guía, lee también el contexto anterior que indique a qué casos aplica. Reúne todos los apartados del modelo elegido, instrucciones de cumplimentación, notas y alternativas. Para localizar un apartado en un documento largo puedes usar el argumento `buscar`, pero después abre el pasaje en su secuencia.

Anota la URL exacta de la fuente y cualquier aviso de vigencia. `buscar_modelos_informe` no filtra por ejercicio, de modo que el ejercicio del usuario debe contrastarse con la fecha y el ámbito del documento y, si es necesario, con la norma o circular aplicable.

## 3. Hacer el inventario de datos

Antes de escribir el JSON, completa una matriz interna como esta:

| Apartado o pasaje del modelo | Texto fijo | Dato que aporta el auditor | Marca del modelo → pieza | Campo JSON | Obligatorio / condición | Evidencia |
|---|---|---|---|---|---|---|
| Encabezado | Fórmula de destinatario | Nombre y cargo del destinatario | Hueco «[Destinatario]» → `text` | `destinatario` | Siempre | URL y apartado leídos |
| Identificación del encargo | Texto del modelo | Entidad y fecha de cierre | Huecos → `text`, `date` | `entidad`, `fecha_cierre` | Siempre | URL y apartado leídos |
| Párrafo alternativo | Redacción de la variante | Selección de variante | «Sustituir por…» → `select` + párrafo con `when` | `tipo_opinion` | Solo si el caso lo requiere | URL y apartado leídos |
| Cláusula opcional | Texto de la cláusula | Si procede incluirla | «Incluir solo si…» → `checkbox` + `when` | `incertidumbre` | Condición de la sección | URL y apartado leídos |

La tabla es una técnica de análisis, no una lista de campos universales. Incluye anexos, tablas, firmas, periodos comparativos, salvedades y notas de cumplimentación si están en el modelo. Distingue hechos conocidos, datos pendientes y decisiones profesionales. Nunca marques una decisión profesional como predeterminada por comodidad.

## 4. Reconocer la variación del modelo

Recorre el texto leído buscando **cada** marca de variación, no solo los huecos. Las marcas cambian de un documento a otro (corchetes, cursivas, notas al pie, recuadros, instrucciones «para el auditor»); identifícalas por su función y tradúcelas a la pieza correspondiente de `references/esquema-json.md`:

| Lo que aparece en el modelo | Pieza |
|---|---|
| «Incluir esta sección/párrafo solo si…», «en su caso», «si procede», «cuando proceda» | `checkbox` + `when` en la sección o el párrafo; `multiselect` + `includes` si son varias de la misma familia (manifestaciones adicionales, asuntos a comunicar) |
| «Aplicable solo a EIP / consolidadas / cotizadas / voluntarias» | `select` + `equals` o `in`; `all` / `any` cuando se cruzan dos datos (cotizada **y** sujeta a LSC) |
| Alternativas completas («sustituir por opinión con salvedades, desfavorable…», «Alternativa A / B») | `select` + un párrafo o una sección por variante, cada uno con su `when` |
| «[A/B]» dentro de la frase (Accionistas/Socios, la Sociedad/el Grupo, singular/plural, órgano) | `derived` con un caso por opción del `select` que lo decide |
| Fragmento opcional en línea («[por encargo de…]») | `derived` con un caso `filled` y `default` vacío |
| Dato que solo se pide en una variante (fundamento de la salvedad, descripción del énfasis) | campo con `when`, declarado después del campo que lo decide |
| Huecos de datos («[ABC, S.A.]», «[XX de XXXX de 20XX]», «[describir…]») | campo `text`, `date` o `textarea` |
| Notas al pie (`[1]`, `[^2]`), «[Publicado mediante…]», instrucciones al auditor, recuadros | se eliminan del texto; si condicionan algo, se convierten en la condición que describen |
| Tabla con columnas fijas y filas que rellena el auditor (incorrecciones, honorarios, amenazas y salvaguardas) | `group` con un subcampo por columna + `repeat` con `as: "table"` |
| Enumeración de elementos («[enumerar documentos]», asuntos pendientes) | `group` + `repeat` con `as: "list"` |
| Bloque de párrafos por elemento (cada deficiencia con su recomendación, cada carta de abogado) | `group` + `repeat` con `as: "blocks"`; si el modelo prevé un texto para cuando no hay elementos, ponlo en `empty` |
| Importes y cantidades del modelo (saldos, honorarios, cifras de las cuentas) | campo `number` con `unit`; los códigos postales, NIF o teléfonos son `text` |
| Fila de total de una tabla | `computed` con `sum(grupo.subcampo)` sobre un subcampo `number` |
| Cálculos del encargo (materialidad, materialidad de ejecución, umbral de claramente triviales, porcentajes) | `computed` con la fórmula que describe el modelo o la norma; los porcentajes se escriben como se leen y se dividen por 100 |
| Umbrales («si las incorrecciones superan la materialidad…», «cuando los honorarios excedan…») | condición con `gt`, `gte`, `lt`, `lte` o `eq` sobre campos numéricos |
| Una variación que ninguna pieza representa fielmente | pregunta al usuario o prepara asistentes separados; nunca la aproximes |

Si el modelo es una carta que se envía con el mismo texto a varios destinatarios (circularizaciones de bancos, clientes, proveedores o asesores legales), pon los datos propios de cada destinatario (nombre, dirección, tratamiento, saldo…) en `batch.fields` y deja el resto como datos comunes; `batch.filename` debe identificar al destinatario. Los anexos o tablas distintos por destinatario (por ejemplo, la relación de litigios de cada despacho) todavía no admiten lote: díselo al usuario y prepara la tabla como grupo común o cartas separadas.

Cuando la misma lógica se repite en varios sitios (por ejemplo «opinión modificada»), defínela una vez en `conditions` y úsala con `ref`.

## 5. Traducir al JSON y comprobar cobertura

- Conserva el orden de los apartados y el sentido de los párrafos relevantes en `sections`. Usa `{{campo}}` solo para datos variables.
- Usa `fields` para cada dato pendiente. Una misma respuesta puede reutilizarse en varios apartados. Añade `help` para explicar formatos, unidades o referencias al encargo.
- Representa cada marca de variación con la pieza del apartado 4 y usa `schema_version: 2` si empleas alguna pieza nueva. Si una variante requiere una redacción no representable fielmente, crea asistentes separados o pide antes la elección al usuario.
- No copies marcas como `[●]`, `XXXXX` o instrucciones editoriales al documento final; conviértelas en campos o elimínalas si son notas del modelo, revisando que el sentido no cambie.
- Añade la URL exacta del modelo en `sources`. Explica si se usó una fuente secundaria o si faltó el texto completo.
- Antes de renderizar, compara cada fila de la matriz con `fields`, `sections` y condiciones. No debe quedar dato solicitado sin campo ni campo sin propósito claro en el documento.
- Ejecuta `validate` hasta que no haya errores. Revisa cada `Aviso:` y, al entregar, explica cuáles aceptas y por qué (por ejemplo, una opción que es la rama por defecto).
