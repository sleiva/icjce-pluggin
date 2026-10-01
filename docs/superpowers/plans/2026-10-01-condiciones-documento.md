# Condiciones, casillas y textos derivados — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar el motor de `generar-documento-auditoria` con condiciones compuestas, casillas, selección múltiple, campos condicionales, condiciones con nombre y textos derivados (`schema_version: 2`), manteniendo intactas las plantillas v1.

**Architecture:** Un evaluador sin dependencias (`assets/evaluator.js`) concentra la semántica (vacío, condiciones, visibilidad, derivados, documento final). Lo importa el validador de Node (`bin/validar-plantilla.mjs`) y se incrusta en el HTML antes del runtime, de modo que lo comprobado es lo que se ejecuta. Vista previa, DOCX e impresión consumen el mismo `buildModel()`; `docxXml()` y `zip()` no cambian.

**Tech Stack:** Node 22 (ESM `.mjs`, `node:test`, sin dependencias nuevas), JavaScript de navegador sin compilación, Python 3 para `scripts/validate.py`.

**Spec:** `docs/superpowers/specs/2026-10-01-condiciones-documento-design.md`

## Global Constraints

- Sin dependencias nuevas (npm ni Python). El HTML generado sigue siendo un único archivo autónomo sin CDN.
- `examples/carta-encargo.json` (v1) debe validar y producir exactamente el mismo documento que hoy (prueba de referencia en la tarea 3).
- Las pruebas viven en `tests/generar-documento/` (no dentro de `skills/`, porque `scripts/package.py` empaqueta todo `skills/` y las pruebas no deben ir en el plugin). Se ejecutan con `node --test tests/generar-documento/*.test.mjs` (Node 22 no acepta un directorio).
- Los datos de prueba son **texto sintético**; no se incorpora texto del ICJCE al repositorio.
- No se permiten enlaces simbólicos en `skills/` (lo comprueba `scripts/validate.py`).
- Los mensajes de error y aviso están en español y empiezan por la ruta JSON del problema.
- Todo el código de este plan se ha prototipado y probado (21 pruebas en verde, flujo comprobado en navegador) antes de escribirlo; copiarlo tal cual.

**User decisions (already made):**
- «a, empezamos por el 1»: este plan cubre solo el subproyecto 1 (condiciones y casillas); tablas, lote y cálculos quedan fuera.
- Condiciones a nivel de sección **y** de párrafo (opción a).
- Operadores `equals`, `in`, `checked`, `filled`, `includes`, `all`, `any`, `not`, `ref`; sin comparaciones numéricas; máximo 3 niveles.
- Variación dentro de la frase mediante textos derivados ligados a campos, no con `{{#if}}` en el texto.
- «La idea es que la skill fuera lo más flexible y que analizara el documento que encontrara»: sin código específico por documento; la guía de análisis enseña a traducir cualquier marca a las piezas genéricas.
- Errores bloquean, avisos no; `schema_version: 2` para lo nuevo; un único espacio de nombres; derivados no usan derivados; condiciones con nombre no usan `ref`.

**Refinamiento sobre la spec (ya incorporado a la spec):** el `when` de un campo solo puede referenciar campos declarados **antes** que él. Evita ciclos y permite evaluar la visibilidad en una sola pasada.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `skills/generar-documento-auditoria/assets/evaluator.js` (nuevo) | Semántica compartida: `isEmpty`, `evaluate`, `effectiveData`, `buildModel`. Expone `globalThis.DocEvaluator`. |
| `skills/generar-documento-auditoria/bin/validar-plantilla.mjs` (nuevo) | `validate` (errores, incluida alcanzabilidad), `lint` (avisos), `suggest`, `fieldsOf`, `reachability`. |
| `skills/generar-documento-auditoria/bin/generar-documento.mjs` | CLI y `render`: reexporta `validate`/`lint`, imprime avisos, incrusta el evaluador. |
| `skills/generar-documento-auditoria/assets/assistant-runtime.js` | UI: valores con tipo, casillas, grupos, visibilidad, progreso; delega en `buildModel`. |
| `skills/generar-documento-auditoria/assets/assistant.html` | Hueco `/*__EVALUATOR__*/` y estilos de casillas. |
| `tests/generar-documento/*.test.mjs` (nuevos) | Pruebas del evaluador, validador y renderizado. |
| `tests/generar-documento/fixtures/comunicacion-gobierno.v2.json` (nuevo) | Plantilla v2 sintética que usa todas las piezas. |
| `skills/generar-documento-auditoria/references/esquema-json.md`, `references/analisis-modelo.md`, `SKILL.md` | Documentación del formato v2 y de cómo traducir las marcas de cualquier modelo. |
| `scripts/validate.py` | Ejecuta también las pruebas de Node. |

---

### Task 1: Evaluador compartido

**Goal:** Crear `assets/evaluator.js` con la semántica de condiciones, visibilidad, derivados y documento final, cubierta por pruebas.

**Files:**
- Create: `skills/generar-documento-auditoria/assets/evaluator.js`
- Create: `tests/generar-documento/fixtures/comunicacion-gobierno.v2.json`
- Test: `tests/generar-documento/evaluator.test.mjs`

**Acceptance Criteria:**
- [ ] `node --test tests/generar-documento/evaluator.test.mjs` termina con `# pass 7` y `# fail 0`.
- [ ] `globalThis.DocEvaluator` expone `PLACEHOLDER`, `emptyValue`, `isEmpty`, `evaluate`, `effectiveData`, `buildModel`.
- [ ] Un campo oculto por `when` vale vacío (`''`, `false` o `[]`) aunque se le pase un valor.
- [ ] `buildModel` elimina las secciones sin párrafos visibles y devuelve `stats: { included, total }`.

**Verify:** `node --test tests/generar-documento/evaluator.test.mjs` → `# pass 7`, `# fail 0`

**Steps:**

- [ ] **Step 1: Crear la plantilla de prueba sintética**

`tests/generar-documento/fixtures/comunicacion-gobierno.v2.json`:

```json
{
  "schema_version": 2,
  "title": "Comunicación de prueba a {{organo}}",
  "subtitle": "{{entidad}} · ejercicio {{ejercicio}}",
  "fields": [
    { "id": "entidad", "label": "Entidad", "type": "text", "required": true },
    { "id": "ejercicio", "label": "Ejercicio", "type": "text", "required": true },
    { "id": "forma", "label": "Forma social", "type": "select", "required": true, "options": ["S.A.", "S.L."] },
    { "id": "eip", "label": "¿Es EIP?", "type": "select", "required": true, "options": ["Sí", "No"] },
    { "id": "opinion", "label": "Opinión", "type": "select", "required": true, "options": ["Favorable", "Con salvedades", "Desfavorable", "Denegada"] },
    { "id": "fundamento", "label": "Fundamento de la opinión modificada", "type": "textarea", "required": true, "when": { "ref": "opinion_modificada" } },
    { "id": "incertidumbre", "label": "Hay incertidumbre material", "type": "checkbox" },
    { "id": "asuntos", "label": "Asuntos a comunicar", "type": "multiselect", "options": ["Indicios de fraude", "Deficiencias significativas"] },
    { "id": "encargante", "label": "Encargante, si no es la propia entidad", "type": "text" },
    { "id": "organo", "label": "Órgano destinatario", "type": "text", "required": true }
  ],
  "conditions": {
    "opinion_modificada": { "field": "opinion", "in": ["Con salvedades", "Desfavorable", "Denegada"] }
  },
  "derived": {
    "socios": {
      "cases": [
        { "when": { "field": "forma", "equals": "S.L." }, "text": "socios" },
        { "when": { "field": "forma", "equals": "S.A." }, "text": "accionistas" }
      ],
      "default": "accionistas"
    },
    "por_encargo": {
      "cases": [ { "when": { "field": "encargante", "filled": true }, "text": " por encargo de {{encargante}}" } ],
      "default": ""
    }
  },
  "sections": [
    { "heading": "Introducción", "paragraphs": ["Texto de prueba dirigido a los {{socios}} de {{entidad}}{{por_encargo}}."] },
    { "heading": "Opinión", "paragraphs": [
      { "text": "Texto de prueba de opinión favorable.", "when": { "field": "opinion", "equals": "Favorable" } },
      { "text": "Texto de prueba de opinión modificada: {{fundamento}}", "when": { "ref": "opinion_modificada" } }
    ] },
    { "heading": "Incertidumbre material", "when": { "field": "incertidumbre", "checked": true }, "paragraphs": ["Texto de prueba sobre incertidumbre."] },
    { "heading": "Asuntos comunicados", "paragraphs": [
      { "text": "Texto de prueba sobre fraude.", "when": { "field": "asuntos", "includes": "Indicios de fraude" } },
      { "text": "Texto de prueba sobre deficiencias.", "when": { "field": "asuntos", "includes": "Deficiencias significativas" } }
    ] },
    { "heading": "Requisitos EIP", "when": { "all": [ { "field": "eip", "equals": "Sí" }, { "any": [ { "ref": "opinion_modificada" }, { "field": "incertidumbre", "checked": true } ] } ] }, "paragraphs": ["Texto de prueba para EIP con opinión modificada o incertidumbre."] },
    { "heading": "Cierre", "when": { "not": { "field": "eip", "equals": "No" } }, "paragraphs": ["Texto de prueba de cierre para EIP."] }
  ],
  "sources": [],
  "include_sources_in_output": false
}
```

- [ ] **Step 2: Escribir las pruebas del evaluador**

