import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../../skills/generar-documento-auditoria/assets/numbers.js';
import '../../skills/generar-documento-auditoria/assets/evaluator.js';
import '../../skills/generar-documento-auditoria/assets/docx.js';
import '../../skills/generar-documento-auditoria/assets/tabular.js';

const { parseDelimited, decodeText, readZip, readXlsx, mapRows } = globalThis.DocTabular;
const { zipStore } = globalThis.DocExport;
const spec = JSON.parse(await readFile(new URL('./fixtures/confirmacion-saldos.v2.json', import.meta.url), 'utf8'));

// ZIP con entradas comprimidas (método 8), como los .xlsx reales.
async function deflatedZip(entries, declared) {
  const encoder = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const raw = encoder.encode(text);
    const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const data = new Uint8Array(await new Response(stream).arrayBuffer());
    const nameBytes = encoder.encode(name);
    const local = new Uint8Array(30);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(8, 8, true);
    lv.setUint32(18, data.length, true); lv.setUint32(22, declared ?? raw.length, true); lv.setUint16(26, nameBytes.length, true);
    const dir = new Uint8Array(46);
    const dv = new DataView(dir.buffer);
    dv.setUint32(0, 0x02014b50, true); dv.setUint16(10, 8, true);
    dv.setUint32(20, data.length, true); dv.setUint32(24, declared ?? raw.length, true); dv.setUint16(28, nameBytes.length, true); dv.setUint32(42, offset, true);
    parts.push(local, nameBytes, data);
    central.push(dir, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const size = central.reduce((n, p) => n + p.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, size, true); ev.setUint32(16, offset, true);
  return new Uint8Array(await new Blob([...parts, ...central, end]).arrayBuffer());
}

const workbook = '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/></sheets></workbook>';
const rels = '<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
const shared = '<sst><si><t>Destinatario</t></si><si><t>Saldo</t></si><si><r><t>Banco </t></r><r><t>Peñalver &amp; Cía</t></r></si><si><t>Fecha</t></si></sst>';
const sheet = '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="inlineStr"><is><t>Activo</t></is></c></row>'
  + '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>1234.5</v></c><c r="D2"><v>46022</v></c><c r="E2" t="b"><v>1</v></c></row>'
  + '<row r="3"/></sheetData></worksheet>';
const xlsxEntries = [['xl/workbook.xml', workbook], ['xl/_rels/workbook.xml.rels', rels], ['xl/sharedStrings.xml', shared], ['xl/worksheets/sheet1.xml', sheet]];

test('parseDelimited detecta tabulador, punto y coma y coma', () => {
  assert.deepEqual(parseDelimited('a\tb\n1\t2\n'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseDelimited('a;b\r\n1,5;2\r\n'), [['a', 'b'], ['1,5', '2']]);
  assert.deepEqual(parseDelimited('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
});

test('parseDelimited respeta comillas, comillas dobladas, saltos dentro de celda y filas vacías', () => {
  const text = 'Nombre;Dirección\n"Banco ""Uno""";"Calle 1\nMadrid"\n;\n\n"x;y";z';
  assert.deepEqual(parseDelimited(text), [['Nombre', 'Dirección'], ['Banco "Uno"', 'Calle 1\nMadrid'], ['x;y', 'z']]);
});

test('decodeText lee UTF-8 con y sin BOM y recurre a Windows-1252', () => {
  assert.equal(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x50, 0xc3, 0xb1])), 'Pñ');
  assert.equal(decodeText(new TextEncoder().encode('Peñalver')), 'Peñalver');
  assert.equal(decodeText(new Uint8Array([0x50, 0x65, 0xf1, 0x61])), 'Peña');
});

test('readXlsx lee la primera hoja: textos compartidos, enriquecidos, huecos, números y booleanos', async () => {
  const rows = await readXlsx(await deflatedZip(xlsxEntries));
  assert.deepEqual(rows, [
    ['Destinatario', '', 'Saldo', 'Fecha', 'Activo'],
    ['Banco Peñalver & Cía', '', { number: '1234.5' }, { number: '46022' }, 'VERDADERO'],
  ]);
});

test('readZip lee entradas sin comprimir y aplica los límites', async () => {
  const files = await readZip(zipStore([['a.txt', 'hola']]));
  assert.equal(new TextDecoder().decode(files.get('a.txt')), 'hola');
  await assert.rejects(readZip(new Uint8Array(5 * 1024 * 1024 + 1)), /supera el máximo de 5 MB/);
  const bomb = await deflatedZip([['xl/workbook.xml', 'a'.repeat(21 * 1024 * 1024)]]);
  await assert.rejects(readZip(bomb), /descomprimido supera el máximo de 20 MB/);
  const liar = await deflatedZip([['xl/workbook.xml', 'a'.repeat(21 * 1024 * 1024)]], 100);
  await assert.rejects(readZip(liar), /descomprimido supera el máximo de 20 MB/);
  await assert.rejects(readZip(new Uint8Array(100)), /no es un .xlsx válido/);
});

test('mapRows empareja por id y etiqueta e ignora columnas desconocidas', () => {
  const table = [['DESTINATARIO', 'Dirección', 'tratamiento', 'Saldo', 'Observaciones'], ['Banco Uno', 'Calle 1', 'sres.', '1.000,00', 'x']];
  const out = mapRows(spec, table);
  assert.deepEqual(out.columns, { destinatario: 0, direccion: 1, tratamiento: 2, saldo: 3 });
  assert.deepEqual(out.ignored, ['Observaciones']);
  assert.deepEqual(out.errors, []);
  assert.deepEqual(out.rows, [{ values: { destinatario: 'Banco Uno', direccion: 'Calle 1', tratamiento: 'Sres.', saldo: '1.000,00' }, errors: [] }]);
});

test('mapRows: columna obligatoria ausente, duplicada, listado vacío y límite de filas', () => {
  assert.deepEqual(mapRows(spec, [['Destinatario', 'Dirección', 'Tratamiento'], ['A', 'B', 'Sr.']]).errors, ['Falta la columna obligatoria «Saldo»']);
  assert.match(mapRows(spec, [['Destinatario', 'destinatario', 'Dirección', 'Tratamiento', 'Saldo'], ['A', 'A', 'B', 'Sr.', '1']]).errors[0], /corresponden al mismo campo \(Destinatario\)/);
  assert.deepEqual(mapRows(spec, [['Destinatario', 'Dirección', 'Tratamiento', 'Saldo']]).errors, ['El listado no tiene filas de destinatarios']);
  const many = [['Destinatario', 'Dirección', 'Tratamiento', 'Saldo'], ...Array.from({ length: 501 }, (_, i) => [`D${i}`, 'x', 'Sr.', '1'])];
  const out = mapRows(spec, many);
  assert.deepEqual(out.errors, ['El listado no puede tener más de 500 destinatarios']);
  assert.equal(out.rows.length, 500);
});

test('mapRows: errores por fila, select, fechas, números de Excel y when por fila', () => {
  const dated = { ...spec, fields: [...spec.fields, { id: 'vencimiento', label: 'Vencimiento', type: 'date' }], batch: { ...spec.batch, fields: [...spec.batch.fields, 'vencimiento'] } };
  const table = [
    ['Destinatario', 'Dirección', 'Tratamiento', 'Saldo', 'Moneda', 'Divisa', 'Vencimiento'],
    ['Banco Uno', 'Calle 1', 'Sr.', { number: '1234.5' }, 'eur', '', '31/12/2026'],
    ['Banco Dos', '', 'Doña', { number: '1000' }, 'Otra', '', { number: '46022' }],
    ['Banco Tres', 'Calle 3', 'Sres.', '7', '', '', '31/02/2026'],
  ];
  const [uno, dos, tres] = mapRows(dated, table).rows;
  assert.deepEqual(uno.values, { destinatario: 'Banco Uno', direccion: 'Calle 1', tratamiento: 'Sr.', saldo: '1234,5', moneda: 'EUR', divisa: '', vencimiento: '2026-12-31' });
  assert.deepEqual(uno.errors, []);
  assert.equal(dos.values.saldo, '1000');
  assert.equal(dos.values.vencimiento, '2025-12-31');
  assert.deepEqual(dos.errors, ['Fila 3: "Doña" no es una opción de Tratamiento', 'Fila 3: falta Dirección', 'Fila 3: falta Divisa']);
  assert.deepEqual(tres.errors, ['Fila 4: "31/02/2026" no es una fecha válida para Vencimiento']);
});

test('renderText rellena el nombre de archivo con campos y derivados', () => {
  const { renderText } = globalThis.DocEvaluator;
  assert.equal(renderText(spec, { destinatario: 'Banco Uno', tratamiento: 'Sr.' }, '{{destinatario}} - {{saludo}}'), 'Banco Uno - Muy señor nuestro:');
  assert.equal(renderText(spec, {}, 'Carta {{destinatario}}', { markMissing: true }), 'Carta [Destinatario]');
});

test('readXlsx es lineal con miles de <row> sin cerrar', async () => {
  const bad = '<worksheet><sheetData>' + '<row>'.repeat(50000) + '</sheetData></worksheet>';
  const zip = zipStore([['xl/workbook.xml', workbook], ['xl/_rels/workbook.xml.rels', rels], ['xl/worksheets/sheet1.xml', bad]]);
  const start = performance.now();
  const rows = await readXlsx(zip);
  assert.deepEqual(rows, []);
  assert.ok(performance.now() - start < 1000);
});

test('fechas de Excel fuera de rango dan el error de fila normal', () => {
  const dated = { ...spec, fields: [...spec.fields, { id: 'vencimiento', label: 'Vencimiento', type: 'date' }], batch: { ...spec.batch, fields: [...spec.batch.fields, 'vencimiento'] } };
  const table = [['Destinatario', 'Dirección', 'Tratamiento', 'Saldo', 'Vencimiento'], ['A', 'x', 'Sr.', '1', { number: '99999999' }], ['B', 'x', 'Sr.', '1', { number: '1e12' }], ['C', 'x', 'Sr.', '1', { number: '46022' }]];
  const [a, b, c] = mapRows(dated, table).rows;
  assert.deepEqual(a.errors, ['Fila 2: "99999999" no es una fecha válida para Vencimiento']);
  assert.deepEqual(b.errors, ['Fila 3: "1e12" no es una fecha válida para Vencimiento']);
  assert.deepEqual(c.errors, []);
});

test('un .xlsx truncado o con deflate corrupto se rechaza como no válido', async () => {
  const zip = zipStore([['xl/workbook.xml', workbook], ['a.txt', 'x'.repeat(200)]]);
  const truncated = new Uint8Array([...zip.subarray(0, 60), ...zip.subarray(zip.length - 22)]);
  await assert.rejects(readXlsx(truncated), /no es un .xlsx válido/);
  const good = await deflatedZip(xlsxEntries);
  const corrupt = good.slice();
  const dv = new DataView(corrupt.buffer);
  const nameLength = dv.getUint16(26, true);
  for (let i = 30 + nameLength; i < 30 + nameLength + 8; i++) corrupt[i] = 0xff;
  await assert.rejects(readXlsx(corrupt), /no es un .xlsx válido/);
});

test('el límite de columnas cuenta solo encabezados no vacíos', async () => {
  const headers = Array.from({ length: 51 }, (_, i) => `Col${i}`);
  const pasted = [headers.join('\t'), headers.map(() => 'x').join('\t')].join('\n');
  assert.deepEqual(mapRows(spec, parseDelimited(pasted)).errors.filter(e => /columnas$/.test(e)), ['El listado no puede tener más de 50 columnas']);
  const wide = '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Destinatario</t></is></c><c r="B1" t="inlineStr"><is><t>Dirección</t></is></c><c r="C1" t="inlineStr"><is><t>Tratamiento</t></is></c><c r="D1" t="inlineStr"><is><t>Saldo</t></is></c><c r="AZ1" s="3"/><c r="XFE1"><v>1</v></c></row>'
    + '<row r="2"><c r="A2" t="inlineStr"><is><t>A</t></is></c></row></sheetData></worksheet>';
  const rows = await readXlsx(await deflatedZip([['xl/workbook.xml', workbook], ['xl/_rels/workbook.xml.rels', rels], ['xl/worksheets/sheet1.xml', wide]]));
  assert.ok(rows[0].length <= 52);
  assert.ok(!mapRows(spec, rows).errors.some(e => /columnas/.test(e)));
});

test('decodeText lee UTF-16 con BOM (Texto Unicode de Excel)', () => {
  const le = new Uint8Array([0xff, 0xfe, ...[...'Peña\tx'].flatMap(c => [c.charCodeAt(0) & 255, c.charCodeAt(0) >> 8])]);
  const be = new Uint8Array([0xfe, 0xff, ...[...'Peña\tx'].flatMap(c => [c.charCodeAt(0) >> 8, c.charCodeAt(0) & 255])]);
  assert.equal(decodeText(le), 'Peña\tx');
  assert.equal(decodeText(be), 'Peña\tx');
});

test('mapRows: un campo number acepta formato español y números de Excel; los de texto conservan los dígitos', () => {
  const numeric = structuredClone(spec);
  numeric.fields.find(f => f.id === 'saldo').type = 'number';
  numeric.fields.push({ id: 'codigo_postal', label: 'Código postal', type: 'text' });
  numeric.batch.fields.push('codigo_postal');
  const table = [
    ['Destinatario', 'Dirección', 'Tratamiento', 'Saldo', 'Código postal'],
    ['Uno', 'C/ 1', 'Sr.', { number: '1.234' }, { number: '28001' }],
    ['Dos', 'C/ 2', 'Sr.', '2.500,75', '08001'],
    ['Tres', 'C/ 3', 'Sr.', 'mucho', ''],
  ];
  const [uno, dos, tres] = mapRows(numeric, table).rows;
  assert.equal(uno.values.saldo, '1,234');
  assert.equal(uno.values.codigo_postal, '28001');
  assert.deepEqual(uno.errors, []);
  assert.equal(dos.values.saldo, '2.500,75');
  assert.equal(dos.values.codigo_postal, '08001');
  assert.deepEqual(tres.errors, ['Fila 4: "mucho" no es un número válido para Saldo']);
  const { buildModel } = globalThis.DocEvaluator;
  const letter = buildModel(numeric, { ...uno.values, entidad: 'E', fecha_cierre: '2026-12-31', auditor: 'A', direccion_respuesta: 'R' });
  assert.ok(letter.sections[1].paragraphs.includes('Texto de prueba: según nuestros registros, el saldo a esa fecha es de 1,23.'));
});
