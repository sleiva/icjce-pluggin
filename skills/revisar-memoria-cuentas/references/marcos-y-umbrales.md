# Marco contable y modelo de memoria

Esta referencia orienta la decisión; las condiciones y los importes vigentes se leen siempre en la norma con `indice_norma` y `leer_articulo`.

## 1. Árbol de decisión

1. **¿Son cuentas consolidadas?** → Normas para la Formulación de Cuentas Anuales Consolidadas (`norma='NOFCAC'`), con su modelo de memoria consolidada. Comprueba también si el grupo podía estar dispensado de consolidar (Código de Comercio, art. 43) y el formato que corresponde. Si el grupo formula sus cuentas consolidadas con las NIIF adoptadas por la Unión Europea (obligatorio si alguna sociedad del grupo tiene valores admitidos a negociación en un mercado regulado de la Unión; Código de Comercio, art. 43 bis), la revisión frente a las NOFCAC no procede: indícalo y no apliques este modelo.
2. **¿Le aplica una adaptación sectorial?** (entidades sin fines lucrativos, cooperativas, sociedades anónimas deportivas, federaciones deportivas, sector eléctrico, empresas vitivinícolas, otras) → su modelo de memoria, y el PGC (o el PGC PYMES, si la adaptación lo permite) para lo que no regule.
3. **Si no**, cuentas individuales:
   - **PGC PYMES** (`norma='PGC PYMES'`) si la entidad puede aplicarlo y ha optado por él.
   - **PGC** (`norma='PGC'`), con memoria **abreviada** si puede formular balance y memoria abreviados, o **normal** en otro caso.

## 2. Qué comprobar de los umbrales

- **Magnitudes**: total activo, importe neto de la cifra de negocios y número medio de trabajadores del ejercicio.
- **Regla**: se cumplen cuando, durante **dos ejercicios consecutivos**, a la fecha de cierre no se superan al menos dos de las tres magnitudes; se pierde la condición cuando se superan dos de ellas durante dos ejercicios consecutivos. En el primer ejercicio desde la constitución, la transformación o la fusión, basta con cumplirlos al cierre de ese ejercicio. Confírmalo en la norma.
- **Dónde están**: Texto refundido de la Ley de Sociedades de Capital (`norma='TRLSC'`, artículos 257 y 261 para el balance, el estado de cambios en el patrimonio neto y la memoria abreviados, y artículo 258 para la cuenta de pérdidas y ganancias abreviada; filtro `abreviad`) y Real Decreto 1515/2007 (`norma='PGC PYMES'`, ámbito de aplicación). Usa siempre los importes que figuren en el texto vigente que devuelva el MCP.
- **Quién no puede aplicar el PGC PYMES**, aunque cumpla los umbrales (confírmalo en la norma): entidades con valores admitidos a negociación en un mercado regulado, entidades que formen parte de un grupo que formule o deba formular cuentas consolidadas, entidades cuya moneda funcional no sea el euro y entidades financieras que capten fondos del público.
- **Entidades de interés público**: no pueden formular cuentas en formato abreviado ni aplicar el PGC PYMES, aunque cumplan los umbrales; confírmalo en la norma.
- **Incoherencias que son observación**: cuentas en formato PYMES o abreviado sin cumplir los umbrales; aplicación del PGC PYMES por una entidad excluida; memoria normal con estados abreviados, o al revés.

## 3. Dónde está cada modelo en el MCP

| Marco | Cómo localizar el modelo de memoria |
|---|---|
| PGC, memoria normal o abreviada | `indice_norma(norma='PGC', filtro='memoria')` y `leer_articulo` de los bloques del modelo |
| PGC PYMES | `indice_norma(norma='PGC PYMES', filtro='memoria')` |
| Cuentas consolidadas | `indice_norma(norma='NOFCAC', filtro='memoria')` |
| Adaptación sectorial | `buscar_documentos` en la fuente `contabilidad` con el nombre del sector y «memoria»; después `leer_documento` |
| Información adicional por tema | `indice_norma` de la resolución del ICAC del tema (patrimonio neto, inmovilizado, ingresos, instrumentos financieros, combinaciones de negocios, impuesto sobre beneficios, coste de producción, moneda extranjera, deterioro) |
| Información de la ley mercantil | `indice_norma(norma='TRLSC', filtro='memoria')` (contenido de la memoria y otros apartados obligatorios) |
| Periodo medio de pago | `indice_norma(norma='Ley 15/2010')` (disposición adicional tercera, texto vigente), `indice_norma(norma='Ley 3/2004')` (plazos legales de pago) y la resolución del ICAC sobre la información a incorporar en la memoria; comprueba en el texto vigente la información adicional exigida a quien no pueda presentar cuenta de pérdidas y ganancias abreviada |

Si el MCP no devuelve un modelo, búscalo en el BOE (texto consolidado) y cita esa URL.
