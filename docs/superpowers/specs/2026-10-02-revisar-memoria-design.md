# Habilidad `revisar-memoria-cuentas`

Fecha: 2026-10-02 · Primera habilidad de análisis del plugin `icjce-auditoria` · Estado: diseño aprobado en conversación, pendiente de revisión escrita.

## Objetivo

Ayudar al auditor a revisar la **memoria** de unas cuentas anuales frente a los contenidos obligatorios del marco que les aplica, y a detectar omisiones, información incompleta y cifras que no cuadran con los estados, con un informe en el chat que cite la fuente oficial de cada requisito.

## Principios (decisiones del usuario)

- La habilidad es un **complemento** del modelo anfitrión (Claude, ChatGPT, OpenCode, Hermes): el modelo usa **siempre** su conocimiento y su búsqueda web; el MCP ICJCE le da más potencia con el texto oficial y vigente.
- Las fuentes del MCP están **actualizadas**: cuando cubren una norma, su texto es la referencia que se cita y prevalece sobre lo que el modelo recuerde.
- Para cualquier norma, el **primer paso es `indice_norma`** (índice oficial del BOE con `block_id` y enlace) y después `leer_articulo` para el literal: no se citan apartados que no aparezcan en el índice.
- Solo fuentes oficiales: BOE (PGC, PGC PYMES, NOFCAC, TRLSC, Ley 3/2004…), resoluciones y consultas del ICAC (RICAC, BOICAC), textos del ICJCE. Los manuales KPMG y «101 preguntas» del KG son bibliografía interna y no se usan.
- Sin código: solo `SKILL.md` y referencias. El modelo lee, compara y redacta.

## Alcance

- Cuentas individuales con memoria **normal** o **abreviada** del PGC (RD 1514/2007) y memoria del **PGC PYMES** (RD 1515/2007).
- Cuentas **consolidadas** (NOFCAC, RD 1159/2010).
- **Adaptaciones sectoriales** disponibles en la fuente `contabilidad` del MCP (entidades sin fines lucrativos RD 1491/2011 y Resolución ICAC 2013, cooperativas Orden EHA/3360/2010, sociedades anónimas deportivas, federaciones deportivas, sector eléctrico, vitivinícola…), con el PGC para lo que no regulen.
- Fuentes complementarias: RICAC por tema (patrimonio neto, inmovilizado, ingresos, instrumentos financieros, combinaciones de negocios, impuesto sobre beneficios, coste de producción, moneda extranjera, deterioro), TRLSC (art. 260 y concordantes), Ley 3/2004 y Ley 15/2010 (periodo medio de pago).

Fuera de alcance: opinión de auditoría, juicio sobre importancia relativa o suficiencia de la información, revisión de políticas contables frente a las NRV, informe de gestión y EINF, papel de trabajo editable (posible ampliación con `generar-documento-auditoria`).

## 1. `SKILL.md`

- `name: revisar-memoria-cuentas`. Descripción (≤ 1024 caracteres) que active la habilidad cuando se pida revisar la memoria de unas cuentas anuales, comprobar su contenido obligatorio, detectar omisiones o contrastarla con PGC, PGC PYMES, NOFCAC o una adaptación sectorial, con las cuentas aportadas como PDF, DOCX o texto.
- Principio inicial: conocimiento del modelo + búsqueda web, con el MCP como complemento cuyo texto prevalece.
- Flujo:
  1. **Leer las cuentas**: entidad, ejercicio, forma social, individuales o consolidadas, formato (normal/abreviado), sector y cifras de umbral (activo, cifra de negocios, empleados medios, dos últimos ejercicios).
  2. **Determinar el marco** con `references/marcos-y-umbrales.md`. Los umbrales vigentes se consultan siempre con `indice_norma` + `leer_articulo` (TRLSC arts. 257, 258 y 261; RD 1515/2007 art. 2), nunca de memoria. Un formato que no corresponde a los umbrales es la primera observación.
  3. **Obtener el modelo de memoria vigente** con `indice_norma` (`norma='PGC'`, `'PGC PYMES'` o `'NOFCAC'` y `filtro='memoria'`) o, para adaptaciones sectoriales, `buscar_documentos` + `leer_documento` en la fuente `contabilidad`; `leer_articulo` para el literal de las notas que lo necesiten; fuentes complementarias según el tema.
  4. **Contrastar** nota a nota y aplicar `references/cruces-basicos.md`.
  5. **Redactar el informe** con `references/formato-informe.md`.
- Reglas:
  - Cada requisito lleva su fuente: enlace devuelto por el MCP o URL oficial; si viene del conocimiento del modelo sin contrastar, se marca así.
  - Estados: **Omisión** (falta un requisito obligatorio), **Incompleto** (está sin el contenido mínimo), **No aplica** (con justificación), **A verificar** (el modelo no puede asegurarlo: cifra dudosa, lectura incierta, juicio de importancia).
  - No emitir opinión de auditoría ni juzgar suficiencia o importancia relativa.
  - Las cuentas del cliente son confidenciales: se procesan solo en la conversación; no se publican ni se suben a servicios externos.
