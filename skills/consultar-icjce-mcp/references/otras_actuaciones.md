# Otras actuaciones — dónde está cada cosa

Cubre los trabajos del auditor **distintos de la auditoría de cuentas**: informes especiales en
operaciones societarias, actuaciones como experto independiente, revisiones limitadas, informes
de procedimientos acordados y revisión de cuentas justificativas de subvenciones.

No entra aquí la auditoría de cuentas, que va por `references/auditoria.md`, ni la
independencia (`references/independencia.md`), que también se plantea al aceptar estos encargos.

## El punto de partida: identificar el encargo

Primero se decide **de qué encargo habla la pregunta** con la tabla de bloques de abajo, y solo
entonces se busca: la norma que lo regula, la norma técnica del ICAC que lo desarrolla y la guía
de actuación del Instituto. Es lo que evita responder sobre una fusión con las reglas de una
ampliación de capital.

## Los bloques de encargos

| Bloque | Ejemplos |
|---|---|
| Otros trabajos desarrollados por auditores | informes para entidades supervisadas, formato electrónico único europeo, informes a requerimiento de la CNMV |
| Actuaciones en calidad de expertos | experto independiente, informes de valoración, modificaciones estructurales, prevención del blanqueo |
| Revisiones limitadas | revisión de estados financieros intermedios y de otra información financiera |
| Informes de procedimientos acordados | residuos y envases, transparencia, consumidores electrointensivos, propiedad intelectual, Ecoembes |
| Subvenciones | revisión de cuentas justificativas de subvenciones |
| Actuaciones especiales que requieren formación adicional | pericial, expediente de regulación de empleo y otras |

> Del último bloque puede no haber normativa específica en el MCP. Si las búsquedas no la
> traen, dilo y no la supongas.

## Los datos que cambian la respuesta

| Dato | Por qué cambia la respuesta |
|---|---|
| **De qué encargo se trata** | Cada bloque tiene su norma, su norma técnica del ICAC y su doctrina: no son intercambiables. |
| **Si es una operación societaria** | Además de la norma vigente aplica la doctrina técnica del Instituto sobre informes especiales, que se trae con `buscar_circulares`. |
| **Si es sobre una entidad supervisada** | Varios de esos informes los regula una circular de la CNMV que se lee en su publicación del BOE. |
| **Si es una revisión limitada o un procedimiento acordado** | Cambia la norma internacional aplicable (revisión frente a servicios relacionados) y el nivel de seguridad que se da. |
| **Si piden el modelo del informe** | El informe de procedimientos acordados y el de revisión limitada tienen su redacción tipo, distinta de la del informe de auditoría. |

## Con qué tools

| Para… | Tool |
|---|---|
| La norma que regula el encargo y la resolución del ICAC con la norma técnica | `indice_norma` y después `leer_articulo` |
| El texto de la norma técnica o de la guía | `buscar_documentos` con `grupo='otras_actuaciones'` y después `leer_documento` |
| La guía de actuación del Instituto sobre cómo se hace el trabajo | `buscar_circulares` |
| El modelo o la redacción del informe | `buscar_modelos_informe`, con `tipo` (por ejemplo el de procedimientos acordados) |
| Un apartado o una expresión literal de la guía | `buscar_en_texto` |
| La independencia al aceptar el encargo | `mapa_independencia` |
| Si ha cambiado la norma que lo regula | `novedades_boe` |

## Errores típicos de esta área

| Error | Corrección |
|---|---|
| Identificar el encargo por parecido con otro | Se identifica primero con la tabla de bloques y se busca después |
| Responder con las reglas de la auditoría de cuentas | Es otro encargo, con otra norma técnica y otro nivel de seguridad |
| Dar el informe de una revisión limitada con la redacción de una auditoría | Son informes distintos y dicen cosas distintas |
| Suponer la normativa de una actuación especial (pericial, regulación de empleo) | Si el MCP no la trae, se dice y no se inventa |
