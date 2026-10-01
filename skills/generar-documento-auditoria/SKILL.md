---
name: generar-documento-auditoria
description: Genera un asistente HTML autónomo para preparar informes, cartas y otros documentos de auditoría. A partir de un modelo verificado y datos del encargo, crea un formulario dinámico, muestra el documento terminado y permite exportarlo a DOCX o PDF. Úsala cuando el usuario pida crear o cumplimentar un documento de auditoría, no para una mera consulta normativa.
---

# Generar documento de auditoría

Convierte un modelo documental en un **archivo HTML por conversación**. La persona rellena los datos, pulsa **Generar documento**, ve el texto terminado y puede descargar un DOCX real o usar la impresión del navegador para **Guardar como PDF**. El archivo funciona sin conexión y no transmite lo introducido.

## Antes de construir la plantilla

1. Identifica el documento pedido (informe, carta de encargo, manifestaciones u otro) y su contexto. Si el usuario aporta un modelo, léelo. Si no, busca un modelo apropiado con las herramientas disponibles del MCP ICJCE (por ejemplo, búsqueda de modelos y lectura del documento). Complementa con fuentes oficiales web cuando haga falta verificar vigencia o contexto.
2. No atribuyas al ICJCE un texto que no hayas leído. Conserva el sentido del modelo y los requisitos aplicables; separa lo que procede de la fuente de lo que adaptas para el caso. Si el MCP no está disponible, puedes trabajar con el modelo aportado por el usuario o una fuente oficial verificada y explicar la limitación.
3. Identifica los datos variables del documento y decide campos claros. Precarga solo hechos que el usuario haya aportado. No inventes cifras, fechas, opinión ni conclusiones.

## Crear el HTML

Escribe un JSON UTF-8 conforme a `references/esquema-json.md`. Usa `{{id_del_campo}}` en títulos, encabezados y párrafos donde se insertarán respuestas. Un ejemplo completo está en `examples/carta-encargo.json`.

```sh
node bin/generar-documento.mjs validate /ruta/plantilla.json
node bin/generar-documento.mjs render /ruta/plantilla.json /ruta/asistente.html
```

Las rutas del comando son relativas a esta habilidad; también puedes invocar el script por ruta absoluta. El renderizador incorpora el logo, estilos y código al HTML, sin CDN ni llamadas al MCP al abrirlo. Entrega el archivo HTML al usuario y explica que puede abrirlo en el navegador, completar los campos y pulsar **Generar documento**.

Si el entorno del chat no permite ejecutar Node o adjuntar archivos, prepara el JSON y explica qué paso falta para generar el HTML. No afirmes que has creado o probado un archivo que no existe.

## Revisión y exportación

- Asegura que todos los campos obligatorios estén completos antes de mostrar el documento final. Incluye condiciones únicamente cuando el modelo exige variantes claras.
- Mantén enlaces de las fuentes en la interfaz. Usa `include_sources_in_output` solo si conviene incluirlas en el documento emitido.
- El DOCX es un archivo Office Open XML descargable. El botón de PDF abre la impresión del navegador; el usuario selecciona **Guardar como PDF**. No lo presentes como descarga PDF directa.
- El logo y los colores ICJCE se usan en el asistente. El documento exportado no lleva logo institucional ni se presenta como emitido por el ICJCE. El auditor debe verificar y aprobar el contenido final.

## Control final

Valida el JSON, genera el HTML, ábrelo si tienes navegador disponible y comprueba al menos un flujo de campos, generación y exportación. No mezcles esta habilidad con `consultar-icjce-mcp`: úsala para producir el artefacto; usa las fuentes y el razonamiento de auditoría para preparar su contenido.