`tests/generar-documento/evaluator.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../../skills/generar-documento-auditoria/assets/evaluator.js';

const { evaluate, effectiveData, buildModel, isEmpty } = globalThis.DocEvaluator;
const fixture = JSON.parse(await readFile(new URL('./fixtures/comunicacion-gobierno.v2.json', import.meta.url), 'utf8'));

const spec = {
  fields: [
    { id: 'opinion', type: 'select', options: ['Favorable', 'Con salvedades'] },
    { id: 'nota', type: 'text' },
    { id: 'marca', type: 'checkbox' },
    { id: 'lista', type: 'multiselect', options: ['A', 'B'] },
  ],
  conditions: { favorable: { field: 'opinion', equals: 'Favorable' } },
};

test('operadores hoja', () => {
  const data = { opinion: 'Favorable', nota: '  hola ', marca: true, lista: ['A'] };
  assert.equal(evaluate({ field: 'opinion', equals: 'Favorable' }, data, spec), true);
  assert.equal(evaluate({ field: 'opinion', equals: 'Con salvedades' }, data, spec), false);
  assert.equal(evaluate({ field: 'opinion', in: ['Con salvedades', 'Favorable'] }, data, spec), true);
  assert.equal(evaluate({ field: 'nota', equals: 'hola' }, data, spec), true);
  assert.equal(evaluate({ field: 'marca', checked: true }, data, spec), true);
  assert.equal(evaluate({ field: 'marca', checked: false }, data, spec), false);
  assert.equal(evaluate({ field: 'lista', includes: 'A' }, data, spec), true);
  assert.equal(evaluate({ field: 'lista', includes: 'B' }, data, spec), false);
  assert.equal(evaluate({ field: 'nota', filled: true }, data, spec), true);
  assert.equal(evaluate({ field: 'nota', filled: false }, { nota: '   ' }, spec), true);
  assert.equal(evaluate({ field: 'lista', filled: true }, { lista: [] }, spec), false);
});

test('combinadores y ref', () => {
  const data = { opinion: 'Favorable', marca: false };
  const yes = { ref: 'favorable' };
  const no = { field: 'marca', checked: true };
  assert.equal(evaluate({ all: [yes, no] }, data, spec), false);
  assert.equal(evaluate({ any: [yes, no] }, data, spec), true);
  assert.equal(evaluate({ not: no }, data, spec), true);
  assert.equal(evaluate(undefined, data, spec), true);
  assert.throws(() => evaluate({ ref: 'nada' }, data, spec), /Condición desconocida/);
});

test('isEmpty por tipo', () => {
  assert.equal(isEmpty({ type: 'text' }, ' '), true);
  assert.equal(isEmpty({ type: 'checkbox' }, false), true);
  assert.equal(isEmpty({ type: 'checkbox' }, true), false);
  assert.equal(isEmpty({ type: 'multiselect' }, []), true);
  assert.equal(isEmpty({ type: 'multiselect' }, ['A']), false);
});

test('un campo oculto vale vacío aunque conserve texto', () => {
  const { data, visible } = effectiveData(fixture, { opinion: 'Favorable', fundamento: 'texto antiguo' });
  assert.equal(visible.fundamento, false);
  assert.equal(data.fundamento, '');
  assert.equal(effectiveData(fixture, { opinion: 'Desfavorable', fundamento: 'nuevo' }).data.fundamento, 'nuevo');
});

test('derivados: primer caso que se cumple y valor por defecto', () => {
  const base = { entidad: 'Prueba', ejercicio: '2026', organo: 'Consejo', eip: 'No', opinion: 'Favorable' };
  const intro = data => buildModel(fixture, { ...base, ...data }).sections[0].paragraphs[0];
  assert.equal(intro({ forma: 'S.L.' }), 'Texto de prueba dirigido a los socios de Prueba.');
  assert.equal(intro({ forma: '' }), 'Texto de prueba dirigido a los accionistas de Prueba.');
  assert.equal(intro({ forma: 'S.A.', encargante: 'Banco Y' }), 'Texto de prueba dirigido a los accionistas de Prueba por encargo de Banco Y.');
});

test('huecos marcados solo en la vista previa', () => {
  const preview = buildModel(fixture, {}, { markMissing: true });
  assert.equal(preview.title, 'Comunicación de prueba a [Órgano destinatario]');
  assert.equal(buildModel(fixture, {}).title, 'Comunicación de prueba a ');
});

test('secciones sin párrafos visibles desaparecen', () => {
  const model = buildModel(fixture, { opinion: 'Favorable', asuntos: [] });
  assert.ok(!model.sections.some(section => section.heading === 'Asuntos comunicados'));
  assert.deepEqual(model.stats.total, fixture.sections.length);
});
```

- [ ] **Step 3: Ejecutar y comprobar que fallan**

Run: `node --test tests/generar-documento/evaluator.test.mjs`
Expected: FAIL con `Cannot find module` sobre `assets/evaluator.js`.

- [ ] **Step 4: Implementar el evaluador**

`skills/generar-documento-auditoria/assets/evaluator.js`:

```js
/* Evaluador de plantillas del asistente documental: condiciones, visibilidad de campos,
   textos derivados y documento final. Sin dependencias; se incrusta en el HTML y lo
   importa el validador de Node, de modo que lo comprobado es lo que se ejecuta. */
(function (root) {
  'use strict';
  const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;

  function emptyValue(field) {
    if (field.type === 'checkbox') return false;
    if (field.type === 'multiselect') return [];
    return '';
  }

  function isEmpty(field, value) {
    if (field.type === 'checkbox') return value !== true;
    if (field.type === 'multiselect') return !Array.isArray(value) || value.length === 0;
    return typeof value !== 'string' || !value.trim();
  }

  function evaluate(condition, data, spec) {
    if (!condition) return true;
    if ('all' in condition) return condition.all.every(item => evaluate(item, data, spec));
    if ('any' in condition) return condition.any.some(item => evaluate(item, data, spec));
    if ('not' in condition) return !evaluate(condition.not, data, spec);
    if ('ref' in condition) {
      const target = spec.conditions && Object.prototype.hasOwnProperty.call(spec.conditions, condition.ref) ? spec.conditions[condition.ref] : null;
      if (!target) throw new Error(`Condición desconocida: ${condition.ref}`);
      return evaluate(target, data, spec);
    }
    const field = spec.fields.find(item => item.id === condition.field);
    if (!field) throw new Error(`Campo desconocido: ${condition.field}`);
    const value = data[condition.field];
    const text = typeof value === 'string' ? value.trim() : '';
    if ('equals' in condition) return text === condition.equals;
    if ('in' in condition) return condition.in.includes(text);
    if ('checked' in condition) return (value === true) === condition.checked;
    if ('includes' in condition) return Array.isArray(value) && value.includes(condition.includes);
    if ('filled' in condition) return !isEmpty(field, value) === condition.filled;
    throw new Error('Condición no reconocida');
  }

  // Los campos con `when` solo pueden depender de campos anteriores (lo exige el
  // validador), así que basta una pasada en orden. Un campo oculto vale vacío.
  function effectiveData(spec, raw) {
    const source = raw || {};
    const data = {};
    const visible = {};
    for (const field of spec.fields) {
      const shown = !field.when || evaluate(field.when, data, spec);
      visible[field.id] = shown;
      data[field.id] = shown && source[field.id] !== undefined ? source[field.id] : emptyValue(field);
    }
    return { data, visible };
  }

  function fill(template, data, derived, spec, markMissing) {
    return template.replace(PLACEHOLDER, (_, id) => {
      if (Object.prototype.hasOwnProperty.call(derived, id)) return derived[id];
      const value = data[id];
      const text = typeof value === 'string' ? value.trim() : '';
      if (text || !markMissing) return text;
      const field = spec.fields.find(item => item.id === id);
      return `[${field ? field.label : id}]`;
    });
  }

  function resolveDerived(spec, data, markMissing) {
    const out = {};
    for (const [id, definition] of Object.entries(spec.derived || {})) {
      const hit = definition.cases.find(item => evaluate(item.when, data, spec));
      out[id] = fill(hit ? hit.text : definition.default, data, {}, spec, markMissing);
    }
    return out;
  }

  function buildModel(spec, raw, options) {
    const markMissing = Boolean(options && options.markMissing);
    const { data } = effectiveData(spec, raw);
    const derived = resolveDerived(spec, data, markMissing);
    const format = template => fill(template, data, derived, spec, markMissing);
    const sections = [];
    for (const section of spec.sections) {
      if (section.when && !evaluate(section.when, data, spec)) continue;
      const paragraphs = section.paragraphs
        .map(item => (typeof item === 'string' ? { text: item } : item))
        .filter(item => !item.when || evaluate(item.when, data, spec))
        .map(item => format(item.text));
      if (paragraphs.length) sections.push({ heading: format(section.heading), paragraphs });
    }
    return {
      title: format(spec.title),
      subtitle: spec.subtitle ? format(spec.subtitle) : '',
      sections,
      sources: spec.include_sources_in_output ? (spec.sources || []) : [],
      stats: { included: sections.length, total: spec.sections.length },
    };
  }

  root.DocEvaluator = { PLACEHOLDER, emptyValue, isEmpty, evaluate, effectiveData, buildModel };
})(globalThis);
```

- [ ] **Step 5: Ejecutar y comprobar que pasan**

Run: `node --test tests/generar-documento/evaluator.test.mjs`
Expected: `# pass 7`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add skills/generar-documento-auditoria/assets/evaluator.js tests/generar-documento/evaluator.test.mjs tests/generar-documento/fixtures/comunicacion-gobierno.v2.json
git commit -m "Add shared template evaluator for document assistant"
```

```json:metadata
{"files": ["skills/generar-documento-auditoria/assets/evaluator.js", "tests/generar-documento/evaluator.test.mjs", "tests/generar-documento/fixtures/comunicacion-gobierno.v2.json"], "verifyCommand": "node --test tests/generar-documento/evaluator.test.mjs", "acceptanceCriteria": ["node --test tests/generar-documento/evaluator.test.mjs reports # pass 7 and # fail 0", "globalThis.DocEvaluator exposes PLACEHOLDER, emptyValue, isEmpty, evaluate, effectiveData, buildModel", "hidden field evaluates as empty", "buildModel drops sections without visible paragraphs and returns stats"], "modelTier": "mechanical"}
```

---

### Task 2: Validador de plantillas v2

**Goal:** Sustituir la validación v1 de `generar-documento.mjs` por `bin/validar-plantilla.mjs`, con todos los errores y avisos de la spec, y mostrar los avisos en la CLI.

**Files:**
- Create: `skills/generar-documento-auditoria/bin/validar-plantilla.mjs`
- Modify: `skills/generar-documento-auditoria/bin/generar-documento.mjs` (sustituir las líneas 7-61, la validación v1, e imprimir avisos en `main`)
- Test: `tests/generar-documento/validator.test.mjs`

**Acceptance Criteria:**
- [ ] `node --test tests/generar-documento/validator.test.mjs` termina con `# pass 10` y `# fail 0`.
- [ ] `"favorable"` frente a la opción `"Favorable"` da error con el texto `¿Querías decir "Favorable"?`.
- [ ] Una sección con `all: [opinion = Favorable, opinion = Con salvedades]` da error `sections[1]: inalcanzable`.
- [ ] `node skills/generar-documento-auditoria/bin/generar-documento.mjs validate skills/generar-documento-auditoria/examples/carta-encargo.json` imprime `Plantilla válida: Carta de encargo de auditoría` (precedida de una línea `Aviso:` sobre la opción «Auditoría de cuentas anuales», que es la rama por defecto).

**Verify:** `node --test tests/generar-documento/validator.test.mjs` → `# pass 10`, `# fail 0`

**Steps:**

- [ ] **Step 1: Escribir las pruebas del validador**

