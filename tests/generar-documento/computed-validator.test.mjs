import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validate, lint } from '../../skills/generar-documento-auditoria/bin/validar-plantilla.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/materialidad.v2.json', import.meta.url), 'utf8'));
const batchFixture = JSON.parse(await readFile(new URL('./fixtures/confirmacion-saldos.v2.json', import.meta.url), 'utf8'));
const variant = edit => { const spec = structuredClone(fixture); edit(spec); return spec; };
const field = (spec, id) => spec.fields.find(item => item.id === id);
const index = id => fixture.fields.findIndex(item => item.id === id);

test('la plantilla de materialidad es válida y sin avisos', () => {
  assert.doesNotThrow(() => validate(fixture));
  assert.deepEqual(lint(fixture), []);
});

test('campo number: decimals, unit, value y claves', () => {
  const at = `fields\\[${index('base')}\\]`;
  assert.throws(() => validate(variant(s => { field(s, 'base').decimals = 7; })), new RegExp(`${at}\\.decimals debe ser un entero entre 0 y 6`));
  assert.throws(() => validate(variant(s => { field(s, 'base').decimals = 1.5; })), /decimals debe ser un entero/);
  assert.throws(() => validate(variant(s => { field(s, 'base').unit = ''; })), new RegExp(`${at}\\.unit debe ser un texto de 1 a 30 caracteres`));
  assert.throws(() => validate(variant(s => { field(s, 'base').unit = 'x'.repeat(31); })), /unit debe ser un texto/);
  assert.throws(() => validate(variant(s => { field(s, 'base').value = 'mucho'; })), new RegExp(`${at}\\.value debe ser un número válido`));
  assert.throws(() => validate(variant(s => { field(s, 'base').options = ['1']; })), /clave desconocida options/);
});

test('campo computed: estructura y fórmula', () => {
  const at = `fields\\[${index('materialidad')}\\]`;
  assert.throws(() => validate(variant(s => { delete field(s, 'materialidad').expr; })), new RegExp(`${at}\\.expr: fórmula obligatoria`));
  assert.throws(() => validate(variant(s => { field(s, 'materialidad').required = true; })), /clave desconocida required/);
  assert.throws(() => validate(variant(s => { field(s, 'materialidad').value = '1'; })), /clave desconocida value/);
  assert.throws(() => validate(variant(s => { field(s, 'materialidad').expr = 'base * (porcentaje / 100'; })), new RegExp(`${at}\\.expr: se esperaba "\\)" en la posición 25`));
  assert.throws(() => validate(variant(s => { field(s, 'materialidad').expr = 'base * nada'; })), /expr: identificador desconocido nada/);
  assert.throws(() => validate(variant(s => { field(s, 'materialidad').expr = 'base * entidad'; })), /expr: entidad no es un campo numérico/);
  assert.throws(() => validate(variant(s => { field(s, 'materialidad').expr = 'base * ejecucion'; })), /expr: ejecucion debe declararse antes de este campo/);
  assert.throws(() => validate(variant(s => { field(s, 'materialidad').expr = 'media(base, 1)'; })), /expr: función desconocida media/);
  assert.throws(() => validate(variant(s => { field(s, 'materialidad').expr = 'max(base)'; })), /expr: max necesita al menos 2 argumentos/);
  assert.throws(() => validate(variant(s => { field(s, 'materialidad').expr = 'round(base, porcentaje)'; })), /segundo argumento de round/);
  assert.throws(() => validate(variant(s => { field(s, 'materialidad').expr = 'incorrecciones.importe * 2'; })), /solo puede usarse dentro de sum/);
  assert.throws(() => validate(variant(s => { field(s, 'materialidad').expr = 'x'.repeat(501); })), /no puede superar 500 caracteres/);
});

test('sum: grupo y subcampo numérico', () => {
  assert.throws(() => validate(variant(s => { field(s, 'total_incorrecciones').expr = 'sum(base.importe)'; })), /sum necesita grupo\.subcampo y base no es un grupo/);
  assert.throws(() => validate(variant(s => { field(s, 'total_incorrecciones').expr = 'sum(incorrecciones.nada)'; })), /nada no es un subcampo de incorrecciones/);
  assert.throws(() => validate(variant(s => { field(s, 'total_incorrecciones').expr = 'sum(incorrecciones.concepto)'; })), /incorrecciones\.concepto debe ser un subcampo number/);
  const later = variant(s => { field(s, 'materialidad').expr = 'sum(incorrecciones.importe)'; });
  assert.throws(() => validate(later), /incorrecciones debe declararse antes de este campo/);
});

test('subcampos number en grupos', () => {
  assert.throws(() => validate(variant(s => { field(s, 'incorrecciones').fields[1].decimals = 9; })), /fields\[1\]\.decimals debe ser un entero entre 0 y 6/);
  assert.throws(() => validate(variant(s => { field(s, 'incorrecciones').fields[0].unit = '€'; })), /decimals y unit solo se admiten en subcampos number/);
  assert.throws(() => validate(variant(s => { field(s, 'incorrecciones').value = [{ concepto: 'A', importe: 'mucho' }]; })), /importe: "mucho" no es un número válido/);
});

