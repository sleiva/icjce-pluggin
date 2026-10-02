// Validación de plantillas del asistente documental. Los errores detienen la generación;
// los avisos (`lint`) se muestran y la habilidad debe revisarlos.
import '../assets/numbers.js';
import '../assets/evaluator.js';

const { evaluate, effectiveData } = globalThis.DocEvaluator;
const { parseNumber, compile } = globalThis.DocNumbers;
const ID = /^[a-z][a-z0-9_]*$/;
const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;
const TYPES_V1 = ['text', 'textarea', 'date', 'select'];
const TYPES_V2 = [...TYPES_V1, 'checkbox', 'multiselect', 'group', 'number', 'computed'];
const NUMERIC = ['number', 'computed'];
const SUB_TYPES = [...TYPES_V1, 'number'];
const REPEAT_AS = ['table', 'list', 'blocks'];
const COMPARE_OPS = ['gt', 'gte', 'lt', 'lte', 'eq'];
const LEAF_OPS = ['equals', 'in', 'checked', 'includes', 'filled', ...COMPARE_OPS];
const OPERATORS = [...LEAF_OPS, 'all', 'any', 'not', 'ref'];
const FIELD_OPS = {
  equals: ['select', 'text'],
  in: ['select', 'text'],
  checked: ['checkbox'],
  includes: ['multiselect'],
  filled: ['text', 'textarea', 'date', 'select', 'multiselect', 'group', 'number', 'computed'],
  ...Object.fromEntries(COMPARE_OPS.map(op => [op, NUMERIC])),
};
const MAX_DEPTH = 3;
const MAX_COMBINATIONS = 4096;
const MARKERS = /\[●\]|X{3,}|\[\s*(?:Incluir|Adaptar)[^\]]*\]|\[\^?\d+\s*\]|\[\/?RECUADRO\]/i;
const KEYS = {
  spec: ['schema_version', 'title', 'subtitle', 'fields', 'conditions', 'derived', 'batch', 'sections', 'sources', 'include_sources_in_output'],
  batch: ['label', 'fields', 'filename'],
  field: ['id', 'label', 'type', 'required', 'value', 'help', 'options', 'when'],
  group: ['id', 'label', 'type', 'required', 'value', 'help', 'when', 'fields', 'min_rows', 'max_rows'],
  number: ['id', 'label', 'type', 'required', 'value', 'help', 'when', 'decimals', 'unit'],
  computed: ['id', 'label', 'type', 'expr', 'help', 'when', 'decimals', 'unit'],
  subfield: ['id', 'label', 'type', 'required', 'help', 'options', 'decimals', 'unit'],
  section: ['heading', 'paragraphs', 'when'],
  source: ['title', 'url'],
  derived: ['cases', 'default'],
  derivedCase: ['when', 'text'],
  table: ['repeat', 'as', 'when', 'empty', 'columns'],
  list: ['repeat', 'as', 'when', 'empty', 'item'],
  blocks: ['repeat', 'as', 'when', 'empty', 'paragraphs'],
};
const MAX_ROWS = 50;
const MAX_SUBFIELDS = 8;
const MAX_BLOCK_PARAGRAPHS = 10;
const MAX_BATCH_FIELDS = 20;
const BATCH_TYPES = [...TYPES_V1, 'number'];
const own = (object, key) => Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);

export function fail(message) { throw new Error(message); }