- Sin MCP conectado: decirlo, trabajar con conocimiento y web (BOE, ICAC) y marcar que no se ha contrastado con el texto del MCP.

## 2. Referencias

### `references/marcos-y-umbrales.md`

- Árbol de decisión: consolidadas → NOFCAC; adaptación sectorial aplicable → su modelo + PGC supletorio; en otro caso PGC PYMES o PGC según umbrales y opción ejercida, y dentro del PGC memoria normal o abreviada.
- Qué miden los umbrales, regla de dos ejercicios consecutivos, primer ejercicio y quién no puede aplicar el PGC PYMES (valores admitidos a negociación, obligadas a consolidar, moneda funcional distinta del euro, entidades financieras), con indicación de dónde verificarlo (`indice_norma`) y sin importes fijos.
- Tabla de localización en el MCP: marco → `norma` y `filtro` de `indice_norma`, o `buscar_documentos` en la fuente `contabilidad` para las adaptaciones.

### `references/cruces-basicos.md`

- Partidas que obligan a informar y tema de la nota (para localizarla con `indice_norma`): inmovilizado material, intangible e inversiones inmobiliarias (cuadro de movimiento), arrendamientos, instrumentos financieros, existencias, moneda extranjera, situación fiscal, provisiones y contingencias, subvenciones, partes vinculadas, información sobre empleados (número medio por categorías y sexo), honorarios de auditoría, periodo medio de pago a proveedores, hechos posteriores, medio ambiente cuando proceda.
- Cifras que deberían coincidir: saldo final de cada cuadro de movimiento ↔ balance; aplicación del resultado ↔ resultado del ejercicio; gasto por impuesto de la nota fiscal ↔ cuenta de pérdidas y ganancias; desglose de la cifra de negocios ↔ importe de la cuenta de pérdidas y ganancias; saldos con partes vinculadas ↔ partidas del grupo en balance. Una discrepancia es «A verificar».
- Lo que no se juzga: importancia relativa y suficiencia, reservadas al auditor.

### `references/formato-informe.md`

1. Encabezado: entidad, ejercicio, marco aplicado y motivo, fuentes consultadas (MCP / web, con fecha).
2. Resumen: número de omisiones, incompletos y puntos a verificar.
3. Tabla por nota: nota del modelo · requisito · estado · observación · fuente.
4. Tabla de cruces con los estados.
5. Lista final de puntos a revisar por el auditor.
6. Aviso fijo: ayuda a la revisión que no sustituye el juicio profesional ni constituye opinión de auditoría.
Se puede exportar a Word con la habilidad `docx` del cliente si existe.

## 3. Integración y pruebas

- `scripts/validate.py`: el conjunto de habilidades pasa a ser `{consultar-icjce-mcp, generar-documento-auditoria, revisar-memoria-cuentas}`; las referencias citadas en `SKILL.md` deben existir (comprobación ya genérica).
- `scripts/install_opencode.py`: añadir la habilidad a `SKILLS`.
- `README.md`: describir la habilidad y su instalación en Hermes.
- Prueba de comportamiento (método de `writing-skills`):
  - `tests/revisar-memoria/cuentas-sinteticas.md`: cuentas anuales inventadas de una pyme (balance, cuenta de pérdidas y ganancias y memoria) con cinco omisiones sembradas: falta el periodo medio de pago; el cuadro de inmovilizado no cuadra con el balance; existencias significativas sin nota; falta el número medio de empleados por sexo; la aplicación del resultado no coincide con el resultado.
  - `tests/revisar-memoria/esperado.md`: las cinco detecciones esperadas y los requisitos de forma (marco determinado y justificado, fuentes por requisito, estados válidos, aviso final, sin opinión de auditoría).
  - Un subagente revisa sin la habilidad y otro con ella; se comparan detecciones, citas, formato y reglas. Los subagentes no tienen el MCP autorizado: la prueba cubre el modo sin MCP (búsqueda en el BOE). La prueba con MCP la hace el usuario en Claude con el conector autorizado.

## Criterios de aceptación

- `scripts/validate.py` pasa con las tres habilidades y las referencias existentes.
- Con la habilidad, el subagente detecta las cinco omisiones sembradas, determina y justifica el marco (PGC PYMES o PGC abreviado según los umbrales de las cuentas sintéticas), cita una fuente por requisito, usa solo los cuatro estados y termina con el aviso; sin la habilidad, al menos uno de estos puntos falla (línea base que justifica la habilidad).
- Ninguna referencia contiene importes de umbrales fijos ni cita bibliografía interna.
