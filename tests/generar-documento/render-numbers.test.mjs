import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { render } from '../../skills/generar-documento-auditoria/bin/generar-documento.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/materialidad.v2.json', import.meta.url), 'utf8'));

test('el HTML incrusta DocNumbers después del evaluador y antes de DocExport', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asistente-'));
  try {
    const html = await readFile(await render(fixture, join(dir, 'asistente.html')), 'utf8');
    const evaluator = html.indexOf('root.DocEvaluator = ');
    const numbers = html.indexOf('root.DocNumbers = ');
    const exporter = html.indexOf('root.DocExport = ');
    assert.ok(evaluator > 0 && evaluator < numbers && numbers < exporter, `${evaluator} < ${numbers} < ${exporter}`);
    assert.ok(!html.includes('/*__NUMBERS__*/'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
