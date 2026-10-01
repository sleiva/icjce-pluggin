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
