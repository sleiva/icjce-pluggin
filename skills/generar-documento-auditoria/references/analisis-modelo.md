# Del modelo MCP al formulario

## 1. Elegir el modelo

Usa `buscar_modelos_informe` primero. Ajusta `tipo` al documento solicitado (`informe_auditoria`, `carta_encargo`, `carta_manifestaciones`, `procedimientos_acordados`, `revision_limitada`, `informe_especial`, `confirmacion_independencia`, `comision_auditoria`, `comunicacion_gobierno`, `parrafo`, `cuestionario` u `otro`). Para informes de auditoría, añade `tipo_opinion`, `eip` y `variante` solo si el usuario los conoce. `query` precisa el tema. Si los filtros estrictos no devuelven resultados, amplía la consulta y verifica manualmente la aplicabilidad de los candidatos.

Compara los resultados por título, tipo de encargo, versión, vigencia, fecha, sector, opinión, EIP y variante cuando esos datos aparezcan. No confundas una mención lateral en una guía con un modelo completo. La búsqueda puede devolver la posición de un ejemplo dentro de un documento largo; conserva `doc_id`, `fuente` y `desde` para la lectura. Esos identificadores son internos y no deben mostrarse al usuario.

## 2. Leer el texto suficiente

Llama a `leer_documento(doc_id, fuente, desde)` y sigue las instrucciones de continuación que entregue (`desde` y, si procede, `desde_caracter`). Si la posición apunta al medio de una guía, lee también el contexto anterior que indique a qué casos aplica. Reúne todos los apartados del modelo elegido, instrucciones de cumplimentación, notas y alternativas. Para localizar un apartado en un documento largo puedes usar el argumento `buscar`, pero después abre el pasaje en su secuencia.

Anota la URL exacta de la fuente y cualquier aviso de vigencia. `buscar_modelos_informe` no filtra por ejercicio, de modo que el ejercicio del usuario debe contrastarse con la fecha y el ámbito del documento y, si es necesario, con la norma o circular aplicable.

## 3. Hacer el inventario de datos

Antes de escribir el JSON, completa una matriz interna como esta:

| Apartado o pasaje del modelo | Texto fijo | Dato que aporta el auditor | Campo JSON | Obligatorio / condición | Evidencia |
|---|---|---|---|---|---|
| Encabezado | Fórmula de destinatario | Nombre y cargo del destinatario | `destinatario` | Siempre | URL y apartado leídos |
| Identificación del encargo | Texto del modelo | Entidad y fecha de cierre | `entidad`, `fecha_cierre` | Siempre | URL y apartado leídos |
| Párrafo alternativo | Redacción de la variante | Selección de variante | `tipo_opinion` | Solo si el caso lo requiere | URL y apartado leídos |

La tabla es una técnica de análisis, no una lista de campos universales. Incluye anexos, tablas, firmas, periodos comparativos, salvedades y notas de cumplimentación si están en el modelo. Distingue hechos conocidos, datos pendientes y decisiones profesionales. Nunca marques una decisión profesional como predeterminada por comodidad.

## 4. Traducir al JSON y comprobar cobertura

- Conserva el orden de los apartados y el sentido de los párrafos relevantes en `sections`. Usa `{{campo}}` solo para datos variables.
- Usa `fields` para cada dato pendiente. Una misma respuesta puede reutilizarse en varios apartados. Añade `help` para explicar formatos, unidades o referencias al encargo.
- Usa `select` y `when` para alternativas expresas. Si varias condiciones deben combinarse o una variante requiere una redacción no representable fielmente, crea asistentes separados o pide antes la elección al usuario.
- No copies marcas como `[●]`, `XXXXX` o instrucciones editoriales al documento final; conviértelas en campos o elimínalas si son notas del modelo, revisando que el sentido no cambie.
- Añade la URL exacta del modelo en `sources`. Explica si se usó una fuente secundaria o si faltó el texto completo.
- Antes de renderizar, compara cada fila de la matriz con `fields`, `sections` y condiciones. No debe quedar dato solicitado sin campo ni campo sin propósito claro en el documento.
