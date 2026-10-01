# Grupos repetibles y tablas — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir al motor de `generar-documento-auditoria` el campo repetible `group` y el párrafo `repeat` (tabla, lista o bloques), con exportación DOCX de tablas y listas, sin alterar las plantillas existentes.

**Architecture:** El evaluador compartido (`assets/evaluator.js`) aprende a limpiar filas y resolver `repeat` en `buildModel`, que ahora puede devolver elementos `{ table }` y `{ list }`. La generación de WordprocessingML sale del runtime a `assets/docx.js` (`globalThis.DocExport`), incrustado en el HTML entre el evaluador y el runtime y probado en Node. El validador (`bin/validar-plantilla.mjs`) valida grupos, subcampos y `repeat`, y los incluye en la alcanzabilidad y en los avisos.

**Tech Stack:** Node 22 (ESM, `node:test`, sin dependencias), JavaScript de navegador sin compilación, Python 3 (`scripts/validate.py`, requiere `requirements-dev.txt`).

**Spec:** `docs/superpowers/specs/2026-10-01-grupos-repetibles-design.md`

## Global Constraints

- Sin dependencias nuevas. El HTML generado sigue siendo un único archivo autónomo.
- `examples/carta-encargo.json` y `tests/generar-documento/fixtures/comunicacion-gobierno.v2.json` deben producir el mismo `buildModel` que hoy, y la carta de encargo el mismo `document.xml` (referencia capturada en la tarea 1 **antes** de tocar el runtime).
- Pruebas en `tests/generar-documento/`, ejecutadas con `node --test tests/generar-documento/*.test.mjs`. Texto de prueba sintético; nada de texto del ICJCE.
- Mensajes de error y aviso en español, empezando por la ruta JSON.
- `zip()` y `docx()` del runtime no cambian; solo se elimina de él el bloque `xml` / `paragraphXml` / `docxXml`, que pasa a `assets/docx.js`.
- Todo el código del plan se prototipó y se ensayó tarea por tarea sobre una copia limpia de la rama (30 → 37 → 44 pruebas, `validate.py` OK, flujo comprobado en navegador); transcribirlo tal cual.

**User decisions (already made):**
- «a, las tres»: cubrir tabla, lista y bloques con un único campo repetible.
- Subcampos `text`, `textarea`, `date`, `select`; importes como texto; sin condiciones por fila; solo `filled` sobre un grupo; `min_rows`/`max_rows` con tope 50; la fila de total queda para el subproyecto 4.
- Enfoque A: la presentación se declara en un párrafo `repeat` dentro de la sección; el campo solo guarda datos.
- Listas en DOCX con viñeta «•» y sangría, sin `numbering.xml`.
- Extraer `docxXml` a `assets/docx.js` para poder probarlo.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `skills/generar-documento-auditoria/assets/docx.js` (nuevo) | WordprocessingML: `xml`, `paragraphXml`, `tableXml`, `listXml`, `docxXml` en `globalThis.DocExport`. |
| `skills/generar-documento-auditoria/assets/evaluator.js` | Añade `filledRows`, grupos en `emptyValue`/`isEmpty`/`effectiveData`, subcampos en `fill` y `repeat` en `buildModel`. |
| `skills/generar-documento-auditoria/bin/validar-plantilla.mjs` | Valida `group`, subcampos y `repeat`; alcanzabilidad y avisos de grupos. |
| `skills/generar-documento-auditoria/bin/generar-documento.mjs` | Incrusta `docx.js` en el hueco `/*__DOCX__*/`. |
| `skills/generar-documento-auditoria/assets/assistant-runtime.js` | Usa `DocExport.docxXml`; UI de filas; tablas y listas en la vista previa. |
| `skills/generar-documento-auditoria/assets/assistant.html` | Hueco `/*__DOCX__*/`; estilos de filas, tablas y listas. |
| `tests/generar-documento/` | `docx.test.mjs`, `render-docx.test.mjs`, `groups.test.mjs`, `validator-groups.test.mjs`, `fixtures/carta-encargo.document.xml`, `fixtures/comunicacion-final.v2.json`. |
| `skills/generar-documento-auditoria/references/*.md`, `skills/generar-documento-auditoria/SKILL.md`, `scripts/validate.py` | Documentación y comprobaciones del repositorio. |

---

### Task 1: Exportación DOCX en `assets/docx.js`

**Goal:** Sacar la generación de `document.xml` del runtime a `assets/docx.js` con soporte de tablas y listas, incrustarlo en el HTML y fijar con una referencia que la salida actual no cambia.

**Files:**
- Create: `skills/generar-documento-auditoria/assets/docx.js`
- Create: `tests/generar-documento/fixtures/carta-encargo.document.xml` (generado en el paso 1)
- Modify: `skills/generar-documento-auditoria/assets/assistant-runtime.js` (línea 3 y bloque desde `const xml = value =>` hasta antes de `function zip(files) {`)
- Modify: `skills/generar-documento-auditoria/assets/assistant.html` (hueco `/*__DOCX__*/`)
- Modify: `skills/generar-documento-auditoria/bin/generar-documento.mjs` (función `render`)
- Test: `tests/generar-documento/docx.test.mjs`, `tests/generar-documento/render-docx.test.mjs`

**Acceptance Criteria:**
- [ ] `tests/generar-documento/fixtures/carta-encargo.document.xml` se genera con el runtime **anterior** al cambio y el test `la carta de encargo v1 produce el mismo document.xml que antes` pasa con `docx.js`.
- [ ] `node --test tests/generar-documento/*.test.mjs` → `# pass 30`, `# fail 0`.
- [ ] El runtime ya no define `xml`, `paragraphXml` ni `docxXml` y toma `docxXml` de `globalThis.DocExport`; `zip()` y `docx()` no cambian.
- [ ] En el HTML generado, `root.DocExport = ` aparece después de `root.DocEvaluator = ` y antes de `globalThis.DocExport;`.

**Verify:** `node --test tests/generar-documento/*.test.mjs` → `# pass 30`, `# fail 0`

**Steps:**

- [ ] **Step 1: Capturar la referencia con el código actual (antes de modificar nada)**

Guarda este script **fuera del repositorio** (por ejemplo en `$TMPDIR/capture-docx-reference.mjs`) y ejecútalo desde la raíz del repositorio con `node $TMPDIR/capture-docx-reference.mjs`:

````js
// Captura el document.xml que produce hoy el runtime para la carta de encargo (referencia v1).
import { readFile, writeFile } from 'node:fs/promises';
const root = process.cwd();
await import(`${root}/skills/generar-documento-auditoria/assets/evaluator.js`);
const runtime = await readFile(`${root}/skills/generar-documento-auditoria/assets/assistant-runtime.js`, 'utf8');
const block = runtime.slice(runtime.indexOf('  const xml = value =>'), runtime.indexOf('  function zip(files) {'));
const docxXml = new Function(`${block}; return docxXml;`)();
const example = JSON.parse(await readFile(`${root}/skills/generar-documento-auditoria/examples/carta-encargo.json`, 'utf8'));
const data = { entidad: 'ACME & Hijos, S.A.', destinatario: 'el Consejo', fecha_cierre: '2026-12-31', auditor: 'Auditora <SL>', alcance: 'Cuentas "anuales"', tipo: 'Otro encargo' };
await writeFile(`${root}/tests/generar-documento/fixtures/carta-encargo.document.xml`, docxXml(globalThis.DocEvaluator.buildModel(example, data)));
console.log('referencia escrita');
````

Expected: `referencia escrita` y el archivo `tests/generar-documento/fixtures/carta-encargo.document.xml` (1622 bytes) creado.

- [ ] **Step 2: Escribir las pruebas**

`tests/generar-documento/docx.test.mjs`:

````js
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
````

`tests/generar-documento/render-docx.test.mjs`:

````js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { render } from '../../skills/generar-documento-auditoria/bin/generar-documento.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/comunicacion-gobierno.v2.json', import.meta.url), 'utf8'));