function nonempty(value, path, max = 5000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${path}: texto obligatorio (máximo ${max} caracteres)`);
}

function plain(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
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
  else if (typeof condition.field === 'string') {
    out.add(condition.field);
    const op = COMPARE_OPS.find(key => own(condition, key));
    if (op && typeof condition[op] === 'string') out.add(condition[op]);
  }
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
  if (COMPARE_OPS.includes(op)) {
    const target = condition[op];
    if (typeof target === 'number') { if (!Number.isFinite(target)) fail(`${path}.${op}: número no válido`); return; }
    const other = typeof target === 'string' ? ctx.fields.get(target) : null;
    if (!other || !NUMERIC.includes(other.type)) fail(`${path}.${op}: ${JSON.stringify(target)} no es un campo numérico`);
    if (opts.before && !opts.before.has(target)) fail(`${path}.${op}: ${target} debe declararse antes del campo que lo usa en when`);
  }
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
  if (NUMERIC.includes(field.type)) checkNumberFormat(field, path);
  if (field.type === 'computed') {
    if (field.required !== undefined) fail(`${path}: un campo computed no admite required`);
    if (field.value !== undefined) fail(`${path}: un campo computed no admite value`);
    checkFormula(field, path, ctx);
  }
  if (field.type === 'number' && field.value !== undefined) {
    if (typeof field.value !== 'string' || Number.isNaN(parseNumber(field.value))) fail(`${path}.value debe ser un número válido`);
  } else if (field.value !== undefined) {
    if (field.type === 'checkbox') { if (typeof field.value !== 'boolean') fail(`${path}.value debe ser booleano`); }
    else if (field.type === 'multiselect') { if (!Array.isArray(field.value) || field.value.some(x => !field.options.includes(x))) fail(`${path}.value debe ser una lista de opciones`); }
    else if (typeof field.value !== 'string') fail(`${path}.value debe ser texto`);
  }
  if (field.when !== undefined) ctx.needV2(`${path}.when`);
}

function checkNumberFormat(field, path) {
  if (field.decimals !== undefined && (!Number.isInteger(field.decimals) || field.decimals < 0 || field.decimals > 6)) fail(`${path}.decimals debe ser un entero entre 0 y 6`);
  if (field.unit !== undefined && (typeof field.unit !== 'string' || !field.unit.trim() || field.unit.length > 30)) fail(`${path}.unit debe ser un texto de 1 a 30 caracteres`);
}

// Fórmula de un `computed`: sintaxis y referencias a campos numéricos declarados antes
// (ctx.fields solo contiene, en este punto, los campos anteriores).
function checkFormula(field, path, ctx) {
  if (typeof field.expr !== 'string' || !field.expr.trim()) fail(`${path}.expr: fórmula obligatoria`);
  let result;
  try { result = compile(field.expr); } catch (error) { fail(`${path}.expr: ${error.message}`); }
  for (const id of result.refs) {
    const other = ctx.fields.get(id);
    if (!other) fail(ctx.allIds.has(id) ? `${path}.expr: ${id} debe declararse antes de este campo` : `${path}.expr: identificador desconocido ${id}`);
    if (!NUMERIC.includes(other.type)) fail(`${path}.expr: ${id} no es un campo numérico`);
  }
  for (const { group, sub } of result.sums) {
    const target = ctx.fields.get(group);
    if (!target) fail(ctx.allIds.has(group) ? `${path}.expr: ${group} debe declararse antes de este campo` : `${path}.expr: identificador desconocido ${group}`);
    if (target.type !== 'group') fail(`${path}.expr: sum necesita grupo.subcampo y ${group} no es un grupo`);
    const column = target.fields.find(item => item.id === sub);
    if (!column) fail(`${path}.expr: ${sub} no es un subcampo de ${group}`);
    if (column.type !== 'number') fail(`${path}.expr: ${group}.${sub} debe ser un subcampo number`);
  }
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
    if (sub.type === 'number') checkNumberFormat(sub, p);
    else if (sub.decimals !== undefined || sub.unit !== undefined) fail(`${p}: decimals y unit solo se admiten en subcampos number`);
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
        if (sub.type === 'number' && Number.isNaN(parseNumber(value))) fail(`${p}.${key}: "${value}" no es un número válido`);
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

function checkBatch(batch, ctx) {
  ctx.needV2('batch');
  if (!batch || typeof batch !== 'object' || Array.isArray(batch)) fail('batch debe ser un objeto');
  nonempty(batch.label, 'batch.label', 120);
  if (!Array.isArray(batch.fields) || batch.fields.length < 1 || batch.fields.length > MAX_BATCH_FIELDS || new Set(batch.fields).size !== batch.fields.length) fail(`batch.fields debe contener entre 1 y ${MAX_BATCH_FIELDS} campos sin repetir`);
  batch.fields.forEach((id, k) => {
    const field = ctx.fields.get(id);
    if (!field) fail(`batch.fields[${k}]: ${id} no es un campo`);
    if (!BATCH_TYPES.includes(field.type)) fail(`batch.fields[${k}]: el campo ${id} es ${field.type} y no puede venir del listado`);
  });
  nonempty(batch.filename, 'batch.filename', 200);
  checkPlaceholders(batch.filename, 'batch.filename', ctx, true);
  const used = [...batch.filename.matchAll(PLACEHOLDER)].map(m => m[1]);
  if (!used.some(id => batch.fields.includes(id))) fail('batch.filename debe usar al menos un campo de batch.fields');
  // Un campo común a todas las cartas no puede depender de un valor que cambia por destinatario.
  ctx.spec.fields.forEach((field, i) => {
    if (batch.fields.includes(field.id) || field.when === undefined) return;
    const seen = fieldsOf(field.when, ctx.spec);
    const queue = [...seen];
    for (let k = 0; k < queue.length; k++) {
      const other = ctx.spec.fields.find(item => item.id === queue[k]);
      if (!other || other.type !== 'computed') continue;
      for (const id of dependencies(other, ctx.spec)) if (!seen.has(id)) { seen.add(id); queue.push(id); }
    }
    const reached = ctx.spec.fields.find(item => seen.has(item.id) && batch.fields.includes(item.id));
    if (reached) fail(`fields[${i}].when: depende de ${reached.id}, que viene del listado; ${field.type === 'computed' ? 'los campos calculados no pueden depender del listado en su when' : 'añádelo a batch.fields'}`);
  });
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
  const fieldKeys = type => (['group', 'number', 'computed'].includes(type) ? KEYS[type] : KEYS.field);
  if (Array.isArray(spec.fields)) spec.fields.forEach((field, i) => check(field, fieldKeys(field?.type), `fields[${i}]`));
  each(spec.sections, KEYS.section, 'sections');
  each(spec.sources, KEYS.source, 'sources');
  check(spec.batch, KEYS.batch, 'batch');
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
  const allIds = new Set(Array.isArray(spec.fields) ? spec.fields.map(field => field?.id) : []);
  const ctx = { spec, fields, subfields: new Map(), allIds, claim, needV2: path => { if (!v2) fail(`${path}: requiere schema_version 2`); } };
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
  if (spec.batch !== undefined) checkBatch(spec.batch, ctx);
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

// Campos de los que depende un campo: su `when` y, en un `computed`, su fórmula.
function dependencies(field, spec) {
  const out = field.when ? fieldsOf(field.when, spec) : new Set();
  if (field.type === 'computed') {
    try {
      const { refs, sums } = compile(field.expr);
      refs.forEach(id => out.add(id));
      sums.forEach(({ group }) => out.add(group));
    } catch { /* el validador ya informa del error de sintaxis */ }
  }
  return out;
}

function involved(spec, conditions) {
  const out = new Set();
  conditions.forEach(condition => fieldsOf(condition, spec, out));
  let grew = true;
  while (grew) {
    grew = false;
    for (const field of spec.fields) {
      if (!out.has(field.id)) continue;
      for (const id of dependencies(field, spec)) if (!out.has(id)) { out.add(id); grew = true; }
    }
  }
  return spec.fields.filter(field => out.has(field.id));
}

function domain(field, spec) {
  if (field.type === 'checkbox') return [false, true];
  if (field.type === 'select') return ['', ...field.options];
  if (field.type === 'group') {
    const sub = field.fields.find(item => item.type === 'number') || field.fields[0];
    return [[], [{ [sub.id]: sub.type === 'number' ? '1' : 'x' }]];
  }
  if (field.type === 'number') return ['', '1'];
  if (field.type === 'computed') return [null];
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

// Las comparaciones numéricas se tratan como indeterminadas: cada una pasa a ser una
// casilla libre, para no resolver aritmética al buscar combinaciones.
function relax(spec) {
  const out = structuredClone(spec);
  const free = [];
  const walk = condition => {
    if (!condition || typeof condition !== 'object') return condition;
    if (Array.isArray(condition.all)) return { all: condition.all.map(walk) };
    if (Array.isArray(condition.any)) return { any: condition.any.map(walk) };
    if (own(condition, 'not')) return { not: walk(condition.not) };
    if (!COMPARE_OPS.some(op => own(condition, op))) return condition;
    const id = `__comparacion_${free.length}`;
    free.push({ id, label: id, type: 'checkbox' });
    return { field: id, checked: true };
  };
  for (const name of Object.keys(out.conditions || {})) out.conditions[name] = walk(out.conditions[name]);
  for (const field of out.fields) if (field.when) field.when = walk(field.when);
  for (const definition of Object.values(out.derived || {})) for (const item of definition.cases) item.when = walk(item.when);
  for (const section of out.sections) {
    if (section.when) section.when = walk(section.when);
    for (const paragraph of section.paragraphs) if (typeof paragraph === 'object' && paragraph.when) paragraph.when = walk(paragraph.when);
  }
  out.fields = [...free, ...out.fields];
  return out;
}

export function reachability(original) {
  const spec = relax(original);
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
  if (spec.batch) out.push(['batch.filename', spec.batch.filename]);
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

// Identificadores que aparecen en el divisor de alguna división.
function divisors(node, out = new Set()) {
  if (!node) return out;
  if (node.type === 'op' && node.op === '/') collectRefs(node.right, out);
  for (const child of [node.left, node.right, node.value, ...(node.args || [])]) if (child && typeof child === 'object') divisors(child, out);
  return out;
}

function divisorNodes(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (node.type === 'op' && node.op === '/') out.push(node.right);
  for (const child of [node.left, node.right, node.value, ...(node.args || [])]) divisorNodes(child, out);
  return out;
}

function hasSum(node) {
  if (!node || typeof node !== 'object') return false;
  if (node.type === 'call' && node.name === 'sum') return true;
  return [node.left, node.right, node.value, ...(node.args || [])].some(hasSum);
}

function collectRefs(node, out) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'ref') out.add(node.id);
  for (const child of [node.left, node.right, node.value, ...(node.args || [])]) collectRefs(child, out);
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
  const summed = new Set();
  for (const [i, field] of spec.fields.entries()) {
    if (field.type !== 'computed') continue;
    const { ast, refs, sums } = compile(field.expr);
    refs.forEach(id => conditioned.add(id));
    sums.forEach(({ group, sub }) => { summed.add(group); summed.add(sub); });
    for (const divisor of divisorNodes(ast)) {
      if (divisor.type === 'num' && divisor.value === 0) warnings.push(`fields[${i}].expr: divide por 0`);
      else if (hasSum(divisor)) warnings.push(`fields[${i}].expr: divide por sum(...), que puede valer 0`);
    }
    for (const id of divisors(ast)) {
      const other = spec.fields.find(item => item.id === id);
      if (other && (other.type === 'computed' || !other.required || other.when)) warnings.push(`fields[${i}].expr: divide por ${id}, que puede quedar vacío`);
    }
  }
  const repeats = spec.sections.flatMap(section => section.paragraphs.filter(p => typeof p === 'object' && p.repeat));
  for (const field of spec.fields) {
    if (field.type === 'group') {
      const uses = repeats.filter(p => p.repeat === field.id);
      if (!uses.length && !summed.has(field.id)) { warnings.push(`campo ${field.id}: el grupo no se usa en ningún párrafo repeat ni fórmula`); continue; }
      const shown = new Set(uses.flatMap(p => (p.as === 'table' ? (p.columns || field.fields.map(sub => sub.id)) : [])));
      for (const sub of field.fields) {
        if (!shown.has(sub.id) && !inserted.has(sub.id) && !summed.has(sub.id)) warnings.push(`campo ${field.id}: el subcampo ${sub.id} no aparece en ninguna columna ni plantilla`);
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
