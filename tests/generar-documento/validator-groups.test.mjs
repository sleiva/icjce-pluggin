import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validate, lint } from '../../skills/generar-documento-auditoria/bin/validar-plantilla.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/comunicacion-final.v2.json', import.meta.url), 'utf8'));

function spec(groupOverrides = {}, paragraph = { repeat: 'filas', as: 'table' }, extra = {}) {
  return {
    schema_version: 2,
    title: 'Prueba {{texto}}',
    fields: [
      { id: 'texto', label: 'Texto', type: 'text' },
      { id: 'filas', label: 'Filas', type: 'group', fields: [
        { id: 'concepto', label: 'Concepto', type: 'text' },
        { id: 'tipo', label: 'Tipo', type: 'select', options: ['A', 'B'] },
      ], ...groupOverrides },
    ],
    sections: [{ heading: 'Uno', paragraphs: [paragraph] }],
    ...extra,
  };
}

test('la plantilla de prueba con grupos es válida y sin avisos', () => {
  assert.doesNotThrow(() => validate(fixture));
  assert.deepEqual(lint(fixture), []);
});

test('estructura del grupo', () => {
  assert.throws(() => validate(spec({ fields: [] })), /fields\[1\]\.fields debe contener entre 1 y 8 subcampos/);
  assert.throws(() => validate(spec({ fields: Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, label: 'S', type: 'text' })) })), /entre 1 y 8 subcampos/);
  assert.throws(() => validate(spec({ fields: [{ id: 'concepto', label: 'C', type: 'checkbox' }] })), /fields\[1\]\.fields\[0\]\.type no válido/);
  assert.throws(() => validate(spec({ fields: [{ id: 'concepto', label: 'C', type: 'text', when: { field: 'texto', filled: true } }] })), /fields\[1\]\.fields\[0\]: clave desconocida when/);
  assert.throws(() => validate(spec({ fields: [{ id: 'tipo', label: 'T', type: 'select', options: ['A '] }] })), /no pueden empezar ni terminar con espacios/);
  assert.throws(() => validate(spec({ max_rows: 0 })), /max_rows debe ser al menos 1/);
  assert.throws(() => validate(spec({ max_rows: 51 })), /max_rows debe ser un entero entre 0 y 50/);
  assert.throws(() => validate(spec({ min_rows: 3, max_rows: 2 })), /min_rows no puede ser mayor que max_rows/);
  assert.throws(() => validate(spec({ value: [{ otro: 'x' }] })), /value\[0\]: otro no es un subcampo del grupo/);
  assert.throws(() => validate(spec({ value: [{ tipo: 'C' }] })), /value\[0\]\.tipo: "C" no es una opción/);
  assert.throws(() => validate(spec({ max_rows: 1, value: [{}, {}] })), /value debe ser una lista de hasta 1 filas/);
  assert.throws(() => validate(spec({ minrows: 1 })), /fields\[1\]: clave desconocida minrows/);
});

test('identificadores de subcampo únicos en toda la plantilla', () => {
  assert.throws(() => validate(spec({ fields: [{ id: 'texto', label: 'T', type: 'text' }] })), /fields\[1\]\.fields\[0\]\.id no válido o duplicado/);
});

test('uso del grupo y de los subcampos', () => {
  const when = { heading: 'Dos', when: { field: 'filas', equals: 'x' }, paragraphs: ['x'] };
  assert.throws(() => validate({ ...spec(), sections: [spec().sections[0], when] }), /operador equals no se admite en campos group/);
  const sub = { heading: 'Dos', when: { field: 'concepto', filled: true }, paragraphs: ['x'] };
  assert.throws(() => validate({ ...spec(), sections: [spec().sections[0], sub] }), /concepto es un subcampo del grupo filas; las condiciones no pueden usar subcampos/);
  assert.throws(() => validate(spec({}, '{{filas}}')), /\{\{filas\}\} es un campo group y no puede insertarse/);
  assert.throws(() => validate(spec({}, '{{concepto}}')), /\{\{concepto\}\} es un subcampo del grupo filas y solo puede usarse en sus párrafos repeat/);
});

test('párrafo repeat', () => {
  assert.throws(() => validate(spec({}, { repeat: 'texto', as: 'table' })), /repeat: texto no es un campo group/);
  assert.throws(() => validate(spec({}, { repeat: 'nada', as: 'table' })), /repeat: campo desconocido nada/);
  assert.throws(() => validate(spec({}, { repeat: 'filas', as: 'grid' })), /as debe ser table, list, blocks/);
  assert.throws(() => validate(spec({}, { repeat: 'filas', as: 'table', item: 'x' })), /clave desconocida item \(para as: table\)/);
  assert.throws(() => validate(spec({}, { repeat: 'filas', as: 'list' })), /\.item: texto obligatorio/);
  assert.throws(() => validate(spec({}, { repeat: 'filas', as: 'blocks', paragraphs: [] })), /paragraphs debe contener entre 1 y 10 textos/);
  assert.throws(() => validate(spec({}, { repeat: 'filas', as: 'table', columns: ['concepto', 'concepto'] })), /columns debe ser una lista no vacía sin repeticiones/);
  assert.throws(() => validate(spec({}, { repeat: 'filas', as: 'table', columns: ['texto'] })), /columns\[0\]: texto no es un subcampo de filas/);
  assert.throws(() => validate(spec({}, { repeat: 'filas', as: 'list', item: '{{concepto}}', empty: 'Sin {{concepto}}' })), /empty: \{\{concepto\}\} es un subcampo/);
  const other = spec({}, { repeat: 'filas', as: 'list', item: '{{otro}}' });
  other.fields.push({ id: 'g2', label: 'G2', type: 'group', fields: [{ id: 'otro', label: 'O', type: 'text' }] });
  other.sections.push({ heading: 'Dos', paragraphs: [{ repeat: 'g2', as: 'table' }] });
  assert.throws(() => validate(other), /\{\{otro\}\} es un subcampo del grupo g2/);
  assert.doesNotThrow(() => validate(spec({}, { repeat: 'filas', as: 'list', item: '{{concepto}} de {{texto}}', empty: 'Nada en {{texto}}.' })));
});

test('alcanzabilidad con grupos', () => {
  const hidden = spec({ when: { field: 'texto', equals: 'x' } }, { repeat: 'filas', as: 'table', when: { field: 'texto', equals: 'y' } });
  assert.throws(() => validate(hidden), /sections\[0\]: inalcanzable/);
  const withEmpty = spec({ when: { field: 'texto', equals: 'x' } }, { repeat: 'filas', as: 'table', empty: 'Sin filas.' });
  assert.doesNotThrow(() => validate(withEmpty));
});

test('avisos de grupos', () => {
  const unused = spec({}, '{{texto}}');
  assert.ok(lint(validate(unused)).some(w => /campo filas: el grupo no se usa en ningún párrafo repeat/.test(w)));
  const sub = spec({}, { repeat: 'filas', as: 'table', columns: ['concepto'] });
  assert.ok(lint(validate(sub)).some(w => /el subcampo tipo no aparece en ninguna columna ni plantilla/.test(w)));
  const marker = spec({}, { repeat: 'filas', as: 'list', item: '{{concepto}} {{tipo}} [2]' });
  assert.ok(lint(validate(marker)).some(w => /paragraphs\[0\]\.item: parece contener una marca del modelo/.test(w)));
});
