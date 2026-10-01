import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { render } from '../../skills/generar-documento-auditoria/bin/generar-documento.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/confirmacion-saldos.v2.json', import.meta.url), 'utf8'));

test('el HTML incrusta DocTabular después de DocExport y antes del runtime', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asistente-'));
  try {
    const html = await readFile(await render(fixture, join(dir, 'asistente.html')), 'utf8');
    const exporter = html.indexOf('root.DocExport = ');
    const tabular = html.indexOf('root.DocTabular = ');
    const runtime = html.indexOf('globalThis.DocTabular;');
    assert.ok(exporter > 0 && exporter < tabular && tabular < runtime, `${exporter} < ${tabular} < ${runtime}`);
    assert.ok(!html.includes('/*__TABULAR__*/'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