`tests/generar-documento/validator.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validate, lint } from '../../skills/generar-documento-auditoria/bin/validar-plantilla.mjs';

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const fixture = await read('./fixtures/comunicacion-gobierno.v2.json');
const example = await read('../../skills/generar-documento-auditoria/examples/carta-encargo.json');

function spec(overrides = {}) {
  return {
    schema_version: 2,
    title: 'Prueba',
    fields: [
      { id: 'opinion', label: 'Opinión', type: 'select', options: ['Favorable', 'Con salvedades'] },
      { id: 'marca', label: 'Marca', type: 'checkbox' },
      { id: 'texto', label: 'Texto', type: 'text' },
    ],
    sections: [{ heading: 'Uno', paragraphs: ['{{opinion}} {{texto}}'] }],
    ...overrides,
  };
}
const section = when => spec({ sections: [{ heading: 'Uno', paragraphs: ['{{opinion}} {{texto}}'] }, { heading: 'Dos', when, paragraphs: ['Texto.'] }] });

test('la plantilla de ejemplo v1 y la de prueba v2 son válidas y sin avisos', () => {
  assert.doesNotThrow(() => validate(example));
  assert.doesNotThrow(() => validate(fixture));
  assert.deepEqual(lint(fixture), []);
});

test('valor que no es una opción, con sugerencia', () => {
  assert.throws(() => validate(section({ field: 'opinion', equals: 'favorable' })), /sections\[1\]\.when\.equals: "favorable" no es una opción de opinion\. ¿Querías decir "Favorable"\?/);
  assert.throws(() => validate(section({ field: 'opinion', in: ['Con salvedad'] })), /¿Querías decir "Con salvedades"\?/);
});

test('operador incompatible con el tipo de campo', () => {
  assert.throws(() => validate(section({ field: 'opinion', checked: true })), /operador checked no se admite en campos select/);
  assert.throws(() => validate(section({ field: 'marca', filled: true })), /operador filled no se admite en campos checkbox/);
  assert.throws(() => validate(section({ field: 'marca', includes: 'A' })), /operador includes no se admite en campos checkbox/);
});

test('referencias sin resolver', () => {
  assert.throws(() => validate(spec({ sections: [{ heading: 'Uno', paragraphs: ['{{nada}}'] }] })), /campo desconocido \{\{nada\}\}/);
  assert.throws(() => validate(section({ field: 'nada', equals: 'x' })), /campo desconocido nada/);
  assert.throws(() => validate(section({ ref: 'nada' })), /condición desconocida nada/);
});

test('inserciones y referencias no permitidas', () => {
  assert.throws(() => validate(spec({ sections: [{ heading: 'Uno', paragraphs: ['{{marca}}'] }] })), /campo checkbox y no puede insertarse/);
  assert.throws(() => validate(spec({ derived: {
    a: { cases: [{ when: { field: 'marca', checked: true }, text: 'x' }], default: '' },
    b: { cases: [{ when: { field: 'marca', checked: true }, text: '{{a}}' }], default: '' },
  } })), /no puede usar otro derivado \{\{a\}\}/);
  assert.throws(() => validate(spec({ conditions: { a: { field: 'marca', checked: true }, b: { ref: 'a' } } })), /no puede usar ref/);
  const later = spec();
  later.fields[0].when = { field: 'texto', filled: true };
  assert.throws(() => validate(later), /texto debe declararse antes/);
});

test('identificadores repetidos entre campos, derivados y condiciones', () => {
  assert.throws(() => validate(spec({ conditions: { texto: { field: 'marca', checked: true } } })), /conditions\.texto no válido o duplicado/);
});

test('estructura de las condiciones', () => {
  const leaf = { field: 'marca', checked: true };
  assert.throws(() => validate(section({ all: [leaf] })), /necesita al menos 2 condiciones/);
  assert.throws(() => validate(section({ field: 'marca', checked: true, equals: 'x' })), /exactamente un operador/);
  assert.throws(() => validate(section({ field: 'marca', checked: true, extra: 1 })), /clave desconocida extra/);
  assert.throws(() => validate(section({ not: { not: { not: leaf } } })), /anidamiento máximo de 3 niveles/);
});

test('construcciones v2 bajo schema_version 1', () => {
  assert.throws(() => validate(spec({ schema_version: 1 })), /type checkbox: requiere schema_version 2/);
  const v1 = { ...example, sections: [{ heading: 'Uno', paragraphs: [{ text: 'x' }] }] };
  assert.throws(() => validate(v1), /requiere schema_version 2/);
});

test('secciones y párrafos inalcanzables', () => {
  assert.throws(() => validate(section({ all: [{ field: 'opinion', equals: 'Favorable' }, { field: 'opinion', equals: 'Con salvedades' }] })), /sections\[1\]: inalcanzable/);
  const paragraph = spec({ sections: [{ heading: 'Uno', paragraphs: ['{{opinion}} {{texto}}', { text: 'Nunca.', when: { all: [{ field: 'marca', checked: true }, { field: 'marca', checked: false }] } }] }] });
  assert.throws(() => validate(paragraph), /sections\[0\]\.paragraphs\[1\]: inalcanzable/);
});

test('avisos', () => {
  const unused = spec({ sections: [{ heading: 'Uno', paragraphs: ['{{opinion}} [1]'] }] });
  const warnings = lint(validate(unused));
  assert.ok(warnings.some(w => /campo marca: no se usa/.test(w)));
  assert.ok(warnings.some(w => /campo texto: no se usa/.test(w)));
  assert.ok(warnings.some(w => /marca del modelo \(\[1\]\)/.test(w)));
  const option = section({ field: 'opinion', equals: 'Favorable' });
  option.sections[0].paragraphs = ['{{texto}}'];
  option.fields = option.fields.filter(f => f.id !== 'marca');
  assert.ok(lint(validate(option)).some(w => /la opción "Con salvedades" no aparece/.test(w)));
  const many = Array.from({ length: 13 }, (_, i) => ({ id: `c${i}`, label: `C${i}`, type: 'checkbox' }));
  const big = spec({ fields: [{ id: 'texto', label: 'Texto', type: 'text' }, ...many], sections: [
    { heading: 'Uno', paragraphs: ['{{texto}}'] },
    { heading: 'Dos', when: { all: many.map(f => ({ field: f.id, checked: true })) }, paragraphs: ['x'] },
  ] });
  assert.ok(lint(validate(big)).some(w => /sections\[1\]: demasiadas combinaciones/.test(w)));
});
```

- [ ] **Step 2: Ejecutar y comprobar que fallan**

Run: `node --test tests/generar-documento/validator.test.mjs`
Expected: FAIL con `Cannot find module` sobre `bin/validar-plantilla.mjs`.

- [ ] **Step 3: Implementar el validador**

`skills/generar-documento-auditoria/bin/validar-plantilla.mjs`:

```js
// Validación de plantillas del asistente documental. Los errores detienen la generación;
// los avisos (`lint`) se muestran y la habilidad debe revisarlos.
import '../assets/evaluator.js';

const { evaluate, effectiveData } = globalThis.DocEvaluator;
const ID = /^[a-z][a-z0-9_]*$/;
const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;
const TYPES_V1 = ['text', 'textarea', 'date', 'select'];
const TYPES_V2 = [...TYPES_V1, 'checkbox', 'multiselect'];
const LEAF_OPS = ['equals', 'in', 'checked', 'includes', 'filled'];
const OPERATORS = [...LEAF_OPS, 'all', 'any', 'not', 'ref'];
const FIELD_OPS = {
  equals: ['select', 'text'],
  in: ['select', 'text'],
  checked: ['checkbox'],
  includes: ['multiselect'],
  filled: ['text', 'textarea', 'date', 'select', 'multiselect'],
};
const MAX_DEPTH = 3;
const MAX_COMBINATIONS = 4096;
const MARKERS = /\[●\]|X{3,}|\[\s*(?:Incluir|Adaptar)[^\]]*\]|\[\^?\d+\s*\]|\[\/?RECUADRO\]/i;
const own = (object, key) => Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);

export function fail(message) { throw new Error(message); }

function nonempty(value, path, max = 5000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${path}: texto obligatorio (máximo ${max} caracteres)`);
}

function plain(value) {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

export function suggest(value, options) {
  const target = plain(value);
  const exact = options.find(option => plain(option) === target);
  if (exact) return exact;
  let best = null;
  let bestDistance = Infinity;
  for (const option of options) {
    const d = distance(target, plain(option));
    if (d < bestDistance) { best = option; bestDistance = d; }
  }
  return bestDistance <= 3 ? best : null;
}

// Campos que lee una condición, expandiendo `ref`.
export function fieldsOf(condition, spec, out = new Set()) {
  if (!condition || typeof condition !== 'object') return out;
  if (Array.isArray(condition.all)) condition.all.forEach(item => fieldsOf(item, spec, out));
  else if (Array.isArray(condition.any)) condition.any.forEach(item => fieldsOf(item, spec, out));
  else if (own(condition, 'not')) fieldsOf(condition.not, spec, out);
  else if (own(condition, 'ref')) fieldsOf(spec.conditions?.[condition.ref], spec, out);
  else if (typeof condition.field === 'string') out.add(condition.field);
  return out;
}

function depthOf(condition, spec) {
  if (Array.isArray(condition.all)) return 1 + Math.max(...condition.all.map(item => depthOf(item, spec)));
  if (Array.isArray(condition.any)) return 1 + Math.max(...condition.any.map(item => depthOf(item, spec)));
  if (own(condition, 'not')) return 1 + depthOf(condition.not, spec);
  if (own(condition, 'ref')) return depthOf(spec.conditions[condition.ref], spec);
  return 1;
}

function checkCondition(condition, path, ctx, opts) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) fail(`${path}: condición no válida`);
  const keys = Object.keys(condition);
  const ops = keys.filter(key => OPERATORS.includes(key));
  if (ops.length !== 1) fail(`${path}: la condición debe tener exactamente un operador (${OPERATORS.join(', ')})`);
  const [op] = ops;
  const allowed = LEAF_OPS.includes(op) ? ['field', op] : [op];
  const extra = keys.find(key => !allowed.includes(key));
  if (extra) fail(`${path}: clave desconocida ${extra}`);
  if (opts.depth > MAX_DEPTH) fail(`${path}: anidamiento máximo de ${MAX_DEPTH} niveles`);
  if (op === 'all' || op === 'any') {
    if (!Array.isArray(condition[op]) || condition[op].length < 2) fail(`${path}.${op}: necesita al menos 2 condiciones`);
    condition[op].forEach((item, i) => checkCondition(item, `${path}.${op}[${i}]`, ctx, { ...opts, depth: opts.depth + 1 }));
    return;
  }
  if (op === 'not') return checkCondition(condition.not, `${path}.not`, ctx, { ...opts, depth: opts.depth + 1 });
  if (op === 'ref') {
    if (!opts.allowRef) fail(`${path}: una condición con nombre no puede usar ref`);
    if (typeof condition.ref !== 'string' || !own(ctx.spec.conditions, condition.ref)) fail(`${path}.ref: condición desconocida ${condition.ref}`);
    const target = ctx.spec.conditions[condition.ref];
    if (opts.depth - 1 + depthOf(target, ctx.spec) > MAX_DEPTH) fail(`${path}: anidamiento máximo de ${MAX_DEPTH} niveles (incluida la condición ${condition.ref})`);
    if (opts.before) {
      for (const id of fieldsOf(target, ctx.spec)) if (!opts.before.has(id)) fail(`${path}: la condición ${condition.ref} usa ${id}, que debe declararse antes de este campo`);
    }
    return;
  }
  const field = ctx.fields.get(condition.field);
  if (!field) fail(`${path}.field: campo desconocido ${condition.field}`);
  if (opts.before && !opts.before.has(field.id)) fail(`${path}.field: ${field.id} debe declararse antes del campo que lo usa en when`);
  if (!FIELD_OPS[op].includes(field.type)) fail(`${path}: el operador ${op} no se admite en campos ${field.type}`);
  const value = (v, p) => {
    if (typeof v !== 'string' || !v.trim()) fail(`${p}: valor no válido`);
    if (field.options && !field.options.includes(v)) {
      const hint = suggest(v, field.options);
      fail(`${p}: "${v}" no es una opción de ${field.id}${hint ? `. ¿Querías decir "${hint}"?` : ''}`);
    }
  };
  if (op === 'equals') value(condition.equals, `${path}.equals`);
  if (op === 'includes') value(condition.includes, `${path}.includes`);
  if (op === 'in') {
    if (!Array.isArray(condition.in) || !condition.in.length) fail(`${path}.in: necesita una lista no vacía`);
    condition.in.forEach((v, i) => value(v, `${path}.in[${i}]`));
  }
  if ((op === 'checked' || op === 'filled') && typeof condition[op] !== 'boolean') fail(`${path}.${op} debe ser booleano`);
}

function checkPlaceholders(text, path, ctx, allowDerived) {
  for (const [, id] of text.matchAll(PLACEHOLDER)) {
    const field = ctx.fields.get(id);
    if (field) {
      if (field.type === 'checkbox' || field.type === 'multiselect') fail(`${path}: {{${id}}} es un campo ${field.type} y no puede insertarse como texto`);
      continue;
    }
    if (own(ctx.spec.derived, id)) {
      if (!allowDerived) fail(`${path}: un texto derivado no puede usar otro derivado {{${id}}}`);
      continue;
    }
    if (own(ctx.spec.conditions, id)) fail(`${path}: {{${id}}} es una condición y no puede insertarse como texto`);
    fail(`${path}: campo desconocido {{${id}}}`);
  }
}

