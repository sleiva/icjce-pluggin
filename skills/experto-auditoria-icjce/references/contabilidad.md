# Contabilidad — dónde está cada cosa

Cubre cómo se registra y se valora una operación, qué dice el Plan General de Contabilidad y
cómo ha resuelto el ICAC un caso concreto: marco conceptual, normas de registro y valoración,
cuentas anuales, consolidación, adaptaciones sectoriales y la fiscalidad que afecta al registro.

No entra aquí: la auditoría de esas cuentas (`references/auditoria.md`) ni los informes
especiales sobre operaciones societarias (`references/otras_actuaciones.md`).

> **El asiento se razona desde las fuentes**: la norma de registro y valoración de la operación
> y el cuadro de cuentas del Plan (su cuarta parte, en `indice_norma`), leídos. Si la operación
> lleva IVA, el asiento incluye las cuentas de IVA soportado o repercutido. Si el enunciado
> admite varias lecturas, da un asiento por cada variante y di de qué depende.

## Qué aplica a cada situación

| La pregunta va de… | Qué la regula |
|---|---|
| Cómo se registra o se valora una operación | las normas de registro y valoración del Plan General y la resolución del ICAC de esa materia |
| Qué dice el Plan General | el texto consolidado: marco conceptual, normas de registro y valoración, normas de elaboración de las cuentas anuales, cuadro de cuentas y definiciones |
| Una pyme o una microempresa | el Plan General de PYMES y los criterios contables para microempresas |
| Cuentas consolidadas | las normas de formulación de cuentas anuales consolidadas |
| Una sociedad o una operación societaria | la Ley de Sociedades de Capital y el Código de Comercio |
| Impuesto sobre beneficios, Impuesto sobre Sociedades o IVA | la ley fiscal y la resolución del ICAC sobre el impuesto sobre beneficios |
| Un sector con plan propio (construcción, inmobiliario, cooperativas, entidades sin fines lucrativos, sociedades deportivas, concesionarias, vitivinícola…) | la adaptación sectorial, y el plan de PYMES de entidades sin fines lucrativos |
| Un caso ya resuelto, parecido | las consultas del ICAC del BOICAC, las que el ICJCE le eleva y las Preguntas de la Semana |

## Los datos que cambian la respuesta

| Dato | Por qué cambia la respuesta |
|---|---|
| **Si es una pyme o una microempresa** | Cambia el plan aplicable y algunas normas de valoración y de memoria. |
| **Si son cuentas individuales o consolidadas** | Cambian la norma y el método de consolidación. |
| **El sector de la entidad** | Si hay adaptación sectorial, prevalece sobre el plan general en lo que regula. |
| **Si buscan el criterio o un caso resuelto** | El criterio está en la norma y en las resoluciones del ICAC; el caso, en las consultas. |
| **La fecha de la operación** | Una operación antigua se registró con la norma vigente entonces, no con la de hoy. |

La respuesta se sostiene en la norma y en la doctrina del ICAC.

## Con qué tools

| Para… | Tool |
|---|---|
| El texto del Plan General, del de PYMES, del Código de Comercio, de la Ley de Sociedades de Capital o de una ley fiscal | `indice_norma` y después `leer_articulo` |
| Las resoluciones del ICAC que desarrollan el Plan (inmovilizado, intangible, deterioro, coste de producción, instrumentos financieros, ingresos, impuesto sobre beneficios, periodo medio de pago) | `indice_norma`, o `buscar_documentos` con `grupo='normas'` |
| Las consultas contables del ICAC (BOICAC) y las del ICJCE | `buscar_documentos` con `fuente='contabilidad'` y después `leer_documento` |
| Las Preguntas de la Semana con supuesto contable | `buscar_documentos` con `grupo='consultas'` |
| Una adaptación sectorial | `buscar_documentos` con `grupo='normas'` |
| Un importe, un plazo o una expresión literal del Plan | `buscar_en_texto` |

## Errores típicos de esta área

| Error | Corrección |
|---|---|
| Dar el asiento de memoria | Se razona desde la norma de registro y valoración y el cuadro de cuentas leídos |
| Omitir el IVA en el asiento de una operación que lo lleva | Van las cuentas de IVA soportado o repercutido |
| Buscar las consultas contables con `grupo='consultas'` | Mezcla las de auditoría y reparte los resultados: usa `fuente='contabilidad'` |
| Aplicar la adaptación sectorial a lo que no regula | La adaptación solo manda en su ámbito |
