#!/usr/bin/env node
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { validate, lint, fail } from './validar-plantilla.mjs';

export { validate, lint };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function safeJson(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, char => ({'<':'\\u003c','>':'\\u003e','&':'\\u0026','\u2028':'\\u2028','\u2029':'\\u2029'})[char]);
}

export async function render(spec, outputPath) {
  validate(spec);
  const template = await readFile(join(ROOT, 'assets', 'assistant.html'), 'utf8');
  const evaluator = await readFile(join(ROOT, 'assets', 'evaluator.js'), 'utf8');
  const runtime = await readFile(join(ROOT, 'assets', 'assistant-runtime.js'), 'utf8');
  const logo = await readFile(join(ROOT, 'assets', 'icjce-logo.png'));
  const html = template.replace('/*__EVALUATOR__*/', () => evaluator).replace('/*__RUNTIME__*/', () => runtime).replace('/*__SPEC__*/', () => `const spec = ${safeJson(spec)};`)
    .replace('/*__LOGO__*/', () => `data:image/png;base64,${logo.toString('base64')}`);
  if (html === template || ['/*__EVALUATOR__*/', '/*__RUNTIME__*/', '/*__SPEC__*/', '/*__LOGO__*/'].some(token => html.includes(token))) fail('No se pudieron insertar los recursos del asistente');
  const target = resolve(outputPath);
  const temporary = `${target}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, html, { encoding: 'utf8', flag: 'wx' }); await rename(temporary, target); }
  catch (error) { await unlink(temporary).catch(() => {}); throw error; }
  return target;
}

async function main() {
  const [command, source, output] = process.argv.slice(2);
  if (!['validate', 'render'].includes(command) || !source || (command === 'render' && !output)) {
    console.error('Uso: node bin/generar-documento.mjs validate <plantilla.json>\n     node bin/generar-documento.mjs render <plantilla.json> <salida.html>');
    process.exitCode = 2;
    return;
  }
  const spec = validate(JSON.parse(await readFile(resolve(source), 'utf8')));
  for (const warning of lint(spec)) console.log(`Aviso: ${warning}`);
  if (command === 'validate') console.log(`Plantilla válida: ${spec.title}`);
  else console.log(await render(spec, output));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