function checkField(field, i, ctx) {
  const path = `fields[${i}]`;
  if (!field || typeof field !== 'object') fail(`${path} debe ser un objeto`);
  nonempty(field.label, `${path}.label`, 120);
  if (!TYPES_V2.includes(field.type)) fail(`${path}.type no válido`);
  if (!TYPES_V1.includes(field.type)) ctx.needV2(`${path}.type ${field.type}`);
  if (field.required !== undefined && typeof field.required !== 'boolean') fail(`${path}.required debe ser booleano`);
  if (field.help !== undefined) nonempty(field.help, `${path}.help`, 400);
  if (field.type === 'select' || field.type === 'multiselect') {
    const options = field.options;
    if (!Array.isArray(options) || !options.length || options.some(x => typeof x !== 'string' || !x.trim()) || new Set(options).size !== options.length) fail(`${path}.options no válido`);
  } else if (field.type === 'checkbox' && field.options !== undefined) fail(`${path}: un checkbox no admite options`);
  if (field.value !== undefined) {
    if (field.type === 'checkbox') { if (typeof field.value !== 'boolean') fail(`${path}.value debe ser booleano`); }
    else if (field.type === 'multiselect') { if (!Array.isArray(field.value) || field.value.some(x => !field.options.includes(x))) fail(`${path}.value debe ser una lista de opciones`); }
    else if (typeof field.value !== 'string') fail(`${path}.value debe ser texto`);
  }
  if (field.when !== undefined) ctx.needV2(`${path}.when`);
}

export function validate(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) fail('El documento debe ser un objeto JSON');
  if (spec.schema_version !== 1 && spec.schema_version !== 2) fail('schema_version debe ser 1 o 2');
  const v2 = spec.schema_version === 2;
  const max = v2 ? 80 : 50;
  const fields = new Map();
  const names = new Set();
  const ctx = { spec, fields, needV2: path => { if (!v2) fail(`${path}: requiere schema_version 2`); } };
  const claim = (id, path) => {
    if (typeof id !== 'string' || !ID.test(id) || names.has(id)) fail(`${path} no válido o duplicado`);
    names.add(id);
  };
  nonempty(spec.title, 'title', 180);
  if (spec.subtitle !== undefined) nonempty(spec.subtitle, 'subtitle', 220);
  if (!Array.isArray(spec.fields) || spec.fields.length < 1 || spec.fields.length > max) fail(`fields debe contener entre 1 y ${max} campos`);
  for (const [i, field] of spec.fields.entries()) {
    if (!field || typeof field !== 'object') fail(`fields[${i}] debe ser un objeto`);
    claim(field.id, `fields[${i}].id`);
    checkField(field, i, ctx);
    fields.set(field.id, field);
  }
  for (const [key, label] of [['conditions', 'conditions'], ['derived', 'derived']]) {
    if (spec[key] === undefined) continue;
    ctx.needV2(label);
    if (!spec[key] || typeof spec[key] !== 'object' || Array.isArray(spec[key])) fail(`${label} debe ser un objeto`);
    for (const name of Object.keys(spec[key])) claim(name, `${label}.${name}`);
  }
  for (const [name, condition] of Object.entries(spec.conditions || {})) {
    checkCondition(condition, `conditions.${name}`, ctx, { depth: 1, allowRef: false });
  }
  const before = new Set();
  for (const [i, field] of spec.fields.entries()) {
    if (field.when !== undefined) checkCondition(field.when, `fields[${i}].when`, ctx, { depth: 1, allowRef: true, before });
    before.add(field.id);
  }
  for (const [id, definition] of Object.entries(spec.derived || {})) {
    const path = `derived.${id}`;
    if (!definition || typeof definition !== 'object' || !Array.isArray(definition.cases) || !definition.cases.length) fail(`${path}.cases debe ser una lista no vacía`);
    if (typeof definition.default !== 'string' || definition.default.length > 2000) fail(`${path}.default debe ser texto (puede estar vacío)`);
    checkPlaceholders(definition.default, `${path}.default`, ctx, false);
    for (const [j, item] of definition.cases.entries()) {
      if (!item || typeof item !== 'object') fail(`${path}.cases[${j}] debe ser un objeto`);
      nonempty(item.text, `${path}.cases[${j}].text`, 2000);
      checkPlaceholders(item.text, `${path}.cases[${j}].text`, ctx, false);
      checkCondition(item.when, `${path}.cases[${j}].when`, ctx, { depth: 1, allowRef: true });
    }
  }
  checkPlaceholders(spec.title, 'title', ctx, true);
  if (spec.subtitle !== undefined) checkPlaceholders(spec.subtitle, 'subtitle', ctx, true);
  if (!Array.isArray(spec.sections) || spec.sections.length < 1 || spec.sections.length > max) fail(`sections debe contener entre 1 y ${max} secciones`);
  for (const [i, section] of spec.sections.entries()) {
    const path = `sections[${i}]`;
    if (!section || typeof section !== 'object') fail(`${path} debe ser un objeto`);
    nonempty(section.heading, `${path}.heading`, 180);
    checkPlaceholders(section.heading, `${path}.heading`, ctx, true);
    if (!Array.isArray(section.paragraphs) || !section.paragraphs.length || section.paragraphs.length > 50) fail(`${path}.paragraphs no válido`);
    for (const [j, paragraph] of section.paragraphs.entries()) {
      const p = `${path}.paragraphs[${j}]`;
      if (typeof paragraph === 'string') {
        nonempty(paragraph, p, 10000);
        checkPlaceholders(paragraph, p, ctx, true);
        continue;
      }
      ctx.needV2(`${p} (párrafo con condición)`);
      if (!paragraph || typeof paragraph !== 'object' || Object.keys(paragraph).some(key => key !== 'text' && key !== 'when')) fail(`${p}: debe ser texto o { text, when }`);
      nonempty(paragraph.text, `${p}.text`, 10000);
      checkPlaceholders(paragraph.text, `${p}.text`, ctx, true);
      if (paragraph.when !== undefined) checkCondition(paragraph.when, `${p}.when`, ctx, { depth: 1, allowRef: true });
    }
    if (section.when !== undefined) {
      if (!v2 && (!section.when || typeof section.when !== 'object' || Object.keys(section.when).sort().join() !== 'equals,field')) fail(`${path}.when no válido`);
      checkCondition(section.when, `${path}.when`, ctx, { depth: 1, allowRef: true });
    }
  }
  if (spec.sources !== undefined) {
    if (!Array.isArray(spec.sources) || spec.sources.length > 20) fail('sources debe ser una lista de hasta 20 fuentes');
    for (const [i, source] of spec.sources.entries()) {
      nonempty(source?.title, `sources[${i}].title`, 250);
      try { if (new URL(source.url).protocol !== 'https:') fail('Se exige URL HTTPS'); }
      catch { fail(`sources[${i}].url debe ser una URL HTTPS`); }
    }
  }
  if (spec.include_sources_in_output !== undefined && typeof spec.include_sources_in_output !== 'boolean') fail('include_sources_in_output debe ser booleano');
  const { unreachable } = reachability(spec);
  if (unreachable.length) fail(`${unreachable[0]}: inalcanzable; ninguna combinación de respuestas puede mostrarlo`);
  return spec;
}

// --- Alcanzabilidad ---------------------------------------------------------

function allConditions(spec) {
  const out = [];
  for (const condition of Object.values(spec.conditions || {})) out.push(condition);
  for (const field of spec.fields) if (field.when) out.push(field.when);
  for (const definition of Object.values(spec.derived || {})) for (const item of definition.cases) out.push(item.when);
  for (const section of spec.sections) {
    if (section.when) out.push(section.when);
    for (const paragraph of section.paragraphs) if (typeof paragraph === 'object' && paragraph.when) out.push(paragraph.when);
  }
  return out;
}

function citedValues(spec, id) {
  const values = new Set();
  const walk = condition => {
    if (!condition || typeof condition !== 'object') return;
    if (Array.isArray(condition.all)) return condition.all.forEach(walk);
    if (Array.isArray(condition.any)) return condition.any.forEach(walk);
    if (own(condition, 'not')) return walk(condition.not);
    if (condition.field !== id) return;
    if (typeof condition.equals === 'string') values.add(condition.equals);
    if (typeof condition.includes === 'string') values.add(condition.includes);
    if (Array.isArray(condition.in)) condition.in.forEach(v => values.add(v));
  };
  allConditions(spec).forEach(walk);
  return [...values];
}

function involved(spec, conditions) {
  const out = new Set();
  conditions.forEach(condition => fieldsOf(condition, spec, out));
  let grew = true;
  while (grew) {
    grew = false;
    for (const field of spec.fields) {
      if (!out.has(field.id) || !field.when) continue;
      for (const id of fieldsOf(field.when, spec)) if (!out.has(id)) { out.add(id); grew = true; }
    }
  }
  return spec.fields.filter(field => out.has(field.id));
}

function domain(field, spec) {
  if (field.type === 'checkbox') return [false, true];
  if (field.type === 'select') return ['', ...field.options];
  if (field.type === 'text') return ['', ...citedValues(spec, field.id), '\u0000otro'];
  if (field.type === 'multiselect') {
    const cited = citedValues(spec, field.id);
    return Array.from({ length: 2 ** cited.length }, (_, mask) => cited.filter((_, bit) => mask & (1 << bit)));
  }
  return ['', 'x'];
}

// true = alcanzable, false = inalcanzable, null = demasiadas combinaciones.
function reachable(spec, conditions) {
  const vars = involved(spec, conditions);
  const domains = vars.map(field => domain(field, spec));
  if (domains.reduce((total, values) => total * values.length, 1) > MAX_COMBINATIONS) return null;
  const index = domains.map(() => 0);
  for (;;) {
    const raw = {};
    vars.forEach((field, k) => { raw[field.id] = domains[k][index[k]]; });
    const { data } = effectiveData(spec, raw);
    if (conditions.every(condition => evaluate(condition, data, spec))) return true;
    let k = 0;
    while (k < index.length && ++index[k] === domains[k].length) { index[k] = 0; k++; }
    if (k === index.length) return false;
  }
}

export function reachability(spec) {
  const unreachable = [];
  const skipped = [];
  for (const [i, section] of spec.sections.entries()) {
    const base = section.when ? [section.when] : [];
    const guarded = section.paragraphs.map(p => (typeof p === 'object' && p.when ? p.when : null));
    const paragraphResults = guarded.map(when => {
      if (when !== null) return reachable(spec, [...base, when]);
      return base.length ? reachable(spec, base) : true;
    });
    if (paragraphResults.some(result => result === true)) {
      paragraphResults.forEach((result, j) => {
        if (result === false) unreachable.push(`sections[${i}].paragraphs[${j}]`);
        if (result === null) skipped.push(`sections[${i}].paragraphs[${j}]`);
      });
    } else if (paragraphResults.some(result => result === null)) skipped.push(`sections[${i}]`);
    else unreachable.push(`sections[${i}]`);
  }
  return { unreachable, skipped };
}

// --- Avisos -----------------------------------------------------------------

function texts(spec) {
  const out = [['title', spec.title]];
  if (spec.subtitle) out.push(['subtitle', spec.subtitle]);
  for (const [id, definition] of Object.entries(spec.derived || {})) {
    out.push([`derived.${id}.default`, definition.default]);
    definition.cases.forEach((item, j) => out.push([`derived.${id}.cases[${j}].text`, item.text]));
  }
  spec.sections.forEach((section, i) => {
    out.push([`sections[${i}].heading`, section.heading]);
    section.paragraphs.forEach((p, j) => out.push([`sections[${i}].paragraphs[${j}]`, typeof p === 'string' ? p : p.text]));
  });
  return out;
}

