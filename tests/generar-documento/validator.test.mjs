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

test('multiselect usado solo con filled es alcanzable', () => {
  const base = spec();
  base.fields.push({ id: 'ms', label: 'Varios', type: 'multiselect', options: ['A', 'B'] });
  base.sections.push({ heading: 'Dos', when: { field: 'ms', filled: true }, paragraphs: ['Texto.'] });
  assert.doesNotThrow(() => validate(base));
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
