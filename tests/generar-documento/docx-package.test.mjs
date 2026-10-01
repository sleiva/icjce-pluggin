import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../../skills/generar-documento-auditoria/assets/evaluator.js';
import '../../skills/generar-documento-auditoria/assets/docx.js';

const { buildModel } = globalThis.DocEvaluator;
const { docxPackage, zipStore, safeFilename } = globalThis.DocExport;
const example = JSON.parse(await readFile(new URL('../../skills/generar-documento-auditoria/examples/carta-encargo.json', import.meta.url), 'utf8'));
const data = { entidad: 'ACME & Hijos, S.A.', destinatario: 'el Consejo', fecha_cierre: '2026-12-31', auditor: 'Auditora <SL>', alcance: 'Cuentas "anuales"', tipo: 'Otro encargo' };

test('docxPackage produce los mismos bytes que el runtime anterior', async () => {
  const reference = new Uint8Array(await readFile(new URL('./fixtures/carta-encargo.docx', import.meta.url)));
  assert.deepEqual(docxPackage(buildModel(example, data)), reference);
});

test('zipStore acepta texto y bytes y escribe un ZIP sin compresión', () => {
  const inner = zipStore([['a.txt', 'hola']]);
  const out = zipStore([['uno.txt', 'ñ'], ['dentro.zip', inner]]);
  const view = new DataView(out.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint16(8, true), 0, 'método 0 (sin compresión)');
  const end = out.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 10, true), 2);
  const name = new TextDecoder().decode(out.slice(30, 30 + view.getUint16(26, true)));
  assert.equal(name, 'uno.txt');
  assert.deepEqual([...out.slice(37, 39)], [0xc3, 0xb1]);
});

test('safeFilename limpia, recorta y numera duplicados', () => {
  const used = new Set();
  assert.equal(safeFilename('Banco: Uno / Dos?', used), 'Banco Uno Dos');
  assert.equal(safeFilename('banco uno dos', used), 'banco uno dos (2)');
  assert.equal(safeFilename('Banco Uno Dos', used), 'Banco Uno Dos (3)');
  assert.equal(safeFilename('  ', used), 'documento');
  assert.equal(safeFilename('x'.repeat(120), used).length, 80);
});
