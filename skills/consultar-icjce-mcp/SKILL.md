---
name: consultar-icjce-mcp
description: Úsala en consultas sustantivas sobre auditoría de cuentas en España, incluidos casos prácticos, normativa, independencia, informes, calidad y contabilidad. Combina el análisis del modelo, una búsqueda de circulares y guías de actuación relacionadas en el MCP del ICJCE y fuentes oficiales web cuando estén disponibles. Si el usuario quiere preparar, redactar o recibir ayuda con un informe, carta u otro documento para un caso concreto, da prioridad a generar-documento-auditoria. No la actives para preguntas técnicas sobre la integración ni por menciones incidentales de auditoría.
---

# Auditoría de cuentas en España: análisis y contraste de fuentes

## Forma de trabajar

Activa esta habilidad para las preguntas sustantivas de auditoría, también cuando el usuario pida analizar un caso, calcular o revisar. Si quiere preparar un informe, carta u otro documento para un caso concreto —incluido «ayúdame con un informe»—, usa `generar-documento-auditoria` como flujo principal; esta habilidad puede aportar análisis y fuentes. **Resuelve la pregunta con criterio técnico propio**: usa tus conocimientos para interpretar los hechos, razonar los cálculos, plantear alternativas y aplicar las fuentes al caso. El MCP del ICJCE aporta textos de su corpus, pero no limita el análisis ni es requisito previo para responder. Usa también la búsqueda web disponible para contrastar vigencia, novedades y fuentes relevantes fuera de ese corpus. Distingue siempre entre conocimiento del modelo, texto verificado e inferencia aplicada al caso.

1. Identifica la cuestión y los datos que pueden cambiar la respuesta. En particular, atiende al inicio del ejercicio auditado, si la entidad es EIP, el carácter obligatorio o voluntario de la auditoría, y el tipo de cuentas o informe cuando sean relevantes. Si faltan datos, explica las variantes o pide solo el dato indispensable.
2. **Busca siempre circulares y guías de actuación relacionadas** mediante `buscar_circulares` con el tema concreto de la pregunta, aunque el usuario no las mencione. Si la búsqueda no encuentra nada, prueba una denominación alternativa o las siglas relevantes; no uses una búsqueda vacía de novedades como sustituto. Lee con `leer_documento` las circulares o guías que puedan cambiar o matizar la respuesta y comprueba su fecha, vigencia y alcance. Descarta resultados tangenciales. Si no hay documentos pertinentes, continúa sin inventarlos y dilo brevemente al responder.
3. Consulta además el MCP cuando la respuesta dependa de normativa, doctrina, modelos o datos que consten en su corpus. Abre el artículo o documento pertinente antes de atribuirle una conclusión. En preguntas prácticas sin una afirmación normativa relevante, úsalo solo si aporta evidencia útil; no sustituyas el razonamiento por una lista de resultados del MCP.
4. Cuando esté disponible, busca en la web para verificar información que pueda haber cambiado, localizar la fuente oficial vigente, contrastar una afirmación importante o cubrir algo que el MCP no contiene. Para afirmaciones normativas, prioriza BOE, ICAC, ICJCE y otras fuentes primarias según la materia; para contexto técnico adicional, evalúa la fiabilidad de otras fuentes y deja claro su alcance. Si el usuario pide expresamente no buscar en la web, respeta esa preferencia.
5. Integra el análisis: responde primero a la pregunta; separa lo que dicen las fuentes de tu inferencia profesional, aplica los textos al caso y explica discrepancias o límites. **Si una circular o guía leída trata directamente la pregunta, menciónala de forma visible por su código o título, fecha y enlace, y explica qué añade al análisis**, aunque también cites la ley o un modelo de informe. No conviertas la respuesta en un resumen de la habilidad ni en una lista de resultados de herramientas.

**Si falla una fuente:** si el MCP no está disponible, dilo y continúa con fuentes oficiales web cuando sea posible; una respuesta verificada en esas fuentes sigue siendo útil. Si tampoco hay web, ofrece solo orientación general e identifica lo que queda sin verificar. Nunca afirmes haber consultado el MCP o la web si no lo hiciste.

## Referencia temática

Lee solo la referencia que ayude a orientar la consulta; es un mapa de búsqueda, no una fuente que deba citarse como vigente.

| Materia | Referencia |
|---|---|
| NIA-ES, LAC, RLAC, RUE, informes, empresa en funcionamiento, contrato y prórroga, EIP | `references/auditoria.md` |
| Independencia, incompatibilidades, honorarios, rotación y servicios prohibidos | `references/independencia.md` |
| Gestión y revisión de calidad, NIGC y NIA-ES 220 | `references/calidad.md` |
| Registro y valoración contable, cuentas anuales y consultas contables | `references/contabilidad.md` |
| Procedimientos acordados, revisión limitada e informes especiales | `references/otras_actuaciones.md` |

Si la pregunta cruza materias, usa las referencias pertinentes. Para sostenibilidad o doctrina jurídica del ICJCE, consulta `buscar_documentos` con el grupo adecuado si el esquema real lo admite.

## Herramientas MCP

Descubre las herramientas que el cliente tenga conectadas e identifica el servidor ICJCE por su procedencia, descripción y esquema. Los nombres siguientes son operaciones esperadas, **no nombres completos que debas construir**. Invoca solo las herramientas y argumentos que el cliente anuncie. Si no aparecen, usa el mecanismo de descubrimiento disponible; no pidas credenciales en el chat.

| La pregunta va de… | Empieza por | Después |
|---|---|---|
| Ley, reglamento o NIA-ES | `indice_norma` | `leer_articulo` con el `block_id` devuelto |
| Toda consulta sustantiva: circulares y guías relacionadas | `buscar_circulares` | `leer_documento` si el resultado es pertinente |
| Modelos de informe o cartas | `buscar_modelos_informe` | `leer_documento` |
| Independencia e incompatibilidades | `mapa_independencia` | `leer_articulo` o `leer_documento` |
| Consultas ICAC, calidad, sostenibilidad y otras actuaciones | `buscar_documentos` | `leer_documento` |
| Novedades normativas | `novedades_boe` | `indice_norma` si ya están vigentes |
| Un dato literal que no apareció en la búsqueda anterior | `buscar_en_texto` | `leer_documento` |

`buscar_en_texto` es el último recurso para datos literales: sus fragmentos no establecen por sí solos la vigencia. Si una búsqueda está vacía, prueba sinónimos, variantes u otra operación pertinente antes de concluir que el corpus no contiene el dato.

## Comprobaciones al responder

- No afirmes de memoria qué norma, versión de NIA-ES, circular, plazo o importe está vigente. Contrástalo en el MCP o una fuente primaria web.
- Para NIA-ES, usa la fecha de inicio del ejercicio auditado si se conoce; si no, indica la versión consultada. El `block_id` es un identificador interno, no el número de artículo.
- Una referencia, un título o un fragmento no bastan para atribuir una conclusión: lee el artículo o documento correspondiente. Contrasta con la web si hay indicios de actualización o conflicto.
- Enlaza cada fuente con la URL exacta obtenida de la herramienta o página consultada; no construyas enlaces ni anclas. No muestres `doc_id` ni `chunk_id`.
- Antes de cerrar, comprueba que la respuesta recoge la circular o guía pertinente encontrada con `buscar_circulares`; si no hay ninguna, indica que la búsqueda no localizó una relacionada con el caso.
- No hables en nombre del ICJCE. Reserva «obligatorio» y expresiones equivalentes para exigencias que consten en una fuente verificada; distingue los juicios y recomendaciones profesionales.
