import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../../skills/generar-documento-auditoria/assets/numbers.js';
import '../../skills/generar-documento-auditoria/assets/evaluator.js';

const { buildModel, effectiveData, evaluate, renderText } = globalThis.DocEvaluator;
const spec = JSON.parse(await readFile(new URL('./fixtures/materialidad.v2.json', import.meta.url), 'utf8'));
const section = (model, heading) => model.sections.find(s => s.heading === heading);
const base = { entidad: 'Prueba', base: '2.000.000', porcentaje: '1,5', ejecucion_pct: '75' };

test('campos calculados en orden y con formato', () => {
  const { data, invalid } = effectiveData(spec, base);
  assert.equal(data.materialidad, 30000);
  assert.equal(data.ejecucion, 22500);
  assert.equal(data.umbral, 1500);
  assert.equal(data.total_incorrecciones, 0);
  assert.deepEqual(invalid, { base: false, porcentaje: false, ejecucion_pct: false });
  assert.deepEqual(section(buildModel(spec, base), 'Materialidad').paragraphs, [
    'Texto de prueba: materialidad de 30.000,00\u00a0€ (1,5\u00a0% sobre 2.000.000,00\u00a0€).',
    'Texto de prueba: ejecución 22.500,00\u00a0€; umbral 1.500\u00a0€.',
  ]);
});

test('sin datos: el cálculo queda vacío y se marca en la vista previa', () => {
  const { data, invalid } = effectiveData(spec, { base: 'mucho', porcentaje: '' });
  assert.equal(data.materialidad, null);
  assert.equal(invalid.base, true);
  const preview = buildModel(spec, { entidad: 'P' }, { markMissing: true });
  assert.equal(section(preview, 'Materialidad').paragraphs[0], 'Texto de prueba: materialidad de [Materialidad] ([Porcentaje aplicado] sobre [Cifra de negocios]).');
  assert.equal(section(buildModel(spec, { entidad: 'P' }), 'Materialidad').paragraphs[0], 'Texto de prueba: materialidad de  ( sobre ).');
});

test('suma de una columna, tabla con formato y comparaciones', () => {
  const rows = [{ concepto: 'Provisión', importe: '25.000' }, { concepto: 'Ajuste', importe: '7.500,5' }, { concepto: '', importe: '' }];
  const model = buildModel(spec, { ...base, incorrecciones: rows });
  assert.deepEqual(section(model, 'Incorrecciones').paragraphs, [
    { table: { headers: ['Concepto', 'Importe'], rows: [['Provisión', '25.000,00\u00a0€'], ['Ajuste', '7.500,50\u00a0€']] } },
    'Texto de prueba: total 32.500,50\u00a0€.',
  ]);
  assert.deepEqual(section(model, 'Conclusión').paragraphs, ['Texto de prueba: las incorrecciones superan la materialidad.']);
  const small = buildModel(spec, { ...base, incorrecciones: [{ concepto: 'Ajuste', importe: '30.000' }] });
  assert.deepEqual(section(small, 'Conclusión').paragraphs, ['Texto de prueba: las incorrecciones no superan la materialidad.']);
  assert.deepEqual(section(buildModel(spec, base), 'Conclusión').paragraphs, ['Texto de prueba: no hay incorrecciones.']);
});

test('comparaciones con literal, con campo vacío y eq', () => {
  const { data } = effectiveData(spec, base);
  assert.equal(evaluate({ field: 'materialidad', gte: 30000 }, data, spec), true);
  assert.equal(evaluate({ field: 'materialidad', gt: 30000 }, data, spec), false);
  assert.equal(evaluate({ field: 'materialidad', eq: 30000 }, data, spec), true);
  assert.equal(evaluate({ field: 'umbral', lt: 'ejecucion' }, data, spec), true);
  assert.equal(evaluate({ field: 'materialidad', lt: 'base' }, effectiveData(spec, { base: '' }).data, spec), false);
  assert.equal(evaluate({ field: 'materialidad', filled: true }, data, spec), true);
});

test('un computed oculto por when no tiene valor', () => {
  const hidden = structuredClone(spec);
  hidden.fields.splice(4, 0, { id: 'aplica', label: 'Aplica', type: 'checkbox' });
  hidden.fields.find(f => f.id === 'ejecucion').when = { field: 'aplica', checked: true };
  assert.equal(effectiveData(hidden, base).data.ejecucion, null);
  assert.equal(effectiveData(hidden, { ...base, aplica: true }).data.ejecucion, 22500);
});

test('renderText formatea números', () => {
  assert.equal(renderText(spec, base, 'Materialidad {{materialidad}}'), 'Materialidad 30.000,00\u00a0€');
});

test('las comparaciones toleran el ruido de coma flotante', () => {
  const data = { entidad: 'P', base: '1', porcentaje: '30', incorrecciones: [{ concepto: 'a', importe: '0,1' }, { concepto: 'b', importe: '0,2' }] };
  const { data: resolved } = effectiveData(spec, data);
  assert.notEqual(resolved.total_incorrecciones, resolved.materialidad);
  assert.deepEqual(section(buildModel(spec, data), 'Conclusión').paragraphs, ['Texto de prueba: las incorrecciones no superan la materialidad.']);
  assert.equal(evaluate({ field: 'total_incorrecciones', eq: 'materialidad' }, resolved, spec), true);
  assert.equal(evaluate({ field: 'total_incorrecciones', gt: 'materialidad' }, resolved, spec), false);
  assert.equal(evaluate({ field: 'total_incorrecciones', gte: 'materialidad' }, resolved, spec), true);
  assert.equal(evaluate({ field: 'total_incorrecciones', lt: 'materialidad' }, resolved, spec), false);
  assert.equal(evaluate({ field: 'total_incorrecciones', lte: 'materialidad' }, resolved, spec), true);
});
