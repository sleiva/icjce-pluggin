---
name: generar-documento-auditoria
description: Úsala cuando el usuario exprese que quiere, necesita o tiene que hacer, preparar, redactar, emitir o completar un informe, carta u otro documento de auditoría para un caso concreto, o pida ayuda para hacerlo, aunque no mencione HTML. Genera un asistente HTML con el modelo aplicable del MCP ICJCE y campos para los datos pendientes. Si solo pregunta qué exige un informe sin querer prepararlo, usa la habilidad de consulta.
---

# Generar documento de auditoría

Convierte un modelo documental en un **archivo HTML por conversación**. La persona rellena los datos, pulsa **Generar documento**, ve el texto terminado y puede descargar un DOCX real o usar la impresión del navegador para **Guardar como PDF**. El archivo funciona sin conexión y no transmite lo introducido.

**Activación y entrega:** activa esta habilidad cuando el usuario manifieste la intención o necesidad de elaborar un documento para un encargo concreto, aunque no formule una orden directa. Ejemplos: «quiero hacer un informe», «necesito hacer un informe de procedimientos acordados», «tengo que emitir el informe de Ecoembes», «me toca preparar la carta» o «ayúdame con un informe». Reconoce también expresiones equivalentes y la continuación de una conversación en la que ya se está preparando ese documento. Ofrece el HTML como artefacto por defecto. No esperes a que diga «HTML» ni a que aporte todos los datos: transforma los datos pendientes en campos vacíos del formulario y precarga solo los ya conocidos. Si falta un dato imprescindible para elegir entre modelos incompatibles, pregunta solo por ese dato; si el modelo admite variantes, represéntalas con condiciones o prepara asistentes separados. Respeta una petición expresa de recibir únicamente explicación o texto en el chat.

**Aplica tu conocimiento y criterio técnico de auditoría** para interpretar el encargo, escoger entre variantes y detectar datos o decisiones profesionales que el modelo no resuelve por sí solo. El modelo del ICJCE sirve como texto de referencia, no sustituye ese análisis. Cuando estén disponibles, contrasta en fuentes web fiables la vigencia y los requisitos relevantes fuera del corpus del MCP. Distingue en el resultado el texto verificado del modelo, los datos aportados por el usuario y las adaptaciones o inferencias que propones; no atribuyas estas últimas al ICJCE.

## Localizar y leer el modelo en el MCP

Sigue `references/analisis-modelo.md` antes de crear el JSON. **Si el MCP ICJCE está conectado, `buscar_modelos_informe` es el primer paso para cada documento**, incluso si el usuario aportó un ejemplo: permite identificar el modelo y comprobar si existe una versión más apropiada. Descubre las operaciones y sus esquemas en el cliente; los nombres siguientes son operaciones esperadas, no prefijos completos que debas inventar.

1. Identifica el documento pedido y los datos que determinan qué modelo aplica: tipo de encargo, tipo de opinión, EIP o no EIP, cuentas individuales o consolidadas, ejercicio y particularidades. Usa solo los filtros que conozcas; no supongas una opinión o una condición EIP para forzar un resultado.
2. Invoca `buscar_modelos_informe` con la búsqueda y los filtros anunciados por la herramienta (`query`, `tipo`, `tipo_opinion`, `eip`, `variante` según proceda). Si hay varios candidatos, compara título, vigencia, fecha, alcance y posición del ejemplo. Si no aparece uno apropiado, amplía la búsqueda con sinónimos o menos filtros y comunica la limitación si persiste.
3. Invoca `leer_documento` con el `doc_id` y la `fuente` del candidato; usa `desde` para ir a la posición del modelo indicada por la búsqueda. Continúa con los valores de `desde` y `desde_caracter` que devuelva la lectura hasta cubrir el texto del modelo y sus variantes relevantes. Un título o fragmento de búsqueda no basta para construir el documento. Si necesitas un apartado concreto de una guía larga, `buscar` en `leer_documento` ayuda a localizarlo, pero lee después su contexto.
4. Contrasta la aplicabilidad del modelo al encargo y conserva la URL exacta devuelta por el MCP para `sources`. Cuando la vigencia o las cláusulas dependan de una norma o circular, verifica esa fuente con las herramientas pertinentes o una fuente oficial web. El índice de modelos no tiene un filtro de ejercicio: comprueba expresamente la fecha aplicable.

Para cada documento, busca además con `buscar_circulares` las circulares y guías de actuación relacionadas con el tipo de encargo y el tema, aunque el usuario no las mencione. Si no hay resultados, prueba otra denominación o siglas. Lee con `leer_documento` las que afecten a la redacción, los requisitos o la vigencia del modelo; descarta las tangenciales y no atribuyas al modelo obligaciones que solo sean recomendaciones de una guía. Al entregar el asistente, menciona por código o título, fecha y enlace cada circular o guía pertinente que haya influido en él; si no localizaste ninguna, dilo brevemente. Mantén `buscar_modelos_informe` como primer paso para localizar el modelo.

