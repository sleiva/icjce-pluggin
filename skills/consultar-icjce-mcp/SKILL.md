---
name: consultar-icjce-mcp
description: Úsala cuando respondas a un auditor de cuentas en España con el MCP del ICJCE conectado — preguntas sobre la LAC, el RLAC, el RUE, el TRLSC, las NIA-ES, consultas del ICAC (BOICAC), circulares y guías de actuación del ICJCE, modelos de informe o de carta de encargo, independencia e incompatibilidades, novedades del BOE — y también cuando esas tools no aparezcan o fallen.
---

# Consultar el MCP del ICJCE

## Principio

La respuesta sale **de lo que devuelven las tools, no de memoria**. Tu conocimiento tiene fecha de corte; el MCP tiene las circulares, guías y normas vigentes hoy (incluidas las de 2026, que son reales).

## Si las tools no están o fallan

Si no ves `indice_norma`, `buscar_circulares`, etc., o devuelven errores de conexión: **dilo al usuario y no contestes de memoria** como si hubieras consultado. Como mucho, una orientación general marcada expresamente como «sin verificar en las fuentes del ICJCE».

## Primera tool según la pregunta

| La pregunta va de… | Primera tool | Después |
|---|---|---|
| Lo que dice una ley o norma (LAC, RLAC, RUE, TRLSC, LIS…) o una NIA-ES | `indice_norma` | `leer_articulo` con el `block_id` |
| Circulares, guías de actuación, notas técnicas; «la última circular de…», «hay una actualización de…» | `buscar_circulares` | `leer_documento` |
| Un modelo, plantilla o redacción tipo (informe, carta de encargo o de manifestaciones, párrafo de énfasis…) | `buscar_modelos_informe` | `leer_documento(doc_id, fuente, desde)` |
| Independencia, incompatibilidades, servicios prohibidos, honorarios, rotación | `mapa_independencia` (aunque citen una consulta del ICAC) | `leer_articulo` / `leer_documento` |
| Consultas del ICAC, preguntas de la semana, calidad, sostenibilidad, otras actuaciones | `buscar_documentos` | `leer_documento` |
| «¿Qué ha salido?», normas nuevas o en tramitación | `novedades_boe` | `indice_norma` si ya está vigente |
| Un dato literal (plazo, importe, frase) que lo anterior no encontró | `buscar_en_texto` | `leer_documento` |

`buscar_en_texto` es el **último recurso**: sus fragmentos no dicen qué versión está vigente.

## Reglas

- **Artículos**: no cites un número de artículo que no aparezca en `indice_norma`. El `block_id` no es el número (el art. 60 del RLAC es `a6-2`).
- **Lee antes de afirmar**: un título o un resumen no bastan; abre el artículo o el documento.
- **NIA-ES por ejercicio**: la versión aplicable depende de la fecha de inicio del ejercicio auditado. Si la pregunta la da o la sugiere («ejercicio 2023»), pásala en `ejercicio`; si no, se usa la vigente y conviene decirlo.
- **Una llamada con alternativas mejor que varias**: `filtro='auditor|junta'`, `norma='LAC,RLAC'`, `block_id='a22,a23'`. Para códigos y variantes usa `patrones` (`['ES0[0-9]/2026']`, `['GA ?55R?']`).
- **Búsqueda vacía**: prueba sinónimos o `patrones` y otra tool de la tabla antes de concluir que no hay nada; si sigue vacía, dilo.
- **Solo lo vigente**: el MCP no sirve circulares superadas. Si una guía tiene versión revisada, responde con la más reciente; las anteriores, solo como contexto.
- **Citas**: cada fuente como `[nombre](URL)` con la URL **exacta** del resultado (nunca construida ni combinada). Nombra la circular por su código (ES11/2026), el artículo con su norma (art. 22 LAC) y la fecha. No muestres `doc_id` ni `chunk_id`.

## Errores comunes

| Error | Corrección |
|---|---|
| Contestar de memoria porque «la sabes» | La norma o la circular puede haber cambiado: consulta y cita |
| Empezar por `buscar_en_texto` | Empieza por la tool de la tabla |
| Citar «art. 40 LAC» sin mirarlo en el índice | `indice_norma` con `filtro` y `leer_articulo` |
| Dar por inexistente una circular de 2026 que no conoces | Si la devuelve el MCP, es real |
| Pegar un ancla `#aN` a mano en la URL del BOE | Copia el enlace que da la tool |