test('el HTML incrusta DocExport entre el evaluador y el runtime', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asistente-'));
  try {
    const html = await readFile(await render(fixture, join(dir, 'asistente.html')), 'utf8');
    const evaluator = html.indexOf('root.DocEvaluator = ');
    const exporter = html.indexOf('root.DocExport = ');
    const runtime = html.indexOf('globalThis.DocExport;');
    assert.ok(evaluator > 0 && evaluator < exporter && exporter < runtime, `${evaluator} < ${exporter} < ${runtime}`);
    assert.ok(!html.includes('/*__DOCX__*/'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
````

- [ ] **Step 3: Ejecutar y comprobar que fallan**

Run: `node --test tests/generar-documento/docx.test.mjs tests/generar-documento/render-docx.test.mjs`
Expected: FAIL (`Cannot find module` sobre `assets/docx.js` y, en render, `root.DocExport = ` ausente).

- [ ] **Step 4: Crear `assets/docx.js`**

````js
/* WordprocessingML del documento final a partir de `buildModel`. Sin dependencias; se
   incrusta en el HTML (antes del runtime, que empaqueta el DOCX) y lo prueban en Node. */
(function (root) {
  'use strict';
  const PAGE_WIDTH = 9638; // A4 (11906) menos márgenes de 1134 a cada lado, en twips.
  const BORDERS = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map(side => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join('');

  const xml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const paragraphXml = (value, style = '') => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${xml(value)}</w:t></w:r></w:p>`;

  function tableXml(table) {
    const width = Math.floor(PAGE_WIDTH / table.headers.length);
    const cell = (text, header) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr><w:p><w:r>${header ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p></w:tc>`;
    const head = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${table.headers.map(text => cell(text, true)).join('')}</w:tr>`;
    const body = table.rows.map(row => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${row.map(text => cell(text, false)).join('')}</w:tr>`).join('');
    const grid = table.headers.map(() => `<w:gridCol w:w="${width}"/>`).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="${PAGE_WIDTH}" w:type="dxa"/><w:tblBorders>${BORDERS}</w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${head}${body}</w:tbl><w:p/>`;
  }

  // Viñeta «•» con sangría francesa: evita añadir numbering.xml al paquete.
  const listXml = items => items.map(text => `<w:p><w:pPr><w:ind w:left="360" w:hanging="240"/></w:pPr><w:r><w:t xml:space="preserve">${xml(`• ${text}`)}</w:t></w:r></w:p>`).join('');

  function itemXml(item) {
    if (typeof item === 'string') return paragraphXml(item);
    if (item.table) return tableXml(item.table);
    return listXml(item.list);
  }

  function docxXml(output) {
    const parts = [paragraphXml(output.title, 'Title')];
    if (output.subtitle) parts.push(paragraphXml(output.subtitle, 'Subtitle'));
    for (const section of output.sections) {
      parts.push(paragraphXml(section.heading, 'Heading1'));
      for (const item of section.paragraphs) parts.push(itemXml(item));
    }
    if (output.sources.length) {
      parts.push(paragraphXml('Fuentes', 'Heading1'));
      for (const source of output.sources) parts.push(paragraphXml(`${source.title}: ${source.url}`));
    }
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${parts.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;
  }

  root.DocExport = { xml, paragraphXml, tableXml, listXml, docxXml };
})(globalThis);
````

- [ ] **Step 5: Conectar runtime, HTML y renderizador**

En `skills/generar-documento-auditoria/assets/assistant-runtime.js`, tras la línea `  const { buildModel, effectiveData, isEmpty } = globalThis.DocEvaluator;` añade:

```js
  const { docxXml } = globalThis.DocExport;
```

y elimina todo el bloque desde la línea `  const xml = value => …` hasta la línea anterior a `  function zip(files) {` (son las definiciones de `xml`, `paragraphXml` y `docxXml`; `zip` se queda).

En `skills/generar-documento-auditoria/assets/assistant.html`, sustituye:

```html
    /*__EVALUATOR__*/
```
por:
```html
    /*__EVALUATOR__*/
    /*__DOCX__*/
```

En `skills/generar-documento-auditoria/bin/generar-documento.mjs`, dentro de `render`:
- tras `  const evaluator = await readFile(join(ROOT, 'assets', 'evaluator.js'), 'utf8');` añade `  const docx = await readFile(join(ROOT, 'assets', 'docx.js'), 'utf8');`
- sustituye `.replace('/*__EVALUATOR__*/', () => evaluator)` por `.replace('/*__EVALUATOR__*/', () => evaluator).replace('/*__DOCX__*/', () => docx)`
- sustituye `['/*__EVALUATOR__*/', '/*__RUNTIME__*/',` por `['/*__EVALUATOR__*/', '/*__DOCX__*/', '/*__RUNTIME__*/',`

- [ ] **Step 6: Ejecutar la suite**

Run: `node --check skills/generar-documento-auditoria/assets/assistant-runtime.js && node --test tests/generar-documento/*.test.mjs`
Expected: `# pass 30`, `# fail 0`.

- [ ] **Step 7: Commit**

```bash
git add skills/generar-documento-auditoria/assets/docx.js skills/generar-documento-auditoria/assets/assistant-runtime.js skills/generar-documento-auditoria/assets/assistant.html skills/generar-documento-auditoria/bin/generar-documento.mjs tests/generar-documento/docx.test.mjs tests/generar-documento/render-docx.test.mjs tests/generar-documento/fixtures/carta-encargo.document.xml
git commit -m "Extract DOCX export with tables and lists into a shared module"
```

```json:metadata
{"files": ["skills/generar-documento-auditoria/assets/docx.js", "skills/generar-documento-auditoria/assets/assistant-runtime.js", "skills/generar-documento-auditoria/assets/assistant.html", "skills/generar-documento-auditoria/bin/generar-documento.mjs", "tests/generar-documento/docx.test.mjs", "tests/generar-documento/render-docx.test.mjs", "tests/generar-documento/fixtures/carta-encargo.document.xml"], "verifyCommand": "node --test tests/generar-documento/*.test.mjs", "acceptanceCriteria": ["reference document.xml captured from the pre-change runtime and matched by docx.js", "suite reports # pass 30 and # fail 0", "runtime takes docxXml from globalThis.DocExport; zip() and docx() unchanged", "DocExport is inlined between the evaluator and the runtime"], "modelTier": "mechanical"}
```

---

### Task 2: Grupos en el evaluador

**Goal:** Que `buildModel` limpie las filas de los grupos y resuelva los párrafos `repeat` como tabla, lista o bloques.

**Files:**
- Modify: `skills/generar-documento-auditoria/assets/evaluator.js` (sustitución completa)
- Create: `tests/generar-documento/fixtures/comunicacion-final.v2.json`
- Test: `tests/generar-documento/groups.test.mjs`

**Acceptance Criteria:**
- [ ] `node --test tests/generar-documento/*.test.mjs` → `# pass 37`, `# fail 0`.
- [ ] `globalThis.DocEvaluator` expone además `filledRows`; las filas con todos los subcampos vacíos no cuentan para `filled` ni aparecen en el documento.
- [ ] `buildModel` devuelve `{ table: { headers, rows } }` para `as: "table"`, `{ list: [...] }` para `as: "list"` y textos para `as: "blocks"`; sin filas usa `empty` o elimina el elemento.
- [ ] Las pruebas existentes de `evaluator.test.mjs` y `render.test.mjs` siguen pasando sin cambios.

**Verify:** `node --test tests/generar-documento/*.test.mjs` → `# pass 37`, `# fail 0`

**Steps:**

- [ ] **Step 1: Crear la plantilla de prueba sintética**

`tests/generar-documento/fixtures/comunicacion-final.v2.json`:

````json
{
  "schema_version": 2,
  "title": "Comunicación final de prueba a {{organo}}",
  "fields": [
    { "id": "entidad", "label": "Entidad", "type": "text", "required": true },
    { "id": "organo", "label": "Órgano destinatario", "type": "text", "required": true },
    { "id": "incorrecciones", "label": "Incorrecciones no corregidas", "type": "group", "max_rows": 5, "help": "Una fila por incorrección.",
      "fields": [
        { "id": "concepto", "label": "Concepto", "type": "text", "required": true },
        { "id": "efecto_resultado", "label": "Efecto en resultado", "type": "text" },
        { "id": "efecto_patrimonio", "label": "Efecto en patrimonio neto", "type": "text" }
      ] },
    { "id": "total_incorrecciones", "label": "Total de incorrecciones", "type": "text", "when": { "field": "incorrecciones", "filled": true } },
    { "id": "pendientes", "label": "Asuntos pendientes", "type": "group", "required": true, "min_rows": 1,
      "value": [ { "asunto": "Carta de manifestaciones firmada" } ],
      "fields": [
        { "id": "asunto", "label": "Asunto", "type": "text", "required": true },
        { "id": "responsable", "label": "Responsable", "type": "select", "options": ["Dirección", "Auditor"] }
      ] },
    { "id": "deficiencias", "label": "Deficiencias de control", "type": "group",
      "fields": [
        { "id": "descripcion", "label": "Descripción", "type": "textarea", "required": true },
        { "id": "recomendacion", "label": "Recomendación", "type": "textarea" }
      ] }
  ],
  "sections": [
    { "heading": "Introducción", "paragraphs": ["Texto de prueba dirigido a {{organo}} de {{entidad}}."] },
    { "heading": "Incorrecciones no corregidas", "when": { "field": "incorrecciones", "filled": true }, "paragraphs": [
      "Texto de prueba previo a la tabla de incorrecciones:",
      { "repeat": "incorrecciones", "as": "table" },
      "Total de prueba: {{total_incorrecciones}}"
    ] },
    { "heading": "Asuntos pendientes", "paragraphs": [
      "Texto de prueba previo a la lista:",
      { "repeat": "pendientes", "as": "list", "item": "{{asunto}} (responsable: {{responsable}})" }
    ] },
    { "heading": "Deficiencias de control", "paragraphs": [
      { "repeat": "deficiencias", "as": "blocks", "paragraphs": ["Deficiencia de prueba: {{descripcion}}", "Recomendación de prueba: {{recomendacion}}"],
        "empty": "Texto de prueba: no hay deficiencias en {{entidad}}." }
    ] }
  ],
  "sources": [],
  "include_sources_in_output": false
}
````

- [ ] **Step 2: Escribir las pruebas**

`tests/generar-documento/groups.test.mjs`:

````js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../../skills/generar-documento-auditoria/assets/evaluator.js';
import '../../skills/generar-documento-auditoria/assets/docx.js';

const { buildModel, effectiveData, isEmpty, evaluate } = globalThis.DocEvaluator;
const { docxXml } = globalThis.DocExport;
const fixture = JSON.parse(await readFile(new URL('./fixtures/comunicacion-final.v2.json', import.meta.url), 'utf8'));
const group = fixture.fields.find(field => field.id === 'incorrecciones');
const base = { entidad: 'Prueba', organo: 'Consejo', pendientes: [{ asunto: 'Cartas de abogados', responsable: 'Dirección' }] };
const section = (model, heading) => model.sections.find(s => s.heading === heading);

test('filas en blanco descartadas y filled sobre grupo', () => {
  const rows = [{ concepto: '  ' }, { concepto: 'Provisión', efecto_resultado: '10' }, {}];
  assert.equal(isEmpty(group, rows), false);
  assert.equal(isEmpty(group, [{ concepto: ' ' }]), true);
  const { data } = effectiveData(fixture, { incorrecciones: rows });
  assert.deepEqual(data.incorrecciones, [{ concepto: 'Provisión', efecto_resultado: '10' }]);
  assert.equal(evaluate({ field: 'incorrecciones', filled: true }, data, fixture), true);
  assert.equal(evaluate({ field: 'incorrecciones', filled: true }, effectiveData(fixture, {}).data, fixture), false);
});

test('grupo oculto vale lista vacía', () => {
  const spec = { fields: [{ id: 'm', type: 'checkbox' }, { ...group, when: { field: 'm', checked: true } }] };
  assert.deepEqual(effectiveData(spec, { m: false, incorrecciones: [{ concepto: 'x' }] }).data.incorrecciones, []);
});

test('tabla con todas las columnas y con columns', () => {
  const model = buildModel(fixture, { ...base, incorrecciones: [{ concepto: 'Provisión', efecto_resultado: '10' }], total_incorrecciones: '10' });
  assert.deepEqual(section(model, 'Incorrecciones no corregidas').paragraphs, [
    'Texto de prueba previo a la tabla de incorrecciones:',
    { table: { headers: ['Concepto', 'Efecto en resultado', 'Efecto en patrimonio neto'], rows: [['Provisión', '10', '']] } },
    'Total de prueba: 10',
  ]);
  const narrow = structuredClone(fixture);
  narrow.sections[1].paragraphs[1].columns = ['efecto_resultado', 'concepto'];
  const table = section(buildModel(narrow, { ...base, incorrecciones: [{ concepto: 'Provisión', efecto_resultado: '10' }] }), 'Incorrecciones no corregidas').paragraphs[1].table;
  assert.deepEqual(table, { headers: ['Efecto en resultado', 'Concepto'], rows: [['10', 'Provisión']] });
});

test('lista y bloques', () => {
  const model = buildModel(fixture, { ...base, deficiencias: [{ descripcion: 'Sin conciliaciones', recomendacion: 'Conciliar' }, { descripcion: 'Accesos' }] });
  assert.deepEqual(section(model, 'Asuntos pendientes').paragraphs, ['Texto de prueba previo a la lista:', { list: ['Cartas de abogados (responsable: Dirección)'] }]);
  assert.deepEqual(section(model, 'Deficiencias de control').paragraphs, [
    'Deficiencia de prueba: Sin conciliaciones', 'Recomendación de prueba: Conciliar',
    'Deficiencia de prueba: Accesos', 'Recomendación de prueba: ',
  ]);
});

test('empty cuando no hay filas; sin empty el párrafo y la sección desaparecen', () => {
  const model = buildModel(fixture, base);
  assert.deepEqual(section(model, 'Deficiencias de control').paragraphs, ['Texto de prueba: no hay deficiencias en Prueba.']);
  assert.equal(section(model, 'Incorrecciones no corregidas'), undefined);
  const noEmpty = structuredClone(fixture);
  delete noEmpty.sections[3].paragraphs[0].empty;
  assert.equal(section(buildModel(noEmpty, base), 'Deficiencias de control'), undefined);
});

test('subcampo vacío marcado en la vista previa', () => {
  const model = buildModel(fixture, { ...base, pendientes: [{ asunto: 'Actas' }] }, { markMissing: true });
  assert.deepEqual(section(model, 'Asuntos pendientes').paragraphs[1], { list: ['Actas (responsable: [Responsable])'] });
});

test('documento con tabla y lista', async () => {
  const out = docxXml(buildModel(fixture, { entidad: 'Prueba', organo: 'Consejo', incorrecciones: [{ concepto: 'Provisión' }], pendientes: [{ asunto: 'Actas' }] }));
  assert.equal((out.match(/<w:tbl>/g) || []).length, 1);
  assert.match(out, /• Actas \(responsable: \)/);
});
````

- [ ] **Step 3: Ejecutar y comprobar que fallan**

Run: `node --test tests/generar-documento/groups.test.mjs`
Expected: FAIL (por ejemplo, `isEmpty` devuelve `true` para un grupo con filas, y no hay elementos `table`/`list`).

- [ ] **Step 4: Sustituir `assets/evaluator.js` por completo**

````js
/* Evaluador de plantillas del asistente documental: condiciones, visibilidad de campos,
   textos derivados, grupos repetibles y documento final. Sin dependencias; se incrusta en
   el HTML y lo importa el validador de Node, de modo que lo comprobado es lo que se ejecuta. */
(function (root) {
  'use strict';
  const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;
  const own = (object, key) => Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
  const textOf = value => (typeof value === 'string' ? value.trim() : '');

  function emptyValue(field) {
    if (field.type === 'checkbox') return false;
    if (field.type === 'multiselect' || field.type === 'group') return [];
    return '';
  }

  // Filas de un grupo con algún subcampo relleno; las filas en blanco no cuentan.
  function filledRows(field, value) {
    if (!Array.isArray(value)) return [];
    return value.filter(row => row && typeof row === 'object' && field.fields.some(sub => textOf(row[sub.id])));
  }

  function isEmpty(field, value) {
    if (field.type === 'checkbox') return value !== true;
    if (field.type === 'multiselect') return !Array.isArray(value) || value.length === 0;
    if (field.type === 'group') return filledRows(field, value).length === 0;
    return typeof value !== 'string' || !value.trim();
  }

  function evaluate(condition, data, spec) {
    if (!condition) return true;
    if ('all' in condition) return condition.all.every(item => evaluate(item, data, spec));
    if ('any' in condition) return condition.any.some(item => evaluate(item, data, spec));
    if ('not' in condition) return !evaluate(condition.not, data, spec);
    if ('ref' in condition) {
      const target = own(spec.conditions, condition.ref) ? spec.conditions[condition.ref] : null;
      if (!target) throw new Error(`Condición desconocida: ${condition.ref}`);
      return evaluate(target, data, spec);
    }
    const field = spec.fields.find(item => item.id === condition.field);
    if (!field) throw new Error(`Campo desconocido: ${condition.field}`);
    const value = data[condition.field];
    const text = textOf(value);
    if ('equals' in condition) return text === condition.equals;
    if ('in' in condition) return condition.in.includes(text);
    if ('checked' in condition) return (value === true) === condition.checked;
    if ('includes' in condition) return Array.isArray(value) && value.includes(condition.includes);
    if ('filled' in condition) return !isEmpty(field, value) === condition.filled;
    throw new Error('Condición no reconocida');
  }

  // Los campos con `when` solo pueden depender de campos anteriores (lo exige el
  // validador), así que basta una pasada en orden. Un campo oculto vale vacío y un
  // grupo conserva solo sus filas con contenido.
  function effectiveData(spec, raw) {
    const source = raw || {};
    const data = {};
    const visible = {};
    for (const field of spec.fields) {
      const shown = !field.when || evaluate(field.when, data, spec);
      visible[field.id] = shown;
      const value = shown && source[field.id] !== undefined ? source[field.id] : emptyValue(field);
      data[field.id] = field.type === 'group' ? filledRows(field, value) : value;
    }
    return { data, visible };
  }

  // `row` y `group` permiten usar los subcampos de una fila dentro de un `repeat`.
  function fill(template, data, derived, spec, markMissing, row, group) {
    return template.replace(PLACEHOLDER, (_, id) => {
      if (Object.prototype.hasOwnProperty.call(derived, id)) return derived[id];
      const sub = group ? group.fields.find(item => item.id === id) : null;
      const text = textOf(sub ? row[id] : data[id]);
      if (text || !markMissing) return text;
      const field = sub || spec.fields.find(item => item.id === id);
      return `[${field ? field.label : id}]`;
    });
  }

  function resolveDerived(spec, data, markMissing) {
    const out = {};
    for (const [id, definition] of Object.entries(spec.derived || {})) {
      const hit = definition.cases.find(item => evaluate(item.when, data, spec));
      out[id] = fill(hit ? hit.text : definition.default, data, {}, spec, markMissing);
    }
    return out;
  }

  // Elementos de documento de un párrafo `repeat`: textos, `{ table }` o `{ list }`.
  function repeatItems(item, spec, data, derived, markMissing) {
    const group = spec.fields.find(field => field.id === item.repeat);
    const rows = data[item.repeat] || [];
    const format = (template, row) => fill(template, data, derived, spec, markMissing, row, group);
    if (!rows.length) return item.empty ? [format(item.empty, {})] : [];
    if (item.as === 'table') {
      const columns = (item.columns || group.fields.map(sub => sub.id)).map(id => group.fields.find(sub => sub.id === id));
      return [{ table: {
        headers: columns.map(sub => sub.label),
        rows: rows.map(row => columns.map(sub => format(`{{${sub.id}}}`, row))),
      } }];
    }
    if (item.as === 'list') return [{ list: rows.map(row => format(item.item, row)) }];
    return rows.flatMap(row => item.paragraphs.map(template => format(template, row)));
  }

  function buildModel(spec, raw, options) {
    const markMissing = Boolean(options && options.markMissing);
    const { data } = effectiveData(spec, raw);
    const derived = resolveDerived(spec, data, markMissing);
    const format = template => fill(template, data, derived, spec, markMissing);
    const sections = [];
    for (const section of spec.sections) {
      if (section.when && !evaluate(section.when, data, spec)) continue;
      const paragraphs = [];
      for (const entry of section.paragraphs) {
        const item = typeof entry === 'string' ? { text: entry } : entry;
        if (item.when && !evaluate(item.when, data, spec)) continue;
        if (item.repeat) paragraphs.push(...repeatItems(item, spec, data, derived, markMissing));
        else paragraphs.push(format(item.text));
      }
      if (paragraphs.length) sections.push({ heading: format(section.heading), paragraphs });
    }
    return {
      title: format(spec.title),
      subtitle: spec.subtitle ? format(spec.subtitle) : '',
      sections,
      sources: spec.include_sources_in_output ? (spec.sources || []) : [],
      stats: { included: sections.length, total: spec.sections.length },
    };
  }

  root.DocEvaluator = { PLACEHOLDER, emptyValue, filledRows, isEmpty, evaluate, effectiveData, buildModel };
})(globalThis);
````

- [ ] **Step 5: Ejecutar la suite**

Run: `node --test tests/generar-documento/*.test.mjs`
Expected: `# pass 37`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add skills/generar-documento-auditoria/assets/evaluator.js tests/generar-documento/groups.test.mjs tests/generar-documento/fixtures/comunicacion-final.v2.json
git commit -m "Evaluate repeatable groups as tables, lists and blocks"
```

```json:metadata
{"files": ["skills/generar-documento-auditoria/assets/evaluator.js", "tests/generar-documento/groups.test.mjs", "tests/generar-documento/fixtures/comunicacion-final.v2.json"], "verifyCommand": "node --test tests/generar-documento/*.test.mjs", "acceptanceCriteria": ["suite reports # pass 37 and # fail 0", "blank rows are dropped and DocEvaluator exposes filledRows", "buildModel returns table, list and block items and honours empty", "existing evaluator and render tests pass unchanged"], "modelTier": "mechanical"}
```

---

### Task 3: Grupos en el validador

**Goal:** Validar campos `group`, subcampos y párrafos `repeat`, e incluirlos en la alcanzabilidad y en los avisos.

**Files:**
- Modify: `skills/generar-documento-auditoria/bin/validar-plantilla.mjs` (sustitución completa)
- Test: `tests/generar-documento/validator-groups.test.mjs`

**Acceptance Criteria:**
- [ ] `node --test tests/generar-documento/*.test.mjs` → `# pass 44`, `# fail 0`.
- [ ] `fixtures/comunicacion-final.v2.json` valida y `lint` no devuelve avisos.
- [ ] Un subcampo usado en una condición falla con `es un subcampo del grupo … las condiciones no pueden usar subcampos`; `{{subcampo}}` fuera de su `repeat` falla con `solo puede usarse en sus párrafos repeat`.
- [ ] Las pruebas existentes de `validator.test.mjs` siguen pasando sin cambios.

**Verify:** `node --test tests/generar-documento/*.test.mjs` → `# pass 44`, `# fail 0`

**Steps:**

- [ ] **Step 1: Escribir las pruebas**

`tests/generar-documento/validator-groups.test.mjs`:

````js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validate, lint } from '../../skills/generar-documento-auditoria/bin/validar-plantilla.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/comunicacion-final.v2.json', import.meta.url), 'utf8'));

function spec(groupOverrides = {}, paragraph = { repeat: 'filas', as: 'table' }, extra = {}) {
  return {
    schema_version: 2,
    title: 'Prueba {{texto}}',
    fields: [
      { id: 'texto', label: 'Texto', type: 'text' },
      { id: 'filas', label: 'Filas', type: 'group', fields: [
        { id: 'concepto', label: 'Concepto', type: 'text' },
        { id: 'tipo', label: 'Tipo', type: 'select', options: ['A', 'B'] },
      ], ...groupOverrides },
    ],
    sections: [{ heading: 'Uno', paragraphs: [paragraph] }],
    ...extra,
  };
}

test('la plantilla de prueba con grupos es válida y sin avisos', () => {
  assert.doesNotThrow(() => validate(fixture));
  assert.deepEqual(lint(fixture), []);
});

test('estructura del grupo', () => {
  assert.throws(() => validate(spec({ fields: [] })), /fields\[1\]\.fields debe contener entre 1 y 8 subcampos/);
  assert.throws(() => validate(spec({ fields: Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, label: 'S', type: 'text' })) })), /entre 1 y 8 subcampos/);
  assert.throws(() => validate(spec({ fields: [{ id: 'concepto', label: 'C', type: 'checkbox' }] })), /fields\[1\]\.fields\[0\]\.type no válido/);
  assert.throws(() => validate(spec({ fields: [{ id: 'concepto', label: 'C', type: 'text', when: { field: 'texto', filled: true } }] })), /fields\[1\]\.fields\[0\]: clave desconocida when/);
  assert.throws(() => validate(spec({ fields: [{ id: 'tipo', label: 'T', type: 'select', options: ['A '] }] })), /no pueden empezar ni terminar con espacios/);
  assert.throws(() => validate(spec({ max_rows: 0 })), /max_rows debe ser al menos 1/);
  assert.throws(() => validate(spec({ max_rows: 51 })), /max_rows debe ser un entero entre 0 y 50/);
  assert.throws(() => validate(spec({ min_rows: 3, max_rows: 2 })), /min_rows no puede ser mayor que max_rows/);
  assert.throws(() => validate(spec({ value: [{ otro: 'x' }] })), /value\[0\]: otro no es un subcampo del grupo/);
  assert.throws(() => validate(spec({ value: [{ tipo: 'C' }] })), /value\[0\]\.tipo: "C" no es una opción/);
  assert.throws(() => validate(spec({ max_rows: 1, value: [{}, {}] })), /value debe ser una lista de hasta 1 filas/);
  assert.throws(() => validate(spec({ minrows: 1 })), /fields\[1\]: clave desconocida minrows/);
});

test('identificadores de subcampo únicos en toda la plantilla', () => {
  assert.throws(() => validate(spec({ fields: [{ id: 'texto', label: 'T', type: 'text' }] })), /fields\[1\]\.fields\[0\]\.id no válido o duplicado/);
});

test('uso del grupo y de los subcampos', () => {
  const when = { heading: 'Dos', when: { field: 'filas', equals: 'x' }, paragraphs: ['x'] };
  assert.throws(() => validate({ ...spec(), sections: [spec().sections[0], when] }), /operador equals no se admite en campos group/);
  const sub = { heading: 'Dos', when: { field: 'concepto', filled: true }, paragraphs: ['x'] };
  assert.throws(() => validate({ ...spec(), sections: [spec().sections[0], sub] }), /concepto es un subcampo del grupo filas; las condiciones no pueden usar subcampos/);
  assert.throws(() => validate(spec({}, '{{filas}}')), /\{\{filas\}\} es un campo group y no puede insertarse/);
  assert.throws(() => validate(spec({}, '{{concepto}}')), /\{\{concepto\}\} es un subcampo del grupo filas y solo puede usarse en sus párrafos repeat/);
});

test('párrafo repeat', () => {
  assert.throws(() => validate(spec({}, { repeat: 'texto', as: 'table' })), /repeat: texto no es un campo group/);
  assert.throws(() => validate(spec({}, { repeat: 'nada', as: 'table' })), /repeat: campo desconocido nada/);
  assert.throws(() => validate(spec({}, { repeat: 'filas', as: 'grid' })), /as debe ser table, list, blocks/);
  assert.throws(() => validate(spec({}, { repeat: 'filas', as: 'table', item: 'x' })), /clave desconocida item \(para as: table\)/);
  assert.throws(() => validate(spec({}, { repeat: 'filas', as: 'list' })), /\.item: texto obligatorio/);
  assert.throws(() => validate(spec({}, { repeat: 'filas', as: 'blocks', paragraphs: [] })), /paragraphs debe contener entre 1 y 10 textos/);
  assert.throws(() => validate(spec({}, { repeat: 'filas', as: 'table', columns: ['concepto', 'concepto'] })), /columns debe ser una lista no vacía sin repeticiones/);
  assert.throws(() => validate(spec({}, { repeat: 'filas', as: 'table', columns: ['texto'] })), /columns\[0\]: texto no es un subcampo de filas/);
  assert.throws(() => validate(spec({}, { repeat: 'filas', as: 'list', item: '{{concepto}}', empty: 'Sin {{concepto}}' })), /empty: \{\{concepto\}\} es un subcampo/);
  const other = spec({}, { repeat: 'filas', as: 'list', item: '{{otro}}' });
  other.fields.push({ id: 'g2', label: 'G2', type: 'group', fields: [{ id: 'otro', label: 'O', type: 'text' }] });
  other.sections.push({ heading: 'Dos', paragraphs: [{ repeat: 'g2', as: 'table' }] });
  assert.throws(() => validate(other), /\{\{otro\}\} es un subcampo del grupo g2/);
  assert.doesNotThrow(() => validate(spec({}, { repeat: 'filas', as: 'list', item: '{{concepto}} de {{texto}}', empty: 'Nada en {{texto}}.' })));
});

test('alcanzabilidad con grupos', () => {
  const hidden = spec({ when: { field: 'texto', equals: 'x' } }, { repeat: 'filas', as: 'table', when: { field: 'texto', equals: 'y' } });
  assert.throws(() => validate(hidden), /sections\[0\]: inalcanzable/);
  const withEmpty = spec({ when: { field: 'texto', equals: 'x' } }, { repeat: 'filas', as: 'table', empty: 'Sin filas.' });
  assert.doesNotThrow(() => validate(withEmpty));
});

test('avisos de grupos', () => {
  const unused = spec({}, '{{texto}}');
  assert.ok(lint(validate(unused)).some(w => /campo filas: el grupo no se usa en ningún párrafo repeat/.test(w)));
  const sub = spec({}, { repeat: 'filas', as: 'table', columns: ['concepto'] });
  assert.ok(lint(validate(sub)).some(w => /el subcampo tipo no aparece en ninguna columna ni plantilla/.test(w)));
  const marker = spec({}, { repeat: 'filas', as: 'list', item: '{{concepto}} {{tipo}} [2]' });
  assert.ok(lint(validate(marker)).some(w => /paragraphs\[0\]\.item: parece contener una marca del modelo/.test(w)));
});
````

- [ ] **Step 2: Ejecutar y comprobar que fallan**

Run: `node --test tests/generar-documento/validator-groups.test.mjs`
Expected: FAIL (`fields[2].type no válido` al validar la plantilla de prueba).

- [ ] **Step 3: Sustituir `bin/validar-plantilla.mjs` por completo**

````js
// Validación de plantillas del asistente documental. Los errores detienen la generación;
// los avisos (`lint`) se muestran y la habilidad debe revisarlos.
import '../assets/evaluator.js';

const { evaluate, effectiveData } = globalThis.DocEvaluator;
const ID = /^[a-z][a-z0-9_]*$/;
const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;
const TYPES_V1 = ['text', 'textarea', 'date', 'select'];
const TYPES_V2 = [...TYPES_V1, 'checkbox', 'multiselect', 'group'];
const SUB_TYPES = TYPES_V1;
const REPEAT_AS = ['table', 'list', 'blocks'];
const LEAF_OPS = ['equals', 'in', 'checked', 'includes', 'filled'];
const OPERATORS = [...LEAF_OPS, 'all', 'any', 'not', 'ref'];
const FIELD_OPS = {
  equals: ['select', 'text'],
  in: ['select', 'text'],
  checked: ['checkbox'],
  includes: ['multiselect'],
  filled: ['text', 'textarea', 'date', 'select', 'multiselect', 'group'],
};
const MAX_DEPTH = 3;
const MAX_COMBINATIONS = 4096;
const MARKERS = /\[●\]|X{3,}|\[\s*(?:Incluir|Adaptar)[^\]]*\]|\[\^?\d+\s*\]|\[\/?RECUADRO\]/i;
const KEYS = {
  spec: ['schema_version', 'title', 'subtitle', 'fields', 'conditions', 'derived', 'sections', 'sources', 'include_sources_in_output'],
  field: ['id', 'label', 'type', 'required', 'value', 'help', 'options', 'when'],
  group: ['id', 'label', 'type', 'required', 'value', 'help', 'when', 'fields', 'min_rows', 'max_rows'],
  subfield: ['id', 'label', 'type', 'required', 'help', 'options'],
  section: ['heading', 'paragraphs', 'when'],
  source: ['title', 'url'],
  derived: ['cases', 'default'],
  derivedCase: ['when', 'text'],
  paragraph: ['text', 'when'],
  table: ['repeat', 'as', 'when', 'empty', 'columns'],
  list: ['repeat', 'as', 'when', 'empty', 'item'],
  blocks: ['repeat', 'as', 'when', 'empty', 'paragraphs'],
};
const MAX_ROWS = 50;
const MAX_SUBFIELDS = 8;
const MAX_BLOCK_PARAGRAPHS = 10;
const own = (object, key) => Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);

export function fail(message) { throw new Error(message); }

function nonempty(value, path, max = 5000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${path}: texto obligatorio (máximo ${max} caracteres)`);
}

function plain(value) {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

export function suggest(value, options) {
  const target = plain(value);
  const exact = options.find(option => plain(option) === target);
  if (exact) return exact;
  let best = null;
  let bestDistance = Infinity;
  for (const option of options) {
    const d = distance(target, plain(option));
    if (d < bestDistance) { best = option; bestDistance = d; }
  }
  return bestDistance <= 3 ? best : null;
}

// Campos que lee una condición, expandiendo `ref`.
export function fieldsOf(condition, spec, out = new Set()) {
  if (!condition || typeof condition !== 'object') return out;
  if (Array.isArray(condition.all)) condition.all.forEach(item => fieldsOf(item, spec, out));
  else if (Array.isArray(condition.any)) condition.any.forEach(item => fieldsOf(item, spec, out));
  else if (own(condition, 'not')) fieldsOf(condition.not, spec, out);
  else if (own(condition, 'ref')) fieldsOf(spec.conditions?.[condition.ref], spec, out);
  else if (typeof condition.field === 'string') out.add(condition.field);
  return out;
}

function depthOf(condition, spec) {
  if (Array.isArray(condition.all)) return 1 + Math.max(...condition.all.map(item => depthOf(item, spec)));
  if (Array.isArray(condition.any)) return 1 + Math.max(...condition.any.map(item => depthOf(item, spec)));
  if (own(condition, 'not')) return 1 + depthOf(condition.not, spec);
  if (own(condition, 'ref')) return depthOf(spec.conditions[condition.ref], spec);
  return 1;
}

function checkCondition(condition, path, ctx, opts) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) fail(`${path}: condición no válida`);
  const keys = Object.keys(condition);
  const ops = keys.filter(key => OPERATORS.includes(key));
  if (ops.length !== 1) fail(`${path}: la condición debe tener exactamente un operador (${OPERATORS.join(', ')})`);
  const [op] = ops;
  const allowed = LEAF_OPS.includes(op) ? ['field', op] : [op];
  const extra = keys.find(key => !allowed.includes(key));
  if (extra) fail(`${path}: clave desconocida ${extra}`);
  if (opts.depth > MAX_DEPTH) fail(`${path}: anidamiento máximo de ${MAX_DEPTH} niveles`);
  if (op === 'all' || op === 'any') {
    if (!Array.isArray(condition[op]) || condition[op].length < 2) fail(`${path}.${op}: necesita al menos 2 condiciones`);
    condition[op].forEach((item, i) => checkCondition(item, `${path}.${op}[${i}]`, ctx, { ...opts, depth: opts.depth + 1 }));
    return;
  }
  if (op === 'not') return checkCondition(condition.not, `${path}.not`, ctx, { ...opts, depth: opts.depth + 1 });
  if (op === 'ref') {
    if (!opts.allowRef) fail(`${path}: una condición con nombre no puede usar ref`);
    if (typeof condition.ref !== 'string' || !own(ctx.spec.conditions, condition.ref)) fail(`${path}.ref: condición desconocida ${condition.ref}`);
    const target = ctx.spec.conditions[condition.ref];
    if (opts.depth - 1 + depthOf(target, ctx.spec) > MAX_DEPTH) fail(`${path}: anidamiento máximo de ${MAX_DEPTH} niveles (incluida la condición ${condition.ref})`);
    if (opts.before) {
      for (const id of fieldsOf(target, ctx.spec)) if (!opts.before.has(id)) fail(`${path}: la condición ${condition.ref} usa ${id}, que debe declararse antes de este campo`);
    }
    return;
  }
  const field = ctx.fields.get(condition.field);
  if (!field && ctx.subfields.has(condition.field)) fail(`${path}.field: ${condition.field} es un subcampo del grupo ${ctx.subfields.get(condition.field).id}; las condiciones no pueden usar subcampos`);
  if (!field) fail(`${path}.field: campo desconocido ${condition.field}`);
  if (opts.before && !opts.before.has(field.id)) fail(`${path}.field: ${field.id} debe declararse antes del campo que lo usa en when`);
  if (!FIELD_OPS[op].includes(field.type)) fail(`${path}: el operador ${op} no se admite en campos ${field.type}`);
  const value = (v, p) => {
    if (typeof v !== 'string' || !v.trim()) fail(`${p}: valor no válido`);
    if (field.options && !field.options.includes(v)) {
      const hint = suggest(v, field.options);
      fail(`${p}: "${v}" no es una opción de ${field.id}${hint ? `. ¿Querías decir "${hint}"?` : ''}`);
    }
  };
  if (op === 'equals') value(condition.equals, `${path}.equals`);
  if (op === 'includes') value(condition.includes, `${path}.includes`);
  if (op === 'in') {
    if (!Array.isArray(condition.in) || !condition.in.length) fail(`${path}.in: necesita una lista no vacía`);
    condition.in.forEach((v, i) => value(v, `${path}.in[${i}]`));
  }
  if ((op === 'checked' || op === 'filled') && typeof condition[op] !== 'boolean') fail(`${path}.${op} debe ser booleano`);
}

// `group`: grupo cuyos subcampos pueden usarse (plantillas de un `repeat`).
function checkPlaceholders(text, path, ctx, allowDerived, group = null) {
  for (const [, id] of text.matchAll(PLACEHOLDER)) {
    const field = ctx.fields.get(id);
    if (field) {
      if (field.type === 'checkbox' || field.type === 'multiselect' || field.type === 'group') fail(`${path}: {{${id}}} es un campo ${field.type} y no puede insertarse como texto`);
      continue;
    }
    if (ctx.subfields.has(id)) {
      if (ctx.subfields.get(id) === group) continue;
      fail(`${path}: {{${id}}} es un subcampo del grupo ${ctx.subfields.get(id).id} y solo puede usarse en sus párrafos repeat`);
    }
    if (own(ctx.spec.derived, id)) {
      if (!allowDerived) fail(`${path}: un texto derivado no puede usar otro derivado {{${id}}}`);
      continue;
    }
    if (own(ctx.spec.conditions, id)) fail(`${path}: {{${id}}} es una condición y no puede insertarse como texto`);
    fail(`${path}: campo desconocido {{${id}}}`);
  }
}

function checkField(field, i, ctx) {
  const path = `fields[${i}]`;
  if (!field || typeof field !== 'object') fail(`${path} debe ser un objeto`);
  nonempty(field.label, `${path}.label`, 120);
  if (!TYPES_V2.includes(field.type)) fail(`${path}.type no válido`);
  if (!TYPES_V1.includes(field.type)) ctx.needV2(`${path}.type ${field.type}`);
  if (field.required !== undefined && typeof field.required !== 'boolean') fail(`${path}.required debe ser booleano`);
  if (field.help !== undefined) nonempty(field.help, `${path}.help`, 400);
  if (field.type === 'select' || field.type === 'multiselect') checkOptions(field.options, `${path}.options`);
  else if (field.type === 'checkbox' && field.options !== undefined) fail(`${path}: un checkbox no admite options`);
  if (field.type === 'group') return checkGroup(field, path, ctx);
  if (field.value !== undefined) {
    if (field.type === 'checkbox') { if (typeof field.value !== 'boolean') fail(`${path}.value debe ser booleano`); }
    else if (field.type === 'multiselect') { if (!Array.isArray(field.value) || field.value.some(x => !field.options.includes(x))) fail(`${path}.value debe ser una lista de opciones`); }
    else if (typeof field.value !== 'string') fail(`${path}.value debe ser texto`);
  }
  if (field.when !== undefined) ctx.needV2(`${path}.when`);
}

function checkOptions(options, path) {
  if (!Array.isArray(options) || !options.length || options.some(x => typeof x !== 'string' || !x.trim()) || new Set(options).size !== options.length) fail(`${path} no válido`);
  const padded = options.find(x => x !== x.trim());
  if (padded !== undefined) fail(`${path}: las opciones no pueden empezar ni terminar con espacios ("${padded}")`);
}

function checkGroup(group, path, ctx) {
  if (!Array.isArray(group.fields) || group.fields.length < 1 || group.fields.length > MAX_SUBFIELDS) fail(`${path}.fields debe contener entre 1 y ${MAX_SUBFIELDS} subcampos`);
  for (const [k, sub] of group.fields.entries()) {
    const p = `${path}.fields[${k}]`;
    if (!sub || typeof sub !== 'object' || Array.isArray(sub)) fail(`${p} debe ser un objeto`);
    const extra = Object.keys(sub).find(key => !KEYS.subfield.includes(key));
    if (extra) fail(`${p}: clave desconocida ${extra}`);
    ctx.claim(sub.id, `${p}.id`);
    ctx.subfields.set(sub.id, group);
    nonempty(sub.label, `${p}.label`, 120);
    if (!SUB_TYPES.includes(sub.type)) fail(`${p}.type no válido (subcampos: ${SUB_TYPES.join(', ')})`);
    if (sub.required !== undefined && typeof sub.required !== 'boolean') fail(`${p}.required debe ser booleano`);
    if (sub.help !== undefined) nonempty(sub.help, `${p}.help`, 400);
    if (sub.type === 'select') checkOptions(sub.options, `${p}.options`);
    else if (sub.options !== undefined) fail(`${p}: solo un subcampo select admite options`);
  }
  const rowsLimit = (key, fallback) => {
    if (group[key] === undefined) return fallback;
    if (!Number.isInteger(group[key]) || group[key] < 0 || group[key] > MAX_ROWS) fail(`${path}.${key} debe ser un entero entre 0 y ${MAX_ROWS}`);
    return group[key];
  };
  const min = rowsLimit('min_rows', 0);
  const max = rowsLimit('max_rows', MAX_ROWS);
  if (max < 1) fail(`${path}.max_rows debe ser al menos 1`);
  if (min > max) fail(`${path}: min_rows no puede ser mayor que max_rows`);
  if (group.value !== undefined) {
    if (!Array.isArray(group.value) || group.value.length > max) fail(`${path}.value debe ser una lista de hasta ${max} filas`);
    for (const [r, row] of group.value.entries()) {
      const p = `${path}.value[${r}]`;
      if (!row || typeof row !== 'object' || Array.isArray(row)) fail(`${p} debe ser un objeto`);
      for (const [key, value] of Object.entries(row)) {
        const sub = group.fields.find(item => item.id === key);
        if (!sub) fail(`${p}: ${key} no es un subcampo del grupo`);
        if (typeof value !== 'string') fail(`${p}.${key} debe ser texto`);
        if (sub.type === 'select' && value && !sub.options.includes(value)) fail(`${p}.${key}: "${value}" no es una opción`);
      }
    }
  }
  if (group.when !== undefined) ctx.needV2(`${path}.when`);
}

function checkRepeat(item, path, ctx) {
  const group = ctx.fields.get(item.repeat);
  if (!group && ctx.subfields.has(item.repeat)) fail(`${path}.repeat: ${item.repeat} es un subcampo, no un grupo`);
  if (!group) fail(`${path}.repeat: campo desconocido ${item.repeat}`);
  if (group.type !== 'group') fail(`${path}.repeat: ${item.repeat} no es un campo group`);
  if (!REPEAT_AS.includes(item.as)) fail(`${path}.as debe ser ${REPEAT_AS.join(', ')}`);
  const extra = Object.keys(item).find(key => !KEYS[item.as].includes(key));
  if (extra) fail(`${path}: clave desconocida ${extra} (para as: ${item.as})`);
  if (item.empty !== undefined) {
    nonempty(item.empty, `${path}.empty`, 2000);
    checkPlaceholders(item.empty, `${path}.empty`, ctx, true);
  }
  if (item.as === 'table' && item.columns !== undefined) {
    if (!Array.isArray(item.columns) || !item.columns.length || new Set(item.columns).size !== item.columns.length) fail(`${path}.columns debe ser una lista no vacía sin repeticiones`);
    item.columns.forEach((id, k) => { if (!group.fields.some(sub => sub.id === id)) fail(`${path}.columns[${k}]: ${id} no es un subcampo de ${group.id}`); });
  }
  if (item.as === 'list') {
    nonempty(item.item, `${path}.item`, 2000);
    checkPlaceholders(item.item, `${path}.item`, ctx, true, group);
  }
  if (item.as === 'blocks') {
    if (!Array.isArray(item.paragraphs) || !item.paragraphs.length || item.paragraphs.length > MAX_BLOCK_PARAGRAPHS) fail(`${path}.paragraphs debe contener entre 1 y ${MAX_BLOCK_PARAGRAPHS} textos`);
    item.paragraphs.forEach((text, k) => {
      nonempty(text, `${path}.paragraphs[${k}]`, 10000);
      checkPlaceholders(text, `${path}.paragraphs[${k}]`, ctx, true, group);
    });
  }
  if (item.when !== undefined) checkCondition(item.when, `${path}.when`, ctx, { depth: 1, allowRef: true });
}

// Claves no reconocidas, como lista de mensajes `<ruta>: clave desconocida <clave>`.
export function unknownKeys(spec) {
  const out = [];
  const check = (object, allowed, path) => {
    if (!object || typeof object !== 'object' || Array.isArray(object)) return;
    for (const key of Object.keys(object)) if (!allowed.includes(key)) out.push(`${path ? `${path}: ` : ''}clave desconocida ${key}`);
  };
  const each = (list, allowed, prefix) => { if (Array.isArray(list)) list.forEach((item, i) => check(item, allowed, `${prefix}[${i}]`)); };
  check(spec, KEYS.spec, '');
  if (Array.isArray(spec.fields)) spec.fields.forEach((field, i) => check(field, field?.type === 'group' ? KEYS.group : KEYS.field, `fields[${i}]`));
  each(spec.sections, KEYS.section, 'sections');
  each(spec.sources, KEYS.source, 'sources');
  if (spec.derived && typeof spec.derived === 'object' && !Array.isArray(spec.derived)) {
    for (const [id, definition] of Object.entries(spec.derived)) {
      check(definition, KEYS.derived, `derived.${id}`);
      each(definition?.cases, KEYS.derivedCase, `derived.${id}.cases`);
    }
  }
  return out;
}

export function validate(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) fail('El documento debe ser un objeto JSON');
  if (spec.schema_version !== 1 && spec.schema_version !== 2) fail('schema_version debe ser 1 o 2');
  const v2 = spec.schema_version === 2;
  if (v2) { const [unknown] = unknownKeys(spec); if (unknown) fail(unknown); }
  const max = v2 ? 80 : 50;
  const fields = new Map();
  const names = new Set();
  const claim = (id, path) => {
    if (typeof id !== 'string' || !ID.test(id) || names.has(id)) fail(`${path} no válido o duplicado`);
    names.add(id);
  };
  const ctx = { spec, fields, subfields: new Map(), claim, needV2: path => { if (!v2) fail(`${path}: requiere schema_version 2`); } };
  nonempty(spec.title, 'title', 180);
  if (spec.subtitle !== undefined) nonempty(spec.subtitle, 'subtitle', 220);
  if (!Array.isArray(spec.fields) || spec.fields.length < 1 || spec.fields.length > max) fail(`fields debe contener entre 1 y ${max} campos`);
  for (const [i, field] of spec.fields.entries()) {
    if (!field || typeof field !== 'object') fail(`fields[${i}] debe ser un objeto`);
    claim(field.id, `fields[${i}].id`);
    checkField(field, i, ctx);
    fields.set(field.id, field);
  }
  for (const [key, label] of [['conditions', 'conditions'], ['derived', 'derived']]) {
    if (spec[key] === undefined) continue;
    ctx.needV2(label);
    if (!spec[key] || typeof spec[key] !== 'object' || Array.isArray(spec[key])) fail(`${label} debe ser un objeto`);
    for (const name of Object.keys(spec[key])) claim(name, `${label}.${name}`);
  }
  for (const [name, condition] of Object.entries(spec.conditions || {})) {
    checkCondition(condition, `conditions.${name}`, ctx, { depth: 1, allowRef: false });
  }
  const before = new Set();
  for (const [i, field] of spec.fields.entries()) {
    if (field.when !== undefined) checkCondition(field.when, `fields[${i}].when`, ctx, { depth: 1, allowRef: true, before });
    before.add(field.id);
  }
  for (const [id, definition] of Object.entries(spec.derived || {})) {
    const path = `derived.${id}`;
    if (!definition || typeof definition !== 'object' || !Array.isArray(definition.cases) || !definition.cases.length) fail(`${path}.cases debe ser una lista no vacía`);
    if (typeof definition.default !== 'string' || definition.default.length > 2000) fail(`${path}.default debe ser texto (puede estar vacío)`);
    checkPlaceholders(definition.default, `${path}.default`, ctx, false);
    for (const [j, item] of definition.cases.entries()) {
      if (!item || typeof item !== 'object') fail(`${path}.cases[${j}] debe ser un objeto`);
      nonempty(item.text, `${path}.cases[${j}].text`, 2000);
      checkPlaceholders(item.text, `${path}.cases[${j}].text`, ctx, false);
      checkCondition(item.when, `${path}.cases[${j}].when`, ctx, { depth: 1, allowRef: true });
    }
  }
  checkPlaceholders(spec.title, 'title', ctx, true);
  if (spec.subtitle !== undefined) checkPlaceholders(spec.subtitle, 'subtitle', ctx, true);
  if (!Array.isArray(spec.sections) || spec.sections.length < 1 || spec.sections.length > max) fail(`sections debe contener entre 1 y ${max} secciones`);
  for (const [i, section] of spec.sections.entries()) {
    const path = `sections[${i}]`;
    if (!section || typeof section !== 'object') fail(`${path} debe ser un objeto`);
    nonempty(section.heading, `${path}.heading`, 180);
    checkPlaceholders(section.heading, `${path}.heading`, ctx, true);
    if (!Array.isArray(section.paragraphs) || !section.paragraphs.length || section.paragraphs.length > 50) fail(`${path}.paragraphs no válido`);
    for (const [j, paragraph] of section.paragraphs.entries()) {
      const p = `${path}.paragraphs[${j}]`;
      if (typeof paragraph === 'string') {
        nonempty(paragraph, p, 10000);
        checkPlaceholders(paragraph, p, ctx, true);
        continue;
      }
      ctx.needV2(`${p} (párrafo con condición o repeat)`);
      if (paragraph && typeof paragraph === 'object' && own(paragraph, 'repeat')) { checkRepeat(paragraph, p, ctx); continue; }
      if (!paragraph || typeof paragraph !== 'object' || Object.keys(paragraph).some(key => key !== 'text' && key !== 'when')) fail(`${p}: debe ser texto, { text, when } o { repeat, as, … }`);
      nonempty(paragraph.text, `${p}.text`, 10000);
      checkPlaceholders(paragraph.text, `${p}.text`, ctx, true);
      if (paragraph.when !== undefined) checkCondition(paragraph.when, `${p}.when`, ctx, { depth: 1, allowRef: true });
    }
    if (section.when !== undefined) {
      if (!v2 && (!section.when || typeof section.when !== 'object' || Object.keys(section.when).sort().join() !== 'equals,field')) fail(`${path}.when no válido`);
      checkCondition(section.when, `${path}.when`, ctx, { depth: 1, allowRef: true });
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
  const { unreachable } = reachability(spec);
  if (unreachable.length) fail(`${unreachable[0]}: inalcanzable; ninguna combinación de respuestas puede mostrarlo`);
  return spec;
}

// --- Alcanzabilidad ---------------------------------------------------------

function allConditions(spec) {
  const out = [];
  for (const condition of Object.values(spec.conditions || {})) out.push(condition);
  for (const field of spec.fields) if (field.when) out.push(field.when);
  for (const definition of Object.values(spec.derived || {})) for (const item of definition.cases) out.push(item.when);
  for (const section of spec.sections) {
    if (section.when) out.push(section.when);
    for (const paragraph of section.paragraphs) if (typeof paragraph === 'object' && paragraph.when) out.push(paragraph.when);
  }
  return out;
}

function citedValues(spec, id) {
  const values = new Set();
  const walk = condition => {
    if (!condition || typeof condition !== 'object') return;
    if (Array.isArray(condition.all)) return condition.all.forEach(walk);
    if (Array.isArray(condition.any)) return condition.any.forEach(walk);
    if (own(condition, 'not')) return walk(condition.not);
    if (condition.field !== id) return;
    if (typeof condition.equals === 'string') values.add(condition.equals);
    if (typeof condition.includes === 'string') values.add(condition.includes);
    if (Array.isArray(condition.in)) condition.in.forEach(v => values.add(v));
  };
  allConditions(spec).forEach(walk);
  return [...values];
}

function involved(spec, conditions) {
  const out = new Set();
  conditions.forEach(condition => fieldsOf(condition, spec, out));
  let grew = true;
  while (grew) {
    grew = false;
    for (const field of spec.fields) {
      if (!out.has(field.id) || !field.when) continue;
      for (const id of fieldsOf(field.when, spec)) if (!out.has(id)) { out.add(id); grew = true; }
    }
  }
  return spec.fields.filter(field => out.has(field.id));
}

function domain(field, spec) {
  if (field.type === 'checkbox') return [false, true];
  if (field.type === 'select') return ['', ...field.options];
  if (field.type === 'group') return [[], [{ [field.fields[0].id]: 'x' }]];
  if (field.type === 'text') return ['', ...citedValues(spec, field.id), '\u0000otro'];
  if (field.type === 'multiselect') {
    const cited = citedValues(spec, field.id);
    const extra = field.options.find(option => !cited.includes(option));
    const base = extra ? [...cited, extra] : cited;
    return Array.from({ length: 2 ** base.length }, (_, mask) => base.filter((_, bit) => mask & (1 << bit)));
  }
  return ['', 'x'];
}

// true = alcanzable, false = inalcanzable, null = demasiadas combinaciones.
function reachable(spec, conditions) {
  const vars = involved(spec, conditions);
  const domains = vars.map(field => domain(field, spec));
  if (domains.reduce((total, values) => total * values.length, 1) > MAX_COMBINATIONS) return null;
  const index = domains.map(() => 0);
  for (;;) {
    const raw = {};
    vars.forEach((field, k) => { raw[field.id] = domains[k][index[k]]; });
    const { data } = effectiveData(spec, raw);
    if (conditions.every(condition => evaluate(condition, data, spec))) return true;
    let k = 0;
    while (k < index.length && ++index[k] === domains[k].length) { index[k] = 0; k++; }
    if (k === index.length) return false;
  }
}

export function reachability(spec) {
  const unreachable = [];
  const skipped = [];
  for (const [i, section] of spec.sections.entries()) {
    const base = section.when ? [section.when] : [];
    // Un repeat sin `empty` solo se ve si su grupo tiene filas.
    const guarded = section.paragraphs.map(p => {
      if (typeof p !== 'object') return [];
      const local = p.when ? [p.when] : [];
      return p.repeat && p.empty === undefined ? [...local, { field: p.repeat, filled: true }] : local;
    });
    const paragraphResults = guarded.map(conditions => {
      if (conditions.length) return reachable(spec, [...base, ...conditions]);
      return base.length ? reachable(spec, base) : true;
    });
    if (paragraphResults.some(result => result === true)) {
      paragraphResults.forEach((result, j) => {
        if (result === false) unreachable.push(`sections[${i}].paragraphs[${j}]`);
        if (result === null) skipped.push(`sections[${i}].paragraphs[${j}]`);
      });
    } else if (paragraphResults.some(result => result === null)) skipped.push(`sections[${i}]`);
    else unreachable.push(`sections[${i}]`);
  }
  return { unreachable, skipped };
}

// --- Avisos -----------------------------------------------------------------

function texts(spec) {
  const out = [['title', spec.title]];
  if (spec.subtitle) out.push(['subtitle', spec.subtitle]);
  for (const [id, definition] of Object.entries(spec.derived || {})) {
    out.push([`derived.${id}.default`, definition.default]);
    definition.cases.forEach((item, j) => out.push([`derived.${id}.cases[${j}].text`, item.text]));
  }
  spec.sections.forEach((section, i) => {
    out.push([`sections[${i}].heading`, section.heading]);
    section.paragraphs.forEach((p, j) => {
      const path = `sections[${i}].paragraphs[${j}]`;
      if (typeof p === 'string') return out.push([path, p]);
      if (!p.repeat) return out.push([path, p.text]);
      if (p.empty) out.push([`${path}.empty`, p.empty]);
      if (p.item) out.push([`${path}.item`, p.item]);
      (p.paragraphs || []).forEach((text, k) => out.push([`${path}.paragraphs[${k}]`, text]));
    });
  });
  return out;
}

export function lint(spec) {
  const warnings = spec.schema_version === 1 ? unknownKeys(spec) : [];
  const inserted = new Set();
  for (const [path, text] of texts(spec)) {
    for (const [, id] of text.matchAll(PLACEHOLDER)) inserted.add(id);
    const marker = text.match(MARKERS);
    if (marker) warnings.push(`${path}: parece contener una marca del modelo (${marker[0]}); conviértela en campo o condición, o elimínala`);
  }
  const conditioned = new Set();
  allConditions(spec).forEach(condition => fieldsOf(condition, spec, conditioned));
  const repeats = spec.sections.flatMap(section => section.paragraphs.filter(p => typeof p === 'object' && p.repeat));
  for (const field of spec.fields) {
    if (field.type === 'group') {
      const uses = repeats.filter(p => p.repeat === field.id);
      if (!uses.length) { warnings.push(`campo ${field.id}: el grupo no se usa en ningún párrafo repeat`); continue; }
      const shown = new Set(uses.flatMap(p => (p.as === 'table' ? (p.columns || field.fields.map(sub => sub.id)) : [])));
      for (const sub of field.fields) {
        if (!shown.has(sub.id) && !inserted.has(sub.id)) warnings.push(`campo ${field.id}: el subcampo ${sub.id} no aparece en ninguna columna ni plantilla`);
      }
      continue;
    }
    if (!inserted.has(field.id) && !conditioned.has(field.id)) warnings.push(`campo ${field.id}: no se usa en ningún texto ni condición`);
    if (field.options && conditioned.has(field.id) && !inserted.has(field.id)) {
      const cited = new Set(citedValues(spec, field.id));
      for (const option of field.options) if (!cited.has(option)) warnings.push(`campo ${field.id}: la opción "${option}" no aparece en ninguna condición`);
    }
  }
  for (const path of reachability(spec).skipped) warnings.push(`${path}: demasiadas combinaciones para comprobar si es alcanzable; revísalo a mano`);
  return warnings;
}
````

- [ ] **Step 4: Ejecutar pruebas y CLI**

Run: `node --test tests/generar-documento/*.test.mjs`
Expected: `# pass 44`, `# fail 0`.

Run: `node skills/generar-documento-auditoria/bin/generar-documento.mjs validate tests/generar-documento/fixtures/comunicacion-final.v2.json`
Expected: `Plantilla válida: Comunicación final de prueba a {{organo}}` sin líneas `Aviso:`.

- [ ] **Step 5: Commit**

```bash
git add skills/generar-documento-auditoria/bin/validar-plantilla.mjs tests/generar-documento/validator-groups.test.mjs
git commit -m "Validate repeatable groups and repeat paragraphs"
```

```json:metadata
{"files": ["skills/generar-documento-auditoria/bin/validar-plantilla.mjs", "tests/generar-documento/validator-groups.test.mjs"], "verifyCommand": "node --test tests/generar-documento/*.test.mjs", "acceptanceCriteria": ["suite reports # pass 44 and # fail 0", "comunicacion-final.v2.json validates with no lint warnings", "subfield in a condition or outside its repeat is rejected with the specified messages", "existing validator tests pass unchanged"], "modelTier": "mechanical"}
```

---

### Task 4: Filas en el formulario y tablas en la vista previa

**Goal:** Mostrar los grupos como tarjetas de filas con «Añadir fila» y «Quitar», aplicar sus obligatorios y pintar tablas y listas en la vista previa y la impresión.

**Files:**
- Modify: `skills/generar-documento-auditoria/assets/assistant-runtime.js` (sustitución completa)
- Modify: `skills/generar-documento-auditoria/assets/assistant.html` (estilos)

**Acceptance Criteria:**
- [ ] `node --check skills/generar-documento-auditoria/assets/assistant-runtime.js` sin errores y `node --test tests/generar-documento/*.test.mjs` → `# pass 44`, `# fail 0`.
- [ ] Con la plantilla `comunicacion-final.v2.json` en el navegador (paso 4), el objeto resultado es: `pendRows0: 1`, `pendRemoveDisabled: true`, `totalHidden0: true`, `progress0: "1 de 3 campos obligatorios completados"`, `incRows: 5`, `addDisabledAtMax: true`, `totalHidden1: false`, `focus: "concepto"`, `blocked: true`, `headers: ["Concepto","Efecto en resultado","Efecto en patrimonio neto"]`, `cells: ["Provisión & ajuste","10","[Efecto en patrimonio neto]"]`, `items: ["Carta de manifestaciones firmada (responsable: [Responsable])"]`, `step2: true`.
- [ ] `zip()` y `docx()` no cambian respecto a la tarea 1.

**Verify:** `node --test tests/generar-documento/*.test.mjs` → `# pass 44`, `# fail 0`

**Steps:**

- [ ] **Step 1: Sustituir `assets/assistant-runtime.js` por completo**

````js
(() => {
  'use strict';
  const { buildModel, effectiveData, filledRows, isEmpty } = globalThis.DocEvaluator;
  const { docxXml } = globalThis.DocExport;
  const byId = id => document.getElementById(id);
  const form = byId('data-form');
  const wrappers = {};
  let finalDocument = null;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const collect = () => {
    const data = {};
    for (const field of spec.fields) {
      if (field.type === 'checkbox') data[field.id] = byId(`field-${field.id}`).checked;
      else if (field.type === 'multiselect') data[field.id] = [...form.querySelectorAll(`input[name="${field.id}"]:checked`)].map(input => input.value);
      else if (field.type === 'group') data[field.id] = groupRows(field).map(card => Object.fromEntries(field.fields.map(sub => [sub.id, card.querySelector(`[data-sub="${sub.id}"]`).value])));
      else data[field.id] = byId(`field-${field.id}`).value;
    }
    return data;
  };
  const model = (data, markMissing = false) => buildModel(spec, data, { markMissing });
  const groupRows = field => [...wrappers[field.id].querySelectorAll(':scope > .group-rows > .group-row')];
  // Campos que cuentan para el progreso y primer elemento al que llevar el foco.
  const requirement = data => {
    const { data: effective, visible } = effectiveData(spec, data);
    const required = [];
    const missing = [];
    for (const field of spec.fields) {
      if (!visible[field.id]) continue;
      if (field.type !== 'group') {
        if (!field.required) continue;
        required.push(field);
        if (isEmpty(field, effective[field.id])) missing.push({ field, focus: field.type === 'multiselect' ? form.querySelector(`input[name="${field.id}"]`) : byId(`field-${field.id}`) });
        continue;
      }
      // Un grupo cuenta si exige filas o si alguna fila rellena tiene subcampos obligatorios.
      const needed = Math.max(field.required ? 1 : 0, field.min_rows || 0);
      const cards = groupRows(field);
      const filled = cards.filter((card, k) => filledRows(field, [data[field.id][k]]).length);
      if (!needed && !(filled.length && field.fields.some(sub => sub.required))) continue;
      required.push(field);
      let focus = null;
      for (const card of filled) {
        const sub = field.fields.find(item => item.required && !card.querySelector(`[data-sub="${item.id}"]`).value.trim());
        if (sub) { focus = card.querySelector(`[data-sub="${sub.id}"]`); break; }
      }
      if (!focus && filled.length < needed) focus = cards.find(card => !filled.includes(card))?.querySelector('[data-sub]') || wrappers[field.id].querySelector('.add-row');
      if (focus) missing.push({ field, focus });
    }
    return { required, missing };
  };

  function showStep(step) {
    byId('step-1').hidden = step !== 1;
    byId('step-2').hidden = step !== 2;
    for (const button of document.querySelectorAll('[data-step]')) {
      if (Number(button.dataset.step) === step) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
    byId('preview-title').textContent = step === 1 ? 'Vista previa' : 'Documento generado';
    byId('preview-hint').textContent = step === 1 ? 'Se actualiza al escribir' : 'Revisa el texto antes de exportar';
    renderPreview(step === 2 ? finalDocument : null);
  }

  function renderPreview(documentModel = null) {
    const data = collect();
    const { visible } = effectiveData(spec, data);
    for (const field of spec.fields) wrappers[field.id].hidden = !visible[field.id];
    const preview = byId('preview');
    preview.replaceChildren();
    const output = documentModel || model(data, true);
    byId('app-title').textContent = output.title;
    byId('app-subtitle').textContent = output.subtitle || 'Rellena los datos y genera el documento';
    preview.append(element('h2', '', output.title));
    if (output.subtitle) preview.append(element('p', 'subtitle', output.subtitle));
    for (const section of output.sections) {
      preview.append(element('h3', '', section.heading));
      for (const item of section.paragraphs) preview.append(itemNode(item));
    }
    if (output.sources.length) {
      preview.append(element('h3', '', 'Fuentes'));
      for (const source of output.sources) preview.append(element('p', '', `${source.title}: ${source.url}`));
    }
    preview.append(element('p', 'draft-note', 'Documento de trabajo sujeto a revisión profesional.'));
    const { required, missing } = requirement(data);
    const complete = required.length - missing.length;
    byId('progress-fill').style.width = `${required.length ? Math.round(complete / required.length * 100) : 100}%`;
    byId('progress-text').textContent = `${complete} de ${required.length} campos obligatorios completados`;
    byId('preview-status').textContent = documentModel ? 'Listo para exportar' : `${output.stats.included} de ${output.stats.total} secciones incluidas según tus respuestas`;
  }

  function itemNode(item) {
    if (typeof item === 'string') return element('p', '', item);
    if (item.list) {
      const list = element('ul');
      for (const text of item.list) list.append(element('li', '', text));
      return list;
    }
    const table = element('table');
    const head = element('tr');
    for (const text of item.table.headers) head.append(element('th', '', text));
    table.append(element('thead'), element('tbody'));
    table.tHead.append(head);
    for (const row of item.table.rows) {
      const line = element('tr');
      for (const text of row) line.append(element('td', '', text));
      table.tBodies[0].append(line);
    }
    return table;
  }

  let rowCounter = 0;
  function addRow(field, values = {}) {
    const rows = wrappers[field.id].querySelector('.group-rows');
    const card = element('div', 'group-row');
    const n = rowCounter++;
    for (const sub of field.fields) {
      const id = `field-${field.id}-${n}-${sub.id}`;
      const label = element('label', '', sub.label);
      label.htmlFor = id;
      if (sub.required) label.append(element('span', '', ' *'));
      let input;
      if (sub.type === 'textarea') { input = element('textarea'); input.rows = 3; }
      else if (sub.type === 'select') {
        input = element('select');
        const empty = element('option', '', 'Selecciona una opción');
        empty.value = '';
        input.append(empty);
        for (const option of sub.options) { const item = element('option', '', option); item.value = option; input.append(item); }
      } else { input = element('input'); input.type = sub.type; }
      input.id = id;
      input.dataset.sub = sub.id;
      input.value = values[sub.id] || '';
      card.append(label, input);
      if (sub.help) card.append(element('p', 'help', sub.help));
    }
    const remove = element('button', 'secondary remove-row', 'Quitar');
    remove.type = 'button';
    remove.addEventListener('click', () => { card.remove(); syncRows(field); finalDocument = null; renderPreview(); });
    card.append(remove);
    rows.append(card);
    syncRows(field);
  }
  function syncRows(field) {
    const count = groupRows(field).length;
    wrappers[field.id].querySelector('.add-row').disabled = count >= (field.max_rows ?? 50);
    for (const button of wrappers[field.id].querySelectorAll('.remove-row')) button.disabled = count <= (field.min_rows || 0);
  }

  function checkLabel(input, text) {
    const label = element('label', 'check');
    label.append(input, document.createTextNode(` ${text}`));
    return label;
  }

  for (const field of spec.fields) {
    const wrapper = element(field.type === 'multiselect' || field.type === 'group' ? 'fieldset' : 'div', 'field');
    wrappers[field.id] = wrapper;
    if (field.type === 'group') {
      wrapper.id = `field-${field.id}`;
      const legend = element('legend', '', field.label);
      if (field.required) legend.append(element('span', '', ' *'));
      wrapper.append(legend);
      if (field.help) wrapper.append(element('p', 'help', field.help));
      wrapper.append(element('div', 'group-rows'));
      const add = element('button', 'secondary add-row', 'Añadir fila');
      add.type = 'button';
      add.addEventListener('click', () => { addRow(field); finalDocument = null; renderPreview(); });
      wrapper.append(add);
      form.append(wrapper);
      const initial = Array.isArray(field.value) ? field.value : [];
      for (const values of initial) addRow(field, values);
      for (let k = initial.length; k < (field.min_rows || 0); k++) addRow(field);
      syncRows(field);
      continue;
    } else if (field.type === 'checkbox') {
      const input = element('input');
      input.type = 'checkbox';
      input.id = `field-${field.id}`;
      input.name = field.id;
      input.checked = field.value === true;
      const label = checkLabel(input, field.label);
      if (field.required) label.append(element('span', '', ' *'));
      wrapper.append(label);
    } else if (field.type === 'multiselect') {
      wrapper.id = `field-${field.id}`;
      const legend = element('legend', '', field.label);
      if (field.required) legend.append(element('span', '', ' *'));
      wrapper.append(legend);
      for (const [k, option] of field.options.entries()) {
        const input = element('input');
        input.type = 'checkbox';
        input.id = `field-${field.id}-${k}`;
        input.name = field.id;
        input.value = option;
        input.checked = Array.isArray(field.value) && field.value.includes(option);
        wrapper.append(checkLabel(input, option));
      }
    } else {
      const label = element('label', '', field.label);
      label.htmlFor = `field-${field.id}`;
      if (field.required) label.append(element('span', '', ' *'));
      let input;
      if (field.type === 'textarea') input = element('textarea');
      else if (field.type === 'select') {
        input = element('select');
        const empty = element('option', '', 'Selecciona una opción');
        empty.value = '';
        input.append(empty);
        for (const option of field.options) {
          const item = element('option', '', option);
          item.value = option;
          input.append(item);
        }
      } else input = element('input');
      if (field.type !== 'select' && field.type !== 'textarea') input.type = field.type;
      input.id = `field-${field.id}`;
      input.name = field.id;
      input.required = Boolean(field.required);
      input.value = field.value || '';
      if (field.type === 'textarea') input.rows = 4;
      wrapper.append(label, input);
    }
    if (field.help) wrapper.append(element('p', 'help', field.help));
    form.append(wrapper);
  }
  const sourceList = byId('source-list');
  for (const source of spec.sources || []) {
    const item = element('li');
    const link = element('a', '', source.title);
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    item.append(link);
    sourceList.append(item);
  }
  byId('sources-wrap').hidden = !sourceList.childElementCount;

  form.addEventListener('input', () => { finalDocument = null; renderPreview(); });
  form.addEventListener('change', () => { finalDocument = null; renderPreview(); });
  byId('generate-button').addEventListener('click', () => {
    const data = collect();
    const [first] = requirement(data).missing;
    if (first) {
      const input = first.focus;
      if (input.tagName === 'BUTTON') { input.focus(); return; }
      input.setCustomValidity('Completa este campo');
      input.reportValidity();
      input.focus();
      input.setCustomValidity('');
      return;
    }
    finalDocument = model(data);
    byId('review-summary').textContent = 'Documento generado. Comprueba el contenido y descarga el formato que necesites.';
    showStep(2);
  });
  document.querySelector('[data-next="1"]').addEventListener('click', () => showStep(1));
  document.querySelector('[data-step="1"]').addEventListener('click', () => showStep(1));
  document.querySelector('[data-step="2"]').addEventListener('click', () => { if (finalDocument) showStep(2); });
  function zip(files) {
    const encoder = new TextEncoder();
    const chunks = [];
    const directory = [];
    let offset = 0;
    const crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
    const crc32 = bytes => {
      let crc = 0xffffffff;
      for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
      return (crc ^ 0xffffffff) >>> 0;
    };
    const header = (size, signature) => { const bytes = new Uint8Array(size); new DataView(bytes.buffer).setUint32(0, signature, true); return bytes; };
    for (const [name, content] of files) {
      const nameBytes = encoder.encode(name);
      const data = encoder.encode(content);
      const crc = crc32(data);
      const local = header(30, 0x04034b50);
      const lv = new DataView(local.buffer);
      lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, nameBytes.length, true);
      chunks.push(local, nameBytes, data);
      const central = header(46, 0x02014b50);
      const cv = new DataView(central.buffer);
      cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true); cv.setUint32(42, offset, true);
      directory.push(central, nameBytes);
      offset += local.length + nameBytes.length + data.length;
    }
    const directorySize = directory.reduce((sum, part) => sum + part.length, 0);
    const end = header(22, 0x06054b50);
    const ev = new DataView(end.buffer);
    ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
    ev.setUint32(12, directorySize, true); ev.setUint32(16, offset, true);
    return new Blob([...chunks, ...directory, end], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }
  function docx(output) {
    const contentTypes = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>';
    const relationships = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
    const docRels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    const styles = '<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:after="320"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:pPr><w:spacing w:after="280"/></w:pPr><w:rPr><w:color w:val="555555"/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style></w:styles>';
    return zip([['[Content_Types].xml', contentTypes], ['_rels/.rels', relationships], ['word/document.xml', docxXml(output)], ['word/styles.xml', styles], ['word/_rels/document.xml.rels', docRels]]);
  }
  byId('docx-button').addEventListener('click', () => {
    if (!finalDocument) return;
    const blob = docx(finalDocument);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${finalDocument.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'documento'}.docx`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 30000);
  });
  byId('pdf-button').addEventListener('click', () => { if (finalDocument) window.print(); });
  showStep(1);
})();
````

- [ ] **Step 2: Añadir estilos en `assets/assistant.html`**

Inserta justo antes de la línea `    .field .help { margin:5px 0 0; color:var(--muted); font-size:12px; }`:

```css
    .group-row { border:1px solid var(--line); border-radius:12px; padding:12px; margin:10px 0; background:#fcfbfa; }
    .group-row label { margin-top:8px; }
    .group-row label:first-child { margin-top:0; }
    .field .add-row,.field .remove-row { border:1px solid var(--sea); border-radius:9px; padding:7px 12px; font-weight:700; margin-top:8px; }
    .field .add-row:disabled,.field .remove-row:disabled { opacity:.45; cursor:not-allowed; }
```

Inserta justo antes de la línea que empieza por `    .placeholder {`:

```css
    .paper table { width:100%; border-collapse:collapse; margin:0 0 14px; font-size:13px; }
    .paper th,.paper td { border:1px solid #9a9a9a; padding:5px 7px; text-align:left; vertical-align:top; white-space:pre-wrap; }
    .paper th { background:#f2f0ee; }
    .paper ul { margin:0 0 14px; padding-left:22px; }
    .paper li { white-space:pre-wrap; }
```

Y tras la línea `      .paper p { orphans:3; widows:3; }` (dentro de `@media print`):

```css
      .paper tr { break-inside:avoid; }
      .paper thead { display:table-header-group; }
```

- [ ] **Step 3: Pruebas**

Run: `node --check skills/generar-documento-auditoria/assets/assistant-runtime.js && node --test tests/generar-documento/*.test.mjs`
Expected: `# pass 44`, `# fail 0`.

- [ ] **Step 4: Comprobar en el navegador**

```bash
node skills/generar-documento-auditoria/bin/generar-documento.mjs render tests/generar-documento/fixtures/comunicacion-final.v2.json "$TMPDIR/g.html"
python3 -m http.server 8766 --bind 127.0.0.1 --directory "$TMPDIR"
```

Abre `http://127.0.0.1:8766/g.html` en el navegador integrado y ejecuta con `javascript_tool`:

```js
const v = id => document.getElementById(id);
const set = (el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); };
const r = {};
const pend = v('field-pendientes'), inc = v('field-incorrecciones');
r.pendRows0 = pend.querySelectorAll('.group-row').length;
r.pendRemoveDisabled = pend.querySelector('.remove-row').disabled;
r.totalHidden0 = v('field-total_incorrecciones').closest('.field').hidden;
r.progress0 = v('progress-text').textContent;
set(v('field-entidad'), 'Prueba'); set(v('field-organo'), 'Consejo');
for (let i = 0; i < 6; i++) inc.querySelector('.add-row').click();
r.incRows = inc.querySelectorAll('.group-row').length;
r.addDisabledAtMax = inc.querySelector('.add-row').disabled;
[...inc.querySelectorAll('.group-row')].slice(1).forEach(c => c.querySelector('.remove-row').click());
const row = inc.querySelector('.group-row');
set(row.querySelector('[data-sub="efecto_resultado"]'), '10');
r.totalHidden1 = v('field-total_incorrecciones').closest('.field').hidden;
v('generate-button').click();
r.focus = document.activeElement.dataset.sub;
r.blocked = v('step-2').hidden;
set(row.querySelector('[data-sub="concepto"]'), 'Provisión & ajuste');
set(v('field-total_incorrecciones'), '10');
r.headers = [...document.querySelectorAll('#preview th')].map(t => t.textContent);
r.cells = [...document.querySelectorAll('#preview td')].map(t => t.textContent);
r.items = [...document.querySelectorAll('#preview li')].map(t => t.textContent);
v('generate-button').click();
r.step2 = !v('step-2').hidden;
r;
```

Expected: el objeto descrito en los criterios de aceptación. Haz una captura del formulario con una fila y de la vista previa con la tabla. Detén el servidor al terminar.

- [ ] **Step 5: Commit**

```bash
git add skills/generar-documento-auditoria/assets/assistant-runtime.js skills/generar-documento-auditoria/assets/assistant.html
git commit -m "Edit repeatable rows and preview tables and lists in the assistant"
```

```json:metadata
{"files": ["skills/generar-documento-auditoria/assets/assistant-runtime.js", "skills/generar-documento-auditoria/assets/assistant.html"], "verifyCommand": "node --test tests/generar-documento/*.test.mjs", "acceptanceCriteria": ["runtime passes node --check and suite reports # pass 44 and # fail 0", "browser check object matches the values listed for comunicacion-final.v2.json", "zip() and docx() unchanged from Task 1"], "modelTier": "standard"}
```

---

### Task 5: Documentación de la habilidad y validación del repositorio

**Goal:** Documentar `group` y `repeat` y la traducción de las tablas y listas de los modelos, y comprobar `assets/docx.js` en `scripts/validate.py`.

**Files:**
- Modify: `skills/generar-documento-auditoria/references/esquema-json.md` (sustitución completa)
- Modify: `skills/generar-documento-auditoria/references/analisis-modelo.md` (sustitución completa)
- Modify: `skills/generar-documento-auditoria/SKILL.md` (sustitución completa)
- Modify: `scripts/validate.py` (lista de archivos del renderizador)

**Acceptance Criteria:**
- [ ] `python3 scripts/validate.py` termina con `OK: plugin schemas; OpenCode and Hermes MCP; metadata, marketplace, both skills, renderer assets and tests` tras `# pass 44`.
- [ ] `references/esquema-json.md` tiene la sección `## Grupos repetibles (v2)`.
- [ ] La tabla del apartado 4 de `references/analisis-modelo.md` ya no contiene «aún no hay pieza» y tiene filas para tabla, enumeración, bloques y fila de total.

**Verify:** `python3 scripts/validate.py` → última línea empieza por `OK:`

**Steps:**

- [ ] **Step 1: Sustituir `references/esquema-json.md`**

````markdown
# Plantilla JSON del asistente

La plantilla es un objeto JSON. El renderizador valida la estructura antes de crear el HTML. Construye `fields` y `sections` después de buscar el modelo con `buscar_modelos_informe`, leerlo con `leer_documento` y completar el inventario de `references/analisis-modelo.md`.

Usa `schema_version: 2` cuando el modelo tenga variación (cláusulas opcionales, alternativas, fragmentos que cambian dentro de la frase). La versión 1 sigue siendo válida para plantillas sin variación o con una sola alternativa por sección.

| Propiedad | Tipo | Uso |
|---|---|---|
| `schema_version` | `1` o `2` | Versión del formato. Lo marcado «v2» exige `2`. |
| `title` | texto | Título del documento. Admite `{{id}}`. |
| `subtitle` | texto opcional | Subtítulo. Admite `{{id}}`. |
| `fields` | lista de objetos | Entre 1 y 50 campos (80 en v2). |
| `conditions` | objeto opcional (v2) | Condiciones con nombre reutilizables. |
| `derived` | objeto opcional (v2) | Textos derivados para lo que cambia dentro de la frase. |
| `sections` | lista de objetos | Entre 1 y 50 secciones (80 en v2). |
| `sources` | lista opcional | Hasta 20 objetos `{ "title": "…", "url": "https://…" }`. |
| `include_sources_in_output` | booleano opcional | Si es `true`, añade las fuentes al documento; por defecto solo se muestran en la interfaz. |

## Campos

Cada campo usa `id` único en minúsculas (`[a-z][a-z0-9_]*`), `label` y `type`. Puede tener `required` (booleano), `value` (valor inicial) y `help` (texto de ayuda).

| `type` | Valor | Notas |
|---|---|---|
| `text`, `textarea`, `date` | texto | |
| `select` | texto | Exige `options` (textos únicos). |
| `checkbox` (v2) | sí / no | Sin `options`. Con `required: true` obliga a marcarla («confirmo que…»). |
| `multiselect` (v2) | lista de opciones | Exige `options`. Se muestra como un grupo de casillas. |
| `group` (v2) | lista de filas | Campo repetible con subcampos; ver «Grupos repetibles». Solo admite la condición `filled` (al menos una fila con contenido). |

Un campo puede llevar `when` (v2): si la condición no se cumple, el campo no se muestra, deja de ser obligatorio y vale vacío en condiciones y textos. La condición de un campo solo puede usar campos **declarados antes** que él.

## Condiciones

Una condición es un objeto con un único operador. Se admite en campos, secciones, párrafos y casos de textos derivados.

```json
{ "field": "opinion", "equals": "Favorable" }
{ "field": "opinion", "in": ["Con salvedades", "Desfavorable"] }
{ "field": "incertidumbre", "checked": true }
{ "field": "asuntos", "includes": "Indicios de fraude" }
{ "field": "encargante", "filled": true }
{ "all": [ { … }, { … } ] }
{ "any": [ { … }, { … } ] }
{ "not": { … } }
{ "ref": "es_eip" }
```

| Operador | Campos admitidos |
|---|---|
| `equals`, `in` | `select`, `text` |
| `checked` | `checkbox` |
| `includes` | `multiselect` |
| `filled` | todos salvo `checkbox` (incluido `group`) |

- Los valores de `equals`, `in` e `includes` deben coincidir **literalmente** con una opción del campo (en campos con opciones).
- `all` y `any` necesitan al menos dos condiciones. El anidamiento máximo es de tres niveles, contando lo que aporte un `ref`.
- En la versión 1 solo se admite `{ "field": …, "equals": … }` en secciones.

## Condiciones con nombre (v2)

```json
"conditions": { "opinion_modificada": { "field": "opinion", "in": ["Con salvedades", "Desfavorable", "Denegada"] } }
```

Se usan con `{ "ref": "opinion_modificada" }`. Una condición con nombre no puede contener `ref`.

## Secciones y párrafos

Cada sección usa `heading`, `paragraphs` y, opcionalmente, `when`. Cada párrafo es un texto o, en v2, `{ "text": "…", "when": { … } }`. Un párrafo con condición falsa se omite; una sección sin párrafos visibles desaparece con su título.

```json
{ "heading": "Opinión", "paragraphs": [
  { "text": "En nuestra opinión, …", "when": { "field": "opinion", "equals": "Favorable" } },
  { "text": "Excepto por los efectos de … {{fundamento}}", "when": { "ref": "opinion_modificada" } }
] }
```

## Grupos repetibles (v2)

Para tablas, enumeraciones y bloques que se repiten por elemento (incorrecciones, honorarios, deficiencias, asuntos pendientes). El campo guarda las filas; un párrafo `repeat` decide cómo se presentan.

```json
{ "id": "incorrecciones", "label": "Incorrecciones no corregidas", "type": "group", "max_rows": 20,
  "fields": [
    { "id": "concepto", "label": "Concepto", "type": "text", "required": true },
    { "id": "efecto_resultado", "label": "Efecto en resultado", "type": "text" }
  ] }
```

- `fields`: entre 1 y 8 subcampos de tipo `text`, `textarea`, `date` o `select` (claves `id`, `label`, `type`, `required`, `help`, `options`). Sin `when` ni `value` propios.
- `required` del grupo: al menos una fila con contenido; `required` de un subcampo: obligatorio en cada fila con contenido. Las filas en blanco se ignoran.
- `min_rows` y `max_rows`: enteros entre 0 y 50 (por defecto 0 y 50). `value`: filas iniciales, como lista de objetos `{ "subcampo": "texto" }`.
- Los identificadores de subcampo no pueden repetir ningún otro identificador. Un subcampo solo puede usarse dentro de los `repeat` de su grupo; no en condiciones ni en otros textos.
- Importes y totales son texto: la fila de total se pide como un campo normal (por ejemplo, con `when: { "field": "incorrecciones", "filled": true }`).

Párrafo `repeat`, en cualquier lugar de `paragraphs`:

```json
{ "repeat": "incorrecciones", "as": "table", "columns": ["concepto", "efecto_resultado"] }
{ "repeat": "pendientes", "as": "list", "item": "{{asunto}} (responsable: {{responsable}})" }
{ "repeat": "deficiencias", "as": "blocks", "paragraphs": ["{{descripcion}}", "Recomendación: {{recomendacion}}"],
  "empty": "No hemos identificado deficiencias significativas." }
```

- `table`: una tabla con los subcampos como columnas (por defecto todos, en su orden; `columns` elige y ordena). Los encabezados son las etiquetas.
- `list`: una viñeta por fila con la plantilla `item`.
- `blocks`: los textos de `paragraphs` (entre 1 y 10) para cada fila.
- `item` y `paragraphs` admiten los subcampos del grupo y los campos y derivados globales. `empty` (opcional) es el texto si no hay filas y solo admite campos y derivados globales; sin `empty`, el párrafo desaparece cuando no hay filas.
- Admite `when` como cualquier párrafo.

## Textos derivados (v2)

Para lo que cambia dentro de la frase. Gana el primer caso cuya condición se cumpla; si ninguno, `default` (obligatorio, puede ser `""`). Los textos pueden usar `{{campo}}`, pero no otro derivado.

```json
"derived": {
  "socios": { "cases": [ { "when": { "field": "forma", "equals": "S.L." }, "text": "socios" } ], "default": "accionistas" },
  "por_encargo": { "cases": [ { "when": { "field": "encargante", "filled": true }, "text": " por encargo de {{encargante}}" } ], "default": "" }
}
```

En títulos, encabezados y párrafos se usan como un campo: `{{socios}}`, `{{por_encargo}}`.

## Marcadores

`{{id}}` inserta un campo `text`, `textarea`, `date` o `select`, o un texto derivado. No puede insertar casillas, selecciones múltiples ni condiciones. Campos, derivados y condiciones comparten identificadores: no puede haber repeticiones.

## Validación

`node bin/generar-documento.mjs validate plantilla.json` detiene la generación ante cualquier error, con la ruta exacta (por ejemplo `sections[4].paragraphs[2].when.equals`), incluido un valor que no es una opción (sugiere la más parecida) o una sección que ninguna combinación de respuestas puede mostrar. Los avisos (`Aviso: …`) no bloquean pero deben revisarse: campos sin uso, opciones que ninguna condición menciona (normal si esa opción es la rama por defecto) y marcas del modelo coladas en el texto (`[●]`, `XXX`, `[Incluir…]`, `[1]`), demasiadas combinaciones para comprobar si una sección es alcanzable (revísala a mano) y, en plantillas `schema_version` 1, claves desconocidas.

Las opciones de `select` y `multiselect` no pueden empezar ni terminar con espacios. Las claves desconocidas (por ejemplo `whn` en lugar de `when`) son un error en `schema_version` 2 y un aviso en `schema_version` 1, para que las plantillas antiguas sigan siendo válidas.

Redacta los párrafos completos según el modelo verificado. El HTML no invoca al LLM tras abrirse: solo inserta datos y selecciona las variantes previstas en el JSON. Por ello, no uses la plantilla para prometer que generará opiniones, conclusiones u otra redacción que dependa de juicio profesional nuevo.
````

- [ ] **Step 2: Sustituir `references/analisis-modelo.md`**

````markdown
# Del modelo MCP al formulario

## 1. Elegir el modelo

Usa `buscar_modelos_informe` primero. Ajusta `tipo` al documento solicitado (`informe_auditoria`, `carta_encargo`, `carta_manifestaciones`, `procedimientos_acordados`, `revision_limitada`, `informe_especial`, `confirmacion_independencia`, `comision_auditoria`, `comunicacion_gobierno`, `parrafo`, `cuestionario` u `otro`). Para informes de auditoría, añade `tipo_opinion`, `eip` y `variante` solo si el usuario los conoce. `query` precisa el tema. Si los filtros estrictos no devuelven resultados, amplía la consulta y verifica manualmente la aplicabilidad de los candidatos.

Compara los resultados por título, tipo de encargo, versión, vigencia, fecha, sector, opinión, EIP y variante cuando esos datos aparezcan. No confundas una mención lateral en una guía con un modelo completo. La búsqueda puede devolver la posición de un ejemplo dentro de un documento largo; conserva `doc_id`, `fuente` y `desde` para la lectura. Esos identificadores son internos y no deben mostrarse al usuario.

## 2. Leer el texto suficiente

Llama a `leer_documento(doc_id, fuente, desde)` y sigue las instrucciones de continuación que entregue (`desde` y, si procede, `desde_caracter`). Si la posición apunta al medio de una guía, lee también el contexto anterior que indique a qué casos aplica. Reúne todos los apartados del modelo elegido, instrucciones de cumplimentación, notas y alternativas. Para localizar un apartado en un documento largo puedes usar el argumento `buscar`, pero después abre el pasaje en su secuencia.

Anota la URL exacta de la fuente y cualquier aviso de vigencia. `buscar_modelos_informe` no filtra por ejercicio, de modo que el ejercicio del usuario debe contrastarse con la fecha y el ámbito del documento y, si es necesario, con la norma o circular aplicable.

## 3. Hacer el inventario de datos

Antes de escribir el JSON, completa una matriz interna como esta:

| Apartado o pasaje del modelo | Texto fijo | Dato que aporta el auditor | Marca del modelo → pieza | Campo JSON | Obligatorio / condición | Evidencia |
|---|---|---|---|---|---|---|
| Encabezado | Fórmula de destinatario | Nombre y cargo del destinatario | Hueco «[Destinatario]» → `text` | `destinatario` | Siempre | URL y apartado leídos |
| Identificación del encargo | Texto del modelo | Entidad y fecha de cierre | Huecos → `text`, `date` | `entidad`, `fecha_cierre` | Siempre | URL y apartado leídos |
| Párrafo alternativo | Redacción de la variante | Selección de variante | «Sustituir por…» → `select` + párrafo con `when` | `tipo_opinion` | Solo si el caso lo requiere | URL y apartado leídos |
| Cláusula opcional | Texto de la cláusula | Si procede incluirla | «Incluir solo si…» → `checkbox` + `when` | `incertidumbre` | Condición de la sección | URL y apartado leídos |

La tabla es una técnica de análisis, no una lista de campos universales. Incluye anexos, tablas, firmas, periodos comparativos, salvedades y notas de cumplimentación si están en el modelo. Distingue hechos conocidos, datos pendientes y decisiones profesionales. Nunca marques una decisión profesional como predeterminada por comodidad.

## 4. Reconocer la variación del modelo

Recorre el texto leído buscando **cada** marca de variación, no solo los huecos. Las marcas cambian de un documento a otro (corchetes, cursivas, notas al pie, recuadros, instrucciones «para el auditor»); identifícalas por su función y tradúcelas a la pieza correspondiente de `references/esquema-json.md`:

| Lo que aparece en el modelo | Pieza |
|---|---|
| «Incluir esta sección/párrafo solo si…», «en su caso», «si procede», «cuando proceda» | `checkbox` + `when` en la sección o el párrafo; `multiselect` + `includes` si son varias de la misma familia (manifestaciones adicionales, asuntos a comunicar) |
| «Aplicable solo a EIP / consolidadas / cotizadas / voluntarias» | `select` + `equals` o `in`; `all` / `any` cuando se cruzan dos datos (cotizada **y** sujeta a LSC) |
| Alternativas completas («sustituir por opinión con salvedades, desfavorable…», «Alternativa A / B») | `select` + un párrafo o una sección por variante, cada uno con su `when` |
| «[A/B]» dentro de la frase (Accionistas/Socios, la Sociedad/el Grupo, singular/plural, órgano) | `derived` con un caso por opción del `select` que lo decide |
| Fragmento opcional en línea («[por encargo de…]») | `derived` con un caso `filled` y `default` vacío |
| Dato que solo se pide en una variante (fundamento de la salvedad, descripción del énfasis) | campo con `when`, declarado después del campo que lo decide |
| Huecos de datos («[ABC, S.A.]», «[XX de XXXX de 20XX]», «[describir…]») | campo `text`, `date` o `textarea` |
| Notas al pie (`[1]`, `[^2]`), «[Publicado mediante…]», instrucciones al auditor, recuadros | se eliminan del texto; si condicionan algo, se convierten en la condición que describen |
| Tabla con columnas fijas y filas que rellena el auditor (incorrecciones, honorarios, amenazas y salvaguardas) | `group` con un subcampo por columna + `repeat` con `as: "table"` |
| Enumeración de elementos («[enumerar documentos]», asuntos pendientes) | `group` + `repeat` con `as: "list"` |
| Bloque de párrafos por elemento (cada deficiencia con su recomendación, cada carta de abogado) | `group` + `repeat` con `as: "blocks"`; si el modelo prevé un texto para cuando no hay elementos, ponlo en `empty` |
| Fila de total o importes calculados | campo `text` normal (aún no hay cálculos), con `when` `filled` sobre el grupo si solo aplica cuando hay filas |
| Una variación que ninguna pieza representa fielmente | pregunta al usuario o prepara asistentes separados; nunca la aproximes |

Cuando la misma lógica se repite en varios sitios (por ejemplo «opinión modificada»), defínela una vez en `conditions` y úsala con `ref`.

## 5. Traducir al JSON y comprobar cobertura

- Conserva el orden de los apartados y el sentido de los párrafos relevantes en `sections`. Usa `{{campo}}` solo para datos variables.
- Usa `fields` para cada dato pendiente. Una misma respuesta puede reutilizarse en varios apartados. Añade `help` para explicar formatos, unidades o referencias al encargo.
- Representa cada marca de variación con la pieza del apartado 4 y usa `schema_version: 2` si empleas alguna pieza nueva. Si una variante requiere una redacción no representable fielmente, crea asistentes separados o pide antes la elección al usuario.
- No copies marcas como `[●]`, `XXXXX` o instrucciones editoriales al documento final; conviértelas en campos o elimínalas si son notas del modelo, revisando que el sentido no cambie.
- Añade la URL exacta del modelo en `sources`. Explica si se usó una fuente secundaria o si faltó el texto completo.
- Antes de renderizar, compara cada fila de la matriz con `fields`, `sections` y condiciones. No debe quedar dato solicitado sin campo ni campo sin propósito claro en el documento.
- Ejecuta `validate` hasta que no haya errores. Revisa cada `Aviso:` y, al entregar, explica cuáles aceptas y por qué (por ejemplo, una opción que es la rama por defecto).
````

- [ ] **Step 3: Sustituir `SKILL.md`**

````markdown
---
name: generar-documento-auditoria
description: Genera un asistente HTML autónomo para preparar informes, cartas y otros documentos de auditoría. Primero busca modelos con buscar_modelos_informe del MCP ICJCE y lee el elegido con leer_documento; analiza su estructura para identificar los datos que debe introducir el auditor. Después crea un formulario dinámico, muestra el documento y permite exportarlo a DOCX o PDF. Úsala cuando el usuario pida crear o cumplimentar un documento de auditoría.
---

# Generar documento de auditoría

Convierte un modelo documental en un **archivo HTML por conversación**. La persona rellena los datos, pulsa **Generar documento**, ve el texto terminado y puede descargar un DOCX real o usar la impresión del navegador para **Guardar como PDF**. El archivo funciona sin conexión y no transmite lo introducido.

## Localizar y leer el modelo en el MCP

Sigue `references/analisis-modelo.md` antes de crear el JSON. **Si el MCP ICJCE está conectado, `buscar_modelos_informe` es el primer paso para cada documento**, incluso si el usuario aportó un ejemplo: permite identificar el modelo y comprobar si existe una versión más apropiada. Descubre las operaciones y sus esquemas en el cliente; los nombres siguientes son operaciones esperadas, no prefijos completos que debas inventar.

1. Identifica el documento pedido y los datos que determinan qué modelo aplica: tipo de encargo, tipo de opinión, EIP o no EIP, cuentas individuales o consolidadas, ejercicio y particularidades. Usa solo los filtros que conozcas; no supongas una opinión o una condición EIP para forzar un resultado.
2. Invoca `buscar_modelos_informe` con la búsqueda y los filtros anunciados por la herramienta (`query`, `tipo`, `tipo_opinion`, `eip`, `variante` según proceda). Si hay varios candidatos, compara título, vigencia, fecha, alcance y posición del ejemplo. Si no aparece uno apropiado, amplía la búsqueda con sinónimos o menos filtros y comunica la limitación si persiste.
3. Invoca `leer_documento` con el `doc_id` y la `fuente` del candidato; usa `desde` para ir a la posición del modelo indicada por la búsqueda. Continúa con los valores de `desde` y `desde_caracter` que devuelva la lectura hasta cubrir el texto del modelo y sus variantes relevantes. Un título o fragmento de búsqueda no basta para construir el documento. Si necesitas un apartado concreto de una guía larga, `buscar` en `leer_documento` ayuda a localizarlo, pero lee después su contexto.
4. Contrasta la aplicabilidad del modelo al encargo y conserva la URL exacta devuelta por el MCP para `sources`. Cuando la vigencia o las cláusulas dependan de una norma o circular, verifica esa fuente con las herramientas pertinentes o una fuente oficial web. El índice de modelos no tiene un filtro de ejercicio: comprueba expresamente la fecha aplicable.

Si el MCP no está disponible, dilo. Trabaja con un modelo aportado por el usuario o una fuente oficial verificada solo si tienes su texto; no presentes esa plantilla como recuperada del MCP. No atribuyas al ICJCE un texto que no hayas leído.

## Extraer los datos que debe aportar el auditor

Recorre el modelo leído **sección por sección**. Para cada título, párrafo, tabla, alternativa y nota de cumplimentación, clasifica: texto fijo que puede conservarse, dato variable del encargo, elección entre variantes, o decisión profesional que exige revisión. Prepara una matriz interna `apartado del modelo → dato solicitado → campo JSON → condición → fuente/pasaje`. Comprueba que todos los huecos y referencias cruzadas del modelo están cubiertos. Identifica también cada marca de variación (cláusulas «incluir solo si…», alternativas, «[A/B]» dentro de la frase, fragmentos opcionales) y tradúcela con la tabla del apartado 4 de `references/analisis-modelo.md`. No conviertas en campo un requisito que pueda obtenerse del propio modelo ni de la fuente.

Agrupa en el formulario los datos que el auditor sí debe introducir: identificación y destinatarios; entidad, ejercicio y marco contable; tipo y alcance del encargo; responsables y fechas; importes y hechos particulares; y selección de párrafos u opinión cuando proceda. **Esta lista es orientativa**: los campos reales salen del modelo elegido. Para cada campo usa una etiqueta concreta, `help` que explique el dato y `required` según sea obligatorio en la variante. Precarga solo datos aportados por el usuario. No inventes cifras, hechos, opinión ni conclusiones. Para la variación usa las piezas de la versión 2 del esquema (`checkbox`, `multiselect`, `when` en campos, secciones y párrafos, `conditions` y `derived`) y, para tablas, listas o bloques que se repiten, `group` con párrafos `repeat`. Si ninguna representa una variante sin alterar el sentido del modelo, pide el dato o prepara plantillas separadas.

## Crear el HTML

Escribe un JSON UTF-8 conforme a `references/esquema-json.md`, con `schema_version: 2` si el modelo tiene variación. Usa `{{id_del_campo}}` en títulos, encabezados y párrafos donde se insertarán respuestas. El ejemplo `examples/carta-encargo.json` es una demostración técnica, no un modelo oficial ni una carta lista para firmar. En documentos reales, redacta las secciones a partir del modelo efectivamente leído y añade su fuente.

```sh
node bin/generar-documento.mjs validate /ruta/plantilla.json
node bin/generar-documento.mjs render /ruta/plantilla.json /ruta/asistente.html
```

Las rutas del comando son relativas a esta habilidad; también puedes invocar el script por ruta absoluta. El renderizador incorpora el logo, estilos y código al HTML, sin CDN ni llamadas al MCP al abrirlo. Entrega el archivo HTML al usuario y explica que puede abrirlo en el navegador, completar los campos y pulsar **Generar documento**.

Si el entorno del chat no permite ejecutar Node o adjuntar archivos, prepara el JSON y explica qué paso falta para generar el HTML. No afirmes que has creado o probado un archivo que no existe.

## Revisión y exportación

- Asegura que todos los campos obligatorios estén completos antes de mostrar el documento final. Incluye condiciones únicamente cuando el modelo exige variantes claras. `validate` debe terminar sin errores; revisa cada `Aviso:` antes de entregar. Contrasta el JSON con la matriz de apartados y datos para detectar omisiones.
- Mantén enlaces de las fuentes en la interfaz. Usa `include_sources_in_output` solo si conviene incluirlas en el documento emitido.
- El DOCX es un archivo Office Open XML descargable. El botón de PDF abre la impresión del navegador; el usuario selecciona **Guardar como PDF**. No lo presentes como descarga PDF directa.
- El logo y los colores ICJCE se usan en el asistente. El documento exportado no lleva logo institucional ni se presenta como emitido por el ICJCE. El auditor debe verificar y aprobar el contenido final.

## Control final

Valida el JSON, genera el HTML, ábrelo si tienes navegador disponible y comprueba al menos un flujo de campos, generación y exportación. Informa brevemente qué modelo consultaste, su enlace y qué datos tendrá que rellenar el auditor. Esta habilidad produce el artefacto; usa las fuentes y el razonamiento de auditoría para preparar su contenido.
````

- [ ] **Step 4: Comprobar `assets/docx.js` en `scripts/validate.py`**

Sustituye la línea:

```python
                     'assets/evaluator.js', 'assets/icjce-logo.png',
```
por:
```python
                     'assets/evaluator.js', 'assets/docx.js', 'assets/icjce-logo.png',
```

- [ ] **Step 5: Validar el repositorio**

Run: `python3 scripts/validate.py` (requiere `pip install -r requirements-dev.txt`)
Expected: `# pass 44`, `# fail 0` y última línea `OK: plugin schemas; OpenCode and Hermes MCP; metadata, marketplace, both skills, renderer assets and tests`.

- [ ] **Step 6: Commit**

```bash
git add skills/generar-documento-auditoria/references/esquema-json.md skills/generar-documento-auditoria/references/analisis-modelo.md skills/generar-documento-auditoria/SKILL.md scripts/validate.py
git commit -m "Document repeatable groups and check DOCX module in validation"
```

```json:metadata
{"files": ["skills/generar-documento-auditoria/references/esquema-json.md", "skills/generar-documento-auditoria/references/analisis-modelo.md", "skills/generar-documento-auditoria/SKILL.md", "scripts/validate.py"], "verifyCommand": "python3 scripts/validate.py", "acceptanceCriteria": ["validate.py ends with OK after 44 passing tests", "esquema-json.md has the section Grupos repetibles (v2)", "analisis-modelo.md section 4 no longer says aún no hay pieza and maps table, list, blocks and total row"], "modelTier": "mechanical"}
```