test('comparaciones', () => {
  const when = condition => variant(s => { s.sections[2].paragraphs[0].when = condition; });
  assert.throws(() => validate(when({ field: 'entidad', gt: 1 })), /el operador gt no se admite en campos text/);
  assert.throws(() => validate(when({ field: 'materialidad', gt: 'entidad' })), /when\.gt: "entidad" no es un campo numérico/);
  assert.throws(() => validate(when({ field: 'materialidad', lt: true })), /when\.lt: true no es un campo numérico/);
  assert.doesNotThrow(() => validate(when({ field: 'materialidad', gte: 1000 })));
  const fieldWhen = variant(s => { field(s, 'ejecucion_pct').when = { field: 'materialidad', gt: 'umbral' }; });
  assert.throws(() => validate(fieldWhen), /when\.gt: umbral debe declararse antes del campo que lo usa en when/);
});

test('alcanzabilidad: las comparaciones no se resuelven y no dan falsos inalcanzables', () => {
  const both = variant(s => { s.sections[2].paragraphs[0].when = { all: [{ field: 'materialidad', gt: 1000 }, { field: 'materialidad', lt: 500 }] }; });
  assert.doesNotThrow(() => validate(both));
  const filledComputed = variant(s => { s.sections[2].paragraphs[0].when = { field: 'materialidad', filled: true }; });
  assert.doesNotThrow(() => validate(filledComputed));
});

test('batch: un computed no puede venir del listado, un number sí', () => {
  const batch = fields => variant(s => { s.batch = { label: 'Entidades', fields, filename: 'Materialidad {{entidad}}' }; });
  assert.throws(() => validate(batch(['entidad', 'materialidad'])), /batch\.fields\[1\]: el campo materialidad es computed y no puede venir del listado/);
  assert.doesNotThrow(() => validate(batch(['entidad', 'base'])));
});

test('avisos: número sin uso, división por un campo que puede quedar vacío', () => {
  const unused = variant(s => { s.fields.push({ id: 'otro', label: 'Otro', type: 'number' }); });
  assert.ok(lint(validate(unused)).some(w => /campo otro: no se usa/.test(w)));
  const divide = variant(s => { field(s, 'umbral').expr = 'materialidad / ejecucion_pct'; });
  assert.ok(lint(validate(divide)).some(w => new RegExp(`fields\\[${index('umbral')}\\]\\.expr: divide por ejecucion_pct, que puede quedar vacío`).test(w)));
  const literal = variant(s => { field(s, 'umbral').expr = 'materialidad / 20'; });
  assert.ok(!lint(validate(literal)).some(w => /divide por/.test(w)));
  const onlySum = variant(s => { s.sections[1].paragraphs = ['Total {{total_incorrecciones}}.']; });
  assert.ok(!lint(validate(onlySum)).some(w => /incorrecciones: el grupo no se usa/.test(w)));
});

test('computed: decimals, unit y anidamiento fuera de rango', () => {
  assert.throws(() => validate(variant(s => { field(s, 'materialidad').decimals = 7; })), /decimals debe ser un entero entre 0 y 6/);
  assert.throws(() => validate(variant(s => { field(s, 'materialidad').unit = ''; })), /unit debe ser un texto de 1 a 30 caracteres/);
  assert.throws(() => validate(variant(s => { field(s, 'materialidad').expr = `${'('.repeat(11)}base${')'.repeat(11)}`; })), /expr: demasiados niveles de anidamiento/);
});

test('aviso al dividir por sum(...) o por 0', () => {
  const sum = lint(variant(s => { field(s, 'materialidad').expr = 'base / sum(incorrecciones.importe)'; }));
  assert.ok(sum.some(w => /divide por sum\(\.\.\.\), que puede valer 0/.test(w)), sum.join('\n'));
  const zero = lint(variant(s => { field(s, 'materialidad').expr = 'base / 0'; }));
  assert.ok(zero.some(w => /expr: divide por 0/.test(w)), zero.join('\n'));
});

test('lote: un campo común no puede depender del listado a través de un computed', () => {
  const batchSpec = edit => {
    const spec = JSON.parse(JSON.stringify(batchFixture));
    spec.fields.find(f => f.id === 'saldo').type = 'number';
    const at = spec.fields.findIndex(f => f.id === 'saldo') + 1;
    spec.fields.splice(at, 0, { id: 'saldo_iva', label: 'Saldo con IVA', type: 'computed', expr: 'saldo * 1.21' });
    spec.fields.push({ id: 'nota', label: 'Nota', type: 'text', required: true, when: { field: 'saldo_iva', gt: 1000 } });
    spec.sections[1].paragraphs.push('Texto de prueba: {{nota}}.');
    edit?.(spec);
    return spec;
  };
  assert.throws(() => validate(batchSpec()), /fields\[\d+\]\.when: depende de saldo, que viene del listado; añádelo a batch\.fields/);
  assert.throws(() => validate(batchSpec(s => { s.fields.find(f => f.id === 'saldo_iva').when = { field: 'saldo', gt: 5 }; s.fields.find(f => f.id === 'nota').when = undefined; })),
    /los campos calculados no pueden depender del listado en su when/);
});
