import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../../skills/generar-documento-auditoria/assets/evaluator.js';
import '../../skills/generar-documento-auditoria/assets/docx.js';

const { buildModel } = globalThis.DocEvaluator;
const { docxXml, tableXml, listXml } = globalThis.DocExport;
const read = async path => readFile(new URL(path, import.meta.url), 'utf8');

test('la carta de encargo v1 produce el mismo document.xml que antes', async () => {
  const example = JSON.parse(await read('../../skills/generar-documento-auditoria/examples/carta-encargo.json'));
  const data = { entidad: 'ACME & Hijos, S.A.', destinatario: 'el Consejo', fecha_cierre: '2026-12-31', auditor: 'Auditora <SL>', alcance: 'Cuentas "anuales"', tipo: 'Otro encargo' };
  assert.equal(docxXml(buildModel(example, data)), await read('./fixtures/carta-encargo.document.xml'));
});

test('tabla con cabecera repetida, filas que no se parten y texto escapado', () => {
  const out = tableXml({ headers: ['Concepto', 'Importe'], rows: [['A & B <x>', '"10"']] });
  assert.match(out, /^<w:tbl><w:tblPr><w:tblW w:w="9638" w:type="dxa"\/>/);
  assert.match(out, /<w:tr><w:trPr><w:tblHeader\/><\/w:trPr>/);
  assert.match(out, /<w:rPr><w:b\/><\/w:rPr><w:t xml:space="preserve">Concepto<\/w:t>/);
  assert.match(out, /<w:trPr><w:cantSplit\/><\/w:trPr>/);
  assert.match(out, /A &amp; B &lt;x&gt;/);
  assert.match(out, /&quot;10&quot;/);
  assert.equal((out.match(/<w:gridCol w:w="4819"\/>/g) || []).length, 2);
  assert.ok(out.endsWith('</w:tbl><w:p/>'));
});

test('lista con viñetas', () => {
  assert.equal(listXml(['Uno', 'Dos & tres']), '<w:p><w:pPr><w:ind w:left="360" w:hanging="240"/></w:pPr><w:r><w:t xml:space="preserve">• Uno</w:t></w:r></w:p><w:p><w:pPr><w:ind w:left="360" w:hanging="240"/></w:pPr><w:r><w:t xml:space="preserve">• Dos &amp; tres</w:t></w:r></w:p>');
});

test('xml descarta caracteres de control no válidos en XML 1.0', () => {
  assert.equal(globalThis.DocExport.xml('a\u0001b\u000bc\td\ne'), 'abc\td\ne');
});
