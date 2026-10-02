# Números y campos calculados en `generar-documento-auditoria`

Fecha: 2026-10-02 · Subproyecto 4 de 4 de la ampliación del motor documental · Estado: diseño aprobado en conversación, pendiente de revisión escrita.

Depende de los subproyectos 1 (condiciones), 2 (grupos repetibles) y 3 (lotes), todos en `main` (3304def).

## Objetivo

Añadir importes y cálculos a las plantillas v2: un campo `number` con formato español, campos `computed` con fórmulas seguras (sumas de columnas de grupos, materialidad, porcentajes) y comparaciones numéricas en las condiciones. De paso, los números de Excel en campos de texto dejan de formatearse como importes.

Fuera de alcance: conversión automática de unidades («miles de euros» con división), fechas calculadas, funciones condicionales dentro de las fórmulas, formatos de otros países.

## Evidencia

- **5335**, carta de manifestaciones: tabla de incorrecciones no corregidas con fila «Total incorrecciones no corregidas» (hoy un campo de texto a mano).
- **1723**, confirmación de independencia EIP: honorarios desglosados por concepto con totales.
- **1728**, comunicación final: incorrecciones a comunicar en función de su importancia.
- Materialidad, materialidad de ejecución y umbral de claramente triviales (NIA-ES 320/450) se calculan como base × porcentaje.
- Subproyecto 3: un código postal `28001` leído de `.xlsx` en un campo `text` salía «28.001».

## 1. Esquema y semántica

### Campo `number`

```json
{ "id": "base", "label": "Cifra de negocios", "type": "number", "decimals": 2, "unit": "€" }
```

- Claves: `id`, `label`, `type`, `required`, `help`, `when`, `value`, `decimals`, `unit`.
- `decimals`: entero de 0 a 6; por defecto 2. `unit`: texto de 1 a 30 caracteres, opcional.
- `value`: texto con un número válido (ver `parseNumber`).
- Valor interno: el texto escrito; se convierte a número al evaluar. Vacío → sin valor. No numérico → valor inválido: el campo se marca y bloquea «Generar» con «Escribe un número válido».
- Admitido como campo normal, como subcampo de un `group` y como campo de `batch.fields`.

### Campo `computed`

```json
{ "id": "materialidad", "label": "Materialidad", "type": "computed", "expr": "base * porcentaje / 100", "decimals": 2, "unit": "€" }
{ "id": "total_incorrecciones", "label": "Total", "type": "computed", "expr": "sum(incorrecciones.efecto_resultado)", "unit": "€" }
```

- Claves: `id`, `label`, `type`, `expr`, `decimals`, `unit`, `help`, `when`. Sin `required` ni `value`.
- `expr`: hasta 500 caracteres y 10 niveles de anidamiento. Gramática:
  - números literales con punto decimal (`0.05`, `100`);
  - identificadores de campos `number` o `computed` declarados antes;
  - `+ - * /`, `-` unario y paréntesis, con la precedencia habitual;
  - funciones: `sum(grupo.subcampo)` (un argumento, subcampo `number`; suma las celdas con valor de las filas con contenido; 0 si no hay filas), `min(a, b, …)` y `max(a, b, …)` (dos o más argumentos), `round(x, n)` (n entero literal de 0 a 6) y `abs(x)`.
  - `grupo.subcampo` solo dentro de `sum`.
- Cálculo con precisión completa; se redondea solo al mostrar. Si algún operando no tiene valor (o es inválido) o hay división por cero, el resultado no tiene valor: `[Etiqueta]` en la vista previa y vacío en el documento final.
- Se evalúa en el orden de `fields` dentro de `effectiveData` (la regla «declarado antes» impide ciclos). Un `computed` oculto por `when` no tiene valor.

### Formato

`formatNumber(n, decimals, unit)`: signo `-`, separador de miles `.` a partir de 1.000, coma decimal, exactamente `decimals` decimales con redondeo medio hacia arriba sobre la representación decimal (1,005 con 2 decimales → «1,01»), y la unidad tras un espacio duro (U+00A0) si existe. Implementado sin `toLocaleString`. «-0» no se produce.

Se aplica a `{{campo}}` de `number` y `computed`, a las celdas de tabla de subcampos `number`, a los textos de `list`/`blocks` y a `renderText`.

### Comparaciones en condiciones

```json
{ "field": "total_incorrecciones", "gt": "materialidad" }
{ "field": "honorarios_pct", "gte": 15 }
```

- Operadores: `gt`, `gte`, `lt`, `lte`, `eq`, solo sobre campos `number` o `computed`.
- Valor: número literal o identificador de otro campo `number`/`computed`.
- Si un lado no tiene valor, la condición es falsa. `filled` sobre `number`/`computed`: tiene valor válido.

### Números de Excel en campos de texto

En `mapRows`, una celda numérica de Excel en un campo `text`/`textarea` se escribe con sus dígitos exactos, sin separador de miles y con coma decimal (`28001` → «28001», `1234.5` → «1234,5»). En un campo `number` se guarda el número y se formatea con su `decimals`/`unit`.

## 2. Validador

Errores nuevos (ruta exacta):

