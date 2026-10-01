import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../../skills/generar-documento-auditoria/assets/evaluator.js';
import '../../skills/generar-documento-auditoria/assets/docx.js';

const { buildModel, effectiveData, isEmpty, evaluate } = globalThis.DocEvaluator;
const { docxXml } = globalThis.DocExport;
const fixture = JSON.parse(await readFile(new URL('./fixtures/comunicacion-final.v2.json', import.meta.url), 'utf8'));
const group = fixture.fields.find(field => field.id === 'incorrecciones');
const base = { entidad: 'Prueba', organo: 'Consejo', pendientes: [{ asunto: 'Cartas de abogados', responsable: 'Dirección' }] };
const section = (model, heading) => model.sections.find(s => s.heading === heading);

test('filas en blanco descartadas y filled sobre grupo', () => {
  const rows = [{ concepto: '  ' }, { concepto: 'Provisión', efecto_resultado: '10' }, {}];
  assert.equal(isEmpty(group, rows), false);
  assert.equal(isEmpty(group, [{ concepto: ' ' }]), true);
  const { data } = effectiveData(fixture, { incorrecciones: rows });
  assert.deepEqual(data.incorrecciones, [{ concepto: 'Provisión', efecto_resultado: '10' }]);
  assert.equal(evaluate({ field: 'incorrecciones', filled: true }, data, fixture), true);
  assert.equal(evaluate({ field: 'incorrecciones', filled: true }, effectiveData(fixture, {}).data, fixture), false);
});

test('grupo oculto vale lista vacía', () => {
  const spec = { fields: [{ id: 'm', type: 'checkbox' }, { ...group, when: { field: 'm', checked: true } }] };
  assert.deepEqual(effectiveData(spec, { m: false, incorrecciones: [{ concepto: 'x' }] }).data.incorrecciones, []);
});

test('tabla con todas las columnas y con columns', () => {
  const model = buildModel(fixture, { ...base, incorrecciones: [{ concepto: 'Provisión', efecto_resultado: '10' }], total_incorrecciones: '10' });
  assert.deepEqual(section(model, 'Incorrecciones no corregidas').paragraphs, [
    'Texto de prueba previo a la tabla de incorrecciones:',
    { table: { headers: ['Concepto', 'Efecto en resultado', 'Efecto en patrimonio neto'], rows: [['Provisión', '10', '']] } },
    'Total de prueba: 10',
  ]);
  const narrow = structuredClone(fixture);
  narrow.sections[1].paragraphs[1].columns = ['efecto_resultado', 'concepto'];
  const table = section(buildModel(narrow, { ...base, incorrecciones: [{ concepto: 'Provisión', efecto_resultado: '10' }] }), 'Incorrecciones no corregidas').paragraphs[1].table;
  assert.deepEqual(table, { headers: ['Efecto en resultado', 'Concepto'], rows: [['10', 'Provisión']] });
});

test('lista y bloques', () => {
  const model = buildModel(fixture, { ...base, deficiencias: [{ descripcion: 'Sin conciliaciones', recomendacion: 'Conciliar' }, { descripcion: 'Accesos' }] });
  assert.deepEqual(section(model, 'Asuntos pendientes').paragraphs, ['Texto de prueba previo a la lista:', { list: ['Cartas de abogados (responsable: Dirección)'] }]);
  assert.deepEqual(section(model, 'Deficiencias de control').paragraphs, [
    'Deficiencia de prueba: Sin conciliaciones', 'Recomendación de prueba: Conciliar',
    'Deficiencia de prueba: Accesos', 'Recomendación de prueba: ',
  ]);
});

test('empty cuando no hay filas; sin empty el párrafo y la sección desaparecen', () => {
  const model = buildModel(fixture, base);
  assert.deepEqual(section(model, 'Deficiencias de control').paragraphs, ['Texto de prueba: no hay deficiencias en Prueba.']);
  assert.equal(section(model, 'Incorrecciones no corregidas'), undefined);
  const noEmpty = structuredClone(fixture);
  delete noEmpty.sections[3].paragraphs[0].empty;
  assert.equal(section(buildModel(noEmpty, base), 'Deficiencias de control'), undefined);
});

test('subcampo vacío marcado en la vista previa', () => {
  const model = buildModel(fixture, { ...base, pendientes: [{ asunto: 'Actas' }] }, { markMissing: true });
  assert.deepEqual(section(model, 'Asuntos pendientes').paragraphs[1], { list: ['Actas (responsable: [Responsable])'] });
});

test('documento con tabla y lista', async () => {
  const out = docxXml(buildModel(fixture, { entidad: 'Prueba', organo: 'Consejo', incorrecciones: [{ concepto: 'Provisión' }], pendientes: [{ asunto: 'Actas' }] }));
  assert.equal((out.match(/<w:tbl>/g) || []).length, 1);
  assert.match(out, /• Actas \(responsable: \)/);
});
