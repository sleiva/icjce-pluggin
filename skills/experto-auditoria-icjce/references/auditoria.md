# Auditoría de cuentas — dónde está cada cosa

Cubre la auditoría de cuentas y sus normas técnicas (NIA-ES), la Ley de Auditoría de Cuentas y
su Reglamento, el Reglamento europeo, el informe y sus párrafos, la empresa en funcionamiento,
el contrato y su prórroga, la rotación del socio y las entidades de interés público.

No entra aquí: la independencia y las incompatibilidades (`references/independencia.md`), el
sistema de calidad de la firma (`references/calidad.md`), el registro y la valoración contable
(`references/contabilidad.md`) ni los encargos distintos de la auditoría de cuentas
(`references/otras_actuaciones.md`).

## Qué aplica a cada situación

| La pregunta va de… | Qué la regula | Doctrina que la acompaña |
|---|---|---|
| Nombramiento, contrato y su prórroga, duración del encargo | la Ley de Auditoría y su Reglamento y, si la entidad es una sociedad de capital, **también la Ley de Sociedades de Capital**, que regula el nombramiento por la junta y repite la duración | consultas del BOICAC de régimen jurídico |
| Planificación, valoración del riesgo, materialidad | NIA-ES de la serie 300–499 | consultas de planificación y Preguntas de la Semana |
| Evidencia, muestreo, estimaciones, partes vinculadas, hechos posteriores, existencia y continuidad | NIA-ES de la serie 500–599 | consultas de evidencia |
| Trabajo de componentes, expertos y auditores internos | NIA-ES de la serie 600–699 | guías de actuación y consultas |
| El informe: opinión, fundamento, cuestiones clave, énfasis, otras cuestiones, salvedades | NIA-ES de la serie 700–799 | consultas de informe y modelos del ICJCE |
| Empresa en funcionamiento | la NIA-ES sobre empresa en funcionamiento | consultas y guías de actuación |
| Entidades de interés público: informe adicional, comisión de auditoría, supervisores | el Reglamento europeo, **además de** la ley y el reglamento | guías y preguntas de la Comisión Europea |
| Encargos sobre estados financieros de un solo componente o de periodos distintos | NIA-ES de la serie 800–899 | consultas |

**Cuando la misma regla está en dos normas** (la Ley de Auditoría y la de Sociedades de Capital,
o la Ley de Auditoría y el Reglamento europeo), lee las dos con `indice_norma` y `leer_articulo` y
cítalas juntas: el auditor necesita saber que coinciden, o en qué difieren.

## Los datos que cambian la respuesta

| Dato | Por qué cambia la respuesta |
|---|---|
| **La fecha de inicio del ejercicio auditado** | Las NIA-ES se aplican por tramos de vigencia: cambia la versión de la norma y el modelo de informe. Si la pregunta cita un ejercicio, pásalo en `ejercicio`; si no, responde con la vigente y dilo. |
| **Si la entidad es de interés público** | Suma el Reglamento europeo: servicios prohibidos, límite a los honorarios por servicios distintos de la auditoría, rotación del socio, informe adicional a la comisión de auditoría y comunicación a los supervisores. |
| **Si la auditoría es obligatoria o voluntaria** | Cambian algunas obligaciones del encargo (nombramiento, depósito, régimen de contratación). El informe adicional a la comisión de auditoría no depende de esto, sino de que la entidad sea de interés público. |
| **Cuentas individuales, consolidadas o abreviadas** | Cambia la norma del encargo y el contenido, los destinatarios y la fecha del informe. |
| **El tipo de opinión** | Favorable, con salvedades, denegada o desfavorable: cambia la estructura del informe y las secciones que lleva. |
| **Si preguntan por el texto de la norma o por cómo se resuelve un caso** | El texto lo da el índice oficial con su artículo; el caso, la doctrina del ICAC y del ICJCE. |

## Con qué tools

| Para… | Tool |
|---|---|
| El texto vigente de un artículo de la ley, el reglamento, el código de comercio o una NIA-ES | `indice_norma` y después `leer_articulo` |
| Una NIA-ES de un ejercicio ya cerrado | `indice_norma` con `norma` y `ejercicio`; después `leer_articulo` con el apartado |
| Consultas del ICAC de auditoría, del compendio, y las Preguntas de la Semana | `buscar_documentos` con `grupo='consultas'` |
| Circulares y guías de actuación del Instituto | `buscar_circulares` |
| El modelo o la redacción de un informe, una carta o un párrafo | `buscar_modelos_informe` |
| Un dato literal (un plazo, una expresión) que lo anterior no encontró | `buscar_en_texto` |
| Lo que ha salido o ha cambiado | `novedades_boe` |
| Independencia | `mapa_independencia` (ver `references/independencia.md`) |

## Errores típicos de esta área

| Error | Corrección |
|---|---|
| Contestar de independencia o de calidad con la ley de auditoría a secas | Cada una tiene su referencia y su primer paso |
| Tratar un informe especial de una operación societaria como una auditoría de cuentas | Va por `references/otras_actuaciones.md` |