1. `number`: `decimals` no entero o fuera de 0–6; `unit` no texto o de más de 30 caracteres; `value` no numérico.
2. `computed`: falta `expr`; lleva `required` o `value`; `decimals`/`unit` inválidos; error de sintaxis con posición (`fields[5].expr: se esperaba ")" en la posición 18`); identificador desconocido, no numérico o declarado después; función desconocida o número de argumentos incorrecto; `sum` sin `grupo.subcampo` o con subcampo no `number`; `grupo.subcampo` fuera de `sum`; `round` con segundo argumento no literal entre 0 y 6; más de 500 caracteres o de 10 niveles.
3. Comparaciones: operador sobre campo no numérico; valor que no es número ni campo numérico (`fields[3].when.gt: "materialidad" no es un campo numérico`); en el `when` de un campo, un campo de comparación declarado después.
4. `batch.fields` con un `computed`.

Alcanzabilidad: las condiciones con comparación se tratan como indeterminadas (pueden ser verdaderas o falsas); los campos `number` aportan los valores «vacío» y «con valor», y `computed` no aporta dominio propio.

Avisos nuevos: campo `number`/`computed` sin uso en textos, fórmulas ni condiciones; división por un campo que puede quedar vacío (`fields[i].expr: divide por <id>, que puede quedar vacío`).

## 3. Módulos, formulario, listados

- `assets/numbers.js` (nuevo, `globalThis.DocNumbers`): `parseNumber`, `formatNumber`, `compile(expr)` → `{ ast, refs, sums }` o error con posición, `run(ast, values, groups)`. Sin dependencias; se incrusta después del evaluador y antes de `docx.js`.
- `parseNumber(text)`: recorta espacios y elimina la unidad final (cualquier sufijo sin dígitos, como `%`, `€` o «miles de euros»); acepta un signo `-` inicial. Reglas de separadores:
  - con `.` y `,` a la vez, el último que aparece es el decimal y el otro debe separar grupos de 3 dígitos («1.234,56», «1,234.56»);
  - solo `,`: una única coma decimal («1234,56»; varias comas → inválido);
  - solo `.`: si todos los grupos tras cada punto tienen exactamente 3 dígitos y el primero de 1 a 3, son miles («1.234» → 1234, «1.234.567»); si no, un único punto es decimal («1234.56», «0.5»);
  - sin separadores: entero.
  Vacío → `null`; cualquier otra cosa → `NaN`. Las celdas numéricas de Excel no pasan por `parseNumber` (llegan como número).
- `assets/evaluator.js`: `number`/`computed` en `effectiveData` (valor numérico o `null`, y `invalid` para `number` mal escrito), comparaciones en `evaluate`, formato en `fill` y en tablas; `isEmpty` de `number`/`computed` = sin valor válido.
- `assets/tabular.js`: columnas `number` (texto español o número de Excel; no numérico → error de fila `Fila N: "x" no es un número válido para <etiqueta>`); campos `text` con dígitos exactos.
- `assets/assistant-runtime.js`: `number` como `input` de texto con `inputmode="decimal"` y la unidad al lado; marca de error y bloqueo de «Generar» si es inválido; `computed` como valor de solo lectura («—» sin valor) recalculado en cada cambio; en modo lote, con los datos del destinatario visible.

## 4. Pruebas y documentación

- `numbers.test.mjs`: `parseNumber` (formatos válidos e inválidos), `formatNumber` (0 y 6 decimales, negativos, unidad, 1,005, sin «-0»), `compile` (precedencia, paréntesis, unario, funciones, errores con posición, límites), `run` (operando vacío, división por cero, `sum` de grupo sin filas).
- `computed.test.mjs`: plantilla sintética `fixtures/materialidad.v2.json` (base, porcentajes, materialidad, ejecución, umbral, tabla de incorrecciones con `sum`, sección condicionada a `total > materialidad`); rechazo por cada error de la sección 2 y cada aviso.
- `tabular.test.mjs`: dígitos exactos en campos de texto y un campo `number` del lote.
- Compatibilidad: las pruebas de referencia existentes (DOCX y `document.xml`) siguen idénticas.
- Navegador: recálculo de la materialidad al escribir, número inválido bloquea, suma automática de la tabla, sección por comparación, saldo `number` formateado por destinatario en un lote.
- Documentación: `esquema-json.md` («Números y cálculos (v2)»), `analisis-modelo.md` (fila de total → `computed` con `sum`; cálculos → `computed`; umbrales → comparaciones; `number` solo para importes y cantidades, `text` para códigos postales, NIF o teléfonos), `SKILL.md` (mención), `scripts/validate.py` (existencia de `assets/numbers.js`).

## Criterios de aceptación

- `node --test tests/generar-documento/*.test.mjs` y `scripts/validate.py` pasan.
- Las plantillas existentes producen el mismo `buildModel`, `document.xml` y DOCX que antes.
- `materialidad.v2.json` calcula y muestra en el navegador materialidad y total de incorrecciones, y la sección condicionada aparece solo cuando el total supera la materialidad.
- Cada error nuevo de la sección 2 tiene una prueba de rechazo.
