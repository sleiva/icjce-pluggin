import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validate, lint } from '../../skills/generar-documento-auditoria/bin/validar-plantilla.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/confirmacion-saldos.v2.json', import.meta.url), 'utf8'));
const withBatch = batch => ({ ...structuredClone(fixture), batch });
const base = fixture.batch;

test('la plantilla de lote de prueba es válida y sin avisos', () => {
  assert.doesNotThrow(() => validate(fixture));
  assert.deepEqual(lint(fixture), []);
});

test('batch solo en v2 y sin claves desconocidas', () => {
  const v1 = { schema_version: 1, title: 'T', fields: [{ id: 'a', label: 'A', type: 'text' }], sections: [{ heading: 'H', paragraphs: ['{{a}}'] }], batch: { label: 'L', fields: ['a'], filename: '{{a}}' } };
  assert.throws(() => validate(v1), /batch: requiere schema_version 2/);
  assert.throws(() => validate(withBatch({ ...base, nombre: 'x' })), /batch: clave desconocida nombre/);
  assert.throws(() => validate(withBatch([])), /batch debe ser un objeto/);
});

test('label y fields', () => {
  assert.throws(() => validate(withBatch({ ...base, label: ' ' })), /batch\.label: texto obligatorio/);
  assert.throws(() => validate(withBatch({ ...base, fields: [] })), /batch\.fields debe contener entre 1 y 20 campos sin repetir/);
  assert.throws(() => validate(withBatch({ ...base, fields: ['saldo', 'saldo'] })), /sin repetir/);
  assert.throws(() => validate(withBatch({ ...base, fields: Array.from({ length: 21 }, (_, i) => `f${i}`) })), /entre 1 y 20/);
  assert.throws(() => validate(withBatch({ ...base, fields: ['destinatario', 'saldos'] })), /batch\.fields\[1\]: saldos no es un campo/);
});

test('campos del lote de tipo no admitido', () => {
  const spec = withBatch({ ...base, fields: ['destinatario', 'confirmado'] });
  spec.fields.push({ id: 'confirmado', label: 'Confirmado', type: 'checkbox' });
  spec.sections.push({ heading: 'X', when: { field: 'confirmado', checked: true }, paragraphs: ['x'] });
  assert.throws(() => validate(spec), /batch\.fields\[1\]: el campo confirmado es checkbox y no puede venir del listado/);
  const group = withBatch({ ...base, fields: ['destinatario', 'filas'] });
  group.fields.push({ id: 'filas', label: 'Filas', type: 'group', fields: [{ id: 'c', label: 'C', type: 'text' }] });
  group.sections.push({ heading: 'Y', paragraphs: [{ repeat: 'filas', as: 'table' }] });
  assert.throws(() => validate(group), /batch\.fields\[1\]: el campo filas es group y no puede venir del listado/);
});

test('filename', () => {
  assert.throws(() => validate(withBatch({ ...base, filename: '' })), /batch\.filename: texto obligatorio/);
  assert.throws(() => validate(withBatch({ ...base, filename: 'Carta {{nada}}' })), /batch\.filename: campo desconocido \{\{nada\}\}/);
  assert.throws(() => validate(withBatch({ ...base, filename: 'Carta {{entidad}}' })), /batch\.filename debe usar al menos un campo de batch\.fields/);
  assert.doesNotThrow(() => validate(withBatch({ ...base, filename: '{{entidad}} - {{destinatario}}' })));
});

test('aviso: campo del lote sin uso', () => {
  const spec = withBatch({ ...base, fields: [...base.fields, 'extra'] });
  spec.fields.push({ id: 'extra', label: 'Extra', type: 'text' });
  assert.ok(lint(validate(spec)).some(w => /campo extra: no se usa en ningún texto ni condición/.test(w)));
  const inName = withBatch({ ...base, filename: '{{destinatario}} {{extra}}', fields: [...base.fields, 'extra'] });
  inName.fields.push({ id: 'extra', label: 'Extra', type: 'text' });
  assert.ok(!lint(validate(inName)).some(w => /campo extra/.test(w)));
});

test('un campo común no puede depender de un campo del lote, directo o por condición con nombre', () => {
  const spec = structuredClone(fixture);
  spec.fields.push({ id: 'cambio', label: 'Cambio', type: 'text', required: true, when: { field: 'moneda', equals: 'Otra' } });
  spec.sections[1].paragraphs.push('Tipo de cambio: {{cambio}}');
  const message = /fields\[10\]\.when: depende de moneda, que viene del listado; añádelo a batch\.fields/;
  assert.throws(() => validate(spec), message);
  const named = structuredClone(spec);
  named.conditions = { otra: { field: 'moneda', equals: 'Otra' } };
  named.fields[10].when = { ref: 'otra' };
  assert.throws(() => validate(named), message);
});
