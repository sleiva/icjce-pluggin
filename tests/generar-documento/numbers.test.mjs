import test from 'node:test';
import assert from 'node:assert/strict';
import '../../skills/generar-documento-auditoria/assets/numbers.js';

const { parseNumber, formatNumber, plainNumber, compile, run } = globalThis.DocNumbers;

test('parseNumber: formatos admitidos, vacío y no numérico', () => {
  const cases = { '1.234,56': 1234.56, '1234,56': 1234.56, '1234.56': 1234.56, '1.234': 1234, '1.234.567': 1234567, '1,234.56': 1234.56, '-5': -5, '5 %': 5, '1.234,56 €': 1234.56, '0,5': 0.5, ' 12 ': 12, '1.2345': 1.2345, '3 miles de euros': 3 };
  for (const [text, value] of Object.entries(cases)) assert.equal(parseNumber(text), value, text);
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber('   '), null);
  assert.equal(parseNumber(undefined), null);
  for (const text of ['abc', '1,2,3', '1.23.4', '1.234,5,6', ',5', '1-2']) assert.ok(Number.isNaN(parseNumber(text)), text);
});

test('formatNumber: miles, decimales, unidad con espacio duro, redondeo y sin -0', () => {
  assert.equal(formatNumber(1234.5, 2, '€'), '1.234,50\u00a0€');
  assert.equal(formatNumber(1234567.891, 0), '1.234.568');
  assert.equal(formatNumber(999.5, 0), '1.000');
  assert.equal(formatNumber(1.005, 2), '1,01');
  assert.equal(formatNumber(0.1 + 0.2, 2), '0,30');
  assert.equal(formatNumber(-1234.5, 1, '%'), '-1.234,5\u00a0%');
  assert.equal(formatNumber(-0.001, 2), '0,00');
  assert.equal(formatNumber(0.1234567, 6), '0,123457');
  assert.equal(formatNumber(null, 2), '');
  assert.equal(formatNumber(NaN, 2), '');
});

test('plainNumber: dígitos exactos para campos de texto', () => {
  assert.equal(plainNumber('28001'), '28001');
  assert.equal(plainNumber('1234.5'), '1234,5');
  assert.equal(plainNumber('0.1'), '0,1');
});

test('compile: precedencia, paréntesis, unario, funciones y referencias', () => {
  const values = { a: 2, b: 3, c: 4 };
  const value = expr => run(compile(expr).ast, values, {});
  assert.equal(value('a + b * c'), 14);
  assert.equal(value('(a + b) * c'), 20);
  assert.equal(value('-a + b'), 1);
  assert.equal(value('a - -b'), 5);
  assert.equal(value('c / a / a'), 1);
  assert.equal(value('max(a, b, c) - min(a, b)'), 2);
  assert.equal(value('abs(a - c)'), 2);
  assert.equal(value('round(10 / 3, 2)'), 3.33);
  assert.equal(value('round(-2.5, 0)'), -3);
  assert.deepEqual(compile('a * (b + a)').refs, ['a', 'b']);
  assert.deepEqual(compile('sum(g.x) + 1').sums, [{ group: 'g', sub: 'x' }]);
});

test('compile: errores con posición y límites', () => {
  const errors = {
    '(1 + 2': /se esperaba "\)" en la posición 7/,
    'a +': /termina antes de tiempo en la posición 4/,
    'sum(a)': /se esperaba "\." en la posición 6/,
    'sum(g.x, g.y)': /sum admite un solo argumento/,
    'foo(1)': /función desconocida foo en la posición 1/,
    'round(1, a)': /segundo argumento de round debe ser un entero de 0 a 6/,
    'round(1, 7)': /segundo argumento de round/,
    'a.b': /solo puede usarse dentro de sum/,
    '1 # 2': /carácter no válido "#" en la posición 3/,
    'min(1)': /min necesita al menos 2 argumentos/,
    'abs(1, 2)': /abs necesita 1 argumentos/,
    'a b': /no se esperaba "b" en la posición 3/,
    '': /la fórmula está vacía/,
  };
  for (const [expr, message] of Object.entries(errors)) assert.throws(() => compile(expr), message, expr);
  assert.throws(() => compile('1+'.repeat(260) + '1'), /no puede superar 500 caracteres/);
  assert.throws(() => compile('('.repeat(11) + '1' + ')'.repeat(11)), /demasiados niveles de anidamiento/);
  assert.doesNotThrow(() => compile('('.repeat(10) + '1' + ')'.repeat(10)));
});

test('run: dato vacío, división por cero y sum', () => {
  assert.equal(run(compile('a * 2').ast, { a: null }, {}), null);
  assert.equal(run(compile('a / b').ast, { a: 1, b: 0 }, {}), null);
  assert.equal(run(compile('max(a, 1)').ast, {}, {}), null);
  const groups = { g: [{ x: '1.000,50' }, { x: '' }, { x: '2,25' }] };
  assert.equal(run(compile('sum(g.x)').ast, {}, groups), 1002.75);
  assert.equal(run(compile('sum(g.x)').ast, {}, { g: [] }), 0);
  assert.equal(run(compile('sum(g.x)').ast, {}, { g: [{ x: 'abc' }] }), null);
});

test('las funciones no se buscan en la cadena de prototipos', () => {
  for (const name of ['constructor', 'tostring', 'hasownproperty']) assert.throws(() => compile(`${name}(1)`), new RegExp(`función desconocida ${name}`));
  assert.equal(run(compile('sum(constructor.x)').ast, {}, {}), 0);
  assert.equal(run(compile('constructor').ast, {}, {}), null);
});

test('los espacios sobrantes se ignoran', () => {
  assert.deepEqual(compile('materialidad ').refs, ['materialidad']);
  assert.deepEqual(compile(' a + b ').refs, ['a', 'b']);
  assert.deepEqual(compile('a +\n b\t').refs, ['a', 'b']);
});

test('parseNumber: un punto tras un cero inicial es decimal', () => {
  assert.equal(parseNumber('0.500'), 0.5);
  assert.equal(parseNumber('0.123'), 0.123);
  assert.equal(parseNumber('1.234'), 1234);
});