Si el MCP no está disponible, dilo. Trabaja con un modelo aportado por el usuario o una fuente oficial verificada solo si tienes su texto; no presentes esa plantilla como recuperada del MCP. No atribuyas al ICJCE un texto que no hayas leído.

## Extraer los datos que debe aportar el auditor

Recorre el modelo leído **sección por sección**. Para cada título, párrafo, tabla, alternativa y nota de cumplimentación, clasifica: texto fijo que puede conservarse, dato variable del encargo, elección entre variantes, o decisión profesional que exige revisión. Prepara una matriz interna `apartado del modelo → dato solicitado → campo JSON → condición → fuente/pasaje`. Comprueba que todos los huecos y referencias cruzadas del modelo están cubiertos. Identifica también cada marca de variación (cláusulas «incluir solo si…», alternativas, «[A/B]» dentro de la frase, fragmentos opcionales) y tradúcela con la tabla del apartado 4 de `references/analisis-modelo.md`. No conviertas en campo un requisito que pueda obtenerse del propio modelo ni de la fuente.

Agrupa en el formulario los datos que el auditor sí debe introducir: identificación y destinatarios; entidad, ejercicio y marco contable; tipo y alcance del encargo; responsables y fechas; importes y hechos particulares; y selección de párrafos u opinión cuando proceda. **Esta lista es orientativa**: los campos reales salen del modelo elegido. Para cada campo usa una etiqueta concreta, `help` que explique el dato y `required` según sea obligatorio en la variante. Precarga solo datos aportados por el usuario. No inventes cifras, hechos, opinión ni conclusiones. Para la variación usa las piezas de la versión 2 del esquema (`checkbox`, `multiselect`, `when` en campos, secciones y párrafos, `conditions` y `derived`) y, para tablas, listas o bloques que se repiten, `group` con párrafos `repeat`; para cartas a varios destinatarios, `batch`; para importes y cálculos (totales, materialidad, umbrales), `number`, `computed` y las comparaciones. Si ninguna representa una variante sin alterar el sentido del modelo, pide el dato o prepara plantillas separadas.

La ausencia de nombres, importes, destinatarios o resultados de procedimientos no bloquea la creación del HTML: déjalos como campos para que el auditor los rellene. No redactes un documento final afirmando resultados que todavía no se conocen.

## Crear el HTML

Escribe un JSON UTF-8 conforme a `references/esquema-json.md`, con `schema_version: 2` si el modelo tiene variación. Usa `{{id_del_campo}}` en títulos, encabezados y párrafos donde se insertarán respuestas. El ejemplo `examples/carta-encargo.json` es una demostración técnica, no un modelo oficial ni una carta lista para firmar. En documentos reales, redacta las secciones a partir del modelo efectivamente leído y añade su fuente.

```sh
node bin/generar-documento.mjs validate /ruta/plantilla.json
node bin/generar-documento.mjs render /ruta/plantilla.json /ruta/asistente.html
```

Las rutas del comando son relativas a esta habilidad; también puedes invocar el script por ruta absoluta. El renderizador incorpora el logo, estilos y código al HTML, sin CDN ni llamadas al MCP al abrirlo. Entrega el archivo HTML al usuario y explica que puede abrirlo en el navegador, completar los campos y pulsar **Generar documento**. Si la plantilla tiene `batch`, indica qué columnas debe preparar en su Excel (las etiquetas de `batch.fields`) y que el listado se procesa solo en su navegador, sin pasar por el chat.

Si el entorno del chat no permite ejecutar Node o adjuntar archivos, prepara el JSON y explica qué paso falta para generar el HTML. No afirmes que has creado o probado un archivo que no existe.

## Revisión y exportación

- Asegura que todos los campos obligatorios estén completos antes de mostrar el documento final. Incluye condiciones únicamente cuando el modelo exige variantes claras. `validate` debe terminar sin errores; revisa cada `Aviso:` antes de entregar. Contrasta el JSON con la matriz de apartados y datos para detectar omisiones.
- Mantén enlaces de las fuentes en la interfaz. Usa `include_sources_in_output` solo si conviene incluirlas en el documento emitido.
- El DOCX es un archivo Office Open XML descargable. El botón de PDF abre la impresión del navegador; el usuario selecciona **Guardar como PDF**. No lo presentes como descarga PDF directa.
- El logo y los colores ICJCE se usan en el asistente. El documento exportado no lleva logo institucional ni se presenta como emitido por el ICJCE. El auditor debe verificar y aprobar el contenido final.

## Control final

Valida el JSON, genera el HTML, ábrelo si tienes navegador disponible y comprueba al menos un flujo de campos, generación y exportación. Informa brevemente qué modelo consultaste, su enlace y qué datos tendrá que rellenar el auditor. Esta habilidad produce el artefacto; usa las fuentes y el razonamiento de auditoría para preparar su contenido.
