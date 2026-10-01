#!/usr/bin/env node
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ID = /^[a-z][a-z0-9_]*$/;
const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;

function fail(message) { throw new Error(message); }
function nonempty(value, path, max = 5000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${path}: texto obligatorio (máximo ${max} caracteres)`);
}

export function validate(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) fail('El documento debe ser un objeto JSON');
  if (spec.schema_version !== 1) fail('schema_version debe ser 1');
  nonempty(spec.title, 'title', 180);
  if (spec.subtitle !== undefined) nonempty(spec.subtitle, 'subtitle', 220);
  if (!Array.isArray(spec.fields) || spec.fields.length < 1 || spec.fields.length > 50) fail('fields debe contener entre 1 y 50 campos');
  const ids = new Set();
  for (const [i, field] of spec.fields.entries()) {
    if (!field || typeof field !== 'object') fail(`fields[${i}] debe ser un objeto`);
    if (typeof field.id !== 'string' || !ID.test(field.id) || ids.has(field.id)) fail(`fields[${i}].id no válido o duplicado`);
    ids.add(field.id);
    nonempty(field.label, `fields[${i}].label`, 120);
    if (!['text', 'textarea', 'date', 'select'].includes(field.type)) fail(`fields[${i}].type no válido`);
    if (field.required !== undefined && typeof field.required !== 'boolean') fail(`fields[${i}].required debe ser booleano`);
    if (field.value !== undefined && typeof field.value !== 'string') fail(`fields[${i}].value debe ser texto`);
    if (field.help !== undefined) nonempty(field.help, `fields[${i}].help`, 400);
    if (field.type === 'select' && (!Array.isArray(field.options) || !field.options.length || field.options.some(x => typeof x !== 'string' || !x.trim()))) fail(`fields[${i}].options no válido`);
  }
  for (const [path, value] of [['title', spec.title], ['subtitle', spec.subtitle || '']]) {
    for (const [, id] of value.matchAll(PLACEHOLDER)) if (!ids.has(id)) fail(`${path}: campo desconocido {{${id}}`);
  }
  if (!Array.isArray(spec.sections) || spec.sections.length < 1 || spec.sections.length > 50) fail('sections debe contener entre 1 y 50 secciones');
  for (const [i, section] of spec.sections.entries()) {
    if (!section || typeof section !== 'object') fail(`sections[${i}] debe ser un objeto`);
    nonempty(section.heading, `sections[${i}].heading`, 180);
    for (const [, id] of section.heading.matchAll(PLACEHOLDER)) if (!ids.has(id)) fail(`sections[${i}].heading: campo desconocido {{${id}}}`);
    if (!Array.isArray(section.paragraphs) || !section.paragraphs.length || section.paragraphs.length > 50) fail(`sections[${i}].paragraphs no válido`);
    for (const [j, paragraph] of section.paragraphs.entries()) {
      nonempty(paragraph, `sections[${i}].paragraphs[${j}]`, 10000);
      for (const [, id] of paragraph.matchAll(PLACEHOLDER)) if (!ids.has(id)) fail(`sections[${i}].paragraphs[${j}]: campo desconocido {{${id}}}`);
    }
    if (section.when !== undefined) {
      if (!section.when || !ids.has(section.when.field) || typeof section.when.equals !== 'string') fail(`sections[${i}].when no válido`);
    }
  }
  if (spec.sources !== undefined) {
    if (!Array.isArray(spec.sources) || spec.sources.length > 20) fail('sources debe ser una lista de hasta 20 fuentes');
    for (const [i, source] of spec.sources.entries()) {
      nonempty(source?.title, `sources[${i}].title`, 250);
      try { if (new URL(source.url).protocol !== 'https:') fail('Se exige URL HTTPS'); }
      catch { fail(`sources[${i}].url debe ser una URL HTTPS`); }
    }
  }
  if (spec.include_sources_in_output !== undefined && typeof spec.include_sources_in_output !== 'boolean') fail('include_sources_in_output debe ser booleano');
  return spec;
}

function safeJson(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, char => ({'<':'\\u003c','>':'\\u003e','&':'\\u0026','\u2028':'\\u2028','\u2029':'\\u2029'})[char]);
}

export async function render(spec, outputPath) {
  validate(spec);
  const template = await readFile(join(ROOT, 'assets', 'assistant.html'), 'utf8');
  const runtime = await readFile(join(ROOT, 'assets', 'assistant-runtime.js'), 'utf8');
  const logo = await readFile(join(ROOT, 'assets', 'icjce-logo.png'));
  const html = template.replace('/*__RUNTIME__*/', runtime).replace('/*__SPEC__*/', `const spec = ${safeJson(spec)};`)
    .replace('/*__LOGO__*/', `data:image/png;base64,${logo.toString('base64')}`);
  if (html === template || ['/*__RUNTIME__*/', '/*__SPEC__*/', '/*__LOGO__*/'].some(token => html.includes(token))) fail('No se pudieron insertar los recursos del asistente');
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
  if (command === 'validate') console.log(`Plantilla válida: ${spec.title}`);
  else console.log(await render(spec, output));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
