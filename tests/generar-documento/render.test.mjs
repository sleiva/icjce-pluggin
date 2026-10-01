import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { render } from '../../skills/generar-documento-auditoria/bin/generar-documento.mjs';
import '../../skills/generar-documento-auditoria/assets/evaluator.js';

const { buildModel } = globalThis.DocEvaluator;
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const example = await read('../../skills/generar-documento-auditoria/examples/carta-encargo.json');
const fixture = await read('./fixtures/comunicacion-gobierno.v2.json');
const plain = ({ title, subtitle, sections, sources }) => ({ title, subtitle, sections, sources });

test('la plantilla v1 genera el mismo documento que antes', () => {
  const data = { entidad: 'ACME, S.A.', destinatario: 'el Consejo', fecha_cierre: '2026-12-31', auditor: 'Auditora, S.L.', alcance: 'Cuentas anuales', tipo: 'Otro encargo' };
  assert.deepEqual(plain(buildModel(example, data)), {
    title: 'Carta de encargo de auditoría',
    subtitle: 'Ejercicio terminado el 2026-12-31',
    sections: [
      { heading: 'Destinatario', paragraphs: ['A la atención de el Consejo de ACME, S.A..'] },
      { heading: 'Objeto del encargo', paragraphs: ['Se documenta el encargo de auditoría de ACME, S.A. correspondiente al ejercicio terminado el 2026-12-31.', 'Alcance acordado: Cuentas anuales'] },
      { heading: 'Identificación del auditor', paragraphs: ['Auditor o firma: Auditora, S.L..'] },
      { heading: 'Tipo de trabajo', paragraphs: ['El tipo de encargo indicado requiere revisar y adaptar todas las cláusulas antes de su firma.'] },
    ],
    sources: [],
  });
  assert.equal(buildModel(example, { ...data, tipo: 'Auditoría de cuentas anuales' }).sections.length, 3);
});

const base = { entidad: 'Prueba', ejercicio: '2026', organo: 'Consejo', incertidumbre: false, asuntos: [], encargante: '' };

test('plantilla v2: no EIP, opinión favorable', () => {
  const model = buildModel(fixture, { ...base, forma: 'S.L.', eip: 'No', opinion: 'Favorable', fundamento: 'oculto' });
  assert.equal(model.title, 'Comunicación de prueba a Consejo');
  assert.equal(model.subtitle, 'Prueba · ejercicio 2026');
  assert.deepEqual(model.sections, [
    { heading: 'Introducción', paragraphs: ['Texto de prueba dirigido a los socios de Prueba.'] },
    { heading: 'Opinión', paragraphs: ['Texto de prueba de opinión favorable.'] },
  ]);
  assert.deepEqual(model.stats, { included: 2, total: 6 });
});

test('plantilla v2: EIP con salvedades, incertidumbre y fraude', () => {
  const model = buildModel(fixture, { ...base, forma: 'S.A.', eip: 'Sí', opinion: 'Con salvedades', fundamento: 'Limitación X', incertidumbre: true, asuntos: ['Indicios de fraude'], encargante: 'Banco Y' });
  assert.deepEqual(model.sections.map(s => s.heading), ['Introducción', 'Opinión', 'Incertidumbre material', 'Asuntos comunicados', 'Requisitos EIP', 'Cierre']);
  assert.deepEqual(model.sections[0].paragraphs, ['Texto de prueba dirigido a los accionistas de Prueba por encargo de Banco Y.']);
  assert.deepEqual(model.sections[1].paragraphs, ['Texto de prueba de opinión modificada: Limitación X']);
  assert.deepEqual(model.sections[3].paragraphs, ['Texto de prueba sobre fraude.']);
});

test('el HTML incrusta evaluador, runtime y plantilla', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asistente-'));
  try {
    const html = await readFile(await render(fixture, join(dir, 'asistente.html')), 'utf8');
    assert.match(html, /globalThis\.DocEvaluator|root\.DocEvaluator = /);
    assert.match(html, /const spec = \{"schema_version":2/);
    for (const token of ['/*__EVALUATOR__*/', '/*__RUNTIME__*/', '/*__SPEC__*/', '/*__LOGO__*/']) assert.ok(!html.includes(token), token);
    assert.ok(html.indexOf('root.DocEvaluator = ') < html.indexOf('globalThis.DocEvaluator;'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