export function lint(spec) {
  const warnings = [];
  const inserted = new Set();
  for (const [path, text] of texts(spec)) {
    for (const [, id] of text.matchAll(PLACEHOLDER)) inserted.add(id);
    const marker = text.match(MARKERS);
    if (marker) warnings.push(`${path}: parece contener una marca del modelo (${marker[0]}); conviértela en campo o condición, o elimínala`);
  }
  const conditioned = new Set();
  allConditions(spec).forEach(condition => fieldsOf(condition, spec, conditioned));
  for (const field of spec.fields) {
    if (!inserted.has(field.id) && !conditioned.has(field.id)) warnings.push(`campo ${field.id}: no se usa en ningún texto ni condición`);
    if (field.options && conditioned.has(field.id) && !inserted.has(field.id)) {
      const cited = new Set(citedValues(spec, field.id));
      for (const option of field.options) if (!cited.has(option)) warnings.push(`campo ${field.id}: la opción "${option}" no aparece en ninguna condición`);
    }
  }
  for (const path of reachability(spec).skipped) warnings.push(`${path}: demasiadas combinaciones para comprobar si es alcanzable; revísalo a mano`);
  return warnings;
}
```

- [ ] **Step 4: Conectar la CLI al nuevo validador**

Sustituye el contenido completo de `skills/generar-documento-auditoria/bin/generar-documento.mjs` por este (elimina la validación v1, reexporta `validate`/`lint`, imprime los avisos y usa funciones de reemplazo para que un `$` del runtime no se interprete como patrón):

```js
#!/usr/bin/env node
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { validate, lint, fail } from './validar-plantilla.mjs';

export { validate, lint };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function safeJson(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, char => ({'<':'\\u003c','>':'\\u003e','&':'\\u0026','\u2028':'\\u2028','\u2029':'\\u2029'})[char]);
}

