---
name: revisar-memoria-cuentas
description: Úsala cuando el auditor pida revisar la memoria de unas cuentas anuales, comprobar que contiene la información obligatoria, detectar omisiones o contrastarla con el PGC, el PGC PYMES, las NOFCAC o una adaptación sectorial del PGC, a partir de las cuentas aportadas como PDF, DOCX o texto. Produce un informe de revisión en el chat con el estado de cada requisito, los cruces básicos con el balance y la cuenta de pérdidas y ganancias, y la fuente oficial de cada requisito. No emite opinión de auditoría.
---

# Revisión de la memoria frente al marco contable

## Forma de trabajar

**Aplica tu conocimiento y criterio técnico contable** para interpretar las cuentas, relacionar cifras y notas, identificar posibles omisiones y explicar al auditor por qué importan. No reduzcas la revisión a copiar requisitos o resultados del MCP. Verifica los requisitos normativos y su vigencia con el texto del MCP del ICJCE y, cuando esté disponible, con fuentes web oficiales (BOE, ICAC), especialmente para información actual o no cubierta por el MCP. Distingue los hechos leídos en las cuentas, los requisitos verificados y tus inferencias o puntos que requieren juicio del auditor. Cuando el MCP cubra una norma, cita su texto oficial y vigente por encima de lo que recuerdes; si no la cubre, búscala en la web antes de pedírsela al usuario.

Para cualquier norma, **empieza por `indice_norma`** (índice oficial y vigente con el `block_id` y el enlace de cada artículo o disposición) y lee el literal con `leer_articulo` antes de afirmar lo que dice. No cites ningún apartado que no aparezca en el índice. Descubre las operaciones y sus parámetros en el propio cliente.

## Flujo

1. **Lee las cuentas** aportadas y anota: entidad, ejercicio y comparativo, forma social, si son individuales o consolidadas, formato de los estados (normal, abreviado, PYMES), sector y las cifras de umbral de los dos últimos ejercicios (total activo, importe neto de la cifra de negocios, número medio de trabajadores).
2. **Determina el marco** con `references/marcos-y-umbrales.md`. Comprueba los umbrales vigentes en la norma con `indice_norma` y `leer_articulo`; nunca los cites de memoria. Si el formato de las cuentas no corresponde al marco que resulta, esa es la primera observación del informe.
3. **Obtén el modelo de memoria vigente** del marco con `indice_norma` (por ejemplo `norma='PGC PYMES'` con `filtro='memoria'`) o, en una adaptación sectorial, con `buscar_documentos` y `leer_documento` en la fuente `contabilidad`. Lee en literal las notas que necesites contrastar con precisión. Añade las fuentes complementarias que correspondan al contenido de las cuentas (resoluciones del ICAC por tema, TRLSC, Ley 15/2010 y su resolución sobre el periodo medio de pago).
4. **Contrasta nota a nota** la memoria con el modelo y aplica los cruces de `references/cruces-basicos.md`.
5. **Redacta el informe** con la estructura de `references/formato-informe.md`.

## Reglas

- Cada requisito lleva su **fuente**: el enlace que devuelve el MCP o la URL oficial consultada. Si solo procede de tu conocimiento y no lo has podido contrastar, márcalo así.
- Usa solo estos estados: **Omisión** (falta información obligatoria), **Incompleto** (está, pero sin el contenido mínimo que exige la norma), **No aplica** (con la justificación) y **A verificar** (no puedes asegurarlo: una cifra que no cuadra o que puede estar mal leída, una lectura dudosa, un juicio de importancia relativa).
- No emitas opinión de auditoría ni juzgues la suficiencia o la importancia relativa de la información: señálalo como punto a revisar por el auditor.
- Las cuentas del cliente son **confidenciales**: trabájalas solo en esta conversación; no las publiques ni las subas a servicios externos.

**Si falta una fuente:** si el MCP no está disponible, dilo al principio del informe, trabaja con tu conocimiento y fuentes oficiales web, y marca que los requisitos no se han contrastado con el texto del MCP. Nunca afirmes haber consultado el MCP o la web si no lo hiciste.

## Referencias

| Para | Referencia |
|---|---|
| Elegir el marco (normal, abreviada, PYMES, consolidadas, adaptación sectorial) y localizar su modelo de memoria | `references/marcos-y-umbrales.md` |
| Partidas que obligan a informar y cifras que deben coincidir con los estados | `references/cruces-basicos.md` |
| Estructura del informe | `references/formato-informe.md` |