export async function render(spec, outputPath) {
  validate(spec);
  const template = await readFile(join(ROOT, 'assets', 'assistant.html'), 'utf8');
  const runtime = await readFile(join(ROOT, 'assets', 'assistant-runtime.js'), 'utf8');
  const logo = await readFile(join(ROOT, 'assets', 'icjce-logo.png'));
  const html = template.replace('/*__RUNTIME__*/', () => runtime).replace('/*__SPEC__*/', `const spec = ${safeJson(spec)};`)
    .replace('/*__LOGO__*/', `data:image/png;base64,${logo.toString('base64')}`);
  if (html === template || ['/*__RUNTIME__*/', '/*__SPEC__*/', '/*__LOGO__*/'].some(token => html.includes(token))) fail('No se pudieron insertar los recursos del asistente');
  const target = resolve(outputPath);
  const temporary = `${target}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, html, { encoding: 'utf8', flag: 'wx' }); await rename(temporary, target); }
  catch (error) { await unlink(temporary).catch(() => {}); throw error; }
  return target;
}

async function main() {
  const [command, source, output] = process.argv.slice(2);
  if (!['validate', 'render'].includes(command) || !source || (command === 'render' && !output)) {
    console.error('Uso: node bin/generar-documento.mjs validate <plantilla.json>\n     node bin/generar-documento.mjs render <plantilla.json> <salida.html>');
    process.exitCode = 2;
    return;
  }
  const spec = validate(JSON.parse(await readFile(resolve(source), 'utf8')));
  for (const warning of lint(spec)) console.log(`Aviso: ${warning}`);
  if (command === 'validate') console.log(`Plantilla válida: ${spec.title}`);
  else console.log(await render(spec, output));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
```

- [ ] **Step 5: Ejecutar pruebas y CLI**

Run: `node --test tests/generar-documento/*.test.mjs`
Expected: `# pass 17`, `# fail 0`.

Run: `node skills/generar-documento-auditoria/bin/generar-documento.mjs validate skills/generar-documento-auditoria/examples/carta-encargo.json`
Expected:
```text
Aviso: campo tipo: la opción "Auditoría de cuentas anuales" no aparece en ninguna condición
Plantilla válida: Carta de encargo de auditoría
```

- [ ] **Step 6: Commit**

```bash
git add skills/generar-documento-auditoria/bin/validar-plantilla.mjs skills/generar-documento-auditoria/bin/generar-documento.mjs tests/generar-documento/validator.test.mjs
git commit -m "Validate v2 document templates with conditions and derived texts"
```

```json:metadata
{"files": ["skills/generar-documento-auditoria/bin/validar-plantilla.mjs", "skills/generar-documento-auditoria/bin/generar-documento.mjs", "tests/generar-documento/validator.test.mjs"], "verifyCommand": "node --test tests/generar-documento/validator.test.mjs", "acceptanceCriteria": ["node --test tests/generar-documento/validator.test.mjs reports # pass 10 and # fail 0", "option typo error suggests the closest option", "contradictory section condition reports sections[1]: inalcanzable", "CLI validate on carta-encargo.json prints Plantilla válida"], "modelTier": "mechanical"}
```

---

### Task 3: Runtime del navegador y renderizado

**Goal:** Incrustar el evaluador en el HTML y reescribir la parte de formulario y vista previa del runtime para valores con tipo, casillas, grupos de opciones y campos condicionales, delegando todo en `buildModel`.

**Files:**
- Modify: `skills/generar-documento-auditoria/assets/assistant.html:36-37` (estilos) y `:83-84` (hueco del evaluador)
- Modify: `skills/generar-documento-auditoria/assets/assistant-runtime.js:1-117` (todo lo anterior a `const xml = value =>`)
- Modify: `skills/generar-documento-auditoria/bin/generar-documento.mjs` (función `render`)
- Test: `tests/generar-documento/render.test.mjs`

**Acceptance Criteria:**
- [ ] `node --test tests/generar-documento/*.test.mjs` termina con `# pass 21` y `# fail 0`.
- [ ] `carta-encargo.json` produce exactamente el documento de referencia de la prueba `la plantilla v1 genera el mismo documento que antes`.
- [ ] En el HTML de la plantilla de prueba, abierto en el navegador: el campo «Fundamento…» está oculto al inicio y aparece al elegir «Con salvedades»; con las respuestas del paso 6, el estado muestra `6 de 6 secciones incluidas según tus respuestas` y «Generar documento» pasa al paso 2.
- [ ] `docxXml()` y `zip()` no cambian (`git diff` de `assistant-runtime.js` no toca líneas a partir de `const xml = value =>`).

**Verify:** `node --test tests/generar-documento/*.test.mjs` → `# pass 21`, `# fail 0`

**Steps:**

- [ ] **Step 1: Escribir las pruebas de renderizado**

`tests/generar-documento/render.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { render } from '../../skills/generar-documento-auditoria/bin/generar-documento.mjs';
import '../../skills/generar-documento-auditoria/assets/evaluator.js';

const { buildModel } = globalThis.DocEvaluator;
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const example = await read('../../skills/generar-documento-auditoria/examples/carta-encargo.json');
const fixture = await read('./fixtures/comunicacion-gobierno.v2.json');
const plain = ({ title, subtitle, sections, sources }) => ({ title, subtitle, sections, sources });

test('la plantilla v1 genera el mismo documento que antes', () => {
  const data = { entidad: 'ACME, S.A.', destinatario: 'el Consejo', fecha_cierre: '2026-12-31', auditor: 'Auditora, S.L.', alcance: 'Cuentas anuales', tipo: 'Otro encargo' };
  assert.deepEqual(plain(buildModel(example, data)), {
    title: 'Carta de encargo de auditoría',
    subtitle: 'Ejercicio terminado el 2026-12-31',
    sections: [
      { heading: 'Destinatario', paragraphs: ['A la atención de el Consejo de ACME, S.A..'] },
      { heading: 'Objeto del encargo', paragraphs: ['Se documenta el encargo de auditoría de ACME, S.A. correspondiente al ejercicio terminado el 2026-12-31.', 'Alcance acordado: Cuentas anuales'] },
      { heading: 'Identificación del auditor', paragraphs: ['Auditor o firma: Auditora, S.L..'] },
      { heading: 'Tipo de trabajo', paragraphs: ['El tipo de encargo indicado requiere revisar y adaptar todas las cláusulas antes de su firma.'] },
    ],
    sources: [],
  });
  assert.equal(buildModel(example, { ...data, tipo: 'Auditoría de cuentas anuales' }).sections.length, 3);
});

const base = { entidad: 'Prueba', ejercicio: '2026', organo: 'Consejo', incertidumbre: false, asuntos: [], encargante: '' };

test('plantilla v2: no EIP, opinión favorable', () => {
  const model = buildModel(fixture, { ...base, forma: 'S.L.', eip: 'No', opinion: 'Favorable', fundamento: 'oculto' });
  assert.equal(model.title, 'Comunicación de prueba a Consejo');
  assert.equal(model.subtitle, 'Prueba · ejercicio 2026');
  assert.deepEqual(model.sections, [
    { heading: 'Introducción', paragraphs: ['Texto de prueba dirigido a los socios de Prueba.'] },
    { heading: 'Opinión', paragraphs: ['Texto de prueba de opinión favorable.'] },
  ]);
  assert.deepEqual(model.stats, { included: 2, total: 6 });
});

test('plantilla v2: EIP con salvedades, incertidumbre y fraude', () => {
  const model = buildModel(fixture, { ...base, forma: 'S.A.', eip: 'Sí', opinion: 'Con salvedades', fundamento: 'Limitación X', incertidumbre: true, asuntos: ['Indicios de fraude'], encargante: 'Banco Y' });
  assert.deepEqual(model.sections.map(s => s.heading), ['Introducción', 'Opinión', 'Incertidumbre material', 'Asuntos comunicados', 'Requisitos EIP', 'Cierre']);
  assert.deepEqual(model.sections[0].paragraphs, ['Texto de prueba dirigido a los accionistas de Prueba por encargo de Banco Y.']);
  assert.deepEqual(model.sections[1].paragraphs, ['Texto de prueba de opinión modificada: Limitación X']);
  assert.deepEqual(model.sections[3].paragraphs, ['Texto de prueba sobre fraude.']);
});

test('el HTML incrusta evaluador, runtime y plantilla', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asistente-'));
  try {
    const html = await readFile(await render(fixture, join(dir, 'asistente.html')), 'utf8');
    assert.match(html, /globalThis\.DocEvaluator|root\.DocEvaluator = /);
    assert.match(html, /const spec = \{"schema_version":2/);
    for (const token of ['/*__EVALUATOR__*/', '/*__RUNTIME__*/', '/*__SPEC__*/', '/*__LOGO__*/']) assert.ok(!html.includes(token), token);
    assert.ok(html.indexOf('root.DocEvaluator = ') < html.indexOf('globalThis.DocEvaluator;'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla la prueba del HTML**

Run: `node --test tests/generar-documento/render.test.mjs`
Expected: 3 pruebas pasan y falla `el HTML incrusta evaluador, runtime y plantilla` (no aparece `root.DocEvaluator = `).

- [ ] **Step 3: Incrustar el evaluador en `render`**

En `skills/generar-documento-auditoria/bin/generar-documento.mjs`, dentro de `render`, sustituye:

```js
  const runtime = await readFile(join(ROOT, 'assets', 'assistant-runtime.js'), 'utf8');
```
por:
```js
  const evaluator = await readFile(join(ROOT, 'assets', 'evaluator.js'), 'utf8');
  const runtime = await readFile(join(ROOT, 'assets', 'assistant-runtime.js'), 'utf8');
```
sustituye `template.replace('/*__RUNTIME__*/', () => runtime)` por:
```js
template.replace('/*__EVALUATOR__*/', () => evaluator).replace('/*__RUNTIME__*/', () => runtime)
```
y la lista de comprobación `['/*__RUNTIME__*/', '/*__SPEC__*/', '/*__LOGO__*/']` por:
```js
['/*__EVALUATOR__*/', '/*__RUNTIME__*/', '/*__SPEC__*/', '/*__LOGO__*/']
```

- [ ] **Step 4: Añadir el hueco y los estilos en `assistant.html`**

Sustituye:
```html
    /*__SPEC__*/
    /*__RUNTIME__*/
```
por:
```html
    /*__SPEC__*/
    /*__EVALUATOR__*/
    /*__RUNTIME__*/
```
e inserta justo antes de la línea `    .field .help { margin:5px 0 0; color:var(--muted); font-size:12px; }`:
```css
    .field input[type="checkbox"] { width:auto; margin:3px 0 0; flex:none; }
    .field label.check { display:flex; gap:8px; align-items:flex-start; font-weight:600; margin:6px 0; }
    fieldset.field { border:0; padding:0; min-width:0; }
    fieldset.field legend { font-weight:700; padding:0; margin-bottom:6px; }
    fieldset.field legend span { color:var(--warn); }
```

- [ ] **Step 5: Reescribir el formulario y la vista previa del runtime**

En `skills/generar-documento-auditoria/assets/assistant-runtime.js`, sustituye todo desde la primera línea `(() => {` hasta la línea anterior a `  const xml = value => …` (exclusive) por:

```js
(() => {
  'use strict';
  const { buildModel, effectiveData, isEmpty } = globalThis.DocEvaluator;
  const byId = id => document.getElementById(id);
  const form = byId('data-form');
  const wrappers = {};
  let finalDocument = null;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const collect = () => {
    const data = {};
    for (const field of spec.fields) {
      if (field.type === 'checkbox') data[field.id] = byId(`field-${field.id}`).checked;
      else if (field.type === 'multiselect') data[field.id] = [...form.querySelectorAll(`input[name="${field.id}"]:checked`)].map(input => input.value);
      else data[field.id] = byId(`field-${field.id}`).value;
    }
    return data;
  };
  const model = (data, markMissing = false) => buildModel(spec, data, { markMissing });
  const missingRequired = data => {
    const { data: effective, visible } = effectiveData(spec, data);
    return spec.fields.filter(field => field.required && visible[field.id] && isEmpty(field, effective[field.id]));
  };

  function showStep(step) {
    byId('step-1').hidden = step !== 1;
    byId('step-2').hidden = step !== 2;
    for (const button of document.querySelectorAll('[data-step]')) {
      if (Number(button.dataset.step) === step) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
    byId('preview-title').textContent = step === 1 ? 'Vista previa' : 'Documento generado';
    byId('preview-hint').textContent = step === 1 ? 'Se actualiza al escribir' : 'Revisa el texto antes de exportar';
    renderPreview(step === 2 ? finalDocument : null);
  }

  function renderPreview(documentModel = null) {
    const data = collect();
    const { visible } = effectiveData(spec, data);
    for (const field of spec.fields) wrappers[field.id].hidden = !visible[field.id];
    const preview = byId('preview');
    preview.replaceChildren();
    const output = documentModel || model(data, true);
    preview.append(element('h2', '', output.title));
    if (output.subtitle) preview.append(element('p', 'subtitle', output.subtitle));
    for (const section of output.sections) {
      preview.append(element('h3', '', section.heading));
      for (const paragraph of section.paragraphs) preview.append(element('p', '', paragraph));
    }
    if (output.sources.length) {
      preview.append(element('h3', '', 'Fuentes'));
      for (const source of output.sources) preview.append(element('p', '', `${source.title}: ${source.url}`));
    }
    preview.append(element('p', 'draft-note', 'Documento de trabajo sujeto a revisión profesional.'));
    const required = spec.fields.filter(field => field.required && visible[field.id]);
    const missing = missingRequired(data).length;
    const complete = required.length - missing;
    byId('progress-fill').style.width = `${required.length ? Math.round(complete / required.length * 100) : 100}%`;
    byId('progress-text').textContent = `${complete} de ${required.length} campos obligatorios completados`;
    byId('preview-status').textContent = documentModel ? 'Listo para exportar' : `${output.stats.included} de ${output.stats.total} secciones incluidas según tus respuestas`;
  }

  function checkLabel(input, text) {
    const label = element('label', 'check');
    label.append(input, document.createTextNode(` ${text}`));
    return label;
  }

  for (const field of spec.fields) {
    const wrapper = element(field.type === 'multiselect' ? 'fieldset' : 'div', 'field');
    wrappers[field.id] = wrapper;
    if (field.type === 'checkbox') {
      const input = element('input');
      input.type = 'checkbox';
      input.id = `field-${field.id}`;
      input.name = field.id;
      input.checked = field.value === true;
      const label = checkLabel(input, field.label);
      if (field.required) label.append(element('span', '', ' *'));
      wrapper.append(label);
    } else if (field.type === 'multiselect') {
      wrapper.id = `field-${field.id}`;
      const legend = element('legend', '', field.label);
      if (field.required) legend.append(element('span', '', ' *'));
      wrapper.append(legend);
      for (const [k, option] of field.options.entries()) {
        const input = element('input');
        input.type = 'checkbox';
        input.id = `field-${field.id}-${k}`;
        input.name = field.id;
        input.value = option;
        input.checked = Array.isArray(field.value) && field.value.includes(option);
        wrapper.append(checkLabel(input, option));
      }
    } else {
      const label = element('label', '', field.label);
      label.htmlFor = `field-${field.id}`;
      if (field.required) label.append(element('span', '', ' *'));
      let input;
      if (field.type === 'textarea') input = element('textarea');
      else if (field.type === 'select') {
        input = element('select');
        const empty = element('option', '', 'Selecciona una opción');
        empty.value = '';
        input.append(empty);
        for (const option of field.options) {
          const item = element('option', '', option);
          item.value = option;
          input.append(item);
        }
      } else input = element('input');
      if (field.type !== 'select' && field.type !== 'textarea') input.type = field.type;
      input.id = `field-${field.id}`;
      input.name = field.id;
      input.required = Boolean(field.required);
      input.value = field.value || '';
      if (field.type === 'textarea') input.rows = 4;
      wrapper.append(label, input);
    }
    if (field.help) wrapper.append(element('p', 'help', field.help));
    form.append(wrapper);
  }
  byId('app-title').textContent = spec.title;
  byId('app-subtitle').textContent = spec.subtitle || 'Rellena los datos y genera el documento';
  const sourceList = byId('source-list');
  for (const source of spec.sources || []) {
    const item = element('li');
    const link = element('a', '', source.title);
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    item.append(link);
    sourceList.append(item);
  }
  byId('sources-wrap').hidden = !sourceList.childElementCount;

  form.addEventListener('input', () => { finalDocument = null; renderPreview(); });
  form.addEventListener('change', () => { finalDocument = null; renderPreview(); });
  byId('generate-button').addEventListener('click', () => {
    const data = collect();
    const [first] = missingRequired(data);
    if (first) {
      const input = first.type === 'multiselect' ? form.querySelector(`input[name="${first.id}"]`) : byId(`field-${first.id}`);
      input.setCustomValidity('Completa este campo');
      input.reportValidity();
      input.focus();
      input.setCustomValidity('');
      return;
    }
    finalDocument = model(data);
    byId('review-summary').textContent = 'Documento generado. Comprueba el contenido y descarga el formato que necesites.';
    showStep(2);
  });
  document.querySelector('[data-next="1"]').addEventListener('click', () => showStep(1));
  document.querySelector('[data-step="1"]').addEventListener('click', () => showStep(1));
  document.querySelector('[data-step="2"]').addEventListener('click', () => { if (finalDocument) showStep(2); });
```

El resto del archivo (`xml`, `paragraphXml`, `docxXml`, `zip`, `docx`, botones DOCX/PDF y `showStep(1);`) queda igual.

Run: `node --check skills/generar-documento-auditoria/assets/assistant-runtime.js && node --test tests/generar-documento/*.test.mjs`
Expected: sin errores de sintaxis; `# pass 21`, `# fail 0`.

- [ ] **Step 6: Comprobar en el navegador**

```bash
node skills/generar-documento-auditoria/bin/generar-documento.mjs render tests/generar-documento/fixtures/comunicacion-gobierno.v2.json "$TMPDIR/v2.html"
python3 -m http.server 8765 --bind 127.0.0.1 --directory "$TMPDIR"
```

Abre `http://127.0.0.1:8765/v2.html` en el navegador integrado (`mcp__Claude_Browser__navigate`) y ejecuta con `javascript_tool`:

```js
const v = id => document.getElementById(id);
const set = (id, val) => { const e = v('field-' + id); e.value = val; e.dispatchEvent(new Event('input', { bubbles: true })); };
const sel = (id, val) => { const e = v('field-' + id); e.value = val; e.dispatchEvent(new Event('change', { bubbles: true })); };
const r = { hidden0: v('field-fundamento').closest('.field').hidden, status0: v('preview-status').textContent };
set('entidad', 'Prueba'); set('ejercicio', '2026'); set('organo', 'Consejo');
sel('forma', 'S.A.'); sel('eip', 'Sí'); sel('opinion', 'Con salvedades');
r.hidden1 = v('field-fundamento').closest('.field').hidden;
set('fundamento', 'Limitación X');
v('field-incertidumbre').click();
document.querySelector('input[name="asuntos"][value="Indicios de fraude"]').click();
r.status = v('preview-status').textContent;
v('generate-button').click();
r.step2 = !v('step-2').hidden;
r;
```

Expected: `hidden0: true`, `status0: "2 de 6 secciones incluidas según tus respuestas"`, `hidden1: false`, `status: "6 de 6 secciones incluidas según tus respuestas"`, `step2: true`. Haz una captura del formulario y comprueba que las casillas no ocupan todo el ancho. Detén el servidor al terminar.

- [ ] **Step 7: Commit**

```bash
git add skills/generar-documento-auditoria/assets/assistant-runtime.js skills/generar-documento-auditoria/assets/assistant.html skills/generar-documento-auditoria/bin/generar-documento.mjs tests/generar-documento/render.test.mjs
git commit -m "Render checkboxes, multiselects and conditional fields in document assistant"
```

```json:metadata
{"files": ["skills/generar-documento-auditoria/assets/assistant-runtime.js", "skills/generar-documento-auditoria/assets/assistant.html", "skills/generar-documento-auditoria/bin/generar-documento.mjs", "tests/generar-documento/render.test.mjs"], "verifyCommand": "node --test tests/generar-documento/*.test.mjs", "acceptanceCriteria": ["node --test tests/generar-documento/*.test.mjs reports # pass 21 and # fail 0", "carta-encargo.json reproduces the reference v1 document", "browser check: fundamento hidden then shown, status 6 de 6 secciones, generate reaches step 2", "docxXml and zip unchanged"], "modelTier": "standard"}
```

---

### Task 4: Documentación de la habilidad y validación del repositorio

**Goal:** Documentar el formato v2 y la traducción de marcas de cualquier modelo, y hacer que `scripts/validate.py` ejecute las pruebas de Node.

**Files:**
- Modify: `skills/generar-documento-auditoria/references/esquema-json.md` (reescritura completa)
- Modify: `skills/generar-documento-auditoria/references/analisis-modelo.md` (tabla del inventario, nuevo apartado 4, apartado 5 renumerado)
- Modify: `skills/generar-documento-auditoria/SKILL.md` (cuatro frases)
- Modify: `scripts/validate.py:65-70`

**Acceptance Criteria:**
- [ ] `python3 scripts/validate.py` termina con la línea `OK: …` tras ejecutar las 21 pruebas de Node.
- [ ] `references/analisis-modelo.md` tiene los apartados `## 1.` a `## 5.`, y el 4 se titula «Reconocer la variación del modelo».
- [ ] `SKILL.md` menciona `schema_version: 2` y remite al apartado 4 de `references/analisis-modelo.md`.

**Verify:** `python3 scripts/validate.py` → última línea empieza por `OK:`

**Steps:**

- [ ] **Step 1: Reescribir `references/esquema-json.md`**

Sustituye el contenido completo por:

```markdown
# Plantilla JSON del asistente

La plantilla es un objeto JSON. El renderizador valida la estructura antes de crear el HTML. Construye `fields` y `sections` después de buscar el modelo con `buscar_modelos_informe`, leerlo con `leer_documento` y completar el inventario de `references/analisis-modelo.md`.

Usa `schema_version: 2` cuando el modelo tenga variación (cláusulas opcionales, alternativas, fragmentos que cambian dentro de la frase). La versión 1 sigue siendo válida para plantillas sin variación o con una sola alternativa por sección.

| Propiedad | Tipo | Uso |
|---|---|---|
| `schema_version` | `1` o `2` | Versión del formato. Lo marcado «v2» exige `2`. |
| `title` | texto | Título del documento. Admite `{{id}}`. |
| `subtitle` | texto opcional | Subtítulo. Admite `{{id}}`. |
| `fields` | lista de objetos | Entre 1 y 50 campos (80 en v2). |
| `conditions` | objeto opcional (v2) | Condiciones con nombre reutilizables. |
| `derived` | objeto opcional (v2) | Textos derivados para lo que cambia dentro de la frase. |
| `sections` | lista de objetos | Entre 1 y 50 secciones (80 en v2). |
| `sources` | lista opcional | Hasta 20 objetos `{ "title": "…", "url": "https://…" }`. |
| `include_sources_in_output` | booleano opcional | Si es `true`, añade las fuentes al documento; por defecto solo se muestran en la interfaz. |

## Campos

Cada campo usa `id` único en minúsculas (`[a-z][a-z0-9_]*`), `label` y `type`. Puede tener `required` (booleano), `value` (valor inicial) y `help` (texto de ayuda).

| `type` | Valor | Notas |
|---|---|---|
| `text`, `textarea`, `date` | texto | |
| `select` | texto | Exige `options` (textos únicos). |
| `checkbox` (v2) | sí / no | Sin `options`. Con `required: true` obliga a marcarla («confirmo que…»). |
| `multiselect` (v2) | lista de opciones | Exige `options`. Se muestra como un grupo de casillas. |

Un campo puede llevar `when` (v2): si la condición no se cumple, el campo no se muestra, deja de ser obligatorio y vale vacío en condiciones y textos. La condición de un campo solo puede usar campos **declarados antes** que él.

## Condiciones

Una condición es un objeto con un único operador. Se admite en campos, secciones, párrafos y casos de textos derivados.

```json
{ "field": "opinion", "equals": "Favorable" }
{ "field": "opinion", "in": ["Con salvedades", "Desfavorable"] }
{ "field": "incertidumbre", "checked": true }
{ "field": "asuntos", "includes": "Indicios de fraude" }
{ "field": "encargante", "filled": true }
{ "all": [ { … }, { … } ] }
{ "any": [ { … }, { … } ] }
{ "not": { … } }
{ "ref": "es_eip" }
```

| Operador | Campos admitidos |
|---|---|
| `equals`, `in` | `select`, `text` |
| `checked` | `checkbox` |
| `includes` | `multiselect` |
| `filled` | todos salvo `checkbox` |

- Los valores de `equals`, `in` e `includes` deben coincidir **literalmente** con una opción del campo.
- `all` y `any` necesitan al menos dos condiciones. El anidamiento máximo es de tres niveles, contando lo que aporte un `ref`.
- En la versión 1 solo se admite `{ "field": …, "equals": … }` en secciones.

## Condiciones con nombre (v2)

```json
"conditions": { "opinion_modificada": { "field": "opinion", "in": ["Con salvedades", "Desfavorable", "Denegada"] } }
```

Se usan con `{ "ref": "opinion_modificada" }`. Una condición con nombre no puede contener `ref`.

## Secciones y párrafos

Cada sección usa `heading`, `paragraphs` y, opcionalmente, `when`. Cada párrafo es un texto o, en v2, `{ "text": "…", "when": { … } }`. Un párrafo con condición falsa se omite; una sección sin párrafos visibles desaparece con su título.

```json
{ "heading": "Opinión", "paragraphs": [
  { "text": "En nuestra opinión, …", "when": { "field": "opinion", "equals": "Favorable" } },
  { "text": "Excepto por los efectos de … {{fundamento}}", "when": { "ref": "opinion_modificada" } }
] }
```

## Textos derivados (v2)

Para lo que cambia dentro de la frase. Gana el primer caso cuya condición se cumpla; si ninguno, `default` (obligatorio, puede ser `""`). Los textos pueden usar `{{campo}}`, pero no otro derivado.

```json
"derived": {
  "socios": { "cases": [ { "when": { "field": "forma", "equals": "S.L." }, "text": "socios" } ], "default": "accionistas" },
  "por_encargo": { "cases": [ { "when": { "field": "encargante", "filled": true }, "text": " por encargo de {{encargante}}" } ], "default": "" }
}
```

En títulos, encabezados y párrafos se usan como un campo: `{{socios}}`, `{{por_encargo}}`.

## Marcadores

`{{id}}` inserta un campo `text`, `textarea`, `date` o `select`, o un texto derivado. No puede insertar casillas, selecciones múltiples ni condiciones. Campos, derivados y condiciones comparten identificadores: no puede haber repeticiones.

## Validación

`node bin/generar-documento.mjs validate plantilla.json` detiene la generación ante cualquier error, con la ruta exacta (por ejemplo `sections[4].paragraphs[2].when.equals`), incluido un valor que no es una opción (sugiere la más parecida) o una sección que ninguna combinación de respuestas puede mostrar. Los avisos (`Aviso: …`) no bloquean pero deben revisarse: campos sin uso, opciones que ninguna condición menciona (normal si esa opción es la rama por defecto) y marcas del modelo coladas en el texto (`[●]`, `XXX`, `[Incluir…]`, `[1]`).

Redacta los párrafos completos según el modelo verificado. El HTML no invoca al LLM tras abrirse: solo inserta datos y selecciona las variantes previstas en el JSON. Por ello, no uses la plantilla para prometer que generará opiniones, conclusiones u otra redacción que dependa de juicio profesional nuevo.
```

- [ ] **Step 2: Actualizar `references/analisis-modelo.md`**

Sustituye el contenido completo por:

```markdown
# Del modelo MCP al formulario

## 1. Elegir el modelo

Usa `buscar_modelos_informe` primero. Ajusta `tipo` al documento solicitado (`informe_auditoria`, `carta_encargo`, `carta_manifestaciones`, `procedimientos_acordados`, `revision_limitada`, `informe_especial`, `confirmacion_independencia`, `comision_auditoria`, `comunicacion_gobierno`, `parrafo`, `cuestionario` u `otro`). Para informes de auditoría, añade `tipo_opinion`, `eip` y `variante` solo si el usuario los conoce. `query` precisa el tema. Si los filtros estrictos no devuelven resultados, amplía la consulta y verifica manualmente la aplicabilidad de los candidatos.

Compara los resultados por título, tipo de encargo, versión, vigencia, fecha, sector, opinión, EIP y variante cuando esos datos aparezcan. No confundas una mención lateral en una guía con un modelo completo. La búsqueda puede devolver la posición de un ejemplo dentro de un documento largo; conserva `doc_id`, `fuente` y `desde` para la lectura. Esos identificadores son internos y no deben mostrarse al usuario.

## 2. Leer el texto suficiente

Llama a `leer_documento(doc_id, fuente, desde)` y sigue las instrucciones de continuación que entregue (`desde` y, si procede, `desde_caracter`). Si la posición apunta al medio de una guía, lee también el contexto anterior que indique a qué casos aplica. Reúne todos los apartados del modelo elegido, instrucciones de cumplimentación, notas y alternativas. Para localizar un apartado en un documento largo puedes usar el argumento `buscar`, pero después abre el pasaje en su secuencia.

Anota la URL exacta de la fuente y cualquier aviso de vigencia. `buscar_modelos_informe` no filtra por ejercicio, de modo que el ejercicio del usuario debe contrastarse con la fecha y el ámbito del documento y, si es necesario, con la norma o circular aplicable.

## 3. Hacer el inventario de datos

Antes de escribir el JSON, completa una matriz interna como esta:

| Apartado o pasaje del modelo | Texto fijo | Dato que aporta el auditor | Marca del modelo → pieza | Campo JSON | Obligatorio / condición | Evidencia |
|---|---|---|---|---|---|---|
| Encabezado | Fórmula de destinatario | Nombre y cargo del destinatario | Hueco «[Destinatario]» → `text` | `destinatario` | Siempre | URL y apartado leídos |
| Identificación del encargo | Texto del modelo | Entidad y fecha de cierre | Huecos → `text`, `date` | `entidad`, `fecha_cierre` | Siempre | URL y apartado leídos |
| Párrafo alternativo | Redacción de la variante | Selección de variante | «Sustituir por…» → `select` + párrafo con `when` | `tipo_opinion` | Solo si el caso lo requiere | URL y apartado leídos |
| Cláusula opcional | Texto de la cláusula | Si procede incluirla | «Incluir solo si…» → `checkbox` + `when` | `incertidumbre` | Condición de la sección | URL y apartado leídos |

La tabla es una técnica de análisis, no una lista de campos universales. Incluye anexos, tablas, firmas, periodos comparativos, salvedades y notas de cumplimentación si están en el modelo. Distingue hechos conocidos, datos pendientes y decisiones profesionales. Nunca marques una decisión profesional como predeterminada por comodidad.

## 4. Reconocer la variación del modelo

Recorre el texto leído buscando **cada** marca de variación, no solo los huecos. Las marcas cambian de un documento a otro (corchetes, cursivas, notas al pie, recuadros, instrucciones «para el auditor»); identifícalas por su función y tradúcelas a la pieza correspondiente de `references/esquema-json.md`:

| Lo que aparece en el modelo | Pieza |
|---|---|
| «Incluir esta sección/párrafo solo si…», «en su caso», «si procede», «cuando proceda» | `checkbox` + `when` en la sección o el párrafo; `multiselect` + `includes` si son varias de la misma familia (manifestaciones adicionales, asuntos a comunicar) |
| «Aplicable solo a EIP / consolidadas / cotizadas / voluntarias» | `select` + `equals` o `in`; `all` / `any` cuando se cruzan dos datos (cotizada **y** sujeta a LSC) |
| Alternativas completas («sustituir por opinión con salvedades, desfavorable…», «Alternativa A / B») | `select` + un párrafo o una sección por variante, cada uno con su `when` |
| «[A/B]» dentro de la frase (Accionistas/Socios, la Sociedad/el Grupo, singular/plural, órgano) | `derived` con un caso por opción del `select` que lo decide |
| Fragmento opcional en línea («[por encargo de…]») | `derived` con un caso `filled` y `default` vacío |
| Dato que solo se pide en una variante (fundamento de la salvedad, descripción del énfasis) | campo con `when`, declarado después del campo que lo decide |
| Huecos de datos («[ABC, S.A.]», «[XX de XXXX de 20XX]», «[describir…]») | campo `text`, `date` o `textarea` |
| Notas al pie (`[1]`, `[^2]`), «[Publicado mediante…]», instrucciones al auditor, recuadros | se eliminan del texto; si condicionan algo, se convierten en la condición que describen |
| Listas o tablas que se repiten (servicios, deficiencias, incorrecciones) | aún no hay pieza: `textarea` con `help` que explique el formato, y avísalo al usuario |
| Una variación que ninguna pieza representa fielmente | pregunta al usuario o prepara asistentes separados; nunca la aproximes |

Cuando la misma lógica se repite en varios sitios (por ejemplo «opinión modificada»), defínela una vez en `conditions` y úsala con `ref`.

## 5. Traducir al JSON y comprobar cobertura

- Conserva el orden de los apartados y el sentido de los párrafos relevantes en `sections`. Usa `{{campo}}` solo para datos variables.
- Usa `fields` para cada dato pendiente. Una misma respuesta puede reutilizarse en varios apartados. Añade `help` para explicar formatos, unidades o referencias al encargo.
- Representa cada marca de variación con la pieza del apartado 4 y usa `schema_version: 2` si empleas alguna pieza nueva. Si una variante requiere una redacción no representable fielmente, crea asistentes separados o pide antes la elección al usuario.
- No copies marcas como `[●]`, `XXXXX` o instrucciones editoriales al documento final; conviértelas en campos o elimínalas si son notas del modelo, revisando que el sentido no cambie.
- Añade la URL exacta del modelo en `sources`. Explica si se usó una fuente secundaria o si faltó el texto completo.
- Antes de renderizar, compara cada fila de la matriz con `fields`, `sections` y condiciones. No debe quedar dato solicitado sin campo ni campo sin propósito claro en el documento.
- Ejecuta `validate` hasta que no haya errores. Revisa cada `Aviso:` y, al entregar, explica cuáles aceptas y por qué (por ejemplo, una opción que es la rama por defecto).
```

- [ ] **Step 3: Actualizar `SKILL.md`**

Sustituye el contenido completo por:

```markdown
---
name: generar-documento-auditoria
description: Genera un asistente HTML autónomo para preparar informes, cartas y otros documentos de auditoría. Primero busca modelos con buscar_modelos_informe del MCP ICJCE y lee el elegido con leer_documento; analiza su estructura para identificar los datos que debe introducir el auditor. Después crea un formulario dinámico, muestra el documento y permite exportarlo a DOCX o PDF. Úsala cuando el usuario pida crear o cumplimentar un documento de auditoría.
---

# Generar documento de auditoría

Convierte un modelo documental en un **archivo HTML por conversación**. La persona rellena los datos, pulsa **Generar documento**, ve el texto terminado y puede descargar un DOCX real o usar la impresión del navegador para **Guardar como PDF**. El archivo funciona sin conexión y no transmite lo introducido.

## Localizar y leer el modelo en el MCP

Sigue `references/analisis-modelo.md` antes de crear el JSON. **Si el MCP ICJCE está conectado, `buscar_modelos_informe` es el primer paso para cada documento**, incluso si el usuario aportó un ejemplo: permite identificar el modelo y comprobar si existe una versión más apropiada. Descubre las operaciones y sus esquemas en el cliente; los nombres siguientes son operaciones esperadas, no prefijos completos que debas inventar.

1. Identifica el documento pedido y los datos que determinan qué modelo aplica: tipo de encargo, tipo de opinión, EIP o no EIP, cuentas individuales o consolidadas, ejercicio y particularidades. Usa solo los filtros que conozcas; no supongas una opinión o una condición EIP para forzar un resultado.
2. Invoca `buscar_modelos_informe` con la búsqueda y los filtros anunciados por la herramienta (`query`, `tipo`, `tipo_opinion`, `eip`, `variante` según proceda). Si hay varios candidatos, compara título, vigencia, fecha, alcance y posición del ejemplo. Si no aparece uno apropiado, amplía la búsqueda con sinónimos o menos filtros y comunica la limitación si persiste.
3. Invoca `leer_documento` con el `doc_id` y la `fuente` del candidato; usa `desde` para ir a la posición del modelo indicada por la búsqueda. Continúa con los valores de `desde` y `desde_caracter` que devuelva la lectura hasta cubrir el texto del modelo y sus variantes relevantes. Un título o fragmento de búsqueda no basta para construir el documento. Si necesitas un apartado concreto de una guía larga, `buscar` en `leer_documento` ayuda a localizarlo, pero lee después su contexto.
4. Contrasta la aplicabilidad del modelo al encargo y conserva la URL exacta devuelta por el MCP para `sources`. Cuando la vigencia o las cláusulas dependan de una norma o circular, verifica esa fuente con las herramientas pertinentes o una fuente oficial web. El índice de modelos no tiene un filtro de ejercicio: comprueba expresamente la fecha aplicable.

Si el MCP no está disponible, dilo. Trabaja con un modelo aportado por el usuario o una fuente oficial verificada solo si tienes su texto; no presentes esa plantilla como recuperada del MCP. No atribuyas al ICJCE un texto que no hayas leído.

## Extraer los datos que debe aportar el auditor

Recorre el modelo leído **sección por sección**. Para cada título, párrafo, tabla, alternativa y nota de cumplimentación, clasifica: texto fijo que puede conservarse, dato variable del encargo, elección entre variantes, o decisión profesional que exige revisión. Prepara una matriz interna `apartado del modelo → dato solicitado → campo JSON → condición → fuente/pasaje`. Comprueba que todos los huecos y referencias cruzadas del modelo están cubiertos. Identifica también cada marca de variación (cláusulas «incluir solo si…», alternativas, «[A/B]» dentro de la frase, fragmentos opcionales) y tradúcela con la tabla del apartado 4 de `references/analisis-modelo.md`. No conviertas en campo un requisito que pueda obtenerse del propio modelo ni de la fuente.

Agrupa en el formulario los datos que el auditor sí debe introducir: identificación y destinatarios; entidad, ejercicio y marco contable; tipo y alcance del encargo; responsables y fechas; importes y hechos particulares; y selección de párrafos u opinión cuando proceda. **Esta lista es orientativa**: los campos reales salen del modelo elegido. Para cada campo usa una etiqueta concreta, `help` que explique el dato y `required` según sea obligatorio en la variante. Precarga solo datos aportados por el usuario. No inventes cifras, hechos, opinión ni conclusiones. Para la variación usa las piezas de la versión 2 del esquema (`checkbox`, `multiselect`, `when` en campos, secciones y párrafos, `conditions` y `derived`). Si ninguna representa una variante sin alterar el sentido del modelo, pide el dato o prepara plantillas separadas.

## Crear el HTML

Escribe un JSON UTF-8 conforme a `references/esquema-json.md`, con `schema_version: 2` si el modelo tiene variación. Usa `{{id_del_campo}}` en títulos, encabezados y párrafos donde se insertarán respuestas. El ejemplo `examples/carta-encargo.json` es una demostración técnica, no un modelo oficial ni una carta lista para firmar. En documentos reales, redacta las secciones a partir del modelo efectivamente leído y añade su fuente.

```sh
node bin/generar-documento.mjs validate /ruta/plantilla.json
node bin/generar-documento.mjs render /ruta/plantilla.json /ruta/asistente.html
```

Las rutas del comando son relativas a esta habilidad; también puedes invocar el script por ruta absoluta. El renderizador incorpora el logo, estilos y código al HTML, sin CDN ni llamadas al MCP al abrirlo. Entrega el archivo HTML al usuario y explica que puede abrirlo en el navegador, completar los campos y pulsar **Generar documento**.

Si el entorno del chat no permite ejecutar Node o adjuntar archivos, prepara el JSON y explica qué paso falta para generar el HTML. No afirmes que has creado o probado un archivo que no existe.

## Revisión y exportación

- Asegura que todos los campos obligatorios estén completos antes de mostrar el documento final. Incluye condiciones únicamente cuando el modelo exige variantes claras. `validate` debe terminar sin errores; revisa cada `Aviso:` antes de entregar. Contrasta el JSON con la matriz de apartados y datos para detectar omisiones.
- Mantén enlaces de las fuentes en la interfaz. Usa `include_sources_in_output` solo si conviene incluirlas en el documento emitido.
- El DOCX es un archivo Office Open XML descargable. El botón de PDF abre la impresión del navegador; el usuario selecciona **Guardar como PDF**. No lo presentes como descarga PDF directa.
- El logo y los colores ICJCE se usan en el asistente. El documento exportado no lleva logo institucional ni se presenta como emitido por el ICJCE. El auditor debe verificar y aprobar el contenido final.

## Control final

Valida el JSON, genera el HTML, ábrelo si tienes navegador disponible y comprueba al menos un flujo de campos, generación y exportación. Informa brevemente qué modelo consultaste, su enlace y qué datos tendrá que rellenar el auditor. Esta habilidad produce el artefacto; usa las fuentes y el razonamiento de auditoría para preparar su contenido.
```

- [ ] **Step 4: Ejecutar las pruebas de Node desde `scripts/validate.py`**

Añade `import subprocess` tras `import re`. Sustituye el bloque:

```python
    renderer = ROOT / 'skills/generar-documento-auditoria'
    for relative in ('bin/generar-documento.mjs', 'assets/assistant.html',
                     'assets/assistant-runtime.js', 'assets/icjce-logo.png',
                     'examples/carta-encargo.json', 'references/esquema-json.md'):
        assert (renderer / relative).is_file(), relative
    print('OK: plugin schemas; OpenCode and Hermes MCP; metadata, marketplace, both skills and renderer assets')
```
por:
```python
    renderer = ROOT / 'skills/generar-documento-auditoria'
    for relative in ('bin/generar-documento.mjs', 'bin/validar-plantilla.mjs',
                     'assets/assistant.html', 'assets/assistant-runtime.js',
                     'assets/evaluator.js', 'assets/icjce-logo.png',
                     'examples/carta-encargo.json', 'references/esquema-json.md'):
        assert (renderer / relative).is_file(), relative
    tests = sorted(str(path) for path in (ROOT / 'tests/generar-documento').glob('*.test.mjs'))
    assert tests, 'Faltan las pruebas del renderizador'
    subprocess.run(['node', '--test', *tests], cwd=ROOT, check=True)
    print('OK: plugin schemas; OpenCode and Hermes MCP; metadata, marketplace, both skills, renderer assets and tests')
```

- [ ] **Step 5: Validar el repositorio**

Run: `python3 scripts/validate.py` (requiere `pip install -r requirements-dev.txt`: jsonschema y PyYAML)
Expected: salida de `node --test` con `# pass 21` y `# fail 0`, y última línea `OK: plugin schemas; OpenCode and Hermes MCP; metadata, marketplace, both skills, renderer assets and tests`.

- [ ] **Step 6: Commit**

```bash
git add skills/generar-documento-auditoria/references/esquema-json.md skills/generar-documento-auditoria/references/analisis-modelo.md skills/generar-documento-auditoria/SKILL.md scripts/validate.py
git commit -m "Document v2 template pieces and run renderer tests in validation"
```

```json:metadata
{"files": ["skills/generar-documento-auditoria/references/esquema-json.md", "skills/generar-documento-auditoria/references/analisis-modelo.md", "skills/generar-documento-auditoria/SKILL.md", "scripts/validate.py"], "verifyCommand": "python3 scripts/validate.py", "acceptanceCriteria": ["python3 scripts/validate.py ends with a line starting OK: after 21 passing node tests", "analisis-modelo.md has sections 1-5 with 4 titled Reconocer la variación del modelo", "SKILL.md mentions schema_version: 2 and references section 4 of analisis-modelo.md"], "modelTier": "mechanical"}
```
